/**
 * Self-playing PIVT demo page — /demo route.
 * Cinematic, typed-prompt orchestration with step-by-step Newton responses.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, RotateCcw, SkipForward, Sparkles,
  ArrowRight, CheckCircle2, ChevronRight, Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DemoNewtonPanel, type DemoMsg } from '@/components/demo/DemoNewtonPanel';
import { DemoWorkspace } from '@/components/demo/DemoWorkspace';
import { DemoStepper, type DemoStep } from '@/components/demo/DemoStepper';
import { useDemoTyping } from '@/components/demo/useDemoTyping';
import { RequestAccessModal } from '@/components/RequestAccessModal';
import type { DemoApproval, VerificationStatus } from '@/components/demo/demoData';
import {
  DEMO_DISCREPANCIES, DEMO_APPROVALS, DEMO_DEAL, DEMO_STAKEHOLDERS,
} from '@/components/demo/demoData';

const STEP_ORDER: DemoStep[] = [
  'intro', 'create', 'stakeholders', 'verification',
  'upload', 'obligations', 'discrepancies', 'approvals', 'wirepack', 'outro',
];

/* ── Helpers ── */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const uid = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const addMsg = (
  setter: React.Dispatch<React.SetStateAction<DemoMsg[]>>,
  type: DemoMsg['type'],
  text: string
) => {
  const msg: DemoMsg = { id: uid(), type, text, visible: true };
  setter((prev) => [...prev, msg]);
  return msg.id;
};

const removeMsg = (
  setter: React.Dispatch<React.SetStateAction<DemoMsg[]>>,
  id: string
) => {
  setter((prev) => prev.filter((m) => m.id !== id));
};

/* ── Step Scenarios ── */
interface StepScenario {
  run: (ctx: ScenarioCtx) => Promise<void>;
}

interface ScenarioCtx {
  addMessage: (type: DemoMsg['type'], text: string, wirepackMeta?: DemoMsg['wirepackMeta']) => string;
  removeMessage: (id: string) => void;
  typeAndSubmit: (text: string) => Promise<void>;
  setIsTyping: (v: boolean) => void;
  setStepProgress: (v: number | ((p: number) => number)) => void;
  setResolvedDiscrepancies: React.Dispatch<React.SetStateAction<Set<string>>>;
  setApprovalStatuses: React.Dispatch<React.SetStateAction<Record<string, DemoApproval['status']>>>;
  setStakeholderVerifications: React.Dispatch<React.SetStateAction<Record<string, VerificationStatus>>>;
  cancelled: () => boolean;
}

const SCENARIOS: Partial<Record<DemoStep, StepScenario>> = {
  create: {
    async run(ctx) {
      await ctx.typeAndSubmit(
        'Create a new deal called Project Atlas. Buyer is Northstar Capital Partners, seller is Harbor Ridge Holdings. $185M asset purchase.'
      );
      if (ctx.cancelled()) return;

      ctx.addMessage('user', 'Create a new deal called Project Atlas. Buyer is Northstar Capital Partners, seller is Harbor Ridge Holdings. $185M asset purchase.');
      await sleep(400);
      if (ctx.cancelled()) return;

      const t1 = ctx.addMessage('thinking', 'Reviewing request...');
      await sleep(1200);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t1);

      const t2 = ctx.addMessage('thinking', 'Creating deal workspace...');
      ctx.setStepProgress(0.3);
      await sleep(1400);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t2);

      const t3 = ctx.addMessage('thinking', 'Configuring deal parameters...');
      ctx.setStepProgress(0.6);
      await sleep(1000);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t3);

      ctx.setStepProgress(0.8);
      ctx.addMessage(
        'newton',
        'Creating **Project Atlas** — $185M asset purchase.\n\n- Buyer: Northstar Capital Partners\n- Seller: Harbor Ridge Holdings\n- Jurisdiction: Delaware\n\nDeal workspace is ready.'
      );
      await sleep(1200);
      if (ctx.cancelled()) return;

      ctx.setStepProgress(1);
      ctx.addMessage('system', 'Deal created • Project Atlas — DEL-2026-0847');
      await sleep(1500);
    },
  },

  stakeholders: {
    async run(ctx) {
      await ctx.typeAndSubmit(
        'Upload the stakeholder list for Project Atlas and prepare verification requests for all parties.'
      );
      if (ctx.cancelled()) return;

      ctx.addMessage('user', 'Upload the stakeholder list for Project Atlas and prepare verification requests for all parties.');
      await sleep(400);
      if (ctx.cancelled()) return;

      const t1 = ctx.addMessage('thinking', 'Receiving stakeholder data...');
      await sleep(1200);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t1);

      ctx.addMessage('newton', 'Processing stakeholder list for **Project Atlas**...');
      ctx.setStepProgress(0.1);
      await sleep(600);
      if (ctx.cancelled()) return;

      // Import stakeholders one-by-one with progress
      const importSteps = [
        'Importing transaction parties...',
        'Importing legal counsel...',
        'Importing execution & custody agents...',
        'Importing signatories & advisors...',
      ];

      for (let i = 0; i < importSteps.length; i++) {
        if (ctx.cancelled()) return;
        const tid = ctx.addMessage('thinking', importSteps[i]);
        ctx.setStepProgress(0.1 + ((i + 1) / importSteps.length) * 0.7);
        await sleep(1000 + Math.random() * 400);
        ctx.removeMessage(tid);
      }
      if (ctx.cancelled()) return;

      ctx.setStepProgress(0.9);
      ctx.addMessage('system', `${DEMO_STAKEHOLDERS.length} stakeholders imported`);
      await sleep(600);
      if (ctx.cancelled()) return;

      ctx.setStepProgress(1);
      ctx.addMessage(
        'newton',
        `✅ **${DEMO_STAKEHOLDERS.length} stakeholders** added to Project Atlas:\n\n- 3 Transaction Parties (Buyer, Seller, Escrow Agent)\n- 2 Legal Counsel\n- 2 Signatories\n- 3 Advisors & Agents\n- 2 Key Executives\n\nReady for KYC/KYB verification.`
      );
      await sleep(1800);
    },
  },

  verification: {
    async run(ctx) {
      // Newton auto-initiates verification
      const t0 = ctx.addMessage('thinking', 'Preparing KYC/KYB verification requests...');
      await sleep(1200);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t0);

      ctx.addMessage(
        'newton',
        `Sending **KYC/KYB verification** requests to all ${DEMO_STAKEHOLDERS.length} stakeholders...\n\nVerification emails will be sent to each party's registered contact.`
      );
      ctx.setStepProgress(0.1);
      await sleep(800);
      if (ctx.cancelled()) return;

      // Phase 1: Send requests (not_verified → requested) in batches
      const t1 = ctx.addMessage('thinking', 'Sending verification emails...');
      for (let i = 0; i < DEMO_STAKEHOLDERS.length; i++) {
        if (ctx.cancelled()) return;
        ctx.setStakeholderVerifications((prev) => ({
          ...prev,
          [DEMO_STAKEHOLDERS[i].id]: 'requested',
        }));
        await sleep(200 + Math.random() * 150);
      }
      ctx.setStepProgress(0.25);
      await sleep(400);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t1);

      ctx.addMessage('system', `Verification emails sent to ${DEMO_STAKEHOLDERS.length} stakeholders`);
      await sleep(800);
      if (ctx.cancelled()) return;

      // Phase 2: Move to in_review in waves
      const t2 = ctx.addMessage('thinking', 'Stakeholders responding to verification...');
      const wave1 = DEMO_STAKEHOLDERS.slice(0, 5);
      for (const sh of wave1) {
        if (ctx.cancelled()) return;
        ctx.setStakeholderVerifications((prev) => ({ ...prev, [sh.id]: 'in_review' }));
        await sleep(250 + Math.random() * 200);
      }
      ctx.setStepProgress(0.4);
      await sleep(600);
      if (ctx.cancelled()) return;

      const wave2 = DEMO_STAKEHOLDERS.slice(5);
      for (const sh of wave2) {
        if (ctx.cancelled()) return;
        ctx.setStakeholderVerifications((prev) => ({ ...prev, [sh.id]: 'in_review' }));
        await sleep(200 + Math.random() * 150);
      }
      ctx.setStepProgress(0.55);
      await sleep(400);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t2);

      // Phase 3: Verify one by one with progress narration
      const t3 = ctx.addMessage('thinking', 'Reviewing submitted documents...');
      await sleep(800);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t3);

      for (let i = 0; i < DEMO_STAKEHOLDERS.length; i++) {
        if (ctx.cancelled()) return;
        const sh = DEMO_STAKEHOLDERS[i];
        ctx.setStakeholderVerifications((prev) => ({ ...prev, [sh.id]: 'verified' }));
        ctx.setStepProgress(0.55 + ((i + 1) / DEMO_STAKEHOLDERS.length) * 0.4);
        await sleep(300 + Math.random() * 250);

        // Midpoint narration
        if (i === 5) {
          ctx.addMessage('system', `${i + 1} of ${DEMO_STAKEHOLDERS.length} stakeholders verified`);
          await sleep(400);
        }
      }
      if (ctx.cancelled()) return;

      ctx.setStepProgress(1);
      ctx.addMessage('system', `All ${DEMO_STAKEHOLDERS.length} stakeholders verified ✓`);
      await sleep(600);
      if (ctx.cancelled()) return;

      ctx.addMessage(
        'newton',
        `✅ **All Stakeholders Verified**\n\nKYC/KYB requirements completed for all ${DEMO_STAKEHOLDERS.length} parties.\n\n- 5 entity verifications (KYB)\n- 7 individual verifications (KYC)\n- 0 outstanding issues\n\nStakeholder verification complete. Ready to proceed with document upload.`
      );
      await sleep(2000);
    },
  },

  upload: {
    async run(ctx) {
      await ctx.typeAndSubmit(
        'Upload the closing binder. I have the SPA, funds flow memo, wire instructions for both sides, escrow agreement, and tax forms.'
      );
      if (ctx.cancelled()) return;

      ctx.addMessage('user', 'Upload the closing binder. I have the SPA, funds flow memo, wire instructions for both sides, escrow agreement, and tax forms.');
      await sleep(400);
      if (ctx.cancelled()) return;

      const t1 = ctx.addMessage('thinking', 'Receiving 6 documents...');
      await sleep(1200);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t1);

      ctx.addMessage('newton', 'Processing **6 documents** for Project Atlas...');
      ctx.setStepProgress(0.15);
      await sleep(800);
      if (ctx.cancelled()) return;

      const docs = [
        'Classifying Stock_Purchase_Agreement_Atlas_Final.pdf...',
        'Parsing Funds_Flow_Memo_v3.pdf...',
        'Extracting Wire_Instructions_Buyer_Northstar.pdf...',
        'Extracting Wire_Instructions_Seller_HarborRidge.pdf...',
        'Parsing Escrow_Agreement_Final.pdf...',
        'Validating IRS_W9_HarborRidge.pdf...',
      ];

      for (let i = 0; i < docs.length; i++) {
        if (ctx.cancelled()) return;
        const tid = ctx.addMessage('thinking', docs[i]);
        ctx.setStepProgress((i + 1) / docs.length * 0.85);
        await sleep(1100 + Math.random() * 400);
        ctx.removeMessage(tid);
      }
      if (ctx.cancelled()) return;

      ctx.setStepProgress(1);
      ctx.addMessage('system', 'Documents classified and parsed');
      await sleep(800);
      if (ctx.cancelled()) return;

      ctx.addMessage(
        'newton',
        '✅ All **6 documents** processed:\n- 1 Purchase Agreement (78 pages)\n- 1 Funds Flow Memo\n- 2 Wire Instruction sets\n- 1 Escrow Agreement\n- 1 Tax Form (W-9)\n\nReady for obligation extraction.'
      );
      await sleep(1800);
    },
  },

  obligations: {
    async run(ctx) {
      await ctx.typeAndSubmit('Extract all payment obligations from the agreements.');
      if (ctx.cancelled()) return;

      ctx.addMessage('user', 'Extract all payment obligations from the agreements.');
      await sleep(400);
      if (ctx.cancelled()) return;

      const steps = [
        'Analyzing SPA §2.3 — Purchase Price...',
        'Scanning Escrow Agreement §4...',
        'Cross-referencing Funds Flow Memo...',
        'Extracting fee schedules...',
        'Reconciling total disbursements...',
      ];

      for (let i = 0; i < steps.length; i++) {
        if (ctx.cancelled()) return;
        const tid = ctx.addMessage('thinking', steps[i]);
        ctx.setStepProgress((i + 1) / steps.length);
        await sleep(1000 + Math.random() * 500);
        ctx.removeMessage(tid);
      }
      if (ctx.cancelled()) return;

      ctx.addMessage(
        'newton',
        'Found **6 payment obligations** totaling **$185.0M** across 6 recipients.\n\nAll amounts reconcile with the purchase price.\n\n| Recipient | Amount |\n|---|---|\n| Harbor Ridge Holdings | $148.0M |\n| Escrow Agent — JPMorgan | $18.5M |\n| Seller Legal Counsel | $3.2M |\n| Buyer Legal Counsel | $2.8M |\n| Financial Advisor — Lazard | $9.25M |\n| Transfer Agent | $3.25M |'
      );
      await sleep(2000);
    },
  },

  discrepancies: {
    async run(ctx) {
      const t1 = ctx.addMessage('thinking', 'Cross-referencing wire instructions against agreements...');
      ctx.setStepProgress(0.15);
      await sleep(1400);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t1);

      const t2 = ctx.addMessage('thinking', 'Comparing beneficiary names...');
      ctx.setStepProgress(0.35);
      await sleep(1100);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t2);

      const t3 = ctx.addMessage('thinking', 'Validating routing numbers...');
      ctx.setStepProgress(0.55);
      await sleep(1000);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t3);

      const t4 = ctx.addMessage('thinking', 'Checking intermediary bank requirements...');
      ctx.setStepProgress(0.75);
      await sleep(1100);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t4);

      ctx.addMessage(
        'newton',
        '⚠️ **3 discrepancies detected** — 2 critical, 1 high severity.\n\nReview required before wire execution.'
      );
      ctx.setStepProgress(0.85);
      await sleep(1500);
      if (ctx.cancelled()) return;

      for (let i = 0; i < DEMO_DISCREPANCIES.length; i++) {
        if (ctx.cancelled()) return;
        const d = DEMO_DISCREPANCIES[i];
        const tid = ctx.addMessage('thinking', `Resolving: ${d.title}...`);
        await sleep(1800);
        if (ctx.cancelled()) return;
        ctx.removeMessage(tid);
        ctx.setResolvedDiscrepancies((prev) => new Set([...prev, d.id]));
        ctx.addMessage('system', `✓ Resolved — ${d.title}`);
        await sleep(600);
      }
      if (ctx.cancelled()) return;

      ctx.setStepProgress(1);
      ctx.addMessage('newton', '✅ All **3 discrepancies** resolved. Wire instructions verified and ready.');
      await sleep(1500);
    },
  },

  approvals: {
    async run(ctx) {
      await ctx.typeAndSubmit('Send approval requests to all parties via DocuSign.');
      if (ctx.cancelled()) return;

      ctx.addMessage('user', 'Send approval requests to all parties via DocuSign.');
      await sleep(400);
      if (ctx.cancelled()) return;

      const t1 = ctx.addMessage('thinking', 'Preparing approval packets...');
      ctx.setStepProgress(0.15);
      await sleep(1200);
      if (ctx.cancelled()) return;
      ctx.removeMessage(t1);

      ctx.addMessage(
        'newton',
        'Preparing approval packets for **4 signers**:\n- Sarah Chen (Buyer Counsel)\n- Michael Torres (Seller Counsel)\n- David Park (Deal Lead)\n- Rebecca Liu (CFO)\n\nSending via DocuSign...'
      );
      ctx.setStepProgress(0.3);
      await sleep(1000);
      if (ctx.cancelled()) return;

      const statuses: Array<'sent' | 'viewed' | 'signed'> = ['sent', 'viewed', 'signed'];
      for (let si = 0; si < statuses.length; si++) {
        for (let ai = 0; ai < DEMO_APPROVALS.length; ai++) {
          if (ctx.cancelled()) return;
          const a = DEMO_APPROVALS[ai];
          ctx.setApprovalStatuses((prev) => ({ ...prev, [a.recipient]: statuses[si] }));
          await sleep(400 + Math.random() * 300);
        }
        ctx.setStepProgress(0.3 + ((si + 1) / statuses.length) * 0.65);
        if (si < statuses.length - 1) await sleep(800);
      }
      if (ctx.cancelled()) return;

      ctx.addMessage('system', 'All approval requests sent via DocuSign');
      await sleep(600);
      if (ctx.cancelled()) return;

      ctx.setStepProgress(1);
      ctx.addMessage('newton', '✅ All **4 approvals** complete. All parties have signed. Ready for wire pack generation.');
      await sleep(1500);
    },
  },

  wirepack: {
    async run(ctx) {
      const steps = [
        'Compiling verified wire instructions...',
        'Validating compliance checks...',
        'Generating bank-compatible formats...',
        'Building wire pack bundle...',
      ];

      ctx.addMessage(
        'newton',
        'All discrepancies resolved. All approvals complete.\n\nGenerating bank-compatible **Wire Pack** for Project Atlas...'
      );
      await sleep(800);
      if (ctx.cancelled()) return;

      for (let i = 0; i < steps.length; i++) {
        if (ctx.cancelled()) return;
        const tid = ctx.addMessage('thinking', steps[i]);
        ctx.setStepProgress((i + 1) / steps.length * 0.8);
        await sleep(1200 + Math.random() * 400);
        ctx.removeMessage(tid);
      }
      if (ctx.cancelled()) return;

      ctx.setStepProgress(0.9);
      ctx.addMessage('system', 'Wire Pack generated — ready for execution');
      await sleep(800);
      if (ctx.cancelled()) return;

      ctx.setStepProgress(1);
      ctx.addMessage(
        'wirepack_success',
        '',
        { dealName: 'Project Atlas', totalAmount: '$185.0M', wireCount: 6 }
      );
      await sleep(3000);
    },
  },
};

/* ── Main Component ── */
const DemoPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<DemoStep>('intro');
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<DemoMsg[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const [resolvedDiscrepancies, setResolvedDiscrepancies] = useState<Set<string>>(new Set());
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, DemoApproval['status']>>({});
  const [stakeholderVerifications, setStakeholderVerifications] = useState<Record<string, VerificationStatus>>({});
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);

  const { typingText, isInputFocused, typeAndSubmit, cancelTyping } = useDemoTyping();

  const currentIdx = STEP_ORDER.indexOf(step);

  const runDemo = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;

    for (let i = 1; i < STEP_ORDER.length - 1; i++) {
      if (cancelledRef.current) break;

      const stepId = STEP_ORDER[i];
      setStep(stepId);
      setStepProgress(0);

      const scenario = SCENARIOS[stepId];
      if (scenario) {
        const ctx: ScenarioCtx = {
          addMessage: (type, text, wirepackMeta?) => {
            const id = uid();
            setMessages((prev) => [...prev, { id, type, text, visible: true, wirepackMeta }]);
            return id;
          },
          removeMessage: (id) => setMessages((prev) => prev.filter((m) => m.id !== id)),
          typeAndSubmit: (text) => typeAndSubmit(text),
          setIsTyping,
          setStepProgress,
          setResolvedDiscrepancies,
          setApprovalStatuses,
          setStakeholderVerifications,
          cancelled: () => cancelledRef.current,
        };
        await scenario.run(ctx);
      }
    }

    if (!cancelledRef.current) {
      setStep('outro');
    }
    runningRef.current = false;
  }, [typeAndSubmit]);

  const startDemo = () => {
    setIsPlaying(true);
    setMessages([]);
    setResolvedDiscrepancies(new Set());
    setApprovalStatuses({});
    setStakeholderVerifications({});
    setStepProgress(0);
    cancelledRef.current = false;
    runDemo();
  };

  const resetDemo = () => {
    cancelledRef.current = true;
    cancelTyping();
    runningRef.current = false;
    setStep('intro');
    setIsPlaying(false);
    setMessages([]);
    setIsTyping(false);
    setResolvedDiscrepancies(new Set());
    setApprovalStatuses({});
    setStakeholderVerifications({});
    setStepProgress(0);
  };

  const skipStep = () => {
    cancelledRef.current = true;
    cancelTyping();
    runningRef.current = false;
    const nextIdx = currentIdx + 1;
    if (nextIdx < STEP_ORDER.length) {
      setStep(STEP_ORDER[nextIdx]);
      setStepProgress(0);
      if (STEP_ORDER[nextIdx] !== 'outro' && STEP_ORDER[nextIdx] !== 'intro') {
        cancelledRef.current = false;
        setTimeout(() => {
          runningRef.current = false;
          const runRemaining = async () => {
            if (runningRef.current) return;
            runningRef.current = true;
            for (let i = nextIdx; i < STEP_ORDER.length - 1; i++) {
              if (cancelledRef.current) break;
              const stepId = STEP_ORDER[i];
              setStep(stepId);
              setStepProgress(0);
              const scenario = SCENARIOS[stepId];
              if (scenario) {
                const ctx: ScenarioCtx = {
                  addMessage: (type, text, wirepackMeta?) => {
                    const id = uid();
                    setMessages((prev) => [...prev, { id, type, text, visible: true, wirepackMeta }]);
                    return id;
                  },
                  removeMessage: (id) => setMessages((prev) => prev.filter((m) => m.id !== id)),
                  typeAndSubmit: (text) => typeAndSubmit(text),
                  setIsTyping,
                  setStepProgress,
                  setResolvedDiscrepancies,
                  setApprovalStatuses,
                  setStakeholderVerifications,
                  cancelled: () => cancelledRef.current,
                };
                await scenario.run(ctx);
              }
            }
            if (!cancelledRef.current) setStep('outro');
            runningRef.current = false;
          };
          runRemaining();
        }, 100);
      }
    }
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
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-8 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}
          >
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">See PIVT in Action</h1>
          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            Watch Newton orchestrate a <span className="text-foreground font-medium">$185M asset purchase</span> from
            deal creation to wire execution — automatically.
          </p>
          <Button
            size="lg"
            className="h-12 px-8 rounded-xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--pivt-blue))] text-white border-0 hover:opacity-90"
            onClick={startDemo}
          >
            <Play className="w-4 h-4 mr-2" /> Start Demo
          </Button>
          <p className="text-xs text-muted-foreground mt-4">~3 minutes · Fully automated walkthrough</p>
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
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center max-w-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 15, delay: 0.2 }}
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-validated/10"
          >
            <CheckCircle2 className="w-8 h-8 text-validated" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">Deal Complete</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed max-w-md mx-auto">
            PIVT orchestrated {DEMO_DEAL.name} from document ingestion to a bank-compatible wire pack
            — automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--pivt-blue))] text-white border-0 hover:opacity-90"
              onClick={() =>
                window.open('mailto:hello@pivttech.ai?subject=Demo%20Request', '_blank')
              }
            >
              Book a Demo <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6 rounded-xl"
              onClick={() => setRequestAccessOpen(true)}
            >
              Request Access <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-4 justify-center">
            <button
              onClick={resetDemo}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Replay Demo
            </button>
            <span className="text-muted-foreground/30">|</span>
            <button
              onClick={() => navigate('/pivt')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="w-3.5 h-3.5" /> Back to Home
            </button>
          </div>
        </motion.div>
        <RequestAccessModal open={requestAccessOpen} onOpenChange={setRequestAccessOpen} />
      </div>
    );
  }

  // Active demo
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2">
          <DemoStepper currentStep={step} />
          <div className="flex items-center gap-2">
            <button onClick={skipStep} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <SkipForward className="w-4 h-4" />
            </button>
            <button onClick={resetDemo} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 px-4 py-4">
        {/* Workspace panel */}
        <div className="order-2 lg:order-1">
          <DemoWorkspace
            step={step}
            progress={stepProgress}
            resolvedDiscrepancies={resolvedDiscrepancies}
            approvalStatuses={approvalStatuses}
            stakeholderVerifications={stakeholderVerifications}
          />
        </div>

        {/* Newton panel */}
        <div className="order-1 lg:order-2 h-[calc(100vh-120px)] sticky top-[60px]">
          <DemoNewtonPanel
            messages={messages}
            isTyping={isTyping}
            typingText={typingText}
            isInputFocused={isInputFocused}
          />
        </div>
      </div>
    </div>
  );
};

export default DemoPage;
