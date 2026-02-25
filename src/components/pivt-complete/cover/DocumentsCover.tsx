import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { useAuditStore } from '@/stores/auditStore';
import { fadeInUp } from '@/lib/animations';
import {
  CheckCircle2, Clock, XCircle, FileText, Upload, Eye,
  AlertTriangle, Loader2, Zap, ChevronDown, ChevronRight,
  Shield, Search, Filter, Send, Link2, FolderOpen,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// ── Types ──
type DocStatus = 'missing' | 'uploaded' | 'pending_review' | 'verified' | 'rejected';

interface ChecklistItem {
  id: string;
  name: string;
  category: string;
  status: DocStatus;
  required: boolean;
  fileName?: string;
  uploadedAt?: string;
  verifiedBy?: string;
}

type FilterType = 'all' | 'verified' | 'pending' | 'missing' | 'required';

// ── Categories ──
const CATEGORIES = [
  { key: 'corporate', label: 'Corporate', icon: FolderOpen },
  { key: 'financial', label: 'Financial', icon: FolderOpen },
  { key: 'legal', label: 'Legal', icon: FolderOpen },
  { key: 'transaction', label: 'Transaction', icon: FolderOpen },
  { key: 'compliance', label: 'Compliance', icon: Shield },
];

// ── Initial Checklist Data ──
const INITIAL_CHECKLIST: ChecklistItem[] = [
  // Corporate
  { id: 'c1', name: 'Certificate of Incorporation', category: 'corporate', status: 'verified', required: true, fileName: 'CertIncorp_DataStream.pdf', uploadedAt: '2026-01-10', verifiedBy: 'Deal Admin' },
  { id: 'c2', name: 'Bylaws', category: 'corporate', status: 'verified', required: true, fileName: 'Bylaws_Current.pdf', uploadedAt: '2026-01-10', verifiedBy: 'Deal Admin' },
  { id: 'c3', name: 'Board Consents', category: 'corporate', status: 'verified', required: true, fileName: 'Board_Resolutions.pdf', uploadedAt: '2026-01-10', verifiedBy: 'Deal Admin' },
  { id: 'c4', name: 'Cap Table', category: 'corporate', status: 'verified', required: true, fileName: 'CapTable_Final.xlsx', uploadedAt: '2026-01-20', verifiedBy: 'Deal Admin' },
  // Financial
  { id: 'f1', name: 'Financial Statements', category: 'financial', status: 'pending_review', required: true, fileName: 'FinStatements_2025.pdf', uploadedAt: '2026-02-01' },
  { id: 'f2', name: 'Tax Returns', category: 'financial', status: 'verified', required: true, fileName: 'Tax_Certificates_Bundle.pdf', uploadedAt: '2026-01-25', verifiedBy: 'Compliance' },
  { id: 'f3', name: 'Debt Schedule', category: 'financial', status: 'missing', required: false },
  // Legal
  { id: 'l1', name: 'Material Contracts', category: 'legal', status: 'pending_review', required: true, fileName: 'Material_Contracts_Summary.pdf', uploadedAt: '2026-02-05' },
  { id: 'l2', name: 'Employment Agreements', category: 'legal', status: 'missing', required: true },
  { id: 'l3', name: 'IP Assignments', category: 'legal', status: 'missing', required: true },
  // Transaction
  { id: 't1', name: 'Stock Purchase Agreement', category: 'transaction', status: 'verified', required: true, fileName: 'Merger_Agreement_v4.pdf', uploadedAt: '2026-01-15', verifiedBy: 'Buyer Counsel' },
  { id: 't2', name: 'Disclosure Schedules', category: 'transaction', status: 'pending_review', required: true, fileName: 'Disclosure_Schedules_Draft.pdf', uploadedAt: '2026-02-08' },
  { id: 't3', name: 'Side Letters', category: 'transaction', status: 'missing', required: false },
  { id: 't4', name: 'Escrow Agreement', category: 'transaction', status: 'verified', required: true, fileName: 'Escrow_Agreement.pdf', uploadedAt: '2026-01-18', verifiedBy: 'Escrow Agent' },
  // Compliance
  { id: 'k1', name: 'KYC Package', category: 'compliance', status: 'verified', required: true, fileName: 'KYC_Package_Sequoia.pdf', uploadedAt: '2026-01-22', verifiedBy: 'Compliance' },
  { id: 'k2', name: 'Wire Instructions', category: 'compliance', status: 'pending_review', required: true, fileName: 'Wire_Instructions_a16z.pdf', uploadedAt: '2026-02-05' },
];

// ── Classification helpers ──
const FILENAME_PATTERNS: Record<string, { category: string; name: string }> = {
  'cap': { category: 'corporate', name: 'Cap Table' },
  'bylaws': { category: 'corporate', name: 'Bylaws' },
  'board': { category: 'corporate', name: 'Board Consents' },
  'cert': { category: 'corporate', name: 'Certificate of Incorporation' },
  'financial': { category: 'financial', name: 'Financial Statements' },
  'tax': { category: 'financial', name: 'Tax Returns' },
  'debt': { category: 'financial', name: 'Debt Schedule' },
  'contract': { category: 'legal', name: 'Material Contracts' },
  'employment': { category: 'legal', name: 'Employment Agreements' },
  'ip': { category: 'legal', name: 'IP Assignments' },
  'spa': { category: 'transaction', name: 'Stock Purchase Agreement' },
  'merger': { category: 'transaction', name: 'Stock Purchase Agreement' },
  'disclosure': { category: 'transaction', name: 'Disclosure Schedules' },
  'escrow': { category: 'transaction', name: 'Escrow Agreement' },
  'side': { category: 'transaction', name: 'Side Letters' },
  'kyc': { category: 'compliance', name: 'KYC Package' },
  'wire': { category: 'compliance', name: 'Wire Instructions' },
  'waterfall': { category: 'financial', name: 'Financial Statements' },
};

function classifyFile(fileName: string): { category: string; name: string } | null {
  const lower = fileName.toLowerCase();
  for (const [pattern, result] of Object.entries(FILENAME_PATTERNS)) {
    if (lower.includes(pattern)) return result;
  }
  return null;
}

// ── Status config ──
const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  missing: { label: 'Missing', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  uploaded: { label: 'Uploaded', color: 'bg-accent/10 text-accent', icon: Upload },
  pending_review: { label: 'Pending Review', color: 'bg-discrepancy/10 text-discrepancy', icon: Clock },
  verified: { label: 'Verified', color: 'bg-validated/10 text-validated', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-blocking/10 text-blocking', icon: XCircle },
};

export const DocumentsCover: React.FC = () => {
  const { deals, selectedDealId, setSelectedDealId } = usePIVTStore();
  const { addEvent } = useAuditStore();
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // ── Metrics ──
  const metrics = useMemo(() => {
    const total = checklist.length;
    const verified = checklist.filter(d => d.status === 'verified').length;
    const pending = checklist.filter(d => d.status === 'pending_review' || d.status === 'uploaded').length;
    const missingRequired = checklist.filter(d => d.required && (d.status === 'missing')).length;
    return { total, verified, pending, missingRequired };
  }, [checklist]);

  // ── Filter + search ──
  const filteredChecklist = useMemo(() => {
    let items = checklist;
    if (filter === 'verified') items = items.filter(i => i.status === 'verified');
    else if (filter === 'pending') items = items.filter(i => i.status === 'pending_review' || i.status === 'uploaded');
    else if (filter === 'missing') items = items.filter(i => i.status === 'missing');
    else if (filter === 'required') items = items.filter(i => i.required);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.fileName || '').toLowerCase().includes(q));
    }
    return items;
  }, [checklist, filter, searchQuery]);

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Upload handler ──
  const handleUploadToItem = useCallback((itemId: string, fileName: string) => {
    setUploading(itemId);
    setTimeout(() => {
      setChecklist(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: 'pending_review', fileName, uploadedAt: new Date().toISOString().split('T')[0] } : item
      ));
      setUploading(null);
      addEvent({
        action: 'DOCUMENT_UPLOADED',
        object_type: 'Document',
        object_id: itemId,
        summary: `Document "${fileName}" uploaded`,
        severity: 'info',
        deal_id: selectedDealId,
        actor_type: 'User', actor_id: 'current-user', actor_display_name: 'Current User',
        actor_role: 'Deal Manager', source: 'UI', ip_address: null, user_agent: null,
        correlation_id: null, before_state: { status: 'missing' }, after_state: { status: 'pending_review' },
        category: 'user',
      });
      toast.success(`"${fileName}" uploaded — pending review`);
    }, 1200);
  }, [addEvent, selectedDealId]);

  // ── Drop zone handler ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach(file => {
      const classification = classifyFile(file.name);
      if (classification) {
        const match = checklist.find(
          item => item.name === classification.name && item.category === classification.category && item.status === 'missing'
        );
        if (match) {
          handleUploadToItem(match.id, file.name);
          return;
        }
      }
      // Add as new unclassified → prompt user
      const newId = Math.random().toString(36).slice(2, 8);
      const newItem: ChecklistItem = {
        id: newId,
        name: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
        category: classification?.category || 'corporate',
        status: 'pending_review',
        required: false,
        fileName: file.name,
        uploadedAt: new Date().toISOString().split('T')[0],
      };
      setChecklist(prev => [...prev, newItem]);
      addEvent({
        action: 'DOCUMENT_UPLOADED',
        object_type: 'Document',
        object_id: newId,
        summary: `New document "${file.name}" uploaded and auto-classified`,
        severity: 'info',
        deal_id: selectedDealId,
        actor_type: 'User', actor_id: 'current-user', actor_display_name: 'Current User',
        actor_role: 'Deal Manager', source: 'UI', ip_address: null, user_agent: null,
        correlation_id: null, before_state: null, after_state: { status: 'pending_review' },
        category: 'user',
      });
      toast.success(`"${file.name}" uploaded and classified as ${classification?.name || 'Uncategorized'}`);
    });
  }, [checklist, handleUploadToItem, addEvent, selectedDealId]);

  // ── Verify ──
  const handleVerify = useCallback((itemId: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, status: 'verified', verifiedBy: 'Current User' } : item
    ));
    const item = checklist.find(i => i.id === itemId);
    addEvent({
      action: 'DOCUMENT_VERIFIED',
      object_type: 'Document',
      object_id: itemId,
      summary: `Document "${item?.name}" marked as verified`,
      severity: 'info',
      deal_id: selectedDealId,
      actor_type: 'User', actor_id: 'current-user', actor_display_name: 'Current User',
      actor_role: 'Deal Manager', source: 'UI', ip_address: null, user_agent: null,
      correlation_id: null, before_state: { status: 'pending_review' }, after_state: { status: 'verified' },
      category: 'compliance',
    });
    toast.success(`"${item?.name}" verified`);
  }, [checklist, addEvent, selectedDealId]);

  // ── Reject ──
  const handleReject = useCallback((itemId: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, status: 'rejected' } : item
    ));
    const item = checklist.find(i => i.id === itemId);
    addEvent({
      action: 'DOCUMENT_REJECTED',
      object_type: 'Document',
      object_id: itemId,
      summary: `Document "${item?.name}" rejected`,
      severity: 'warning',
      deal_id: selectedDealId,
      actor_type: 'User', actor_id: 'current-user', actor_display_name: 'Current User',
      actor_role: 'Deal Manager', source: 'UI', ip_address: null, user_agent: null,
      correlation_id: null, before_state: { status: 'pending_review' }, after_state: { status: 'rejected' },
      category: 'compliance',
    });
    toast.error(`"${item?.name}" rejected`);
  }, [checklist, addEvent, selectedDealId]);

  // ── Demo upload ──
  const handleDemoUpload = () => {
    const missingItems = checklist.filter(i => i.status === 'missing');
    if (missingItems.length === 0) {
      toast.info('All documents already uploaded');
      return;
    }
    missingItems.slice(0, 3).forEach((item, i) => {
      setTimeout(() => {
        handleUploadToItem(item.id, `${item.name.replace(/\s/g, '_')}.pdf`);
      }, i * 600);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents & Ingestion</h2>
        <div className="flex items-center gap-3">
          <Select value={selectedDealId} onValueChange={setSelectedDealId}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {deals.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.codeName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={handleDemoUpload} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
            <Zap className="w-4 h-4" /> Demo Upload
          </button>
        </div>
      </div>

      {/* Missing Required Banner */}
      {metrics.missingRequired > 0 && (
        <motion.div {...fadeInUp} className="pivt-card p-4 border-l-4 border-destructive bg-destructive/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">Missing required documents</p>
              <p className="text-xs text-muted-foreground">{metrics.missingRequired} required document(s) have not been uploaded yet.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: metrics.total, icon: FileText, color: '' },
          { label: 'Verified', value: metrics.verified, icon: CheckCircle2, color: 'text-validated' },
          { label: 'Pending Review', value: metrics.pending, icon: Clock, color: 'text-discrepancy' },
          { label: 'Missing Required', value: metrics.missingRequired, icon: AlertTriangle, color: metrics.missingRequired > 0 ? 'text-destructive' : 'text-validated' },
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
        className={`pivt-card border-2 border-dashed p-10 text-center transition-colors ${dragOver ? 'border-accent bg-accent/5' : 'border-border'}`}
      >
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium text-sm">Drag and drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, CSV — auto-classified by document type</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'verified', 'pending', 'missing', 'required'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-accent text-accent-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
            >
              {f === 'all' ? 'All' : f === 'verified' ? 'Verified' : f === 'pending' ? 'Pending' : f === 'missing' ? 'Missing' : 'Required'}
            </button>
          ))}
        </div>
      </div>

      {/* Append-only notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
        <Shield className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">Document verification events are logged to an immutable audit trail.</p>
      </div>

      {/* Structured Categories */}
      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const catItems = filteredChecklist.filter(i => i.category === cat.key);
          if (catItems.length === 0) return null;
          const expanded = expandedCategories.has(cat.key);
          const verifiedCount = catItems.filter(i => i.status === 'verified').length;

          return (
            <div key={cat.key} className="pivt-card overflow-hidden">
              <button
                onClick={() => toggleCategory(cat.key)}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/20 transition-colors"
              >
                {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <cat.icon className="w-4 h-4 text-accent" />
                <span className="font-medium text-sm flex-1 text-left">{cat.label}</span>
                <span className="text-xs text-muted-foreground">{verifiedCount}/{catItems.length} verified</span>
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border">
                      {catItems.map(item => {
                        const statusCfg = STATUS_CONFIG[item.status];
                        const StatusIcon = statusCfg.icon;
                        const isUploading = uploading === item.id;

                        return (
                          <div key={item.id} className="px-4 py-3 border-b border-border/50 last:border-0 flex items-center gap-3 hover:bg-muted/10 transition-colors">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                {item.required && <span className="text-[9px] font-semibold text-destructive uppercase">Required</span>}
                              </div>
                              {item.fileName && (
                                <p className="text-xs text-muted-foreground truncate">{item.fileName} · {item.uploadedAt}</p>
                              )}
                            </div>

                            {/* Status badge */}
                            <Badge className={`text-[10px] ${statusCfg.color} border-0`}>
                              {isUploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <StatusIcon className="w-3 h-3 mr-1" />}
                              {isUploading ? 'Uploading...' : statusCfg.label}
                            </Badge>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              {item.status === 'missing' && (
                                <label className="p-1.5 rounded-md hover:bg-muted/40 cursor-pointer transition-colors" title="Upload">
                                  <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleUploadToItem(item.id, f.name);
                                    }}
                                  />
                                </label>
                              )}
                              {item.status === 'pending_review' && (
                                <>
                                  <button onClick={() => handleVerify(item.id)} className="p-1.5 rounded-md hover:bg-validated/10 transition-colors" title="Mark as Verified">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-validated" />
                                  </button>
                                  <button onClick={() => handleReject(item.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Reject">
                                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                                  </button>
                                </>
                              )}
                              {item.fileName && (
                                <button className="p-1.5 rounded-md hover:bg-muted/40 transition-colors" title="View">
                                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Integration Hooks */}
      <div className="flex items-center gap-3">
        <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground opacity-50 cursor-not-allowed" title="Connect DocuSign integration first">
          <Send className="w-4 h-4" /> Send for Signature
        </button>
        <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground opacity-50 cursor-not-allowed" title="Connect Datasite integration first">
          <Link2 className="w-4 h-4" /> Push to Data Room
        </button>
      </div>
    </div>
  );
};
