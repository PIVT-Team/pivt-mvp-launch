import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Upload, PieChart, Download, CheckCircle2, AlertTriangle, Search,
  Table, FileSpreadsheet, Loader2, X, Trash2, Info, ShieldCheck, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PieChart as RPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const COLORS = ['hsl(262,72%,55%)', 'hsl(262,72%,70%)', 'hsl(160,84%,39%)', 'hsl(45,93%,47%)', 'hsl(217,91%,60%)', 'hsl(0,84%,60%)', 'hsl(280,60%,60%)', 'hsl(190,80%,45%)'];

type CapTableStatus = 'not_uploaded' | 'extracting' | 'parsed' | 'verified';

/** Roles that represent actual equity ownership */
const OWNERSHIP_ROLES = ['Shareholder', 'Founder', 'Employee', 'Advisor', 'Investor', 'LP', 'Member', 'Option Holder', 'Warrant Holder', 'SAFE Holder', 'Convertible Note Holder'];

/** Roles that are transactional/operational — never auto-included in cap table */
const NON_OWNERSHIP_ROLES = ['Buyer', 'Seller', 'Target', 'Merger Sub', 'Escrow Agent', 'Lender', 'Buyer Counsel', 'Seller Counsel', 'Paying Agent', 'Administrative Agent', 'Buyer Signatory', 'Seller Signatory', 'Target Signatory', 'Seller Representative', 'Trustee'];

interface CapEntry {
  id: string;
  shareholder_name: string;
  ownership_pct: number;
  payout_amount: number;
  escrow_holdback: number | null;
  fees: number | null;
  net_payout: number | null;
  role: string;
  stakeholder_type: string;
  email: string | null;
}

const STATUS_CONFIG: Record<CapTableStatus, { label: string; color: string; icon: React.ElementType }> = {
  not_uploaded: { label: 'Not Uploaded', color: 'bg-muted/60 text-muted-foreground', icon: Upload },
  extracting: { label: 'Extracting', color: 'bg-amber-500/10 text-amber-600', icon: Loader2 },
  parsed: { label: 'Parsed', color: 'bg-blue-500/10 text-blue-600', icon: FileSpreadsheet },
  verified: { label: 'Verified', color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
};

// ── Manual Add Row ──
const AddShareholderRow: React.FC<{ dealId: string; onAdded: () => void }> = ({ dealId, onAdded }) => {
  const [name, setName] = useState('');
  const [pct, setPct] = useState('');
  const [role, setRole] = useState('Shareholder');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !pct) return;
    const pctVal = parseFloat(pct);
    if (pctVal <= 0) { toast.error('Ownership percentage must be greater than 0'); return; }
    setSaving(true);
    const { error } = await supabase.from('cap_table_entries').insert({
      deal_id: dealId,
      shareholder_name: name.trim(),
      ownership_pct: pctVal,
      role,
      payout_amount: 0,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${name} added to cap table`);
    setName(''); setPct(''); setRole('Shareholder');
    onAdded();
  };

  return (
    <tr className="border-b border-border bg-muted/10">
      <td className="px-4 py-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Owner name" className="w-full bg-transparent border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent/50" />
      </td>
      <td className="px-4 py-2">
        <select value={role} onChange={e => setRole(e.target.value)} className="bg-transparent border border-border rounded px-2 py-1 text-sm">
          {OWNERSHIP_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </td>
      <td className="px-4 py-2">
        <input value={pct} onChange={e => setPct(e.target.value)} placeholder="0.00" type="number" step="0.01" min="0.01" max="100" className="w-20 bg-transparent border border-border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-accent/50" />
      </td>
      <td className="px-4 py-2" colSpan={3}>
        <Button size="sm" onClick={handleAdd} disabled={saving || !name.trim() || !pct} className="gap-1.5">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Add Owner
        </Button>
      </td>
    </tr>
  );
};

export const CapTableCover: React.FC = () => {
  const { isDemoDeal, dealId } = useDealWorkspace();
  const [entries, setEntries] = useState<CapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [capStatus, setCapStatus] = useState<CapTableStatus>('not_uploaded');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CapEntry | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchEntries = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    const { data } = await supabase
      .from('cap_table_entries')
      .select('*')
      .eq('deal_id', dealId)
      .gt('ownership_pct', 0); // Only fetch actual equity holders
    const rows = (data as CapEntry[] | null) || [];
    setEntries(rows);
    if (rows.length === 0) setCapStatus('not_uploaded');
    else setCapStatus('parsed');
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dealId) return;

    const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/pdf'];
    if (!allowed.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      toast.error('Please upload a CSV, XLSX, or PDF file');
      return;
    }

    setUploading(true);
    setCapStatus('extracting');
    toast.info('Uploading and extracting cap table...');

    const path = `${dealId}/cap-table/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('deal-documents').upload(path, file);
    if (uploadErr) {
      toast.error('Upload failed: ' + uploadErr.message);
      setUploading(false);
      setCapStatus('not_uploaded');
      return;
    }

    await supabase.from('contract_documents').insert({
      deal_id: dealId,
      filename: file.name,
      doc_type: 'CAP_TABLE',
      status: 'UPLOADED',
      file_url: path,
    });

    setTimeout(async () => {
      setCapStatus('parsed');
      setUploading(false);
      toast.success('Cap table file uploaded. Add equity holders manually or wait for AI extraction.');
      await fetchEntries();
    }, 2000);

    e.target.value = '';
  }, [dealId, fetchEntries]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('cap_table_entries').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${deleteTarget.shareholder_name} removed from cap table`);
    setDeleteTarget(null);
    fetchEntries();
  }, [deleteTarget, fetchEntries]);

  const handleVerify = useCallback(() => {
    setCapStatus('verified');
    toast.success('Cap table marked as verified');
  }, []);

  const filtered = entries.filter(e =>
    !search || e.shareholder_name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase())
  );

  const totalPct = entries.reduce((s, e) => s + e.ownership_pct, 0);
  const totalPayout = entries.reduce((s, e) => s + e.payout_amount, 0);
  const pieData = entries.map(e => ({ name: e.shareholder_name, value: e.ownership_pct }));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const StatusIcon = STATUS_CONFIG[capStatus].icon;

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      {/* Info Banner */}
      <motion.div {...fadeInUp} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border bg-blue-500/5 text-blue-700 dark:text-blue-400">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed">
          Only equity holders appear in the Cap Table. Not all stakeholders in the deal are shareholders. 
          Operational participants (counsel, agents, signatories) are managed in the Stakeholders section.
        </p>
      </motion.div>

      {/* Status Banner */}
      <motion.div {...fadeInUp} className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-border ${STATUS_CONFIG[capStatus].color}`}>
        <StatusIcon className={`w-5 h-5 ${capStatus === 'extracting' ? 'animate-spin' : ''}`} />
        <div className="flex-1">
          <span className="text-sm font-medium">Cap Table Status: {STATUS_CONFIG[capStatus].label}</span>
          {capStatus === 'not_uploaded' && (
            <p className="text-xs mt-0.5 opacity-80">Upload a cap table file or add equity holders manually.</p>
          )}
          {capStatus === 'extracting' && (
            <p className="text-xs mt-0.5 opacity-80">AI is extracting ownership data from the uploaded file...</p>
          )}
          {capStatus === 'parsed' && (
            <p className="text-xs mt-0.5 opacity-80">{entries.length} equity holder{entries.length !== 1 ? 's' : ''} identified. Review and verify when ready.</p>
          )}
          {capStatus === 'verified' && (
            <p className="text-xs mt-0.5 opacity-80">Cap table has been reviewed and verified.</p>
          )}
        </div>
        {capStatus === 'parsed' && (
          <Button size="sm" variant="outline" onClick={handleVerify} className="gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Verified
          </Button>
        )}
      </motion.div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cap Table</h1>
          <p className="text-muted-foreground mt-1">
            {entries.length > 0
              ? `${entries.length} equity holder${entries.length !== 1 ? 's' : ''} · ${totalPct.toFixed(1)}% allocated · $${(totalPayout / 1e6).toFixed(1)}M consideration`
              : 'No equity holders added yet'}
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload Cap Table
          </Button>
          {entries.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {entries.length === 0 && capStatus !== 'extracting' && (
        <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold">No Equity Holders</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Upload a cap table file (XLSX, CSV, or PDF) to extract ownership data, or add equity holders manually. 
              Only shareholders, members, and other interest holders with actual ownership should be listed here.
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={() => fileRef.current?.click()} className="gap-1.5">
              <Upload className="w-4 h-4" /> Upload Cap Table
            </Button>
            <Button variant="outline" onClick={() => setShowAddRow(true)} className="gap-1.5">
              Add Equity Holder
            </Button>
          </div>
        </motion.div>
      )}

      {/* Extracting State */}
      {entries.length === 0 && capStatus === 'extracting' && (
        <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto" />
          <div>
            <h3 className="text-base font-semibold">Extracting Ownership Data</h3>
            <p className="text-sm text-muted-foreground mt-1">AI is parsing the uploaded cap table for equity holders...</p>
          </div>
        </motion.div>
      )}

      {/* Data View */}
      {(entries.length > 0 || showAddRow) && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Equity Holders', value: entries.length, icon: Users },
              { label: 'Ownership Allocated', value: `${totalPct.toFixed(1)}%`, icon: PieChart },
              { label: 'Total Payout', value: totalPayout > 0 ? `$${(totalPayout / 1e6).toFixed(1)}M` : '—', icon: PieChart },
              { label: 'Unallocated', value: `${(100 - totalPct).toFixed(1)}%`, icon: AlertTriangle },
            ].map(stat => (
              <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4 text-accent" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className="text-xl font-semibold">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Reconciliation warnings */}
          {totalPct > 100 && (
            <motion.div {...fadeInUp} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Total ownership exceeds 100% ({totalPct.toFixed(1)}%). Please review equity holder allocations.
            </motion.div>
          )}
          {totalPct > 0 && totalPct < 100 && (
            <motion.div {...fadeInUp} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Ownership totals {totalPct.toFixed(1)}% — {(100 - totalPct).toFixed(1)}% is unallocated. Confirm all equity holders have been added.
            </motion.div>
          )}
          {totalPct === 100 && (
            <motion.div {...fadeInUp} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Ownership totals reconcile to 100%.
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pie Chart */}
            {entries.length > 0 && (
              <motion.div {...fadeInUp} className="pivt-card p-5">
                <h3 className="text-sm font-medium mb-3">Ownership Distribution</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <RPieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(val: number) => [`${val}%`, 'Ownership']} />
                  </RPieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {entries.slice(0, 6).map((e, i) => (
                    <div key={e.id} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="truncate flex-1">{e.shareholder_name}</span>
                      <span className="font-mono text-muted-foreground">{e.ownership_pct}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Table */}
            <motion.div {...fadeInUp} className={`pivt-card overflow-hidden ${entries.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equity holders..." className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-accent/50" />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddRow(!showAddRow)} className="gap-1.5">
                  {showAddRow ? <X className="w-3.5 h-3.5" /> : <Table className="w-3.5 h-3.5" />}
                  {showAddRow ? 'Cancel' : 'Add Owner'}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Equity Holder</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Ownership Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Ownership %</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Gross Payout</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Net Payout</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {showAddRow && dealId && <AddShareholderRow dealId={dealId} onAdded={fetchEntries} />}
                    {filtered.map(e => (
                      <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{e.shareholder_name}</p>
                          {e.email && <p className="text-xs text-muted-foreground">{e.email}</p>}
                          <Badge variant="outline" className="text-[9px] mt-0.5">{e.stakeholder_type}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">{e.role}</Badge>
                        </td>
                        <td className="px-4 py-3 font-mono">{e.ownership_pct}%</td>
                        <td className="px-4 py-3 font-mono">
                          {e.payout_amount > 0 ? `$${(e.payout_amount / 1e6).toFixed(1)}M` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-600">
                          {(e.net_payout || 0) > 0 ? `$${((e.net_payout || 0) / 1e6).toFixed(1)}M` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setDeleteTarget(e)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && !showAddRow && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          {search ? 'No matching equity holders' : 'No equity holders in cap table'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {entries.length > 0 && (
                <div className="p-4 border-t border-border bg-muted/30 flex justify-between text-sm font-semibold">
                  <span>Totals</span>
                  <div className="flex gap-12">
                    <span className="font-mono">{totalPct.toFixed(1)}%</span>
                    <span className="font-mono">{totalPayout > 0 ? `$${(totalPayout / 1e6).toFixed(1)}M` : '—'}</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove equity holder?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.shareholder_name}</strong> from the cap table? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};
