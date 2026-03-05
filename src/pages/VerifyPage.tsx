import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, AlertTriangle, Loader2, Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

type PageState = 'loading' | 'form' | 'submitted' | 'error';

interface VerificationInfo {
  request_id: string;
  recipient_name: string;
  recipient_email: string;
  stakeholder_type: string;
  deal_name: string;
}

interface UploadedDoc {
  fileName: string;
  docType: string;
  fileUrl: string;
}

const DOC_TYPES_KYC = [
  { value: 'ID_FRONT', label: 'Government ID (Front)', required: true },
  { value: 'ID_BACK', label: 'Government ID (Back)', required: false },
  { value: 'PASSPORT', label: 'Passport', required: false },
  { value: 'PROOF_OF_ADDRESS', label: 'Proof of Address', required: false },
];

const DOC_TYPES_KYB = [
  { value: 'CERT_OF_INCORPORATION', label: 'Certificate of Incorporation', required: true },
  { value: 'BUSINESS_REGISTRY', label: 'Business Registry Extract', required: false },
  { value: 'OTHER', label: 'Other Supporting Document', required: false },
];

const VerifyPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<PageState>('loading');
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(1); // 1: info, 2: documents, 3: review

  // KYC fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('');
  const [address1, setAddress1] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');

  // KYB fields
  const [entityName, setEntityName] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regAddress, setRegAddress] = useState('');

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const fnUrl = `https://${projectId}.supabase.co/functions/v1/verify-token`;

  useEffect(() => {
    if (!token) {
      setErrorMsg('No verification token provided');
      setState('error');
      return;
    }
    fetch(`${fnUrl}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Invalid verification link');
          setState('error');
          return;
        }
        setInfo(data);
        const parts = (data.recipient_name || '').split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
        setEntityName(data.recipient_name || '');
        setState('form');
      })
      .catch(() => {
        setErrorMsg('Unable to reach verification service');
        setState('error');
      });
  }, [token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file || !info) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${info.request_id}/${docType}-${Date.now()}.${ext}`;
      
      // Upload via Supabase storage (anon key)
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      );
      
      const { error } = await supabase.storage
        .from('verification-documents')
        .upload(path, file, { upsert: true });
      
      if (error) {
        toast.error('Upload failed: ' + error.message);
        setUploading(false);
        return;
      }

      setUploadedDocs(prev => [...prev, {
        fileName: file.name,
        docType,
        fileUrl: path,
      }]);
      toast.success(`${file.name} uploaded`);
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
  };

  const removeDoc = (idx: number) => {
    setUploadedDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const isEntity = info?.stakeholder_type === 'entity';
  const docTypes = isEntity ? DOC_TYPES_KYB : DOC_TYPES_KYC;

  const validateStep1 = () => {
    if (isEntity) {
      if (!entityName.trim() || !jurisdiction.trim()) {
        toast.error('Please fill in all required fields');
        return false;
      }
    } else {
      if (!firstName.trim() || !lastName.trim() || !dob || !country.trim() || !address1.trim() || !city.trim()) {
        toast.error('Please fill in all required fields');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!token || !info || !consent) return;
    setSubmitting(true);

    const submission = isEntity
      ? { legal_entity_name: entityName, country_jurisdiction: jurisdiction, registration_number: regNumber, registered_address: regAddress }
      : { first_name: firstName, last_name: lastName, full_legal_name: `${firstName} ${lastName}`, date_of_birth: dob, country, address_line_1: address1, city, state_region: stateRegion, postal_code: postalCode, phone };

    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          submission,
          consent_accepted: consent,
          documents: uploadedDocs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Submission failed');
        setSubmitting(false);
        return;
      }
      setState('submitted');
    } catch {
      toast.error('Network error — please try again');
      setSubmitting(false);
    }
  };

  const stepLabels = ['Information', 'Documents', 'Review & Submit'];

  return (
    <div className="min-h-screen bg-[#0F1220] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">PIVT</h1>
          <p className="text-xs text-white/40 mt-1">Secure Verification Portal</p>
        </div>

        {state === 'loading' && (
          <div className="bg-[#1A1F2E] rounded-xl border border-white/10 p-12 text-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
            <p className="text-sm text-white/50 mt-4">Validating your link…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-[#1A1F2E] rounded-xl border border-white/10 p-12 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto" />
            <h2 className="text-lg font-semibold text-white">Verification Unavailable</h2>
            <p className="text-sm text-white/50">{errorMsg}</p>
          </div>
        )}

        {state === 'submitted' && (
          <div className="bg-[#1A1F2E] rounded-xl border border-white/10 p-12 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-semibold text-white">Verification Submitted</h2>
            <p className="text-sm text-white/50">
              Thank you, {info?.recipient_name}. Your information has been submitted for review.
              We'll notify the requester once verification is complete.
            </p>
          </div>
        )}

        {state === 'form' && info && (
          <div className="bg-[#1A1F2E] rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent" />
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {isEntity ? 'Organization Verification (KYB)' : 'Identity Verification (KYC)'}
                  </h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    For deal: <span className="text-white/60">{info.deal_name}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="px-6 pt-4 flex items-center gap-2">
              {stepLabels.map((label, i) => (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    step > i + 1 ? 'bg-emerald-500/20 text-emerald-400' :
                    step === i + 1 ? 'bg-accent/20 text-accent' :
                    'bg-white/5 text-white/30'
                  }`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs truncate ${step === i + 1 ? 'text-white/80' : 'text-white/30'}`}>{label}</span>
                  {i < 2 && <div className="flex-1 h-px bg-white/10" />}
                </div>
              ))}
            </div>

            {/* Step 1: Information */}
            {step === 1 && (
              <div className="p-6 space-y-4">
                {isEntity ? (
                  <>
                    <Field label="Legal Entity Name *" value={entityName} onChange={setEntityName} />
                    <Field label="Country / Jurisdiction *" value={jurisdiction} onChange={setJurisdiction} />
                    <Field label="Registration Number / EIN" value={regNumber} onChange={setRegNumber} placeholder="If available" />
                    <Field label="Registered Address" value={regAddress} onChange={setRegAddress} />
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="First Name *" value={firstName} onChange={setFirstName} />
                      <Field label="Last Name *" value={lastName} onChange={setLastName} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Date of Birth *" value={dob} onChange={setDob} type="date" />
                      <Field label="Country *" value={country} onChange={setCountry} />
                    </div>
                    <Field label="Address Line 1 *" value={address1} onChange={setAddress1} />
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="City *" value={city} onChange={setCity} />
                      <Field label="State / Region" value={stateRegion} onChange={setStateRegion} />
                      <Field label="Postal Code" value={postalCode} onChange={setPostalCode} />
                    </div>
                    <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" />
                  </>
                )}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => validateStep1() && setStep(2)}
                    className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 transition-colors"
                  >
                    Next: Documents →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Documents */}
            {step === 2 && (
              <div className="p-6 space-y-4">
                <p className="text-xs text-white/40">Upload required documents. Max 10MB per file.</p>
                {docTypes.map(dt => {
                  const existing = uploadedDocs.find(d => d.docType === dt.value);
                  return (
                    <div key={dt.value} className="flex items-center justify-between p-4 bg-[#0F1220] rounded-lg border border-white/5">
                      <div className="flex items-center gap-3">
                        {existing ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-white/30" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{dt.label}</p>
                          {dt.required && !existing && <p className="text-[10px] text-orange-400">Required</p>}
                          {existing && <p className="text-xs text-white/40">{existing.fileName}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {existing && (
                          <button onClick={() => removeDoc(uploadedDocs.indexOf(existing))} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        )}
                        <label className={`text-xs px-3 py-1.5 rounded-md font-medium cursor-pointer transition-all ${
                          existing ? 'bg-emerald-500/10 text-emerald-400' : 'bg-accent/10 text-accent hover:bg-accent/20'
                        }`}>
                          {existing ? 'Replace' : 'Upload'}
                          <input type="file" className="hidden" onChange={e => handleFileUpload(e, dt.value)} accept=".pdf,.jpg,.jpeg,.png,.webp" />
                        </label>
                      </div>
                    </div>
                  );
                })}
                {uploading && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                  </div>
                )}
                <div className="pt-2 flex justify-between">
                  <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 transition-colors"
                  >
                    Next: Review →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <div className="p-6 space-y-5">
                <div className="bg-[#0F1220] rounded-lg border border-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Summary</p>
                  {isEntity ? (
                    <>
                      <SummaryRow label="Entity" value={entityName} />
                      <SummaryRow label="Jurisdiction" value={jurisdiction} />
                      {regNumber && <SummaryRow label="Registration" value={regNumber} />}
                    </>
                  ) : (
                    <>
                      <SummaryRow label="Name" value={`${firstName} ${lastName}`} />
                      <SummaryRow label="DOB" value={dob} />
                      <SummaryRow label="Country" value={country} />
                      <SummaryRow label="Address" value={`${address1}, ${city}`} />
                    </>
                  )}
                  <SummaryRow label="Documents" value={`${uploadedDocs.length} uploaded`} />
                </div>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-accent"
                  />
                  <span className="text-xs text-white/50 leading-relaxed group-hover:text-white/70 transition-colors">
                    I confirm that the information provided is accurate and complete. I consent to the processing of this data
                    for verification purposes in connection with the referenced transaction. <strong className="text-white/70">Do not forward this link.</strong>
                  </span>
                </label>

                <div className="flex justify-between">
                  <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
                    ← Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !consent}
                    className="px-8 py-3 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting…' : 'Submit Verification'}
                  </button>
                </div>

                <p className="text-[10px] text-white/20 text-center">
                  Your data is transmitted securely and encrypted at rest. This link expires in 7 days.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="text-xs font-medium text-white/50 uppercase tracking-wider block mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 bg-[#0F1220] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent"
    />
  </div>
);

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-sm">
    <span className="text-white/40">{label}</span>
    <span className="text-white/80 font-medium">{value || '—'}</span>
  </div>
);

export default VerifyPage;
