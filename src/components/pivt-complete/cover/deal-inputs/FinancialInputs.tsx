import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Upload, CheckCircle2, Clock, DollarSign,
  FileSpreadsheet, Table2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const FINANCIAL_DOC_TYPES = [
  { value: 'CAP_TABLE', label: 'Cap Table' },
  { value: 'WATERFALL_MODEL', label: 'Waterfall Model' },
  { value: 'PURCHASE_PRICE_ALLOCATION', label: 'Purchase Price Allocation' },
  { value: 'ESCROW_ALLOCATION', label: 'Escrow Allocation Model' },
  { value: 'DISTRIBUTION_SCHEDULE', label: 'Seller Distribution Schedule' },
] as const;

interface FinancialDoc {
  id: string;
  doc_type: string;
  filename: string;
  status: string;
  uploaded_at: string;
}

const DEMO_DOCS: FinancialDoc[] = [
  { id: 'fd1', doc_type: 'CAP_TABLE', filename: 'CapTable_Final.xlsx', status: 'PARSED', uploaded_at: '2026-02-25T09:00:00Z' },
  { id: 'fd2', doc_type: 'WATERFALL_MODEL', filename: 'Waterfall_Schedule_v3.xlsx', status: 'PARSED', uploaded_at: '2026-02-26T14:00:00Z' },
];

export const FinancialInputs: React.FC = () => {
  const [docs, setDocs] = useState<FinancialDoc[]>(DEMO_DOCS);
  const [selectedType, setSelectedType] = useState('CAP_TABLE');

  const handleUpload = useCallback(() => {
    const label = FINANCIAL_DOC_TYPES.find(t => t.value === selectedType)?.label || selectedType;
    const newDoc: FinancialDoc = {
      id: `fd-${Date.now()}`,
      doc_type: selectedType,
      filename: `${label.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      status: 'UPLOADED',
      uploaded_at: new Date().toISOString(),
    };
    setDocs(prev => [...prev, newDoc]);
    toast.success(`Uploaded: ${newDoc.filename}`);
  }, [selectedType]);

  const getLabel = (type: string) => FINANCIAL_DOC_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Financial Inputs</h2>
        <p className="text-sm text-muted-foreground mt-1">Financial structure of the transaction — models, allocations, and schedules.</p>
      </motion.div>

      {/* ── Financial Documents ── */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3 mb-1">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold">Financial Documents</h3>
          </div>
          <p className="text-xs text-muted-foreground ml-8">Upload spreadsheets used to structure ownership and distributions.</p>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-4 mb-5">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40">
                {FINANCIAL_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Button onClick={handleUpload} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload</Button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Filename</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-emerald-500 shrink-0" />{doc.filename}
                  </td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{getLabel(doc.doc_type)}</Badge></td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${doc.status === 'PARSED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'}`}>
                      {doc.status === 'PARSED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No financial inputs uploaded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Structured Financial Inputs ── */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3 mb-1">
            <DollarSign className="w-5 h-5 text-accent" />
            <h3 className="font-semibold">Financial Inputs</h3>
          </div>
          <p className="text-xs text-muted-foreground ml-8">Structured fields that feed the payment orchestration engine.</p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><Label className="text-xs text-muted-foreground">Total Purchase Price</Label><Input placeholder="$0.00" className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Currency</Label>
            <select className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm mt-1.5">
              <option>USD</option><option>EUR</option><option>GBP</option>
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Escrow Amount</Label><Input placeholder="$0.00" className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Seller Proceeds Allocation</Label><Input placeholder="e.g. Pro-rata by ownership" className="mt-1.5" /></div>
          <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Payment Schedule (if applicable)</Label><Input placeholder="At closing / milestone-based" className="mt-1.5" /></div>
        </div>
      </motion.div>
    </div>
  );
};
