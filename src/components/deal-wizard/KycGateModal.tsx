import React from 'react';
import { Shield, ArrowRight, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KycGateModalProps {
  open: boolean;
  onClose: () => void;
  onGoToVerification: () => void;
  onCreateDemo: () => void;
}

export const KycGateModal: React.FC<KycGateModalProps> = ({ open, onClose, onGoToVerification, onCreateDemo }) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="bg-[#1A1F2E] border border-white/10 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-lg font-bold text-white">Verification Required</h2>
          </div>

          <p className="text-sm text-white/60 mb-6">
            KYC and KYB verification must be approved before you can create a Live Testing Deal. This ensures compliance with regulatory requirements.
          </p>

          <div className="space-y-3">
            <button
              onClick={onGoToVerification}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 transition-all"
            >
              <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Go to Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onCreateDemo}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 transition-all border border-white/10"
            >
              <span className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Create Demo Deal Instead</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
