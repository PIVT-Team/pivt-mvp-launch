import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Plug, Bot, Zap, Shield, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, Settings, RefreshCw, Activity, Globe, Database, FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MCPAgent {
  id: string;
  name: string;
  description: string;
  category: 'extraction' | 'validation' | 'compliance' | 'communication' | 'analytics';
  status: 'active' | 'inactive' | 'error';
  lastRun?: string;
  icon: React.ElementType;
  metrics?: { processed: number; accuracy: number };
}

const MCP_AGENTS: MCPAgent[] = [
  { id: 'doc-extract', name: 'Document Extraction Agent', description: 'Parses merger agreements, cap tables, and wire instructions using OCR + NLP', category: 'extraction', status: 'active', lastRun: '2 min ago', icon: FileText, metrics: { processed: 342, accuracy: 97.2 } },
  { id: 'kyc-verify', name: 'KYC Verification Agent', description: 'Automated identity verification, OFAC screening, and PEP checks', category: 'compliance', status: 'active', lastRun: '5 min ago', icon: Shield, metrics: { processed: 156, accuracy: 99.1 } },
  { id: 'waterfall-calc', name: 'Waterfall Calculator Agent', description: 'Computes payment waterfalls with multi-tier priority and escrow deductions', category: 'analytics', status: 'active', lastRun: '1 hr ago', icon: Activity, metrics: { processed: 89, accuracy: 99.8 } },
  { id: 'discrepancy', name: 'Discrepancy Detection Agent', description: 'Cross-references deal documents to find mismatches in amounts, dates, and entities', category: 'validation', status: 'active', lastRun: '15 min ago', icon: AlertTriangle, metrics: { processed: 234, accuracy: 94.5 } },
  { id: 'wire-validate', name: 'Wire Instruction Validator', description: 'Validates SWIFT/BIC codes, IBAN checksums, and routing numbers against bank databases', category: 'validation', status: 'active', lastRun: '30 min ago', icon: Database, metrics: { processed: 128, accuracy: 98.7 } },
  { id: 'notification', name: 'Smart Notification Agent', description: 'Routes notifications and escalations based on deal urgency and user roles', category: 'communication', status: 'active', lastRun: '1 min ago', icon: Zap, metrics: { processed: 1205, accuracy: 100 } },
  { id: 'compliance-check', name: 'Regulatory Compliance Agent', description: 'Monitors HSR filings, CFIUS reviews, and cross-border regulatory requirements', category: 'compliance', status: 'inactive', icon: Globe },
  { id: 'predictive', name: 'Closing Prediction Agent', description: 'ML-based prediction of closing timeline based on historical deal patterns', category: 'analytics', status: 'inactive', icon: Activity },
];

const categoryColors: Record<string, string> = {
  extraction: 'text-accent',
  validation: 'text-discrepancy',
  compliance: 'text-validated',
  communication: 'text-blue-400',
  analytics: 'text-purple-400',
};

export const MCPIntegrationsCover: React.FC = () => {
  const [filter, setFilter] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<MCPAgent | null>(null);

  const activeCount = MCP_AGENTS.filter(a => a.status === 'active').length;
  const filtered = filter === 'all' ? MCP_AGENTS : MCP_AGENTS.filter(a => a.category === filter);

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">MCP Integrations</h1>
          <p className="text-muted-foreground mt-1">Model Context Protocol agents powering PIVT's intelligence layer</p>
        </div>
        <Badge variant="outline" className="border-validated/50 text-validated">
          <Bot className="w-3 h-3 mr-1" /> {activeCount}/{MCP_AGENTS.length} Active
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Agents', value: activeCount, icon: Bot, color: 'text-validated' },
          { label: 'Total Processed', value: MCP_AGENTS.reduce((s, a) => s + (a.metrics?.processed || 0), 0).toLocaleString(), icon: Zap, color: 'text-accent' },
          { label: 'Avg Accuracy', value: `${(MCP_AGENTS.filter(a => a.metrics).reduce((s, a) => s + (a.metrics?.accuracy || 0), 0) / MCP_AGENTS.filter(a => a.metrics).length).toFixed(1)}%`, icon: CheckCircle2, color: 'text-validated' },
          { label: 'Categories', value: new Set(MCP_AGENTS.map(a => a.category)).size, icon: Plug, color: 'text-accent' },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="pivt-stat text-xl">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        {['all', 'extraction', 'validation', 'compliance', 'communication', 'analytics'].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${filter === cat ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(agent => (
          <motion.div key={agent.id} {...fadeInUp} onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)} className={`pivt-card p-5 cursor-pointer transition-all ${selectedAgent?.id === agent.id ? 'border-accent/50 shadow-lg' : 'hover:border-accent/20'}`}>
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg bg-muted/50 ${categoryColors[agent.category]}`}>
                <agent.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{agent.name}</h4>
                  <Badge variant="outline" className={`text-[9px] ${agent.status === 'active' ? 'border-validated/50 text-validated' : agent.status === 'error' ? 'border-blocking/50 text-blocking' : 'border-muted-foreground/50 text-muted-foreground'}`}>
                    {agent.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{agent.description}</p>
                {agent.metrics && (
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-muted-foreground">{agent.metrics.processed.toLocaleString()} processed</span>
                    <span className="text-validated font-mono">{agent.metrics.accuracy}% accuracy</span>
                  </div>
                )}
                {agent.lastRun && <p className="text-[10px] text-muted-foreground mt-1">Last run: {agent.lastRun}</p>}
              </div>
              <div className={`w-2 h-2 rounded-full mt-1 ${agent.status === 'active' ? 'bg-validated' : agent.status === 'error' ? 'bg-blocking' : 'bg-muted-foreground'}`} />
            </div>

            {selectedAgent?.id === agent.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 pt-4 border-t border-border space-y-3">
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors">
                    <RefreshCw className="w-3 h-3" /> Re-run
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors">
                    <Settings className="w-3 h-3" /> Configure
                  </button>
                  {agent.status === 'inactive' && (
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-validated/10 text-validated text-xs font-medium hover:bg-validated/20 transition-colors">
                      <Zap className="w-3 h-3" /> Activate
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
