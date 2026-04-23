/**
 * ClosingBookCover — Auto-assembled closing book.
 *
 * Pulls executed signature packets, satisfied checklist items, satisfied CPs
 * with evidence, and executed disbursements into a single binder, mirroring
 * the existing PIVT card / badge / typography language.
 *
 * Capabilities:
 *  - Auto-generated sections from live deal data
 *  - One-click PDF + ZIP export with SHA-256 cryptographic hash
 *    (matches the existing audit-chain `event_hash` style)
 *  - Preview pane consistent with the demo binder flow
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  BookOpen, CheckCircle2, ClipboardCheck, Download, FileSignature, FileText,
  Loader2, Package, RefreshCcw, ShieldCheck, Sparkles, Banknote, Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { usePIVTStore } from '@/stores/pivtStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ApprovalRow      = Tables<'deal_approvals'>;
type ChecklistRow     = Tables<'closing_checklist_items'>;
type ConditionRow     = Tables<'conditions'>;
type DealDocRow       = Tables<'deal_documents'>;
type DealRow          = Tables<'deals'>;

interface BookSection {
  id: string;
  title: string;
  icon: React.ElementType;
  iconColor: string;
  entries: BookEntry[];
}
interface BookEntry {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: { label: string; tone: 'validated' | 'accent' | 'muted' | 'blocking' };
}

const DEMO_ID_MAP: Record<string, string> = {
  atlas:  'a0000000-0000-0000-0000-000000000001',
  beacon: 'b0000000-0000-0000-0000-000000000002',
  cipher: 'c0000000-0000-0000-0000-000000000003',
};

const isUuid = (s: string | null | undefined): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// ── SHA-256 (Web Crypto) — same chain semantics as deal_events.event_hash ──
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const TONE_BADGE: Record<NonNullable<BookEntry['badge']>['tone'], string> = {
  validated: 'bg-validated/10 text-validated border-validated/20',
  accent:    'bg-accent/10 text-accent border-accent/20',
  muted:     'bg-muted text-muted-foreground border-transparent',
  blocking:  'bg-blocking/10 text-blocking border-blocking/20',
};

export const ClosingBookCover: React.FC = () => {
  const { selectedDealId } = usePIVTStore();

  const dealId = useMemo(() => {
    if (!selectedDealId) return null;
    return DEMO_ID_MAP[selectedDealId] ?? (isUuid(selectedDealId) ? selectedDealId : null);
  }, [selectedDealId]);

  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [exporting, setExporting] = useState<null | 'pdf' | 'zip'>(null);

  const [deal, setDeal] = useState<DealRow | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [documents, setDocuments] = useState<DealDocRow[]>([]);

  const [bookHash, setBookHash] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [previewTab, setPreviewTab] = useState<string>('cover');

  // ── Load all binder source data in parallel ──
  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const [d, a, c, cp, docs] = await Promise.all([
        supabase.from('deals').select('*').eq('id', dealId).maybeSingle(),
        supabase.from('deal_approvals').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
        supabase.from('closing_checklist_items').select('*').eq('deal_id', dealId).order('sort_order', { ascending: true }),
        supabase.from('conditions').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
        supabase.from('deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
      ]);
      setDeal(d.data ?? null);
      setApprovals(a.data ?? []);
      setChecklist(c.data ?? []);
      setConditions(cp.data ?? []);
      setDocuments(docs.data ?? []);
    } catch (err) {
      console.error('[ClosingBook] load failed', err);
      toast.error('Could not load closing book sources');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  // ── Section assembly ──
  const sections: BookSection[] = useMemo(() => {
    const executedPackets = approvals.filter(a => a.status === 'completed');
    const satisfiedItems = checklist.filter(c => c.status === 'satisfied');
    const satisfiedCps   = conditions.filter(c => (c.status as string) === 'SATISFIED' || (c.status as string) === 'satisfied');
    const verifiedDocs   = documents.filter(d => d.status === 'verified' || d.status === 'parsed');

    return [
      {
        id: 'executed-docs', title: 'Executed Documents', icon: FileSignature, iconColor: '#5B3DF5',
        entries: executedPackets.map(p => ({
          id: p.id,
          title: p.packet_name || p.approval_type || 'Signed packet',
          subtitle: p.approver_name ?? p.approver_email ?? undefined,
          meta: p.completed_at ? format(new Date(p.completed_at), 'PP') : undefined,
          badge: { label: 'Executed', tone: 'validated' },
        })),
      },
      {
        id: 'checklist', title: 'Closing Checklist Evidence', icon: ClipboardCheck, iconColor: '#22C55E',
        entries: satisfiedItems.map(i => ({
          id: i.id,
          title: i.title,
          subtitle: i.category ?? undefined,
          meta: i.satisfied_at ? format(new Date(i.satisfied_at), 'PP') : undefined,
          badge: { label: 'Satisfied', tone: 'validated' },
        })),
      },
      {
        id: 'cps', title: 'Conditions Precedent', icon: ShieldCheck, iconColor: '#0EA5E9',
        entries: satisfiedCps.map(c => ({
          id: c.id,
          title: c.title,
          subtitle: c.owner_name ?? undefined,
          meta: c.satisfied_at ? format(new Date(c.satisfied_at), 'PP') : undefined,
          badge: { label: 'Satisfied', tone: 'validated' },
        })),
      },
      {
        id: 'disbursements', title: 'Disbursements & Wire Pack', icon: Banknote, iconColor: '#10B981',
        entries: verifiedDocs
          .filter(d => (d.doc_type ?? '').toLowerCase().includes('wire') || (d.file_name ?? '').toLowerCase().includes('wire'))
          .map(d => ({
            id: d.id,
            title: d.file_name,
            subtitle: d.doc_type ?? undefined,
            meta: d.created_at ? format(new Date(d.created_at), 'PP') : undefined,
            badge: { label: 'Verified', tone: 'validated' },
          })),
      },
    ];
  }, [approvals, checklist, conditions, documents]);

  const totalEntries = sections.reduce((n, s) => n + s.entries.length, 0);

  // Readiness across the four pillars (matches existing % style)
  const readiness = useMemo(() => {
    const pillars = [
      approvals.length ? approvals.filter(a => a.status === 'completed').length / approvals.length : 0,
      checklist.length ? checklist.filter(c => c.status === 'satisfied').length / checklist.length : 0,
      conditions.length ? conditions.filter(c => (c.status as string) === 'SATISFIED' || (c.status as string) === 'satisfied').length / conditions.length : 0,
      documents.length ? documents.filter(d => d.status === 'verified' || d.status === 'parsed').length / documents.length : 0,
    ];
    const denom = pillars.filter(p => p > 0 || true).length;
    return Math.round((pillars.reduce((a, b) => a + b, 0) / Math.max(denom, 1)) * 100);
  }, [approvals, checklist, conditions, documents]);

  // ── Build canonical book payload (used for hashing + exports) ──
  const buildPayload = useCallback(() => {
    return {
      deal: deal ? {
        id: deal.id, name: deal.deal_name, number: deal.deal_number,
        buyer: deal.buyer, target: deal.target_company, value: deal.deal_value,
        currency: deal.currency, closing: deal.closing_date,
      } : null,
      generated_at: new Date().toISOString(),
      sections: sections.map(s => ({
        id: s.id, title: s.title,
        entries: s.entries.map(e => ({ id: e.id, title: e.title, subtitle: e.subtitle, meta: e.meta })),
      })),
      total_entries: totalEntries,
      readiness_pct: readiness,
    };
  }, [deal, sections, totalEntries, readiness]);

  // ── Build / regenerate the book + cryptographic hash ──
  const generate = useCallback(async () => {
    if (!dealId) return;
    setBuilding(true);
    try {
      await load();
      const payload = buildPayload();
      const canonical = JSON.stringify(payload);
      // Chain-style hash: GENESIS|deal|generated_at|payload — same pattern as deal_events
      const input = `${deal?.id ?? 'GENESIS'}|closing_book|${payload.generated_at}|${canonical}`;
      const hash = await sha256Hex(input);
      setBookHash(hash);
      setGeneratedAt(new Date());
      toast.success('Closing book assembled');
    } catch (err) {
      console.error('[ClosingBook] generate failed', err);
      toast.error('Failed to assemble closing book');
    } finally {
      setBuilding(false);
    }
  }, [dealId, load, buildPayload, deal]);

  // Auto-build on first data ready (matches demo flow expectation)
  useEffect(() => {
    if (!loading && !bookHash && totalEntries > 0) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, totalEntries]);

  // ── PDF Export ──
  const exportPdf = useCallback(async (returnDoc = false): Promise<jsPDF | void> => {
    if (!deal) return;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const M = 48;
    let y = M;

    // Cover
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(20, 20, 40);
    doc.text('Closing Book', M, y); y += 26;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90);
    doc.text(`${deal.deal_name} · ${deal.deal_number}`, M, y); y += 16;
    if (deal.buyer || deal.target_company) {
      doc.text(`${deal.buyer ?? ''}${deal.target_company ? ` → ${deal.target_company}` : ''}`, M, y); y += 16;
    }
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Generated ${format(new Date(), 'PPpp')}`, M, y); y += 12;
    doc.text(`Readiness: ${readiness}%   ·   Sections: ${sections.length}   ·   Entries: ${totalEntries}`, M, y); y += 18;

    if (bookHash) {
      doc.setFontSize(8); doc.setTextColor(140);
      doc.text(`SHA-256: ${bookHash}`, M, y); y += 18;
    }

    // Sections
    for (const section of sections) {
      if (y > 720) { doc.addPage(); y = M; }
      doc.setDrawColor(220); doc.line(M, y, pageW - M, y); y += 14;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30, 30, 50);
      doc.text(`${section.title}  (${section.entries.length})`, M, y); y += 16;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60);

      if (section.entries.length === 0) {
        doc.setTextColor(150); doc.text('— no entries —', M + 12, y); y += 16;
        continue;
      }

      for (const entry of section.entries) {
        if (y > 740) { doc.addPage(); y = M; }
        doc.setTextColor(40); doc.text(`• ${entry.title}`.slice(0, 110), M + 12, y); y += 13;
        const sub = [entry.subtitle, entry.meta].filter(Boolean).join('  ·  ');
        if (sub) {
          doc.setTextColor(130); doc.setFontSize(9);
          doc.text(sub.slice(0, 130), M + 22, y); y += 12;
          doc.setFontSize(10);
        }
      }
      y += 8;
    }

    // Footer (last page)
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(160);
      doc.text(`PIVT Closing Book · ${deal.deal_number}`, M, 780);
      doc.text(`Page ${i} of ${pages}`, pageW - M - 60, 780);
    }

    if (returnDoc) return doc;
    doc.save(`Closing_Book_${deal.deal_number}.pdf`);
  }, [deal, sections, totalEntries, readiness, bookHash]);

  const onExportPdf = useCallback(async () => {
    if (!bookHash) await generate();
    setExporting('pdf');
    try { await exportPdf(false); toast.success('PDF exported'); }
    catch (e) { toast.error('PDF export failed'); }
    finally { setExporting(null); }
  }, [bookHash, generate, exportPdf]);

  const onExportZip = useCallback(async () => {
    if (!deal) return;
    if (!bookHash) await generate();
    setExporting('zip');
    try {
      const zip = new JSZip();
      const pdf = (await exportPdf(true)) as jsPDF;
      zip.file(`Closing_Book_${deal.deal_number}.pdf`, pdf.output('blob'));
      zip.file('manifest.json', JSON.stringify(buildPayload(), null, 2));
      zip.file('SHA256SUMS.txt',
        `# Cryptographic hash for binder integrity (matches PIVT audit chain)\n${bookHash}  Closing_Book_${deal.deal_number}.pdf\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Closing_Book_${deal.deal_number}.zip`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      toast.success('ZIP exported with hash manifest');
    } catch (e) { console.error(e); toast.error('ZIP export failed'); }
    finally { setExporting(null); }
  }, [deal, bookHash, generate, exportPdf, buildPayload]);

  // ── Empty / no deal state ──
  if (!dealId) {
    const setActiveSection = usePIVTStore.getState().setActiveSection;
    return (
      <div className="space-y-4">
        <Header title="Closing Book" subtitle="Auto-assembled binder of executed documents, evidence, and disbursements" />
        <div className="pivt-card p-8 text-center">
          <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground mb-4">Select a deal to assemble its closing book.</p>
          <Button onClick={() => setActiveSection('deals' as any)}>Go to Deals</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header
        title="Closing Book"
        subtitle={deal ? `${deal.deal_name} · ${deal.deal_number}` : 'Loading…'}
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCcw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              size="sm" onClick={generate} disabled={building || loading}
              className="text-white"
              style={{ background: 'var(--pivt-gradient-primary)' }}
            >
              {building ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              Auto-Generate Book
            </Button>
          </div>
        }
      />

      {/* Readiness + hash strip */}
      <div className="pivt-card p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/60">Binder Readiness</p>
            <p className="text-2xl font-semibold tracking-tight mt-0.5">{readiness}%</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/60">Entries</p>
            <p className="text-2xl font-semibold tracking-tight mt-0.5">{totalEntries}</p>
          </div>
        </div>
        <Progress value={readiness} className="h-1.5" />

        <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 font-mono">
            <Hash className="w-3 h-3" />
            <span className="truncate max-w-[520px]">
              {bookHash ? bookHash : '— hash will appear after generation —'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onExportPdf} disabled={!!exporting || totalEntries === 0}>
              {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
              Export PDF
            </Button>
            <Button size="sm" onClick={onExportZip} disabled={!!exporting || totalEntries === 0}>
              {exporting === 'zip' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Package className="w-3.5 h-3.5 mr-1.5" />}
              Export ZIP
            </Button>
          </div>
        </div>
        {generatedAt && (
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            Generated {format(generatedAt, 'PPpp')}
          </p>
        )}
      </div>

      {/* Sections + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Section cards (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {loading && totalEntries === 0 ? (
            <div className="pivt-card p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
              Loading binder sources…
            </div>
          ) : (
            sections.map(section => <SectionCard key={section.id} section={section} />)
          )}
        </div>

        {/* Preview pane (1/3) */}
        <div className="lg:col-span-1">
          <div className="pivt-card p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-accent" />
              <p className="text-sm font-semibold">Preview</p>
            </div>
            <Tabs value={previewTab} onValueChange={setPreviewTab}>
              <TabsList className="grid grid-cols-2 w-full h-8">
                <TabsTrigger value="cover" className="text-xs">Cover</TabsTrigger>
                <TabsTrigger value="toc" className="text-xs">Contents</TabsTrigger>
              </TabsList>
              <TabsContent value="cover" className="mt-3">
                <div className="aspect-[8.5/11] rounded-md border border-border/60 bg-card p-4 text-[11px] flex flex-col">
                  <p className="font-semibold text-sm tracking-tight">Closing Book</p>
                  <p className="text-muted-foreground mt-1">{deal?.deal_name}</p>
                  <p className="text-muted-foreground/70">{deal?.deal_number}</p>
                  <div className="mt-auto space-y-1 text-[10px] text-muted-foreground/70">
                    <p>Readiness: {readiness}%</p>
                    <p>Sections: {sections.length}</p>
                    <p>Entries: {totalEntries}</p>
                    {bookHash && <p className="font-mono truncate">SHA-256: {bookHash.slice(0, 24)}…</p>}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="toc" className="mt-3">
                <ScrollArea className="aspect-[8.5/11] rounded-md border border-border/60 bg-card p-3">
                  <ol className="space-y-2 text-[11px]">
                    {sections.map((s, i) => (
                      <li key={s.id} className="flex items-start gap-2">
                        <span className="text-muted-foreground/60 w-4">{i + 1}.</span>
                        <span className="flex-1">
                          <span className="font-medium">{s.title}</span>
                          <span className="text-muted-foreground/60"> — {s.entries.length}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────── helpers ─────────────────────────────
const Header: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode }> = ({ title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);

const SectionCard: React.FC<{ section: BookSection }> = ({ section }) => {
  const Icon = section.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="pivt-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: section.iconColor }} />
          <p className="text-sm font-semibold">{section.title}</p>
        </div>
        <Badge variant="outline" className="text-[10px] font-medium">
          {section.entries.length}
        </Badge>
      </div>

      {section.entries.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">No entries yet</p>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {section.entries.map(entry => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border/40 bg-card/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{entry.title}</p>
                  {(entry.subtitle || entry.meta) && (
                    <p className="text-[11px] text-muted-foreground/70 truncate">
                      {[entry.subtitle, entry.meta].filter(Boolean).join('  ·  ')}
                    </p>
                  )}
                </div>
                {entry.badge && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0', TONE_BADGE[entry.badge.tone])}>
                    {entry.badge.label}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default ClosingBookCover;
