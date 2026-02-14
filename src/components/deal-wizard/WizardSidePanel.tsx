import React from 'react';
import { Info, HelpCircle } from 'lucide-react';
import { WizardStep, useDealWizardStore } from '@/stores/dealWizardStore';

const SIDE_CONTENT: Record<WizardStep, { needed: string[]; why: string }> = {
  account: {
    needed: ['Your full legal name', 'Organization details', 'Contact information'],
    why: 'We verify your identity to ensure only authorized personnel can initiate or manage deal payouts.',
  },
  'escrow-setup': {
    needed: ['Escrow institution selection', 'Account type (FBO or Dedicated)', 'Interest rate and split configuration'],
    why: 'Funds are held at regulated partner institutions. Configuring escrow early ensures proper fund segregation and interest tracking.',
  },
  kyc: {
    needed: ['Government-issued photo ID', 'Proof of address (optional)', 'Certificate of incorporation (for entities)'],
    why: 'KYC/KYB compliance is required by financial regulations. This protects all parties in the transaction.',
  },
  'deal-basics': {
    needed: ['Deal name and key parties', 'Transaction value and currency', 'Target closing date'],
    why: 'Accurate deal information ensures the waterfall, escrow, and payout calculations are correct from the start.',
  },
  parties: {
    needed: ['Counsel names and emails for both sides', 'Fund and escrow agent contacts'],
    why: 'Each party plays a role in the approval chain. Identifying them now enables sequential sign-off later.',
  },
  documentation: {
    needed: ['Cap table (CSV/XLSX)', 'Waterfall schedule', 'Escrow agreement', 'Closing checklist', 'Fee schedule'],
    why: 'Documents are parsed and cross-referenced to detect discrepancies before any funds move.',
  },
  validation: {
    needed: ['All documents uploaded in previous step'],
    why: 'Automated validation catches mismatches between cap table, waterfall, and escrow terms — saving days of manual review.',
  },
  discrepancies: {
    needed: ['Review each flagged item', 'Resolve or escalate high-severity issues'],
    why: 'Unresolved discrepancies can delay closing or result in incorrect payouts. Every variance must be addressed.',
  },
  approvals: {
    needed: ['Sign-off from each required party'],
    why: 'Sequential approvals create an immutable audit trail and ensure all stakeholders have reviewed the final terms.',
  },
  execution: {
    needed: ['All approvals completed', 'All discrepancies resolved'],
    why: 'This step generates a confirmation ID and audit log. In production, this would trigger actual wire transfers.',
  },
};

export const WizardSidePanel: React.FC = () => {
  const { currentStep } = useDealWizardStore();
  const content = SIDE_CONTENT[currentStep];

  return (
    <div className="w-72 shrink-0 border-l border-white/10 p-6 space-y-6 hidden xl:block">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3">
          <Info className="w-4 h-4 text-[#5B3DF5]" />
          What you'll need
        </div>
        <ul className="space-y-2">
          {content.needed.map((item, i) => (
            <li key={i} className="text-xs text-white/50 flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-[#5B3DF5] mt-1.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3">
          <HelpCircle className="w-4 h-4 text-[#2F6BFF]" />
          Why we ask this
        </div>
        <p className="text-xs text-white/40 leading-relaxed">{content.why}</p>
      </div>
    </div>
  );
};
