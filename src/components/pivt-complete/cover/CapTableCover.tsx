import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { Users, PieChart, Download, Filter, ArrowUpDown, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PieChart as RPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['hsl(262,72%,55%)', 'hsl(262,72%,70%)', 'hsl(160,84%,39%)', 'hsl(45,93%,47%)', 'hsl(217,91%,60%)', 'hsl(0,84%,60%)', 'hsl(280,60%,60%)', 'hsl(190,80%,45%)'];

type SortKey = 'name' | 'ownershipPct' | 'payoutAmount' | 'kycStatus';

export const CapTableCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders } = usePIVTStore();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('ownershipPct');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');

  const totalPayout = stakeholders.reduce((s, sh) => s + sh.payoutAmount, 0);
  const totalPct = stakeholders.reduce((s, sh) => s + sh.ownershipPct, 0);

  const roleTypes = ['all', ...new Set(stakeholders.map(s => s.role.includes('Founder') || s.role.includes('CEO') || s.role.includes('CTO') ? 'Founder' : s.role.includes('Investor') || s.role.includes('Lead') || s.role.includes('Capital') ? 'Investor' : s.role.includes('ESOP') ? 'ESOP' : 'Other'))];

  const filtered = stakeholders
    .filter(s => search === '' || s.name.toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase()))
    .filter(s => {
      if (selectedType === 'all') return true;
      if (selectedType === 'Founder') return s.role.includes('Founder') || s.role.includes('CEO') || s.role.includes('CTO');
      if (selectedType === 'Investor') return s.role.includes('Investor') || s.role.includes('Lead') || s.role.includes('Capital');
      if (selectedType === 'ESOP') return s.role.includes('ESOP');
      return true;
    })
    .sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
      if (sortKey === 'kycStatus') return mul * a.kycStatus.localeCompare(b.kycStatus);
      return mul * ((a[sortKey] as number) - (b[sortKey] as number));
    });

  const pieData = stakeholders.map(s => ({ name: s.name, value: s.ownershipPct }));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cap Table</h1>
          <p className="text-muted-foreground mt-1">{deal.codeName} — {deal.totalRecipients} shareholders · ${(deal.consideration / 1e9).toFixed(1)}B consideration</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Shareholders', value: stakeholders.length, icon: Users },
          { label: 'Total Ownership', value: `${totalPct}%`, icon: PieChart },
          { label: 'Total Payout', value: `$${(totalPayout / 1e9).toFixed(2)}B`, icon: PieChart },
          { label: 'KYC Verified', value: `${stakeholders.filter(s => s.kycStatus === 'verified').length}/${stakeholders.length}`, icon: CheckCircle2 },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie Chart */}
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h3 className="text-sm font-medium mb-3">Ownership Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RPieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(val: number) => [`${val}%`, 'Ownership']} />
            </RPieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {stakeholders.slice(0, 5).map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate flex-1">{s.name}</span>
                <span className="font-mono text-muted-foreground">{s.ownershipPct}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Table */}
        <motion.div {...fadeInUp} className="pivt-card overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shareholders..." className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-accent/50" />
            </div>
            <div className="flex gap-1">
              {['all', 'Founder', 'Investor', 'ESOP'].map(t => (
                <button key={t} onClick={() => setSelectedType(t)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedType === t ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}>
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    { key: 'name' as SortKey, label: 'Shareholder' },
                    { key: 'ownershipPct' as SortKey, label: 'Ownership %' },
                    { key: 'payoutAmount' as SortKey, label: 'Gross Payout' },
                    { key: 'payoutAmount' as SortKey, label: 'Net Payout' },
                    { key: 'kycStatus' as SortKey, label: 'KYC' },
                  ].map(col => (
                    <th key={col.label} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort(col.key)}>
                      <span className="flex items-center gap-1">{col.label} <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const escrow = s.payoutAmount * 0.1;
                  const fees = s.payoutAmount * 0.005;
                  const net = s.payoutAmount - escrow - fees;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.role}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">{s.ownershipPct}%</td>
                      <td className="px-4 py-3 font-mono">${(s.payoutAmount / 1e6).toFixed(0)}M</td>
                      <td className="px-4 py-3 font-mono text-validated">${(net / 1e6).toFixed(0)}M</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${s.kycStatus === 'verified' ? 'border-validated/50 text-validated' : s.kycStatus === 'pending' ? 'border-discrepancy/50 text-discrepancy' : 'border-blocking/50 text-blocking'}`}>
                          {s.kycStatus}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border bg-muted/30 flex justify-between text-sm font-semibold">
            <span>Totals</span>
            <div className="flex gap-12">
              <span className="font-mono">{totalPct}%</span>
              <span className="font-mono">${(totalPayout / 1e9).toFixed(2)}B</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
