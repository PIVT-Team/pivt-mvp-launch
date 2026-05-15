import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fadeInUp } from '@/lib/animations';
import {
  Lock, Clock, Info, Building2,
  Upload, Plus, FileText, Pencil, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface EscrowAccount {
  id: string;
  institution_name: string;
  account_type: string;
  masked_account_number: string | null;
  status: string;
  interest_rate: number;
  interest_split_client_percent: number;
  interest_split_platform_percent: number;
  opened_at: string | null;
}

interface EscrowTransaction {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  executed_at: string | null;
}

interface EscrowDocument {
  id: string;
  file_name: string;
  file_path: string | null;
  file_size: number;
  created_at: string;
}

const fmt = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ── Add/Edit Escrow Details Modal ──
// Two flows roll into one modal — first-time create vs. edit existing. The
// table's UNIQUE(deal_id) constraint means we always upsert on deal_id.
const EscrowDetailsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  dealId: string;
  existing: EscrowAccount | null;
  onSaved: () => void;
}> = ({ open, onClose, dealId, existing, onSaved }) => {
  const [institution, setInstitution] = useState('');
  const [accountType, setAccountType] = useState<'FBO' | 'Dedicated'>('FBO');
  const [maskedAccount, setMaskedAccount] = useState('');
  const [interestRate, setInterestRate] = useState('4.25');
  const [status, setStatus] = useState<'pending' | 'active' | 'closed'>('pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInstitution(existing?.institution_name || '');
    setAccountType((existing?.account_type as any) || 'FBO');
    setMaskedAccount(existing?.masked_account_number || '');
    setInterestRate(existing?.interest_rate?.toString() || '4.25');
    setStatus((existing?.status as any) || 'pending');
  }, [open, existing]);

  const handleSave = async () => {
    if (!institution.trim()) {
      toast.error('Institution name is required');
      return;
    }
    setSaving(true);
    const rate = Number.parseFloat(interestRate);
    const payload: any = {
      deal_id: dealId,
      institution_name: institution.trim(),
      account_type: accountType,
      masked_account_number: maskedAccount.trim() || null,
      interest_rate: Number.isFinite(rate) ? rate : 4.25,
      status,
      // Set opened_at when moving to active for the first time.
      opened_at: status === 'active' && !existing?.opened_at ? new Date().toISOString() : (existing?.opened_at ?? null),
    };
    // UNIQUE(deal_id) — upsert collapses create + edit into one path.
    const { error } = await supabase
      .from('escrow_accounts')
      .upsert(payload, { onConflict: 'deal_id' });
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success(existing ? 'Escrow details updated' : 'Escrow details added');
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit Escrow Details' : 'Add Escrow Details'}</DialogTitle>
          <DialogDescription>
            Record the partner institution and account where escrow funds for
            this deal are held. PIVT doesn't custody funds — this is for tracking only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="institution">Institution name</Label>
            <Input
              id="institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. JPMorgan Chase, First Republic Trust"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acctype">Account type</Label>
              <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
                <SelectTrigger id="acctype"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FBO">FBO (For Benefit Of)</SelectItem>
                  <SelectItem value="Dedicated">Dedicated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="masked">Account number (last 4)</Label>
              <Input
                id="masked"
                value={maskedAccount}
                onChange={(e) => setMaskedAccount(e.target.value)}
                placeholder="****1234"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate">Interest rate (%)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="4.25"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {existing ? 'Save' : 'Add Escrow Details'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const EscrowCover: React.FC = () => {
  const { dealId, realDeal } = useDealWorkspace();
  const { user } = useAuth();
  const [account, setAccount] = useState<EscrowAccount | null>(null);
  const [transactions, setTransactions] = useState<EscrowTransaction[]>([]);
  const [escrowDocs, setEscrowDocs] = useState<EscrowDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    const [accRes, txRes, docRes] = await Promise.all([
      supabase.from('escrow_accounts').select('*').eq('deal_id', dealId).maybeSingle(),
      supabase.from('escrow_transactions').select('*').eq('deal_id', dealId).order('created_at'),
      // The bucket-and-table convention used elsewhere — we tag the doc
      // type so it shows on this page (and only this page).
      supabase.from('deal_documents').select('id, file_name, file_path, file_size, created_at').eq('deal_id', dealId).eq('doc_type', 'ESCROW_AGREEMENT').order('created_at', { ascending: false }),
    ]);
    setAccount(accRes.data || null);
    setTransactions(txRes.data || []);
    setEscrowDocs((docRes.data || []) as any);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Upload Escrow Agreement ──
  // The deal-documents bucket already has lenient RLS for authenticated
  // users; we just need to tag the doc_type so the UI can filter to escrow
  // agreements specifically.
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-pick of same file later
    if (!file || !dealId) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-z0-9._-]/gi, '_');
      const path = `${dealId}/escrow-${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from('deal-documents')
        .upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        file_name: file.name,
        file_size: file.size,
        file_path: path,
        mime_type: file.type || null,
        status: 'parsed',
        doc_type: 'ESCROW_AGREEMENT',
        uploaded_by: user?.email || 'Current User',
      } as any);
      if (dbErr) throw dbErr;
      // Audit log so the upload shows in the Audit tab + the Audit dot.
      await supabase.from('audit_log').insert({
        deal_id: dealId,
        user_id: user?.id ?? null,
        action: 'escrow_agreement_uploaded',
        details: { file_name: file.name, file_size: file.size, path },
      });
      toast.success(`Uploaded ${file.name}`);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openDoc = async (doc: EscrowDocument) => {
    if (!doc.file_path) {
      toast.error('No file path on record');
      return;
    }
    const { data, error } = await supabase.storage
      .from('deal-documents')
      .createSignedUrl(doc.file_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error(`Could not open file: ${error?.message ?? 'unknown'}`);
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const escrowAmount = realDeal?.escrow_amount || 0;
  const hasAnyData = account || transactions.length > 0 || escrowAmount > 0 || escrowDocs.length > 0;

  // Reusable Add / Upload action group rendered in both empty and populated states.
  const ActionButtons = (
    <>
      <Button variant="outline" className="gap-2 text-sm" onClick={() => setEditOpen(true)}>
        {account ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {account ? 'Edit Escrow Details' : 'Add Escrow Details'}
      </Button>
      <Button variant="outline" className="gap-2 text-sm" onClick={handleUploadClick} disabled={uploading}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Uploading…' : 'Upload Escrow Agreement'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md,application/pdf"
        onChange={handleFileChosen}
      />
    </>
  );

  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        {/* Non-custody notice */}
        <div className="pivt-card p-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Info className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
          </p>
        </div>

        <div className="pivt-card border border-border/50 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No escrow structure configured yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Add escrow details or upload an escrow agreement to configure escrow tracking for this deal.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {ActionButtons}
          </div>
        </div>

        {dealId && (
          <EscrowDetailsDialog
            open={editOpen}
            onClose={() => setEditOpen(false)}
            dealId={dealId}
            existing={account}
            onSaved={refresh}
          />
        )}
      </div>
    );
  }

  // Partial data: show what exists
  const totalTx = transactions.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Escrow & Funds Tracking</h2>
        <div className="flex items-center gap-2">
          {account && (
            <Badge className={account.status === 'active' || account.status === 'funded' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'}>
              {account.status.toUpperCase()}
            </Badge>
          )}
          {ActionButtons}
        </div>
      </div>

      {/* Non-custody notice */}
      <div className="pivt-card p-3 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Info className="w-4 h-4 text-blue-500" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Escrow Amount</p>
          <p className="text-xl font-bold font-mono">{escrowAmount > 0 ? fmt(escrowAmount) : '—'}</p>
          {escrowAmount > 0 && realDeal?.deal_value ? (
            <p className="text-xs text-muted-foreground mt-1">{((escrowAmount / realDeal.deal_value) * 100).toFixed(1)}% of deal value</p>
          ) : null}
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Account Details</p>
          <p className="text-sm font-medium">{account ? `${account.institution_name}` : 'Not configured'}</p>
          {account?.masked_account_number && <p className="text-xs text-muted-foreground mt-1">{account.masked_account_number}</p>}
          {account?.account_type && !account.masked_account_number && (
            <p className="text-xs text-muted-foreground mt-1">{account.account_type}</p>
          )}
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Transactions</p>
          <p className="text-xl font-bold font-mono">{transactions.length > 0 ? fmt(totalTx) : '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Funding Status</p>
          <p className="text-sm font-medium">{account?.opened_at ? 'Opened' : 'Not started'}</p>
          {account?.opened_at && (
            <p className="text-xs text-muted-foreground mt-1">{new Date(account.opened_at).toLocaleDateString()}</p>
          )}
        </motion.div>
      </div>

      {/* Escrow Agreements (documents) */}
      {escrowDocs.length > 0 && (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-medium">Escrow Agreements</h3>
          </div>
          <div className="divide-y divide-border">
            {escrowDocs.map(d => (
              <div key={d.id} className="px-4 py-3 flex items-center gap-4">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => openDoc(d)}
                    className="text-sm font-medium text-left hover:underline truncate"
                  >
                    {d.file_name}
                  </button>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {(d.file_size / 1024).toFixed(0)} KB · uploaded {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openDoc(d)}
                  className="text-xs text-accent hover:underline shrink-0"
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions list */}
      {transactions.length > 0 ? (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-medium">Escrow Transactions</h3>
          </div>
          <div className="divide-y divide-border">
            {transactions.map(t => (
              <div key={t.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(t.created_at).toLocaleDateString()}
                    {t.executed_at && ` • Executed ${new Date(t.executed_at).toLocaleDateString()}`}
                  </p>
                </div>
                <p className="font-mono font-semibold text-sm">{fmtCurrency(Number(t.amount))}</p>
                <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pivt-card p-8 text-center text-muted-foreground">
          <p className="text-sm">No escrow transactions recorded yet.</p>
        </div>
      )}

      {dealId && (
        <EscrowDetailsDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          dealId={dealId}
          existing={account}
          onSaved={refresh}
        />
      )}
    </div>
  );
};
