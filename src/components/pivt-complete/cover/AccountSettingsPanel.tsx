import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, KeyRound, Download, Trash2, Send, Mail, CheckCircle2,
  AlertTriangle, Loader2, ShieldCheck, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MfaFactor {
  id: string;
  status: 'verified' | 'unverified';
  factor_type: string;
  friendly_name?: string;
  created_at: string;
}

export const AccountSettingsPanel: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [factorsLoading, setFactorsLoading] = useState(true);

  // 2FA enrollment dialog state
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollStep, setEnrollStep] = useState<'qr' | 'verify'>('qr');
  const [enrollQrSvg, setEnrollQrSvg] = useState('');
  const [enrollSecret, setEnrollSecret] = useState('');
  const [enrollFactorId, setEnrollFactorId] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollBusy, setEnrollBusy] = useState(false);

  // Test email + delete account state
  const [testEmailBusy, setTestEmailBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  // ── Load active MFA factors ──
  const loadFactors = async () => {
    setFactorsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      // Supabase returns totp[] / phone[]; we surface TOTP only.
      setFactors((data?.totp || []) as MfaFactor[]);
    } catch (err: any) {
      console.warn('MFA factor list failed:', err?.message);
    } finally {
      setFactorsLoading(false);
    }
  };
  useEffect(() => { loadFactors(); }, []);

  // ── 2FA: enroll new TOTP factor ──
  const startEnroll = async () => {
    setEnrollBusy(true);
    try {
      // friendlyName is what the user sees in their authenticator app, useful
      // when they have multiple PIVT-like services enrolled.
      const friendlyName = `PIVT (${user?.email || 'account'})`;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      });
      if (error) throw error;
      setEnrollFactorId(data.id);
      setEnrollQrSvg(data.totp.qr_code);
      setEnrollSecret(data.totp.secret);
      setEnrollStep('qr');
      setEnrollOpen(true);
    } catch (err: any) {
      toast.error(`2FA setup failed: ${err?.message || 'unknown error'}`);
    } finally {
      setEnrollBusy(false);
    }
  };

  const verifyEnroll = async () => {
    if (!enrollFactorId || enrollCode.length < 6) {
      toast.error('Enter the 6-digit code from your authenticator app');
      return;
    }
    setEnrollBusy(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challenge.data.id,
        code: enrollCode.trim(),
      });
      if (verify.error) throw verify.error;
      toast.success('Two-factor authentication enabled.');
      setEnrollOpen(false);
      setEnrollCode('');
      await loadFactors();
    } catch (err: any) {
      toast.error(`Verification failed: ${err?.message || 'wrong code?'}`);
    } finally {
      setEnrollBusy(false);
    }
  };

  const unenrollFactor = async (factorId: string) => {
    const ok = window.confirm('Disable two-factor authentication on this account? Future sign-ins will only need your password.');
    if (!ok) return;
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success('Two-factor authentication disabled.');
      await loadFactors();
    } catch (err: any) {
      toast.error(`Failed to disable 2FA: ${err?.message}`);
    }
  };

  // ── Admin-only: send test email to current user via auth-email pipeline ──
  const sendTestEmail = async () => {
    if (!user?.email) {
      toast.error('No email on your account');
      return;
    }
    setTestEmailBusy(true);
    try {
      // Password-reset is the simplest auth-email pipeline trigger that we
      // know is always wired (vs. signup confirmation which depends on the
      // "Confirm email" Supabase toggle being on).
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success(`Test email dispatched to ${user.email}`, {
        description: 'Should arrive within 30s from notify.pivttech.ai. Check spam if not.',
      });
    } catch (err: any) {
      toast.error(`Test email failed: ${err?.message}`);
    } finally {
      setTestEmailBusy(false);
    }
  };

  // ── Export: collect this user's personal data + download as JSON ──
  // GDPR / CCPA "right to data portability" — gives the user a copy of
  // everything we hold about them in one self-describing bundle.
  const exportMyData = async () => {
    if (!user) return;
    setExportBusy(true);
    try {
      const [auditRes, commentsRes, participantsRes, capRes] = await Promise.all([
        supabase.from('audit_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5000),
        supabase.from('deal_comments').select('*').eq('author_user_id', user.id).order('created_at', { ascending: false }).limit(5000),
        supabase.from('deal_participants').select('*').eq('user_id', user.id),
        supabase.from('cap_table_entries').select('*').eq('email', user.email || '_').limit(1000),
      ]);

      const bundle = {
        exported_at: new Date().toISOString(),
        exported_for: { id: user.id, email: user.email },
        user_metadata: user.user_metadata,
        sources: {
          audit_log: auditRes.data || [],
          deal_comments: commentsRes.data || [],
          deal_participants: participantsRes.data || [],
          cap_table_entries_by_email: capRes.data || [],
        },
        notes: 'This is a portable copy of the personal data PIVT holds for your account, as required by data-protection laws (GDPR Art. 20, CCPA §1798.110). Contact privacy@pivttech.ai for questions.',
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pivt-data-export-${user.email || user.id}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data export downloaded.');

      // Log the export request itself for audit completeness.
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'account_data_exported',
        details: { rows: { audit_log: (auditRes.data || []).length, deal_comments: (commentsRes.data || []).length, deal_participants: (participantsRes.data || []).length, cap_table_entries: (capRes.data || []).length } },
      });
    } catch (err: any) {
      toast.error(`Export failed: ${err?.message}`);
    } finally {
      setExportBusy(false);
    }
  };

  // ── Delete account: marks for deletion + signs out ──
  // Honest small-fix: client SDK can't hard-delete (admin-only). Instead we
  // record the request in audit_log and sign the user out. Support manually
  // purges the auth.users row within the SLA stated in the dialog. A
  // scheduled-task automation can replace this step later.
  const confirmDelete = async () => {
    if (!user || !user.email) return;
    if (deleteConfirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast.error('Type your account email to confirm.');
      return;
    }
    setDeleteBusy(true);
    try {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'account_deletion_requested',
        details: { email: user.email, requested_at: new Date().toISOString() },
      });
      toast.success('Account deletion requested.', {
        description: 'Your account has been marked for deletion. Our team will purge it within 7 business days. You\'ve been signed out.',
        duration: 8000,
      });
      setDeleteOpen(false);
      await signOut();
    } catch (err: any) {
      toast.error(`Could not record deletion: ${err?.message}`);
    } finally {
      setDeleteBusy(false);
    }
  };

  const verifiedFactor = factors.find((f) => f.status === 'verified');
  const has2FA = !!verifiedFactor;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      {/* ── Profile ── */}
      <section className="pivt-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <h3 className="font-semibold">Account</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Name</p>
            <p className="font-medium">{user?.user_metadata?.full_name || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">User ID</p>
            <p className="font-mono text-xs">{user?.id}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Terms version</p>
            <p className="font-mono text-xs">{user?.user_metadata?.terms_version || 'pre-2026-05'}</p>
          </div>
        </div>
      </section>

      {/* ── 2FA ── */}
      <section className="pivt-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-accent" />
            <h3 className="font-semibold">Two-Factor Authentication</h3>
            {has2FA && (
              <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px] gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> Enabled
              </Badge>
            )}
          </div>
          {factorsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : has2FA ? (
            <Button variant="outline" size="sm" onClick={() => unenrollFactor(verifiedFactor!.id)}>
              Disable
            </Button>
          ) : (
            <Button size="sm" onClick={startEnroll} disabled={enrollBusy} className="gap-1.5">
              {enrollBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Enable 2FA
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Adds a one-time-code step on every sign-in. Use any TOTP authenticator app — 1Password, Authy, Google Authenticator, etc.
        </p>
      </section>

      {/* ── Admin: test email pipeline ── */}
      {isAdmin && (
        <section className="pivt-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-accent" />
              <h3 className="font-semibold">Email delivery test</h3>
              <Badge variant="outline" className="text-[10px]">Admin</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={sendTestEmail} disabled={testEmailBusy} className="gap-1.5">
              {testEmailBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send test
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Dispatches a password-reset email to your address via the Lovable email pipeline (<code className="text-[11px] bg-muted/60 px-1 py-0.5 rounded">notify.pivttech.ai</code>). Use this if a customer reports a missing email — it isolates whether the pipeline is the problem vs. their specific inbox.
          </p>
        </section>
      )}

      {/* ── Data export ── */}
      <section className="pivt-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-accent" />
            <h3 className="font-semibold">Export my data</h3>
          </div>
          <Button size="sm" variant="outline" onClick={exportMyData} disabled={exportBusy} className="gap-1.5">
            {exportBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download JSON
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Downloads a JSON bundle of personal data PIVT holds for your account — audit-log entries you triggered, comments you've posted, deals you're a participant on, and cap-table entries that match your email. Required by GDPR Art. 20 / CCPA §1798.110. The export itself is recorded in your audit log.
        </p>
      </section>

      {/* ── Delete account ── */}
      <section className="pivt-card p-6 space-y-4 border-destructive/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-destructive">Delete account</h3>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Delete my account
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Marks your account for deletion. Our team purges the account and personal data within 7 business days. Deal records you're a participant on remain (deals are immutable financial records) but your identity is unlinked. Reach <a href="mailto:privacy@pivttech.ai" className="text-accent hover:underline">privacy@pivttech.ai</a> with any questions.
        </p>
      </section>

      {/* ── 2FA Enrollment dialog ── */}
      <Dialog open={enrollOpen} onOpenChange={(o) => { if (!o) { setEnrollOpen(false); setEnrollCode(''); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {enrollQrSvg && (
              <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-border">
                {/* Supabase returns SVG markup. Trusted source. */}
                <div dangerouslySetInnerHTML={{ __html: enrollQrSvg }} />
              </div>
            )}
            {enrollSecret && (
              <div className="space-y-1.5">
                <Label className="text-xs">Or enter this secret manually:</Label>
                <code className="block bg-muted/60 px-3 py-2 rounded font-mono text-xs break-all">{enrollSecret}</code>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="totp">Code from your authenticator app</Label>
              <Input
                id="totp"
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                className="font-mono tracking-widest text-center text-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)} disabled={enrollBusy}>Cancel</Button>
            <Button onClick={verifyEnroll} disabled={enrollBusy || enrollCode.length !== 6} className="gap-1.5">
              {enrollBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <ShieldCheck className="w-3.5 h-3.5" />
              Verify & enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => { if (!o) { setDeleteOpen(false); setDeleteConfirmEmail(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete this account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This marks your account for permanent deletion. Within 7 business days, our team will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Remove your auth record and personal profile data</li>
                <li>Unlink your identity from any deals you're a participant on</li>
                <li>Preserve immutable financial records (audit log, approvals) for compliance — but your name/email is replaced with "Deleted user"</li>
              </ul>
              <span className="block mt-3">Type your email <strong>{user?.email}</strong> to confirm:</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmEmail}
            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            placeholder={user?.email}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleteBusy || deleteConfirmEmail.trim().toLowerCase() !== (user?.email || '').toLowerCase()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};
