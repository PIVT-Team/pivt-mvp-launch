/**
 * Newton – Premium FAB + Slide-over Panel (⌘J)
 * 56–64px gradient FAB with tooltip, first-time hint, and smooth slide-in panel.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { springConfig } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { NewtonAgentPanel } from '@/components/pivt-complete/cover/NewtonAgentPanel';
import { cn } from '@/lib/utils';

const HINT_STORAGE_KEY = 'pivt_newton_hint_dismissed';

export const NewtonDealIntelligence: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // First-time hint logic
  useEffect(() => {
    const dismissed = localStorage.getItem(HINT_STORAGE_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setShowHint(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    localStorage.setItem(HINT_STORAGE_KEY, 'true');
  }, []);

  // ⌘J keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        dismissHint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dismissHint]);

  // Custom event listener
  useEffect(() => {
    const handler = () => { setIsOpen(true); dismissHint(); };
    window.addEventListener('pivt:open-newton', handler as EventListener);
    return () => window.removeEventListener('pivt:open-newton', handler as EventListener);
  }, [dismissHint]);

  const handleOpen = () => {
    setIsOpen(true);
    dismissHint();
  };

  return (
    <>
      {/* ── Premium FAB ── */}
      <AnimatePresence>
        {!isOpen && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* First-time onboarding hint */}
            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="relative w-[260px] rounded-2xl border border-border bg-card shadow-xl p-4"
                >
                  {/* Caret */}
                  <div className="absolute -bottom-1.5 right-7 w-3 h-3 bg-card border-r border-b border-border rotate-45" />
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold mb-1">Meet Newton</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5">
                        Your AI co-pilot for:
                      </p>
                      <ul className="text-[11px] text-muted-foreground space-y-0.5 mb-3">
                        <li>• Creating deals</li>
                        <li>• Uploading stakeholders</li>
                        <li>• Managing closings</li>
                      </ul>
                      <button
                        onClick={handleOpen}
                        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}
                      >
                        Try it
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={dismissHint}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tooltip */}
            <AnimatePresence>
              {showTooltip && !showHint && (
                <motion.div
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 mb-3 whitespace-nowrap"
                >
                  <div className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-medium shadow-lg">
                    Ask Newton — your AI deal co-pilot
                    <span className="ml-2 text-[10px] opacity-60">⌘J</span>
                  </div>
                  {/* Caret */}
                  <div className="absolute -bottom-1 right-7 w-2 h-2 bg-foreground rotate-45" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* The FAB button */}
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              onClick={handleOpen}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              aria-label="Open Newton AI co-pilot"
              className={cn(
                'relative w-[60px] h-[60px] rounded-full flex items-center justify-center',
                'transition-all duration-200 ease-out',
                'hover:scale-105 focus-visible:scale-105',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
              style={{
                background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)), hsl(262 72% 60%))',
                boxShadow: '0 8px 24px hsla(var(--accent) / 0.35), 0 2px 8px hsla(var(--accent) / 0.2)',
              }}
            >
              <Sparkles className="w-6 h-6 text-white drop-shadow-sm" />

              {/* Idle pulse ring — every 6s */}
              <span
                className="absolute inset-0 rounded-full animate-[newton-pulse_6s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))',
                  opacity: 0,
                }}
              />
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* ── Slide-over Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed inset-y-0 right-0 z-50 w-[min(960px,96vw)] border-l border-border bg-card flex flex-col"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}
                >
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Newton</p>
                  <p className="text-[10px] text-muted-foreground">AI Co-pilot · ⌘J to toggle</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Newton panel"
                >
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
