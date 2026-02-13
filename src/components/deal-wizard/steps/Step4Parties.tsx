import React from 'react';
import { useDealWizardStore, PartyContact } from '@/stores/dealWizardStore';
import { UserPlus } from 'lucide-react';

const PARTY_FIELDS: { key: keyof ReturnType<typeof useDealWizardStore.getState>['parties']; label: string }[] = [
  { key: 'buyerCounsel', label: 'Buyer Counsel' },
  { key: 'sellerCounsel', label: 'Seller Counsel' },
  { key: 'fundContact', label: 'Fund Contact' },
  { key: 'escrowAgent', label: 'Escrow Agent' },
];

export const Step4Parties: React.FC = () => {
  const { parties, updateParties } = useDealWizardStore();

  const updateField = (partyKey: string, field: keyof PartyContact, value: string) => {
    updateParties({ [partyKey]: { ...parties[partyKey as keyof typeof parties], [field]: value } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Parties & Roles</h2>
        <p className="text-sm text-white/40 mt-1">Key contacts for this transaction</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PARTY_FIELDS.map(({ key, label }) => (
          <div key={key} className="p-4 bg-[#2A2F3A] rounded-lg border border-white/5 space-y-3">
            <p className="text-sm font-semibold text-white">{label}</p>
            <input
              type="text"
              value={parties[key].name}
              onChange={(e) => updateField(key, 'name', e.target.value)}
              placeholder="Full name"
              className="w-full bg-[#0F1220] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#5B3DF5]/50 transition-all"
            />
            <input
              type="email"
              value={parties[key].email}
              onChange={(e) => updateField(key, 'email', e.target.value)}
              placeholder="Email"
              className="w-full bg-[#0F1220] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#5B3DF5]/50 transition-all"
            />
          </div>
        ))}
      </div>
      <button className="flex items-center gap-2 text-xs text-[#2F6BFF] hover:text-[#2F6BFF]/80 transition-colors font-medium">
        <UserPlus className="w-3.5 h-3.5" />
        Invite additional party (creates Pending Invite)
      </button>
    </div>
  );
};
