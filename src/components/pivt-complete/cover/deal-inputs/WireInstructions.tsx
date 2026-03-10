import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Upload, CheckCircle2, Clock, Plus, Landmark, Building2,
  FileSpreadsheet, Table2, X, Loader2, Trash2, RefreshCw, Eye,
  AlertCircle, FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

/* ── Constants ── */
const WIRE_DOC_TYPES = [
  { value: 'FUNDS_FLOW_MEMO', label: 'Funds Flow Memo' },
  { value: 'WIRE_SCHEDULE', label: 'Wire Schedule' },
  { value: 'BANK_INSTRUCTION_LETTER', label: 'Bank Instruction Letter' },
  { value: 'ESCROW_INSTRUCTIONS', label: 'Escrow Instructions' },
  { value: 'DEBT_PAYOFF_LETTER', label: 'Debt Payoff Letter' },
] as const;

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.xlsx';
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const PAYMENT_TYPES = [
  'Purchase Price', 'Escrow', 'Fees', 'Debt Payoff', 'Bonus', 'Equity Payout', 'Advisory Fee',
] as const;

const FUNDING_SOURCE_TYPES = [
  'Buyer Equity', 'Debt Financing', 'Bridge Financing',
] as const;

/* ── Types ── */
interface WireDoc {
  id: string;
  doc_type: string;
  filename: string;
  file_url: string | null;
  status: string;
  uploaded_at: string;
}

interface WireInstruction {
  id: string;
  stakeholder: string;
  payment_type: string;
  amount: string;
  currency: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing_aba: string;
  swift_iban: string;
  status: string;
}

const statusColor = (s: string) =>
  s === 'Verified' || s === 'verified' ? 'bg-emerald-500/10 text-emerald-600' :
  s === 'Rejected' ? 'bg-destructive/10 text-destructive' :
  'bg-muted/60 text-muted-foreground';

const statusIcon = (s: string) =>
  s === 'Verified' || s === 'verified' ? <CheckCircle2 className="w-3 h-3" /> :
  <Clock className="w-3 h-3" />;

/* ── Component ── */
export const WireInstructions: React.FC = () => {
  const { dealId, isDemoDeal, realDeal } = useDealWorkspace();
  const { user } = useAuth();

  const [docs, setDocs] = useState<WireDoc[]>([]);
  const [selectedDocType, setSelectedDocType] = useState('FUNDS_FLOW_MEMO');
  const [wires, setWires] = useState<WireInstruction[]>([]);
  const [showAddWire, setShowAddWire] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WireDoc | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<WireDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [newWire, setNewWire] = useState<Omit<WireInstruction, 'id' | 'status'>>({
    stakeholder: '', payment_type: 'Purchase Price', amount: '', currency: 'USD',
    bank_name: '', account_name: '', account_number: '', routing_aba: '', swift_iban: '',
  });

  const fetchDocs = useCallback(async () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    const { data: wireDocs } = await supabase
      .from('contract_documents')
      .select('id, doc_type, filename, file_url, status, uploaded_at')
      .eq('deal_id', dealId)
      .in('doc_type', ['FUNDS_FLOW_MEMO', 'WIRE_SCHEDULE', 'BANK_INSTRUCTION_LETTER', 'ESCROW_INSTRUCTIONS', 'DEBT_PAYOFF_LETTER'] as any);
    setDocs((wireDocs || []).map((d: any) => ({
      id: d.id, doc_type: d.doc_type, filename: d.filename, file_url: d.file_url,
      status: d.status, uploaded_at: d.uploaded_at,
    })));
    setWires([]);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  /* ── Real file upload ── */
  const uploadFile = useCallback(async (file: File, docType: string, replacingDocId?: string) => {
    if (!dealId || !user) {
      toast.error('You must be signed in to upload documents.');
      return;
    }

    // Validate type
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast.error('This file type is not supported. Please upload a PDF, DOC, DOCX, or XLSX file.');
      return;
    }
    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File exceeds maximum size limit (${MAX_FILE_SIZE_MB}MB).`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const storagePath = `${dealId}/${docType}_${Date.now()}.${ext}`;

      // Upload to storage
      const { error: storageError } = await supabase.storage
        .from('deal-documents')
        .upload(storagePath, file, { upsert: false });
      if (storageError) throw storageError;

      // Store the storage path (bucket is private, use signed URLs for viewing)
      const fileUrl = storagePath;

      if (replacingDocId) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('contract_documents')
          .update({
            filename: file.name,
            file_url: fileUrl,
            status: 'UPLOADED' as any,
            uploaded_at: new Date().toISOString(),
          } as any)
          .eq('id', replacingDocId);
        if (updateError) throw updateError;
        toast.success('Funds flow memo updated successfully');
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('contract_documents')
          .insert({
            deal_id: dealId,
            doc_type: docType as any,
            filename: file.name,
            file_url: fileUrl,
            status: 'UPLOADED' as any,
            uploaded_by: user.id,
          } as any);
        if (insertError) throw insertError;
        toast.success(`Uploaded: ${file.name}`);
      }

      await fetchDocs();
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [dealId, user, fetchDocs]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, selectedDocType);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [selectedDocType, uploadFile]);

  const handleReplaceFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replaceTarget) uploadFile(file, replaceTarget.doc_type, replaceTarget.id);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
    setReplaceTarget(null);
  }, [replaceTarget, uploadFile]);

  /* ── Delete ── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('contract_documents')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Funds flow memo deleted successfully');
      await fetchDocs();
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete document. Please try again.');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchDocs]);

  /* ── View ── */
  const handleView = useCallback((doc: WireDoc) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    } else {
      toast.error('No file URL available for this document.');
    }
  }, []);

  const getDocLabel = (type: string) => WIRE_DOC_TYPES.find(t => t.value === type)?.label || type;

  const handleAddWire = useCallback(() => {
    if (!newWire.stakeholder || !newWire.amount) {
      toast.error('Stakeholder and Amount are required');
      return;
    }
    setWires(prev => [...prev, { ...newWire, id: `w-${Date.now()}`, status: 'Pending' }]);
    setNewWire({ stakeholder: '', payment_type: 'Purchase Price', amount: '', currency: 'USD', bank_name: '', account_name: '', account_number: '', routing_aba: '', swift_iban: '' });
    setShowAddWire(false);
    toast.success('Wire instruction added');
  }, [newWire]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleFileSelected} />
      <input ref={replaceInputRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleReplaceFileSelected} />

      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Wire Instructions</h2>
        <p className="text-sm text-muted-foreground mt-1">Payment destination information derived from funds flow memoranda or wire schedules.</p>
      </motion.div>

      {/* ── Wire Instruction Documents ── */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3 mb-1">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold">Wire Instruction Documents</h3>
          </div>
          <p className="text-xs text-muted-foreground ml-8">Upload funds flow memoranda or wire schedule spreadsheets that contain the payment instructions for this transaction.</p>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-4 mb-5">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
              <select value={selectedDocType} onChange={e => setSelectedDocType(e.target.value)}
                className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40">
                {WIRE_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>

          {docs.length > 0 ? (
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
                      <FileText className="w-4 h-4 text-emerald-500 shrink-0" />{doc.filename}
                    </td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{getDocLabel(doc.doc_type)}</Badge></td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${doc.status === 'PARSED' || doc.status === 'EXTRACTION_COMPLETE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'}`}>
                        {doc.status === 'PARSED' || doc.status === 'EXTRACTION_COMPLETE' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{doc.status}
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
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setReplaceTarget(doc); replaceInputRef.current?.click(); }} title="Replace">
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
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No wire instruction documents uploaded yet.</p>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload Funds Flow Memo
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Wire Instructions Table ── */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Landmark className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold">Wire Instructions</h3>
            </div>
            <p className="text-xs text-muted-foreground ml-8">
              Structured payment instructions for all deal parties and escrow accounts.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAddWire(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Wire Instruction
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                {['Stakeholder', 'Payment Type', 'Amount', 'Currency', 'Bank', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wires.map(w => (
                <tr key={w.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{w.stakeholder}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{w.payment_type}</Badge></td>
                  <td className="px-4 py-2.5">{w.amount}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{w.currency}</td>
                  <td className="px-4 py-2.5">{w.bank_name || <span className="text-muted-foreground italic text-xs">Not provided</span>}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${statusColor(w.status)}`}>
                      {statusIcon(w.status)}{w.status}
                    </span>
                  </td>
                </tr>
              ))}
              {wires.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No wire instructions added yet. Upload a wire instruction document or add instructions manually.</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Buyer Funding Source ── */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3"><Building2 className="w-5 h-5 text-accent" /><h3 className="font-semibold">Buyer Funding Source</h3></div>
          <p className="text-xs text-muted-foreground ml-8 mt-1">Where funds originate, not where they are sent.</p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label className="text-xs text-muted-foreground">Funding Source Type</Label>
            <select className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm mt-1.5 focus:outline-none focus:border-accent/40">
              {FUNDING_SOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Bank Name</Label><Input placeholder={realDeal?.buyer || 'JPMorgan Chase'} className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Account Name</Label><Input placeholder={realDeal?.buyer || 'Apex Capital Partners LLC'} className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Account Number</Label><Input placeholder="••••••7742" className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Routing / ABA</Label><Input placeholder="021000021" className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">SWIFT / IBAN</Label><Input placeholder="CHASUS33" className="mt-1.5" /></div>
        </div>
      </motion.div>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this funds flow memo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add Wire Instruction Dialog ── */}
      <Dialog open={showAddWire} onOpenChange={setShowAddWire}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Wire Instruction</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Recipient Stakeholder</Label>
              <Input placeholder="e.g. Seller Parent LLC" className="mt-1.5" value={newWire.stakeholder} onChange={e => setNewWire(p => ({ ...p, stakeholder: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Payment Type</Label>
              <select className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm mt-1.5 focus:outline-none focus:border-accent/40"
                value={newWire.payment_type} onChange={e => setNewWire(p => ({ ...p, payment_type: e.target.value }))}>
                {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <Input placeholder="$0.00" className="mt-1.5" value={newWire.amount} onChange={e => setNewWire(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm mt-1.5 focus:outline-none focus:border-accent/40"
                value={newWire.currency} onChange={e => setNewWire(p => ({ ...p, currency: e.target.value }))}>
                <option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option><option>CHF</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Bank Name</Label>
              <Input placeholder="JPMorgan Chase" className="mt-1.5" value={newWire.bank_name} onChange={e => setNewWire(p => ({ ...p, bank_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Account Name</Label>
              <Input placeholder="Account holder name" className="mt-1.5" value={newWire.account_name} onChange={e => setNewWire(p => ({ ...p, account_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Account Number</Label>
              <Input placeholder="••••••1234" className="mt-1.5" value={newWire.account_number} onChange={e => setNewWire(p => ({ ...p, account_number: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Routing / ABA</Label>
              <Input placeholder="021000021" className="mt-1.5" value={newWire.routing_aba} onChange={e => setNewWire(p => ({ ...p, routing_aba: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SWIFT / IBAN</Label>
              <Input placeholder="CHASUS33" className="mt-1.5" value={newWire.swift_iban} onChange={e => setNewWire(p => ({ ...p, swift_iban: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWire(false)}>Cancel</Button>
            <Button onClick={handleAddWire}>Add Wire</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
