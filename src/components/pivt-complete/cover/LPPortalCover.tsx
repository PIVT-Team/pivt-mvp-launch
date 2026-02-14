import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  TrendingUp, PieChart, FileText, Shield, Download, Lock,
  BarChart3, Calendar, CheckCircle2, Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const FUND_DATA = [
  { name: 'Fund XII', committed: 850, deployed: 720, returned: 1100, irr: 22.4, vintage: 2019 },
  { name: 'Fund XIII', committed: 1200, deployed: 980, returned: 650, irr: 18.2, vintage: 2021 },
  { name: 'Fund XIV', committed: 1500, deployed: 420, returned: 0, irr: 0, vintage: 2024 },
];

const DISTRIBUTIONS = [
  { date: '2026-01-15', fund: 'Fund XII', type: 'Capital Return', amount: 125_000_000, status: 'executed' },
  { date: '2026-02-01', fund: 'Fund XII', type: 'Profit Distribution', amount: 45_000_000, status: 'executed' },
  { date: '2026-02-15', fund: 'Fund XIII', type: 'Capital Return', amount: 80_000_000, status: 'pending' },
  { date: '2026-03-15', fund: 'Fund XII', type: 'Final Distribution', amount: 200_000_000, status: 'scheduled' },
];

const DOCUMENTS_LP = [
  { name: 'Q4 2025 Quarterly Report', type: 'Report', date: '2026-01-30', fund: 'Fund XIII' },
  { name: 'Capital Call Notice #7', type: 'Notice', date: '2026-01-15', fund: 'Fund XIV' },
  { name: 'K-1 Tax Package (2025)', type: 'Tax', date: '2026-02-28', fund: 'Fund XII' },
  { name: 'Annual Meeting Materials', type: 'Meeting', date: '2026-03-01', fund: 'Fund XIII' },
  { name: 'Distribution Notice', type: 'Notice', date: '2026-02-01', fund: 'Fund XII' },
];

export const LPPortalCover: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'distributions' | 'documents'>('overview');

  const totalCommitted = FUND_DATA.reduce((s, f) => s + f.committed, 0);
  const totalDeployed = FUND_DATA.reduce((s, f) => s + f.deployed, 0);
  const totalReturned = FUND_DATA.reduce((s, f) => s + f.returned, 0);

  const chartData = FUND_DATA.map(f => ({
    name: f.name,
    committed: f.committed,
    deployed: f.deployed,
    returned: f.returned,
  }));

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">LP Portal</h1>
          <p className="text-muted-foreground mt-1">Limited Partner fund overview, distributions, and documents</p>
        </div>
        <Badge variant="outline" className="text-xs border-validated/50 text-validated">
          <Lock className="w-3 h-3 mr-1" /> OTP Verified
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {(['overview', 'distributions', 'documents'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${activeTab === tab ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Committed', value: `$${(totalCommitted / 1000).toFixed(1)}B`, icon: PieChart },
              { label: 'Total Deployed', value: `$${(totalDeployed / 1000).toFixed(1)}B`, icon: TrendingUp },
              { label: 'Total Returned', value: `$${(totalReturned / 1000).toFixed(1)}B`, icon: BarChart3 },
              { label: 'Active Funds', value: FUND_DATA.length, icon: Shield },
            ].map(stat => (
              <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4 text-accent" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className="pivt-stat text-xl">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          <motion.div {...fadeInUp} className="pivt-card p-5">
            <h3 className="text-sm font-medium mb-4">Fund Comparison ($M)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="committed" fill="hsl(262, 72%, 55%)" radius={[2, 2, 0, 0]} name="Committed" />
                <Bar dataKey="deployed" fill="hsl(262, 72%, 70%)" radius={[2, 2, 0, 0]} name="Deployed" />
                <Bar dataKey="returned" fill="hsl(160, 84%, 39%)" radius={[2, 2, 0, 0]} name="Returned" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Fund Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FUND_DATA.map(fund => (
              <motion.div key={fund.name} {...fadeInUp} className="pivt-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{fund.name}</h4>
                  <Badge variant="outline" className="text-[10px]">Vintage {fund.vintage}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Committed</span><span className="font-mono">${fund.committed}M</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Deployed</span><span className="font-mono">${fund.deployed}M</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Returned</span><span className="font-mono text-validated">${fund.returned}M</span></div>
                  {fund.irr > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Net IRR</span><span className="font-mono text-validated">{fund.irr}%</span></div>}
                </div>
                <div className="mt-3 w-full bg-muted rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full" style={{ width: `${(fund.deployed / fund.committed) * 100}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{((fund.deployed / fund.committed) * 100).toFixed(0)}% deployed</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'distributions' && (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>Date</span><span>Fund</span><span>Type</span><span className="text-right">Amount</span><span className="text-center">Status</span>
          </div>
          {DISTRIBUTIONS.map((d, i) => (
            <div key={i} className="p-4 border-b border-border last:border-0 grid grid-cols-5 items-center hover:bg-muted/20 transition-colors">
              <span className="text-sm font-mono">{d.date}</span>
              <span className="text-sm">{d.fund}</span>
              <span className="text-sm text-muted-foreground">{d.type}</span>
              <span className="text-sm font-mono text-right">${(d.amount / 1e6).toFixed(0)}M</span>
              <div className="flex justify-center">
                <Badge variant="outline" className={`text-[10px] ${d.status === 'executed' ? 'border-validated/50 text-validated' : d.status === 'pending' ? 'border-accent/50 text-accent' : 'border-muted-foreground/50 text-muted-foreground'}`}>
                  {d.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Document</span><span>Fund</span><span className="text-right">Date</span>
          </div>
          {DOCUMENTS_LP.map((doc, i) => (
            <div key={i} className="p-4 border-b border-border last:border-0 grid grid-cols-4 items-center hover:bg-muted/20 transition-colors cursor-pointer group">
              <div className="col-span-2 flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium group-hover:text-accent transition-colors">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.type}</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">{doc.fund}</span>
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm font-mono text-muted-foreground">{doc.date}</span>
                <Download className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
