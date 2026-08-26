import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Upload, CheckCircle2, Clock, FileText, Loader2, Trash2, RefreshCw, Eye,
  ChevronDown, ChevronRight, Sparkles, AlertCircle, XCircle, Edit2, Check, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx';
const DEFAULT_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const SPREADSHEET_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface DocTypeOption {
  value: string;
  label: string;
}

export interface UploadedDoc {
  id: string;
  doc_type: string;
  filename: string;
  file_url: string | null;
  status: string;
  uploaded_at: string;
  extracted_fields: Record<string, any> | null;
  extraction_confidence: number | null;
}

interface DealDocumentUploaderProps {
  dealId: string | null;
  isDemoDeal: boolean;
  docTypes: readonly DocTypeOption[];
  icon: React.ReactNode;
  title: string;
  description: string;
  emptyStateText: string;
  allowSpreadsheets?: boolean;
  extraAcceptedExtensions?: string;
}

/**
 * Whether `contract_documents.uploaded_as` exists in this database yet.
 *
 * The column is added by migration 20260521070000, and a frontend deploy can
 * reach production before that migration is applied — which is exactly what
 * happened: PostgREST rejects an INSERT that names an unknown column outright
 * (PGRST204) and a SELECT that requests one (42703), so naming it unconditionally
 * broke both uploading and listing documents until the migration ran.
 *
 * A schema change and the code that uses it deploy through different pipelines
 * here, so the client cannot assume an order. Probed once per session and
 * cached; after the migration is applied a reload picks it up.
 */
let uploadedAsColumn: boolean | null = null;

async function hasUploadedAsColumn(): Promise<boolean> {
  if (uploadedAsColumn !== null) return uploadedAsColumn;
  const { error } = await supabase.from('contract_documents').select('uploaded_as').limit(1);
  uploadedAsColumn = !error;
  if (error) {
    console.warn(
      'contract_documents.uploaded_as is not present yet — falling back to doc_type and the ' +
      'local upload list. Apply scripts/pending-migrations.sql to enable it.'
    );
  }
  return uploadedAsColumn;
}

export const DealDocumentUploader: React.FC<DealDocumentUploaderProps> = ({
  dealId, isDemoDeal, docTypes, icon, title, description, emptyStateText,
  allowSpreadsheets = false, extraAcceptedExtensions,
}) => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [selectedType, setSelectedType] = useState(docTypes[0]?.value || '');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UploadedDoc | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<UploadedDoc | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const docTypeValues = docTypes.map(t => t.value);

  // Documents uploaded through THIS panel.
  //
  // The list used to filter on doc_type, but `document-ai` overwrites doc_type
  // after parsing. Anything the classifier resolved differently — most
  // contracts land on OTHER — fell straight out of the filter, so a document
  // you had just uploaded and watched parse vanished from the list. A file a
  // user uploaded must never disappear because a model disagreed about its
  // type.
  //
  // `uploaded_as` now records the uploader's own answer and is never
  // overwritten, so the list is the same for every person on the deal. The
  // localStorage set below is kept only for documents uploaded before that
  // column existed; it is per-browser and is not the source of truth.
  const storageKey = dealId ? `pivt:uploads:${dealId}:${docTypeValues.join(',')}` : '';
  const readOwnIds = useCallback((): string[] => {
    if (!storageKey) return [];
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  }, [storageKey]);
  const rememberOwnId = useCallback((id: string) => {
    if (!storageKey || !id) return;
    const ids = Array.from(new Set([...readOwnIds(), id]));
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* quota — non-fatal */ }
  }, [storageKey, readOwnIds]);

  const acceptedMimeTypes = [
    ...DEFAULT_ACCEPTED_MIME_TYPES,
    ...(allowSpreadsheets ? SPREADSHEET_MIME_TYPES : []),
  ];

  const acceptedExtensions = [
    DEFAULT_ACCEPTED_EXTENSIONS,
    ...(allowSpreadsheets ? ['.xlsx,.xls,.csv'] : []),
    ...(extraAcceptedExtensions ? [extraAcceptedExtensions] : []),
  ].join(',');

  const fetchDocs = useCallback(async () => {
    if (!dealId || isDemoDeal) { setLoading(false); return; }
    setLoading(true);
    const withUploadedAs = await hasUploadedAsColumn();
    // Fetch by deal and filter client-side: the type is a label, not a gate.
    const { data } = await supabase
      .from('contract_documents')
      .select(
        `id, doc_type,${withUploadedAs ? ' uploaded_as,' : ''} filename, file_url, status, ` +
        'uploaded_at, extracted_fields, extraction_confidence'
      )
      .eq('deal_id', dealId)
      .order('uploaded_at', { ascending: false });

    const ownIds = new Set(readOwnIds());
    const visible = (data || []).filter(
      (d: any) =>
        docTypeValues.includes(d.uploaded_as) ||
        docTypeValues.includes(d.doc_type) ||
        ownIds.has(d.id)
    );
    setDocs(visible.map((d: any) => ({
      id: d.id, doc_type: d.doc_type, filename: d.filename,
      file_url: d.file_url, status: d.status, uploaded_at: d.uploaded_at,
      extracted_fields: d.extracted_fields, extraction_confidence: d.extraction_confidence,
    })));
    setLoading(false);
  }, [dealId, isDemoDeal, docTypeValues.join(','), readOwnIds]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const triggerAIParsing = useCallback(async (docId: string, filename: string, docType: string) => {
    if (!dealId) return;
    setParsingDocId(docId);
    try {
      // Update status to PROCESSING
      await supabase.from('contract_documents').update({ status: 'PROCESSING' as any } as any).eq('id', docId);
      
      // Get signed URL to read file content (for text-based files)
      const doc = docs.find(d => d.id === docId);
      const fileUrl = doc?.file_url;
      
      const { data, error } = await supabase.functions.invoke('document-ai', {
        body: {
          action: 'classify',
          documentId: docId,
          fileName: filename,
          dealId: dealId,
          // No text sent: document-ai downloads the stored file and extracts
          // the real text. Passing a placeholder here is what made every
          // downstream check reason about a filename.
          typeHint: docType,
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Parsing failed');

      toast.success('Document parsed successfully.', {
        description: `Confidence: ${Math.round((data?.result?.confidence || 0) * 100)}%`,
      });
      await fetchDocs();
    } catch (err: any) {
      console.error('AI parsing failed:', err);
      await supabase.from('contract_documents').update({ status: 'PARSE_FAILED' as any } as any).eq('id', docId);
      toast.error(`Parsing failed: ${err?.message || 'Unknown error'}`);
      await fetchDocs();
    } finally {
      setParsingDocId(null);
    }
  }, [dealId, docs, fetchDocs]);

  const uploadFile = useCallback(async (file: File, docType: string, replacingDocId?: string) => {
    if (!dealId || !user) {
      toast.error('You must be signed in to upload documents.');
      return;
    }
    if (!acceptedMimeTypes.includes(file.type)) {
      toast.error('This file type is not supported.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File exceeds maximum size limit (${MAX_FILE_SIZE_MB}MB).`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const storagePath = `${dealId}/${docType}_${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from('deal-documents')
        .upload(storagePath, file, { upsert: false });
      if (storageError) throw storageError;

      const fileUrl = storagePath;
      let newDocId = replacingDocId;

      if (replacingDocId) {
        const { error: updateError } = await supabase
          .from('contract_documents')
          .update({
            filename: file.name, file_url: fileUrl,
            status: 'UPLOADED' as any, uploaded_at: new Date().toISOString(),
            extracted_fields: {} as any, extraction_confidence: 0,
          } as any)
          .eq('id', replacingDocId);
        if (updateError) throw updateError;
        toast.success('Document replaced. Starting AI parsing…');
      } else {
        // What the person said it is. `doc_type` is what the classifier will
        // say it is, a few seconds from now — see the note on the column probe.
        const row: Record<string, unknown> = {
          deal_id: dealId, doc_type: docType,
          filename: file.name, file_url: fileUrl,
          status: 'UPLOADED', uploaded_by: user.id,
        };
        if (await hasUploadedAsColumn()) row.uploaded_as = docType;

        const { data: insertData, error: insertError } = await supabase
          .from('contract_documents')
          .insert(row as any)
          .select('id')
          .single();
        if (insertError) throw insertError;
        newDocId = insertData?.id;
        if (newDocId) rememberOwnId(newDocId);
        toast.success('Document uploaded. Starting AI parsing…');
      }
      await fetchDocs();

      // Auto-trigger AI parsing
      if (newDocId) {
        triggerAIParsing(newDocId, file.name, docType);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      const msg = err?.message || err?.error || 'Unknown error';
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  }, [dealId, user, fetchDocs, acceptedMimeTypes, triggerAIParsing]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, selectedType);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [selectedType, uploadFile]);

  const handleReplaceFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replaceTarget) uploadFile(file, replaceTarget.doc_type, replaceTarget.id);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
    setReplaceTarget(null);
  }, [replaceTarget, uploadFile]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      // Delete from storage if file_url exists
      if (deleteTarget.file_url && !deleteTarget.file_url.startsWith('http')) {
        await supabase.storage.from('deal-documents').remove([deleteTarget.file_url]);
      }
      const { error } = await supabase.from('contract_documents').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Document deleted successfully.');
      await fetchDocs();
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete document. Please try again.');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchDocs]);

  const handleView = useCallback(async (doc: UploadedDoc) => {
    if (!doc.file_url) { toast.error('No file URL available for this document.'); return; }
    if (!doc.file_url.startsWith('http')) {
      const { data, error } = await supabase.storage.from('deal-documents').createSignedUrl(doc.file_url, 3600);
      if (error || !data?.signedUrl) { toast.error('Could not generate download link.'); return; }
      window.open(data.signedUrl, '_blank');
    } else {
      window.open(doc.file_url, '_blank');
    }
  }, []);

  const getLabel = (type: string) => docTypes.find(t => t.value === type)?.label || type;

  const getStatusDisplay = (doc: UploadedDoc) => {
    const s = doc.status;
    if (s === 'PROCESSING' || parsingDocId === doc.id) {
      return { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Processing', className: 'bg-amber-500/10 text-amber-600' };
    }
    if (s === 'PARSED' || s === 'EXTRACTION_COMPLETE' || s === 'VERIFIED') {
      const conf = doc.extraction_confidence ? Math.round(doc.extraction_confidence * 100) : null;
      const fieldCount = doc.extracted_fields ? Object.keys(doc.extracted_fields).length : 0;
      return {
        icon: <CheckCircle2 className="w-3 h-3" />,
        label: `Parsed${conf ? ` · ${conf}%` : ''}${fieldCount > 0 ? ` · ${fieldCount} fields` : ''}`,
        className: 'bg-emerald-500/10 text-emerald-600',
      };
    }
    if (s === 'PARSE_FAILED') {
      return { icon: <XCircle className="w-3 h-3" />, label: 'Failed', className: 'bg-destructive/10 text-destructive' };
    }
    return { icon: <Clock className="w-3 h-3" />, label: s.replace(/_/g, ' '), className: 'bg-muted/60 text-muted-foreground' };
  };

  const renderExtractedFields = (doc: UploadedDoc) => {
    if (!doc.extracted_fields || Object.keys(doc.extracted_fields).length === 0) {
      return (
        <div className="px-4 py-3 text-xs text-muted-foreground italic">
          No fields extracted. Try re-parsing this document.
        </div>
      );
    }

    return (
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-medium">Extracted Fields</span>
          {doc.extraction_confidence && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {Math.round(doc.extraction_confidence * 100)}% confidence
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(doc.extracted_fields).map(([key, value]) => (
            <div key={key} className="bg-muted/30 rounded-lg px-3 py-2 border border-border/20">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                {key.replace(/_/g, ' ')}
              </div>
              <div className="text-xs font-medium truncate">
                {typeof value === 'object' ? (
                  Array.isArray(value) ? `${value.length} items` : JSON.stringify(value).slice(0, 80)
                ) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
      <input ref={fileInputRef} type="file" accept={acceptedExtensions} className="hidden" onChange={handleFileSelected} />
      <input ref={replaceInputRef} type="file" accept={acceptedExtensions} className="hidden" onChange={handleReplaceFileSelected} />

      <div className="p-5 border-b border-border/30">
        <div className="flex items-center gap-3 mb-1">{icon}<h3 className="font-semibold">{title}</h3></div>
        <p className="text-xs text-muted-foreground ml-8">{description}</p>
      </div>
      <div className="p-5">
        <div className="flex items-end gap-4 mb-5">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
              className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40">
              {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : docs.length > 0 ? (
          <div className="border border-border/30 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  <th className="w-8"></th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Filename</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Parse Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => {
                  const statusDisplay = getStatusDisplay(doc);
                  const isExpanded = expandedDoc === doc.id;
                  const isParsing = parsingDocId === doc.id;
                  const hasParsedFields = doc.extracted_fields && Object.keys(doc.extracted_fields).length > 0;

                  return (
                    <React.Fragment key={doc.id}>
                      <tr className={`border-b border-border/20 hover:bg-muted/20 transition-colors ${isExpanded ? 'bg-muted/10' : ''}`}>
                        <td className="pl-3 py-2.5">
                          <button
                            onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                            className="p-0.5 rounded hover:bg-muted/40 transition-colors"
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[200px]">{doc.filename}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{getLabel(doc.doc_type)}</Badge></td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${statusDisplay.className}`}>
                            {statusDisplay.icon}
                            {statusDisplay.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            {doc.file_url && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleView(doc)} title="View">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => triggerAIParsing(doc.id, doc.filename, doc.doc_type)}
                              disabled={isParsing}
                              title={hasParsedFields ? 'Re-Parse' : 'Parse'}
                            >
                              {isParsing
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Sparkles className="w-3.5 h-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setReplaceTarget(doc); setTimeout(() => replaceInputRef.current?.click(), 50); }} title="Replace">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(doc)} title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden bg-muted/10 border-b border-border/20"
                              >
                                {renderExtractedFields(doc)}
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">{emptyStateText}</p>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload Document
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.filename}"? This will remove the document and any associated parsed data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};
