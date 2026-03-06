import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Upload, FileText, CheckCircle2, Clock, Receipt, Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';

const TAX_DOC_TYPES = [
  { value: 'W9', label: 'IRS W-9' },
  { value: 'W8BEN', label: 'W-8BEN' },
  { value: 'W8BENE', label: 'W-8BEN-E' },
  { value: 'FATCA', label: 'FATCA Declaration' },
  { value: 'WITHHOLDING', label: 'Withholding Tax Documentation' },
  { value: 'TAX_RESIDENCY', label: 'Tax Residency Declaration' },
] as const;

interface TaxFormRecord {
  id: string;
  form_type: string;
  status: string;
  recipient_name: string;
  tin_last4: string | null;
  created_at: string;
}

interface TaxDoc { id: string; doc_type: string; filename: string; status: string; uploaded_at: string }

export const TaxInputs: React.FC = () => {
  const { dealId, isDemoDeal } = useDealWorkspace();
  const [docs, setDocs] = useState<TaxDoc[]>([]);
  const [taxForms, setTaxForms] = useState<TaxFormRecord[]>([]);
  const [selectedType, setSelectedType] = useState('W9');
  const [loading, setLoading] = useState(true);

  // Auto-populate from tax_forms table and contract_documents
  useEffect(() => {
    if (!dealId || isDemoDeal) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      const [taxFormsRes, taxDocs] = await Promise.all([
        // Fetch tax forms linked to deal recipients
        supabase
          .from('tax_forms')
          .select('id, form_type, status, recipient_id, tin_last4, created_at')
          .eq('deal_id', dealId),
        // Fetch tax-related uploaded documents
        supabase
          .from('contract_documents')
          .select('id, doc_type, filename, status, uploaded_at')
          .eq('deal_id', dealId)
          .in('doc_type', ['W9', 'W8BEN', 'W8BENE', 'FATCA', 'WITHHOLDING', 'TAX_RESIDENCY'] as any),
      ]);

      // Get recipient names from cap_table_entries
      const recipientIds = (taxFormsRes.data || []).map((f: any) => f.recipient_id);
      let recipientMap: Record<string, string> = {};
      if (recipientIds.length > 0) {
        const { data: recipients } = await supabase
          .from('cap_table_entries')
          .select('id, shareholder_name')
          .in('id', recipientIds);
        recipientMap = (recipients || []).reduce((m: Record<string, string>, r: any) => {
          m[r.id] = r.shareholder_name;
          return m;
        }, {});
      }

      setTaxForms((taxFormsRes.data || []).map((f: any) => ({
        id: f.id,
        form_type: f.form_type,
        status: f.status,
        recipient_name: recipientMap[f.recipient_id] || 'Unknown',
        tin_last4: f.tin_last4,
        created_at: f.created_at,
      })));

      setDocs((taxDocs.data || []).map((d: any) => ({
        id: d.id,
        doc_type: d.doc_type,
        filename: d.filename,
        status: d.status,
        uploaded_at: d.uploaded_at,
      })));

      setLoading(false);
    };
    fetchData();
  }, [dealId, isDemoDeal]);

  const handleUpload = useCallback(() => {
    const label = TAX_DOC_TYPES.find(t => t.value === selectedType)?.label || selectedType;
    const newDoc: TaxDoc = { id: `td-${Date.now()}`, doc_type: selectedType, filename: `${label.replace(/\s/g, '_')}_${Date.now()}.pdf`, status: 'UPLOADED', uploaded_at: new Date().toISOString() };
    setDocs(prev => [...prev, newDoc]);
    toast.success(`Uploaded: ${newDoc.filename}`);
  }, [selectedType]);

  const getLabel = (t: string) => TAX_DOC_TYPES.find(d => d.value === t)?.label || t;

  const statusBadge = (s: string) => {
    if (s === 'received' || s === 'verified' || s === 'VERIFIED') return 'bg-emerald-500/10 text-emerald-600';
    if (s === 'required') return 'bg-amber-500/10 text-amber-600';
    if (s === 'expired') return 'bg-red-400/10 text-red-400';
    return 'bg-muted/60 text-muted-foreground';
  };

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Tax Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">Required tax documentation before closing.</p>
      </motion.div>

      {/* Auto-populated Tax Forms from Stakeholders */}
      {taxForms.length > 0 && (
        <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
          <div className="p-5 border-b border-border/30">
            <div className="flex items-center gap-3"><Users className="w-5 h-5 text-blue-500" /><h3 className="font-semibold">Stakeholder Tax Forms</h3></div>
            <p className="text-xs text-muted-foreground ml-8 mt-1">Auto-populated from collected stakeholder tax documentation.</p>
          </div>
          <div className="p-5">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Recipient</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Form Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">TIN (Last 4)</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr></thead>
              <tbody>
                {taxForms.map(f => (
                  <tr key={f.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{f.recipient_name}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{f.form_type}</Badge></td>
                    <td className="px-4 py-2.5 font-mono text-xs">{f.tin_last4 ? `••••${f.tin_last4}` : '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${statusBadge(f.status)}`}>
                        {f.status === 'received' || f.status === 'verified' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Uploads */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3"><Receipt className="w-5 h-5 text-orange-500" /><h3 className="font-semibold">Tax Form Uploads</h3></div>
          <p className="text-xs text-muted-foreground ml-8 mt-1">⚠️ Do not upload full SSNs in free-text fields — use signed PDFs.</p>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-4 mb-5">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40">
                {TAX_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Button onClick={handleUpload} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload</Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Filename</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
              </tr></thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-orange-500 shrink-0" />{doc.filename}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{getLabel(doc.doc_type)}</Badge></td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${statusBadge(doc.status)}`}>
                        {doc.status === 'VERIFIED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No tax documents uploaded.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Structured Tax Inputs */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3"><Receipt className="w-5 h-5 text-accent" /><h3 className="font-semibold">Tax Parameters</h3></div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><Label className="text-xs text-muted-foreground">Tax Jurisdiction</Label><Input placeholder="United States" className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Withholding Requirements</Label><Input placeholder="Section 1445 FIRPTA" className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Applicable Tax Rate</Label><Input placeholder="15%" className="mt-1.5" /></div>
        </div>
      </motion.div>
    </div>
  );
};
