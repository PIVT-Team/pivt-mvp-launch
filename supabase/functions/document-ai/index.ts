import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";
import { extractDocumentText, MIN_EXTRACTABLE_CHARS } from "../_shared/extract-text.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_ENTITY_TYPES = new Set([
  "organization",
  "person",
  "instrument",
  "bank_account",
  "regulatory_body",
]);

const ALLOWED_RELATIONSHIP_TYPES = new Set([
  "controls",
  "beneficially_owns",
  "signs_for",
  "pays_to",
  "acts_as_escrow",
  "acts_as_counsel",
  "acts_as_advisor",
  "is_counterparty_to",
]);

// ── Deterministic keyword-based document classifier ──
// Runs BEFORE AI classification for speed; AI refines after
const DOC_TYPE_KEYWORDS: Record<string, { keywords: string[]; priority: number }> = {
  SPA: { keywords: ["share purchase agreement", "stock purchase agreement", "acquisition agreement", "merger agreement", "asset purchase agreement"], priority: 10 },
  DISCLOSURE_SCHEDULES: { keywords: ["disclosure schedule", "disclosure letter", "seller disclosure"], priority: 9 },
  ESCROW_AGREEMENT: { keywords: ["escrow agreement", "escrow instructions", "escrow arrangement"], priority: 9 },
  FUNDS_FLOW: { keywords: ["funds flow", "fund flow", "sources and uses", "closing statement"], priority: 9 },
  WIRE_AUTHORIZATION: { keywords: ["wire authorization", "wire transfer authorization", "wire approval"], priority: 8 },
  WIRE_INSTRUCTIONS: { keywords: ["wire instructions", "wiring instructions", "bank wire", "wire transfer instructions"], priority: 8 },
  BOARD_CONSENT: { keywords: ["board consent", "board resolution", "unanimous written consent", "board approval"], priority: 8 },
  SECRETARY_CERTIFICATE: { keywords: ["secretary certificate", "secretary's certificate", "certificate of secretary"], priority: 8 },
  OFFICER_CERTIFICATE: { keywords: ["officer certificate", "officer's certificate", "certificate of officer", "closing certificate"], priority: 8 },
  BRING_DOWN_CERTIFICATE: { keywords: ["bring-down", "bring down certificate", "bringdown"], priority: 7 },
  CAP_TABLE: { keywords: ["cap table", "capitalization table", "capitalization", "share register", "stockholder"], priority: 8 },
  WORKING_CAPITAL_STATEMENT: { keywords: ["working capital", "net working capital", "wc statement", "wc adjustment"], priority: 7 },
  LEGAL_OPINION: { keywords: ["legal opinion", "opinion letter", "counsel opinion", "opinion of counsel"], priority: 7 },
  EMPLOYMENT_AGREEMENT: { keywords: ["employment agreement", "employment contract", "offer letter", "executive employment"], priority: 6 },
  IP_ASSIGNMENT: { keywords: ["ip assignment", "intellectual property assignment", "patent assignment", "technology assignment"], priority: 6 },
  NON_COMPETE: { keywords: ["non-compete", "noncompete", "non-competition", "restrictive covenant"], priority: 6 },
  TSA: { keywords: ["transition services", "tsa", "transition agreement"], priority: 6 },
  THIRD_PARTY_CONSENT: { keywords: ["third party consent", "third-party consent", "consent letter", "landlord consent"], priority: 5 },
  PAYOFF_LETTER: { keywords: ["payoff letter", "payoff statement", "pay-off", "debt payoff"], priority: 7 },
  W9: { keywords: ["w-9", "w9", "request for taxpayer", "tin certification"], priority: 6 },
  GOOD_STANDING: { keywords: ["good standing", "certificate of existence", "certificate of status"], priority: 5 },
  FEE_LETTER: { keywords: ["fee letter", "fee agreement", "engagement letter"], priority: 5 },
};

// ── Extraction schemas per document type ──
const EXTRACTION_SCHEMAS: Record<string, object> = {
  SPA: {
    type: "object",
    properties: {
      buyer_name: { type: "string", description: "Name of the buyer/acquirer entity" },
      seller_name: { type: "string", description: "Name of the seller entity" },
      target_name: { type: "string", description: "Name of the target company being acquired" },
      purchase_price: { type: "number", description: "Total purchase price in dollars" },
      closing_date: { type: "string", description: "Expected or stated closing date (YYYY-MM-DD)" },
      escrow_amount: { type: "number", description: "Escrow holdback amount if referenced" },
      governing_law: { type: "string", description: "Governing law jurisdiction" },
      indemnification_cap: { type: "number", description: "Cap on indemnification if stated" },
      basket_amount: { type: "number", description: "Deductible/basket amount if stated" },
    },
    required: ["buyer_name", "seller_name", "purchase_price"],
  },
  FUNDS_FLOW: {
    type: "object",
    properties: {
      total_sources: { type: "number", description: "Sum of all funding sources" },
      total_uses: { type: "number", description: "Sum of all uses/disbursements" },
      escrow_amount: { type: "number", description: "Amount going to escrow" },
      line_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            recipient_name: { type: "string" },
            amount: { type: "number" },
            item_type: { type: "string", enum: ["seller_proceeds", "escrow", "payoff", "fees", "tax_withholding", "other"] },
          },
        },
        description: "Individual line items in the funds flow",
      },
    },
    required: ["total_sources", "total_uses"],
  },
  ESCROW_AGREEMENT: {
    type: "object",
    properties: {
      escrow_amount: { type: "number", description: "Total escrow deposit amount" },
      escrow_agent: { type: "string", description: "Name of the escrow agent/institution" },
      release_conditions: { type: "string", description: "Summary of release conditions" },
      escrow_term_months: { type: "number", description: "Duration of escrow hold in months" },
      interest_treatment: { type: "string", description: "How interest on escrow is handled" },
    },
    required: ["escrow_amount", "escrow_agent"],
  },
  CAP_TABLE: {
    type: "object",
    properties: {
      fully_diluted_shares: { type: "number", description: "Total fully diluted share count" },
      major_holders: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            shares: { type: "number" },
            percentage: { type: "number" },
          },
        },
        description: "Major shareholders with >1% ownership",
      },
    },
  },
  WORKING_CAPITAL_STATEMENT: {
    type: "object",
    properties: {
      estimated_wc: { type: "number", description: "Estimated working capital at closing" },
      target_wc: { type: "number", description: "Target/peg working capital amount" },
      true_up_timeline_days: { type: "number", description: "Days after closing for true-up" },
      adjustment_mechanism: { type: "string", description: "How WC adjustment is calculated" },
    },
  },
};

const CLASSIFICATION_PROMPT = `You are a document classification and extraction engine for M&A transactions and closing binders.

Given the filename and text content of a document, you must:
1. Classify it into one of these types: SPA, DISCLOSURE_SCHEDULES, ESCROW_AGREEMENT, FUNDS_FLOW, WIRE_AUTHORIZATION, WIRE_INSTRUCTIONS, BOARD_CONSENT, SECRETARY_CERTIFICATE, OFFICER_CERTIFICATE, BRING_DOWN_CERTIFICATE, CAP_TABLE, WORKING_CAPITAL_STATEMENT, LEGAL_OPINION, EMPLOYMENT_AGREEMENT, IP_ASSIGNMENT, NON_COMPETE, TSA, THIRD_PARTY_CONSENT, PAYOFF_LETTER, W9, GOOD_STANDING, FEE_LETTER, OTHER
2. Assign a confidence score (0-1)
3. Extract key structured fields based on the document type
4. Identify validation flags (issues, missing fields, discrepancies)
5. Determine the document role: buyer_side, seller_side, or mutual
6. Extract ontology-ready entity candidates and relationships

For SPAs: Extract buyer_name, seller_name, target_name, purchase_price, closing_date, escrow_amount, governing_law
For Funds Flow: Extract total_sources, total_uses, escrow_amount, line_items (recipient_name, amount, item_type)
For Escrow: Extract escrow_amount, escrow_agent, release_conditions
For Cap Tables: Extract fully_diluted_shares, major_holders
For Working Capital: Extract estimated_wc, target_wc, true_up_timeline_days
For Certificates: Extract certifying_entity, date, covers_agreement

For ontology extraction:
- identified_entities should include every named party, person, organization, financial instrument, bank account, or regulator mentioned in the document when reasonably clear
- identified_relationships should include directional links between those entities using only: controls, beneficially_owns, signs_for, pays_to, acts_as_escrow, acts_as_counsel, acts_as_advisor, is_counterparty_to
- prefer organizations for companies, banks, law firms, escrow agents, and counterparties unless the document clearly names a person

Respond using the extract_document_data tool.`;

const QA_PROMPT = `You are Newton, PIVT's Document Intelligence Engine. You answer questions about deal documents.

You have access to extracted document data. When answering:
- Cite the source document name
- Reference specific extracted fields
- Be precise with financial figures
- Flag any discrepancies you notice
- If information is not in the documents, say so clearly

Available document data is provided in the context.`;

type EntityCandidate = {
  name: string;
  entity_type?: string;
  confidence?: number;
  aliases?: string[];
  metadata?: Record<string, unknown>;
};

type RelationshipCandidate = {
  from_name: string;
  to_name: string;
  relationship_type: string;
  provenance?: string;
  confidence?: number;
  effective_date?: string;
};

/**
 * What the classifier actually gets to read.
 *
 * This used to send the caller's `textContent` — which, for every upload, was
 * the stub string `"[Document: foo.pdf]"`. The document was fetched and parsed
 * a few lines above and the result was then thrown away here, so classification
 * and field extraction were still working from a filename.
 *
 * Sends the opening and the closing rather than the first N characters: the
 * purchase price and party names are at the front, and the execution date,
 * signature blocks and schedules are at the back. A flat head-slice of a long
 * agreement reads the recitals and nothing else.
 */
const CLASSIFY_HEAD = 12_000;
const CLASSIFY_TAIL = 6_000;

function buildClassificationInput(fileName: string, text: string): string {
  const body = text || "";
  let excerpt: string;
  if (body.length <= CLASSIFY_HEAD + CLASSIFY_TAIL) {
    excerpt = body;
  } else {
    const skipped = body.length - CLASSIFY_HEAD - CLASSIFY_TAIL;
    excerpt =
      body.slice(0, CLASSIFY_HEAD) +
      `\n\n[... ${skipped.toLocaleString()} characters omitted from the middle of this document ...]\n\n` +
      body.slice(-CLASSIFY_TAIL);
  }
  return `Filename: ${fileName}\n\nDocument text${
    body.length > CLASSIFY_HEAD + CLASSIFY_TAIL ? " (opening and closing sections)" : ""
  }:\n${excerpt}`;
}

function classifyByKeywords(filename: string, textContent: string): { doc_type: string; confidence: number } | null {
  const combined = `${filename} ${(textContent || "").slice(0, 3000)}`.toLowerCase();
  let bestMatch: { doc_type: string; confidence: number; priority: number } | null = null;

  for (const [docType, { keywords, priority }] of Object.entries(DOC_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        const confidence = 0.7 + (priority / 50);
        if (!bestMatch || priority > bestMatch.priority) {
          bestMatch = { doc_type: docType, confidence: Math.min(confidence, 0.95), priority };
        }
        break;
      }
    }
  }
  return bestMatch ? { doc_type: bestMatch.doc_type, confidence: bestMatch.confidence } : null;
}

function normalizeEntityType(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ALLOWED_ENTITY_TYPES.has(candidate) ? candidate : "organization";
}

function normalizeRelationshipType(value: unknown): string | null {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ALLOWED_RELATIONSHIP_TYPES.has(candidate) ? candidate : null;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeName(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function inferEntitiesFromFields(fields: Record<string, any>): EntityCandidate[] {
  const entities: EntityCandidate[] = [];

  const namedOrganizations = [
    fields.buyer_name,
    fields.seller_name,
    fields.target_name,
    fields.escrow_agent,
    fields.certifying_entity,
  ];

  for (const name of namedOrganizations) {
    const normalized = normalizeName(name);
    if (normalized) {
      entities.push({ name: normalized, entity_type: "organization", confidence: 0.84 });
    }
  }

  if (Array.isArray(fields.major_holders)) {
    for (const holder of fields.major_holders) {
      const holderName = normalizeName(holder?.name);
      if (!holderName) continue;
      entities.push({
        name: holderName,
        entity_type: "person",
        confidence: 0.8,
        metadata: {
          shares: holder?.shares ?? null,
          percentage: holder?.percentage ?? null,
        },
      });
    }
  }

  if (Array.isArray(fields.line_items)) {
    for (const item of fields.line_items) {
      const recipient = normalizeName(item?.recipient_name ?? item?.payee);
      const payer = normalizeName(item?.payor ?? item?.payer);
      if (recipient) entities.push({ name: recipient, entity_type: "organization", confidence: 0.78 });
      if (payer) entities.push({ name: payer, entity_type: "organization", confidence: 0.78 });
    }
  }

  return entities;
}

function inferRelationshipsFromFields(fields: Record<string, any>, fileName: string | null): RelationshipCandidate[] {
  const relationships: RelationshipCandidate[] = [];
  const provenance = fileName || "document_ai_extraction";

  const buyer = normalizeName(fields.buyer_name);
  const seller = normalizeName(fields.seller_name);
  const target = normalizeName(fields.target_name);
  const escrowAgent = normalizeName(fields.escrow_agent);

  if (buyer && seller) {
    relationships.push({ from_name: buyer, to_name: seller, relationship_type: "is_counterparty_to", provenance, confidence: 0.84 });
    relationships.push({ from_name: seller, to_name: buyer, relationship_type: "is_counterparty_to", provenance, confidence: 0.84 });
  }

  if (seller && target) {
    relationships.push({ from_name: seller, to_name: target, relationship_type: "beneficially_owns", provenance, confidence: 0.8 });
  }

  if (escrowAgent && target) {
    relationships.push({ from_name: escrowAgent, to_name: target, relationship_type: "acts_as_escrow", provenance, confidence: 0.82 });
  }

  if (Array.isArray(fields.line_items)) {
    for (const item of fields.line_items) {
      const payer = normalizeName(item?.payor ?? item?.payer);
      const recipient = normalizeName(item?.recipient_name ?? item?.payee);
      if (payer && recipient) {
        relationships.push({
          from_name: payer,
          to_name: recipient,
          relationship_type: "pays_to",
          provenance,
          confidence: typeof item?.amount === "number" ? 0.88 : 0.8,
        });
      }
    }
  }

  return relationships;
}

function dedupeEntities(candidates: EntityCandidate[]): EntityCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const name = normalizeName(candidate.name);
    if (!name) return false;
    const key = `${name.toLowerCase()}::${normalizeEntityType(candidate.entity_type)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((candidate) => ({
    ...candidate,
    name: normalizeName(candidate.name)!,
    entity_type: normalizeEntityType(candidate.entity_type),
    aliases: uniqueStrings([candidate.name, ...(Array.isArray(candidate.aliases) ? candidate.aliases : [])]),
  }));
}

function dedupeRelationships(candidates: RelationshipCandidate[]): RelationshipCandidate[] {
  const seen = new Set<string>();
  const output: RelationshipCandidate[] = [];

  for (const candidate of candidates) {
    const fromName = normalizeName(candidate.from_name);
    const toName = normalizeName(candidate.to_name);
    const relationshipType = normalizeRelationshipType(candidate.relationship_type);
    if (!fromName || !toName || !relationshipType) continue;

    const key = `${fromName.toLowerCase()}::${toName.toLowerCase()}::${relationshipType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      ...candidate,
      from_name: fromName,
      to_name: toName,
      relationship_type: relationshipType,
    });
  }

  return output;
}

async function resolveOrCreateEntity(
  adminClient: any,
  dealId: string,
  documentId: string | null,
  fileName: string | null,
  candidate: EntityCandidate,
  counters: { entitiesCreated: number; resolutionsCreated: number; matchedEntities: number },
): Promise<{ relationshipEntityId: string; variantEntityId?: string; canonicalEntityId: string }> {
  const normalizedName = normalizeName(candidate.name);
  if (!normalizedName) {
    throw new Error("Entity candidate name is required");
  }

  const entityType = normalizeEntityType(candidate.entity_type);
  const candidateConfidence = typeof candidate.confidence === "number" ? candidate.confidence : 0.8;
  const metadata = {
    ...(candidate.metadata && typeof candidate.metadata === "object" ? candidate.metadata : {}),
    extracted_from_document_id: documentId,
    extracted_from_file: fileName,
  };

  const { data: searchMatches, error: searchError } = await adminClient.rpc("search_entities", {
    search_term: normalizedName,
    entity_type: entityType,
  });
  if (searchError) throw searchError;

  const bestMatch = (searchMatches || []).find((match: any) => Number(match.similarity_score || 0) > 0.8);

  if (bestMatch?.entity_id) {
    counters.matchedEntities += 1;

    const { data: variantEntity, error: variantError } = await adminClient
      .from("entities")
      .insert({
        canonical_id: bestMatch.entity_id,
        entity_type: entityType,
        canonical_name: normalizedName,
        name_variants: uniqueStrings([normalizedName, ...(candidate.aliases || [])]),
        source_deal_id: dealId,
        confidence: Math.max(candidateConfidence, Number(bestMatch.similarity_score || 0)),
        metadata: {
          ...metadata,
          resolution_status: "automatic_match",
        },
        created_by_source: "ai_extraction",
      })
      .select("id")
      .single();
    if (variantError) throw variantError;

    const { error: resolutionError } = await adminClient
      .from("entity_resolution")
      .insert({
        variant_entity_id: variantEntity.id,
        canonical_entity_id: bestMatch.entity_id,
        resolution_method: "automatic_name_match",
        confidence: Number(bestMatch.similarity_score || candidateConfidence),
        resolved_by: null,
      });
    if (resolutionError) throw resolutionError;

    counters.resolutionsCreated += 1;

    return {
      relationshipEntityId: bestMatch.entity_id,
      variantEntityId: variantEntity.id,
      canonicalEntityId: bestMatch.entity_id,
    };
  }

  const { data: insertedEntity, error: insertError } = await adminClient
    .from("entities")
    .insert({
      canonical_id: null,
      entity_type: entityType,
      canonical_name: normalizedName,
      name_variants: uniqueStrings([normalizedName, ...(candidate.aliases || [])]),
      source_deal_id: dealId,
      confidence: candidateConfidence,
      metadata,
      created_by_source: "ai_extraction",
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  counters.entitiesCreated += 1;

  return {
    relationshipEntityId: insertedEntity.id,
    canonicalEntityId: insertedEntity.id,
  };
}

async function syncOntologyExtraction(
  adminClient: any,
  args: {
    dealId: string;
    documentId: string | null;
    fileName: string | null;
    extractedFields: Record<string, any>;
    identifiedEntities?: EntityCandidate[];
    identifiedRelationships?: RelationshipCandidate[];
  },
) {
  const counters = {
    entitiesCreated: 0,
    resolutionsCreated: 0,
    matchedEntities: 0,
    relationshipsCreated: 0,
  };

  const inferredEntities = inferEntitiesFromFields(args.extractedFields || {});
  const inferredRelationships = inferRelationshipsFromFields(args.extractedFields || {}, args.fileName);

  const entityCandidates = dedupeEntities([
    ...(Array.isArray(args.identifiedEntities) ? args.identifiedEntities : []),
    ...inferredEntities,
  ]);

  const entityMap = new Map<string, { relationshipEntityId: string; canonicalEntityId: string; variantEntityId?: string }>();

  for (const candidate of entityCandidates) {
    const resolved = await resolveOrCreateEntity(
      adminClient,
      args.dealId,
      args.documentId,
      args.fileName,
      candidate,
      counters,
    );
    entityMap.set(candidate.name.toLowerCase(), resolved);
  }

  const relationshipCandidates = dedupeRelationships([
    ...(Array.isArray(args.identifiedRelationships) ? args.identifiedRelationships : []),
    ...inferredRelationships,
  ]);

  const relationshipRows = relationshipCandidates.flatMap((candidate) => {
    const fromEntity = entityMap.get(candidate.from_name.toLowerCase());
    const toEntity = entityMap.get(candidate.to_name.toLowerCase());
    if (!fromEntity || !toEntity) return [];

    return [{
      deal_id: args.dealId,
      entity_from_id: fromEntity.relationshipEntityId,
      entity_to_id: toEntity.relationshipEntityId,
      relationship_type: candidate.relationship_type,
      provenance: candidate.provenance || args.fileName || args.documentId || "document_ai_extraction",
      confidence: typeof candidate.confidence === "number" ? candidate.confidence : 0.8,
      effective_date: candidate.effective_date || null,
    }];
  });

  if (relationshipRows.length > 0) {
    const { error: relationshipsError } = await adminClient
      .from("relationships")
      .insert(relationshipRows);
    if (relationshipsError) throw relationshipsError;
    counters.relationshipsCreated = relationshipRows.length;
  }

  return counters;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireJwt(req, corsHeaders);
    const { action, documentId, fileName, textContent, question, dealId, documents } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "classify") {
      // Read the actual document.
      //
      // Callers used to pass a placeholder ("[Document: x.pdf, Type hint: SPA]")
      // and this function classified from the filename, writing that stub into
      // text_content. Nothing downstream — obligations, discrepancy field
      // checks, signature and consent extraction, document Q&A — had ever seen
      // a real document. If the caller supplies genuine text we use it; a stub
      // or nothing means we fetch and parse the file ourselves.
      let effectiveText = textContent || "";
      let extractionMethod = "caller_supplied";
      let extractionProblem: string | null = null;

      // Callers historically sent several placeholder shapes: "[Document: …]"
      // and "[XLSX: …]". Anything bracketed-and-tiny is a stub, not content.
      const looksLikeStub = /^\[(Document|XLSX|PDF|File):/i.test(effectiveText.trim()) ||
                            effectiveText.trim().length < MIN_EXTRACTABLE_CHARS;

      if (looksLikeStub && documentId) {
        const { data: docRow } = await adminClient
          .from("contract_documents")
          .select("file_url, filename")
          .eq("id", documentId)
          .maybeSingle();

        if (docRow?.file_url) {
          const extracted = await extractDocumentText(
            adminClient as never,
            docRow.file_url,
            docRow.filename || fileName || "document",
            { apiKey: LOVABLE_API_KEY }
          );
          extractionMethod = extracted.method;
          extractionProblem = extracted.problem ?? null;
          if (extracted.text.length >= MIN_EXTRACTABLE_CHARS) {
            effectiveText = extracted.text;
          }
        } else {
          extractionProblem = "No stored file to read for this document.";
        }
      }

      const keywordResult = classifyByKeywords(fileName || "", effectiveText);
      const hintType = keywordResult?.doc_type || "OTHER";
      const extractionSchema = EXTRACTION_SCHEMAS[hintType];
      const schemaHint = extractionSchema
        ? `\n\nExpected document type: ${hintType}. Extract these fields: ${JSON.stringify(extractionSchema)}`
        : "";

      const allDocTypes = Object.keys(DOC_TYPE_KEYWORDS).concat(["OTHER"]);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: CLASSIFICATION_PROMPT + schemaHint },
            { role: "user", content: buildClassificationInput(fileName || "", effectiveText) },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extract classification, fields, flags, ontology entities, and ontology relationships from document",
              parameters: {
                type: "object",
                properties: {
                  doc_type: { type: "string", enum: allDocTypes },
                  confidence: { type: "number", description: "Classification confidence 0-1" },
                  document_role: { type: "string", enum: ["buyer_side", "seller_side", "mutual"] },
                  extracted_fields: {
                    type: "object",
                    description: "Key-value pairs of extracted fields relevant to the document type",
                    additionalProperties: true,
                  },
                  validation_flags: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["info", "warning", "critical"] },
                        field: { type: "string" },
                        message: { type: "string" },
                      },
                      required: ["severity", "field", "message"],
                    },
                  },
                  requirement_group: { type: "string", enum: ["Core Closing", "Ancillary", "IP & Employment", "Tax", "Compliance", "Financial", "Approvals", "Other"] },
                  page_count_estimate: { type: "number" },
                  summary: { type: "string", description: "2-3 sentence summary of the document" },
                  identified_entities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        entity_type: { type: "string", enum: ["organization", "person", "instrument", "bank_account", "regulatory_body"] },
                        confidence: { type: "number" },
                        aliases: { type: "array", items: { type: "string" } },
                        metadata: { type: "object", additionalProperties: true },
                      },
                      required: ["name", "entity_type"],
                    },
                  },
                  identified_relationships: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        from_name: { type: "string" },
                        to_name: { type: "string" },
                        relationship_type: { type: "string", enum: ["controls", "beneficially_owns", "signs_for", "pays_to", "acts_as_escrow", "acts_as_counsel", "acts_as_advisor", "is_counterparty_to"] },
                        provenance: { type: "string" },
                        confidence: { type: "number" },
                        effective_date: { type: "string" },
                      },
                      required: ["from_name", "to_name", "relationship_type"],
                    },
                  },
                },
                required: ["doc_type", "confidence", "extracted_fields", "validation_flags", "summary"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_document_data" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const body = await response.text();
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error [${status}]: ${body}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      let result: any = {
        doc_type: keywordResult?.doc_type || "OTHER",
        confidence: keywordResult?.confidence || 0.5,
        document_role: "mutual",
        extracted_fields: {},
        validation_flags: [],
        requirement_group: "Other",
        summary: "Unable to classify",
        page_count_estimate: 1,
        identified_entities: [],
        identified_relationships: [],
      };

      if (toolCall?.function?.arguments) {
        try {
          const aiResult = JSON.parse(toolCall.function.arguments);
          if (keywordResult && keywordResult.confidence > (aiResult.confidence || 0)) {
            aiResult.doc_type = keywordResult.doc_type;
            aiResult.confidence = keywordResult.confidence;
          }
          result = { ...result, ...aiResult };
        } catch (e) {
          // Falling back to the deterministic keyword result is correct, but it
          // must not be invisible: a document classified as "Other" because the
          // model returned malformed arguments looks identical to one that is
          // genuinely unclassifiable.
          console.error(
            `document-ai: could not parse tool arguments for ${fileName ?? documentId} ` +
            `(${String((e as Error)?.message ?? e)}); using keyword classification instead. ` +
            `Arguments began: ${String(toolCall.function.arguments).slice(0, 200)}`
          );
        }
      }

      if (documentId) {
        await adminClient.from("deal_documents").update({
          doc_type: result.doc_type.toLowerCase(),
          doc_type_confidence: result.confidence,
          extracted_fields: result.extracted_fields,
          validation_flags: result.validation_flags,
          extracted_text: effectiveText.slice(0, 10000) || null,
          page_count: result.page_count_estimate || 1,
          status: "processed",
        }).eq("id", documentId);
      }

      // Update the row we were given, rather than inserting a second one.
      //
      // This was an upsert with onConflict:"id" and NO id in the payload, so
      // Postgres generated a fresh uuid, found no conflict, and INSERTed. Every
      // upload produced two contract_documents rows — the uploader's (user's
      // doc_type, no text) and this one (AI doc_type, the stub) — and the
      // versioning trigger then superseded the user's row with the duplicate.
      //
      // file_url is deliberately not touched: it was being nulled here, which
      // orphaned the stored file.
      if (documentId) {
        const update: Record<string, unknown> = {
          // Postgres text has no practical limit; the old 100k cap clipped long
          // agreements before any extractor could read them. 2MB is a guard
          // against a runaway file, not a content decision.
          text_content: effectiveText.slice(0, 2_000_000) || null,
          status: extractionProblem && effectiveText.length < MIN_EXTRACTABLE_CHARS ? "PARSE_FAILED" : "PARSED",
          extracted_fields: {
            ...(result.extracted_fields || {}),
            _extraction: { method: extractionMethod, problem: extractionProblem },
          },
          extraction_confidence: result.confidence || 0,
          requirement_group: result.requirement_group || "Other",
          document_role: result.document_role || "mutual",
        };
        // Only let the classifier change the type when it is confident and has
        // actually read something. A filename-only guess should not override
        // what the person who uploaded it chose.
        if (result.doc_type !== "OTHER" && (result.confidence || 0) >= 0.7 &&
            effectiveText.length >= MIN_EXTRACTABLE_CHARS) {
          update.doc_type = result.doc_type;
        }
        await adminClient.from("contract_documents").update(update).eq("id", documentId);
      }

      let ontologyWriteSummary = null;
      if (dealId) {
        ontologyWriteSummary = await syncOntologyExtraction(adminClient, {
          dealId,
          documentId: documentId || null,
          fileName: fileName || null,
          extractedFields: result.extracted_fields || {},
          identifiedEntities: result.identified_entities || [],
          identifiedRelationships: result.identified_relationships || [],
        });
      }

      if (dealId) {
        adminClient.functions.invoke("deal-workflow-orchestrator", {
          body: {
            deal_id: dealId,
            document_id: documentId,
            doc_type: result.doc_type,
            extracted_fields: result.extracted_fields,
            action: "process_document",
          },
        }).catch((err: any) => console.error("Orchestrator trigger failed:", err));
      }

      return new Response(JSON.stringify({ success: true, result, ontology: ontologyWriteSummary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "qa") {
      const docsContext = (documents || []).map((d: any) =>
        `Document: ${d.file_name} (Type: ${d.doc_type})\nExtracted Fields: ${JSON.stringify(d.extracted_fields)}\nFlags: ${JSON.stringify(d.validation_flags)}\nText Preview: ${(d.extracted_text || '').slice(0, 2000)}`
      ).join("\n\n---\n\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `${QA_PROMPT}\n\n## DOCUMENT CONTEXT\n${docsContext}` },
            { role: "user", content: question },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error [${status}]`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("document-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
