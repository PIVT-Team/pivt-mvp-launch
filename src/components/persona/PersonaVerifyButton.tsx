// PersonaVerifyButton — opens the Persona embedded verification modal for
// a stakeholder. Used inside the KYC tab as the primary "Run verification"
// action, complementing the existing email-link + manual-review path.
//
// UX notes:
//   • If a prior verification exists for the same email on another deal,
//     we show "Reuse verification from [Deal X]" first. One click links
//     the existing Persona Account to the new inquiry — faster + cheaper
//     than re-running the full flow. (Persona doesn't bill for inquiries
//     that match an existing Account.)
//   • Loading state covers two phases: creating the inquiry (server) and
//     loading the Persona SDK (CDN). Both feel like one wait to the user.
//   • Completion: we trust the SDK callback for instant UI feedback only.
//     The webhook is the actual source of truth — it lands milliseconds
//     later via realtime subscription on cap_table_entries.

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, RotateCcw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  startVerification,
  findReusableAccount,
  type PersonaKind,
} from '@/services/personaService';

interface Props {
  dealId: string;
  stakeholderId: string;
  stakeholderEmail?: string | null;
  /** Default 'kyc' for individuals, 'kyb' for entities */
  kind?: PersonaKind;
  /** Small variant for inline use in tables */
  variant?: 'default' | 'inline';
  onStarted?: () => void;
  onCompleted?: (status: string) => void;
}

export const PersonaVerifyButton: React.FC<Props> = ({
  dealId,
  stakeholderId,
  stakeholderEmail,
  kind = 'kyc',
  variant = 'default',
  onStarted,
  onCompleted,
}) => {
  const [busy, setBusy] = useState(false);
  const [reusable, setReusable] = useState<Awaited<ReturnType<typeof findReusableAccount>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!stakeholderEmail) return;
    findReusableAccount(stakeholderEmail).then((found) => {
      if (!cancelled && found && found.source_deal_id !== dealId) setReusable(found);
    });
    return () => {
      cancelled = true;
    };
  }, [stakeholderEmail, dealId]);

  const handleStart = async () => {
    setBusy(true);
    onStarted?.();
    const result = await startVerification({
      dealId,
      stakeholderId,
      kind,
      onComplete: ({ status }) => {
        // Trust the SDK for *visual* feedback only — webhook is source of truth.
        if (status === 'completed' || status === 'approved') {
          toast.success('Verification submitted — Persona will finalise momentarily.');
        } else if (status === 'declined' || status === 'failed') {
          toast.error('Verification failed. The stakeholder can retry.');
        } else {
          toast.message('Verification closed. Status pending Persona webhook.');
        }
        onCompleted?.(status);
      },
      onCancel: () => {
        toast.message('Verification cancelled.');
        setBusy(false);
      },
    });
    if (!result.success) {
      if (result.error?.includes('PERSONA_NOT_CONFIGURED')) {
        toast.error('Persona is not configured for this workspace yet. Ask an admin to set it up in Settings.');
      } else {
        toast.error(result.error || 'Could not start verification');
      }
    } else if (result.reused_account) {
      toast.success('Linked existing Persona identity — verification will be faster for this stakeholder.');
    }
    setBusy(false);
  };

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleStart}
        disabled={busy}
        className="text-xs text-accent flex items-center gap-1 hover:underline disabled:opacity-50"
        title={reusable ? `Will reuse Persona identity from a prior deal (last verified ${new Date(reusable.last_verified_at).toLocaleDateString()})` : 'Run Persona-powered ID verification'}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
        {busy ? 'Opening…' : reusable ? 'Reuse + Verify' : 'Verify (Persona)'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleStart}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        {busy ? 'Opening verification…' : reusable ? 'Reuse + Verify with Persona' : 'Verify with Persona'}
      </button>
      {reusable && (
        <span className="text-[10px] text-muted-foreground flex items-center gap-1" title={`Previously verified on ${new Date(reusable.last_verified_at).toLocaleDateString()}`}>
          <RotateCcw className="w-3 h-3" />
          Identity reused
        </span>
      )}
    </div>
  );
};

// Banner shown when Persona credentials aren't set in Supabase secrets.
// We render this if a verify attempt returns PERSONA_NOT_CONFIGURED, so
// users see why the button doesn't work rather than a silent failure.
export const PersonaNotConfiguredBanner: React.FC = () => (
  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
    <div>
      <p className="font-medium">Persona is not connected yet</p>
      <p className="mt-0.5 text-amber-700/80 dark:text-amber-300/80">
        Set <code className="font-mono text-[10px]">PERSONA_API_KEY</code>, <code className="font-mono text-[10px]">PERSONA_WEBHOOK_SECRET</code>, and <code className="font-mono text-[10px]">PERSONA_DEFAULT_KYC_TEMPLATE</code> in Supabase Edge Function secrets to enable identity verification.
      </p>
    </div>
  </div>
);
