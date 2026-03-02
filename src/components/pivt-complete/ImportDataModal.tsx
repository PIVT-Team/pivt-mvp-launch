import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, FileJson, FileSpreadsheet, Download, CheckCircle2,
  AlertTriangle, Loader2, FileText, Users, Layers, BarChart3,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  usePIVTStore,
  type DemoStakeholder,
  type WaterfallTier,
  type DemoDocument,
  type DemoPayment,
  type DemoDeal,
} from '@/stores/pivtStore';

interface ImportPreview {
  deal?: Partial<DemoDeal>;
  stakeholders: DemoStakeholder[];
  waterfall: WaterfallTier[];
  documents: DemoDocument[];
  payments: DemoPayment[];
}

type ImportStep = 'upload' | 'parsing' | 'preview' | 'done';

/* ── Template generators ── */
const SAMPLE_DEAL_JSON = {
  deal: {
    name: 'Project DELTA',
    codeName: 'DELTA',
    consideration: 125_000_000,
    buyerName: 'Acme Holdings',
    targetCompany: 'WidgetCorp',
    sector: 'Manufacturing',
    closingDate: '2026-06-30',
  },
  stakeholders: [
    { name: 'Jane Doe', role: 'Founder & CEO', email: 'jane@widgetcorp.com', kycStatus: 'pending', payoutAmount: 50_000_000, ownershipPct: 40 },
    { name: 'Venture Fund I', role: 'Series A Lead', email: 'legal@venturefund.com', kycStatus: 'verified', payoutAmount: 37_500_000, ownershipPct: 30 },
  ],
  waterfall: [
    { name: 'Senior Debt', amount: 12_500_000, percentage: 10, recipients: 1 },
    { name: 'Common Distribution', amount: 112_500_000, percentage: 90, recipients: 8 },
  ],
};

const STAKEHOLDERS_CSV = `name,role,email,kycStatus,payoutAmount,ownershipPct
Jane Doe,Founder & CEO,jane@widgetcorp.com,pending,50000000,40
John Smith,CTO,john@widgetcorp.com,verified,25000000,20
Venture Fund I,Series A Lead,legal@venturefund.com,verified,37500000,30`;

const CAP_TABLE_CSV = `name,amount,percentage,recipients
Senior Debt,12500000,10,1
Transaction Expenses,2500000,2,3
Common Distribution,110000000,88,12`;

const WATERFALL_CSV = `name,amount,percentage,recipients
Senior Secured Debt,12500000,10,1
Preferred Return,25000000,20,3
Common Distribution,525000000,70,10`;

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTemplates() {
  downloadFile(JSON.stringify(SAMPLE_DEAL_JSON, null, 2), 'pivt_import_template.json', 'application/json');
  setTimeout(() => downloadFile(STAKEHOLDERS_CSV, 'stakeholders_template.csv', 'text/csv'), 200);
  setTimeout(() => downloadFile(CAP_TABLE_CSV, 'cap_table_template.csv', 'text/csv'), 400);
  setTimeout(() => downloadFile(WATERFALL_CSV, 'waterfall_template.csv', 'text/csv'), 600);
}

/* ── CSV Parser ── */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

function csvToStakeholders(rows: Record<string, string>[]): { data: DemoStakeholder[]; missing: string[] } {
  const required = ['name', 'role', 'email', 'payoutAmount', 'ownershipPct'];
  const headers = Object.keys(rows[0] || {});
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) return { data: [], missing };
  return {
    data: rows.map((r, i) => ({
      id: `imp-s${Date.now()}-${i}`,
      name: r.name,
      role: r.role,
      email: r.email,
      kycStatus: (r.kycStatus as 'verified' | 'pending' | 'failed') || 'pending',
      payoutAmount: Number(r.payoutAmount) || 0,
      ownershipPct: Number(r.ownershipPct) || 0,
    })),
    missing: [],
  };
}

function csvToWaterfall(rows: Record<string, string>[]): { data: WaterfallTier[]; missing: string[] } {
  const required = ['name', 'amount', 'percentage', 'recipients'];
  const headers = Object.keys(rows[0] || {});
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) return { data: [], missing };
  return {
    data: rows.map((r, i) => ({
      id: `imp-w${Date.now()}-${i}`,
      name: r.name,
      amount: Number(r.amount) || 0,
      percentage: Number(r.percentage) || 0,
      recipients: Number(r.recipients) || 0,
    })),
    missing: [],
  };
}

/* ── Component ── */
export const ImportDataModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { toast } = useToast();
  const store = usePIVTStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [csvType, setCsvType] = useState<'stakeholders' | 'waterfall'>('stakeholders');

  const reset = useCallback(() => {
    setStep('upload');
    setPreview(null);
    setFileName('');
    setFileSize('');
    setCsvType('stakeholders');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'json' && ext !== 'csv') {
      toast({ title: 'Unsupported file type', description: 'Please upload JSON or CSV.', variant: 'destructive' });
      return;
    }

    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setStep('parsing');

    const text = await file.text();

    // Simulated parsing delay
    await new Promise(r => setTimeout(r, 1500));

    if (ext === 'json') {
      try {
        const data = JSON.parse(text);
        const result: ImportPreview = { stakeholders: [], waterfall: [], documents: [], payments: [] };

        if (data.deal) {
          result.deal = {
            id: `imp-${Date.now()}`,
            name: data.deal.name || 'Imported Deal',
            codeName: data.deal.codeName || 'IMPORT',
            consideration: Number(data.deal.consideration) || 0,
            buyerName: data.deal.buyerName || '',
            targetCompany: data.deal.targetCompany || '',
            sector: data.deal.sector || '',
            closingDate: data.deal.closingDate || '',
            status: 'drafting' as const,
            workflowState: 'draft' as const,
            totalRecipients: 0,
            documentsUploaded: 0,
            discrepanciesFound: 0,
            readyToPayPercent: 0,
            pendingApprovals: 0,
            hasBlocker: false,
          };
        }

        if (Array.isArray(data.stakeholders)) {
          result.stakeholders = data.stakeholders.map((s: any, i: number) => ({
            id: `imp-s${Date.now()}-${i}`,
            name: s.name || '',
            role: s.role || '',
            email: s.email || '',
            kycStatus: s.kycStatus || 'pending',
            payoutAmount: Number(s.payoutAmount) || 0,
            ownershipPct: Number(s.ownershipPct) || 0,
          }));
        }

        if (Array.isArray(data.waterfall)) {
          result.waterfall = data.waterfall.map((w: any, i: number) => ({
            id: `imp-w${Date.now()}-${i}`,
            name: w.name || '',
            amount: Number(w.amount) || 0,
            percentage: Number(w.percentage) || 0,
            recipients: Number(w.recipients) || 0,
          }));
        }

        if (Array.isArray(data.documents)) {
          result.documents = data.documents.map((d: any, i: number) => ({
            id: `imp-d${Date.now()}-${i}`,
            name: d.name || '',
            type: d.type || 'Other',
            status: d.status || 'pending',
            uploadedAt: d.uploadedAt || new Date().toISOString().split('T')[0],
          }));
        }

        setPreview(result);
        setStep('preview');
      } catch {
        toast({ title: 'Invalid JSON', description: 'Could not parse the file.', variant: 'destructive' });
        setStep('upload');
      }
    } else {
      // CSV
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast({ title: 'Empty CSV', description: 'No data rows found.', variant: 'destructive' });
        setStep('upload');
        return;
      }

      const headers = Object.keys(rows[0]);
      // Auto-detect type
      const isWaterfall = headers.includes('percentage') && headers.includes('recipients') && !headers.includes('email');
      const detectedType = isWaterfall ? 'waterfall' : 'stakeholders';
      setCsvType(detectedType);

      if (detectedType === 'stakeholders') {
        const { data, missing } = csvToStakeholders(rows);
        if (missing.length) {
          toast({ title: 'Missing required columns', description: missing.join(', '), variant: 'destructive' });
          setStep('upload');
          return;
        }
        setPreview({ stakeholders: data, waterfall: [], documents: [], payments: [] });
      } else {
        const { data, missing } = csvToWaterfall(rows);
        if (missing.length) {
          toast({ title: 'Missing required columns', description: missing.join(', '), variant: 'destructive' });
          setStep('upload');
          return;
        }
        setPreview({ stakeholders: [], waterfall: data, documents: [], payments: [] });
      }
      setStep('preview');
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const confirmImport = useCallback(() => {
    if (!preview) return;

    const dealName = store.getSelectedDeal()?.name || 'current deal';

    if (preview.deal) {
      const fullDeal: DemoDeal = {
        id: preview.deal.id || `imp-${Date.now()}`,
        name: preview.deal.name || 'Imported Deal',
        codeName: preview.deal.codeName || 'IMPORT',
        dealNumber: `PIVT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        consideration: preview.deal.consideration || 0,
        status: 'drafting',
        workflowState: 'draft',
        buyerName: preview.deal.buyerName || '',
        targetCompany: preview.deal.targetCompany || '',
        sector: preview.deal.sector || '',
        totalRecipients: preview.stakeholders.length,
        documentsUploaded: preview.documents.length,
        discrepanciesFound: 0,
        readyToPayPercent: 0,
        closingDate: preview.deal.closingDate || '',
        pendingApprovals: 0,
        hasBlocker: false,
      };
      store.addDeal(fullDeal);
      store.setSelectedDealId(fullDeal.id);
      store.setActiveSection('workspace');
    }

    if (preview.stakeholders.length) store.importStakeholders(preview.stakeholders);
    if (preview.waterfall.length) store.importWaterfall(preview.waterfall);
    if (preview.documents.length) store.importDocuments(preview.documents);
    if (preview.payments.length) store.importPayments(preview.payments);

    setStep('done');

    const target = preview.deal?.name || dealName;
    toast({ title: 'Import complete', description: `Data added to ${target}.` });

    setTimeout(() => handleClose(), 1200);
  }, [preview, store, toast, handleClose]);

  if (!open) return null;

  const totalItems = preview
    ? (preview.deal ? 1 : 0) + preview.stakeholders.length + preview.waterfall.length + preview.documents.length + preview.payments.length
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Import Deal Data</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Upload JSON or CSV files to populate the platform</p>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6">
            {/* Upload step */}
            {step === 'upload' && (
              <div className="space-y-5">
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                    dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40 hover:bg-muted/30'
                  }`}
                >
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .json and .csv</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,.csv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <p className="text-xs font-medium text-foreground">Need a template?</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Download sample JSON + CSV template pack</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadTemplates(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  Imported (Demo Mode) — data stored locally for this session
                </p>
              </div>
            )}

            {/* Parsing step */}
            {step === 'parsing' && (
              <div className="py-10 text-center space-y-4">
                <Loader2 className="w-8 h-8 mx-auto text-accent animate-spin" />
                <div>
                  <p className="text-sm font-medium text-foreground">Parsing {fileName}...</p>
                  <p className="text-xs text-muted-foreground mt-1">{fileSize}</p>
                </div>
                <div className="w-48 mx-auto h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            )}

            {/* Preview step */}
            {step === 'preview' && preview && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">{fileName}</span>
                  <span className="text-xs text-muted-foreground">({fileSize})</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {preview.deal && (
                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/15">
                      <div className="flex items-center gap-2 mb-1">
                        <FileJson className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-medium text-foreground">New Deal</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{preview.deal.name}</p>
                    </div>
                  )}
                  {preview.stakeholders.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-medium text-foreground">Stakeholders</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">{preview.stakeholders.length}</p>
                    </div>
                  )}
                  {preview.waterfall.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-medium text-foreground">Waterfall Tiers</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">{preview.waterfall.length}</p>
                    </div>
                  )}
                  {preview.documents.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-foreground">Documents</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">{preview.documents.length}</p>
                    </div>
                  )}
                </div>

                {!preview.deal && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
                    Data will be attached to the currently selected deal ({store.getSelectedDeal()?.name || 'none'}).
                  </p>
                )}

                <div className="flex gap-3 justify-end pt-1">
                  <button
                    onClick={reset}
                    className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmImport}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirm Import ({totalItems} items)
                  </button>
                </div>
              </div>
            )}

            {/* Done step */}
            {step === 'done' && (
              <div className="py-10 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
                <p className="text-sm font-medium text-foreground">Import Complete</p>
                <p className="text-xs text-muted-foreground">Data has been loaded into the platform.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
