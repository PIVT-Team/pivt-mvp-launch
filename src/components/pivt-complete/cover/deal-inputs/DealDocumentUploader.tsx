import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Upload, CheckCircle2, Clock, FileText, Loader2, Trash2, RefreshCw, Eye,
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
}

interface DealDocumentUploaderProps {
  dealId: string | null;
  isDemoDeal: boolean;
  docTypes: readonly DocTypeOption[];
  /** Icon to show in header and table rows */
  icon: React.ReactNode;
  title: string;
  description: string;
  emptyStateText: string;
  /** Include spreadsheet formats (.xlsx, .xls, .csv) */
  allowSpreadsheets?: boolean;
  /** Extra accepted extensions string, appended to default */
  extraAcceptedExtensions?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const docTypeValues = docTypes.map(t => t.value);

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
    const { data } = await supabase
      .from('contract_documents')
      .select('id, doc_type, filename, file_url, status, uploaded_at')
      .eq('deal_id', dealId)
      .in('doc_type', docTypeValues as any);
    setDocs((data || []).map((d: any) => ({
      id: d.id, doc_type: d.doc_type, filename: d.filename,
      file_url: d.file_url, status: d.status, uploaded_at: d.uploaded_at,
    })));
    setLoading(false);
  }, [dealId, isDemoDeal, docTypeValues.join(',')]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

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

      // Store the storage path (bucket is private, use signed URLs for viewing)
      const fileUrl = storagePath;

      if (replacingDocId) {
        const { error: updateError } = await supabase
          .from('contract_documents')
          .update({
            filename: file.name, file_url: fileUrl,
            status: 'UPLOADED' as any, uploaded_at: new Date().toISOString(),
          } as any)
          .eq('id', replacingDocId);
        if (updateError) throw updateError;
        toast.success('Document updated successfully.');
      } else {
        const { error: insertError } = await supabase
          .from('contract_documents')
          .insert({
            deal_id: dealId, doc_type: docType as any,
            filename: file.name, file_url: fileUrl,
            status: 'UPLOADED' as any, uploaded_by: user.id,
          } as any);
        if (insertError) throw insertError;
        toast.success('Document uploaded successfully.');
      }
      await fetchDocs();
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [dealId, user, fetchDocs, acceptedMimeTypes]);

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
    // If it's a storage path (not a full URL), create a signed URL
    if (!doc.file_url.startsWith('http')) {
      const { data, error } = await supabase.storage.from('deal-documents').createSignedUrl(doc.file_url, 3600);
      if (error || !data?.signedUrl) { toast.error('Could not generate download link.'); return; }
      window.open(data.signedUrl, '_blank');
    } else {
      window.open(doc.file_url, '_blank');
    }
  }, []);

  const getLabel = (type: string) => docTypes.find(t => t.value === type)?.label || type;

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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Filename</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />{doc.filename}
                  </td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{getLabel(doc.doc_type)}</Badge></td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                      doc.status === 'VERIFIED' || doc.status === 'EXTRACTION_COMPLETE' || doc.status === 'PARSED'
                        ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'
                    }`}>
                      {doc.status === 'VERIFIED' || doc.status === 'EXTRACTION_COMPLETE' || doc.status === 'PARSED'
                        ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {doc.status.replace(/_/g, ' ')}
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
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setReplaceTarget(doc); setTimeout(() => replaceInputRef.current?.click(), 50); }} title="Replace">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(doc)} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              Are you sure you want to delete this document? This action cannot be undone.
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
