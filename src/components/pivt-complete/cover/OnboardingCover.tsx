import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerChildren, springConfig } from '@/lib/animations';
import {
  UserPlus, Shield, FileText, Wallet, CheckCircle2, ArrowRight,
  Building2, User, Globe, Upload, CreditCard, Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type OnboardingStep = 'signup' | 'profile' | 'kyc' | 'banking' | 'complete';

const STEPS: { id: OnboardingStep; label: string; icon: React.ElementType }[] = [
  { id: 'signup', label: 'Account Setup', icon: UserPlus },
  { id: 'profile', label: 'Profile & Org', icon: Building2 },
  { id: 'kyc', label: 'KYC / KYB', icon: Shield },
  { id: 'banking', label: 'Banking Details', icon: CreditCard },
  { id: 'complete', label: 'Ready', icon: CheckCircle2 },
];

export const OnboardingCover: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('signup');
  const [trialType, setTrialType] = useState<'individual' | 'organization' | null>(null);

  const currentIdx = STEPS.findIndex(s => s.id === currentStep);
  const next = () => { const n = STEPS[currentIdx + 1]; if (n) setCurrentStep(n.id); };

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Onboarding</h1>
        <p className="text-muted-foreground mt-1">Complete setup to start transacting on PIVT</p>
      </div>

      {/* Step Progress */}
      <div className="pivt-card p-6">
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => {
            const isActive = step.id === currentStep;
            const isDone = i < currentIdx;
            return (
              <React.Fragment key={step.id}>
                <button onClick={() => i <= currentIdx && setCurrentStep(step.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-accent/10 text-accent font-medium' : isDone ? 'text-validated' : 'text-muted-foreground'}`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                  <span className="hidden md:inline">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && <ArrowRight className={`w-3 h-3 ${i < currentIdx ? 'text-validated' : 'text-muted-foreground/30'}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={springConfig.standard}>
          {currentStep === 'signup' && (
            <div className="pivt-card p-6 space-y-6">
              <h3 className="font-semibold text-lg">Choose Account Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { type: 'individual' as const, icon: User, title: 'Individual', desc: 'Personal account for founders, employees, and individual shareholders' },
                  { type: 'organization' as const, icon: Building2, title: 'Organization', desc: 'Entity account for funds, trusts, law firms, and corporate shareholders' },
                ].map(opt => (
                  <button key={opt.type} onClick={() => setTrialType(opt.type)} className={`p-6 rounded-xl border-2 text-left transition-all ${trialType === opt.type ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}>
                    <opt.icon className={`w-8 h-8 mb-3 ${trialType === opt.type ? 'text-accent' : 'text-muted-foreground'}`} />
                    <h4 className="font-semibold text-lg">{opt.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <input className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50" placeholder="Enter your full name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <input type="email" className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50" placeholder="you@company.com" />
                </div>
              </div>
              <button onClick={next} disabled={!trialType} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 'profile' && (
            <div className="pivt-card p-6 space-y-6">
              <h3 className="font-semibold text-lg">{trialType === 'organization' ? 'Organization Details' : 'Personal Profile'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trialType === 'organization' ? (
                  <>
                    {['Legal Entity Name', 'Registration Number', 'Country of Incorporation', 'Registered Address'].map(field => (
                      <div key={field} className="space-y-2">
                        <label className="text-sm font-medium">{field}</label>
                        <input className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50" placeholder={`Enter ${field.toLowerCase()}`} />
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {['Date of Birth', 'Nationality', 'Residential Address', 'Role at Organization'].map(field => (
                      <div key={field} className="space-y-2">
                        <label className="text-sm font-medium">{field}</label>
                        <input className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50" placeholder={`Enter ${field.toLowerCase()}`} />
                      </div>
                    ))}
                  </>
                )}
              </div>
              <button onClick={next} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 'kyc' && (
            <div className="pivt-card p-6 space-y-6">
              <h3 className="font-semibold text-lg">{trialType === 'organization' ? 'KYB Verification' : 'KYC Verification'}</h3>
              <p className="text-sm text-muted-foreground">Upload required identity documents for verification.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(trialType === 'organization'
                  ? ['Certificate of Incorporation', 'Articles of Association', 'Board Resolution', 'Beneficial Ownership Declaration']
                  : ['Government-Issued ID', 'Proof of Address', 'Tax ID Document', 'Selfie Verification']
                ).map(doc => (
                  <div key={doc} className="p-4 rounded-xl border-2 border-dashed border-border hover:border-accent/30 transition-colors cursor-pointer text-center">
                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">{doc}</p>
                    <p className="text-xs text-muted-foreground mt-1">Click to upload or drag & drop</p>
                  </div>
                ))}
              </div>
              <button onClick={next} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
                Submit for Review <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 'banking' && (
            <div className="pivt-card p-6 space-y-6">
              <h3 className="font-semibold text-lg">Banking & Wire Details</h3>
              <p className="text-sm text-muted-foreground">Add your banking information for payout disbursement.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Bank Name', 'Account Holder Name', 'SWIFT / BIC', 'IBAN or Account Number', 'Routing Number', 'Wire Currency'].map(field => (
                  <div key={field} className="space-y-2">
                    <label className="text-sm font-medium">{field}</label>
                    <input className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50" placeholder={`Enter ${field.toLowerCase()}`} />
                  </div>
                ))}
              </div>
              <button onClick={next} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
                Complete Setup <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="pivt-card p-12 text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={springConfig.snapBack}>
                <CheckCircle2 className="w-16 h-16 text-validated mx-auto" />
              </motion.div>
              <h3 className="font-semibold text-xl">Onboarding Complete</h3>
              <p className="text-muted-foreground max-w-md mx-auto">Your account is set up and pending verification. You'll receive an email once your KYC/KYB is approved.</p>
              <div className="flex items-center gap-3 justify-center">
                <Badge variant="outline" className="border-validated/50 text-validated text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Account Created</Badge>
                <Badge variant="outline" className="border-accent/50 text-accent text-xs"><Clock className="w-3 h-3 mr-1" /> KYC Pending</Badge>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
