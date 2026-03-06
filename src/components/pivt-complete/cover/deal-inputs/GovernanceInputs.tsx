import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Upload, FileText, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const GOV_DOC_TYPES = [
  { value: 'BOARD_RESOLUTION', label: 'Board Resolution' },
  { value: 'SHAREHOLDER_APPROVAL', label: 'Shareholder Approval' },
  { value: 'WRITTEN_CONSENT', label: 'Written Consent' },
  { value: 'OFFICER_CERTIFICATE', label: 'Officer Certificate' },
] as const;

interface GovDoc { id: string; doc_type: string; filename: string; status: string; uploaded_at: string }

export const GovernanceInputs: React.FC = () => {
  const [docs, setDocs] = useState<GovDoc[]>([
    { id: 'gd1', doc_type: 'BOARD_RESOLUTION', filename: 'Board_Resolution_Acme.pdf', status: 'UPLOADED', uploaded_at: '2026-02-27T10:00:00Z' },
  ]);
  const [selectedType, setSelectedType] = useState('BOARD_RESOLUTION');

  const handleUpload = useCallback(() => {
    const label = GOV_DOC_TYPES.find(t => t.value === selectedType)?.label || selectedType;
    const newDoc: GovDoc = { id: `gd-${Date.now()}`, doc_type: selectedType, filename: `${label.replace(/\s/g, '_')}_${Date.now()}.pdf`, status: 'UPLOADED', uploaded_at: new Date().toISOString() };
    setDocs(prev => [...prev, newDoc]);
    toast.success(`Uploaded: ${newDoc.filename}`);
  }, [selectedType]);

  const getLabel = (t: string) => GOV_DOC_TYPES.find(d => d.value === t)?.label || t;

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Governance</h2>
        <p className="text-sm text-muted-foreground mt-1">Corporate approvals required before closing.</p>
      </motion.div>

      {/* Document Uploads */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-violet-500" /><h3 className="font-semibold">Governance Documents</h3></div>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-4 mb-5">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40">
                {GOV_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Button onClick={handleUpload} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload</Button>
          </div>

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
                  <td className="px-4 py-2.5 font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-violet-500 shrink-0" />{doc.filename}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{getLabel(doc.doc_type)}</Badge></td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${doc.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'}`}>
                      {doc.status === 'VERIFIED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No governance documents uploaded.</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Structured Governance Inputs */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-accent" /><h3 className="font-semibold">Approval Records</h3></div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div><Label className="text-xs text-muted-foreground">Approval Type</Label>
            <select className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm mt-1.5">
              <option>Board Resolution</option><option>Shareholder Vote</option><option>Written Consent</option><option>Officer Certificate</option>
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Approving Entity</Label><Input placeholder="Board of Directors" className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Approval Date</Label><Input type="date" className="mt-1.5" /></div>
        </div>
      </motion.div>
    </div>
  );
};
