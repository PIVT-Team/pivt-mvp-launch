import React, { useState } from 'react';
import { Building2, Shield, CheckCircle2, Info } from 'lucide-react';
import { useDealWizardStore } from '@/stores/dealWizardStore';

const INSTITUTIONS = [
  'JPMorgan Chase',
  'Citibank',
  'Bank of New York Mellon',
  'Wells Fargo',
  'U.S. Bank',
  'Wilmington Trust',
];

export const StepEscrowSetup: React.FC = () => {
  const { escrowSetup, updateEscrowSetup, activateEscrow, wizardMode } = useDealWizardStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Escrow Setup</h2>
        <p className="text-sm text-white/40 mt-1">Configure partner bank escrow account</p>
      </div>

      {/* Non-custody notice */}
      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-start gap-3">
        <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <p className="text-xs text-white/60">
          Funds are held at regulated partner institutions. <strong className="text-white/80">PIVT does not custody client funds.</strong>
        </p>
      </div>

      <div className="space-y-4">
        {/* Institution */}
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

        {/* Account Type */}
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

        {/* Interest Rate */}
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Interest Rate (%)</label>
          <input
            type="number"
            step="0.01"
            value={escrowSetup.interestRate}
            onChange={e => updateEscrowSetup({ interestRate: e.target.value })}
            className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent"
            placeholder="4.25"
          />
        </div>

        {/* Interest Split */}
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Interest Split</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/30 block mb-1">% to Client</label>
              <input
                type="number"
                value={escrowSetup.clientSplit}
                onChange={e => updateEscrowSetup({ clientSplit: e.target.value })}
                className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/30 block mb-1">% to Platform</label>
              <input
                type="number"
                value={escrowSetup.platformSplit}
                onChange={e => updateEscrowSetup({ platformSplit: e.target.value })}
                className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          {Number(escrowSetup.clientSplit) + Number(escrowSetup.platformSplit) !== 100 && (
            <p className="text-[10px] text-amber-400 mt-1">Split must total 100%</p>
          )}
        </div>
      </div>

      {/* Activate CTA */}
      {!escrowSetup.activated ? (
        <button
          onClick={activateEscrow}
          disabled={!escrowSetup.institution || Number(escrowSetup.clientSplit) + Number(escrowSetup.platformSplit) !== 100}
          className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:bg-accent/80 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Building2 className="w-4 h-4" />
          Activate Escrow Account (Simulated)
        </button>
      ) : (
        <div className="p-4 rounded-lg bg-validated/10 border border-validated/20 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-validated" />
          <div>
            <p className="text-sm font-semibold text-validated">Escrow Account Activated</p>
            <p className="text-xs text-white/40 mt-0.5">{escrowSetup.institution} • {escrowSetup.accountType} • ****{escrowSetup.maskedAccount}</p>
          </div>
        </div>
      )}
    </div>
  );
};
