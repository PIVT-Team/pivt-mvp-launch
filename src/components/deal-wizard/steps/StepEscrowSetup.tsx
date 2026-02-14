import React from 'react';
import { Building2, CheckCircle2, Info, Copy, Upload, Banknote, Shield } from 'lucide-react';
import { useDealWizardStore } from '@/stores/dealWizardStore';
import { Badge } from '@/components/ui/badge';

const INSTITUTIONS = [
  'JPMorgan Chase',
  'Citibank',
  'Bank of New York Mellon',
  'Wells Fargo',
  'U.S. Bank',
  'Wilmington Trust',
];

const statusColors: Record<string, string> = {
  pending: 'border-muted-foreground/50 text-muted-foreground',
  active: 'border-accent/50 text-accent',
  funded: 'border-validated/50 text-validated',
  disbursed: 'border-blue-400/50 text-blue-400',
  closed: 'border-muted-foreground/50 text-muted-foreground',
};

export const StepEscrowSetup: React.FC = () => {
  const { escrowSetup, updateEscrowSetup, activateEscrow, markEscrowFunded } = useDealWizardStore();
  const [copied, setCopied] = React.useState(false);

  const copyRef = () => {
    navigator.clipboard.writeText(escrowSetup.referenceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isActive = escrowSetup.status !== 'pending';
  const isFunded = escrowSetup.status === 'funded' || escrowSetup.status === 'disbursed';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Escrow Setup</h2>
          <p className="text-sm text-white/40 mt-1">Configure partner bank escrow account</p>
        </div>
        {isActive && (
          <Badge variant="outline" className={statusColors[escrowSetup.status]}>
            {escrowSetup.status.toUpperCase()}
          </Badge>
        )}
      </div>

      {/* Non-custody notice */}
      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-start gap-3">
        <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <p className="text-xs text-white/60">
          Funds are held at regulated partner institutions. <strong className="text-white/80">PIVT does not custody client funds.</strong>
        </p>
      </div>

      {/* SECTION 1: Configuration (before activation) */}
      {!isActive && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Escrow Institution</label>
            <select
              value={escrowSetup.institution}
              onChange={e => updateEscrowSetup({ institution: e.target.value })}
              className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
            >
              <option value="">Select institution...</option>
              {INSTITUTIONS.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Account Type</label>
            <div className="flex gap-3">
              {(['FBO', 'Dedicated'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => updateEscrowSetup({ accountType: type })}
                  className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-all ${
                    escrowSetup.accountType === type
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-white/10 bg-[#2A2F3A] text-white/50 hover:border-white/20'
                  }`}
                >
                  <p className="font-semibold">{type}</p>
                  <p className="text-[10px] mt-1 opacity-60">
                    {type === 'FBO' ? 'For Benefit Of — pooled account' : 'Segregated single-deal account'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Interest Rate (%)</label>
              <input
                type="number" step="0.01" value={escrowSetup.interestRate}
                onChange={e => updateEscrowSetup({ interestRate: e.target.value })}
                className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Client Split (%)</label>
              <input
                type="number" value={escrowSetup.clientSplit}
                onChange={e => updateEscrowSetup({ clientSplit: e.target.value })}
                className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Platform Split (%)</label>
              <input
                type="number" value={escrowSetup.platformSplit}
                onChange={e => updateEscrowSetup({ platformSplit: e.target.value })}
                className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          {Number(escrowSetup.clientSplit) + Number(escrowSetup.platformSplit) !== 100 && (
            <p className="text-[10px] text-amber-400">Split must total 100%</p>
          )}

          <button
            onClick={activateEscrow}
            disabled={!escrowSetup.institution || Number(escrowSetup.clientSplit) + Number(escrowSetup.platformSplit) !== 100}
            className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:bg-accent/80 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Building2 className="w-4 h-4" />
            Activate Escrow Account (Simulated)
          </button>
        </div>
      )}

      {/* SECTION 2: Active — Funding Instructions */}
      {isActive && (
        <div className="space-y-5">
          {/* Account confirmation */}
          <div className="p-4 rounded-lg bg-validated/10 border border-validated/20 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-validated shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-validated">Escrow Account Active</p>
              <p className="text-xs text-white/40 mt-0.5">{escrowSetup.institution} • {escrowSetup.accountType} • ****{escrowSetup.maskedAccount}</p>
            </div>
          </div>

          {/* Funding Instructions */}
          <div className="p-5 bg-[#2A2F3A] rounded-lg border border-white/5 space-y-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-white">Funding Instructions</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/40 text-xs">Bank Name</p>
                <p className="text-white font-medium">{escrowSetup.institution}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Account Type</p>
                <p className="text-white font-medium">{escrowSetup.accountType}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Routing Number (Masked)</p>
                <p className="text-white font-mono">****{escrowSetup.maskedRouting}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Account Number (Masked)</p>
                <p className="text-white font-mono">****{escrowSetup.maskedAccount}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-white/5">
              <p className="text-white/40 text-xs mb-1">Reference / Memo (Required)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white/5 rounded-lg text-accent font-mono text-sm">{escrowSetup.referenceCode}</code>
                <button onClick={copyRef} className="px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs font-medium flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-white/30 italic">
              Funds are held at regulated partner institutions. PIVT does not custody client funds.
            </p>
          </div>

          {/* Mark as Funded */}
          {!isFunded ? (
            <div className="p-4 bg-[#2A2F3A] rounded-lg border border-white/5 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-white">Funding Confirmation</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Admin / Demo</span>
              </div>
              <p className="text-xs text-white/40">Confirm that funds have been received at the partner institution.</p>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 transition-colors text-xs">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Funding Receipt (Optional)
                </button>
              </div>
              <button
                onClick={markEscrowFunded}
                className="w-full py-2.5 rounded-lg bg-validated text-white font-semibold hover:bg-validated/80 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Funded
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-validated/10 border border-validated/20 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-validated shrink-0" />
              <div>
                <p className="text-sm font-semibold text-validated">Escrow Funded</p>
                <p className="text-xs text-white/40 mt-0.5">Interest projection active • {escrowSetup.interestRate}% rate</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
