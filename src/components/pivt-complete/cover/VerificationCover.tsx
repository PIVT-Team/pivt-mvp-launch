import React, { useEffect, useState, useRef } from 'react';
import { Shield, CheckCircle2, Clock, AlertTriangle, Upload, ChevronDown, Zap, Building2, Landmark } from 'lucide-react';
import { useKycStore, KycStatus } from '@/stores/kycStore';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_CONFIG: Record<KycStatus, { label: string; color: string; icon: React.ElementType }> = {
  not_started: { label: 'Not Started', color: 'text-white/40', icon: Clock },
  draft: { label: 'Draft', color: 'text-white/50', icon: Clock },
  submitted: { label: 'Submitted', color: 'text-[hsl(var(--discrepancy))]', icon: Clock },
  in_review: { label: 'In Review', color: 'text-[hsl(var(--discrepancy))]', icon: AlertTriangle },
  approved: { label: 'Approved', color: 'text-[hsl(var(--validated))]', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-[hsl(var(--blocking))]', icon: AlertTriangle },
};

const StatusBadge: React.FC<{ status: KycStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cfg.color} bg-white/5 border border-white/10`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
};

const FileUploadButton: React.FC<{ label: string; docType: string; ownerType: 'user' | 'org'; required?: boolean }> = ({ label, docType, ownerType, required }) => {
  const { uploadDocument, uploads, userKyc, orgKyb } = useKycStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const ownerId = ownerType === 'user' ? userKyc?.id : orgKyb?.id;
  const existing = uploads.find(u => u.owner_type === ownerType && u.owner_id === ownerId && u.doc_type === docType);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadDocument(file, docType, ownerType);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-[#2A2F3A] rounded-lg border border-white/5">
      <div className="flex items-center gap-3">
        {existing ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--validated))]" /> : <Upload className="w-4 h-4 text-white/30" />}
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          {!required && <p className="text-xs text-white/30">Optional</p>}
          {existing && <p className="text-xs text-white/40 mt-0.5">{existing.file_name}</p>}
        </div>
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
          existing ? 'bg-[hsl(var(--validated))]/10 text-[hsl(var(--validated))]' : 'bg-accent text-accent-foreground hover:bg-accent/80'
        }`}
      >
        {existing ? 'Uploaded' : 'Upload'}
      </button>
      <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
    </div>
  );
};

export const VerificationCover: React.FC = () => {
  const { userKyc, orgKyb, loading, fetchKycData, upsertKyc, upsertKyb, submitKyc, submitKyb, demoApproveAll } = useKycStore();
  const { isAdmin } = useAuth();

  // Local form state
  const [kycForm, setKycForm] = useState({
    full_legal_name: '', date_of_birth: '', nationality: '', residential_address: '', role_at_org: '',
    bank_name: '', bank_address: '', account_holder_name: '', account_number_last4: '',
    routing_number: '', swift_bic: '', iban: '', bank_country: '', wire_currency: 'USD', intermediary_bank: '',
  });
  const [kybForm, setKybForm] = useState({
    legal_entity_name: '', country_jurisdiction: '', registration_number: '', registered_address: '',
  });

  useEffect(() => { fetchKycData(); }, []);

  useEffect(() => {
    if (userKyc) setKycForm({
      full_legal_name: userKyc.full_legal_name || '',
      date_of_birth: userKyc.date_of_birth || '',
      nationality: userKyc.nationality || '',
      residential_address: userKyc.residential_address || '',
      role_at_org: userKyc.role_at_org || '',
      bank_name: userKyc.bank_name || '',
      bank_address: userKyc.bank_address || '',
      account_holder_name: userKyc.account_holder_name || '',
      account_number_last4: userKyc.account_number_last4 || '',
      routing_number: userKyc.routing_number || '',
      swift_bic: userKyc.swift_bic || '',
      iban: userKyc.iban || '',
      bank_country: userKyc.bank_country || '',
      wire_currency: userKyc.wire_currency || 'USD',
      intermediary_bank: userKyc.intermediary_bank || '',
    });
  }, [userKyc]);

  useEffect(() => {
    if (orgKyb) setKybForm({
      legal_entity_name: orgKyb.legal_entity_name || '',
      country_jurisdiction: orgKyb.country_jurisdiction || '',
      registration_number: orgKyb.registration_number || '',
      registered_address: orgKyb.registered_address || '',
    });
  }, [orgKyb]);

  const kycStatus = userKyc?.status || 'not_started';
  const kybStatus = orgKyb?.status || 'not_started';
  const kycEditable = ['not_started', 'draft', 'rejected'].includes(kycStatus);
  const kybEditable = ['not_started', 'draft', 'rejected'].includes(kybStatus);

  const handleSaveKyc = () => upsertKyc({ ...kycForm, status: 'draft' } as any);
  const handleSaveKyb = () => upsertKyb({ ...kybForm, status: 'draft' } as any);

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-6 h-6 text-accent" /> Verification
          </h1>
          <p className="text-sm text-white/40 mt-1">Individual KYC & Organization KYB</p>
        </div>
        {isAdmin && (
          <button
            onClick={demoApproveAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--validated))]/10 border border-[hsl(var(--validated))]/20 text-[hsl(var(--validated))] text-sm font-medium hover:bg-[hsl(var(--validated))]/20 transition-all"
          >
            <Zap className="w-4 h-4" /> Instant Approve (Demo)
          </button>
        )}
      </div>

      {/* Individual KYC */}
      <section className="bg-[#2A2F3A] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Individual Verification (KYC)</h2>
            <p className="text-xs text-white/40 mt-1">Identity verification for authorized signatory</p>
          </div>
          <StatusBadge status={kycStatus} />
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Full Legal Name', key: 'full_legal_name', type: 'text' },
              { label: 'Date of Birth', key: 'date_of_birth', type: 'date' },
              { label: 'Nationality', key: 'nationality', type: 'text' },
              { label: 'Residential Address', key: 'residential_address', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{f.label}</label>
                <input
                  type={f.type}
                  value={(kycForm as any)[f.key]}
                  onChange={e => setKycForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  disabled={!kycEditable}
                  className="mt-1 w-full px-3 py-2.5 bg-[#0F1220] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Role at Organization</label>
            <select
              value={kycForm.role_at_org}
              onChange={e => setKycForm(prev => ({ ...prev, role_at_org: e.target.value }))}
              disabled={!kycEditable}
              className="mt-1 w-full px-3 py-2.5 bg-[#0F1220] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-accent disabled:opacity-50"
            >
              <option value="">Select role...</option>
              {['Lawyer', 'Paralegal', 'Fund Ops', 'CFO', 'General Counsel', 'Other'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Documents</p>
            <FileUploadButton label="Government-issued Photo ID" docType="government_id" ownerType="user" required />
            <FileUploadButton label="Proof of Address" docType="proof_of_address" ownerType="user" />
          </div>

          {/* Banking & Wire Details */}
          <div className="pt-4 border-t border-white/5 space-y-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-accent" />
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Banking & Wire Instructions</p>
              {userKyc?.bank_verified && (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[hsl(var(--validated))]/10 text-[hsl(var(--validated))]">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Bank Name', key: 'bank_name', placeholder: 'e.g. JPMorgan Chase' },
                { label: 'Account Holder Name', key: 'account_holder_name', placeholder: 'As registered with bank' },
                { label: 'Account Number (Last 4)', key: 'account_number_last4', placeholder: '••••' },
                { label: 'Routing / Sort Code', key: 'routing_number', placeholder: 'e.g. 021000021' },
                { label: 'SWIFT / BIC', key: 'swift_bic', placeholder: 'e.g. CHASUS33' },
                { label: 'IBAN (if applicable)', key: 'iban', placeholder: 'e.g. GB29 NWBK 6016 1331 9268 19' },
                { label: 'Bank Country', key: 'bank_country', placeholder: 'e.g. United States' },
                { label: 'Bank Address', key: 'bank_address', placeholder: 'Branch address' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{f.label}</label>
                  <input
                    type="text"
                    value={(kycForm as any)[f.key]}
                    onChange={e => setKycForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    disabled={!kycEditable}
                    placeholder={f.placeholder}
                    className="mt-1 w-full px-3 py-2.5 bg-[#0F1220] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Wire Currency</label>
                <select
                  value={kycForm.wire_currency}
                  onChange={e => setKycForm(prev => ({ ...prev, wire_currency: e.target.value }))}
                  disabled={!kycEditable}
                  className="mt-1 w-full px-3 py-2.5 bg-[#0F1220] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-accent disabled:opacity-50"
                >
                  {['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SGD', 'HKD'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Intermediary Bank (if any)</label>
                <input
                  type="text"
                  value={kycForm.intermediary_bank}
                  onChange={e => setKycForm(prev => ({ ...prev, intermediary_bank: e.target.value }))}
                  disabled={!kycEditable}
                  placeholder="Optional"
                  className="mt-1 w-full px-3 py-2.5 bg-[#0F1220] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
            </div>
            <p className="text-[10px] text-white/25 italic">Wire instructions are encrypted at rest. Only authorized deal participants can view account details.</p>
          </div>

          {kycEditable && (
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveKyc} className="px-4 py-2 text-sm font-medium text-white/70 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                Save as Draft
              </button>
              {(kycStatus === 'draft' || kycStatus === 'rejected') && (
                <button onClick={submitKyc} className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/80 transition-all">
                  Submit for Review
                </button>
              )}
            </div>
          )}

          {kycStatus === 'rejected' && userKyc?.admin_notes && (
            <div className="p-3 rounded-lg bg-[hsl(var(--blocking))]/5 border border-[hsl(var(--blocking))]/20 text-sm text-white/70">
              <p className="font-medium text-[hsl(var(--blocking))] text-xs mb-1">Rejection Note:</p>
              {userKyc.admin_notes}
            </div>
          )}
        </div>
      </section>

      {/* Organization KYB */}
      <section className="bg-[#2A2F3A] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Organization Verification (KYB)</h2>
            <p className="text-xs text-white/40 mt-1">Entity verification for the organization</p>
          </div>
          <StatusBadge status={kybStatus} />
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Legal Entity Name', key: 'legal_entity_name' },
              { label: 'Country / Jurisdiction', key: 'country_jurisdiction' },
              { label: 'Registration Number / EIN', key: 'registration_number' },
              { label: 'Registered Address', key: 'registered_address' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{f.label}</label>
                <input
                  type="text"
                  value={(kybForm as any)[f.key]}
                  onChange={e => setKybForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  disabled={!kybEditable}
                  className="mt-1 w-full px-3 py-2.5 bg-[#0F1220] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Documents</p>
            <FileUploadButton label="Certificate of Incorporation" docType="incorporation_doc" ownerType="org" required />
            <FileUploadButton label="Authorization Letter / Proof of Authority" docType="authorization_letter" ownerType="org" />
            <FileUploadButton label="Beneficial Ownership List" docType="beneficial_ownership" ownerType="org" />
          </div>

          {kybEditable && (
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveKyb} className="px-4 py-2 text-sm font-medium text-white/70 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                Save as Draft
              </button>
              {(kybStatus === 'draft' || kybStatus === 'rejected') && (
                <button onClick={submitKyb} className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/80 transition-all">
                  Submit for Review
                </button>
              )}
            </div>
          )}

          {kybStatus === 'rejected' && orgKyb?.admin_notes && (
            <div className="p-3 rounded-lg bg-[hsl(var(--blocking))]/5 border border-[hsl(var(--blocking))]/20 text-sm text-white/70">
              <p className="font-medium text-[hsl(var(--blocking))] text-xs mb-1">Rejection Note:</p>
              {orgKyb.admin_notes}
            </div>
          )}
        </div>
      </section>

      {/* Disclaimer */}
      <p className="text-xs text-white/30 text-center">
        This is a pilot workflow. Verification may be manual and may not involve third-party identity checks.
      </p>
    </div>
  );
};
