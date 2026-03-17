/**
 * Newton – Actionable Deal Copilot Drawer (⌘J)
 * Floating trigger + operational workspace panel.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { springConfig } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { NewtonAgentPanel } from '@/components/pivt-complete/cover/NewtonAgentPanel';

export const NewtonDealIntelligence: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('pivt:open-newton', handler as EventListener);
    return () => window.removeEventListener('pivt:open-newton', handler as EventListener);
  }, []);

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group pivt-gradient-interactive"
          >
            <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={springConfig.standard}
              className="fixed inset-y-0 right-0 z-50 w-[min(960px,96vw)] border-l border-border bg-card flex flex-col"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                <div className="h-9 w-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Newton</p>
                  <p className="text-[10px] text-muted-foreground">Actionable deal copilot · Intake, approvals, execution</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-5">
                <NewtonAgentPanel />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NewtonDealIntelligence;
