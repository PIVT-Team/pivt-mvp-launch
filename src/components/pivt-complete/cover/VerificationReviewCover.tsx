import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { applyEvent } from '@/services/dealStateMachineService';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, Clock, AlertTriangle, Eye, BadgeCheck, XCircle, FileText, ChevronDown, ChevronUp, Send, RotateCw, Copy } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface VerificationRequest {
  id: string;
  stakeholder_id: string;
  deal_id: string;
  recipient_name: string;
  recipient_email: string;
  stakeholder_type: string;
  verification_type: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  expires_at: string;
  verified_by_user_id: string | null;
  manual_review_notes: string | null;
  submission_data: any;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; chipClass: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', chipClass: 'bg-muted text-muted-foreground', icon: Clock },
  sent: { label: 'Email sent', chipClass: 'bg-blue-500/10 text-blue-500', icon: Send },
  opened: { label: 'Opened', chipClass: 'bg-yellow-500/10 text-yellow-600', icon: Eye },
  submitted: { label: 'Submitted', chipClass: 'bg-accent/10 text-accent', icon: FileText },
  verified: { label: 'Verified', chipClass: 'bg-validated/10 text-validated', icon: CheckCircle2 },
  failed: { label: 'Failed', chipClass: 'bg-destructive/10 text-destructive', icon: XCircle },
  expired: { label: 'Expired', chipClass: 'bg-muted text-muted-foreground', icon: AlertTriangle },
  revoked: { label: 'Revoked', chipClass: 'bg-muted text-muted-foreground', icon: XCircle },
};

export const VerificationReviewCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const lastResendRef = useRef<Record<string, number>>({});

  const fetchRequests = async () => {
    if (!dealId) return;
    setLoading(true);
    const { data } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    setRequests((data as unknown as VerificationRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [dealId]);

  const handleManualVerify = async (requestId: string, verified: boolean) => {
    setProcessing(requestId);
    const { error } = await supabase.functions.invoke('manual-verify', {
      body: { request_id: requestId, verified, notes: reviewNotes },
    });
    if (error) {
      toast.error(`Failed: ${error.message}`);
    } else {
      toast.success(verified ? 'Marked as verified' : 'Marked as failed');
      // Fire state machine event
      const req = requests.find(r => r.id === requestId);
      if (dealId && req) {
        applyEvent(dealId, verified ? 'VERIFICATION_VERIFIED' : 'VERIFICATION_FAILED', {
          stakeholder_id: req.stakeholder_id,
          request_id: requestId,
        }).catch(console.error);
      }
      setReviewNotes('');
      setExpandedId(null);
      await fetchRequests();
    }
    setProcessing(null);
  };

  const handleResend = async (req: VerificationRequest) => {
    const last = lastResendRef.current[req.id] || 0;
    if (Date.now() - last < 60_000) {
      toast.error('Please wait before resending verification.');
      return;
    }
    setProcessing(req.id);
    const { error } = await supabase.functions.invoke('send-verification', {
      body: { stakeholder_id: req.stakeholder_id, deal_id: req.deal_id },
    });
    if (error) {
      toast.error(`Failed to resend: ${error.message}`);
    } else {
      lastResendRef.current[req.id] = Date.now();
      toast.success('Verification email resent');
      await fetchRequests();
    }
    setProcessing(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeRequests = requests.filter(r => !['revoked'].includes(r.status));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          Verification
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track and manage all KYC/KYB verification requests for this deal.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Requests', value: activeRequests.length, color: 'text-foreground' },
          { label: 'Sent / Pending', value: activeRequests.filter(r => ['pending', 'sent', 'opened'].includes(r.status)).length, color: 'text-blue-500' },
          { label: 'Submitted', value: activeRequests.filter(r => r.status === 'submitted').length, color: 'text-accent' },
          { label: 'Verified', value: activeRequests.filter(r => r.status === 'verified').length, color: 'text-validated' },
        ].map(card => (
          <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {activeRequests.length === 0 ? (
        <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-3">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold">No verification requests</h3>
          <p className="text-sm text-muted-foreground">
            Verification requests will appear here after they are sent from the Stakeholders tab.
          </p>
        </motion.div>
      ) : (
        /* Table view */
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Stakeholder</span>
              <span>Type</span>
              <span className="text-center">Status</span>
              <span className="text-center">Sent</span>
              <span className="text-center">Submitted</span>
              <span className="text-center">Actions</span>
            </div>
          </div>
          {activeRequests.map(req => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isExpanded = expandedId === req.id;
            const isProcessing = processing === req.id;

            return (
              <div key={req.id} className="border-b border-border last:border-0">
                <div
                  className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  <div className="grid grid-cols-7 items-center">
                    <div className="col-span-2">
                      <p className="font-medium text-sm">{req.recipient_name}</p>
                      <p className="text-xs text-muted-foreground">{req.recipient_email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {req.stakeholder_type === 'entity' ? 'KYB' : 'KYC'}
                    </span>
                    <div className="flex justify-center">
                      <Badge className={`${cfg.chipClass} text-[10px]`}>
                        <Icon className="w-3 h-3 mr-1" />{cfg.label}
                      </Badge>
                    </div>
                    <span className="text-center text-xs text-muted-foreground">
                      {req.sent_at ? new Date(req.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                    <span className="text-center text-xs text-muted-foreground">
                      {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                    <div className="flex justify-center items-center gap-2" onClick={e => e.stopPropagation()}>
                      {['sent', 'pending', 'opened', 'failed', 'expired'].includes(req.status) && (
                        <button
                          onClick={() => handleResend(req)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
                        >
                          <RotateCw className="w-3 h-3" />
                          Resend
                        </button>
                      )}
                      {!['verified', 'expired'].includes(req.status) && (
                        <button
                          onClick={() => handleManualVerify(req.id, true)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-validated/10 text-validated text-xs font-medium hover:bg-validated/20 transition-colors disabled:opacity-50"
                        >
                          <BadgeCheck className="w-3 h-3" />
                          Verify
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-4 bg-muted/20 space-y-4">
                    {/* Timeline */}
                    <div className="grid grid-cols-5 gap-4 text-xs">
                      {[
                        { label: 'Created', value: req.created_at },
                        { label: 'Sent', value: req.sent_at },
                        { label: 'Submitted', value: req.submitted_at },
                        { label: 'Verified', value: req.verified_at },
                        { label: 'Expires', value: req.expires_at },
                      ].map(t => (
                        <div key={t.label}>
                          <p className="text-muted-foreground">{t.label}</p>
                          <p className="font-medium mt-0.5">{t.value ? new Date(t.value).toLocaleString() : '—'}</p>
                        </div>
                      ))}
                    </div>

                    {/* Submission Data */}
                    {req.submission_data && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Submitted Data</p>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                          {Object.entries(req.submission_data as Record<string, string>).map(([key, val]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="font-medium">{String(val) || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {req.manual_review_notes && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Review Notes</p>
                        <p className="text-sm">{req.manual_review_notes}</p>
                      </div>
                    )}

                    {/* Manual review actions — deal owner / participant. Backend (manual-verify edge function) enforces auth via JWT; RLS ultimately gates the underlying write. */}
                    {!['verified', 'expired'].includes(req.status) && (
                      <div className="border-t border-border pt-4 space-y-3">
                        <Textarea
                          value={reviewNotes}
                          onChange={e => setReviewNotes(e.target.value)}
                          placeholder="Review notes (optional)…"
                          rows={2}
                          className="bg-muted/50"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleManualVerify(req.id, true)}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-validated/10 border border-validated/20 text-validated text-sm font-medium hover:bg-validated/20 transition-all disabled:opacity-50"
                          >
                            <BadgeCheck className="w-4 h-4" />
                            {isProcessing ? 'Processing…' : 'Mark Verified'}
                          </button>
                          <button
                            onClick={() => handleManualVerify(req.id, false)}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium hover:bg-destructive/20 transition-all disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Mark Failed
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
