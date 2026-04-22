import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type Primitive = string | number | null | undefined;

export interface CorrectionDocumentSpan {
  document_id?: string | null;
  page?: number | null;
  char_start?: number | null;
  char_end?: number | null;
}

export interface FieldCorrectionInput {
  tableName: string;
  recordId: string;
  fieldName: string;
  aiOutput: Primitive;
  humanCorrection: Primitive;
  documentSpan?: CorrectionDocumentSpan | null;
  aiConfidence?: number | null;
}

const AI_SOURCES = new Set(["ai", "newton", "agent"]);

export function isAiDerivedRecord(createdBySource?: string | null, confidenceStatus?: string | null) {
  return AI_SOURCES.has((createdBySource || "").toLowerCase()) && confidenceStatus !== "human_verified";
}

export function formatAiConfidenceLabel(aiConfidence?: number | null) {
  if (typeof aiConfidence === "number" && Number.isFinite(aiConfidence)) {
    return `AI ${Math.round(aiConfidence * 100)}%`;
  }

  return "AI";
}

export function hasMeaningfulChange(previousValue: Primitive, nextValue: Primitive) {
  return normalizeValue(previousValue) !== normalizeValue(nextValue);
}

export async function recordFieldCorrections(corrections: FieldCorrectionInput[]) {
  for (const correction of corrections) {
    const { error } = await supabase.rpc("record_field_correction", {
      p_table_name: correction.tableName,
      p_record_id: correction.recordId,
      p_field_name: correction.fieldName,
      p_ai_output: stringifyCorrectionValue(correction.aiOutput),
      p_human_correction: stringifyCorrectionValue(correction.humanCorrection),
      p_document_span: (correction.documentSpan ?? null) as Json,
      p_ai_confidence: correction.aiConfidence ?? null,
    });

    if (error) {
      throw error;
    }
  }
}

function normalizeValue(value: Primitive) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  return value.trim();
}

function stringifyCorrectionValue(value: Primitive) {
  if (value == null) return "";
  return typeof value === "number" ? String(value) : value;
}