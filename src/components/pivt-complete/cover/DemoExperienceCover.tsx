import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, springConfig } from '@/lib/animations';
import {
  Play, Pause, SkipForward, CheckCircle2, AlertTriangle,
  FileSearch, Zap, ArrowRight, RotateCcw, Sparkles,
} from 'lucide-react';

type DemoStep = 'ingestion' | 'extraction' | 'discrepancy' | 'resolution' | 'complete';

const STEPS: { id: DemoStep; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'ingestion', label: 'Deal Ingestion', icon: FileSearch, description: 'PE deal data package uploaded and parsed' },
  { id: 'extraction', label: 'Entity Extraction', icon: Zap, description: 'AI identifies entities, amounts, and relationships' },
  { id: 'discrepancy', label: 'Discrepancy Detection', icon: AlertTriangle, description: 'Cross-referencing cap table, waterfall, and wire instructions' },
  { id: 'resolution', label: 'Resolution Workflow', icon: Sparkles, description: 'Automated suggestions and approval routing' },
  { id: 'complete', label: 'Ready to Close', icon: CheckCircle2, description: 'All validations passed — deal ready for execution' },
];

const DISCREPANCIES = [
  { id: 1, field: 'Cap Table vs Waterfall', issue: 'Ownership % mismatch for Tiger Global (8.0% vs 7.8%)', severity: 'high' as const, resolved: false },
  { id: 2, field: 'Wire Instructions', issue: 'Missing bank details for Employee Option Pool trust', severity: 'critical' as const, resolved: false },
  { id: 3, field: 'Escrow Holdback', issue: 'Escrow amount differs between merger agreement ($280M) and schedule ($275M)', severity: 'medium' as const, resolved: false },
];

export const DemoExperienceCover: React.FC = () => {
  const deal = useSelectedDeal();
  const [currentStep, setCurrentStep] = useState<DemoStep>('ingestion');
  const [isPlaying, setIsPlaying] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set());

  const currentIdx = STEPS.findIndex(s => s.id === currentStep);

  const nextStep = () => {
    const next = STEPS[currentIdx + 1];
    if (next) setCurrentStep(next.id);
  };

  const resetDemo = () => {
    setCurrentStep('ingestion');
    setResolvedIds(new Set());
    setIsPlaying(false);
  };

  const resolveDiscrepancy = (id: number) => {
    setResolvedIds(prev => new Set([...prev, id]));
  };

  // Auto-advance timer
  React.useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      if (currentIdx < STEPS.length - 1) {
        nextStep();
      } else {
        setIsPlaying(false);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep]);

  const severityColors = {
    low: 'border-muted text-muted-foreground',
    medium: 'border-discrepancy/50 text-discrepancy',
    high: 'border-accent/50 text-accent',
    critical: 'border-blocking/50 text-blocking',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Live Demo Experience</h2>
          <p className="text-sm text-muted-foreground mt-1">{deal.codeName} — {deal.buyerName} acquiring {deal.targetCompany}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Pause' : 'Auto-Play'}
          </button>
          <button onClick={resetDemo} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="pivt-card p-6">
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => {
            const isActive = step.id === currentStep;
            const isDone = i < currentIdx;
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-accent/10 text-accent font-medium'
                      : isDone
                        ? 'text-validated'
                        : 'text-muted-foreground'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                  <span className="hidden md:inline">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <ArrowRight className={`w-3 h-3 ${i < currentIdx ? 'text-validated' : 'text-muted-foreground/30'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={springConfig.standard}
        >
          {currentStep === 'ingestion' && (
            <div className="pivt-card p-6 space-y-4">
              <h3 className="font-semibold text-lg">Deal Package Ingestion</h3>
              <p className="text-sm text-muted-foreground">
                Parsing deal documents including merger agreement, cap table, waterfall schedule, wire instructions, and escrow terms.
              </p>
              <div className="space-y-3">
                {['Merger Agreement (78 pages)', 'Cap Table — Final (12 sheets)', 'Waterfall Schedule v3', 'Wire Instructions Bundle', 'Escrow Agreement'].map((doc, i) => (
                  <motion.div
                    key={doc}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className="flex items-center gap-3 text-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span>{doc}</span>
                    <span className="ml-auto text-xs text-validated font-medium">Parsed</span>
                  </motion.div>
                ))}
              </div>
              <button onClick={nextStep} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium mt-4">
                Continue to Extraction <SkipForward className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 'extraction' && (
            <div className="pivt-card p-6 space-y-4">
              <h3 className="font-semibold text-lg">Entity Extraction Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Entities Found', value: '47', sub: 'Stakeholders, Funds, Trusts' },
                  { label: 'Financial Figures', value: '128', sub: 'Amounts, percentages, dates' },
                  { label: 'Relationships', value: '83', sub: 'Ownership, payout, escrow links' },
                  { label: 'Confidence Score', value: '96.2%', sub: 'Across all extracted data' },
                ].map(stat => (
                  <div key={stat.label} className="pivt-card p-4 bg-muted/30">
                    <p className="pivt-stat text-lg">{stat.value}</p>
                    <p className="text-xs font-medium mt-1">{stat.label}</p>
                    <p className="text-xs text-muted-foreground">{stat.sub}</p>
                  </div>
                ))}
              </div>
              <button onClick={nextStep} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium mt-2">
                Run Cross-Validation <SkipForward className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 'discrepancy' && (
            <div className="pivt-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Discrepancies Detected</h3>
                <span className="text-sm text-blocking font-medium">{DISCREPANCIES.length - resolvedIds.size} unresolved</span>
              </div>
              <div className="space-y-3">
                {DISCREPANCIES.map(d => (
                  <div key={d.id} className={`pivt-card p-4 border-l-4 ${resolvedIds.has(d.id) ? 'border-validated opacity-60' : severityColors[d.severity]} transition-all`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">{d.field}</p>
                        <p className="text-sm font-medium mt-1">{d.issue}</p>
                        <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${
                          d.severity === 'critical' ? 'bg-blocking/10 text-blocking' : d.severity === 'high' ? 'bg-accent/10 text-accent' : 'bg-discrepancy/10 text-discrepancy'
                        }`}>{d.severity}</span>
                      </div>
                      {!resolvedIds.has(d.id) ? (
                        <button onClick={() => resolveDiscrepancy(d.id)} className="text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
                          Resolve
                        </button>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-validated" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={nextStep} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium mt-2">
                View Resolution <SkipForward className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 'resolution' && (
            <div className="pivt-card p-6 space-y-4">
              <h3 className="font-semibold text-lg">Resolution Workflow</h3>
              <p className="text-sm text-muted-foreground">
                AI-generated resolution suggestions have been routed to the appropriate approvers.
              </p>
              <div className="space-y-3">
                {[
                  { action: 'Ownership % corrected to 8.0% in waterfall', approver: 'Seller Counsel', status: 'Approved' },
                  { action: 'Wire instructions requested from ESOP trustee', approver: 'Deal Admin', status: 'Pending' },
                  { action: 'Escrow amount aligned to merger agreement ($280M)', approver: 'Buyer Counsel', status: 'Approved' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 pivt-card">
                    <div className={`w-2 h-2 rounded-full ${r.status === 'Approved' ? 'bg-validated' : 'bg-discrepancy'}`} />
                    <div className="flex-1">
                      <p className="text-sm">{r.action}</p>
                      <p className="text-xs text-muted-foreground">{r.approver}</p>
                    </div>
                    <span className={`text-xs font-medium ${r.status === 'Approved' ? 'text-validated' : 'text-discrepancy'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
              <button onClick={nextStep} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium mt-2">
                Finalize <SkipForward className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="pivt-card p-8 text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={springConfig.snapBack}
              >
                <CheckCircle2 className="w-16 h-16 text-validated mx-auto" />
              </motion.div>
              <h3 className="font-semibold text-xl">Deal Ready for Closing</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                All {deal.documentsUploaded} documents validated, {deal.totalRecipients} recipients confirmed,
                and waterfall reconciled to ${(deal.consideration / 1e9).toFixed(1)}B.
              </p>
              <button onClick={resetDemo} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium mx-auto mt-4">
                <RotateCcw className="w-4 h-4" /> Replay Demo
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
