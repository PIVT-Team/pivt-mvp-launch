/**
 * HomeCover — Product dashboard landing page
 * Elevated: spatial cards, gradient accents, staggered motion, depth hierarchy
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Briefcase, AlertTriangle, CheckCircle2, Clock, FileText, Brain, ArrowRight, TrendingUp,
} from 'lucide-react';

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M` : `$${(n / 1_000).toFixed(0)}K`;

const statusColor: Record<string, string> = {
  drafting: 'bg-muted-foreground',
  diligence: 'bg-amber-500',
  signing: 'bg-blue-500',
  closing: 'bg-accent',
  completed: 'bg-emerald-500',
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } },
};

export const HomeCover: React.FC = () => {
  const { deals, pendingApprovals, documents, setActiveSection, setSelectedDealId } = usePIVTStore();
  const { user } = useAuth();

  const greeting = useMemo(() => {
    const fullName = user?.user_metadata?.full_name as string | undefined;
    const firstName = fullName?.split(' ')?.[0];
    const demoFallback = 'Joanna';
    const name = firstName || (user ? null : demoFallback);
    return name ? `Welcome back, ${name}` : 'Welcome back';
  }, [user]);

  const activeDeals = deals.filter(d => d.status !== 'completed');
  const closingThisMonth = deals.filter(d => {
    const dt = new Date(d.closingDate);
    const now = new Date();
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  });
  const totalRiskFlags = deals.reduce((s, d) => s + d.discrepanciesFound, 0);
  const totalApprovals = pendingApprovals.length;

  const metrics = [
    { label: 'Active Deals', value: activeDeals.length, icon: Briefcase, accent: 'text-accent' },
    { label: 'Closing This Month', value: closingThisMonth.length, icon: Clock, accent: 'text-amber-500' },
    { label: 'Open Approvals', value: totalApprovals, icon: CheckCircle2, accent: 'text-blue-500' },
    { label: 'Risk Flags', value: totalRiskFlags, icon: AlertTriangle, accent: 'text-destructive' },
  ];

  const recentActivity = [
    ...pendingApprovals.slice(0, 2).map(a => ({
      icon: CheckCircle2, text: a.description, sub: a.dealName, time: a.createdAt, color: 'text-blue-500',
    })),
    ...documents.filter(d => d.status === 'pending').slice(0, 2).map(d => ({
      icon: FileText, text: `${d.name} uploaded`, sub: d.type, time: d.uploadedAt, color: 'text-amber-500',
    })),
  ];

  const openDeal = (id: string) => {
    setSelectedDealId(id);
    setActiveSection('workspace' as ActiveSection);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's your portfolio at a glance.</p>
      </motion.div>

      {/* Metrics — elevated metric cards */}
      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <motion.div
            key={m.label}
            variants={fadeUp}
            className="pivt-metric-card flex flex-col gap-3"
          >
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

      {/* Deal Grid — spatial cards with stagger */}
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
        <motion.div variants={stagger} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal) => (
            <motion.button
              key={deal.id}
              variants={fadeUp}
              onClick={() => openDeal(deal.id)}
              className="pivt-card p-5 text-left group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${statusColor[deal.status] || 'bg-muted'}`} />
                <span className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                  {deal.codeName}
                </span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">{deal.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{deal.targetCompany} · {deal.sector}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{fmt(deal.consideration)}</span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {deal.readyToPayPercent}%
                  </span>
                  {deal.discrepanciesFound > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="w-3 h-3" /> {deal.discrepanciesFound}
                    </span>
                  )}
                </div>
              </div>
              {/* Gradient progress bar */}
              <div className="mt-3 w-full h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full pivt-progress-gradient"
                  initial={{ width: 0 }}
                  animate={{ width: `${deal.readyToPayPercent}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
                />
              </div>
            </motion.button>
          ))}
        </motion.div>
      </motion.section>

      {/* Bottom row: Activity + AI Summary */}
      <motion.div variants={stagger} className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.section variants={fadeUp} className="pivt-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 pivt-section-bar">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.length === 0 && (
              <p className="text-xs text-muted-foreground">No recent activity.</p>
            )}
            {recentActivity.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className="flex items-start gap-3"
              >
                <div className="pivt-icon-chip w-7 h-7 mt-0.5">
                  <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.sub} · {item.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* AI Summary — elevated with glow */}
        <motion.section variants={fadeUp} className="pivt-card-ai p-6 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 pivt-section-bar">
              <div className="pivt-icon-chip w-7 h-7 pivt-icon-purple">
                <Brain className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Portfolio Intelligence Snapshot</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>{deals.filter(d => d.discrepanciesFound > 2).length} deals</strong> have elevated risk flags requiring attention
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>{totalApprovals} approvals</strong> pending across your portfolio
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>{closingThisMonth.length} deal{closingThisMonth.length !== 1 ? 's' : ''}</strong> closing this month
                </span>
              </div>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </motion.div>
  );
};
