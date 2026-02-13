import React from 'react';
import { Upload, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useDealWizardStore } from '@/stores/dealWizardStore';

export const Step2Kyc: React.FC = () => {
  const { kyc, updateKyc, wizardMode } = useDealWizardStore();

  const statusIcon = (done: boolean) =>
    done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-white/30" />;

  const uploadRow = (label: string, key: 'govIdUploaded' | 'proofOfAddressUploaded' | 'corpDocUploaded', optional = false) => (
    <div className="flex items-center justify-between p-4 bg-[#2A2F3A] rounded-lg border border-white/5">
      <div className="flex items-center gap-3">
        {statusIcon(kyc[key])}
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          {optional && <p className="text-xs text-white/30">Optional</p>}
        </div>
      </div>
      <button
        onClick={() => updateKyc({ [key]: true })}
        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
          kyc[key]
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-[#5B3DF5] text-white hover:bg-[#5B3DF5]/80'
        }`}
      >
        {kyc[key] ? 'Uploaded' : 'Upload'}
      </button>
    </div>
  );

  const handleDemoApprove = () => {
    updateKyc({ govIdUploaded: true, proofOfAddressUploaded: true, corpDocUploaded: true, attestation: true, status: 'approved' });
  };

  const handleSubmitReview = () => {
    updateKyc({ status: 'in_review' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">KYC / KYB Verification</h2>
        <p className="text-sm text-white/40 mt-1">Identity and entity verification</p>
      </div>

      {wizardMode === 'demo' && (
        <button
          onClick={handleDemoApprove}
          className="w-full py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all"
        >
          ⚡ Instant Approval (Demo Mode)
        </button>
      )}

      <div className="space-y-2">
        {uploadRow('Government-issued Photo ID', 'govIdUploaded')}
        {uploadRow('Proof of Address', 'proofOfAddressUploaded', true)}
        {uploadRow('Certificate of Incorporation', 'corpDocUploaded')}
      </div>

      <div className="p-4 bg-[#2A2F3A] rounded-lg border border-white/5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={kyc.attestation}
            onChange={(e) => updateKyc({ attestation: e.target.checked })}
            className="mt-0.5 rounded border-white/20 bg-transparent text-[#5B3DF5] focus:ring-[#5B3DF5]/50"
          />
          <span className="text-sm text-white/70">
            I confirm I am authorized to act on behalf of this organization.
          </span>
        </label>
      </div>

      {kyc.status !== 'not_started' && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          kyc.status === 'approved'
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          {kyc.status === 'approved'
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <Clock className="w-5 h-5 text-amber-400" />
          }
          <p className="text-sm font-medium text-white/80">
            {kyc.status === 'approved' ? 'Verification Approved' : 'Submitted — Pending Admin Review'}
          </p>
        </div>
      )}

      {wizardMode === 'live' && kyc.status === 'not_started' && kyc.govIdUploaded && kyc.attestation && (
        <button
          onClick={handleSubmitReview}
          className="w-full py-2.5 rounded-lg bg-[#2F6BFF] text-white text-sm font-medium hover:bg-[#2F6BFF]/80 transition-all"
        >
          Submit for Review
        </button>
      )}
    </div>
  );
};
