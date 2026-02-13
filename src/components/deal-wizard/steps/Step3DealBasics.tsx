import React from 'react';
import { useDealWizardStore } from '@/stores/dealWizardStore';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD'];

export const Step3DealBasics: React.FC = () => {
  const { dealBasics, updateDealBasics } = useDealWizardStore();

  const field = (label: string, key: keyof typeof dealBasics, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-white/60 mb-1.5">{label}</label>
      <input
        type={type}
        value={dealBasics[key]}
        onChange={(e) => updateDealBasics({ [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#5B3DF5]/50 transition-all"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Deal Basics</h2>
        <p className="text-sm text-white/40 mt-1">Core transaction details</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {field('Deal Name', 'dealName', 'text', 'Project ATLAS')}
        {field('Buyer Legal Name', 'buyerLegalName', 'text', 'Apex Capital Partners LLC')}
        {field('Seller Legal Name', 'sellerLegalName', 'text', 'DataStream Technologies Inc.')}
        {field('Transaction Value', 'transactionValue', 'text', '2,800,000,000')}
        {field('Target Close Date', 'targetCloseDate', 'date')}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Currency</label>
          <select
            value={dealBasics.currency}
            onChange={(e) => updateDealBasics({ currency: e.target.value })}
            className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5B3DF5]/50 transition-all"
          >
            {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#1a1f2e' }}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};
