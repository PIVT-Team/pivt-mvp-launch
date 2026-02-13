import React from 'react';
import { Check } from 'lucide-react';
import { WIZARD_STEPS, WizardStep, useDealWizardStore } from '@/stores/dealWizardStore';

export const WizardStepper: React.FC = () => {
  const { currentStep, completedSteps, setStep } = useDealWizardStore();
  const currentIdx = WIZARD_STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {WIZARD_STEPS.map((step, idx) => {
        const isCompleted = completedSteps.has(step.key);
        const isCurrent = step.key === currentStep;
        const isClickable = isCompleted || idx <= currentIdx;

        return (
          <React.Fragment key={step.key}>
            <button
              onClick={() => isClickable && setStep(step.key)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                isCurrent
                  ? 'bg-[#5B3DF5] text-white'
                  : isCompleted
                    ? 'bg-[#5B3DF5]/10 text-[#5B3DF5] hover:bg-[#5B3DF5]/20'
                    : 'text-white/30 cursor-not-allowed'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isCompleted
                  ? 'bg-[#5B3DF5] text-white'
                  : isCurrent
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/30'
              }`}>
                {isCompleted ? <Check className="w-3 h-3" /> : step.number}
              </span>
              <span className="hidden lg:inline">{step.label}</span>
            </button>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={`w-4 h-px shrink-0 ${isCompleted ? 'bg-[#5B3DF5]/40' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
