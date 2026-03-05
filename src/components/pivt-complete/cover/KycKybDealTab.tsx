import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, DemoStakeholder } from '@/stores/pivtStore';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { fadeInUp } from '@/lib/animations';
import {
  Shield, CheckCircle2, Clock, XCircle, AlertTriangle, Send, Upload, Eye,
  Plus, X, ArrowLeft, ArrowRight, User, Building2, FileText, Landmark,
  BadgeCheck, FileSearch, RotateCw, Mail,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type KycFilter = 'all' | 'pending' | 'failed' | 'expiring' | 'completed';

// Status mapping helpers
const PENDING_STATUSES = ['sent', 'in_progress', 'submitted', 'pending'];
const COMPLETE_STATUSES = ['verified'];
const FAILED_STATUSES = ['failed'];
const NOT_STARTED_STATUSES = ['not_sent', 'not_requested'];

interface VerificationSummary {
  total: number;
  complete: number;
  pending: number;
  failed: number;
  expiringSoon: number;
  completionPct: number;
}

interface StakeholderRow {
  id: string;
  shareholder_name: string;
  email: string | null;
  role: string;
  stakeholder_type: string;
  verification_status: string;
  verification_last_sent_at: string | null;
  verification_completed_at: string | null;
  verification_rejection_reason: string | null;
}

function computeSummary(stakeholders: StakeholderRow[]): VerificationSummary {
  const complete = stakeholders.filter(s => COMPLETE_STATUSES.includes(s.verification_status)).length;
  const pending = stakeholders.filter(s => PENDING_STATUSES.includes(s.verification_status)).length;
  const failed = stakeholders.filter(s => FAILED_STATUSES.includes(s.verification_status)).length;
  const totalStarted = complete + pending + failed;
  const completionPct = totalStarted > 0 ? Math.round((complete / totalStarted) * 100) : 0;
  return { total: stakeholders.length, complete, pending, failed, expiringSoon: 0, completionPct };
}

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  not_sent: { label: 'Not Requested', className: 'bg-muted text-muted-foreground' },
  not_requested: { label: 'Not Requested', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Email Sent', className: 'bg-blue-500/10 text-blue-500' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-500/10 text-yellow-600' },
  submitted: { label: 'Submitted', className: 'bg-accent/10 text-accent' },
  verified: { label: 'Verified', className: 'bg-validated/10 text-validated' },
  failed: { label: 'Rejected', className: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
};

// ── KYC Onboarding Wizard ──
interface KycWizardProps {
  open: boolean;
  onClose: () => void;
  stakeholders: DemoStakeholder[];
}

type WizardStep = 1 | 2 | 3;

const STEP_LABELS = ['Personal Information', 'Documents', 'Bank Details'];

const KycOnboardingWizard: React.FC<KycWizardProps> = ({ open, onClose, stakeholders }) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [linkMode, setLinkMode] = useState<'existing' | 'new' | null>(null);
  const [selectedStakeholderId, setSelectedStakeholderId] = useState('');
  const [entityType, setEntityType] = useState<'individual' | 'entity'>('individual');

  // Step 1 fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');

  // Step 2 fields (simulated uploads)
  const [idUploaded, setIdUploaded] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [entityDocsUploaded, setEntityDocsUploaded] = useState(false);

  // Step 3 fields
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCountry, setBankCountry] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const pct = Math.round((step / 3) * 100);

  const validateStep = (): boolean => {
    const errs: Record<string, string> = {};

    if (!linkMode) {
      errs.linkMode = 'Select a stakeholder link option';
      setErrors(errs);
      return false;
    }

    if (linkMode === 'existing' && !selectedStakeholderId) {
      errs.stakeholder = 'Select a stakeholder';
      setErrors(errs);
      return false;
    }

    if (step === 1) {
      if (!fullName.trim() || fullName.trim().length > 200) errs.fullName = 'Full legal name is required (max 200 chars)';
      if (!country.trim()) errs.country = 'Country is required';
    }

    if (step === 3) {
      if (!accountHolder.trim()) errs.accountHolder = 'Account holder name is required';
      if (!bankName.trim()) errs.bankName = 'Bank name is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 3) setStep((step + 1) as WizardStep);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as WizardStep);
  };

  const handleSubmit = () => {
    if (!validateStep()) return;
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setStep(1); setLinkMode(null); setSelectedStakeholderId('');
    setFullName(''); setDob(''); setPhone(''); setAddress('');
    setCity(''); setState(''); setZip(''); setCountry('');
    setIdUploaded(false); setProofUploaded(false); setEntityDocsUploaded(false);
    setAccountHolder(''); setBankName(''); setRoutingNumber('');
    setAccountNumber(''); setBankCountry(''); setErrors({});
    setEntityType('individual');
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => { onClose(); resetForm(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="bg-card border border-border rounded-xl max-w-xl w-full mx-4 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold">Add KYC Profile</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Step {step} of 3 — {STEP_LABELS[step - 1]}</p>
            </div>
            <button onClick={() => { onClose(); resetForm(); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-5 pt-4">
            <Progress value={pct} className="h-1.5" />
            <div className="flex justify-between mt-2">
              {STEP_LABELS.map((label, i) => (
                <span key={label} className={`text-[10px] font-medium ${i + 1 <= step ? 'text-accent' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Stakeholder Link (always visible) */}
            {step === 1 && !linkMode && (
              <div className="space-y-3">
                <Label className="text-xs font-medium">Link to Stakeholder *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLinkMode('existing')}
                    className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-all text-left"
                  >
                    <User className="w-5 h-5 text-accent mb-2" />
                    <p className="text-sm font-medium">Link to Existing</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Select from deal stakeholders</p>
                  </button>
                  <button
                    onClick={() => setLinkMode('new')}
                    className="p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-all text-left"
                  >
                    <Plus className="w-5 h-5 text-accent mb-2" />
                    <p className="text-sm font-medium">Create Stakeholder + KYC</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Add new and start KYC</p>
                  </button>
                </div>
                {errors.linkMode && <p className="text-[11px] text-blocking">{errors.linkMode}</p>}
              </div>
            )}

            {step === 1 && linkMode === 'existing' && (
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Select Stakeholder *</Label>
                <Select value={selectedStakeholderId} onValueChange={setSelectedStakeholderId}>
                  <SelectTrigger className={errors.stakeholder ? 'border-blocking' : ''}>
                    <SelectValue placeholder="Choose stakeholder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stakeholders.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} — {s.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.stakeholder && <p className="text-[11px] text-blocking mt-1">{errors.stakeholder}</p>}
              </div>
            )}

            {step === 1 && linkMode && (
              <>
                {/* Entity type toggle */}
                <div className="flex gap-2 p-1 rounded-xl bg-muted/50">
                  {([
                    { key: 'individual' as const, label: 'Individual', icon: User },
                    { key: 'entity' as const, label: 'Entity', icon: Building2 },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setEntityType(opt.key)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                        entityType === opt.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    {entityType === 'individual' ? 'Full Legal Name' : 'Entity Legal Name'} *
                  </Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={entityType === 'individual' ? 'e.g. Sarah Chen' : 'e.g. Sequoia Capital Fund XIV'} maxLength={200} className={errors.fullName ? 'border-blocking' : ''} />
                  {errors.fullName && <p className="text-[11px] text-blocking mt-1">{errors.fullName}</p>}
                </div>

                {entityType === 'individual' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Date of Birth</Label>
                      <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Phone Number</Label>
                      <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" maxLength={30} />
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Address</Label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address" maxLength={200} className="mb-2" />
                  <div className="grid grid-cols-3 gap-2">
                    <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" maxLength={100} />
                    <Input value={state} onChange={e => setState(e.target.value)} placeholder="State" maxLength={50} />
                    <Input value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP" maxLength={20} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Country *</Label>
                  <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. United States" maxLength={100} className={errors.country ? 'border-blocking' : ''} />
                  {errors.country && <p className="text-[11px] text-blocking mt-1">{errors.country}</p>}
                </div>
              </>
            )}

            {/* Step 2: Documents */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Upload required verification documents.</p>

                {[
                  { label: 'Government-Issued ID', desc: 'Passport, driver\'s license, or national ID', uploaded: idUploaded, setUploaded: setIdUploaded, required: true },
                  { label: 'Proof of Address', desc: 'Utility bill or bank statement (< 3 months)', uploaded: proofUploaded, setUploaded: setProofUploaded, required: true },
                  ...(entityType === 'entity' ? [{ label: 'Entity Formation Documents', desc: 'Certificate of incorporation, operating agreement', uploaded: entityDocsUploaded, setUploaded: setEntityDocsUploaded, required: true }] : []),
                ].map(doc => (
                  <div key={doc.label} className={`p-4 rounded-lg border transition-colors ${doc.uploaded ? 'border-validated/30 bg-validated/5' : 'border-border'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          {doc.uploaded ? <CheckCircle2 className="w-4 h-4 text-validated" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                          {doc.label}
                          {doc.required && <span className="text-blocking text-[10px]">*</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">{doc.desc}</p>
                      </div>
                      <button
                        onClick={() => doc.setUploaded(!doc.uploaded)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          doc.uploaded ? 'bg-validated/10 text-validated' : 'bg-muted text-foreground hover:bg-muted/80'
                        }`}
                      >
                        {doc.uploaded ? 'Uploaded ✓' : 'Upload'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Bank Details */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="w-4 h-4 text-accent" />
                  <p className="text-sm text-muted-foreground">Wire transfer details for payout distribution.</p>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Account Holder Name *</Label>
                  <Input value={accountHolder} onChange={e => setAccountHolder(e.target.value)} placeholder="Name on account" maxLength={200} className={errors.accountHolder ? 'border-blocking' : ''} />
                  {errors.accountHolder && <p className="text-[11px] text-blocking mt-1">{errors.accountHolder}</p>}
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Bank Name *</Label>
                  <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. JPMorgan Chase" maxLength={200} className={errors.bankName ? 'border-blocking' : ''} />
                  {errors.bankName && <p className="text-[11px] text-blocking mt-1">{errors.bankName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Routing Number</Label>
                    <Input value={routingNumber} onChange={e => setRoutingNumber(e.target.value)} placeholder="9-digit routing" maxLength={9} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Account Number (last 4)</Label>
                    <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="••••" maxLength={4} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Bank Country</Label>
                  <Input value={bankCountry} onChange={e => setBankCountry(e.target.value)} placeholder="e.g. United States" maxLength={100} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-border">
            <button
              onClick={step === 1 ? () => { onClose(); resetForm(); } : handleBack}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={step === 1 && !linkMode}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-5 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Submit KYC Profile
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ── Non-Demo Live KYC/KYB Tab ──
const LiveKycKybTab: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [stakeholders, setStakeholders] = useState<StakeholderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KycFilter>('all');

  const fetchStakeholders = useCallback(async () => {
    if (!dealId) return;
    const { data } = await supabase
      .from('cap_table_entries')
      .select('id, shareholder_name, email, role, stakeholder_type, verification_status, verification_last_sent_at, verification_completed_at, verification_rejection_reason')
      .eq('deal_id', dealId);
    setStakeholders((data as StakeholderRow[]) || []);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchStakeholders(); }, [fetchStakeholders]);

  // Subscribe to realtime changes on cap_table_entries for this deal
  useEffect(() => {
    if (!dealId) return;
    const channel = supabase
      .channel(`kyc-status-${dealId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cap_table_entries',
        filter: `deal_id=eq.${dealId}`,
      }, () => { fetchStakeholders(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dealId, fetchStakeholders]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = computeSummary(stakeholders);
  const hasActivity = summary.pending > 0 || summary.complete > 0 || summary.failed > 0;

  // Filter stakeholders
  const filtered = stakeholders.filter(s => {
    if (filter === 'all') return !NOT_STARTED_STATUSES.includes(s.verification_status);
    if (filter === 'pending') return PENDING_STATUSES.includes(s.verification_status);
    if (filter === 'failed') return FAILED_STATUSES.includes(s.verification_status);
    if (filter === 'completed') return COMPLETE_STATUSES.includes(s.verification_status);
    return true;
  });

  // Review queue: submitted, in_progress, failed first
  const reviewQueue = stakeholders
    .filter(s => ['submitted', 'in_progress', 'failed'].includes(s.verification_status))
    .sort((a, b) => {
      const priority: Record<string, number> = { submitted: 0, in_progress: 1, failed: 2 };
      return (priority[a.verification_status] ?? 9) - (priority[b.verification_status] ?? 9);
    });

  const filters: { key: KycFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Active', count: stakeholders.filter(s => !NOT_STARTED_STATUSES.includes(s.verification_status)).length },
    { key: 'pending', label: 'Pending', count: summary.pending },
    { key: 'failed', label: 'Failed', count: summary.failed },
    { key: 'completed', label: 'Completed', count: summary.complete },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            KYB / KYC
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Compliance verification operations console for this deal.</p>
        </div>
      </div>

      {/* Progress Overview */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">KYB / KYC Completion</span>
          <span className="font-mono text-sm font-semibold">{summary.completionPct}%</span>
        </div>
        <Progress value={summary.completionPct} className="h-2.5 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Complete', value: summary.complete, icon: CheckCircle2, color: 'text-validated' },
            { label: 'Pending', value: summary.pending, icon: Clock, color: 'text-discrepancy' },
            { label: 'Failed', value: summary.failed, icon: XCircle, color: 'text-blocking' },
            { label: 'Expiring Soon', value: summary.expiringSoon, icon: AlertTriangle, color: 'text-discrepancy' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <div>
                <p className="text-lg font-semibold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {!hasActivity ? (
        <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold">KYC not started</h3>
            <p className="text-sm text-muted-foreground mt-1">Add stakeholders first, then initiate KYC verification from the Stakeholders tab.</p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Review Queue */}
          {reviewQueue.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-accent" />
                Review Queue
              </h3>
              <div className="pivt-card overflow-hidden">
                {reviewQueue.map(s => {
                  const cfg = STATUS_CHIP[s.verification_status] || STATUS_CHIP.not_sent;
                  return (
                    <div key={s.id} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{s.shareholder_name}</p>
                          <p className="text-xs text-muted-foreground">{s.email || 'No email'} · {s.stakeholder_type === 'entity' ? 'KYB' : 'KYC'}</p>
                        </div>
                        <Badge className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                      </div>
                      {s.verification_status === 'failed' && s.verification_rejection_reason && (
                        <p className="text-xs text-destructive mt-1">Reason: {s.verification_rejection_reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter Tabs + Table */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          <div className="pivt-card overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/50">
              <div className="grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span className="col-span-2">Stakeholder</span>
                <span>Type</span>
                <span className="text-center">Status</span>
                <span className="text-center">Last Updated</span>
                <span className="text-center">Action</span>
              </div>
            </div>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No stakeholders match this filter.</div>
            )}
            {filtered.map(s => {
              const cfg = STATUS_CHIP[s.verification_status] || STATUS_CHIP.not_sent;
              const lastDate = s.verification_completed_at || s.verification_last_sent_at;
              return (
                <motion.div key={s.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="grid grid-cols-6 items-center">
                    <div className="col-span-2">
                      <p className="font-medium text-sm">{s.shareholder_name}</p>
                      <p className="text-xs text-muted-foreground">{s.email || '—'}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{s.stakeholder_type === 'entity' ? 'KYB' : 'KYC'}</span>
                    <div className="flex justify-center">
                      <Badge className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                    </div>
                    <span className="text-center text-xs text-muted-foreground font-mono">
                      {lastDate ? new Date(lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                    <div className="flex justify-center">
                      {s.verification_status === 'verified' && (
                        <span className="text-xs text-validated flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Complete</span>
                      )}
                      {s.verification_status === 'submitted' && (
                        <span className="text-xs text-accent flex items-center gap-1"><FileSearch className="w-3 h-3" /> Review</span>
                      )}
                      {PENDING_STATUSES.includes(s.verification_status) && s.verification_status !== 'submitted' && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Awaiting</span>
                      )}
                      {s.verification_status === 'failed' && (
                        <span className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ── Main Export ──
export const KycKybDealTab: React.FC = () => {
  const { isDemoDeal } = useDealWorkspace();
  const { stakeholders } = usePIVTStore();
  const [filter, setFilter] = useState<KycFilter>('all');
  const [wizardOpen, setWizardOpen] = useState(false);

  // Non-demo: use live data from cap_table_entries
  if (!isDemoDeal) {
    return <LiveKycKybTab />;
  }

  // Demo mode below
  const verified = stakeholders.filter(s => s.kycStatus === 'verified').length;
  const pending = stakeholders.filter(s => s.kycStatus === 'pending').length;
  const failed = stakeholders.filter(s => s.kycStatus === 'failed').length;
  const total = stakeholders.length;
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
  const expiring = 1;

  const filtered = stakeholders.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'pending') return s.kycStatus === 'pending';
    if (filter === 'failed') return s.kycStatus === 'failed';
    if (filter === 'completed') return s.kycStatus === 'verified';
    if (filter === 'expiring') return s.id === 's3';
    return true;
  });

  const entityType = (s: typeof stakeholders[0]) =>
    s.role.includes('Fund') || s.role.includes('Capital') || s.role.includes('Trust') || s.role.includes('Global') || s.role.includes('Private')
      ? 'Entity' : 'Individual';

  const missingDocs = (s: typeof stakeholders[0]) => {
    if (s.kycStatus === 'verified') return '—';
    if (s.kycStatus === 'pending') return 'ID Verification';
    return 'All Documents';
  };

  const demoFilters: { key: KycFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'pending', label: 'Pending', count: pending },
    { key: 'failed', label: 'Failed', count: failed },
    { key: 'expiring', label: 'Expiring Soon', count: expiring },
    { key: 'completed', label: 'Completed', count: verified },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            KYB / KYC
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Compliance verification operations console for this deal.</p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add KYC Profile
        </button>
      </div>

      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">KYB / KYC Completion</span>
          <span className="font-mono text-sm font-semibold">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2.5 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Complete', value: verified, icon: CheckCircle2, color: 'text-validated' },
            { label: 'Pending', value: pending, icon: Clock, color: 'text-discrepancy' },
            { label: 'Failed', value: failed, icon: XCircle, color: 'text-blocking' },
            { label: 'Expiring Soon', value: expiring, icon: AlertTriangle, color: 'text-discrepancy' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <div>
                <p className="text-lg font-semibold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Send KYC Request', icon: Send },
          { label: 'Send Reminder', icon: Clock },
          { label: 'Upload Documents', icon: Upload },
          { label: 'Review Submission', icon: Eye },
        ].map(action => (
          <button
            key={action.label}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/60 text-sm font-medium hover:bg-muted transition-colors border border-border"
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
        {demoFilters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Stakeholder</span>
            <span>Entity Type</span>
            <span className="text-center">KYC Status</span>
            <span className="text-center">Last Updated</span>
            <span className="text-center">Missing Docs</span>
            <span className="text-center">Action</span>
          </div>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No stakeholders match this filter.</div>
        )}
        {filtered.map((s) => (
          <motion.div key={s.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
            <div className="grid grid-cols-7 items-center">
              <div className="col-span-2">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <span className="text-sm text-muted-foreground">{entityType(s)}</span>
              <div className="flex justify-center">
                <Badge className={`text-[10px] ${
                  s.kycStatus === 'verified' ? 'bg-validated/10 text-validated' :
                  s.kycStatus === 'pending' ? 'bg-discrepancy/10 text-discrepancy' :
                  'bg-blocking/10 text-blocking'
                }`}>
                  {s.kycStatus === 'verified' ? 'Approved' : s.kycStatus === 'pending' ? 'Pending' : 'Failed'}
                </Badge>
              </div>
              <span className="text-center text-xs text-muted-foreground font-mono">2026-02-20</span>
              <span className="text-center text-xs text-muted-foreground">{missingDocs(s)}</span>
              <div className="flex justify-center gap-2">
                {s.kycStatus === 'pending' && (
                  <button className="text-xs text-accent hover:underline">Review</button>
                )}
                {s.kycStatus === 'failed' && (
                  <button className="text-xs text-blocking hover:underline">Request Docs</button>
                )}
                {s.kycStatus === 'verified' && (
                  <span className="text-xs text-validated">✓ Complete</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <KycOnboardingWizard open={wizardOpen} onClose={() => setWizardOpen(false)} stakeholders={stakeholders} />
    </div>
  );
};