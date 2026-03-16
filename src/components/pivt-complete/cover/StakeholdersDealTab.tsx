import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { fadeInUp } from '@/lib/animations';
import { CheckCircle2, Clock, XCircle, Plus, DollarSign, Shield, Users, Percent, CreditCard, Lock, UserPlus, MoreHorizontal, Send, Copy, RotateCw, BadgeCheck, Eye, AlertTriangle, FileSearch, Mail, Pencil, Trash2 } from 'lucide-react';
import { NewtonSourceBadge } from './NewtonSourceBadge';
import { Badge } from '@/components/ui/badge';
import { AddStakeholderModal } from './AddStakeholderModal';
import { EditStakeholderModal } from './EditStakeholderModal';
import { useEditGuard } from '@/hooks/useEditGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { applyEvent } from '@/services/dealStateMachineService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DbStakeholder {
  id: string;
  shareholder_name: string;
  ownership_pct: number;
  payout_amount: number;
  escrow_holdback: number | null;
  fees: number | null;
  net_payout: number | null;
  email: string | null;
  role: string;
  stakeholder_type: string;
  verification_status: string;
  verification_requested_at: string | null;
  verification_last_sent_at: string | null;
  verification_completed_at: string | null;
  verification_rejection_reason: string | null;
  verification_provider: string | null;
  verification_reference_id: string | null;
}

const STATUS_CHIP: Record<string, { label: string; className: string; tooltip: string }> = {
  not_sent: { label: 'Not Requested', className: 'bg-muted text-muted-foreground border-border', tooltip: "Verification hasn't been initiated." },
  not_requested: { label: 'Not Requested', className: 'bg-muted text-muted-foreground border-border', tooltip: "Verification hasn't been initiated." },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground border-border', tooltip: "Verification is pending." },
  sent: { label: 'Email Sent', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20', tooltip: 'Verification request email has been sent.' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', tooltip: 'Stakeholder has started verification.' },
  submitted: { label: 'Submitted', className: 'bg-accent/10 text-accent border-accent/20', tooltip: 'Verification data submitted, awaiting review.' },
  verified: { label: 'Verified', className: 'bg-validated/10 text-validated border-validated/20', tooltip: 'Stakeholder is verified.' },
  failed: { label: 'Rejected', className: 'bg-destructive/10 text-destructive border-destructive/20', tooltip: 'Verification failed. Review details.' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground border-border', tooltip: 'Verification link has expired.' },
};

export const StakeholdersDealTab: React.FC = () => {
  const { isDemoDeal, dealId } = useDealWorkspace();
  const { stakeholders: demoStakeholders } = usePIVTStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<DbStakeholder | null>(null);
  const { isProtected, guardEdit } = useEditGuard();
  const [dbStakeholders, setDbStakeholders] = useState<DbStakeholder[]>([]);
  const [loading, setLoading] = useState(!isDemoDeal);
  const { isAdmin } = useAuth();
  const lastSendTimesRef = useRef<Record<string, number>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchStakeholders = async () => {
    if (isDemoDeal || !dealId) return;
    setLoading(true);
    const { data } = await supabase
      .from('cap_table_entries')
      .select('*')
      .eq('deal_id', dealId);
    setDbStakeholders((data as DbStakeholder[]) || []);
    setLoading(false);
  };

  const checkRateLimit = (stakeholderId: string): boolean => {
    const last = lastSendTimesRef.current[stakeholderId] || 0;
    if (Date.now() - last < 60_000) {
      toast.error('Please wait before resending verification.');
      return false;
    }
    return true;
  };

  const invokeVerification = async (stakeholderId: string, isResend: boolean) => {
    if (!checkRateLimit(stakeholderId)) return;
    setSendingId(stakeholderId);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification', {
        body: { stakeholder_id: stakeholderId, deal_id: dealId },
      });
      if (error) {
        // Generic invoke failure (network, CORS, etc.)
        toast.error(error.message || 'Failed to send verification email');
      } else if (data?.success === false || data?.error) {
        // Edge function returned an application-level error (HTTP 200 with success:false)
        toast.error(data.error || 'Failed to send verification email');
      } else {
        lastSendTimesRef.current[stakeholderId] = Date.now();
        const modeLabel = data?.mode === 'MOCK' ? ' (MOCK)' : '';
        toast.success(isResend ? `Verification email re-sent${modeLabel}.` : `Verification email sent${modeLabel}.`);
        if (dealId) applyEvent(dealId, 'VERIFICATION_SENT', { stakeholder_id: stakeholderId, resend: isResend }).catch(console.error);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error sending verification');
    }
    setSendingId(null);
    await fetchStakeholders();
  };

  const sendVerification = (stakeholderId: string) => invokeVerification(stakeholderId, false);
  const resendVerification = (stakeholderId: string) => invokeVerification(stakeholderId, true);

  const copyVerificationLink = async (stakeholderId: string) => {
    const { data } = await supabase
      .from('verification_requests')
      .select('id')
      .eq('stakeholder_id', stakeholderId)
      .eq('deal_id', dealId!)
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) {
      toast.info('No active verification request. Send a verification email first.');
      return;
    }
    toast.info('Verification links are unique per email send. Use "Send Verification" to email a new link.');
  };

  const markVerified = async (stakeholderId: string) => {
    const { data: reqs } = await supabase
      .from('verification_requests')
      .select('id')
      .eq('stakeholder_id', stakeholderId)
      .eq('deal_id', dealId!)
      .order('created_at', { ascending: false })
      .limit(1);

    if (reqs && reqs.length > 0) {
      await supabase.functions.invoke('manual-verify', {
        body: { request_id: reqs[0].id, verified: true, notes: 'Manually verified by admin' },
      });
    } else {
      await supabase
        .from('cap_table_entries')
        .update({ verification_status: 'verified' } as any)
        .eq('id', stakeholderId);
    }
    toast.success('Marked as verified');
    if (dealId) applyEvent(dealId, 'VERIFICATION_VERIFIED', { stakeholder_id: stakeholderId }).catch(console.error);
    await fetchStakeholders();
  };

  const markFailed = async (stakeholderId: string) => {
    const { data: reqs } = await supabase
      .from('verification_requests')
      .select('id')
      .eq('stakeholder_id', stakeholderId)
      .eq('deal_id', dealId!)
      .order('created_at', { ascending: false })
      .limit(1);

    if (reqs && reqs.length > 0) {
      await supabase.functions.invoke('manual-verify', {
        body: { request_id: reqs[0].id, verified: false, notes: 'Manually failed by admin' },
      });
    } else {
      await supabase
        .from('cap_table_entries')
        .update({ verification_status: 'failed' } as any)
        .eq('id', stakeholderId);
    }
    toast.success('Marked as failed');
    if (dealId) applyEvent(dealId, 'VERIFICATION_FAILED', { stakeholder_id: stakeholderId }).catch(console.error);
    await fetchStakeholders();
  };

  const deleteStakeholder = async (stakeholderId: string) => {
    const { error } = await supabase
      .from('cap_table_entries')
      .delete()
      .eq('id', stakeholderId);
    if (error) {
      toast.error(`Failed to remove stakeholder: ${error.message}`);
    } else {
      toast.success('Stakeholder removed');
      await fetchStakeholders();
    }
  };

  useEffect(() => {
    fetchStakeholders();
  }, [isDemoDeal, dealId]);

  const handleAddClick = () => {
    guardEdit('ADD_STAKEHOLDER', null, () => setModalOpen(true));
  };

  const verificationBadge = (s: DbStakeholder) => {
    const status = s.verification_status;
    const cfg = STATUS_CHIP[status] || STATUS_CHIP.not_sent;
    const showWarning = status === 'failed';
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1">
              <Badge variant="outline" className={`${cfg.className} text-[10px] whitespace-nowrap`}>
                {showWarning && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
                {cfg.label}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {cfg.tooltip}
            {status === 'failed' && s.verification_rejection_reason && (
              <span className="block mt-1 text-[10px] opacity-80">Reason: {s.verification_rejection_reason}</span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const getPrimaryAction = (s: DbStakeholder) => {
    const isSending = sendingId === s.id;
    const status = s.verification_status;

    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-validated whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" />
          Verified
        </span>
      );
    }

    if (status === 'not_sent' || status === 'not_requested') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => sendVerification(s.id)}
                disabled={isSending || !s.email}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Mail className="w-3 h-3" />
                {isSending ? 'Sending…' : 'Send Verification'}
              </button>
            </TooltipTrigger>
            <TooltipContent>Send KYB/KYC verification email to this stakeholder</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (status === 'sent' || status === 'in_progress' || status === 'pending') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => resendVerification(s.id)}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RotateCw className="w-3 h-3" />
                {isSending ? 'Sending…' : 'Resend'}
              </button>
            </TooltipTrigger>
            <TooltipContent>Resend KYB/KYC verification email</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (status === 'submitted') {
      return (
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors whitespace-nowrap">
          <FileSearch className="w-3 h-3" />
          Review
        </button>
      );
    }

    if (status === 'failed' || status === 'expired') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => resendVerification(s.id)}
                disabled={isSending || !s.email}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RotateCw className="w-3 h-3" />
                Resend
              </button>
            </TooltipTrigger>
            <TooltipContent>Previous verification expired or failed — resend to try again</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return null;
  };

  // ─── Non-demo deal ───
  if (!isDemoDeal) {
    if (loading) {
      return (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (dbStakeholders.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Stakeholders</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Manage deal participants, ownership, and payout details.</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total Payout', value: '$0', icon: DollarSign, color: 'text-accent' },
              { label: 'Verified', value: '0/0', icon: Shield, color: 'text-validated' },
              { label: 'KYC Complete', value: '0/0', icon: CheckCircle2, color: 'text-validated' },
              { label: 'Wire Collected', value: '0/0', icon: CreditCard, color: 'text-accent' },
              { label: 'Ownership', value: '0%', icon: Percent, color: 'text-foreground' },
            ].map(card => (
              <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</span>
                </div>
                <p className="text-lg font-semibold">{card.value}</p>
              </motion.div>
            ))}
          </div>
          <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">No stakeholders added yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add stakeholders to define ownership, KYC, and payout details.</p>
            </div>
            <button
              onClick={handleAddClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Stakeholder
            </button>
          </motion.div>
          <AddStakeholderModal open={modalOpen} onClose={() => setModalOpen(false)} dealId={dealId} isDemoDeal={false} onAdded={fetchStakeholders} />
        </div>
      );
    }

    const totalPayout = dbStakeholders.reduce((s, x) => s + x.payout_amount, 0);
    const totalOwnership = dbStakeholders.reduce((s, x) => s + x.ownership_pct, 0);
    const verifiedCount = dbStakeholders.filter(s => s.verification_status === 'verified').length;
    const emailSentCount = dbStakeholders.filter(s => s.verification_status === 'sent').length;
    const inProgressCount = dbStakeholders.filter(s => ['in_progress', 'submitted'].includes(s.verification_status)).length;
    const rejectedCount = dbStakeholders.filter(s => s.verification_status === 'failed').length;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Stakeholders</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage deal participants, ownership, and payout details.</p>
          </div>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Stakeholder
          </button>
        </div>

        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Total Payout', value: `$${(totalPayout / 1e6).toFixed(1)}M`, icon: DollarSign, color: 'text-accent' },
            { label: 'Verified', value: `${verifiedCount}/${dbStakeholders.length}`, icon: Shield, color: 'text-validated' },
            { label: 'Email Sent', value: `${emailSentCount}`, icon: Mail, color: 'text-blue-500' },
            { label: 'In Progress', value: `${inProgressCount}`, icon: Clock, color: 'text-yellow-600' },
            { label: 'Rejected', value: `${rejectedCount}`, icon: XCircle, color: 'text-destructive' },
            { label: 'Ownership', value: `${totalOwnership}%`, icon: Percent, color: 'text-foreground' },
          ].map(card => (
            <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-lg font-semibold">{card.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Table */}
        <div className="pivt-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3 w-[28%]">Stakeholder</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-3 w-[12%]">Role</th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-3 w-[10%]">Ownership</th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-3 w-[10%]">Payout</th>
                  <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-3 w-[14%]">Verification Status</th>
                  <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-3 w-[14%]">Action</th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-3 w-[10%]">Net Payout</th>
                  <th className="w-[2%] px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {dbStakeholders.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-medium text-sm truncate">{s.shareholder_name}</p>
                      {s.email && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.email}</p>}
                    </td>
                    <td className="px-3 py-4 text-sm text-muted-foreground whitespace-nowrap">{s.role}</td>
                    <td className="px-3 py-4 text-right font-mono text-sm whitespace-nowrap">{s.ownership_pct}%</td>
                    <td className="px-3 py-4 text-right font-mono text-sm whitespace-nowrap">${(s.payout_amount / 1e6).toFixed(1)}M</td>
                    <td className="px-3 py-4 text-center">{verificationBadge(s)}</td>
                    <td className="px-3 py-4 text-center">{getPrimaryAction(s)}</td>
                    <td className="px-3 py-4 text-right font-mono text-sm text-validated whitespace-nowrap">${((s.net_payout || 0) / 1e6).toFixed(1)}M</td>
                    <td className="px-2 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[70]">
                          <DropdownMenuItem onClick={() => setEditingStakeholder(s)} className="gap-2">
                            <Pencil className="w-3.5 h-3.5" />
                            Edit Stakeholder
                          </DropdownMenuItem>
                          {(s.verification_status === 'not_sent' || s.verification_status === 'not_requested') && (
                            <DropdownMenuItem onClick={() => sendVerification(s.id)} className="gap-2" disabled={!s.email}>
                              <Mail className="w-3.5 h-3.5" />
                              Send Verification
                            </DropdownMenuItem>
                          )}
                          {['sent', 'in_progress', 'pending', 'failed', 'expired'].includes(s.verification_status) && (
                            <DropdownMenuItem onClick={() => resendVerification(s.id)} className="gap-2" disabled={!s.email}>
                              <RotateCw className="w-3.5 h-3.5" />
                              Resend Verification
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => copyVerificationLink(s.id)} className="gap-2">
                            <Copy className="w-3.5 h-3.5" />
                            Copy Verification Link
                          </DropdownMenuItem>
                          {s.verification_status === 'submitted' && (
                            <DropdownMenuItem className="gap-2">
                              <FileSearch className="w-3.5 h-3.5" />
                              View Submission
                            </DropdownMenuItem>
                          )}
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              {s.verification_status !== 'verified' && (
                                <DropdownMenuItem onClick={() => markVerified(s.id)} className="gap-2">
                                  <BadgeCheck className="w-3.5 h-3.5" />
                                  Mark Verified (Admin)
                                </DropdownMenuItem>
                              )}
                              {s.verification_status !== 'failed' && (
                                <DropdownMenuItem onClick={() => markFailed(s.id)} className="gap-2 text-destructive">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Mark Failed (Admin)
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteStakeholder(s.id)} className="gap-2 text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove Stakeholder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <AddStakeholderModal open={modalOpen} onClose={() => setModalOpen(false)} dealId={dealId} isDemoDeal={false} onAdded={fetchStakeholders} />
        <EditStakeholderModal
          open={!!editingStakeholder}
          onClose={() => setEditingStakeholder(null)}
          stakeholder={editingStakeholder}
          dealId={dealId}
          onUpdated={fetchStakeholders}
        />
      </div>
    );
  }

  // ─── Demo deal — existing behavior ───
  const verified = demoStakeholders.filter(s => s.kycStatus === 'verified').length;
  const total = demoStakeholders.length;
  const totalPayout = demoStakeholders.reduce((s, x) => s + x.payoutAmount, 0);
  const totalOwnership = demoStakeholders.reduce((s, x) => s + x.ownershipPct, 0);

  const wireStatus = (s: typeof demoStakeholders[0]) =>
    s.kycStatus === 'verified' ? 'Collected' : s.kycStatus === 'pending' ? 'Pending' : 'Not Sent';

  const summaryCards = [
    { label: 'Total Payout', value: `$${(totalPayout / 1e6).toFixed(1)}M`, icon: DollarSign, color: 'text-accent' },
    { label: 'Verified', value: `${verified}/${total}`, icon: Shield, color: 'text-validated' },
    { label: 'KYC Complete', value: `${verified}/${total}`, icon: CheckCircle2, color: 'text-validated' },
    { label: 'Wire Collected', value: `${verified}/${total}`, icon: CreditCard, color: 'text-accent' },
    { label: 'Ownership', value: `${totalOwnership}%`, icon: Percent, color: 'text-foreground' },
  ];

  const statusBadge = (s: typeof demoStakeholders[0]) => {
    if (s.kycStatus === 'verified') return <Badge className="bg-validated/10 text-validated text-[10px]">Verified</Badge>;
    if (s.kycStatus === 'pending') return <Badge className="bg-discrepancy/10 text-discrepancy text-[10px]">Pending</Badge>;
    return <Badge className="bg-blocking/10 text-blocking text-[10px]">Blocked</Badge>;
  };

  const kycBadge = (s: typeof demoStakeholders[0]) => {
    if (s.kycStatus === 'verified') return <span className="text-validated text-xs font-medium">Complete</span>;
    if (s.kycStatus === 'pending') return <span className="text-discrepancy text-xs font-medium">Pending</span>;
    return <span className="text-blocking text-xs font-medium">Failed</span>;
  };

  const wireBadge = (s: typeof demoStakeholders[0]) => {
    const w = wireStatus(s);
    if (w === 'Collected') return <span className="text-validated text-xs font-medium">Collected</span>;
    if (w === 'Pending') return <span className="text-discrepancy text-xs font-medium">Pending</span>;
    return <span className="text-muted-foreground text-xs font-medium">Not Sent</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Stakeholders</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage deal participants, ownership, and payout details.</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {isProtected ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isProtected ? 'Duplicate to edit' : 'Add Stakeholder'}
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {summaryCards.map(card => (
          <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-lg font-semibold">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-8 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Stakeholder</span>
            <span className="text-right">Ownership %</span>
            <span className="text-right">Payout</span>
            <span className="text-center">Status</span>
            <span className="text-center">KYC</span>
            <span className="text-center">Wire</span>
            <span className="text-center">Actions</span>
          </div>
        </div>
        {demoStakeholders.map((s) => (
          <motion.div key={s.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
            <div className="grid grid-cols-8 items-center">
              <div className="col-span-2">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <span className="text-right font-mono text-sm">{s.ownershipPct}%</span>
              <span className="text-right font-mono text-sm">${(s.payoutAmount / 1e6).toFixed(0)}M</span>
              <div className="flex justify-center">{statusBadge(s)}</div>
              <div className="flex justify-center">{kycBadge(s)}</div>
              <div className="flex justify-center">{wireBadge(s)}</div>
              <div className="flex justify-center">
                <button className="text-xs text-accent hover:underline">View</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AddStakeholderModal open={modalOpen} onClose={() => setModalOpen(false)} dealId={dealId} isDemoDeal={isDemoDeal} />
    </div>
  );
};