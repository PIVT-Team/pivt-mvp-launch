/**
 * Multi-deal Analytics Dashboard
 */
import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  BarChart3, TrendingUp, PieChart, Target, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RPieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';

const CHART_COLORS = [
  'hsl(262, 72%, 55%)',  // accent purple
  'hsl(262, 72%, 70%)',
  'hsl(160, 84%, 39%)',
];

const statusColors: Record<string, string> = {
  drafting: 'hsl(215, 16%, 47%)',
  diligence: 'hsl(262, 72%, 70%)',
  signing: 'hsl(45, 93%, 47%)',
  closing: 'hsl(262, 72%, 55%)',
  completed: 'hsl(160, 84%, 39%)',
};

export const AnalyticsDashboard: React.FC = () => {
  const { deals, stakeholders, documents, payments, waterfallTiers, setActiveSection, setSelectedDealId } = usePIVTStore();

  const totalValue = deals.reduce((s, d) => s + d.consideration, 0);
  const avgReadiness = Math.round(deals.reduce((s, d) => s + d.readyToPayPercent, 0) / deals.length);
  const totalRecipients = deals.reduce((s, d) => s + d.totalRecipients, 0);
  const totalDocs = deals.reduce((s, d) => s + d.documentsUploaded, 0);

  // Bar chart data
  const dealComparisonData = deals.map(d => ({
    name: d.codeName,
    value: d.consideration / 1e9,
    readiness: d.readyToPayPercent,
    discrepancies: d.discrepanciesFound,
  }));

  // Pie chart data
  const statusDistribution = deals.map(d => ({
    name: `${d.codeName} (${d.status})`,
    value: d.consideration / 1e9,
    status: d.status,
  }));

  // Radar chart data
  const radarData = deals.map(d => ({
    deal: d.codeName,
    readiness: d.readyToPayPercent,
    docs: Math.min(100, (d.documentsUploaded / 150) * 100),
    compliance: d.discrepanciesFound === 0 ? 100 : Math.max(0, 100 - d.discrepanciesFound * 15),
    payments: (payments.filter(p => p.status === 'executed').length / Math.max(1, payments.length)) * 100,
  }));

  // Risk scores
  const riskScores = deals.map(d => {
    let score = 100;
    score -= d.discrepanciesFound * 10;
    score -= (100 - d.readyToPayPercent) * 0.5;
    const daysToClose = Math.ceil((new Date(d.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToClose < 14) score -= 10;
    if (daysToClose < 7) score -= 15;
    return { deal: d, score: Math.max(0, Math.min(100, Math.round(score))), daysToClose };
  });

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Portfolio Analytics</h1>
        <p className="text-muted-foreground mt-1">Cross-deal performance and risk overview</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Portfolio Value', value: `$${(totalValue / 1e9).toFixed(1)}B`, icon: TrendingUp, delta: '+12%' },
          { label: 'Avg Readiness', value: `${avgReadiness}%`, icon: Target, delta: avgReadiness >= 80 ? 'On Track' : 'At Risk' },
          { label: 'Total Recipients', value: totalRecipients, icon: PieChart, delta: `${deals.length} deals` },
          { label: 'Documents Processed', value: totalDocs, icon: BarChart3, delta: 'AI verified' },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-accent" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="pivt-stat text-xl">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              {typeof stat.delta === 'string' && stat.delta.startsWith('+') ? (
                <ArrowUpRight className="w-3 h-3 text-validated" />
              ) : null}
              {stat.delta}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deal Value Comparison */}
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h3 className="text-sm font-medium mb-4">Deal Value Comparison ($B)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dealComparisonData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {dealComparisonData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Status Distribution */}
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h3 className="text-sm font-medium mb-4">Portfolio by Status</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={220}>
              <RPieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={statusColors[entry.status] || CHART_COLORS[0]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(val: number) => [`$${val.toFixed(1)}B`, 'Value']}
                />
              </RPieChart>
            </ResponsiveContainer>
            <div className="w-1/2 space-y-2">
              {deals.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedDealId(d.id); setActiveSection('command'); }}
                  className="w-full flex items-center gap-2 text-xs py-1 hover:text-accent transition-colors"
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: statusColors[d.status] }} />
                  <span className="truncate">{d.codeName}</span>
                  <Badge variant="outline" className="text-[9px] ml-auto capitalize px-1.5">
                    {d.status}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Risk Scores */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <h3 className="text-sm font-medium mb-4">Deal Risk Assessment</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {riskScores.map(({ deal: d, score, daysToClose }) => (
            <button
              key={d.id}
              onClick={() => { setSelectedDealId(d.id); setActiveSection('command'); }}
              className="p-4 rounded-lg border border-border hover:border-accent/30 transition-colors text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{d.codeName}</span>
                <span className={`text-lg font-mono font-bold ${
                  score >= 80 ? 'text-validated' : score >= 60 ? 'text-amber-400' : 'text-blocking'
                }`}>
                  {score}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                <div
                  className={`h-1.5 rounded-full ${
                    score >= 80 ? 'bg-validated' : score >= 60 ? 'bg-amber-400' : 'bg-blocking'
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>${(d.consideration / 1e9).toFixed(1)}B · {d.sector}</span>
                <span className="flex items-center gap-1">
                  {daysToClose > 0 ? (
                    <>{daysToClose}d to close</>
                  ) : (
                    <>Overdue</>
                  )}
                </span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Readiness Comparison */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <h3 className="text-sm font-medium mb-4">Closing Readiness Comparison</h3>
        <div className="space-y-3">
          {deals.map(d => (
            <div key={d.id} className="flex items-center gap-3">
              <span className="text-xs font-medium w-16 shrink-0">{d.codeName}</span>
              <div className="flex-1 bg-muted rounded-full h-2.5 relative">
                <motion.div
                  className="bg-accent h-2.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${d.readyToPayPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <span className="text-xs font-mono w-10 text-right">{d.readyToPayPercent}%</span>
              <span className="text-[10px] text-muted-foreground w-20 text-right">{d.discrepanciesFound} issues</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
