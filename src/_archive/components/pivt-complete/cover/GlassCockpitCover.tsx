import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Activity, Gauge, Shield, AlertTriangle, CheckCircle2,
  Clock, Zap, TrendingUp, Eye, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

export const GlassCockpitCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, payments, pendingApprovals, deals } = usePIVTStore();

  const kycVerified = stakeholders.filter(s => s.kycStatus === 'verified').length;
  const docsVerified = documents.filter(d => d.status === 'verified').length;
  const paymentsExecuted = payments.filter(p => p.status === 'executed').length;
  const daysToClose = Math.max(0, Math.ceil((new Date(deal.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  // Risk score
  let riskScore = 100;
  riskScore -= deal.discrepanciesFound * 10;
  riskScore -= (100 - deal.readyToPayPercent) * 0.5;
  if (daysToClose < 14) riskScore -= 15;
  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  const riskLevel = riskScore >= 80 ? 'Low' : riskScore >= 60 ? 'Medium' : 'High';
  const riskColor = riskScore >= 80 ? 'text-validated' : riskScore >= 60 ? 'text-discrepancy' : 'text-blocking';

  const gaugeData = [{ name: 'readiness', value: deal.readyToPayPercent, fill: 'hsl(262, 72%, 55%)' }];

  const systemStatus = [
    { name: 'Document Engine', status: 'operational', uptime: '99.97%' },
    { name: 'KYC Pipeline', status: 'operational', uptime: '99.95%' },
    { name: 'Payment Gateway', status: 'operational', uptime: '99.99%' },
    { name: 'Waterfall Calculator', status: 'operational', uptime: '100%' },
    { name: 'Notification Service', status: 'operational', uptime: '99.98%' },
    { name: 'MCP Agent Mesh', status: 'degraded', uptime: '98.2%' },
  ];

  const alerts = [
    { level: 'critical', message: `KYC verification failed for GIC Private Limited — manual review required`, time: '2h ago' },
    { level: 'warning', message: `Wire instructions missing for Employee Option Pool trust account`, time: '4h ago' },
    { level: 'info', message: `Project CIPHER approaching signing deadline (Feb 28)`, time: '6h ago' },
    { level: 'info', message: `Waterfall Schedule v3 pending buyer counsel approval`, time: '8h ago' },
  ];

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Glass Cockpit</h1>
          <p className="text-muted-foreground mt-1">Real-time operational overview — {deal.codeName}</p>
        </div>
        <Badge variant="outline" className="border-accent/50 text-accent">
          <Activity className="w-3 h-3 mr-1" /> Live
        </Badge>
      </div>

      {/* Primary Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Closing Readiness', value: `${deal.readyToPayPercent}%`, sub: `${daysToClose}d to close`, icon: Gauge, color: 'text-accent', trend: '+3%' },
          { label: 'Risk Score', value: `${riskScore}`, sub: riskLevel, icon: Shield, color: riskColor, trend: riskScore >= 80 ? '↓ Low' : '↑ Watch' },
          { label: 'KYC Compliance', value: `${kycVerified}/${stakeholders.length}`, sub: `${((kycVerified / stakeholders.length) * 100).toFixed(0)}% verified`, icon: CheckCircle2, color: 'text-validated' },
          { label: 'Active Alerts', value: alerts.filter(a => a.level === 'critical' || a.level === 'warning').length, sub: `${alerts.length} total`, icon: AlertTriangle, color: 'text-discrepancy' },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="pivt-stat text-2xl">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Readiness Gauge */}
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h3 className="text-sm font-medium mb-2">Deal Readiness</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="40%" height={160}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={gaugeData} startAngle={180} endAngle={0}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="space-y-2 text-sm flex-1">
              {[
                { label: 'Documents', value: `${docsVerified}/${documents.length}`, pct: (docsVerified / documents.length) * 100 },
                { label: 'KYC/KYB', value: `${kycVerified}/${stakeholders.length}`, pct: (kycVerified / stakeholders.length) * 100 },
                { label: 'Payments', value: `${paymentsExecuted}/${payments.length}`, pct: (paymentsExecuted / payments.length) * 100 },
                { label: 'Approvals', value: `${3 - pendingApprovals.length}/${3}`, pct: ((3 - pendingApprovals.length) / 3) * 100 },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono">{item.value}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-accent h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, item.pct))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Live Alerts */}
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h3 className="text-sm font-medium mb-3">Live Alerts</h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`p-3 rounded-lg border-l-4 text-sm ${alert.level === 'critical' ? 'border-blocking bg-blocking/5' : alert.level === 'warning' ? 'border-discrepancy bg-discrepancy/5' : 'border-muted-foreground bg-muted/30'}`}>
                <div className="flex items-start justify-between">
                  <p className="text-xs flex-1">{alert.message}</p>
                  <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">{alert.time}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* System Status */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <h3 className="text-sm font-medium mb-3">System Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {systemStatus.map(sys => (
            <div key={sys.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className={`w-2 h-2 rounded-full ${sys.status === 'operational' ? 'bg-validated' : 'bg-discrepancy animate-pulse'}`} />
              <div className="flex-1">
                <p className="text-xs font-medium">{sys.name}</p>
                <p className="text-[10px] text-muted-foreground">{sys.uptime} uptime</p>
              </div>
              <Badge variant="outline" className={`text-[9px] ${sys.status === 'operational' ? 'border-validated/50 text-validated' : 'border-discrepancy/50 text-discrepancy'}`}>
                {sys.status}
              </Badge>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Cross-Deal Overview */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <h3 className="text-sm font-medium mb-3">Cross-Deal Status</h3>
        <div className="space-y-3">
          {deals.map(d => {
            const dClose = Math.max(0, Math.ceil((new Date(d.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            return (
              <div key={d.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                <div className={`w-2 h-2 rounded-full ${d.readyToPayPercent >= 80 ? 'bg-validated' : d.readyToPayPercent >= 60 ? 'bg-discrepancy' : 'bg-blocking'}`} />
                <span className="text-sm font-medium w-20">{d.codeName}</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full" style={{ width: `${d.readyToPayPercent}%` }} />
                </div>
                <span className="text-xs font-mono w-10 text-right">{d.readyToPayPercent}%</span>
                <span className="text-xs text-muted-foreground w-24 text-right">{dClose}d to close</span>
                <Badge variant="outline" className="text-[9px] capitalize">{d.status}</Badge>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};
