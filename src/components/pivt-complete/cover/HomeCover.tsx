/**
 * HomeCover — Product dashboard landing page
 * Live data: queries real deals, events, and aggregate metrics from the database.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { RealDeal } from '@/hooks/useDealOperations';
import {
  Briefcase, AlertTriangle, CheckCircle2, Clock, Brain, ArrowRight, TrendingUp, Inbox,
} from 'lucide-react';

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M` : `$${(n / 1_000).toFixed(0)}K`;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } },
};

interface RecentEvent {
  id: string;
  dealName: string;
  action: string;
  timestamp: string;
}

interface PortfolioMetrics {
  dealsWithBlockers: number;
  pendingApprovals: number;
  closingThisMonth: number;
  openDiscrepancies: number;
}

export const HomeCover: React.FC = () => {
  const { setActiveSection, setSelectedDealId } = usePIVTStore();
  const { user } = useAuth();

  const [deals, setDeals] = useState<RealDeal[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics>({ dealsWithBlockers: 0, pendingApprovals: 0, closingThisMonth: 0, openDiscrepancies: 0 });
  const [loading, setLoading] = useState(true);

  const greeting = useMemo(() => {
    const fullName = user?.user_metadata?.full_name as string | undefined;
    const firstName = fullName?.split(' ')?.[0];
    return firstName ? `Welcome back, ${firstName}` : 'Welcome back';
  }, [user]);

  // Fetch deals + aggregate metrics + recent events
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchAll = async () => {
      setLoading(true);

      // 1. Deals
      const { data: dealRows } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });
      const allDeals = (dealRows as RealDeal[]) || [];
      setDeals(allDeals);

      const dealIds = allDeals.map(d => d.id);

      // 2. Portfolio metrics (parallel)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const [approvalsRes, discrepanciesRes] = await Promise.all([
        dealIds.length > 0
          ? supabase.from('deal_approvals').select('id', { count: 'exact', head: true }).in('deal_id', dealIds).eq('status', 'pending')
          : Promise.resolve({ count: 0 }),
        dealIds.length > 0
          ? supabase.from('discrepancies').select('id', { count: 'exact', head: true }).in('deal_id', dealIds).in('status', ['open', 'acknowledged'])
          : Promise.resolve({ count: 0 }),
      ]);

      const closingThisMonth = allDeals.filter(d => {
        if (!d.closing_date) return false;
        return d.closing_date >= monthStart && d.closing_date <= monthEnd;
      }).length;

      const dealsWithBlockers = allDeals.filter(d => d.blocked_reason).length;

      setMetrics({
        dealsWithBlockers,
        pendingApprovals: (approvalsRes as any).count || 0,
        closingThisMonth,
        openDiscrepancies: (discrepanciesRes as any).count || 0,
      });

      // 3. Recent events across all deals
      if (dealIds.length > 0) {
        const { data: events } = await supabase
          .from('deal_events')
          .select('id, event_type, created_at, deal_id')
          .in('deal_id', dealIds)
          .order('created_at', { ascending: false })
          .limit(8);

        // Build a deal name lookup
        const dealMap = new Map(allDeals.map(d => [d.id, d.deal_name]));

        setRecentEvents(
          (events || []).map((e: any) => ({
            id: e.id,
            dealName: dealMap.get(e.deal_id) || 'Unknown Deal',
            action: (e.event_type as string).replace(/_/g, ' '),
            timestamp: e.created_at,
          }))
        );
      }

      setLoading(false);
    };

    fetchAll();
  }, [user]);

  const activeDeals = deals.filter(d => d.status !== 'completed' && d.status !== 'archived');

  const metricCards = [
    { label: 'Active Deals', value: activeDeals.length, icon: Briefcase, accent: 'text-accent' },
    { label: 'Closing This Month', value: metrics.closingThisMonth, icon: Clock, accent: 'text-amber-500' },
    { label: 'Pending Approvals', value: metrics.pendingApprovals, icon: CheckCircle2, accent: 'text-blue-500' },
    { label: 'Open Discrepancies', value: metrics.openDiscrepancies, icon: AlertTriangle, accent: 'text-destructive' },
  ];

  const openDeal = (id: string) => {
    setSelectedDealId(id);
    setActiveSection('workspace' as ActiveSection);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's your portfolio at a glance.</p>
      </motion.div>

      {/* Metrics */}
      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(m => (
          <motion.div key={m.label} variants={fadeUp} className="pivt-metric-card flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="pivt-icon-chip w-8 h-8">
                <m.icon className={`w-4 h-4 ${m.accent}`} />
              </div>
              <span className="pivt-metric-label">{m.label}</span>
            </div>
            <span className="pivt-stat-lg text-3xl">{m.value}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Deal Grid */}
      <motion.section variants={fadeUp}>
        <div className="flex items-center justify-between mb-4 pivt-section-bar">
          <h2 className="text-lg font-semibold text-foreground">Deal Overview</h2>
          <button
            onClick={() => setActiveSection('deals' as ActiveSection)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {deals.length === 0 ? (
          <div className="pivt-card p-8 text-center">
            <Inbox className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No deals yet. Create your first deal to get started.</p>
          </div>
        ) : (
          <motion.div variants={stagger} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.slice(0, 6).map((deal) => (
              <motion.button
                key={deal.id}
                variants={fadeUp}
                onClick={() => openDeal(deal.id)}
                className="pivt-card p-5 text-left group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${deal.status === 'active' ? 'bg-accent' : deal.status === 'draft' ? 'bg-muted-foreground' : 'bg-emerald-500'}`} />
                  <span className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate">
                    {deal.deal_name}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize shrink-0">{deal.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3 truncate">
                  {[deal.buyer, deal.seller, deal.target_company].filter(Boolean).join(' · ') || deal.deal_number}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{fmt(deal.deal_value)}</span>
                  {deal.sector && <span className="text-muted-foreground">{deal.sector}</span>}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* Bottom row: Recent Activity + Portfolio Intelligence Snapshot */}
      <motion.div variants={stagger} className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.section variants={fadeUp} className="pivt-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 pivt-section-bar">Recent Activity</h3>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity. Events will appear here as you work on your deals.</p>
            ) : (
              recentEvents.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3"
                >
                  <div className="pivt-icon-chip w-7 h-7 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate capitalize">{event.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.dealName} · {new Date(event.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.section>

        {/* Portfolio Intelligence Snapshot — computed from real data */}
        <motion.section variants={fadeUp} className="pivt-card-ai p-6 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 pivt-section-bar">
              <div className="pivt-icon-chip w-7 h-7 pivt-icon-purple">
                <Brain className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Portfolio Intelligence Snapshot</h3>
            </div>
            {deals.length === 0 ? (
              <p className="text-xs text-muted-foreground">Portfolio insights will appear once you create deals and add data.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {metrics.dealsWithBlockers > 0 && (
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                    <span className="text-foreground">
                      <strong>{metrics.dealsWithBlockers} deal{metrics.dealsWithBlockers !== 1 ? 's' : ''}</strong> {metrics.dealsWithBlockers === 1 ? 'has' : 'have'} blocking issues requiring attention
                    </span>
                  </div>
                )}
                {metrics.openDiscrepancies > 0 && (
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">
                      <strong>{metrics.openDiscrepancies} open discrepanc{metrics.openDiscrepancies === 1 ? 'y' : 'ies'}</strong> across your portfolio
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <span className="text-foreground">
                    <strong>{metrics.pendingApprovals} approval{metrics.pendingApprovals !== 1 ? 's' : ''}</strong> pending across your portfolio
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-foreground">
                    <strong>{metrics.closingThisMonth} deal{metrics.closingThisMonth !== 1 ? 's' : ''}</strong> closing this month
                  </span>
                </div>
                {metrics.dealsWithBlockers === 0 && metrics.openDiscrepancies === 0 && (
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">No blocking issues detected across your portfolio</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>
      </motion.div>
    </motion.div>
  );
};
