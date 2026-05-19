import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, ArrowRight, ArrowLeft, Rocket, PlayCircle,
  CheckCircle2, Loader2, Building2, User, Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';

// Bump when the wizard adds steps so existing-completed users see the new bits.
const WIZARD_VERSION = '2026-05-18-v1';

// The wizard's 4 steps. Step 0 = welcome, 3 = done.
type Step = 0 | 1 | 2 | 3;

// Role list seeded from the customer personas we expect. Free-text fallback
// via "Other" so people who don't see themselves can still continue.
const ROLE_OPTIONS = [
  'M&A Lawyer',
  'Investment Banker',
  'Private Equity Investor',
  'Family Office',
  'Corporate Development',
  'CFO / Finance',
  'Operations / Closing Manager',
  'Other',
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  /** When the user picks "Explore demo" we'll close the wizard and navigate
   *  to the demo seed. The parent provides the navigation hook. */
  onPickDemo?: () => void;
}

export const OnboardingWizard: React.FC<Props> = ({ open, onClose, onPickDemo }) => {
  const { user } = useAuth();
  const { orgs, schemaReady, setActiveOrgId, refresh: refreshOrgs } = useOrg();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(0);
  const [firmName, setFirmName] = useState('');
  const [role, setRole] = useState<string>('');
  const [path, setPath] = useState<'real' | 'demo' | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed from existing user_metadata so re-opens of the wizard aren't blank.
  useEffect(() => {
    if (!open || !user) return;
    setFirmName((user.user_metadata as any)?.firm_name || '');
    setRole((user.user_metadata as any)?.role || '');
    setPath(null);
    setStep(0);
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Completion: persist + close + route based on chosen path ──
  const completeOnboarding = useCallback(async (chosenPath: 'real' | 'demo') => {
    setSaving(true);
    try {
      // Stamp completion on the user's auth metadata so the trigger detection
      // in the parent stops auto-opening on subsequent visits. We also keep
      // the firm name + role here so the rest of the app can use them later
      // (e.g. default deal owner display, segmented support).
      await supabase.auth.updateUser({
        data: {
          onboarding_complete: true,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_version: WIZARD_VERSION,
          firm_name: firmName.trim() || null,
          role: role || null,
          onboarding_choice: chosenPath,
        },
      });

      // Drop an audit_log breadcrumb so support can see who-onboarded-when.
      if (user?.id) {
        await supabase.from('audit_log').insert({
          user_id: user.id,
          action: 'onboarding_completed',
          details: {
            firm_name: firmName.trim() || null,
            role: role || null,
            chose: chosenPath,
            version: WIZARD_VERSION,
          },
        });
      }

      // ── Multi-tenancy: ensure the user has a workspace ──
      // The Phase-1 migration backfilled personal orgs for users who existed
      // at deploy-time. New users signing up AFTER the migration don't get
      // one for free, so the wizard handles it: if the user has no customer
      // orgs yet (only the read-only demo org), spin up their personal org
      // here using firm_name (or email-local-part as a fallback). The
      // backend already enforces RLS — admin-only writes — so this only
      // works because the user is creating their own row.
      const customerOrgs = orgs.filter((o) => o.org_type === 'customer');
      if (schemaReady && user?.id && customerOrgs.length === 0) {
        const orgName =
          (firmName.trim() ||
            (user.user_metadata as any)?.full_name ||
            (user.email ? user.email.split('@')[0] : 'My Workspace'));
        const slugBase = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'workspace';
        const slug = `${slugBase}-${user.id.slice(0, 8)}`;
        try {
          const { data: orgRow, error: orgErr } = await supabase
            .from('organizations')
            .insert({
              name: orgName,
              slug,
              org_type: 'customer',
              billing_email: user.email || null,
              created_by: user.id,
            })
            .select('id')
            .single();
          if (orgErr) throw orgErr;
          if (orgRow) {
            await supabase
              .from('organization_memberships')
              .insert({ org_id: orgRow.id, user_id: user.id, role: 'owner' });
            await refreshOrgs();
            setActiveOrgId(orgRow.id);
          }
        } catch (err: any) {
          // Non-fatal — the rest of onboarding still completes. Surface the
          // error so the user knows their workspace needs manual setup.
          console.warn('Failed to auto-create workspace:', err?.message);
          toast.error(`Couldn't create your workspace: ${err?.message ?? 'unknown'}. You can create one from the topbar later.`);
        }
      }

      onClose();

      if (chosenPath === 'real') {
        // Navigate to Deals, then dispatch the event DealsCover listens for
        // to pop open the Create Deal modal. Small delay so DealsCover has
        // time to mount before it gets the event.
        navigate('/?section=deals');
        setTimeout(() => window.dispatchEvent(new CustomEvent('pivt:open-create-deal-modal')), 300);
      } else {
        // Demo path — parent decides where to send the user (likely the demo
        // deal workspace). Fall back to the deals list if no callback.
        if (onPickDemo) onPickDemo();
        else navigate('/?section=deals');
      }
    } catch (err: any) {
      toast.error(`Could not save onboarding: ${err?.message ?? 'unknown'}`);
    } finally {
      setSaving(false);
    }
  }, [firmName, role, user?.id, navigate, onClose, onPickDemo, orgs, schemaReady, refreshOrgs, setActiveOrgId]);

  // ── Step content components — kept inline because each is small and
  //    sharing state via closure is simpler than prop-drilling. ──
  const ProgressBar = (
    <div className="flex items-center gap-1.5 mb-6">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i <= step ? 'bg-accent' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  );

  const renderStep = () => {
    if (step === 0) {
      // Welcome — sets expectations, no inputs needed.
      return (
        <motion.div
          key="welcome"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--pivt-gradient-primary)' }}>
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">Welcome to PIVT{user?.user_metadata?.full_name ? `, ${(user.user_metadata as any).full_name.split(' ')[0]}` : ''}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The payments execution layer for M&A. Close deals faster by letting Newton AI handle the paperwork, reconcile the numbers, and route the approvals.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { icon: '📄', label: 'Upload your deal docs' },
              { icon: '🤖', label: 'AI extracts the data' },
              { icon: '💸', label: 'Execute wires + close' },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-center text-muted-foreground">
            This will take less than a minute.
          </p>
        </motion.div>
      );
    }

    if (step === 1) {
      // About-you — minimal: firm name + role. Both optional, the wizard
      // doesn't gate on them since some users won't have answers ready.
      return (
        <motion.div
          key="about"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="space-y-5"
        >
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              <User className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-xl font-semibold">Tell us about your work</h2>
            <p className="text-sm text-muted-foreground">
              Helps us tailor what you see. Both are optional.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="firmName" className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Firm name
              </Label>
              <Input
                id="firmName"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="e.g. Atlas Capital, Smith & Co."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role" className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Your role
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role"><SelectValue placeholder="Pick the closest match" /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>
      );
    }

    if (step === 2) {
      // Choose path — two big cards. Either selection moves to the final
      // step. We render them clickable so a tap commits the choice rather
      // than requiring a second Continue button.
      return (
        <motion.div
          key="path"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="space-y-5"
        >
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              <Rocket className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-xl font-semibold">How do you want to start?</h2>
            <p className="text-sm text-muted-foreground">Either way, you can come back to this from Settings.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPath('real')}
              className={`p-4 rounded-xl border text-left transition-all ${
                path === 'real'
                  ? 'border-accent bg-accent/5 ring-2 ring-accent/30'
                  : 'border-border hover:border-accent/40 hover:bg-muted/30'
              }`}
            >
              <Rocket className={`w-5 h-5 mb-2 ${path === 'real' ? 'text-accent' : 'text-muted-foreground'}`} />
              <p className="text-sm font-semibold">Create my first deal</p>
              <p className="text-xs text-muted-foreground mt-1">Start a real workspace. Takes 30 seconds — you can flesh it out later.</p>
            </button>
            <button
              type="button"
              onClick={() => setPath('demo')}
              className={`p-4 rounded-xl border text-left transition-all ${
                path === 'demo'
                  ? 'border-accent bg-accent/5 ring-2 ring-accent/30'
                  : 'border-border hover:border-accent/40 hover:bg-muted/30'
              }`}
            >
              <PlayCircle className={`w-5 h-5 mb-2 ${path === 'demo' ? 'text-accent' : 'text-muted-foreground'}`} />
              <p className="text-sm font-semibold">Show me a demo first</p>
              <p className="text-xs text-muted-foreground mt-1">Walk through a pre-loaded deal end-to-end so you can see how it works.</p>
            </button>
          </div>
        </motion.div>
      );
    }

    // Step 3 — Done state, brief. We auto-advance into the chosen path
    // when the user clicks Finish, so this is mostly a confirmation pause.
    return (
      <motion.div
        key="done"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="space-y-5 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">You're set up</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {path === 'real'
              ? 'We\'ll open the New Deal form when you continue.'
              : 'We\'ll drop you into a fully-loaded demo deal so you can poke around.'}
          </p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3 text-left text-xs text-muted-foreground space-y-1">
          <p><strong>Tip:</strong> Newton (the sparkle button bottom-right) can answer questions about any deal — "what's blocking this close?", "draft a reminder for the seller's counsel", etc.</p>
        </div>
      </motion.div>
    );
  };

  const canContinue =
    step === 0 ? true :
    step === 1 ? true :  // both fields optional
    step === 2 ? path !== null :
    true;

  const handleNext = () => {
    if (step < 3) setStep((step + 1) as Step);
    else if (path) completeOnboarding(path);
  };

  const handleBack = () => {
    if (step > 0) setStep((step - 1) as Step);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden">
        <div className="p-6 pb-4">
          {ProgressBar}
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>
        <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={step === 0 ? onClose : handleBack}
            disabled={saving}
          >
            {step === 0 ? 'Skip' : <><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back</>}
          </Button>
          <div className="text-[11px] text-muted-foreground">
            Step {step + 1} of 4
          </div>
          <Button
            onClick={handleNext}
            disabled={!canContinue || saving}
            className="gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {step === 3
              ? (path === 'real' ? 'Create my deal' : 'Open the demo')
              : <>Continue <ArrowRight className="w-3.5 h-3.5" /></>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
