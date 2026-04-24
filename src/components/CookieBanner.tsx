import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, X, Cookie } from 'lucide-react';
import { hasConsented, acceptAll, rejectNonEssential, saveConsent, getConsent } from '@/lib/cookieConsent';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [functional, setFunctional] = useState(false);

  useEffect(() => {
    if (!hasConsented()) setVisible(true);

    const handler = () => setVisible(true);
    window.addEventListener('pivt:open-cookie-prefs', handler);
    return () => window.removeEventListener('pivt:open-cookie-prefs', handler);
  }, []);

  useEffect(() => {
    const existing = getConsent();
    if (existing) {
      setAnalytics(existing.analytics);
      setFunctional(existing.functional);
    }
  }, [visible]);

  const handleAccept = () => { acceptAll(); setVisible(false); setShowPrefs(false); };
  const handleReject = () => { rejectNonEssential(); setVisible(false); setShowPrefs(false); };
  const handleSavePrefs = () => {
    saveConsent({ analytics, functional });
    setVisible(false);
    setShowPrefs(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="pointer-events-none fixed bottom-4 left-4 right-4 z-[9999] flex justify-center sm:left-auto sm:right-6 sm:w-[28rem] sm:justify-end"
        >
          <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-border bg-card shadow-xl sm:max-w-[28rem]">
            {!showPrefs ? (
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--pivt-gradient-primary)' }}>
                    <Cookie className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">Cookie Preferences</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      We use cookies to improve your experience and ensure the platform functions properly.{' '}
                      <Link to="/cookie-policy" className="text-accent hover:underline" onClick={() => setVisible(false)}>
                        Learn more
                      </Link>
                    </p>
                  </div>
                  <button onClick={() => setVisible(false)} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted/50">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={handleReject}>
                    Reject Non-Essential
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowPrefs(true)}>
                    Manage Preferences
                  </Button>
                  <Button size="sm" className="text-xs sm:ml-auto" style={{ background: 'var(--pivt-gradient-primary)' }} onClick={handleAccept}>
                    Accept All
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-accent" />
                  <p className="text-sm font-semibold text-foreground">Cookie Preferences</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">Essential Cookies</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Authentication, security, and core functionality</p>
                    </div>
                    <Switch checked disabled className="opacity-60" />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">Analytics Cookies</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Help us understand usage patterns and improve</p>
                    </div>
                    <Switch checked={analytics} onCheckedChange={setAnalytics} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">Functional Cookies</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Enhanced features and third-party integrations</p>
                    </div>
                    <Switch checked={functional} onCheckedChange={setFunctional} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowPrefs(false)}>
                    Back
                  </Button>
                  <Button size="sm" className="text-xs sm:ml-auto" style={{ background: 'var(--pivt-gradient-primary)' }} onClick={handleSavePrefs}>
                    Save Preferences
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
