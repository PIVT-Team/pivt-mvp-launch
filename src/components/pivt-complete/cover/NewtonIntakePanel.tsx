/**
 * Newton Intake Panel — Upload → Preview → Propose → Confirm → Execute
 * Structured document intake system for Newton intelligence layer.
 */
import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { cn } from '@/lib/utils';
import {
  Upload, FileSpreadsheet, FileText, Users, Landmark, DollarSign,
  CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp,
  Play, X, Eye, Shield, ArrowRight, RotateCw, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────

interface NewtonUpload {
  id: string;
  deal_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  detected_type: string | null;
  user_override_type: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface NewtonExtraction {
  id: string;
  upload_id: string;
  extraction_type: string;
  extracted_data: any[];
  field_summary: {
    total_rows: number;
    missing_fields: string[];
    confidence: number;
    columns_detected: string[];
  };
  confidence_score: number;
}

interface ProposedAction {
  id: string;
  action_type: string;
  action_label: string;
  description: string | null;
  impact_level: string;
  preview_data: Record<string, any>;
  status: string;
  execution_result: Record<string, any> | null;
  error_message: string | null;
}

type IntakeStep = 'upload' | 'classifying' | 'preview' | 'proposing' | 'actions' | 'executing' | 'complete';

const FILE_TYPES = [
  { value: 'stakeholder_spreadsheet', label: 'Stakeholder Spreadsheet', icon: Users, color: 'text-accent' },
  { value: 'funds_flow', label: 'Funds Flow / Waterfall', icon: DollarSign, color: 'text-emerald-500' },
  { value: 'wire_instructions', label: 'Wire Instructions', icon: Landmark, color: 'text-blue-500' },
  { value: 'general', label: 'General Document', icon: FileText, color: 'text-muted-foreground' },
] as const;

const IMPACT_CONFIG = {
  low: { label: 'Low', className: 'bg-muted text-muted-foreground', desc: 'Read-only analysis' },
  medium: { label: 'Medium', className: 'bg-amber-500/10 text-amber-600', desc: 'Creates or updates records' },
  high: { label: 'High', className: 'bg-blocking/10 text-blocking', desc: 'Sends communications' },
};

const ACCEPTED = '.csv,.xlsx,.xls,.pdf,.doc,.docx,.tsv,.txt';

// ─── Component ───────────────────────────────────────────────

export const NewtonIntakePanel: React.FC<{ dealId: string | null; onComplete?: () => void }> = ({ dealId, onComplete }) => {
  const [step, setStep] = useState<IntakeStep>('upload');
  const [upload, setUpload] = useState<NewtonUpload | null>(null);
  const [extraction, setExtraction] = useState<NewtonExtraction | null>(null);
  const [proposals, setProposals] = useState<ProposedAction[]>([]);
  const [uploading, setUploading] = useState(false);
  const [overrideType, setOverrideType] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setUpload(null);
    setExtraction(null);
    setProposals([]);
    setOverrideType(null);
    setExecutingIds(new Set());
  }, []);

  // ── Step 1: Upload File ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dealId) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds 20MB limit');
      return;
    }

    setUploading(true);
    setStep('classifying');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to storage
      const path = `${dealId}/newton/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage.from('deal-documents').upload(path, file);
      if (storageErr) throw storageErr;

      // Create upload record
      const { data: uploadRecord, error: insertErr } = await supabase
        .from('newton_uploads')
        .insert({
          deal_id: dealId,
          uploaded_by: user.id,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          status: 'uploaded',
        } as any)
        .select('*')
        .single();

      if (insertErr) throw insertErr;
      setUpload(uploadRecord as any);

      // Classify
      const { data: classifyRes, error: classifyErr } = await supabase.functions.invoke('newton-intake', {
        body: { action: 'classify', upload_id: uploadRecord.id, file_name: file.name },
      });

      if (classifyErr || !classifyRes?.success) {
        throw new Error(classifyRes?.error || classifyErr?.message || 'Classification failed');
      }

      setUpload(prev => prev ? { ...prev, detected_type: classifyRes.detected_type, status: 'classified' } : null);
      setStep('preview');
      toast.success(`Detected: ${classifyRes.label}`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
      setStep('upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [dealId]);

  // ── Step 2: Extract Data ──
  const handleExtract = useCallback(async () => {
    if (!upload || !dealId) return;
    setStep('classifying');

    // Apply override if user changed type
    if (overrideType && overrideType !== upload.detected_type) {
      await supabase.from('newton_uploads')
        .update({ user_override_type: overrideType } as any)
        .eq('id', upload.id);
    }

    try {
      const { data, error } = await supabase.functions.invoke('newton-intake', {
        body: { action: 'extract', upload_id: upload.id, deal_id: dealId },
      });

      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Extraction failed');

      // Fetch the extraction
      const { data: ext } = await supabase
        .from('newton_extractions')
        .select('*')
        .eq('id', data.extraction_id)
        .single();

      setExtraction(ext as any);
      setStep('proposing');

      // Generate proposals
      const { data: propRes, error: propErr } = await supabase.functions.invoke('newton-intake', {
        body: { action: 'propose', extraction_id: data.extraction_id, deal_id: dealId },
      });

      if (propErr || !propRes?.success) throw new Error(propRes?.error || 'Proposal generation failed');

      // Fetch proposals
      const { data: actions } = await supabase
        .from('newton_proposed_actions')
        .select('*')
        .eq('upload_id', upload.id)
        .eq('status', 'proposed')
        .order('created_at');

      setProposals((actions || []) as any);
      setStep('actions');
    } catch (err: any) {
      toast.error(err.message || 'Extraction failed');
      setStep('preview');
    }
  }, [upload, dealId, overrideType]);

  // ── Step 4: Approve & Execute Actions ──
  const handleApproveAndExecute = useCallback(async (actionId: string) => {
    setExecutingIds(prev => new Set(prev).add(actionId));

    try {
      // Approve
      await supabase
        .from('newton_proposed_actions')
        .update({ status: 'approved', approved_at: new Date().toISOString() } as any)
        .eq('id', actionId);

      // Execute
      const { data, error } = await supabase.functions.invoke('newton-execute', {
        body: { action_id: actionId },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Execution failed');
      }

      setProposals(prev => prev.map(p =>
        p.id === actionId ? { ...p, status: 'completed', execution_result: data.result } : p
      ));
      toast.success(`Action completed: ${data.result?.summary || 'Done'}`);
    } catch (err: any) {
      setProposals(prev => prev.map(p =>
        p.id === actionId ? { ...p, status: 'failed', error_message: err.message } : p
      ));
      toast.error(err.message || 'Execution failed');
    } finally {
      setExecutingIds(prev => { const n = new Set(prev); n.delete(actionId); return n; });
    }
  }, []);

  const handleReject = useCallback(async (actionId: string) => {
    await supabase
      .from('newton_proposed_actions')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() } as any)
      .eq('id', actionId);
    setProposals(prev => prev.map(p => p.id === actionId ? { ...p, status: 'rejected' } : p));
  }, []);

  const handleApproveAll = useCallback(async () => {
    const pending = proposals.filter(p => p.status === 'proposed');
    for (const p of pending) {
      await handleApproveAndExecute(p.id);
    }
  }, [proposals, handleApproveAndExecute]);

  const allDone = proposals.length > 0 && proposals.every(p => ['completed', 'rejected', 'failed'].includes(p.status));
  const activeType = overrideType || upload?.detected_type || 'general';
  const typeConfig = FILE_TYPES.find(t => t.value === activeType) || FILE_TYPES[3];

  if (!dealId) {
    return (
      <div className="pivt-card p-6 text-center">
        <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Select a deal to upload documents to Newton.</p>
      </div>
    );
  }

  return (
    <motion.div {...fadeInUp} className="pivt-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/8 flex items-center justify-center">
            <Upload className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold">Newton Intake</p>
            <p className="text-[10px] text-muted-foreground">Upload documents for AI-powered extraction and action</p>
          </div>
        </div>
        {step !== 'upload' && (
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs gap-1.5">
            <RotateCw className="w-3 h-3" /> New Upload
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* ── Step: Upload ── */}
        {step === 'upload' && (
          <div>
            <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleFileUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full py-8 rounded-xl border-2 border-dashed border-border hover:border-accent/40 hover:bg-accent/3 transition-all flex flex-col items-center gap-3 group"
            >
              <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-accent/8 flex items-center justify-center transition-colors">
                <FileSpreadsheet className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Drop a file or click to upload</p>
                <p className="text-[11px] text-muted-foreground mt-1">CSV, XLSX, PDF, DOC · Max 20MB</p>
              </div>
            </button>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {FILE_TYPES.map(ft => (
                <div key={ft.value} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                  <ft.icon className={cn('w-3.5 h-3.5', ft.color)} />
                  <span className="text-[11px] text-muted-foreground">{ft.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step: Classifying / Extracting ── */}
        {(step === 'classifying' || step === 'proposing') && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm font-medium">
              {step === 'classifying' ? 'Analyzing document…' : 'Generating actions…'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {step === 'classifying' ? 'Detecting file type and extracting data' : 'Proposing relevant actions for this data'}
            </p>
          </div>
        )}

        {/* ── Step: Preview / Type Override ── */}
        {step === 'preview' && upload && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <FileSpreadsheet className="w-5 h-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{upload.file_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(upload.file_size / 1024).toFixed(0)} KB · Uploaded {new Date(upload.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Detected Type</p>
              <div className="grid grid-cols-2 gap-2">
                {FILE_TYPES.map(ft => (
                  <button
                    key={ft.value}
                    onClick={() => setOverrideType(ft.value)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left',
                      activeType === ft.value
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-accent/30'
                    )}
                  >
                    <ft.icon className={cn('w-4 h-4', activeType === ft.value ? ft.color : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-medium', activeType === ft.value ? 'text-foreground' : 'text-muted-foreground')}>
                      {ft.label}
                    </span>
                    {activeType === ft.value && upload.detected_type === ft.value && (
                      <Badge variant="outline" className="text-[9px] ml-auto">Auto</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleExtract} className="w-full gap-2">
              <Play className="w-3.5 h-3.5" />
              Extract & Analyze
            </Button>
          </div>
        )}

        {/* ── Step: Actions ── */}
        {(step === 'actions' || step === 'complete') && extraction && (
          <div className="space-y-4">
            {/* Extraction Summary */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <typeConfig.icon className={cn('w-4 h-4', typeConfig.color)} />
                  <span className="text-xs font-medium">{typeConfig.label}</span>
                </div>
                <Badge variant="outline" className="text-[9px]">
                  {extraction.field_summary?.total_rows || 0} rows · {Math.round((extraction.confidence_score || 0) * 100)}% confidence
                </Badge>
              </div>

              {/* Data Preview */}
              <button onClick={() => setPreviewExpanded(!previewExpanded)} className="flex items-center gap-1 text-[10px] text-accent hover:underline">
                <Eye className="w-3 h-3" />
                {previewExpanded ? 'Hide' : 'Show'} extracted data
                {previewExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <AnimatePresence>
                {previewExpanded && extraction.extracted_data && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <ScrollArea className="max-h-48 mt-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="border-b border-border/30">
                              {extraction.field_summary?.columns_detected?.slice(0, 6).map(col => (
                                <th key={col} className="text-left px-2 py-1.5 text-muted-foreground font-medium whitespace-nowrap">
                                  {col}
                                </th>
                              )) || Object.keys(extraction.extracted_data[0] || {}).slice(0, 6).map(k => (
                                <th key={k} className="text-left px-2 py-1.5 text-muted-foreground font-medium whitespace-nowrap">
                                  {k}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {extraction.extracted_data.slice(0, 10).map((row: any, i: number) => (
                              <tr key={i} className="border-b border-border/10">
                                {(extraction.field_summary?.columns_detected?.slice(0, 6) || Object.keys(row).slice(0, 6)).map(key => (
                                  <td key={key} className="px-2 py-1.5 whitespace-nowrap text-foreground/80">
                                    {String(row[key] ?? '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {extraction.extracted_data.length > 10 && (
                          <p className="text-[10px] text-muted-foreground text-center py-2">
                            + {extraction.extracted_data.length - 10} more rows
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Separator />

            {/* Proposed Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold">Proposed Actions</p>
                {proposals.some(p => p.status === 'proposed') && (
                  <Button size="sm" variant="outline" onClick={handleApproveAll} className="text-[10px] h-7 gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Approve All
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {proposals.map(action => {
                  const impact = IMPACT_CONFIG[action.impact_level as keyof typeof IMPACT_CONFIG] || IMPACT_CONFIG.low;
                  const isExecuting = executingIds.has(action.id);
                  const isDone = action.status === 'completed';
                  const isFailed = action.status === 'failed';
                  const isRejected = action.status === 'rejected';

                  return (
                    <motion.div
                      key={action.id}
                      {...fadeInUp}
                      className={cn(
                        'p-3 rounded-lg border transition-colors',
                        isDone ? 'border-validated/30 bg-validated/3' :
                        isFailed ? 'border-blocking/30 bg-blocking/3' :
                        isRejected ? 'border-border bg-muted/20 opacity-60' :
                        'border-border hover:border-accent/20'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-medium">{action.action_label}</p>
                            <Badge variant="outline" className={cn('text-[9px] px-1.5', impact.className)}>
                              {impact.label}
                            </Badge>
                          </div>
                          {action.description && (
                            <p className="text-[11px] text-muted-foreground">{action.description}</p>
                          )}

                          {/* Preview details */}
                          {action.preview_data && Object.keys(action.preview_data).length > 0 && action.status === 'proposed' && (
                            <div className="mt-2 px-2 py-1.5 rounded bg-muted/30 text-[10px] text-muted-foreground">
                              {action.preview_data.names && (
                                <span>Names: {action.preview_data.names.slice(0, 3).join(', ')}{action.preview_data.names.length > 3 ? ` +${action.preview_data.names.length - 3}` : ''}</span>
                              )}
                              {action.preview_data.row_count && <span>Rows: {action.preview_data.row_count}</span>}
                              {action.preview_data.total_amount && <span> · Total: ${(action.preview_data.total_amount / 1e6).toFixed(1)}M</span>}
                            </div>
                          )}

                          {/* Execution result */}
                          {isDone && action.execution_result && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-validated">
                              <CheckCircle2 className="w-3 h-3" />
                              {action.execution_result.summary || 'Completed'}
                            </div>
                          )}
                          {isFailed && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-blocking">
                              <XCircle className="w-3 h-3" />
                              {action.error_message || 'Failed'}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        {action.status === 'proposed' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReject(action.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-blocking"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveAndExecute(action.id)}
                              disabled={isExecuting}
                              className="h-7 gap-1 text-[10px] px-2"
                            >
                              {isExecuting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ArrowRight className="w-3 h-3" />
                              )}
                              {isExecuting ? 'Running' : 'Execute'}
                            </Button>
                          </div>
                        )}

                        {isDone && <CheckCircle2 className="w-4 h-4 text-validated shrink-0" />}
                        {isRejected && <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {proposals.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground">No actions proposed for this data.</p>
                </div>
              )}
            </div>

            {/* Complete */}
            {allDone && (
              <motion.div {...fadeInUp} className="p-4 rounded-lg bg-validated/5 border border-validated/20 text-center">
                <CheckCircle2 className="w-6 h-6 text-validated mx-auto mb-2" />
                <p className="text-sm font-medium">All actions processed</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {proposals.filter(p => p.status === 'completed').length} completed ·{' '}
                  {proposals.filter(p => p.status === 'rejected').length} skipped ·{' '}
                  {proposals.filter(p => p.status === 'failed').length} failed
                </p>
                <div className="flex gap-2 justify-center mt-3">
                  <Button size="sm" variant="outline" onClick={reset} className="text-xs gap-1.5">
                    <Upload className="w-3 h-3" /> Upload Another
                  </Button>
                  {onComplete && (
                    <Button size="sm" onClick={onComplete} className="text-xs gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
