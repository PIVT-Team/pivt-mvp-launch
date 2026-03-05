import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, AlertTriangle, Loader2, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type PageState = 'loading' | 'form' | 'submitted' | 'error';

interface VerificationInfo {
  request_id: string;
  recipient_name: string;
  recipient_email: string;
  stakeholder_type: string;
  deal_name: string;
}

const VerifyPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<PageState>('loading');
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Individual KYC fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [address, setAddress] = useState('');

  // Entity KYB fields
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
        setFullName(data.recipient_name || '');
        setEntityName(data.recipient_name || '');
        setState('form');
      })
      .catch(() => {
        setErrorMsg('Unable to reach verification service');
        setState('error');
      });
  }, [token]);

  const handleSubmit = async () => {
    if (!token || !info) return;
    setSubmitting(true);

    const isEntity = info.stakeholder_type === 'entity';
    const submission = isEntity
      ? { legal_entity_name: entityName, country_jurisdiction: jurisdiction, registration_number: regNumber, registered_address: regAddress }
      : { full_legal_name: fullName, date_of_birth: dob, nationality, residential_address: address };

    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, submission }),
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

  return (
    <div className="min-h-screen bg-[#0F1220] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">PIVT</h1>
          <p className="text-xs text-white/40 mt-1">Secure Verification</p>
        </div>

        {state === 'loading' && (
          <div className="bg-[#1A1F2E] rounded-xl border border-white/10 p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#6C5CE7] animate-spin mx-auto" />
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
              You'll be notified once verification is complete.
            </p>
          </div>
        )}

        {state === 'form' && info && (
          <div className="bg-[#1A1F2E] rounded-xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#6C5CE7]" />
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {info.stakeholder_type === 'entity' ? 'Organization Verification (KYB)' : 'Identity Verification (KYC)'}
                  </h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    For deal: <span className="text-white/60">{info.deal_name}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {info.stakeholder_type === 'entity' ? (
                <>
                  <Field label="Legal Entity Name" value={entityName} onChange={setEntityName} />
                  <Field label="Country / Jurisdiction" value={jurisdiction} onChange={setJurisdiction} />
                  <Field label="Registration Number / EIN" value={regNumber} onChange={setRegNumber} />
                  <Field label="Registered Address" value={regAddress} onChange={setRegAddress} />
                </>
              ) : (
                <>
                  <Field label="Full Legal Name" value={fullName} onChange={setFullName} />
                  <Field label="Date of Birth" value={dob} onChange={setDob} type="date" />
                  <Field label="Nationality" value={nationality} onChange={setNationality} />
                  <Field label="Residential Address" value={address} onChange={setAddress} />
                </>
              )}
            </div>

            <div className="p-6 border-t border-white/10">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-[#6C5CE7] text-white text-sm font-semibold hover:bg-[#5A4BD5] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Verification'}
              </button>
              <p className="text-[10px] text-white/25 text-center mt-3">
                Your data is transmitted securely and encrypted at rest.
              </p>
            </div>
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
}> = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <label className="text-xs font-medium text-white/50 uppercase tracking-wider block mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 bg-[#0F1220] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#6C5CE7]"
    />
  </div>
);

export default VerifyPage;
