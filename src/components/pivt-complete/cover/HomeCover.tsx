/**
 * HomeCover — Clean, minimal product dashboard landing page
 * Dental-Genie-inspired: generous whitespace, clear hierarchy, progressive disclosure
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
  show: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } },
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

      const { data: dealRows } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });
      const allDeals = (dealRows as RealDeal[]) || [];
      setDeals(allDeals);

      const dealIds = allDeals.map(d => d.id);

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

      const dealsWithBlockers = allDeals.filter(d => (d as any).blocked_reason).length;

      setMetrics({
        dealsWithBlockers,
        pendingApprovals: (approvalsRes as any).count || 0,
        closingThisMonth,
        openDiscrepancies: (discrepanciesRes as any).count || 0,
      });

      if (dealIds.length > 0) {
        const { data: events } = await supabase
          .from('deal_events')
          .select('id, event_type, created_at, deal_id')
          .in('deal_id', dealIds)
          .order('created_at', { ascending: false })
          .limit(40);

        const dealMap = new Map(allDeals.map(d => [d.id, d.deal_name]));

        const deduped: RecentEvent[] = [];
        const seen = new Set<string>();
        for (const e of (events || []) as any[]) {
          const key = `${e.deal_id}::${e.event_type}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push({
            id: e.id,
            dealName: dealMap.get(e.deal_id) || 'Unknown Deal',
            action: (e.event_type as string).replace(/_/g, ' '),
            timestamp: e.created_at,
          });
          if (deduped.length >= 6) break;
        }
        setRecentEvents(deduped);
      }

      setLoading(false);
    };

    fetchAll();
  }, [user]);

  const activeDeals = deals.filter(d => d.status !== 'completed' && d.status !== 'archived');

  const metricCards = [
    { label: 'Active Deals', value: activeDeals.length, icon: Briefcase, color: 'text-accent' },
    { label: 'Closing This Month', value: metrics.closingThisMonth, icon: Clock, color: 'text-muted-foreground' },
    { label: 'Pending Approvals', value: metrics.pendingApprovals, icon: CheckCircle2, color: 'text-muted-foreground' },
    { label: 'Open Discrepancies', value: metrics.openDiscrepancies, icon: AlertTriangle, color: 'text-destructive' },
  ];

  const openDeal = (id: string) => {
    setSelectedDealId(id);
    setActiveSection('workspace' as ActiveSection);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-10">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Here's your portfolio at a glance.</p>
      </motion.div>

      {/* Metrics — clean cards, no gradient noise */}
      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {metricCards.map(m => (
          <motion.div key={m.label} variants={fadeUp} className="pivt-metric-card flex flex-col items-center gap-4 text-center">
            <div className="pivt-icon-chip w-10 h-10">
              <m.icon className={`w-4.5 h-4.5 ${m.color}`} />
            </div>
            <div>
              <span className="pivt-stat-lg block">{m.value}</span>
              <span className="pivt-metric-label mt-1 block">{m.label}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Deal Grid */}
      <motion.section variants={fadeUp}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Recent Deals</h2>
          <button
            onClick={() => setActiveSection('deals' as ActiveSection)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {deals.length === 0 ? (
          <div className="pivt-card p-12 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No deals yet. Create your first deal to get started.</p>
          </div>
        ) : (
          <motion.div variants={stagger} className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {deals.slice(0, 6).map((deal) => (
              <motion.button
                key={deal.id}
                variants={fadeUp}
                onClick={() => openDeal(deal.id)}
                className="pivt-card p-6 text-left group"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${deal.status === 'active' ? 'bg-accent' : deal.status === 'draft' ? 'bg-muted-foreground/40' : 'bg-validated'}`} />
                  <span className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate flex-1">
                    {deal.deal_name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-4 truncate">
                  {[deal.buyer, deal.seller, deal.target_company].filter(Boolean).join(' · ') || deal.deal_number}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{fmt(deal.deal_value)}</span>
                  <span className="text-muted-foreground capitalize">{deal.status}</span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* Bottom row */}
      <motion.div variants={stagger} className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.section variants={fadeUp} className="pivt-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-5">Recent Activity</h3>
          <div className="space-y-4">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No recent activity. Events will appear here as you work.</p>
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground capitalize">{event.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.dealName} · {new Date(event.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>

        {/* Portfolio Intelligence — clean, minimal */}
        <motion.section variants={fadeUp} className="pivt-card-ai p-6 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="pivt-icon-chip w-8 h-8 pivt-icon-purple">
                <Brain className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Portfolio Intelligence</h3>
            </div>
            {deals.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">Insights will appear once you create deals.</p>
            ) : (
              <div className="space-y-4 text-sm">
                {metrics.dealsWithBlockers > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <span className="text-foreground">
                      <strong>{metrics.dealsWithBlockers}</strong> deal{metrics.dealsWithBlockers !== 1 ? 's' : ''} with blocking issues
                    </span>
                  </div>
                )}
                {metrics.openDiscrepancies > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-discrepancy mt-0.5 shrink-0" />
                    <span className="text-foreground">
                      <strong>{metrics.openDiscrepancies}</strong> open discrepanc{metrics.openDiscrepancies === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-foreground">
                    <strong>{metrics.pendingApprovals}</strong> approval{metrics.pendingApprovals !== 1 ? 's' : ''} pending
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-foreground">
                    <strong>{metrics.closingThisMonth}</strong> deal{metrics.closingThisMonth !== 1 ? 's' : ''} closing this month
                  </span>
                </div>
                {metrics.dealsWithBlockers === 0 && metrics.openDiscrepancies === 0 && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-validated mt-0.5 shrink-0" />
                    <span className="text-foreground">No blocking issues detected</span>
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
