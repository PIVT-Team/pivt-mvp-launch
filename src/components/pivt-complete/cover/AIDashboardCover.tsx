import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Brain, Shield, AlertTriangle, Activity, Sparkles, X,
  CheckCircle2, Clock, Zap, BarChart3, Search, FileWarning,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// ── Neural mesh animated background ──
const NeuralMeshBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    const NUM_NODES = 40;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < NUM_NODES; i++) {
      nodes.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      // Move nodes
      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.06;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(94, 59, 238, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(94, 59, 238, 0.12)';
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
};

// ── AI Activity Feed ──
interface ActivityEntry {
  id: string;
  message: string;
  type: 'flag' | 'confirm' | 'alert' | 'scan';
  timestamp: string;
  deal?: string;
}

const DEMO_ACTIVITY: ActivityEntry[] = [
  { id: 'a1', message: 'Newton flagged payout mismatch on ATLAS waterfall tier 3', type: 'flag', timestamp: '2 min ago', deal: 'ATLAS' },
  { id: 'a2', message: 'AI confirmed escrow release logic matches agreement terms', type: 'confirm', timestamp: '8 min ago', deal: 'CIPHER' },
  { id: 'a3', message: 'Risk threshold exceeded — BEACON KYC compliance score dropped below 70%', type: 'alert', timestamp: '15 min ago', deal: 'BEACON' },
  { id: 'a4', message: 'Automated scan completed: 42 documents validated across 3 deals', type: 'scan', timestamp: '23 min ago' },
  { id: 'a5', message: 'Newton identified duplicate wire instructions for a16z trust account', type: 'flag', timestamp: '31 min ago', deal: 'ATLAS' },
  { id: 'a6', message: 'AI validated cap table ownership percentages sum to 100%', type: 'confirm', timestamp: '45 min ago', deal: 'ATLAS' },
  { id: 'a7', message: 'Anomaly detected: GIC entity TIN format inconsistency', type: 'alert', timestamp: '1h ago', deal: 'ATLAS' },
  { id: 'a8', message: 'Real-time monitoring active for 3 deals, 38 stakeholders', type: 'scan', timestamp: '2h ago' },
];

const ACTIVITY_ICONS: Record<ActivityEntry['type'], { icon: React.ReactNode; color: string }> = {
  flag: { icon: <FileWarning className="w-3.5 h-3.5" />, color: 'text-discrepancy' },
  confirm: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-validated' },
  alert: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-blocking' },
  scan: { icon: <Search className="w-3.5 h-3.5" />, color: 'text-accent' },
};

// ── Module Cards ──
interface AIModule {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  stats: { label: string; value: string }[];
  status: 'active' | 'scanning' | 'idle';
}

const AI_MODULES: AIModule[] = [
  {
    id: 'risk-scanner',
    title: 'Deal Risk Scanner',
    description: 'Multi-dimensional risk analysis across identity, compliance, banking, and fund integrity.',
    icon: <Shield className="w-5 h-5" />,
    stats: [
      { label: 'Active Deals', value: '3' },
      { label: 'Risk Flags', value: '7' },
      { label: 'Last Scan', value: '2m ago' },
    ],
    status: 'active',
  },
  {
    id: 'waterfall-engine',
    title: 'Waterfall Validation Engine',
    description: 'Automated reconciliation of payout calculations against cap table, agreements, and tax obligations.',
    icon: <BarChart3 className="w-5 h-5" />,
    stats: [
      { label: 'Validated', value: '89%' },
      { label: 'Discrepancies', value: '3' },
      { label: 'Accuracy', value: '99.7%' },
    ],
    status: 'scanning',
  },
  {
    id: 'discrepancy-monitor',
    title: 'Discrepancy Monitor',
    description: 'Continuous monitoring of data inconsistencies across documents, entities, and transaction records.',
    icon: <Activity className="w-5 h-5" />,
    stats: [
      { label: 'Monitoring', value: '156 fields' },
      { label: 'Unresolved', value: '4' },
      { label: 'Auto-resolved', value: '12' },
    ],
    status: 'active',
  },
];

// ── Scan Result Panel ──
interface ScanResult {
  category: string;
  score: number;
  findings: string[];
}

const MOCK_SCAN_RESULTS: ScanResult[] = [
  { category: 'Identity Verification', score: 92, findings: ['GIC entity TIN mismatch needs resolution', 'All other entities verified'] },
  { category: 'Compliance', score: 78, findings: ['BEACON KYC below threshold', 'ATLAS compliance complete', 'CIPHER pending final review'] },
  { category: 'Banking & Wire', score: 85, findings: ['Missing bank details for 1 entity', 'Duplicate wire instructions detected'] },
  { category: 'Fund Integrity', score: 96, findings: ['Escrow balances confirmed', 'Waterfall calculations within tolerance'] },
];

// ── Main Component ──
export const AIDashboardCover: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState<string | null>(null);

  const runScan = useCallback(() => {
    setScanning(true);
    setScanComplete(false);
    setTimeout(() => {
      setScanning(false);
      setScanComplete(true);
    }, 3000);
  }, []);

  const selectedModule = AI_MODULES.find(m => m.id === drawerOpen);

  return (
    <motion.div {...staggerChildren} className="space-y-6 relative">
      {/* Neural mesh background */}
      <div className="absolute inset-0 -m-10 overflow-hidden pointer-events-none rounded-2xl">
        <NeuralMeshBackground />
      </div>

      {/* Header */}
      <motion.div {...fadeInUp} className="relative">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
                  boxShadow: '0 0 24px hsl(var(--g2-from) / 0.3)',
                }}
              >
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">AI Intelligence Layer</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Real-time oversight, anomaly detection, and transaction reasoning.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
              boxShadow: '0 4px 16px hsl(var(--g2-from) / 0.3)',
            }}
          >
            {scanning ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                />
                Scanning...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run AI Scan
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Scan Results */}
      <AnimatePresence>
        {scanComplete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pivt-card p-5 space-y-4 border-l-4 border-accent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-validated" />
                  <h3 className="font-semibold text-sm">Scan Complete — 4 Pillars Assessed</h3>
                </div>
                <button onClick={() => setScanComplete(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {MOCK_SCAN_RESULTS.map(result => (
                  <div key={result.category} className="pivt-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{result.category}</span>
                      <span className={`text-xs font-bold ${result.score >= 90 ? 'text-validated' : result.score >= 80 ? 'text-accent' : 'text-discrepancy'}`}>
                        {result.score}%
                      </span>
                    </div>
                    <Progress value={result.score} className="h-1" />
                    <ul className="space-y-0.5">
                      {result.findings.map((f, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground">• {f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Modules Grid */}
      <motion.div {...fadeInUp} className="relative">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">AI Modules</h2>
        <div className="grid grid-cols-3 gap-4">
          {AI_MODULES.map(mod => (
            <motion.button
              key={mod.id}
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDrawerOpen(mod.id)}
              className="text-left pivt-card p-5 space-y-3 relative overflow-hidden group"
              style={{
                borderImage: 'linear-gradient(135deg, hsl(var(--g2-from) / 0.2), hsl(var(--g3-to) / 0.1)) 1',
              }}
            >
              {/* Gradient border overlay */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--g2-from) / 0.05), hsl(var(--g3-to) / 0.03))',
                }}
              />

              <div className="flex items-center gap-3 relative">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                  style={{
                    background: 'linear-gradient(135deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
                    boxShadow: '0 0 12px hsl(var(--g2-from) / 0.2)',
                  }}
                >
                  {mod.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{mod.title}</h3>
                  <Badge className={`text-[9px] mt-0.5 ${
                    mod.status === 'active' ? 'bg-validated/10 text-validated border-validated/20'
                    : mod.status === 'scanning' ? 'bg-accent/10 text-accent border-accent/20'
                    : 'bg-muted/60 text-muted-foreground border-border/50'
                  } border`}>
                    {mod.status === 'scanning' && <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="mr-1">●</motion.span>}
                    {mod.status}
                  </Badge>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed relative">{mod.description}</p>

              <div className="flex gap-3 relative">
                {mod.stats.map(stat => (
                  <div key={stat.label} className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className="text-sm font-semibold font-mono mt-0.5">{stat.value}</p>
                  </div>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Live AI Activity Feed */}
      <motion.div {...fadeInUp} className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live AI Activity</h2>
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-validated ml-1"
          />
        </div>
        <div className="pivt-card p-4 max-h-[320px] overflow-y-auto space-y-1">
          {DEMO_ACTIVITY.map((entry, i) => {
            const cfg = ACTIVITY_ICONS[entry.type];
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0"
              >
                <div className={`mt-0.5 ${cfg.color}`}>{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{entry.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{entry.timestamp}</span>
                    {entry.deal && (
                      <Badge className="text-[9px] bg-accent/10 text-accent border border-accent/20 px-1.5 py-0 h-4">
                        {entry.deal}
                      </Badge>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Module Slide Drawer */}
      <AnimatePresence>
        {drawerOpen && selectedModule && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setDrawerOpen(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-[420px] z-50 overflow-y-auto"
              style={{
                background: 'hsl(var(--card))',
                borderLeft: '1px solid hsl(var(--border))',
                boxShadow: '-8px 0 30px hsl(var(--g2-from) / 0.1)',
              }}
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--g2-from)), hsl(var(--g2-to)))' }}
                    >
                      {selectedModule.icon}
                    </div>
                    <h2 className="font-semibold text-lg">{selectedModule.title}</h2>
                  </div>
                  <button onClick={() => setDrawerOpen(null)} className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground">{selectedModule.description}</p>

                <div className="grid grid-cols-3 gap-3">
                  {selectedModule.stats.map(stat => (
                    <div key={stat.label} className="pivt-card p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                      <p className="text-lg font-bold font-mono mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Recent Findings</h3>
                  {DEMO_ACTIVITY.filter(a => a.type === 'flag' || a.type === 'alert').slice(0, 4).map(entry => {
                    const cfg = ACTIVITY_ICONS[entry.type];
                    return (
                      <div key={entry.id} className="pivt-card p-3 flex items-start gap-2">
                        <div className={`mt-0.5 ${cfg.color}`}>{cfg.icon}</div>
                        <div>
                          <p className="text-xs">{entry.message}</p>
                          <span className="text-[10px] text-muted-foreground">{entry.timestamp}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))' }}
                >
                  Run Deep Analysis
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
