import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Building2, CreditCard, FileText, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'counsel', label: 'Counsel' },
  { value: 'escrow_agent', label: 'Escrow Agent' },
  { value: 'paying_agent', label: 'Paying Agent' },
  { value: 'financial_advisor', label: 'Financial Advisor' },
  { value: 'management_rep', label: 'Management Rep' },
] as const;

type Step = 1 | 2 | 3 | 4;
type JoinState = 'loading' | 'ready' | 'error' | 'complete';

interface InviteInfo {
  invitation_id: string;
  deal_id: string;
  deal_name: string;
  email: string;
  status: string;
  role_type: string | null;
  firm_name_snapshot: string | null;
  counterparty_profile_id: string | null;
  profile: {
    display_name: string | null;
    firm_name: string | null;
    role_type: string | null;
    kyc_status: string;
    deals_participated: number;
  } | null;
}

interface PassportData {
  profile: {
    display_name: string | null;
    firm_name: string | null;
    role_type: string | null;
    kyc_status: string;
    deals_participated: number;
  };
  bankInstructions: Array<{
    id: string;
    label: string;
    bank_name: string | null;
    routing_number: string | null;
    swift_code: string | null;
    account_number_encrypted: string;
    verified: boolean;
  }>;
}

const maskAccount = (value: string) => {
  const lastFour = value.slice(-4);
  return `••••${lastFour}`;
};

const CounterpartyJoinPage: React.FC = () => {
  const { inviteToken } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<JoinState>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [roleType, setRoleType] = useState<string>('');
  const [bankLabel, setBankLabel] = useState('');
  const [bankName, setBankName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedSavedInstructionId, setSelectedSavedInstructionId] = useState<string>('new');
  const [kycDocs, setKycDocs] = useState<Array<{ document_type: string; file_path: string }>>([]);
  const [accessAck, setAccessAck] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!inviteToken || !user) return;

      const { data, error } = await supabase.functions.invoke('counterparty-identity', {
        body: { action: 'getInvitation', inviteToken },
      });

      if (error || !data?.invitation_id) {
        setErrorMsg(error?.message || data?.error || 'This join link is invalid or expired.');
        setState('error');
        return;
      }

      setInvite(data as InviteInfo);
      setDisplayName(data.profile?.display_name || '');
      setFirmName(data.profile?.firm_name || data.firm_name_snapshot || '');
      setRoleType(data.profile?.role_type || data.role_type || '');

      const { data: passportData, error: passportError } = await supabase.functions.invoke('counterparty-identity', {
        body: { action: 'getPassport' },
      });

      if (!passportError && passportData?.profile) {
        setPassport(passportData as PassportData);
        setSelectedSavedInstructionId(passportData.bankInstructions?.[0]?.id || 'new');
      }

      setState('ready');
    };

    if (!authLoading && user) {
      load();
    } else if (!authLoading && !user) {
      setState('ready');
    }
  }, [authLoading, inviteToken, user]);

  const selectedSavedInstruction = useMemo(
    () => passport?.bankInstructions.find((item) => item.id === selectedSavedInstructionId) ?? null,
    [passport?.bankInstructions, selectedSavedInstructionId],
  );

  useEffect(() => {
    if (selectedSavedInstruction) {
      setBankLabel(selectedSavedInstruction.label || '');
      setBankName(selectedSavedInstruction.bank_name || '');
      setRoutingNumber(selectedSavedInstruction.routing_number || '');
      setSwiftCode(selectedSavedInstruction.swift_code || '');
      setAccountNumber(selectedSavedInstruction.account_number_encrypted || '');
    }
  }, [selectedSavedInstruction]);

  const persistProfile = async () => {
    if (!displayName.trim() || !firmName.trim() || !roleType) {
      toast.error('Complete name, firm, and role to continue.');
      return false;
    }

    const { data, error } = await supabase.functions.invoke('counterparty-identity', {
      body: {
        action: 'completeOnboarding',
        inviteToken,
        profile: {
          displayName: displayName.trim(),
          firmName: firmName.trim(),
          roleType,
        },
        note,
        finalize: false,
      },
    });

    if (error || data?.error) {
      toast.error(error?.message || data?.error || 'Could not save profile.');
      return false;
    }

    if (data?.passport) setPassport(data.passport as PassportData);
    return true;
  };

  const saveBankInstructions = async () => {
    if (selectedSavedInstructionId === 'new' && (!bankLabel.trim() || !accountNumber.trim())) {
      toast.error('Add a label and account number for this deal.');
      return false;
    }

    const { data, error } = await supabase.functions.invoke('counterparty-identity', {
      body: {
        action: 'completeOnboarding',
        inviteToken,
        profile: {
          displayName: displayName.trim(),
          firmName: firmName.trim(),
          roleType,
        },
        bankInstruction:
          selectedSavedInstructionId === 'new'
            ? {
                label: bankLabel.trim(),
                bankName: bankName.trim() || null,
                routingNumber: routingNumber.trim() || null,
                swiftCode: swiftCode.trim() || null,
                accountNumber: accountNumber.trim(),
              }
            : null,
        note,
        finalize: false,
      },
    });

    if (error || data?.error) {
      toast.error(error?.message || data?.error || 'Could not save bank instructions.');
      return false;
    }

    if (data?.passport) setPassport(data.passport as PassportData);
    return true;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const filePath = `${user.id}/${invite?.deal_id || 'counterparty'}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage.from('counterparty-kyc').upload(filePath, file, { upsert: false });
    if (error) {
      setUploading(false);
      toast.error(error.message || 'Upload failed.');
      return;
    }

    setKycDocs((prev) => [...prev.filter((item) => item.document_type !== documentType), { document_type: documentType, file_path: filePath }]);
    setUploading(false);
    toast.success(`${documentType} uploaded.`);
  };

  const finalize = async () => {
    if (!accessAck) {
      toast.error('Confirm the access scope to finish onboarding.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke('counterparty-identity', {
      body: {
        action: 'completeOnboarding',
        inviteToken,
        profile: {
          displayName: displayName.trim(),
          firmName: firmName.trim(),
          roleType,
        },
        bankInstruction:
          selectedSavedInstructionId === 'new'
            ? {
                label: bankLabel.trim(),
                bankName: bankName.trim() || null,
                routingNumber: routingNumber.trim() || null,
                swiftCode: swiftCode.trim() || null,
                accountNumber: accountNumber.trim(),
              }
            : null,
        kycDocuments: kycDocs,
        note,
        finalize: true,
      },
    });
    setSaving(false);

    if (error || data?.error) {
      toast.error(error?.message || data?.error || 'Could not complete onboarding.');
      return;
    }

    if (data?.passport) setPassport(data.passport as PassportData);
    setState('complete');
  };

  const continueStep = async () => {
    if (step === 1) {
      const ok = await persistProfile();
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await saveBankInstructions();
      if (ok) setStep(3);
      return;
    }
    if (step === 3) {
      if (kycDocs.length === 0 && passport?.profile.kyc_status !== 'verified') {
        toast.error('Upload at least one KYC document to continue.');
        return;
      }
      setStep(4);
      return;
    }
    await finalize();
  };

  if (authLoading || state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=/join/${inviteToken}`} replace />;
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Join link unavailable</CardTitle>
            <CardDescription>{errorMsg}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Join {invite?.deal_name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Carry your verified identity forward across every deal you join.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step {step} of 4</CardTitle>
              <CardDescription>
                {step === 1 && 'Confirm your identity'}
                {step === 2 && 'Add bank instructions for this deal'}
                {step === 3 && 'Upload KYC documents'}
                {step === 4 && 'Review access scope'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Email</Label>
                    <Input value={invite?.email || user.email || ''} disabled />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Display name</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jordan Blake" />
                  </div>
                  <div className="space-y-2">
                    <Label>Firm</Label>
                    <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="Latham & Watkins" />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={roleType} onValueChange={setRoleType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Note</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional onboarding note" />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {passport?.bankInstructions?.length ? (
                    <div className="space-y-2">
                      <Label>Reuse saved bank instructions</Label>
                      <Select value={selectedSavedInstructionId} onValueChange={setSelectedSavedInstructionId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {passport.bankInstructions.map((instruction) => (
                            <SelectItem key={instruction.id} value={instruction.id}>
                              {instruction.label} · {maskAccount(instruction.account_number_encrypted)}
                            </SelectItem>
                          ))}
                          <SelectItem value="new">Add new instructions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {selectedSavedInstructionId === 'new' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Label</Label>
                        <Input value={bankLabel} onChange={(e) => setBankLabel(e.target.value)} placeholder="Latham Operating Account" />
                      </div>
                      <div className="space-y-2">
                        <Label>Bank name</Label>
                        <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="JPMorgan Chase" />
                      </div>
                      <div className="space-y-2">
                        <Label>Routing number</Label>
                        <Input value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} placeholder="021000021" />
                      </div>
                      <div className="space-y-2">
                        <Label>SWIFT code</Label>
                        <Input value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)} placeholder="CHASUS33" />
                      </div>
                      <div className="space-y-2">
                        <Label>Account number</Label>
                        <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="••••••••1234" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Upload KYC documents to your private identity vault for reuse across future deals.</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {['government_id', 'proof_of_address', 'entity_document'].map((docType) => (
                      <label key={docType} className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm cursor-pointer hover:border-accent/40 transition-colors">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <FileText className="h-4 w-4 text-accent" />
                          {docType.replace(/_/g, ' ')}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">PDF or image</p>
                        <input type="file" className="hidden" onChange={(e) => handleUpload(e, docType)} />
                      </label>
                    ))}
                  </div>
                  {uploading && <p className="text-sm text-muted-foreground">Uploading…</p>}
                  <div className="space-y-2">
                    {kycDocs.map((doc) => (
                      <div key={doc.document_type} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <span>{doc.document_type.replace(/_/g, ' ')}</span>
                        <Badge variant="outline">Uploaded</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-sm text-foreground font-medium">You can view:</p>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                      <li>Closing checklist items assigned to you</li>
                      <li>Documents shared with you</li>
                    </ul>
                  </div>
                  <label className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm">
                    <input type="checkbox" checked={accessAck} onChange={(e) => setAccessAck(e.target.checked)} className="mt-1" />
                    <span>I understand this access is scoped to the current deal and shared materials.</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1) as Step)} disabled={step === 1 || saving}>
                  Back
                </Button>
                <Button onClick={continueStep} disabled={saving || uploading}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {step === 4 ? 'Finish onboarding' : 'Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {state === 'complete' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><BadgeCheck className="h-5 w-5 text-validated" />Onboarding complete</CardTitle>
                <CardDescription>Your Deal Passport is ready for reuse on future deals.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal Passport</CardTitle>
              <CardDescription>Reusable counterparty identity across transactions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><UserCheck className="h-4 w-4 text-accent" />Deals participated</div>
                  <span className="text-sm font-medium text-foreground">{passport?.profile.deals_participated ?? invite?.profile?.deals_participated ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-accent" />Verified status</div>
                  <Badge variant="outline" className="border-accent/30 text-accent">
                    {(passport?.profile.kyc_status ?? invite?.profile?.kyc_status ?? 'pending').replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Building2 className="h-4 w-4 text-accent" />Identity</div>
                <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground space-y-1">
                  <p>{displayName || passport?.profile.display_name || 'Name pending'}</p>
                  <p>{firmName || passport?.profile.firm_name || 'Firm pending'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground"><CreditCard className="h-4 w-4 text-accent" />Saved bank instructions</div>
                <div className="space-y-2">
                  {(passport?.bankInstructions || []).length ? (
                    passport?.bankInstructions.map((instruction) => (
                      <div key={instruction.id} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground">{instruction.label}</p>
                          {instruction.verified && <Badge variant="outline" className="border-validated/30 text-validated">Verified</Badge>}
                        </div>
                        <p className="mt-1 text-muted-foreground">{instruction.bank_name || 'Bank'} · {maskAccount(instruction.account_number_encrypted)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">No saved instructions yet.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CounterpartyJoinPage;