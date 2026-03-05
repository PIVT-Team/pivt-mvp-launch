import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, Clock, AlertTriangle, Eye, BadgeCheck, XCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
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
  submissions: Array<{
    id: string;
    payload_json: any;
    consent_accepted: boolean;
    created_at: string;
  }>;
  documents: Array<{
    id: string;
    file_name: string;
    file_url: string;
    doc_type: string;
    created_at: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground', icon: Clock },
  sent: { label: 'Sent', color: 'bg-discrepancy/10 text-discrepancy', icon: Clock },
  opened: { label: 'Opened', color: 'bg-accent/10 text-accent', icon: Eye },
  submitted: { label: 'Submitted', color: 'bg-accent/10 text-accent', icon: FileText },
  verified: { label: 'Verified', color: 'bg-validated/10 text-validated', icon: CheckCircle2 },
  expired: { label: 'Expired', color: 'bg-muted text-muted-foreground', icon: AlertTriangle },
  revoked: { label: 'Revoked', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

export const VerificationReviewCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { isAdmin } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!dealId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('manual-verify', {
      method: 'GET',
      body: undefined,
      headers: {},
    });

    // Fallback: use direct query since GET with query params via invoke is tricky
    const { data: reqData } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    setRequests((reqData as unknown as VerificationRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [dealId]);

  const handleManualVerify = async (requestId: string, verified: boolean) => {
    setProcessing(requestId);
    const { error } = await supabase.functions.invoke('manual-verify', {
      body: { request_id: requestId, verified, notes: reviewNotes },
    });
    if (error) {
      toast.error(`Failed: ${error.message}`);
    } else {
      toast.success(verified ? 'Marked as verified' : 'Marked as failed');
      setReviewNotes('');
      setExpandedId(null);
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
          Verification Review
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review and manage KYC/KYB verification requests for deal stakeholders.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Requests', value: activeRequests.length, color: 'text-foreground' },
          { label: 'Submitted', value: activeRequests.filter(r => r.status === 'submitted').length, color: 'text-accent' },
          { label: 'Verified', value: activeRequests.filter(r => r.status === 'verified').length, color: 'text-validated' },
          { label: 'Pending', value: activeRequests.filter(r => ['pending', 'sent', 'opened'].includes(r.status)).length, color: 'text-discrepancy' },
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
        <div className="space-y-3">
          {activeRequests.map(req => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isExpanded = expandedId === req.id;

            return (
              <motion.div key={req.id} {...fadeInUp} className="pivt-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">{req.recipient_name}</p>
                      <p className="text-xs text-muted-foreground">{req.recipient_email} · {req.verification_type || (req.stakeholder_type === 'entity' ? 'KYB' : 'KYC')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`${cfg.color} text-[10px]`}>
                      <Icon className="w-3 h-3 mr-1" />{cfg.label}
                    </Badge>
                    {req.sent_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Sent {new Date(req.sent_at).toLocaleDateString()}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Timeline */}
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      {[
                        { label: 'Created', value: req.created_at },
                        { label: 'Sent', value: req.sent_at },
                        { label: 'Submitted', value: req.submitted_at },
                        { label: 'Verified', value: req.verified_at },
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

                    {/* Manual Review Notes */}
                    {req.manual_review_notes && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Review Notes</p>
                        <p className="text-sm">{req.manual_review_notes}</p>
                      </div>
                    )}

                    {/* Admin Actions */}
                    {isAdmin && !['verified', 'expired'].includes(req.status) && (
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
                            disabled={processing === req.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-validated/10 border border-validated/20 text-validated text-sm font-medium hover:bg-validated/20 transition-all disabled:opacity-50"
                          >
                            <BadgeCheck className="w-4 h-4" />
                            {processing === req.id ? 'Processing…' : 'Mark Verified'}
                          </button>
                          <button
                            onClick={() => handleManualVerify(req.id, false)}
                            disabled={processing === req.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blocking/10 border border-blocking/20 text-blocking text-sm font-medium hover:bg-blocking/20 transition-all disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Mark Failed
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
