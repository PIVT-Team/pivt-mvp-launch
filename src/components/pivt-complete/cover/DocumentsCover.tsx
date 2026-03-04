import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useEditGuard } from '@/hooks/useEditGuard';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { useAuditStore } from '@/stores/auditStore';
import { fadeInUp } from '@/lib/animations';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, Clock, XCircle, FileText, Upload, Eye,
  AlertTriangle, Loader2, Zap, ChevronDown, ChevronRight,
  Shield, Search, FolderOpen, Send, Link2, RefreshCw,
  MessageSquare, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

// ── Types ──
type DocStatus = 'uploading' | 'processing' | 'processed' | 'pending_review' | 'verified' | 'rejected' | 'failed';

interface DealDocument {
  id: string;
  deal_id: string;
  file_name: string;
  file_size: number;
  file_path: string | null;
  mime_type: string | null;
  page_count: number;
  status: DocStatus;
  doc_type: string;
  doc_type_confidence: number;
  extracted_text: string | null;
  extracted_fields: Record<string, any>;
  validation_flags: ValidationFlag[];
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

interface ValidationFlag {
  severity: 'info' | 'warning' | 'critical';
  field: string;
  message: string;
}

type FilterType = 'all' | 'processed' | 'pending' | 'verified' | 'flags';
type ViewMode = 'library' | 'extraction' | 'qa';

// ── Category map ──
const DOC_TYPE_LABELS: Record<string, { label: string; category: string }> = {
  spa: { label: 'SPA / Purchase Agreement', category: 'Transaction' },
  cap_table: { label: 'Cap Table', category: 'Corporate' },
  waterfall: { label: 'Waterfall / Distribution', category: 'Financial' },
  wire_instructions: { label: 'Wire Instructions', category: 'Compliance' },
  kyc: { label: 'KYC / Identity', category: 'Compliance' },
  board_consent: { label: 'Board Consent', category: 'Corporate' },
  employment_agreement: { label: 'Employment Agreement', category: 'Legal' },
  financial_statements: { label: 'Financial Statements', category: 'Financial' },
  escrow_agreement: { label: 'Escrow Agreement', category: 'Transaction' },
  disclosure_schedules: { label: 'Disclosure Schedules', category: 'Transaction' },
  other: { label: 'Other', category: 'Other' },
};

// ── Status config ──
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  uploading: { label: 'Uploading', color: 'bg-accent/10 text-accent', icon: Loader2 },
  processing: { label: 'Processing', color: 'bg-accent/10 text-accent', icon: RefreshCw },
  processed: { label: 'Processed', color: 'bg-validated/10 text-validated', icon: CheckCircle2 },
  pending_review: { label: 'Pending Review', color: 'bg-discrepancy/10 text-discrepancy', icon: Clock },
  verified: { label: 'Verified', color: 'bg-validated/10 text-validated', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-blocking/10 text-blocking', icon: XCircle },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

// ── Demo document templates ──
const DEMO_DOCUMENTS = [
  {
    file_name: 'Merger_Agreement_Northbridge_v4.pdf',
    file_size: 2450000,
    mime_type: 'application/pdf',
    doc_type: 'spa',
    doc_type_confidence: 0.97,
    page_count: 84,
    extracted_text: 'AGREEMENT AND PLAN OF MERGER by and among APEX CAPITAL PARTNERS LLC ("Buyer"), NORTHBRIDGE SOFTWARE INC. ("Company"), and NORTHBRIDGE HOLDINGS LLC ("Seller Representative"). Purchase Price: $185,000,000. Closing Date: March 15, 2026. Escrow Amount: $18,000,000 (9.7% of Purchase Price). Governing Law: Delaware. Indemnification Cap: $18,500,000. Basket Amount: $925,000.',
    extracted_fields: { buyer: 'Apex Capital Partners LLC', seller: 'Northbridge Software Inc.', purchase_price: '$185,000,000', closing_date: 'March 15, 2026', escrow_amount: '$18,000,000', governing_law: 'Delaware', indemnification_cap: '$18,500,000' },
    validation_flags: [{ severity: 'info', field: 'escrow_amount', message: 'Escrow = 9.7% of purchase price — standard range' }],
  },
  {
    file_name: 'CapTable_Northbridge_Final.xlsx',
    file_size: 890000,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc_type: 'cap_table',
    doc_type_confidence: 0.99,
    page_count: 3,
    extracted_text: 'Northbridge Software Cap Table. Sarah Chen: 30% ($55.5M). Marcus Williams: 20% ($37.0M). Sequoia Capital Fund XIV: 15% ($27.8M). Andreessen Horowitz: 10% ($18.5M). Tiger Global: 8% ($14.8M). Employee Option Pool: 7% ($13.0M). Index Ventures: 6% ($11.1M). GIC Private Limited: 4% ($7.4M). Total: 100%.',
    extracted_fields: { shareholders: [{ name: 'Sarah Chen', ownership_pct: 30, payout: 55500000 }, { name: 'Marcus Williams', ownership_pct: 20, payout: 37000000 }, { name: 'Sequoia Capital Fund XIV', ownership_pct: 15, payout: 27750000 }, { name: 'Andreessen Horowitz', ownership_pct: 10, payout: 18500000 }, { name: 'Tiger Global', ownership_pct: 8, payout: 14800000 }, { name: 'Employee Option Pool', ownership_pct: 7, payout: 12950000 }, { name: 'Index Ventures', ownership_pct: 6, payout: 11100000 }, { name: 'GIC Private Limited', ownership_pct: 4, payout: 7400000 }], total_ownership: 100, total_payout: 185000000 },
    validation_flags: [{ severity: 'info', field: 'total_ownership', message: 'Total ownership = 100% — verified' }],
  },
  {
    file_name: 'Waterfall_Distribution_v3.xlsx',
    file_size: 675000,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc_type: 'waterfall',
    doc_type_confidence: 0.96,
    page_count: 2,
    extracted_text: 'Distribution Waterfall Schedule. Tier 1: Transaction Expenses $3.2M (2%). Tier 2: Senior Secured Debt $72.0M (39%). Tier 3: Escrow Holdback $18.0M (10%). Tier 4: Series B Preferred $47.8M (26%). Tier 5: Common Distribution $44.0M (23%). Total: $185.0M.',
    extracted_fields: { tiers: [{ name: 'Transaction Expenses', amount: 3200000, pct: 2 }, { name: 'Senior Secured Debt', amount: 72000000, pct: 39 }, { name: 'Escrow Holdback', amount: 18000000, pct: 10 }, { name: 'Series B Preferred', amount: 47800000, pct: 26 }, { name: 'Common Distribution', amount: 44000000, pct: 23 }], total: 185000000 },
    validation_flags: [{ severity: 'info', field: 'total', message: 'Waterfall total ($185M) matches SPA purchase price' }],
  },
  {
    file_name: 'Wire_Instructions_a16z.pdf',
    file_size: 340000,
    mime_type: 'application/pdf',
    doc_type: 'wire_instructions',
    doc_type_confidence: 0.94,
    page_count: 1,
    extracted_text: 'Wire Transfer Instructions. Beneficiary: Andreessen Horowitz Fund VII. Bank: JPMorgan Chase. ABA/Routing: 021000021. Account: ****8842. SWIFT: CHASUS33. Currency: USD.',
    extracted_fields: { beneficiary: 'Andreessen Horowitz Fund VII', bank_name: 'JPMorgan Chase', routing_number: '021000021', account_last4: '8842', swift: 'CHASUS33', currency: 'USD' },
    validation_flags: [{ severity: 'warning', field: 'address', message: 'Beneficiary address is missing — may be required for international wires' }],
  },
  {
    file_name: 'Board_Resolutions_Northbridge.pdf',
    file_size: 520000,
    mime_type: 'application/pdf',
    doc_type: 'board_consent',
    doc_type_confidence: 0.92,
    page_count: 12,
    extracted_text: 'UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS OF NORTHBRIDGE SOFTWARE, INC. Resolved: That the Board approves the merger with Apex Capital Partners. Resolved: That the officers are authorized to execute the Merger Agreement. Date: January 8, 2026.',
    extracted_fields: { approval_date: 'January 8, 2026', approving_entity: 'Board of Directors', resolution_type: 'Unanimous Written Consent', actions_approved: ['Merger with Apex Capital Partners', 'Execution of Merger Agreement'] },
    validation_flags: [],
  },
];

// ── Simulate text extraction from file ──
function simulateTextExtraction(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('merger') || lower.includes('spa') || lower.includes('agreement')) {
    return 'AGREEMENT AND PLAN OF MERGER. Purchase Price: to be determined. Closing Date: TBD. This agreement outlines the terms and conditions...';
  }
  if (lower.includes('cap') || lower.includes('table')) {
    return 'Cap Table Summary. Shareholder listing with ownership percentages and share classes...';
  }
  if (lower.includes('waterfall') || lower.includes('distribution')) {
    return 'Distribution Waterfall Schedule. Priority tiers and allocation amounts...';
  }
  if (lower.includes('wire') || lower.includes('bank')) {
    return 'Wire Transfer Instructions. Beneficiary and banking details for fund disbursement...';
  }
  return `Document content extracted from ${fileName}. Contains structured data for M&A transaction processing.`;
}

export const DocumentsCover: React.FC = () => {
  const { deals, selectedDealId, setSelectedDealId } = usePIVTStore();
  const { addEvent } = useAuditStore();
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [selectedDoc, setSelectedDoc] = useState<DealDocument | null>(null);
  const [loading, setLoading] = useState(false);

  // Q&A state
  const [qaOpen, setQaOpen] = useState(false);
  const [qaQuery, setQaQuery] = useState('');
  const [qaResponse, setQaResponse] = useState('');
  const [qaLoading, setQaLoading] = useState(false);

  // Load documents from DB on mount
  useEffect(() => {
    loadDocuments();
  }, [selectedDealId]);

  const loadDocuments = async () => {
    const { data } = await supabase
      .from('deal_documents')
      .select('*')
      .eq('deal_id', selectedDealId)
      .order('created_at', { ascending: false }) as any;
    if (data) setDocuments(data);
  };

  // ── Metrics ──
  const metrics = useMemo(() => {
    const total = documents.length;
    const processed = documents.filter(d => d.status === 'processed' || d.status === 'verified').length;
    const pending = documents.filter(d => d.status === 'pending_review' || d.status === 'processing').length;
    const flags = documents.reduce((acc, d) => acc + (d.validation_flags?.length || 0), 0);
    const entities = documents.reduce((acc, d) => acc + Object.keys(d.extracted_fields || {}).length, 0);
    return { total, processed, pending, flags, entities };
  }, [documents]);

  const filteredDocs = useMemo(() => {
    let items = documents;
    if (filter === 'processed') items = items.filter(d => d.status === 'processed' || d.status === 'verified');
    else if (filter === 'pending') items = items.filter(d => d.status === 'pending_review' || d.status === 'processing' || d.status === 'uploading');
    else if (filter === 'verified') items = items.filter(d => d.status === 'verified');
    else if (filter === 'flags') items = items.filter(d => (d.validation_flags?.length || 0) > 0);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(d => d.file_name.toLowerCase().includes(q) || (d.doc_type || '').toLowerCase().includes(q));
    }
    return items;
  }, [documents, filter, searchQuery]);

  // ── Upload a single file ──
  const uploadFile = useCallback(async (file: File) => {
    const tempId = crypto.randomUUID();
    const newDoc: DealDocument = {
      id: tempId,
      deal_id: selectedDealId,
      file_name: file.name,
      file_size: file.size,
      file_path: null,
      mime_type: file.type,
      page_count: 0,
      status: 'uploading',
      doc_type: 'other',
      doc_type_confidence: 0,
      extracted_text: null,
      extracted_fields: {},
      validation_flags: [],
      uploaded_by: 'Current User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDocuments(prev => [newDoc, ...prev]);

    try {
      // 1. Upload to storage
      const filePath = `${selectedDealId}/${tempId}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('deal-documents').upload(filePath, file);

      // 2. Extract text (simulated for non-text files)
      const textContent = simulateTextExtraction(file.name);

      // 3. Insert into DB
      const { data: inserted, error: dbError } = await supabase.from('deal_documents').insert({
        deal_id: selectedDealId,
        file_name: file.name,
        file_size: file.size,
        file_path: filePath,
        mime_type: file.type,
        status: 'processing',
        extracted_text: textContent,
        uploaded_by: 'Current User',
      } as any).select().single() as any;

      if (dbError || !inserted) {
        throw new Error(dbError?.message || 'Failed to insert document');
      }

      // Update local state with real ID
      setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, ...inserted, status: 'processing' } : d));

      // 4. Call AI for classification + extraction
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('document-ai', {
        body: { action: 'classify', documentId: inserted.id, fileName: file.name, textContent },
      });

      if (aiError) {
        console.error('AI classification error:', aiError);
        setDocuments(prev => prev.map(d => d.id === inserted.id ? { ...d, status: 'pending_review' } : d));
      } else if (aiResult?.result) {
        const r = aiResult.result;
        setDocuments(prev => prev.map(d => d.id === inserted.id ? {
          ...d,
          status: 'processed',
          doc_type: r.doc_type,
          doc_type_confidence: r.confidence,
          extracted_fields: r.extracted_fields,
          validation_flags: r.validation_flags || [],
          page_count: r.page_count_estimate || 1,
        } : d));
      }

      // 5. Audit log
      addEvent({
        action: 'DOCUMENT_UPLOADED',
        object_type: 'Document',
        object_id: inserted.id,
        summary: `Document "${file.name}" uploaded and processed`,
        severity: 'info',
        deal_id: selectedDealId,
        actor_type: 'User', actor_id: 'current-user', actor_display_name: 'Current User',
        actor_role: 'Deal Manager', source: 'UI', ip_address: null, user_agent: null,
        correlation_id: null, before_state: null, after_state: { status: 'processed' },
        category: 'user',
      });

      toast.success(`"${file.name}" uploaded and classified`);
      loadDocuments(); // Refresh from DB
    } catch (err: any) {
      console.error('Upload error:', err);
      setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, status: 'failed' } : d));
      toast.error(`Failed to upload "${file.name}"`);
    }
  }, [selectedDealId, addEvent]);

  // ── Drop handler ──
  const { guardEdit } = useEditGuard();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    guardEdit('UPLOAD_DOCUMENT', null, () => {
      Array.from(e.dataTransfer.files).forEach(uploadFile);
    });
  }, [uploadFile, guardEdit]);

  // ── Demo upload ──
  const handleDemoUpload = useCallback(async () => {
    setLoading(true);
    for (let i = 0; i < DEMO_DOCUMENTS.length; i++) {
      const demo = DEMO_DOCUMENTS[i];
      const { data: inserted } = await supabase.from('deal_documents').insert({
        deal_id: selectedDealId,
        file_name: demo.file_name,
        file_size: demo.file_size,
        mime_type: demo.mime_type,
        doc_type: demo.doc_type,
        doc_type_confidence: demo.doc_type_confidence,
        page_count: demo.page_count,
        extracted_text: demo.extracted_text,
        extracted_fields: demo.extracted_fields,
        validation_flags: demo.validation_flags,
        status: 'processed',
        uploaded_by: 'Demo System',
      } as any).select().single() as any;

      if (inserted) {
        addEvent({
          action: 'DOCUMENT_UPLOADED',
          object_type: 'Document',
          object_id: inserted.id,
          summary: `Demo document "${demo.file_name}" ingested — ${DOC_TYPE_LABELS[demo.doc_type]?.label || demo.doc_type}`,
          severity: 'info',
          deal_id: selectedDealId,
          actor_type: 'System', actor_id: null, actor_display_name: 'Demo System',
          actor_role: 'System', source: 'Automation', ip_address: null, user_agent: null,
          correlation_id: null, before_state: null, after_state: { doc_type: demo.doc_type, flags: demo.validation_flags.length },
          category: 'system',
        });
      }
    }
    await loadDocuments();
    setLoading(false);
    toast.success(`${DEMO_DOCUMENTS.length} demo documents ingested with extraction results`);
  }, [selectedDealId, addEvent]);

  // ── Verify / Reject ──
  const handleVerify = useCallback(async (doc: DealDocument) => {
    await supabase.from('deal_documents').update({ status: 'verified' } as any).eq('id', doc.id);
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'verified' as DocStatus } : d));
    addEvent({
      action: 'DOCUMENT_VERIFIED', object_type: 'Document', object_id: doc.id,
      summary: `Document "${doc.file_name}" verified`, severity: 'info', deal_id: selectedDealId,
      actor_type: 'User', actor_id: 'current-user', actor_display_name: 'Current User',
      actor_role: 'Deal Manager', source: 'UI', ip_address: null, user_agent: null,
      correlation_id: null, before_state: { status: doc.status }, after_state: { status: 'verified' }, category: 'compliance',
    });
    toast.success(`"${doc.file_name}" verified`);
  }, [addEvent, selectedDealId]);

  const handleReject = useCallback(async (doc: DealDocument) => {
    await supabase.from('deal_documents').update({ status: 'rejected' } as any).eq('id', doc.id);
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'rejected' as DocStatus } : d));
    addEvent({
      action: 'DOCUMENT_REJECTED', object_type: 'Document', object_id: doc.id,
      summary: `Document "${doc.file_name}" rejected`, severity: 'warning', deal_id: selectedDealId,
      actor_type: 'User', actor_id: 'current-user', actor_display_name: 'Current User',
      actor_role: 'Deal Manager', source: 'UI', ip_address: null, user_agent: null,
      correlation_id: null, before_state: { status: doc.status }, after_state: { status: 'rejected' }, category: 'compliance',
    });
    toast.error(`"${doc.file_name}" rejected`);
  }, [addEvent, selectedDealId]);

  // ── Reprocess ──
  const handleReprocess = useCallback(async (doc: DealDocument) => {
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing' as DocStatus } : d));
    const { data: aiResult } = await supabase.functions.invoke('document-ai', {
      body: { action: 'classify', documentId: doc.id, fileName: doc.file_name, textContent: doc.extracted_text },
    });
    if (aiResult?.result) {
      const r = aiResult.result;
      setDocuments(prev => prev.map(d => d.id === doc.id ? {
        ...d, status: 'processed' as DocStatus, doc_type: r.doc_type, doc_type_confidence: r.confidence,
        extracted_fields: r.extracted_fields, validation_flags: r.validation_flags || [],
      } : d));
    }
    await loadDocuments();
    toast.success(`"${doc.file_name}" reprocessed`);
  }, []);

  // ── Q&A ──
  const handleQA = useCallback(async () => {
    if (!qaQuery.trim()) return;
    setQaLoading(true);
    setQaResponse('');

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'qa',
          question: qaQuery,
          dealId: selectedDealId,
          documents: documents.filter(d => d.status === 'processed' || d.status === 'verified').map(d => ({
            file_name: d.file_name,
            doc_type: d.doc_type,
            extracted_fields: d.extracted_fields,
            validation_flags: d.validation_flags,
            extracted_text: d.extracted_text,
          })),
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) { toast.error('Rate limit exceeded — try again shortly'); setQaLoading(false); return; }
        if (resp.status === 402) { toast.error('AI credits exhausted'); setQaLoading(false); return; }
        throw new Error('Stream failed');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { result += content; setQaResponse(result); }
          } catch { /* partial */ }
        }
      }
    } catch (err) {
      console.error('Q&A error:', err);
      toast.error('Failed to get AI response');
    }
    setQaLoading(false);
  }, [qaQuery, documents, selectedDealId]);

  // ── All flags across docs ──
  const allFlags = useMemo(() =>
    documents.flatMap(d => (d.validation_flags || []).map(f => ({ ...f, docName: d.file_name, docId: d.id }))),
    [documents],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents & Ingestion</h2>
        <div className="flex items-center gap-3">
          <Select value={selectedDealId} onValueChange={setSelectedDealId}>
            <SelectTrigger className="w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.codeName}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={() => setQaOpen(!qaOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${qaOpen ? 'bg-accent text-accent-foreground' : 'border border-border text-foreground hover:bg-muted/40'}`}>
            <MessageSquare className="w-4 h-4" /> Ask Newton
          </button>
          <button onClick={handleDemoUpload} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Demo Upload
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Documents', value: metrics.total, icon: FileText, color: '' },
          { label: 'Processed', value: metrics.processed, icon: CheckCircle2, color: 'text-validated' },
          { label: 'Pending', value: metrics.pending, icon: Clock, color: 'text-discrepancy' },
          { label: 'Validation Flags', value: metrics.flags, icon: AlertTriangle, color: metrics.flags > 0 ? 'text-destructive' : 'text-validated' },
          { label: 'Extracted Fields', value: metrics.entities, icon: Search, color: 'text-accent' },
        ].map(card => (
          <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.color || 'text-muted-foreground'}`} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</p>
            </div>
            <p className={`font-mono text-xl font-semibold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`pivt-card border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${dragOver ? 'border-accent bg-accent/5' : 'border-border'}`}
        onClick={() => guardEdit('UPLOAD_DOCUMENT', null, () => document.getElementById('file-upload-input')?.click())}
      >
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium text-sm">Drag and drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, CSV — auto-classified and extracted by AI</p>
        <input
          id="file-upload-input"
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.csv,.doc,.xls"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) Array.from(e.target.files).forEach(uploadFile);
            e.target.value = '';
          }}
        />
      </div>

      {/* Newton Q&A Panel */}
      <AnimatePresence>
        {qaOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pivt-card p-5 space-y-4 border-l-4 border-accent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-accent" />
                  <h3 className="font-medium text-sm">Newton Document Intelligence</h3>
                </div>
                <button onClick={() => setQaOpen(false)} className="p-1 hover:bg-muted/40 rounded"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about your documents... e.g. 'What is the purchase price?'"
                  value={qaQuery}
                  onChange={(e) => setQaQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQA()}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button onClick={handleQA} disabled={qaLoading || !qaQuery.trim()} className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
                  {qaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {['What is the purchase price in the SPA?', 'Which wires are missing fields?', 'Do waterfall totals match the purchase price?', 'Summarize the escrow terms'].map(q => (
                  <button key={q} onClick={() => { setQaQuery(q); }} className="px-3 py-1.5 rounded-lg bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors">
                    {q}
                  </button>
                ))}
              </div>
              {qaResponse && (
                <div className="p-4 rounded-lg bg-muted/30 prose prose-sm max-w-none text-sm">
                  <ReactMarkdown>{qaResponse}</ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation Flags Banner */}
      {allFlags.filter(f => f.severity === 'warning' || f.severity === 'critical').length > 0 && (
        <motion.div {...fadeInUp} className="pivt-card p-4 border-l-4 border-discrepancy bg-discrepancy/5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-discrepancy" />
            <p className="text-sm font-semibold">Validation Flags Detected</p>
          </div>
          <div className="space-y-1">
            {allFlags.filter(f => f.severity !== 'info').map((flag, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge className={`text-[9px] border-0 ${flag.severity === 'critical' ? 'bg-blocking/10 text-blocking' : 'bg-discrepancy/10 text-discrepancy'}`}>
                  {flag.severity}
                </Badge>
                <span className="text-muted-foreground">{flag.docName}:</span>
                <span>{flag.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Filters + View toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" placeholder="Search documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1">
          {(['all', 'processed', 'pending', 'verified', 'flags'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-accent text-accent-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
              {f === 'all' ? 'All' : f === 'processed' ? 'Processed' : f === 'pending' ? 'Pending' : f === 'verified' ? 'Verified' : 'Flags'}
            </button>
          ))}
        </div>
      </div>

      {/* Document Library */}
      {filteredDocs.length === 0 ? (
        <div className="pivt-card p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-sm">No documents yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload files or click "Demo Upload" to populate sample data</p>
        </div>
      ) : (
        <div className="pivt-card overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/30 grid grid-cols-12 gap-4 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            <span className="col-span-4">Document</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-1">Pages</span>
            <span className="col-span-1">Fields</span>
            <span className="col-span-1">Flags</span>
            <span className="col-span-1">Status</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>
          {filteredDocs.map(doc => {
            const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.processing;
            const StatusIcon = statusCfg.icon;
            const typeInfo = DOC_TYPE_LABELS[doc.doc_type] || DOC_TYPE_LABELS.other;
            const isAnimating = doc.status === 'uploading' || doc.status === 'processing';
            const flagCount = doc.validation_flags?.length || 0;
            const fieldCount = Object.keys(doc.extracted_fields || {}).length;

            return (
              <motion.div key={doc.id} {...fadeInUp} className="p-3 border-b border-border/50 last:border-0 grid grid-cols-12 gap-4 items-center hover:bg-muted/10 transition-colors">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">{(doc.file_size / 1024 / 1024).toFixed(1)} MB · {new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <Badge className="text-[10px] bg-muted/50 text-foreground border-0">{typeInfo.label}</Badge>
                  {doc.doc_type_confidence > 0 && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">{(doc.doc_type_confidence * 100).toFixed(0)}% conf</p>
                  )}
                </div>
                <div className="col-span-1 text-sm font-mono">{doc.page_count || '—'}</div>
                <div className="col-span-1 text-sm font-mono">{fieldCount}</div>
                <div className="col-span-1">
                  {flagCount > 0 ? (
                    <Badge className="text-[10px] bg-discrepancy/10 text-discrepancy border-0">{flagCount}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-1">
                  <Badge className={`text-[10px] ${statusCfg.color} border-0`}>
                    {isAnimating && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                    {statusCfg.label}
                  </Badge>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)} className="p-1.5 rounded-md hover:bg-muted/40 transition-colors" title="View extraction">
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {(doc.status === 'processed' || doc.status === 'pending_review') && (
                    <>
                      <button onClick={() => handleVerify(doc)} className="p-1.5 rounded-md hover:bg-validated/10 transition-colors" title="Verify">
                        <CheckCircle2 className="w-3.5 h-3.5 text-validated" />
                      </button>
                      <button onClick={() => handleReject(doc)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Reject">
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </>
                  )}
                  <button onClick={() => handleReprocess(doc)} className="p-1.5 rounded-md hover:bg-muted/40 transition-colors" title="Reprocess">
                    <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Extraction Detail Panel */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pivt-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Extraction Results — {selectedDoc.file_name}</h3>
                <button onClick={() => setSelectedDoc(null)} className="p-1 hover:bg-muted/40 rounded"><X className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Document Type</p>
                  <p className="text-sm font-medium">{DOC_TYPE_LABELS[selectedDoc.doc_type]?.label || selectedDoc.doc_type}</p>
                  <p className="text-xs text-muted-foreground">{(selectedDoc.doc_type_confidence * 100).toFixed(0)}% confidence</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Pages</p>
                  <p className="text-sm font-medium">{selectedDoc.page_count}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <Badge className={`text-[10px] ${STATUS_CONFIG[selectedDoc.status]?.color} border-0`}>{STATUS_CONFIG[selectedDoc.status]?.label}</Badge>
                </div>
              </div>

              {/* Extracted Fields */}
              {Object.keys(selectedDoc.extracted_fields || {}).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Extracted Fields</p>
                  <div className="space-y-1">
                    {Object.entries(selectedDoc.extracted_fields).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/20 text-sm">
                        <span className="text-xs text-accent font-medium uppercase min-w-[120px]">{key.replace(/_/g, ' ')}</span>
                        <span className="flex-1 font-medium">
                          {typeof value === 'object' ? (
                            <pre className="text-xs font-mono bg-muted/30 p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Flags */}
              {(selectedDoc.validation_flags || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Validation Flags</p>
                  <div className="space-y-1">
                    {selectedDoc.validation_flags.map((flag, i) => (
                      <div key={i} className={`p-2 rounded-lg border-l-3 ${flag.severity === 'critical' ? 'border-blocking bg-blocking/5' : flag.severity === 'warning' ? 'border-discrepancy bg-discrepancy/5' : 'border-accent bg-accent/5'}`}>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[9px] border-0 ${flag.severity === 'critical' ? 'bg-blocking/10 text-blocking' : flag.severity === 'warning' ? 'bg-discrepancy/10 text-discrepancy' : 'bg-accent/10 text-accent'}`}>
                            {flag.severity}
                          </Badge>
                          <span className="text-xs font-medium">{flag.field}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{flag.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Text preview */}
              {selectedDoc.extracted_text && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Text Preview</p>
                  <div className="p-3 rounded-lg bg-muted/20 text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap">
                    {selectedDoc.extracted_text.slice(0, 500)}...
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immutability notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
        <Shield className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">All document events are logged to an immutable audit trail. Classification and extraction powered by AI.</p>
      </div>

      {/* Integration hooks */}
      <div className="flex items-center gap-3">
        <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground opacity-50 cursor-not-allowed" title="Connect DocuSign first">
          <Send className="w-4 h-4" /> Send for Signature
        </button>
        <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground opacity-50 cursor-not-allowed" title="Connect Datasite first">
          <Link2 className="w-4 h-4" /> Push to Data Room
        </button>
      </div>
    </div>
  );
};
