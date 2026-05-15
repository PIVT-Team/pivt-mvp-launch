import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { fadeInUp } from '@/lib/animations';
import { Users, Mail, CheckCircle2, Clock, XCircle, Shield, UserPlus, Plus, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { AddStakeholderModal } from './AddStakeholderModal';
import { useEditGuard } from '@/hooks/useEditGuard';

interface ContactEntry {
  id: string;
  shareholder_name: string;
  email: string | null;
  role: string;
  stakeholder_type: string;
  verification_status: string;
}

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  not_sent: { label: 'Not Requested', className: 'bg-muted text-muted-foreground' },
  not_requested: { label: 'Not Requested', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Email Sent', className: 'bg-blue-500/10 text-blue-500' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-500/10 text-yellow-600' },
  submitted: { label: 'Submitted', className: 'bg-accent/10 text-accent' },
  verified: { label: 'Verified', className: 'bg-emerald-500/10 text-emerald-600' },
  failed: { label: 'Rejected', className: 'bg-destructive/10 text-destructive' },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
};

export const ContactsDealTab: React.FC = () => {
  const { dealId, isDemoDeal } = useDealWorkspace();
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ContactEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { guardEdit } = useEditGuard();

  const fetchContacts = async () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('cap_table_entries')
      .select('id, shareholder_name, email, role, stakeholder_type, verification_status')
      .eq('deal_id', dealId);
    setContacts((data as ContactEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchContacts(); }, [dealId]);

  const handleAddClick = () => {
    guardEdit('ADD_CONTACT', null, () => setModalOpen(true));
  };

  // Manual approve/reject — writes directly to cap_table_entries. Same shape
  // the formal KYC drawer uses, so a contact marked "verified" here looks
  // identical to one verified through the email flow.
  const doApprove = async (contact: ContactEntry) => {
    setBusyId(contact.id);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('cap_table_entries')
      .update({
        verification_status: 'verified',
        verification_completed_at: now,
        verification_rejection_reason: null,
      })
      .eq('id', contact.id);
    setBusyId(null);
    if (error) {
      toast.error(`Approve failed: ${error.message}`);
      return;
    }
    toast.success(`${contact.shareholder_name} marked verified.`);
    fetchContacts();
  };

  const handleApprove = (contact: ContactEntry) => {
    guardEdit('VERIFY_CONTACT', null, () => doApprove(contact));
  };

  const openReject = (contact: ContactEntry) => {
    guardEdit('REJECT_CONTACT', null, () => {
      setRejectTarget(contact);
      setRejectReason('');
    });
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error('Provide a reason for rejection.');
      return;
    }
    setBusyId(rejectTarget.id);
    const { error } = await supabase
      .from('cap_table_entries')
      .update({
        verification_status: 'failed',
        verification_rejection_reason: rejectReason.trim(),
      })
      .eq('id', rejectTarget.id);
    setBusyId(null);
    if (error) {
      toast.error(`Reject failed: ${error.message}`);
      return;
    }
    toast.success(`${rejectTarget.shareholder_name} marked rejected.`);
    setRejectTarget(null);
    setRejectReason('');
    fetchContacts();
  };

  const verifiedCount = contacts.filter(c => c.verification_status === 'verified').length;
  const sentCount = contacts.filter(c => c.verification_status === 'sent').length;
  const inProgressCount = contacts.filter(c => ['in_progress', 'submitted'].includes(c.verification_status)).length;
  const rejectedCount = contacts.filter(c => c.verification_status === 'failed').length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Contacts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            People and operational contacts associated with deal parties.
          </p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Summary cards - contact-focused, not ownership */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Contacts', value: contacts.length, icon: Users, color: 'text-accent' },
          { label: 'Verified', value: verifiedCount, icon: Shield, color: 'text-emerald-500' },
          { label: 'Email Sent', value: sentCount, icon: Mail, color: 'text-blue-500' },
          { label: 'In Progress', value: inProgressCount, icon: Clock, color: 'text-yellow-600' },
          { label: 'Rejected', value: rejectedCount, icon: XCircle, color: 'text-destructive' },
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

      {contacts.length === 0 ? (
        <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold">No contacts added yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add signatories, legal contacts, finance contacts, and other operational participants.
            </p>
          </div>
          <button
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Contact
          </button>
        </motion.div>
      ) : (
        <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Contact Name</span>
              <span>Role</span>
              <span>Email</span>
              <span className="text-center">Verification</span>
              <span className="text-center">Actions</span>
            </div>
          </div>
          {contacts.map(c => {
            const chip = STATUS_CHIP[c.verification_status] || STATUS_CHIP.not_sent;
            const isVerified = c.verification_status === 'verified';
            const isFailed = c.verification_status === 'failed';
            const isBusy = busyId === c.id;
            return (
              <div key={c.id} className="p-4 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <div className="grid grid-cols-6 items-center">
                  <div className="col-span-2">
                    <p className="font-medium">{c.shareholder_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.stakeholder_type}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{c.role}</span>
                  <span className="text-sm text-muted-foreground truncate">{c.email || '—'}</span>
                  <div className="flex justify-center">
                    <Badge variant="outline" className={`text-[10px] ${chip.className}`}>
                      {chip.label}
                    </Badge>
                  </div>
                  {/* Manual approve / reject. Both buttons always render so a
                      deal owner can flip the status either direction (e.g.
                      reverse a stale verified, override a stale failed).
                      The badge to the left makes the current state obvious. */}
                  <div className="flex justify-center items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(c)}
                      disabled={isBusy || isVerified}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:hover:bg-emerald-500/10"
                      title={isVerified ? 'Already verified' : 'Mark this contact as verified'}
                    >
                      <BadgeCheck className="w-3 h-3" />
                      {isBusy ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openReject(c)}
                      disabled={isBusy || isFailed}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:hover:bg-destructive/10"
                      title={isFailed ? 'Already rejected' : 'Reject this contact (requires a reason)'}
                    >
                      <XCircle className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Reject reason dialog. Reason is required so audit trail / KYC review
          shows WHY the contact failed verification, not just a bare status. */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {rejectTarget?.shareholder_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this contact as rejected for verification. Provide a reason
              — it's stored on the record and shown in the KYC/KYB review
              queue so the deal team knows why this contact wasn't approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. ID expired; could not confirm beneficial ownership; documents not received"
            rows={3}
            className="bg-muted/40"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmReject(); }}
              disabled={!rejectReason.trim() || !!busyId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddStakeholderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        dealId={dealId}
        isDemoDeal={isDemoDeal}
        onAdded={fetchContacts}
      />
    </div>
  );
};
