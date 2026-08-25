/**
 * AutonomyCover - Fully interactive autonomy settings for NEWTON AI automation levels
 * Replicated from GitHub repo: Joannagrace91/MVP-FEB
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springConfig } from '@/lib/animations';
import {
  Zap, Shield, AlertTriangle, Clock, Bell, Eye, Play, Pause,
  Settings, Sliders, Brain, Bot, ToggleLeft, ToggleRight,
} from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  category: 'verification' | 'communication' | 'payments' | 'documents' | 'alerts';
  enabled: boolean;
  autonomyLevel: 'manual' | 'suggest' | 'auto-with-approval' | 'full-auto';
  riskLevel: 'low' | 'medium' | 'high';
  lastTriggered?: string;
  triggerCount: number;
}

const automationRules: AutomationRule[] = [
  {
    id: '1', name: 'Auto-verify stakeholder data',
    description: 'Automatically verify stakeholder information against source documents',
    category: 'verification', enabled: true, autonomyLevel: 'auto-with-approval',
    riskLevel: 'medium', lastTriggered: '2 hours ago', triggerCount: 45,
  },
  {
    id: '2', name: 'Send KYC reminders',
    description: 'Automatically send reminder emails to stakeholders with incomplete KYC',
    category: 'communication', enabled: true, autonomyLevel: 'full-auto',
    riskLevel: 'low', lastTriggered: '1 day ago', triggerCount: 23,
  },
  {
    id: '3', name: 'Flag discrepancies',
    description: 'Automatically detect and flag discrepancies between documents',
    category: 'verification', enabled: true, autonomyLevel: 'full-auto',
    riskLevel: 'low', lastTriggered: '30 minutes ago', triggerCount: 156,
  },
  {
    id: '4', name: 'Auto-approve small payments',
    description: 'Automatically approve payments under $10,000 threshold',
    category: 'payments', enabled: false, autonomyLevel: 'manual',
    riskLevel: 'high', triggerCount: 0,
  },
  {
    id: '5', name: 'Document classification',
    description: 'Automatically classify and categorize uploaded documents',
    category: 'documents', enabled: true, autonomyLevel: 'full-auto',
    riskLevel: 'low', lastTriggered: '15 minutes ago', triggerCount: 89,
  },
  {
    id: '6', name: 'Escalation alerts',
    description: 'Automatically escalate unresolved issues after 24 hours',
    category: 'alerts', enabled: true, autonomyLevel: 'auto-with-approval',
    riskLevel: 'medium', lastTriggered: '3 days ago', triggerCount: 12,
  },
  {
    id: '7', name: 'Wire instruction validation',
    description: 'Automatically validate bank routing numbers and account formats',
    category: 'verification', enabled: true, autonomyLevel: 'full-auto',
    riskLevel: 'low', lastTriggered: '1 hour ago', triggerCount: 67,
  },
  {
    id: '8', name: 'Generate closing documents',
    description: 'Automatically generate closing package when all verifications complete',
    category: 'documents', enabled: true, autonomyLevel: 'suggest',
    riskLevel: 'medium', lastTriggered: '1 week ago', triggerCount: 3,
  },
];

const autonomyLevels = [
  { id: 'manual', name: 'Manual', description: 'All actions require manual initiation', icon: '🖐️' },
  { id: 'suggest', name: 'Suggest', description: 'NEWTON suggests actions, you approve', icon: '💡' },
  { id: 'auto-with-approval', name: 'Auto + Approval', description: 'Executes automatically, notifies for review', icon: '⚡' },
  { id: 'full-auto', name: 'Full Auto', description: 'Fully autonomous execution', icon: '🤖' },
];

const categoryIcons: Record<string, React.ReactNode> = {
  verification: <Shield className="w-4 h-4" />,
  communication: <Bell className="w-4 h-4" />,
  payments: <Zap className="w-4 h-4" />,
  documents: <Eye className="w-4 h-4" />,
  alerts: <AlertTriangle className="w-4 h-4" />,
};

const riskColors: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-validated/10', text: 'text-validated' },
  medium: { bg: 'bg-discrepancy/10', text: 'text-discrepancy' },
  high: { bg: 'bg-blocking/10', text: 'text-blocking' },
};

export const AutonomyCover: React.FC = () => {
  const [rules, setRules] = useState(automationRules);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [globalAutonomy, setGlobalAutonomy] = useState<string>('auto-with-approval');
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  const updateRuleAutonomy = (ruleId: string, level: string) => {
    setRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, autonomyLevel: level as AutomationRule['autonomyLevel'] } : rule
    ));
  };

  const enabledCount = rules.filter(r => r.enabled).length;
  const fullAutoCount = rules.filter(r => r.autonomyLevel === 'full-auto' && r.enabled).length;
  const totalTriggers = rules.reduce((sum, r) => sum + r.triggerCount, 0);
  const automationRate = Math.round((enabledCount / rules.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Autonomy Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure NEWTON AI automation levels</p>
        </div>
        <button
          onClick={() => setShowGlobalSettings(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Sliders className="w-4 h-4" />
          Global Settings
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Rules', value: enabledCount, icon: Bot, color: 'text-accent' },
          { label: 'Full Auto', value: fullAutoCount, icon: Zap, color: 'text-validated' },
          { label: 'Total Triggers', value: totalTriggers, icon: Clock, color: 'text-discrepancy' },
          { label: 'Automation Rate', value: `${automationRate}%`, icon: Brain, color: 'text-muted-foreground' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="pivt-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Global Autonomy Level */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 bg-gradient-to-br from-accent/10 to-validated/10"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-background/80 flex items-center justify-center">
              <Brain className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Global Autonomy Level</h3>
              <p className="text-sm text-muted-foreground">Default automation behavior for new rules</p>
            </div>
          </div>
          <span className="text-2xl">
            {autonomyLevels.find(l => l.id === globalAutonomy)?.icon}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {autonomyLevels.map((level) => (
            <button
              key={level.id}
              onClick={() => setGlobalAutonomy(level.id)}
              className={`p-3 rounded-xl text-left transition-all ${
                globalAutonomy === level.id
                  ? 'bg-background shadow-sm ring-2 ring-accent'
                  : 'bg-background/50 hover:bg-background/80'
              }`}
            >
              <span className="text-xl mb-2 block">{level.icon}</span>
              <p className="text-sm font-medium text-foreground">{level.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{level.description}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Automation Rules */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Automation Rules</h3>
        {rules.map((rule, index) => (
          <motion.div
            key={rule.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springConfig.standard, delay: index * 0.03 }}
            className="pivt-card p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  rule.enabled ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                }`}>
                  {categoryIcons[rule.category]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-medium ${rule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {rule.name}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColors[rule.riskLevel].bg} ${riskColors[rule.riskLevel].text}`}>
                      {rule.riskLevel} risk
                    </span>
                  </div>
                  <p className={`text-sm ${rule.enabled ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                    {rule.description}
                  </p>
                  {rule.lastTriggered && rule.enabled && (
                    <p className="text-xs text-muted-foreground/70 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last triggered: {rule.lastTriggered} • {rule.triggerCount} total
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <select
                  value={rule.autonomyLevel}
                  onChange={(e) => updateRuleAutonomy(rule.id, e.target.value)}
                  disabled={!rule.enabled}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-0 focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                    rule.enabled ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {autonomyLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.icon} {level.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => toggleRule(rule.id)}
                  className={rule.enabled ? 'text-accent' : 'text-muted-foreground/30'}
                >
                  {rule.enabled ? (
                    <ToggleRight className="w-10 h-10" />
                  ) : (
                    <ToggleLeft className="w-10 h-10" />
                  )}
                </button>

                <button
                  onClick={() => setSelectedRule(rule)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Settings className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rule Detail Modal */}
      <AnimatePresence>
        {selectedRule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedRule(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selectedRule.enabled ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                    }`}>
                      {categoryIcons[selectedRule.category]}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{selectedRule.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColors[selectedRule.riskLevel].bg} ${riskColors[selectedRule.riskLevel].text}`}>
                        {selectedRule.riskLevel} risk
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedRule(null)} className="p-2 rounded-lg hover:bg-muted">
                    <span className="text-muted-foreground text-xl">×</span>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">{selectedRule.description}</p>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Autonomy Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {autonomyLevels.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => updateRuleAutonomy(selectedRule.id, level.id)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          selectedRule.autonomyLevel === level.id
                            ? 'bg-accent/10 ring-2 ring-accent'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <span className="text-lg">{level.icon}</span>
                        <p className="text-sm font-medium text-foreground mt-1">{level.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className={`text-sm font-medium ${selectedRule.enabled ? 'text-validated' : 'text-muted-foreground'}`}>
                      {selectedRule.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Triggers</span>
                    <span className="text-sm font-medium text-foreground">{selectedRule.triggerCount}</span>
                  </div>
                  {selectedRule.lastTriggered && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Triggered</span>
                      <span className="text-sm font-medium text-foreground">{selectedRule.lastTriggered}</span>
                    </div>
                  )}
                </div>

                {selectedRule.riskLevel === 'high' && (
                  <div className="p-3 bg-blocking/10 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-blocking flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blocking">High Risk Action</p>
                      <p className="text-xs text-blocking/80">This rule involves financial transactions. Enable with caution.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => { toggleRule(selectedRule.id); setSelectedRule(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
                    selectedRule.enabled
                      ? 'bg-blocking/10 text-blocking hover:bg-blocking/20'
                      : 'bg-validated/10 text-validated hover:bg-validated/20'
                  }`}
                >
                  {selectedRule.enabled ? <><Pause className="w-4 h-4" /> Disable</> : <><Play className="w-4 h-4" /> Enable</>}
                </button>
                <button
                  onClick={() => setSelectedRule(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-muted/80 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Settings Modal */}
      <AnimatePresence>
        {showGlobalSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowGlobalSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">Global Autonomy Settings</h3>
                <button onClick={() => setShowGlobalSettings(false)} className="p-1 rounded-lg hover:bg-muted">
                  <span className="text-muted-foreground text-xl">×</span>
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Require approval for high-risk', desc: 'Always require manual approval for high-risk actions', on: true },
                  { label: 'Notification on auto-actions', desc: 'Get notified when NEWTON takes autonomous actions', on: true },
                  { label: 'Daily autonomy report', desc: 'Receive daily summary of automated actions', on: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <button className={item.on ? 'text-accent' : 'text-muted-foreground/30'}>
                      {item.on ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-foreground">Emergency stop</p>
                    <p className="text-xs text-muted-foreground">Pause all autonomous actions immediately</p>
                  </div>
                  <button className="px-3 py-1.5 bg-blocking text-white rounded-lg text-sm font-medium hover:bg-blocking/90 transition-colors">
                    Stop All
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowGlobalSettings(false)}
                className="w-full mt-6 px-4 py-3 rounded-xl bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
              >
                Save Settings
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AutonomyCover;
