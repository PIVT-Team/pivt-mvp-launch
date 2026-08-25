// useDealDocuments — single source of truth for "all uploaded files on a deal".
//
// We have two doc tables for historical reasons:
//   - `deal_documents` — user-uploaded files via the Documents page
//     (richer fields: mime_type, page_count, extracted_fields, validation_flags)
//   - `contract_documents` — files written by the doc-ingestion pipeline +
//     the upload flows in CapTableCover and DealDocumentUploader (different
//     column names: filename, file_url, extraction_confidence)
//
// Both real and unavoidable; consolidating would be a schema migration with
// downstream edge-function blast radius. Instead, this hook reads both,
// normalizes them into a single shape, and gives every surface that wants
// to display "files on this deal" one consistent thing to render.
//
// Used by DocumentsCover (the main Files view). Any future "file picker" or
// "documents linked to this approval" widget should use this hook too rather
// than re-implementing the merge.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UnifiedDocStatus =
  | "uploading"
  | "processing"
  | "processed"
  | "pending_review"
  | "verified"
  | "rejected"
  | "failed";

export interface ValidationFlag {
  severity: "info" | "warning" | "critical";
  field: string;
  message: string;
}

export interface UnifiedDocument {
  id: string;
  deal_id: string;
  file_name: string;
  file_size: number;
  file_path: string | null;
  mime_type: string | null;
  page_count: number;
  status: UnifiedDocStatus;
  doc_type: string;
  doc_type_confidence: number;
  extracted_text: string | null;
  extracted_fields: Record<string, any>;
  validation_flags: ValidationFlag[];
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  /** Which underlying table this row came from. Useful for debugging
   *  and for surfaces that need to call back into the source table
   *  (e.g. delete from deal_documents vs contract_documents). */
  source: "deal_documents" | "contract_documents";
}

// contract_documents has its own status vocabulary. This normalizes the
// commonly-seen values onto the deal_documents enum so the UI status badge
// reads the same regardless of which table the row came from.
const normalizeContractStatus = (s: string | null | undefined): UnifiedDocStatus => {
  const v = (s || "").toUpperCase();
  if (v === "VERIFIED") return "verified";
  if (v === "REJECTED" || v === "PARSE_FAILED") return "failed";
  if (v === "UPLOADED") return "uploading";
  if (v === "PROCESSING" || v === "EXTRACTING") return "processing";
  if (v === "PARSED" || v === "EXTRACTION_COMPLETE") return "processed";
  if (v === "PENDING_REVIEW" || v === "NEEDS_REVIEW") return "pending_review";
  return "processed";
};

const mapContractRow = (cd: any): UnifiedDocument => ({
  id: cd.id,
  deal_id: cd.deal_id,
  file_name: cd.filename ?? cd.file_name ?? "Untitled",
  file_size: cd.file_size ?? 0,
  file_path: cd.file_url ?? cd.file_path ?? null,
  mime_type: cd.mime_type ?? "application/pdf",
  page_count: cd.page_count ?? 0,
  status: normalizeContractStatus(cd.status),
  doc_type: (cd.doc_type ?? "other").toLowerCase(),
  doc_type_confidence: Number(cd.extraction_confidence ?? cd.doc_type_confidence ?? 1),
  extracted_text: cd.extracted_text ?? null,
  extracted_fields: (cd.extracted_fields ?? {}) as Record<string, any>,
  validation_flags: Array.isArray(cd.validation_flags) ? cd.validation_flags : [],
  uploaded_by: cd.uploaded_by ?? "System",
  created_at: cd.created_at,
  updated_at: cd.updated_at,
  source: "contract_documents",
});

const mapDealRow = (dd: any): UnifiedDocument => ({
  id: dd.id,
  deal_id: dd.deal_id,
  file_name: dd.file_name ?? dd.filename ?? "Untitled",
  file_size: dd.file_size ?? 0,
  file_path: dd.file_path ?? dd.file_url ?? null,
  mime_type: dd.mime_type ?? null,
  page_count: dd.page_count ?? 0,
  status: (dd.status ?? "processed") as UnifiedDocStatus,
  doc_type: dd.doc_type ?? "other",
  doc_type_confidence: Number(dd.doc_type_confidence ?? 0),
  extracted_text: dd.extracted_text ?? null,
  extracted_fields: (dd.extracted_fields ?? {}) as Record<string, any>,
  validation_flags: Array.isArray(dd.validation_flags) ? dd.validation_flags : [],
  uploaded_by: dd.uploaded_by ?? "Current User",
  created_at: dd.created_at,
  updated_at: dd.updated_at,
  source: "deal_documents",
});

export interface UseDealDocumentsResult {
  documents: UnifiedDocument[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseDealDocumentsOptions {
  /** If true, poll every 3s while any document is in an in-flight state.
   *  Auto-stops once every row reaches a terminal state. */
  pollWhileInFlight?: boolean;
}

const isInFlight = (d: UnifiedDocument) =>
  d.status === "uploading" || d.status === "processing";

export function useDealDocuments(
  dealId: string | null | undefined,
  opts: UseDealDocumentsOptions = {},
): UseDealDocumentsResult {
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!dealId) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dealRes, contractRes] = await Promise.all([
        supabase.from("deal_documents").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }),
        supabase
          .from("contract_documents")
          .select("id, deal_id, filename, doc_type, status, created_at, updated_at, file_url, extracted_fields, extraction_confidence")
          .eq("deal_id", dealId)
          .order("created_at", { ascending: false }),
      ]);

      const dealRows = (dealRes.data || []).map(mapDealRow);
      const contractRows = (contractRes.data || []).map(mapContractRow);

      // Deduplicate by id (rare but possible if the same uuid lands in both
      // tables — deal_documents wins because it carries richer metadata).
      const dealIds = new Set(dealRows.map((d) => d.id));
      const merged = [
        ...dealRows,
        ...contractRows.filter((c) => !dealIds.has(c.id)),
      ];

      // Most-recent first across both sources.
      merged.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

      setDocuments(merged);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while anything's in-flight so users see status flip without reload.
  const inFlightKey = useMemo(
    () => documents.filter(isInFlight).map((d) => d.id).join("|"),
    [documents],
  );
  useEffect(() => {
    if (!opts.pollWhileInFlight || !inFlightKey) return;
    const id = setInterval(() => { refresh(); }, 3000);
    return () => clearInterval(id);
  }, [opts.pollWhileInFlight, inFlightKey, refresh]);

  return { documents, loading, error, refresh };
}
