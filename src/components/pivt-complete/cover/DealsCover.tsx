import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar as CalendarIconLucide, Hash, Users, FileText, Table, ChevronRight, Eye, Briefcase, Copy, TrendingUp, Trash2, X, Sparkles, Upload, Wand2, AlertTriangle, CheckCircle2, Clock, Brain, ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { useDealOperations, RealDeal, DealTemplate, DealSummaryCounts } from '@/hooks/useDealOperations';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type PortfolioEvent = {
  id: string;
  dealName: string;
  action: string;
  timestamp: string;
};

const DEAL_TYPES = [
  'Private Company Share Purchase',
  'Private Equity Acquisition',
  'Asset Acquisition',
  'Merger',
  'Leveraged Buyout',
  'Growth Equity',
  'Venture Investment',
  'Secondary Transaction',
  'Other',
];

const CURRENCY_GROUPS = [
  { label: 'Major Currencies', items: [
    { value: 'USD', label: 'USD — US Dollar (United States)' },
    { value: 'EUR', label: 'EUR — Euro (European Union)' },
    { value: 'GBP', label: 'GBP — British Pound (United Kingdom)' },
  ]},
  { label: 'Asia-Pacific', items: [
    { value: 'JPY', label: 'JPY — Japanese Yen (Japan)' },
    { value: 'CNY', label: 'CNY — Chinese Yuan (China)' },
    { value: 'AUD', label: 'AUD — Australian Dollar (Australia)' },
    { value: 'SGD', label: 'SGD — Singapore Dollar (Singapore)' },
    { value: 'HKD', label: 'HKD — Hong Kong Dollar (Hong Kong)' },
    { value: 'KRW', label: 'KRW — South Korean Won (South Korea)' },
    { value: 'INR', label: 'INR — Indian Rupee (India)' },
  ]},
  { label: 'Americas', items: [
    { value: 'CAD', label: 'CAD — Canadian Dollar (Canada)' },
    { value: 'BRL', label: 'BRL — Brazilian Real (Brazil)' },
    { value: 'MXN', label: 'MXN — Mexican Peso (Mexico)' },
  ]},
  { label: 'Europe & Other', items: [
    { value: 'CHF', label: 'CHF — Swiss Franc (Switzerland)' },
    { value: 'SEK', label: 'SEK — Swedish Krona (Sweden)' },
    { value: 'NOK', label: 'NOK — Norwegian Krone (Norway)' },
    { value: 'DKK', label: 'DKK — Danish Krone (Denmark)' },
    { value: 'PLN', label: 'PLN — Polish Zloty (Poland)' },
    { value: 'AED', label: 'AED — UAE Dirham (UAE)' },
    { value: 'ZAR', label: 'ZAR — South African Rand (South Africa)' },
  ]},
];

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'active', bg: 'bg-accent/10', text: 'text-accent' },
  ready: { label: 'ready', bg: 'bg-validated/10', text: 'text-validated' },
  setup: { label: 'setup', bg: 'bg-muted', text: 'text-muted-foreground' },
  draft: { label: 'draft', bg: 'bg-muted', text: 'text-muted-foreground' },
  closing: { label: 'closing', bg: 'bg-discrepancy/10', text: 'text-discrepancy' },
  closed: { label: 'closed', bg: 'bg-validated/10', text: 'text-validated' },
  settled: { label: 'settled', bg: 'bg-validated/10', text: 'text-validated' },
};

const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

const PROGRESS_BAR_STYLE = 'bg-gradient-to-r from-accent to-[hsl(217,100%,55%)]';

// Demo narrative metadata — enrichment that isn't stored in the DB
// All counts (parties, docs, cap table) are now derived from fetchDealSummaries.
const DEMO_NARRATIVE: Record<string, { buyerBorrower: string; sector: string; dealKindTags: string[]; funded: number; fundedPct: number }> = {
  atlas_demo: {
    buyerBorrower: 'Apex Capital Partners', sector: 'Enterprise SaaS',
    dealKindTags: ['M&A', 'Acquisition'],
    funded: 109_700_000, fundedPct: 77,
  },
  beacon_demo: {
    buyerBorrower: 'Meridian Holdings', sector: 'Cybersecurity',
    dealKindTags: ['M&A', 'Acquisition'],
    funded: 0, fundedPct: 0,
  },
  cipher_demo: {
    buyerBorrower: 'Titan Strategic Group', sector: 'Artificial Intelligence',
    dealKindTags: ['M&A', 'Acquisition'],
    funded: 0, fundedPct: 0,
  },
};

// ── Deal Card (unified for both demo and private deals) ──
const DealCard: React.FC<{
  deal: RealDeal;
  summary?: DealSummaryCounts;
  isDemo: boolean;
  onView: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
  onDelete?: () => void;
}> = ({ deal, summary, isDemo, onView, onDuplicate, duplicating, onDelete }) => {
  const sts = STATUS_LABELS[deal.status] || STATUS_LABELS.draft;
  const letter = deal.deal_name.charAt(0).toUpperCase();
  const seedKey = (deal as any).seed_key as string | null;
  const narrative = isDemo && seedKey ? DEMO_NARRATIVE[seedKey] : null;

  // All counts derived from DB summaries — same source for demo and live deals
  const partiesCount = summary?.partiesCount ?? 0;
  const docsCount = summary?.docsCount ?? 0;
  const capTableCount = summary?.capTableCount ?? 0;
  const tierCount = summary?.waterfallTiers ?? 0;
  const sector = narrative?.sector || (deal as any).sector || '—';
  const buyerBorrower = narrative?.buyerBorrower || (deal as any).buyer || '—';
  const dealType = (deal as any).deal_type || '';
  const dealKindTags = narrative?.dealKindTags || (dealType ? [dealType] : []);
  const funded = narrative?.funded ?? 0;
  const fundedPct = narrative?.fundedPct ?? 0;

  // Conditions-based progress from DB
  const conditionsMet = summary?.conditionsMet ?? 0;
  const conditionsTotal = summary?.conditionsTotal ?? 0;

  return (
    <motion.div
      {...fadeInUp}
      className="border border-border rounded-xl bg-card hover:shadow-lg transition-all group cursor-pointer"
      onClick={onView}
    >
      {/* Header row */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0 mt-0.5">
              {letter}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold leading-tight">{deal.deal_name}</h3>
                {isDemo && <Badge className="bg-accent/10 text-accent border-accent/20">DEMO</Badge>}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center w-2 h-2 rounded-full ${
                  sts.label === 'active' ? 'bg-validated' :
                  sts.label === 'ready' ? 'bg-validated' :
                  sts.label === 'setup' ? 'bg-amber-400' :
                  'bg-muted-foreground/40'
                }`} />
                <span className={`text-[11px] font-medium ${sts.text}`}>{sts.label}</span>
                {dealKindTags.map(tag => (
                  <span key={tag} className="text-[10px] text-muted-foreground">· {tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold font-mono">{fmt(deal.deal_value)}</p>
            <p className="text-[11px] text-muted-foreground">Total Value</p>
          </div>
        </div>
      </div>

      {/* Funded progress bar */}
      {isDemo && (
        <div className="px-5 pb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-accent font-medium">Ready to disburse</span>
            <span className="text-[11px] font-mono font-semibold text-right">
              {fmt(funded)} ({fundedPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${fundedPct >= 100 ? 'bg-validated' : PROGRESS_BAR_STYLE}`}
              style={{ width: `${Math.max(fundedPct, 1)}%` }}
            />
          </div>
        </div>
      )}

      {/* Deal details grid */}
      <div className="px-5 py-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Buyer</p>
          <p className="font-medium text-foreground text-sm">{buyerBorrower}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Seller</p>
          <p className="font-medium text-foreground text-sm">{(deal as any).seller || '—'}</p>
        </div>
        {(deal as any).target_company && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Target</p>
            <p className="font-medium text-foreground text-sm">{(deal as any).target_company}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Sector</p>
          <p className="font-medium text-foreground text-sm">{sector}</p>
        </div>
        {(deal as any).jurisdiction && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Jurisdiction</p>
            <p className="font-medium text-foreground text-sm">{(deal as any).jurisdiction}</p>
          </div>
        )}
        {tierCount > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Waterfall Tiers</p>
            <p className="font-medium text-foreground text-sm">{tierCount} tiers</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1"><CalendarIconLucide className="w-3.5 h-3.5" />{deal.closing_date || 'TBD'}</span>
          <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{deal.deal_number}</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{partiesCount} {partiesCount === 1 ? 'entity' : 'entities'}</span>
          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{docsCount} {docsCount === 1 ? 'doc' : 'docs'}</span>
          <span className="flex items-center gap-1"><Table className="w-3.5 h-3.5" />{capTableCount} equity holders</span>
        </div>
        <div className="flex items-center gap-2">
          {!isDemo && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete deal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {isDemo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded text-muted-foreground/50 cursor-not-allowed"
                  aria-label="Demo deal actions disabled"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>This is a demo deal</TooltipContent>
            </Tooltip>
          )}
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
};

// ── Main component ──
export const DealsCover: React.FC = () => {
  const { setSelectedDealId, setActiveSection } = usePIVTStore();
  const { createDeal, fetchDeals, fetchTemplates, fetchDealSummaries, duplicateDeal, softDeleteDeal } = useDealOperations();
  const { activeOrg, activeOrgId, schemaReady } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();

  const [allDeals, setAllDeals] = useState<RealDeal[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DealSummaryCounts>>({});
  const [_templates, setTemplates] = useState<DealTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [seedingDeals, setSeedingDeals] = useState(false);
  const [clearingSamples, setClearingSamples] = useState(false);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RealDeal | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [openDiscrepancies, setOpenDiscrepancies] = useState(0);
  const [recentEvents, setRecentEvents] = useState<PortfolioEvent[]>([]);
  const [form, setForm] = useState({ deal_name: '', deal_value: '', closing_date: '', escrow_amount: '', buyer: '', seller: '', target_company: '', sector: '', deal_type: '', currency: 'USD', jurisdiction: '', signing_date: '' });
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(['USD']);
  const [signingDate, setSigningDate] = useState<Date | undefined>();
  // Inline stakeholders + starter wire collected in the modal so a fresh deal
  // can satisfy the Activate Deal prereqs at create time (S2.1/S2.9/S2.12).
  type NewStakeholder = { name: string; side: 'buyer' | 'seller'; ownership: string };
  const [newStakeholders, setNewStakeholders] = useState<NewStakeholder[]>([
    { name: '', side: 'buyer', ownership: '' },
    { name: '', side: 'seller', ownership: '' },
  ]);
  const [starterWire, setStarterWire] = useState({ payee: '', amount: '', bank: '', last4: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const toggleCurrency = (code: string) => {
    setSelectedCurrencies(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };
  const removeCurrency = (code: string) => {
    setSelectedCurrencies(prev => prev.filter(c => c !== code));
  };

  const loadDeals = useCallback(async () => {
    setLoading(true);
    // Scope by the active workspace when multi-tenancy is live. Demo workspace
    // shows demo deals; customer workspaces show only their own. Pre-deploy
    // fallback keeps the legacy is_demo filter.
    const data = schemaReady && activeOrgId
      ? await fetchDeals({ orgId: activeOrgId })
      : await fetchDeals({ includeDemo: true });
    setAllDeals(data);
    if (data.length > 0) {
      const sums = await fetchDealSummaries(data.map(d => d.id));
      setSummaries(sums);
    }
    setLoading(false);
    // fetchDeals is stable; identity changes don't matter. activeOrgId +
    // schemaReady are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, schemaReady]);

  useEffect(() => {
    loadDeals();
    fetchTemplates().then(setTemplates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDeals]);

  useEffect(() => {
    let cancelled = false;

    const loadPortfolioSignals = async () => {
      if (allDeals.length === 0) {
        if (!cancelled) {
          setPendingApprovals(0);
          setOpenDiscrepancies(0);
          setRecentEvents([]);
        }
        return;
      }

      const dealIds = allDeals.map((deal) => deal.id);
      const dealMap = new Map(allDeals.map((deal) => [deal.id, deal.deal_name]));

      const [approvalsRes, discrepanciesRes, eventsRes] = await Promise.all([
        supabase
          .from('deal_approvals')
          .select('id', { count: 'exact', head: true })
          .in('deal_id', dealIds)
          .eq('status', 'pending'),
        supabase
          .from('discrepancies')
          .select('id', { count: 'exact', head: true })
          .in('deal_id', dealIds)
          .in('status', ['open', 'acknowledged']),
        supabase
          .from('deal_events')
          .select('id, event_type, created_at, deal_id')
          .in('deal_id', dealIds)
          .order('created_at', { ascending: false })
          .limit(18),
      ]);

      const dedupedEvents: PortfolioEvent[] = [];
      const seen = new Set<string>();
      for (const event of (eventsRes.data || []) as Array<{ id: string; event_type: string; created_at: string; deal_id: string }>) {
        const key = `${event.deal_id}::${event.event_type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedupedEvents.push({
          id: event.id,
          dealName: dealMap.get(event.deal_id) || 'Unknown Deal',
          action: event.event_type.replace(/_/g, ' '),
          timestamp: event.created_at,
        });
        if (dedupedEvents.length >= 6) break;
      }

      if (!cancelled) {
        setPendingApprovals(approvalsRes.count || 0);
        setOpenDiscrepancies(discrepanciesRes.count || 0);
        setRecentEvents(dedupedEvents);
      }
    };

    loadPortfolioSignals();

    return () => {
      cancelled = true;
    };
  }, [allDeals]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate Deal Type (shadcn Select doesn't honor HTML required natively)
    if (!form.deal_type) {
      setFormError('Deal Type is required.');
      return;
    }

    // Validate at least 2 fully-filled stakeholders so the Activate Deal gate
    // is satisfiable right after creation.
    const validStakeholders = newStakeholders.filter(s => s.name.trim() && s.ownership.trim());
    if (validStakeholders.length < 2) {
      setFormError('Add at least 2 stakeholders (name + ownership % each).');
      return;
    }

    setCreating(true);
    // Inject the active workspace id so the new deal lands in the right org.
    // If the active org is the demo org, we DON'T attach org_id (creating a
    // real deal inside the demo workspace would let the user pollute the
    // demo dataset). In that case the deal still gets created — it just
    // won't show in the demo workspace's list; user gets a toast to switch.
    const isDemoActive = activeOrg?.org_type === 'demo';
    if (isDemoActive) {
      toast({
        title: 'Switch to your workspace to create a deal',
        description: 'Demo workspace is read-only. Pick your real workspace from the topbar switcher.',
        variant: 'destructive',
      });
      setCreating(false);
      return;
    }
    const deal = await createDeal({
      deal_name: form.deal_name,
      deal_value: Number(form.deal_value),
      closing_date: form.closing_date || null,
      escrow_amount: Number(form.escrow_amount) || 0,
      buyer: form.buyer || null,
      seller: form.seller || null,
      target_company: form.target_company || null,
      sector: form.sector || null,
      deal_type: form.deal_type || null,
      currency: selectedCurrencies.join(',') || 'USD',
      jurisdiction: form.jurisdiction || null,
      signing_date: signingDate ? format(signingDate, 'yyyy-MM-dd') : null,
      org_id: schemaReady ? activeOrgId : null,
    });

    if (deal) {
      // Insert stakeholders (cap_table_entries). Errors surface as a toast but
      // don't block navigation — the user can fix them in the workspace.
      const stakeholderRows = validStakeholders.map(s => ({
        deal_id: deal.id,
        shareholder_name: s.name.trim(),
        ownership_pct: Number(s.ownership) || 0,
        payout_amount: 0,
      }));
      const { error: shErr } = await supabase.from('cap_table_entries').insert(stakeholderRows as any);
      if (shErr) {
        toast({ title: 'Stakeholders not saved', description: shErr.message, variant: 'destructive' });
      }

      // Optional starter wire — insert only if payee + amount are present.
      if (starterWire.payee.trim() && starterWire.amount.trim()) {
        const { error: wErr } = await supabase.from('wire_instructions').insert({
          deal_id: deal.id,
          payee_entity: starterWire.payee.trim(),
          bank_name: starterWire.bank.trim() || null,
          account_number_last4: starterWire.last4.trim() || null,
          amount: Number(starterWire.amount) || 0,
          currency: selectedCurrencies[0] || 'USD',
          verification_status: 'pending',
        } as any);
        if (wErr) {
          toast({ title: 'Starter wire not saved', description: wErr.message, variant: 'destructive' });
        }
      }

      setShowCreate(false);
      setForm({ deal_name: '', deal_value: '', closing_date: '', escrow_amount: '', buyer: '', seller: '', target_company: '', sector: '', deal_type: '', currency: 'USD', jurisdiction: '', signing_date: '' });
      setSelectedCurrencies(['USD']);
      setSigningDate(undefined);
      setNewStakeholders([{ name: '', side: 'buyer', ownership: '' }, { name: '', side: 'seller', ownership: '' }]);
      setStarterWire({ payee: '', amount: '', bank: '', last4: '' });
      await loadDeals();
      setSelectedDealId(deal.id);
      setActiveSection('workspace');
    }
    setCreating(false);
  };

  const handleDuplicate = async (dealId: string) => {
    setDuplicatingId(dealId);
    const newDeal = await duplicateDeal(dealId);
    setDuplicatingId(null);
    if (newDeal) {
      setSelectedDealId(newDeal.id);
      setActiveSection('workspace');
    }
  };

  const openDeal = (id: string) => {
    setSelectedDealId(id);
    setActiveSection('workspace');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await softDeleteDeal(deleteTarget.id);
    setDeleting(false);
    if (success) {
      setAllDeals((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
    setDeleteConfirmText('');
  };

  // Separate demo deals from user's private deals
  const demoDeals = allDeals.filter(d => d.is_demo || d.visibility === 'global_demo');
  const privateDeals = allDeals.filter(d => !d.is_demo && d.visibility !== 'global_demo');

  const sortedPrivate = [...privateDeals].sort((a, b) => a.deal_name.localeCompare(b.deal_name, undefined, { sensitivity: 'base' }));
  const sortedDemo = [...demoDeals].sort((a, b) => a.deal_name.localeCompare(b.deal_name, undefined, { sensitivity: 'base' }));
  const totalDeals = sortedPrivate.length + sortedDemo.length;
  const showOnboarding = !loading && privateDeals.length === 0;
  // KPIs reflect the user's own portfolio — demo deals are listed separately and excluded here.
  const totalDealValue = privateDeals.reduce((sum, deal) => sum + Number(deal.deal_value || 0), 0);
  const conditionsPending = privateDeals.reduce((sum, deal) => {
    const summary = summaries[deal.id];
    if (!summary) return sum;
    return sum + Math.max(summary.conditionsTotal - summary.conditionsMet, 0);
  }, 0);
  const conditionsBlocked = privateDeals.filter((deal) => Boolean((deal as any).blocked_reason)).length;
  const dealsReadyToExecute = privateDeals.filter((deal) => {
    const summary = summaries[deal.id];
    if (!summary || summary.conditionsTotal === 0) return false;
    return summary.conditionsMet === summary.conditionsTotal && summary.approvalsGranted === summary.approvalsTotal && deal.status !== 'closed' && deal.status !== 'settled';
  }).length;
  const upcomingDeadlines = [...privateDeals]
    .filter((deal) => Boolean(deal.closing_date))
    .sort((a, b) => new Date(a.closing_date || '').getTime() - new Date(b.closing_date || '').getTime())
    .slice(0, 5);

  const kpiCards = [
    { label: 'Active Deals', value: privateDeals.length, icon: Briefcase, accent: 'text-accent' },
    { label: 'Total Deal Value', value: fmt(totalDealValue), icon: TrendingUp, accent: 'text-accent' },
    { label: 'Conditions Pending', value: conditionsPending, icon: Clock, accent: 'text-discrepancy' },
    { label: 'Conditions Blocked', value: conditionsBlocked, icon: AlertTriangle, accent: 'text-blocking' },
    { label: 'Deals Ready to Execute', value: dealsReadyToExecute, icon: CheckCircle2, accent: 'text-validated' },
  ];

  const portfolioInsights = [
    conditionsBlocked > 0
      ? {
          id: 'blocked',
          icon: AlertTriangle,
          accent: 'text-blocking',
          text: `${conditionsBlocked} deal${conditionsBlocked !== 1 ? 's are' : ' is'} blocked by unmet conditions.`,
        }
      : null,
    openDiscrepancies > 0
      ? {
          id: 'discrepancies',
          icon: AlertTriangle,
          accent: 'text-discrepancy',
          text: `${openDiscrepancies} open discrepanc${openDiscrepancies === 1 ? 'y remains' : 'ies remain'} across active workstreams.`,
        }
      : null,
    {
      id: 'approvals',
      icon: Brain,
      accent: 'text-accent',
      text: `${pendingApprovals} approval${pendingApprovals !== 1 ? 's are' : ' is'} still pending across the portfolio.`,
    },
  ].filter(Boolean) as Array<{ id: string; icon: typeof Brain; accent: string; text: string }>;

  const navigate = useNavigate();

  // Gate any "create deal" entry point behind auth. Without a session, the
  // RLS policy on `deals` (owner_id = auth.uid()) rejects the INSERT and the
  // user sees a cryptic Postgres error. Better: send them to sign in first.
  const requireAuthThen = (callback: () => void) => {
    if (!user) {
      const here = window.location.pathname + window.location.search;
      navigate(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    callback();
  };

  const openCreateInNewton = () => {
    requireAuthThen(() => {
      window.dispatchEvent(new CustomEvent('pivt:open-newton'));
      window.dispatchEvent(new CustomEvent('pivt:newton-create-deal'));
    });
  };

  const openCreateModal = () => requireAuthThen(() => setShowCreate(true));

  // Demo seeder — calls the existing qa-seed-deals edge function which
  // creates 4 fully-populated deals (Golden Path, Active KYC, Pre-Approval,
  // Post-Close) with stakeholders, wires, contracts, approvals, and audit
  // events so every workspace step has realistic data to render against.
  // Idempotent sample-deal seeder. Each deal has a stable seed_key so re-
  // running only creates missing deals. Direct client-side inserts (no edge
  // function) so RLS is enforced — user can only seed into their own workspace.
  const handleSeedSampleDeals = async () => {
    if (!user) {
      toast({ title: 'Sign in first', description: 'You need to be signed in to seed demo deals.' });
      return;
    }
    if (activeOrg?.org_type === 'demo') {
      toast({
        title: 'Switch to a personal workspace first',
        description: 'The PIVT Demo workspace is read-only. Use the workspace switcher in the topbar to pick or create your own workspace, then load samples there.',
        variant: 'destructive',
      });
      return;
    }
    if (!activeOrg) {
      toast({ title: 'No active workspace', description: 'Pick or create a workspace first.', variant: 'destructive' });
      return;
    }
    setSeedingDeals(true);
    try {
      const { SAMPLE_DEALS } = await import('@/lib/sampleDeals');
      // seed_key has a UNIQUE constraint on the deals table, so the same key
      // can't exist twice anywhere. Namespace each key with the org_id so
      // multiple workspaces can each have their own copy of the sample deals
      // without colliding.
      const orgScope = activeOrg.id.replace(/-/g, '').slice(0, 12);
      const scopedKey = (base: string) => `${base}-${orgScope}`;
      const allKeys = SAMPLE_DEALS.map((d) => scopedKey(d.seed_key));

      // 1. Check which seed_keys already exist in this workspace.
      //    Filter `deleted_at IS NULL` so soft-deleted rows don't block
      //    re-creation — the user can delete a sample deal then click
      //    'Load sample deals' to get it back.
      const { data: existingRows } = await supabase
        .from('deals')
        .select('seed_key')
        .eq('org_id', activeOrg.id)
        .is('deleted_at', null)
        .in('seed_key', allKeys);
      const existingKeys = new Set(
        ((existingRows as Array<{ seed_key: string | null }>) || [])
          .map((r) => r.seed_key)
          .filter((k): k is string => Boolean(k)),
      );

      // 1b. Purge any soft-deleted rows with the seed_keys we're about to
      //     insert. Keeps the deals table tidy — otherwise each delete +
      //     reseed cycle would leave a tombstone row behind.
      await supabase
        .from('deals')
        .delete()
        .eq('org_id', activeOrg.id)
        .not('deleted_at', 'is', null)
        .in('seed_key', allKeys);

      // 2. Determine what's missing
      const toCreate = SAMPLE_DEALS.filter((d) => !existingKeys.has(scopedKey(d.seed_key)));
      if (toCreate.length === 0) {
        toast({
          title: 'All 7 sample deals already loaded',
          description: 'Delete any deal to free up that slot, then click again to re-create it.',
        });
        return;
      }

      // 3. Insert missing deals + their related rows
      let createdCount = 0;
      const failures: string[] = [];
      const today = new Date();
      for (const sample of toCreate) {
        const closingDate = new Date(today);
        closingDate.setDate(today.getDate() + sample.closing_date_offset_days);

        // Insert deal
        const { data: newDeal, error: dealErr } = await supabase
          .from('deals')
          .insert({
            org_id: activeOrg.id,
            owner_id: user.id,
            created_by: user.id,
            seed_key: scopedKey(sample.seed_key),
            deal_name: sample.deal_name,
            deal_number: '',
            deal_value: sample.deal_value,
            currency: sample.currency,
            escrow_amount: sample.escrow_amount,
            buyer: sample.buyer,
            seller: sample.seller,
            target_company: sample.target_company,
            deal_type: sample.deal_type,
            sector: sample.sector,
            jurisdiction: sample.jurisdiction ?? null,
            closing_date: closingDate.toISOString().split('T')[0],
            status: sample.status,
            deal_state: sample.deal_state,
            visibility: 'private',
            deal_kind: 'live',
          } as never)
          .select('id')
          .single();

        if (dealErr || !newDeal) {
          failures.push(`${sample.deal_name}: ${dealErr?.message || 'no id'}`);
          continue;
        }

        // Related rows — best-effort, won't break other inserts on failure
        const dealId = (newDeal as { id: string }).id;
        if (sample.stakeholders.length) {
          await supabase.from('cap_table_entries').insert(
            sample.stakeholders.map((s) => ({ ...s, deal_id: dealId })) as never,
          );
        }
        if (sample.wires.length) {
          await supabase.from('wire_instructions').insert(
            sample.wires.map((w) => ({ ...w, deal_id: dealId })) as never,
          );
        }
        if (sample.documents.length) {
          await supabase.from('contract_documents').insert(
            sample.documents.map((d) => ({ ...d, deal_id: dealId })) as never,
          );
        }
        if (sample.approvals?.length) {
          await supabase.from('deal_approvals').insert(
            sample.approvals.map((a) => ({
              ...a,
              deal_id: dealId,
              user_id: user.id,
              completed_at: a.status === 'completed' || a.status === 'approved' ? new Date().toISOString() : null,
            })) as never,
          );
        }
        createdCount++;
      }

      // 4. Summary toast
      if (createdCount > 0 && failures.length === 0) {
        toast({
          title: `Added ${createdCount} sample deal${createdCount === 1 ? '' : 's'}`,
          description: existingKeys.size > 0
            ? `${existingKeys.size} already existed, ${createdCount} created.`
            : `All deals come with stakeholders, wires, contracts${createdCount > 0 ? ', and approvals' : ''}.`,
        });
      } else if (createdCount > 0 && failures.length > 0) {
        toast({
          title: `Partial seed`,
          description: `Created ${createdCount}, failed ${failures.length}. Errors: ${failures.slice(0, 2).join('; ')}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Could not seed any deals',
          description: failures.slice(0, 3).join('; ') || 'Unknown failure',
          variant: 'destructive',
        });
      }

      // 5. Refresh — use loadDeals so component state (allDeals + summaries)
      //    actually updates and the new rows appear without manual reload.
      await loadDeals();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[seed] unexpected error:', e);
      toast({ title: 'Seed failed', description: (e as Error).message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSeedingDeals(false);
    }
  };

  // Delete all seeded sample deals (seed_key starts with 'sample-') in the
  // active workspace. Hard delete — keeps the table tidy. Your own real
  // deals (no seed_key, or seed_keys not in the sample set) are NOT touched.
  const handleClearAllSamples = async () => {
    if (!user || !activeOrg) return;
    const sampleCount = allDeals.filter((d) => {
      const sk = (d as RealDeal & { seed_key?: string | null }).seed_key;
      return sk && sk.startsWith('sample-');
    }).length;
    if (sampleCount === 0) {
      toast({ title: 'No sample deals to delete', description: 'Your workspace has no seeded sample deals right now.' });
      return;
    }
    if (!confirm(`Delete all ${sampleCount} sample deal${sampleCount === 1 ? '' : 's'}? This cannot be undone. Your own deals will NOT be affected.`)) {
      return;
    }
    setClearingSamples(true);
    try {
      const { error: delErr, count } = await supabase
        .from('deals')
        .delete({ count: 'exact' })
        .eq('org_id', activeOrg.id)
        .like('seed_key', 'sample-%');
      if (delErr) {
        toast({ title: 'Could not delete samples', description: delErr.message, variant: 'destructive' });
        return;
      }
      toast({
        title: `Cleared ${count ?? sampleCount} sample deal${(count ?? sampleCount) === 1 ? '' : 's'}`,
        description: 'Click "Load sample deals" to recreate them.',
      });
      await loadDeals();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[clear-samples] unexpected error:', e);
      toast({ title: 'Clear failed', description: (e as Error).message || 'Unknown error', variant: 'destructive' });
    } finally {
      setClearingSamples(false);
    }
  };

  // Listen for the onboarding wizard's "start with a real deal" CTA so the
  // wizard can hand off into this page's New Deal modal without re-implementing
  // the form itself.
  useEffect(() => {
    const handler = () => requireAuthThen(() => setShowCreate(true));
    window.addEventListener('pivt:open-create-deal-modal', handler as EventListener);
    return () => window.removeEventListener('pivt:open-create-deal-modal', handler as EventListener);
    // requireAuthThen is stable enough; the listener only reads it at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Deals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDeals} deal{totalDeals !== 1 ? 's' : ''}
            {sortedDemo.length > 0 ? ` · ${sortedPrivate.length} mine · ${sortedDemo.length} demo` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <button
                onClick={handleSeedSampleDeals}
                disabled={seedingDeals || clearingSamples}
                title="Load 7 fully-populated sample deals so every workspace step has realistic data to render against. Idempotent — only creates missing deals."
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
              >
                {seedingDeals ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {seedingDeals ? 'Loading samples…' : 'Load sample deals'}
              </button>
              {allDeals.some((d) => {
                const sk = (d as RealDeal & { seed_key?: string | null }).seed_key;
                return sk && sk.startsWith('sample-');
              }) && (
                <button
                  onClick={handleClearAllSamples}
                  disabled={clearingSamples || seedingDeals}
                  title="Delete all sample deals from this workspace. Your own deals are NOT touched."
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
                >
                  {clearingSamples ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {clearingSamples ? 'Deleting…' : 'Delete all samples'}
                </button>
              )}
            </>
          )}
          <button
            onClick={openCreateModal}
            title={user ? undefined : 'Sign in to create a deal'}
            className="pivt-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          >
            <Plus className="w-4 h-4" />
            {user ? 'New Deal' : 'Sign in to create'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : showOnboarding ? (
        <motion.div {...fadeInUp} className="border border-border rounded-xl bg-card p-8 md:p-10 space-y-8">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">Close your first deal in minutes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Newton can stand up your workspace from the agreement, extract the core deal data, and prep collaboration without making you start from a blank slate.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Upload, title: 'Upload SPA', detail: 'Add the signed agreement and any supporting materials to seed the workspace.' },
              { icon: Wand2, title: 'AI extracts deal data', detail: 'Newton maps parties, obligations, approvals, and core terms automatically.' },
              { icon: Users, title: 'Invite your team', detail: 'Bring in legal, finance, and approvers once the deal shell is ready.' },
            ].map((step, index) => (
              <div key={step.title} className="rounded-xl border border-border/60 bg-muted/20 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step {index + 1}</span>
                </div>
                <h4 className="text-base font-semibold">{step.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={openCreateInNewton} className="gap-2 px-6 py-3 rounded-xl">
              <Sparkles className="h-4 w-4" />
              Create your first deal
            </Button>
            {sortedDemo.length > 0 && (
              <Button variant="link" className="px-0" onClick={() => openDeal(sortedDemo[0].id)}>
                Explore a demo deal first
              </Button>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            {kpiCards.map((metric) => (
              <motion.div key={metric.label} {...fadeInUp} className="pivt-metric-card flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="pivt-icon-chip w-8 h-8">
                    <metric.icon className={`w-4 h-4 ${metric.accent}`} />
                  </div>
                  <span className="pivt-metric-label">{metric.label}</span>
                </div>
                <span className="pivt-stat-lg text-3xl text-center w-full">{metric.value}</span>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
            <div className="space-y-6">
              {/* User's private deals */}
              {sortedPrivate.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Deals</h3>
                  <div className="grid gap-4">
                    {sortedPrivate.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        summary={summaries[deal.id]}
                        isDemo={false}
                        onView={() => openDeal(deal.id)}
                        onDuplicate={() => {}}
                        duplicating={false}
                        onDelete={() => setDeleteTarget(deal)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Demo deals */}
              {sortedDemo.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Demo Deals</h3>
                  <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-foreground/80">
                    <span className="font-semibold">These are read-only demo deals. Create a real deal to get started.</span>
                  </div>
                  <div className="grid gap-4">
                    {sortedDemo.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        summary={summaries[deal.id]}
                        isDemo={true}
                        onView={() => openDeal(deal.id)}
                        onDuplicate={() => handleDuplicate(deal.id)}
                        duplicating={duplicatingId === deal.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 xl:sticky xl:top-4">
              <motion.section {...fadeInUp} className="pivt-card-ai p-6 relative">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4 pivt-section-bar">
                    <div className="pivt-icon-chip w-7 h-7 pivt-icon-purple">
                      <Brain className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Newton Portfolio Signals</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    {portfolioInsights.map((insight) => (
                      <div key={insight.id} className="flex items-start gap-2.5">
                        <insight.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${insight.accent}`} />
                        <span className="text-foreground">{insight.text}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveSection('intelligence')}
                      className="mt-2 flex items-center gap-1 text-[11px] font-medium text-accent hover:opacity-80 transition-opacity"
                    >
                      Open intelligence view <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.section>

              <motion.section {...fadeInUp} className="pivt-card p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 pivt-section-bar">Recent Cross-Deal Activity</h3>
                <div className="space-y-3">
                  {recentEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Activity will appear here as portfolio work progresses.</p>
                  ) : (
                    recentEvents.map((event) => (
                      <div key={event.id} className="flex items-start gap-3">
                        <div className="pivt-icon-chip w-7 h-7 mt-0.5">
                          <TrendingUp className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate capitalize">{event.action}</p>
                          <p className="text-xs text-muted-foreground">{event.dealName} · {new Date(event.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.section>

              <motion.section {...fadeInUp} className="pivt-card p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 pivt-section-bar">Upcoming Deadlines</h3>
                <div className="space-y-3">
                  {upcomingDeadlines.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Closing dates will surface here once deals are scheduled.</p>
                  ) : (
                    upcomingDeadlines.map((deal) => (
                      <button
                        key={deal.id}
                        onClick={() => openDeal(deal.id)}
                        className="w-full flex items-start gap-3 text-left rounded-lg hover:bg-muted/30 p-2 -m-2 transition-colors"
                      >
                        <div className="pivt-icon-chip w-7 h-7 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-discrepancy" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{deal.deal_name}</p>
                          <p className="text-xs text-muted-foreground">Expected close · {deal.closing_date ? new Date(deal.closing_date).toLocaleDateString() : 'TBD'}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      </button>
                    ))
                  )}
                </div>
              </motion.section>
            </div>
          </div>
        </div>
      )}

      {/* Create Deal Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <p className="text-sm text-muted-foreground">Fill in deal metadata to initialize the transaction workspace.</p>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-5">
            {/* Transaction Overview */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Transaction Overview</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Deal Name <span className="text-destructive">*</span></Label>
                  <Input value={form.deal_name} onChange={(e) => setForm({ ...form, deal_name: e.target.value })} placeholder="Project Nimbus Acquisition" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Deal Type <span className="text-destructive">*</span></Label>
                    <Select value={form.deal_type} onValueChange={(v) => setForm({ ...form, deal_type: v })} required>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {DEAL_TYPES.map(dt => (
                          <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sector</Label>
                    <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                      <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Healthcare">Healthcare</SelectItem>
                        <SelectItem value="Financial Services">Financial Services</SelectItem>
                        <SelectItem value="Energy">Energy</SelectItem>
                        <SelectItem value="Real Estate">Real Estate</SelectItem>
                        <SelectItem value="Consumer">Consumer</SelectItem>
                        <SelectItem value="Industrials">Industrials</SelectItem>
                        <SelectItem value="Media & Entertainment">Media & Entertainment</SelectItem>
                        <SelectItem value="Telecommunications">Telecommunications</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Parties */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Parties</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Buyer <span className="text-destructive">*</span></Label>
                  <Input value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} placeholder="Orion Data Systems LLC" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Seller <span className="text-destructive">*</span></Label>
                  <Input value={form.seller} onChange={(e) => setForm({ ...form, seller: e.target.value })} placeholder="Aurora Ventures Fund I, LP" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Company <span className="text-destructive">*</span></Label>
                  <Input value={form.target_company} onChange={(e) => setForm({ ...form, target_company: e.target.value })} placeholder="Nimbus Analytics Inc." required />
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Financial Terms */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Financial Terms</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Deal Value ($)</Label>
                  <Input type="number" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} placeholder="12500000" required min={0} />
                </div>
                <div className="space-y-1.5">
                  <Label>Escrow Amount ($)</Label>
                  <Input type="number" value={form.escrow_amount} onChange={(e) => setForm({ ...form, escrow_amount: e.target.value })} placeholder="200000" min={0} />
                </div>
                <div className="space-y-1.5 col-span-3">
                  <Label>Currencies</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedCurrencies.map(code => (
                      <Badge key={code} variant="secondary" className="gap-1 pr-1">
                        {code}
                        <button type="button" onClick={() => removeCurrency(code)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Select onValueChange={(v) => { if (!selectedCurrencies.includes(v)) toggleCurrency(v); }} value="">
                    <SelectTrigger><SelectValue placeholder="Add currency…" /></SelectTrigger>
                    <SelectContent>
                      {CURRENCY_GROUPS.map(group => (
                        <SelectGroup key={group.label}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.items.map(c => (
                            <SelectItem key={c.value} value={c.value} disabled={selectedCurrencies.includes(c.value)}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Jurisdiction & Timing */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Jurisdiction & Timing</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Jurisdiction</Label>
                  <Input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} placeholder="Delaware, United States" />
                </div>
                <div className="space-y-1.5">
                  <Label>Signing Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !signingDate && "text-muted-foreground")}>
                        <CalendarIconLucide className="mr-2 h-4 w-4" />
                        {signingDate ? format(signingDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={signingDate} onSelect={setSigningDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Close Date</Label>
                  <Input type="date" value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Stakeholders (min. 2 to activate the deal) */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Stakeholders <span className="text-destructive">*</span></p>
              <p className="text-xs text-muted-foreground mb-3">Add at least two participants (e.g. a buyer-side fund and a seller-side founder). You can refine roles, KYC status, and payouts inside the workspace.</p>
              <div className="space-y-2">
                {newStakeholders.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_8rem_6rem_auto] gap-2">
                    <Input
                      placeholder="Stakeholder name"
                      value={s.name}
                      onChange={(e) => setNewStakeholders(prev => prev.map((row, i) => i === idx ? { ...row, name: e.target.value } : row))}
                    />
                    <Select
                      value={s.side}
                      onValueChange={(v) => setNewStakeholders(prev => prev.map((row, i) => i === idx ? { ...row, side: v as 'buyer' | 'seller' } : row))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buyer">Buyer-side</SelectItem>
                        <SelectItem value="seller">Seller-side</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="% own"
                      min={0}
                      max={100}
                      value={s.ownership}
                      onChange={(e) => setNewStakeholders(prev => prev.map((row, i) => i === idx ? { ...row, ownership: e.target.value } : row))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => setNewStakeholders(prev => prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev)}
                      disabled={newStakeholders.length <= 2}
                      aria-label="Remove stakeholder"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5"
                onClick={() => setNewStakeholders(prev => [...prev, { name: '', side: 'buyer', ownership: '' }])}
              >
                <Plus className="w-3.5 h-3.5" />
                Add stakeholder
              </Button>
            </div>

            <div className="border-t border-border" />

            {/* Starter wire (optional) — fills the "Payment structure" prereq */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Starter Wire Instruction <span className="text-muted-foreground font-normal normal-case tracking-normal">(optional)</span></p>
              <p className="text-xs text-muted-foreground mb-3">Adding one wire here satisfies the Payment structure prereq for activation. You can edit details, add bank verification, and add more wires inside the workspace.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Payee</Label>
                  <Input
                    placeholder="Acme Acquisitions LLC"
                    value={starterWire.payee}
                    onChange={(e) => setStarterWire(prev => ({ ...prev, payee: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    placeholder="2500000"
                    min={0}
                    value={starterWire.amount}
                    onChange={(e) => setStarterWire(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bank Name</Label>
                  <Input
                    placeholder="JPMorgan Chase"
                    value={starterWire.bank}
                    onChange={(e) => setStarterWire(prev => ({ ...prev, bank: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account (last 4)</Label>
                  <Input
                    placeholder="1234"
                    maxLength={4}
                    value={starterWire.last4}
                    onChange={(e) => setStarterWire(prev => ({ ...prev, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={creating}>
              {creating ? 'Creating...' : 'Create Deal'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{deleteTarget?.deal_name}</strong> and all associated data from your workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirmText !== 'DELETE' || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Deal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
