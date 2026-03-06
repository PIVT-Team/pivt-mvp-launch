import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { CheckCircle2, AlertTriangle, FileText, Users, Landmark, Shield } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ReadinessCategory {
  label: string;
  icon: React.ElementType;
  current: number;
  total: number;
  status: 'ready' | 'needs_review' | 'missing';
}

const DEMO_CATEGORIES: ReadinessCategory[] = [
  { label: 'Documents Complete', icon: FileText, current: 5, total: 7, status: 'needs_review' },
  { label: 'Stakeholders Verified', icon: Users, current: 4, total: 6, status: 'needs_review' },
  { label: 'Obligations Confirmed', icon: Shield, current: 2, total: 6, status: 'missing' },
  { label: 'Wire Instructions Verified', icon: Landmark, current: 0, total: 3, status: 'missing' },
];

const statusConfig = {
  ready: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Ready' },
  needs_review: { color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Needs Review' },
  missing: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Missing' },
};

export const ReadinessPanel: React.FC = () => {
  const totalCurrent = DEMO_CATEGORIES.reduce((s, c) => s + c.current, 0);
  const totalRequired = DEMO_CATEGORIES.reduce((s, c) => s + c.total, 0);
  const overallPct = totalRequired > 0 ? Math.round((totalCurrent / totalRequired) * 100) : 0;

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Execution Readiness</h2>
        <p className="text-sm text-muted-foreground mt-1">Overall deal closing readiness score.</p>
      </motion.div>

      {/* Overall Score */}
      <motion.div {...fadeInUp} className="pivt-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-4xl font-bold text-foreground">{overallPct}%</p>
            <p className="text-sm text-muted-foreground mt-1">Execution Readiness</p>
          </div>
          <Badge className={`text-xs ${overallPct >= 80 ? 'bg-emerald-500/10 text-emerald-600' : overallPct >= 50 ? 'bg-amber-500/10 text-amber-600' : 'bg-red-400/10 text-red-400'}`}>
            {overallPct >= 80 ? 'On Track' : overallPct >= 50 ? 'In Progress' : 'Action Required'}
          </Badge>
        </div>
        <Progress value={overallPct} className="h-3" />
        <p className="text-xs text-muted-foreground mt-2">{totalCurrent} of {totalRequired} requirements satisfied</p>
      </motion.div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEMO_CATEGORIES.map(cat => {
          const pct = cat.total > 0 ? Math.round((cat.current / cat.total) * 100) : 0;
          const cfg = statusConfig[cat.status];
          const Icon = cat.icon;
          return (
            <motion.div key={cat.label} {...fadeInUp} className="pivt-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <p className="text-sm font-medium">{cat.label}</p>
                </div>
                <Badge className={`text-[10px] ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground">{cat.current} / {cat.total}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <h4 className="text-sm font-semibold mb-3">Status Legend</h4>
        <div className="flex flex-wrap gap-4">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${cfg.bg}`} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
