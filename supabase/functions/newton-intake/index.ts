import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Newton Intake — Classify uploaded files, extract structured data, propose actions.
 *
 * Actions:
 *   classify  — detect file type from name/content
 *   extract   — parse structured data from file
 *   propose   — generate proposed actions from extraction
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, upload_id, deal_id, file_name, file_content_preview, extraction_id } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ── CLASSIFY ──
    if (action === "classify") {
      if (!upload_id || !file_name) {
        return jsonResponse({ success: false, error: "upload_id and file_name required" }, 400);
      }

      const detected = classifyFile(file_name, file_content_preview || "");

      await admin.from("newton_uploads").update({
        detected_type: detected.type,
        status: "classified",
        updated_at: new Date().toISOString(),
      }).eq("id", upload_id);

      return jsonResponse({
        success: true,
        detected_type: detected.type,
        confidence: detected.confidence,
        label: detected.label,
      });
    }

    // ── EXTRACT ──
    if (action === "extract") {
      if (!upload_id || !deal_id) {
        return jsonResponse({ success: false, error: "upload_id and deal_id required" }, 400);
      }

      await admin.from("newton_uploads").update({ status: "extracting", updated_at: new Date().toISOString() }).eq("id", upload_id);

      // Get upload details
      const { data: upload } = await admin.from("newton_uploads").select("*").eq("id", upload_id).single();
      if (!upload) return jsonResponse({ success: false, error: "Upload not found" }, 404);

      const fileType = upload.user_override_type || upload.detected_type || "general";
      const extractionResult = await extractData(admin, upload, fileType);

      // Save extraction
      const { data: extraction, error: extErr } = await admin.from("newton_extractions").insert({
        upload_id,
        deal_id,
        extraction_type: extractionResult.type,
        extracted_data: extractionResult.data,
        field_summary: extractionResult.summary,
        confidence_score: extractionResult.confidence,
      }).select("id").single();

      if (extErr) {
        await admin.from("newton_uploads").update({ status: "error", error_message: extErr.message }).eq("id", upload_id);
        return jsonResponse({ success: false, error: extErr.message }, 500);
      }

      await admin.from("newton_uploads").update({ status: "extracted", updated_at: new Date().toISOString() }).eq("id", upload_id);

      // Log
      await admin.from("audit_log").insert({
        deal_id,
        action: "newton_extraction_completed",
        details: {
          upload_id,
          extraction_id: extraction?.id,
          file_name: upload.file_name,
          detected_type: fileType,
          rows_extracted: extractionResult.summary?.total_rows || 0,
        },
      });

      return jsonResponse({
        success: true,
        extraction_id: extraction?.id,
        extraction_type: extractionResult.type,
        summary: extractionResult.summary,
        data: extractionResult.data,
      });
    }

    // ── PROPOSE ──
    if (action === "propose") {
      if (!extraction_id || !deal_id) {
        return jsonResponse({ success: false, error: "extraction_id and deal_id required" }, 400);
      }

      const { data: extraction } = await admin.from("newton_extractions").select("*").eq("id", extraction_id).single();
      if (!extraction) return jsonResponse({ success: false, error: "Extraction not found" }, 404);

      const { data: uploadData } = await admin.from("newton_uploads").select("id, file_name, detected_type, user_override_type").eq("id", extraction.upload_id).single();

      const proposals = await generateProposals(admin, deal_id, extraction, uploadData);

      // Insert proposals
      if (proposals.length > 0) {
        await admin.from("newton_proposed_actions").insert(
          proposals.map(p => ({
            upload_id: extraction.upload_id,
            extraction_id,
            deal_id,
            action_type: p.action_type,
            action_label: p.action_label,
            description: p.description,
            impact_level: p.impact_level,
            preview_data: p.preview_data,
            status: "proposed",
          }))
        );
      }

      // Log
      await admin.from("audit_log").insert({
        deal_id,
        action: "newton_actions_proposed",
        details: {
          extraction_id,
          action_count: proposals.length,
          action_types: proposals.map(p => p.action_type),
        },
      });

      return jsonResponse({
        success: true,
        proposed_count: proposals.length,
        proposals: proposals.map(p => ({ action_type: p.action_type, action_label: p.action_label, impact_level: p.impact_level })),
      });
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("newton-intake error:", e);
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// Classification
// ═══════════════════════════════════════════════════════════════

function classifyFile(fileName: string, contentPreview: string): { type: string; confidence: number; label: string } {
  const lower = fileName.toLowerCase();
  const content = contentPreview.toLowerCase();

  // Stakeholder patterns
  if (/(stakeholder|shareholder|cap.?table|equity.?holder|ownership)/i.test(lower) ||
      /(stakeholder|shareholder|ownership|equity)/i.test(content)) {
    return { type: "stakeholder_spreadsheet", confidence: 0.85, label: "Stakeholder Spreadsheet" };
  }

  // Funds flow / waterfall
  if (/(funds?.?flow|waterfall|distribution|payout|allocation)/i.test(lower) ||
      /(funds flow|waterfall|distribution|sources.*uses)/i.test(content)) {
    return { type: "funds_flow", confidence: 0.85, label: "Funds Flow / Waterfall" };
  }

  // Wire instructions
  if (/(wire|bank.?instruction|payment.?detail|routing|aba|swift)/i.test(lower) ||
      /(routing|swift|iban|wire.*transfer|bank.*account)/i.test(content)) {
    return { type: "wire_instructions", confidence: 0.85, label: "Wire Instructions" };
  }

  // Default
  return { type: "general", confidence: 0.5, label: "General Document" };
}

// ═══════════════════════════════════════════════════════════════
// Extraction (deterministic — parses CSV-like headers)
// ═══════════════════════════════════════════════════════════════

async function extractData(admin: any, upload: any, fileType: string) {
  // For MVP: use AI to extract if we have a LOVABLE_API_KEY, otherwise use file metadata
  const apiKey = Deno.env.get("LOVABLE_API_KEY");

  // Try to get file content from storage
  let textContent = "";
  try {
    const { data: fileData } = await admin.storage.from("deal-documents").download(upload.file_path);
    if (fileData) {
      const text = await fileData.text();
      textContent = text.substring(0, 8000); // First 8K for extraction
    }
  } catch (e) {
    console.warn("Could not read file content:", e);
  }

  if (apiKey && textContent) {
    return await aiExtract(apiKey, textContent, fileType, upload.file_name);
  }

  // Fallback: basic CSV/TSV parsing
  return basicExtract(textContent, fileType);
}

async function aiExtract(apiKey: string, content: string, fileType: string, fileName: string) {
  const systemPrompt = getExtractionPrompt(fileType);

  try {
    const resp = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `File: ${fileName}\n\nContent:\n${content}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!resp.ok) throw new Error(`AI API returned ${resp.status}`);
    const result = await resp.json();
    const parsed = JSON.parse(result.choices?.[0]?.message?.content || "{}");

    return {
      type: fileType === "stakeholder_spreadsheet" ? "stakeholders" :
            fileType === "funds_flow" ? "payout_rows" :
            fileType === "wire_instructions" ? "wire_details" : "general_fields",
      data: parsed.rows || parsed.items || parsed.data || [],
      summary: {
        total_rows: (parsed.rows || parsed.items || parsed.data || []).length,
        missing_fields: parsed.missing_fields || [],
        confidence: parsed.confidence || 0.7,
        columns_detected: parsed.columns_detected || [],
      },
      confidence: parsed.confidence || 0.7,
    };
  } catch (e) {
    console.error("AI extraction failed:", e);
    return basicExtract(content, fileType);
  }
}

function getExtractionPrompt(fileType: string): string {
  if (fileType === "stakeholder_spreadsheet") {
    return `You are a data extraction agent. Extract stakeholder data from the provided spreadsheet content.
Return JSON: { "rows": [{ "name": string, "email": string|null, "role": string, "ownership_pct": number|null, "entity_type": "individual"|"entity" }], "missing_fields": string[], "confidence": number, "columns_detected": string[] }
Map columns intelligently. If ownership % is present, include it. Role should be one of: Shareholder, Founder, Employee, Advisor, Investor, LP, Buyer, Seller, Target, Escrow Agent, Lender, Counsel.`;
  }

  if (fileType === "funds_flow") {
    return `You are a data extraction agent. Extract payout/distribution data from the provided funds flow content.
Return JSON: { "rows": [{ "recipient": string, "amount": number, "payment_type": string, "currency": string }], "total_sources": number|null, "total_uses": number|null, "missing_fields": string[], "confidence": number, "columns_detected": string[] }
Payment types: Purchase Price, Escrow, Fees, Debt Payoff, Advisory Fee, Tax Withholding, Other.`;
  }

  if (fileType === "wire_instructions") {
    return `You are a data extraction agent. Extract wire/bank instruction data from the provided content.
Return JSON: { "rows": [{ "payee": string, "bank_name": string|null, "account_holder": string|null, "routing_number": string|null, "account_last4": string|null, "swift_bic": string|null, "iban": string|null, "amount": number|null, "currency": string }], "missing_fields": string[], "confidence": number, "columns_detected": string[] }`;
  }

  return `You are a data extraction agent. Extract structured data from the provided document.
Return JSON: { "rows": [{ key-value pairs }], "missing_fields": string[], "confidence": number, "columns_detected": string[] }`;
}

function basicExtract(content: string, fileType: string) {
  // Simple CSV/TSV line parsing
  const lines = content.split("\n").filter(l => l.trim());
  if (lines.length < 2) {
    return {
      type: fileType === "stakeholder_spreadsheet" ? "stakeholders" : fileType === "funds_flow" ? "payout_rows" : "general_fields",
      data: [],
      summary: { total_rows: 0, missing_fields: ["content"], confidence: 0.3 },
      confidence: 0.3,
    };
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ""));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(delimiter).map(v => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  });

  return {
    type: fileType === "stakeholder_spreadsheet" ? "stakeholders" : fileType === "funds_flow" ? "payout_rows" : "general_fields",
    data: rows,
    summary: { total_rows: rows.length, missing_fields: [], confidence: 0.5, columns_detected: headers },
    confidence: 0.5,
  };
}

// ═══════════════════════════════════════════════════════════════
// Proposal Generation
// ═══════════════════════════════════════════════════════════════

async function generateProposals(admin: any, dealId: string, extraction: any, upload: any) {
  const fileType = upload?.user_override_type || upload?.detected_type || "general";
  const data = extraction.extracted_data || [];
  const rowCount = Array.isArray(data) ? data.length : 0;

  const proposals: any[] = [];

  if (fileType === "stakeholder_spreadsheet" && rowCount > 0) {
    // Check existing stakeholders to find new vs existing
    const { data: existing } = await admin.from("cap_table_entries").select("shareholder_name, email").eq("deal_id", dealId);
    const existingNames = new Set((existing || []).map((e: any) => e.shareholder_name?.toLowerCase()));
    const newStakeholders = data.filter((r: any) => !existingNames.has((r.name || "").toLowerCase()));
    const updateStakeholders = data.filter((r: any) => existingNames.has((r.name || "").toLowerCase()));

    if (newStakeholders.length > 0) {
      proposals.push({
        action_type: "import_stakeholder_data",
        action_label: `Import ${newStakeholders.length} new stakeholder${newStakeholders.length !== 1 ? "s" : ""}`,
        description: `Create ${newStakeholders.length} new stakeholder records from the uploaded spreadsheet.`,
        impact_level: "medium",
        preview_data: { new_count: newStakeholders.length, names: newStakeholders.slice(0, 10).map((r: any) => r.name) },
      });
    }

    if (updateStakeholders.length > 0) {
      proposals.push({
        action_type: "update_existing_stakeholders",
        action_label: `Update ${updateStakeholders.length} existing stakeholder${updateStakeholders.length !== 1 ? "s" : ""}`,
        description: `Update records for ${updateStakeholders.length} stakeholders that already exist in this deal.`,
        impact_level: "medium",
        preview_data: { update_count: updateStakeholders.length, names: updateStakeholders.slice(0, 10).map((r: any) => r.name) },
      });
    }

    // Find stakeholders with email for KYC
    const withEmail = data.filter((r: any) => r.email);
    if (withEmail.length > 0) {
      proposals.push({
        action_type: "prepare_kyc_kyb_requests",
        action_label: `Prepare KYC/KYB for ${withEmail.length} stakeholder${withEmail.length !== 1 ? "s" : ""}`,
        description: `Queue verification requests for stakeholders with email addresses.`,
        impact_level: "high",
        preview_data: { count: withEmail.length, emails: withEmail.slice(0, 5).map((r: any) => r.email) },
      });
    }

    // Missing fields check
    const missingEmail = data.filter((r: any) => !r.email);
    if (missingEmail.length > 0) {
      proposals.push({
        action_type: "flag_missing_fields",
        action_label: `${missingEmail.length} stakeholder${missingEmail.length !== 1 ? "s" : ""} missing email`,
        description: `These stakeholders have no email address, which blocks KYC/KYB verification.`,
        impact_level: "low",
        preview_data: { missing_field: "email", count: missingEmail.length, names: missingEmail.slice(0, 10).map((r: any) => r.name) },
      });
    }
  }

  if (fileType === "funds_flow" && rowCount > 0) {
    proposals.push({
      action_type: "import_payout_rows",
      action_label: `Import ${rowCount} payout row${rowCount !== 1 ? "s" : ""}`,
      description: `Create wire instruction records from the parsed funds flow data.`,
      impact_level: "medium",
      preview_data: { row_count: rowCount, total_amount: data.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0) },
    });

    proposals.push({
      action_type: "run_funds_flow_validation",
      action_label: "Run funds flow validation",
      description: "Validate payout totals against deal value and check for discrepancies.",
      impact_level: "low",
      preview_data: {},
    });

    // Check for recipient matching
    const { data: stakeholders } = await admin.from("cap_table_entries").select("shareholder_name").eq("deal_id", dealId);
    if (stakeholders && stakeholders.length > 0) {
      proposals.push({
        action_type: "verify_wire_matches",
        action_label: "Match payouts to stakeholders",
        description: "Compare fund flow recipients against deal stakeholders to identify mismatches.",
        impact_level: "low",
        preview_data: { stakeholder_count: stakeholders.length, payout_count: rowCount },
      });
    }
  }

  if (fileType === "wire_instructions" && rowCount > 0) {
    proposals.push({
      action_type: "parse_wire_instructions",
      action_label: `Import ${rowCount} wire instruction${rowCount !== 1 ? "s" : ""}`,
      description: `Create wire instruction records with bank details from the uploaded document.`,
      impact_level: "medium",
      preview_data: { row_count: rowCount },
    });

    proposals.push({
      action_type: "verify_wire_matches",
      action_label: "Match wires to stakeholders",
      description: "Match wire instruction payees against stakeholder records.",
      impact_level: "low",
      preview_data: {},
    });
  }

  return proposals;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
