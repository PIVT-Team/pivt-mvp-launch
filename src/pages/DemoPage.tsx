/**
 * Self-playing PIVT demo page — /demo route.
 * Orchestrates the cinematic deal workflow walkthrough.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, RotateCcw, SkipForward, Sparkles,
  ArrowRight, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DemoNewtonPanel, type DemoMsg } from '@/components/demo/DemoNewtonPanel';
import { DemoWorkspace } from '@/components/demo/DemoWorkspace';
import { DemoStepper, type DemoStep } from '@/components/demo/DemoStepper';
import type { DemoApproval } from '@/components/demo/demoData';
import {
  STEP_MESSAGES, DEMO_DISCREPANCIES, DEMO_APPROVALS, DEMO_DEAL,
} from '@/components/demo/demoData';

const STEP_ORDER: DemoStep[] = ['intro', 'create', 'upload', 'obligations', 'discrepancies', 'approvals', 'wirepack', 'outro'];

const STEP_DURATIONS: Record<DemoStep, number> = {
  intro: 0, // manual
  create: 6000,
  upload: 10000,
  obligations: 5000,
  discrepancies: 7000,
  approvals: 8000,
  wirepack: 7000,
  outro: 0,
};

const DemoPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<DemoStep>('intro');
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<DemoMsg[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const [resolvedDiscrepancies, setResolvedDiscrepancies] = useState<Set<string>>(new Set());
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, string>>({});
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const currentIdx = STEP_ORDER.indexOf(step);

  const advanceStep = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx < STEP_ORDER.length) {
      setStep(STEP_ORDER[nextIdx]);
      setStepProgress(0);
    }
  }, [currentIdx]);

  // Queue messages for current step
  useEffect(() => {
    if (step === 'intro' || step === 'outro') return;
    clearTimers();

    const stepMsgs = STEP_MESSAGES[step] || [];
    stepMsgs.forEach(msg => {
      // Show typing before newton messages
      if (msg.type === 'newton') {
        const typingTimer = setTimeout(() => setIsTyping(true), msg.delay - 800);
        timersRef.current.push(typingTimer);
      }

      const timer = setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { ...msg, visible: true }]);
      }, msg.delay);
      timersRef.current.push(timer);
    });

    // Progress animation
    const duration = STEP_DURATIONS[step];
    const interval = setInterval(() => {
      setStepProgress(prev => Math.min(prev + (100 / (duration / 100)), 1));
    }, 100);
    timersRef.current.push(interval as unknown as NodeJS.Timeout);

    return clearTimers;
  }, [step, clearTimers]);

  // Auto-resolve discrepancies during discrepancies step
  useEffect(() => {
    if (step !== 'discrepancies') return;
    DEMO_DISCREPANCIES.forEach((d, i) => {
      const timer = setTimeout(() => {
        setResolvedDiscrepancies(prev => new Set([...prev, d.id]));
      }, 2000 + i * 1500);
      timersRef.current.push(timer);
    });
  }, [step]);

  // Auto-progress approval statuses
  useEffect(() => {
    if (step !== 'approvals') return;
    const statuses: Array<'sent' | 'viewed' | 'signed'> = ['sent', 'viewed', 'signed'];
    DEMO_APPROVALS.forEach((a, ai) => {
      statuses.forEach((s, si) => {
        const timer = setTimeout(() => {
          setApprovalStatuses(prev => ({ ...prev, [a.recipient]: s }));
        }, 1500 + ai * 800 + si * 1200);
        timersRef.current.push(timer);
      });
    });
  }, [step]);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || step === 'intro' || step === 'outro') return;
    const duration = STEP_DURATIONS[step];
    const timer = setTimeout(advanceStep, duration);
    timersRef.current.push(timer);
    return () => clearTimeout(timer);
  }, [isPlaying, step, advanceStep]);

  const startDemo = () => {
    setIsPlaying(true);
    setStep('create');
    setMessages([]);
    setResolvedDiscrepancies(new Set());
    setApprovalStatuses({});
    setStepProgress(0);
  };

  const resetDemo = () => {
    clearTimers();
    setStep('intro');
    setIsPlaying(false);
    setMessages([]);
    setIsTyping(false);
    setResolvedDiscrepancies(new Set());
    setApprovalStatuses({});
    setStepProgress(0);
  };

  const togglePlay = () => {
    if (step === 'intro') {
      startDemo();
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Intro screen
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl"
        >
          <div className="w-16 h-16 rounded-2xl mx-auto mb-8 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Watch PIVT orchestrate a closing
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            {DEMO_DEAL.name} — {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(DEMO_DEAL.value)} {DEMO_DEAL.type}
          </p>
          <p className="text-sm text-muted-foreground mb-10 max-w-md mx-auto">
            From deal creation to bank-ready wire pack in minutes. No manual data entry required.
          </p>
          <Button
            size="lg"
            onClick={startDemo}
            className="h-12 px-8 text-base rounded-xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--pivt-blue))] text-white border-0 hover:opacity-90 shadow-lg"
          >
            <Play className="w-5 h-5 mr-2" /> Start Demo
          </Button>
          <p className="text-xs text-muted-foreground mt-6">~60 second walkthrough · No signup required</p>
        </motion.div>
      </div>
    );
  }

  // Outro screen
  if (step === 'outro') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.2 }}
          >
            <CheckCircle2 className="w-16 h-16 text-validated mx-auto mb-6" />
          </motion.div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            Deal ready for execution
          </h2>
          <p className="text-muted-foreground mb-8">
            PIVT orchestrated {DEMO_DEAL.name} from document ingestion to a bank-compatible wire pack — automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--pivt-blue))] text-white border-0 hover:opacity-90"
              onClick={() => window.open('mailto:hello@pivttech.ai?subject=Demo%20Request', '_blank')}
            >
              Book a Demo <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6 rounded-xl"
              onClick={() => navigate('/login')}
            >
              Request Access <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <button onClick={resetDemo} className="mt-6 flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Replay Demo
          </button>
        </motion.div>
      </div>
    );
  }

  // Main demo view: stepper + Newton panel + workspace
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}>
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold">PIVT Demo</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium ml-1">Live</span>
          </div>
          <DemoStepper currentStep={step} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={advanceStep}>
              <SkipForward className="w-3.5 h-3.5 mr-1" /> Skip
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetDemo}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 p-4">
        {/* Workspace */}
        <div className="order-2 lg:order-1">
          <DemoWorkspace
            step={step}
            progress={stepProgress}
            resolvedDiscrepancies={resolvedDiscrepancies}
            approvalStatuses={approvalStatuses}
          />
        </div>

        {/* Newton panel */}
        <div className="order-1 lg:order-2 h-[calc(100vh-120px)] sticky top-[60px]">
          <DemoNewtonPanel messages={messages} isTyping={isTyping} />
        </div>
      </div>
    </div>
  );
};

export default DemoPage;
