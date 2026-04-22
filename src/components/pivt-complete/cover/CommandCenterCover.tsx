import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { Shield, FileCheck, TrendingUp, Clock, Plus } from 'lucide-react';
import { ActivityFeed } from './ActivityFeed';
import type { RealDeal } from '@/hooks/useDealOperations';
import { supabase } from '@/integrations/supabase/client';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const CommandCenterCover: React.FC = () => {
  const { setActiveSection, setSelectedDealId } = usePIVTStore();
  const [deals, setDeals] = useState<RealDeal[]>([]);

  useEffect(() => {
    supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setDeals((data as RealDeal[]) || []));
  }, []);

  const totalValue = deals.reduce((s, d) => s + Number(d.deal_value), 0);
  const activeCount = deals.filter(d => d.status === 'active').length;
  const draftCount = deals.filter(d => d.status === 'draft').length;

  const handleNewDeal = () => {
    // Navigate to Deals page where the Create Deal dialog lives
    setActiveSection('deals');
  };

  const stats = [
    { label: 'Total Deals', value: deals.length, icon: TrendingUp, chip: 'pivt-icon-purple' },
    { label: 'Total Value', value: formatCurrency(totalValue), icon: Shield, chip: 'pivt-icon-blue' },
    { label: 'Active', value: activeCount, icon: FileCheck, chip: 'pivt-icon-green' },
    { label: 'Draft', value: draftCount, icon: Clock, chip: 'pivt-icon-amber' },
  ];

  return (
    <motion.div {...staggerChildren} className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Command Center</h1>
          <p className="text-muted-foreground mt-1">Portfolio overview and deal management</p>
        </div>
        <button
          onClick={handleNewDeal}
          className="pivt-btn-primary flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'View Deals', section: 'deals' as const },
          { label: 'Portfolio Payments', section: 'portfolio-payments' as const },
          { label: 'Risk Monitor', section: 'risk-monitor' as const },
          { label: 'Intelligence Map', section: 'intelligence-map' as const },
        ].map(action => (
          <button
            key={action.label}
            onClick={() => setActiveSection(action.section)}
            className="pivt-card p-4 text-sm font-medium text-center hover:border-accent/40 hover:text-accent transition-all"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`pivt-icon-chip ${stat.chip}`}>
                <stat.icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground tracking-wide mb-1">{stat.label}</p>
            <p className="pivt-stat">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Deals */}
      {deals.length > 0 && (
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base">Recent Deals</h3>
            <button onClick={() => setActiveSection('deals')} className="text-xs text-accent hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {deals.slice(0, 5).map(deal => (
              <button
                key={deal.id}
                onClick={() => { setSelectedDealId(deal.id); setActiveSection('workspace'); }}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">{deal.deal_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{deal.deal_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono">{formatCurrency(deal.deal_value)}</p>
                  <span className="text-[10px] text-muted-foreground">{deal.status}</span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Activity Feed */}
      <div className="grid grid-cols-1 gap-5">
        <motion.div {...fadeInUp} className="pivt-card p-6 max-h-[500px] overflow-y-auto">
          <ActivityFeed />
        </motion.div>
      </div>

    </motion.div>
  );
};
