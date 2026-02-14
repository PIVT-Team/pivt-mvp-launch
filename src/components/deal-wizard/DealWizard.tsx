import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { useDealWizardStore, WIZARD_STEPS, WizardStep } from '@/stores/dealWizardStore';
import { WizardStepper } from './WizardStepper';
import { WizardSidePanel } from './WizardSidePanel';
import { Step1Account } from './steps/Step1Account';
import { Step2Kyc } from './steps/Step2Kyc';
import { StepEscrowSetup } from './steps/StepEscrowSetup';
import { Step3DealBasics } from './steps/Step3DealBasics';
import { Step4Parties } from './steps/Step4Parties';
import { Step5Documentation } from './steps/Step5Documentation';
import { Step6Validation } from './steps/Step6Validation';
import { Step7Discrepancies } from './steps/Step7Discrepancies';
import { Step8Approvals } from './steps/Step8Approvals';
import { Step9Execution } from './steps/Step9Execution';

const stepComponents: Record<WizardStep, React.FC> = {
  account: Step1Account,
  kyc: Step2Kyc,
  'escrow-setup': StepEscrowSetup,
  'deal-basics': Step3DealBasics,
  parties: Step4Parties,
  documentation: Step5Documentation,
  validation: Step6Validation,
  discrepancies: Step7Discrepancies,
  approvals: Step8Approvals,
  execution: Step9Execution,
};

export const DealWizard: React.FC = () => {
  const {
    isOpen, currentStep, closeWizard, nextStep, prevStep,
    wizardMode, setWizardMode, confirmationId, discrepancies, approvals,
    kyc, prefillDemo, resetWizard,
  } = useDealWizardStore();

  if (!isOpen) return null;

  const currentIdx = WIZARD_STEPS.findIndex(s => s.key === currentStep);
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === WIZARD_STEPS.length - 1;
  const StepComponent = stepComponents[currentStep];

  // Gate logic
  const canProceed = (() => {
    if (currentStep === 'kyc' && wizardMode === 'live' && kyc.status !== 'approved') return false;
    if (currentStep === 'discrepancies') {
      const unresolvedHigh = discrepancies.filter(d => d.severity === 'high' && !d.resolved).length;
      if (unresolvedHigh > 0) return false;
    }
    if (currentStep === 'approvals') {
      if (!approvals.every(a => a.status === 'approved')) return false;
    }
    return true;
  })();

  const handleClose = () => {
    resetWizard();
  };

  const handleMarkComplete = () => {
    resetWizard();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex"
        style={{ background: '#0F1220' }}
      >
        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-4">
            <button onClick={handleClose} className="text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 overflow-x-auto">
              <WizardStepper />
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 shrink-0">
              <button
                onClick={() => { setWizardMode('demo'); prefillDemo(); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  wizardMode === 'demo' ? 'bg-[#5B3DF5] text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                Demo Data
              </button>
              <button
                onClick={() => setWizardMode('live')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  wizardMode === 'live' ? 'bg-[#5B3DF5] text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                Live Testing
              </button>
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-3xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <StepComponent />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={prevStep}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white/30 hover:text-white/50 transition-colors rounded-lg hover:bg-white/5"
              >
                <Save className="w-4 h-4" />
                Save & Exit
              </button>
            </div>
            <div>
              {confirmationId ? (
                <button
                  onClick={handleMarkComplete}
                  className="px-6 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500/80 transition-all"
                >
                  Mark Deal Complete
                </button>
              ) : !isLast ? (
                <button
                  onClick={nextStep}
                  disabled={!canProceed}
                  className={`flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    canProceed
                      ? 'bg-[#5B3DF5] text-white hover:bg-[#5B3DF5]/80'
                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <WizardSidePanel />
      </motion.div>
    </AnimatePresence>
  );
};
