// reportPersistenceService — Storage + audit_log backing for the Reports tab.
//
// Design constraint: no new tables, no new buckets. We piggyback on the
// existing `deal-documents` bucket (with a `reports/` prefix to keep files
// out of the way) and on the existing `audit_log` table (which all other
// modules use for action history).
//
// Two record shapes get stored in audit_log:
//
//   action = 'report_generated'
//   details = {
//     report_id, report_type_id, report_name, format,
//     scope, scope_label, storage_path, file_name, file_size,
//     date_range_start, date_range_end, status, error
//   }
//
//   action = 'report_schedule_set'
//   details = {
//     report_type_id, format, frequency, enabled,
//     last_run_at, next_run_at
//   }
//
// "Latest state" for either is the most recent row matching the key tuple.

import { supabase } from "@/integrations/supabase/client";

export type ReportFormat = "PDF" | "CSV" | "XLSX" | "JSON";
export type ReportScope = "deal" | "portfolio";
export type ReportFrequency = "daily" | "weekly" | "monthly";

export interface PersistedReport {
  id: string; // the original report uuid (also embedded in storage path)
  audit_log_id: string;
  deal_id: string | null;
  user_id: string | null;
  report_type_id: string;
  report_name: string;
  format: ReportFormat;
  scope: ReportScope;
  scope_label: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  generated_at: string;
  date_range?: { start: string; end: string };
  status: "ready" | "failed";
  error?: string;
}

export interface ReportSchedule {
  audit_log_id: string;
  deal_id: string | null;
  user_id: string | null;
  report_type_id: string;
  format: ReportFormat;
  frequency: ReportFrequency;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
}

const BUCKET = "deal-documents";

// Build a storage path that won't collide with real deal documents. The
// `reports/` prefix segregates these from the document-pipeline files that
// already live in this bucket, and keeps the per-deal subfolder structure
// the bucket policies expect.
const buildStoragePath = (dealId: string | null, reportId: string, fileName: string) => {
  const safe = fileName.replace(/[^a-z0-9._-]/gi, "_");
  return `reports/${dealId || "portfolio"}/${reportId}-${safe}`;
};

// ───────── Reports ─────────

export async function uploadReport(params: {
  reportId: string;
  blob: Blob;
  fileName: string;
  reportTypeId: string;
  reportName: string;
  format: ReportFormat;
  scope: ReportScope;
  scopeLabel: string;
  dealId: string | null;
  userId: string | null;
  dateRange?: { start: string; end: string };
}): Promise<PersistedReport> {
  const storagePath = buildStoragePath(params.dealId, params.reportId, params.fileName);

  // Upload to the shared bucket. We use `upsert: false` so a repeat call
  // with the same report uuid surfaces as an error rather than silently
  // replacing the blob — repeats indicate a generation bug.
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, params.blob, {
      contentType: params.blob.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  const details = {
    report_id: params.reportId,
    report_type_id: params.reportTypeId,
    report_name: params.reportName,
    format: params.format,
    scope: params.scope,
    scope_label: params.scopeLabel,
    storage_path: storagePath,
    file_name: params.fileName,
    file_size: params.blob.size,
    date_range_start: params.dateRange?.start ?? null,
    date_range_end: params.dateRange?.end ?? null,
    status: "ready" as const,
  };

  const { data: logRow, error: logErr } = await supabase
    .from("audit_log")
    .insert({
      deal_id: params.dealId,
      user_id: params.userId,
      action: "report_generated",
      details,
    })
    .select("id, created_at")
    .single();

  if (logErr) {
    // Best-effort cleanup so we don't orphan a blob that's invisible to the
    // UI (the UI lists from audit_log, so a missing log row = invisible).
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(`Failed to record report: ${logErr.message}`);
  }

  return {
    id: params.reportId,
    audit_log_id: logRow.id,
    deal_id: params.dealId,
    user_id: params.userId,
    report_type_id: params.reportTypeId,
    report_name: params.reportName,
    format: params.format,
    scope: params.scope,
    scope_label: params.scopeLabel,
    storage_path: storagePath,
    file_name: params.fileName,
    file_size: params.blob.size,
    generated_at: logRow.created_at,
    date_range: params.dateRange,
    status: "ready",
  };
}

export async function listPersistedReports(dealId: string | null): Promise<PersistedReport[]> {
  // We track both successes (`report_generated`) and the few mutation events
  // (`report_deleted`) so the UI can skip rows that were since removed.
  let query = supabase
    .from("audit_log")
    .select("id, deal_id, user_id, action, details, created_at")
    .in("action", ["report_generated", "report_deleted"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (dealId) query = query.eq("deal_id", dealId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load reports: ${error.message}`);

  const deletedIds = new Set<string>();
  const rows: PersistedReport[] = [];

  for (const row of (data || []) as any[]) {
    const reportId = row.details?.report_id;
    if (!reportId) continue;
    if (row.action === "report_deleted") {
      deletedIds.add(reportId);
      continue;
    }
    if (deletedIds.has(reportId)) continue;
    rows.push({
      id: reportId,
      audit_log_id: row.id,
      deal_id: row.deal_id,
      user_id: row.user_id,
      report_type_id: row.details.report_type_id,
      report_name: row.details.report_name,
      format: row.details.format,
      scope: row.details.scope,
      scope_label: row.details.scope_label,
      storage_path: row.details.storage_path,
      file_name: row.details.file_name,
      file_size: row.details.file_size,
      generated_at: row.created_at,
      date_range:
        row.details.date_range_start && row.details.date_range_end
          ? { start: row.details.date_range_start, end: row.details.date_range_end }
          : undefined,
      status: row.details.status === "failed" ? "failed" : "ready",
      error: row.details.error || undefined,
    });
  }

  return rows;
}

export async function getReportDownloadUrl(storagePath: string): Promise<string> {
  // 1-hour signed URL is plenty for a click-through-download. We deliberately
  // don't make the bucket public so reports can't be enumerated by URL.
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) throw new Error(`Could not create download link: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

export async function deletePersistedReport(
  report: PersistedReport,
  userId: string | null,
): Promise<void> {
  // Storage delete is best-effort; audit_log gets the source-of-truth tombstone.
  await supabase.storage.from(BUCKET).remove([report.storage_path]).catch(() => undefined);
  const { error } = await supabase.from("audit_log").insert({
    deal_id: report.deal_id,
    user_id: userId,
    action: "report_deleted",
    details: { report_id: report.id, file_name: report.file_name },
  });
  if (error) throw new Error(`Failed to delete report: ${error.message}`);
}

// ───────── Schedules ─────────

const FREQUENCY_DAYS: Record<ReportFrequency, number> = { daily: 1, weekly: 7, monthly: 30 };

export const computeNextRunAt = (frequency: ReportFrequency, from: Date = new Date()): string => {
  const next = new Date(from);
  next.setDate(next.getDate() + FREQUENCY_DAYS[frequency]);
  return next.toISOString();
};

export async function saveReportSchedule(params: {
  dealId: string | null;
  userId: string | null;
  reportTypeId: string;
  format: ReportFormat;
  frequency: ReportFrequency;
  enabled: boolean;
  lastRunAt?: string | null;
}): Promise<void> {
  // Latest row wins for a given (deal, report_type, format). We don't
  // upsert/delete — we just append a new "schedule set" event, and reads
  // pick the most recent. Audit history is preserved as a side effect.
  const details = {
    report_type_id: params.reportTypeId,
    format: params.format,
    frequency: params.frequency,
    enabled: params.enabled,
    last_run_at: params.lastRunAt ?? null,
    next_run_at: params.enabled ? computeNextRunAt(params.frequency) : null,
  };
  const { error } = await supabase.from("audit_log").insert({
    deal_id: params.dealId,
    user_id: params.userId,
    action: "report_schedule_set",
    details,
  });
  if (error) throw new Error(`Failed to save schedule: ${error.message}`);
}

export async function listReportSchedules(dealId: string | null): Promise<ReportSchedule[]> {
  let query = supabase
    .from("audit_log")
    .select("id, deal_id, user_id, details, created_at")
    .eq("action", "report_schedule_set")
    .order("created_at", { ascending: false })
    .limit(500);
  if (dealId) query = query.eq("deal_id", dealId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load schedules: ${error.message}`);

  // Reduce to the latest row per (report_type_id, format).
  const latest = new Map<string, ReportSchedule>();
  for (const row of (data || []) as any[]) {
    const key = `${row.details?.report_type_id}|${row.details?.format}`;
    if (latest.has(key)) continue;
    latest.set(key, {
      audit_log_id: row.id,
      deal_id: row.deal_id,
      user_id: row.user_id,
      report_type_id: row.details.report_type_id,
      format: row.details.format,
      frequency: row.details.frequency,
      enabled: !!row.details.enabled,
      last_run_at: row.details.last_run_at ?? null,
      next_run_at: row.details.next_run_at ?? new Date().toISOString(),
    });
  }
  return [...latest.values()];
}

export function isScheduleOverdue(s: ReportSchedule): boolean {
  return s.enabled && new Date(s.next_run_at).getTime() <= Date.now();
}
