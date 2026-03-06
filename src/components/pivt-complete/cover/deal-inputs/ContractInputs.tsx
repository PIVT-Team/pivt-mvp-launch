import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Upload, FileText, CheckCircle2, Clock, Zap, Eye, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';

const CONTRACT_DOC_TYPES = [
  { value: 'SPA', label: 'SPA / Merger Agreement' },
  { value: 'DISCLOSURE_SCHEDULES', label: 'Disclosure Schedules' },
  { value: 'ESCROW_AGREEMENT', label: 'Escrow Agreement' },
  { value: 'SIDE_LETTER', label: 'Side Letters' },
  { value: 'TSA', label: 'Transition Service Agreements' },
  { value: 'EARNOUT', label: 'Earn-out Agreements' },
] as const;

const CONTRACT_DOC_VALUES = CONTRACT_DOC_TYPES.map(t => t.value);

interface ContractDoc { id: string; doc_type: string; filename: string; status: string; uploaded_at: string }

export const ContractInputs: React.FC = () => {
  const { dealId, isDemoDeal } = useDealWorkspace();
  const [docs, setDocs] = useState<ContractDoc[]>([]);
  const [selectedType, setSelectedType] = useState('SPA');
  const [extracting, setExtracting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-populate from already-uploaded contract documents
  useEffect(() => {
    if (!dealId || isDemoDeal) {
      setLoading(false);
      return;
    }
    const fetchDocs = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('contract_documents')
        .select('id, doc_type, filename, status, uploaded_at')
        .eq('deal_id', dealId)
        .in('doc_type', CONTRACT_DOC_VALUES as any);
      setDocs((data || []).map((d: any) => ({
        id: d.id,
        doc_type: d.doc_type,
        filename: d.filename,
        status: d.status,
        uploaded_at: d.uploaded_at,
      })));
      setLoading(false);
    };
    fetchDocs();
  }, [dealId, isDemoDeal]);

  const handleUpload = useCallback(() => {
    const label = CONTRACT_DOC_TYPES.find(t => t.value === selectedType)?.label || selectedType;
    const newDoc: ContractDoc = { id: `cd-${Date.now()}`, doc_type: selectedType, filename: `${label.replace(/[\s/]/g, '_')}_${Date.now()}.pdf`, status: 'UPLOADED', uploaded_at: new Date().toISOString() };
    setDocs(prev => [...prev, newDoc]);
    toast.success(`Uploaded: ${newDoc.filename}`);
  }, [selectedType]);

  const handleExtract = useCallback((docId: string) => {
    setExtracting(docId);
    toast.info('Extracting obligations with AI...');
    setTimeout(() => {
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'EXTRACTION_COMPLETE' } : d));
      setExtracting(null);
      toast.success('Obligations extracted — view in the Obligations tab.');
    }, 3000);
  }, []);

  const getLabel = (t: string) => CONTRACT_DOC_TYPES.find(d => d.value === t)?.label || t;

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Contract Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Core transaction agreements — parsed by AI for obligations.
          {docs.length > 0 && !isDemoDeal && <span className="text-accent"> Auto-populated from uploaded deal documents.</span>}
        </p>
      </motion.div>

      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3"><FileText className="w-5 h-5 text-accent" /><h3 className="font-semibold">Upload Agreements</h3></div>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-4 mb-5">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40">
                {CONTRACT_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr></thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground shrink-0" />{doc.filename}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{getLabel(doc.doc_type)}</Badge></td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                        doc.status === 'EXTRACTION_COMPLETE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'
                      }`}>
                        {doc.status === 'EXTRACTION_COMPLETE' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{doc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      {doc.status === 'UPLOADED' && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={extracting === doc.id} onClick={() => handleExtract(doc.id)}>
                          {extracting === doc.id ? <><Loader2 className="w-3 h-3 animate-spin" /> Extracting...</> : <><Zap className="w-3 h-3" /> Extract Obligations</>}
                        </Button>
                      )}
                      {doc.status === 'EXTRACTION_COMPLETE' && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 text-xs"><Eye className="w-3 h-3 mr-1" /> Parsed</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No contract documents uploaded.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};
