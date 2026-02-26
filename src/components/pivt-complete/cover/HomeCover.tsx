/**
 * HomeCover — Product dashboard landing page
 * Shows deal metrics, recent activity, and AI portfolio summary
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's your portfolio at a glance.</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-5 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <m.icon className={`w-4 h-4 ${m.accent}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</span>
            </div>
            <span className="text-3xl font-bold text-foreground">{m.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Deal Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Deal Overview</h2>
          <button
            onClick={() => setActiveSection('deals' as ActiveSection)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal, i) => (
            <motion.button
              key={deal.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => openDeal(deal.id)}
              className="rounded-xl border bg-card p-5 text-left hover:border-accent/40 hover:shadow-md transition-all group"
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
            </motion.button>
          ))}
        </div>
      </section>

      {/* Bottom row: Activity + AI Summary */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <section className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.length === 0 && (
              <p className="text-xs text-muted-foreground">No recent activity.</p>
            )}
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <item.icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.sub} · {item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Summary */}
        <section className="rounded-xl border bg-card p-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), transparent)' }}
          />
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Portfolio Intelligence Snapshot</h3>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
              <span className="text-foreground">
                <strong>{deals.filter(d => d.discrepanciesFound > 2).length} deals</strong> have elevated risk flags requiring attention
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <span className="text-foreground">
                <strong>{totalApprovals} approvals</strong> pending across your portfolio
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-foreground">
                <strong>{closingThisMonth.length} deal{closingThisMonth.length !== 1 ? 's' : ''}</strong> closing this month
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
