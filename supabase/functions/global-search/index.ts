import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SearchResult {
  category: string;
  id: string;
  title: string;
  subtitle: string;
  snippet?: string;
  deepLink: string;
  matchField?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, filter, dealId, mode } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 1) {
      return new Response(JSON.stringify({ results: [], isQuestion: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const q = query.trim();
    const isQuestion = /^(who|what|why|where|when|how|is |are |do |does |can |should |which )/i.test(q) || q.endsWith("?");

    // If semantic question mode, delegate to AI
    if (mode === "semantic" && isQuestion) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ results: [], isQuestion: true, semanticAnswer: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // We return isQuestion flag and let the frontend handle Newton delegation
      return new Response(JSON.stringify({ results: [], isQuestion: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const results: SearchResult[] = [];
    const lowerQ = q.toLowerCase();
    const ilike = `%${q}%`;

    const shouldSearch = (cat: string) => !filter || filter === "all" || filter === cat;

    // Parallel DB queries
    const queries: Promise<void>[] = [];

    // 1. Deals
    if (shouldSearch("deals")) {
      queries.push(
        supabase
          .from("deals")
          .select("id, deal_name, status, deal_value, closing_date")
          .or(`deal_name.ilike.${ilike}`)
          .limit(10)
          .then(({ data }) => {
            (data || []).forEach((d: any) => {
              results.push({
                category: "Deals",
                id: d.id,
                title: d.deal_name,
                subtitle: `${d.status} · $${(d.deal_value / 1e6).toFixed(0)}M`,
                deepLink: "workspace",
                matchField: "deal_name",
              });
            });
          })
      );
    }

    // 2. Documents (including extracted text)
    if (shouldSearch("documents")) {
      queries.push(
        supabase
          .from("deal_documents")
          .select("id, file_name, doc_type, status, extracted_text, deal_id, extracted_fields")
          .or(`file_name.ilike.${ilike},extracted_text.ilike.${ilike},doc_type.ilike.${ilike}`)
          .limit(15)
          .then(({ data }) => {
            (data || []).forEach((d: any) => {
              let snippet: string | undefined;
              if (d.extracted_text) {
                const idx = d.extracted_text.toLowerCase().indexOf(lowerQ);
                if (idx >= 0) {
                  const start = Math.max(0, idx - 40);
                  const end = Math.min(d.extracted_text.length, idx + q.length + 40);
                  snippet = (start > 0 ? "..." : "") + d.extracted_text.slice(start, end) + (end < d.extracted_text.length ? "..." : "");
                }
              }
              // Also check extracted_fields JSON
              if (!snippet && d.extracted_fields) {
                const fieldsStr = JSON.stringify(d.extracted_fields);
                const idx = fieldsStr.toLowerCase().indexOf(lowerQ);
                if (idx >= 0) {
                  const start = Math.max(0, idx - 30);
                  const end = Math.min(fieldsStr.length, idx + q.length + 30);
                  snippet = fieldsStr.slice(start, end);
                }
              }
              results.push({
                category: "Documents",
                id: d.id,
                title: d.file_name,
                subtitle: `${d.doc_type || "Unknown"} · ${d.status}`,
                snippet,
                deepLink: "documents",
                matchField: snippet ? "content" : "file_name",
              });
            });
          })
      );
    }

    // 3. Audit Log
    if (shouldSearch("audit")) {
      queries.push(
        supabase
          .from("audit_log")
          .select("id, action, details, created_at, deal_id")
          .ilike("action", ilike)
          .order("created_at", { ascending: false })
          .limit(10)
          .then(({ data }) => {
            (data || []).forEach((a: any) => {
              results.push({
                category: "Audit Log",
                id: a.id,
                title: a.action,
                subtitle: new Date(a.created_at).toLocaleDateString(),
                deepLink: "audit",
              });
            });
          })
      );
    }

    // 4. Cap Table
    if (shouldSearch("stakeholders")) {
      queries.push(
        supabase
          .from("cap_table_entries")
          .select("id, shareholder_name, ownership_pct, payout_amount, deal_id")
          .ilike("shareholder_name", ilike)
          .limit(10)
          .then(({ data }) => {
            (data || []).forEach((c: any) => {
              results.push({
                category: "Stakeholders",
                id: c.id,
                title: c.shareholder_name,
                subtitle: `${c.ownership_pct}% · $${(c.payout_amount / 1e6).toFixed(1)}M`,
                deepLink: "stakeholders",
                matchField: "shareholder_name",
              });
            });
          })
      );
    }

    // 5. Approvals
    if (shouldSearch("approvals")) {
      queries.push(
        supabase
          .from("deal_approvals")
          .select("id, approval_side, status, comment, deal_id")
          .or(`approval_side.ilike.${ilike},comment.ilike.${ilike}`)
          .limit(10)
          .then(({ data }) => {
            (data || []).forEach((a: any) => {
              results.push({
                category: "Approvals",
                id: a.id,
                title: `${a.approval_side} Approval`,
                subtitle: a.status,
                snippet: a.comment || undefined,
                deepLink: "approvals",
              });
            });
          })
      );
    }

    // 6. KYC profiles
    if (shouldSearch("kyc")) {
      queries.push(
        supabase
          .from("user_kyc")
          .select("id, full_legal_name, status, bank_name, nationality")
          .or(`full_legal_name.ilike.${ilike},bank_name.ilike.${ilike}`)
          .limit(10)
          .then(({ data }) => {
            (data || []).forEach((k: any) => {
              results.push({
                category: "KYC / Compliance",
                id: k.id,
                title: k.full_legal_name || "Unknown",
                subtitle: `${k.status} · ${k.nationality || ""}`,
                deepLink: "verification",
              });
            });
          })
      );
    }

    // 7. Escrow transactions
    if (shouldSearch("payments")) {
      queries.push(
        supabase
          .from("escrow_transactions")
          .select("id, description, amount, status, deal_id")
          .ilike("description", ilike)
          .limit(10)
          .then(({ data }) => {
            (data || []).forEach((e: any) => {
              results.push({
                category: "Payments",
                id: e.id,
                title: e.description,
                subtitle: `$${(e.amount / 1e6).toFixed(1)}M · ${e.status}`,
                deepLink: "payments",
              });
            });
          })
      );
    }

    // 8. Validation results
    if (shouldSearch("discrepancies")) {
      queries.push(
        supabase
          .from("validation_results")
          .select("id, check_name, message, status")
          .or(`check_name.ilike.${ilike},message.ilike.${ilike}`)
          .limit(10)
          .then(({ data }) => {
            (data || []).forEach((v: any) => {
              results.push({
                category: "Discrepancies",
                id: v.id,
                title: v.check_name,
                subtitle: v.status,
                snippet: v.message || undefined,
                deepLink: "reconciliation",
              });
            });
          })
      );
    }

    await Promise.all(queries);

    return new Response(JSON.stringify({ results, isQuestion, total: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("global-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
