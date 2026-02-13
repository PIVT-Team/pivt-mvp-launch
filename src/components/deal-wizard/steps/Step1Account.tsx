import React from 'react';
import { useDealWizardStore } from '@/stores/dealWizardStore';

const ROLES = ['Lawyer', 'Paralegal', 'Fund Ops', 'CFO', 'Other'];

export const Step1Account: React.FC = () => {
  const { account, updateAccount } = useDealWizardStore();

  const field = (label: string, key: keyof typeof account, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-white/60 mb-1.5">{label}</label>
      <input
        type={type}
        value={account[key]}
        onChange={(e) => updateAccount({ [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#5B3DF5]/50 focus:border-[#5B3DF5]/50 transition-all"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Account & Entity</h2>
        <p className="text-sm text-white/40 mt-1">Identify yourself and your organization</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {field('Full Name', 'fullName', 'text', 'Alexandra Reynolds')}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Role</label>
          <select
            value={account.role}
            onChange={(e) => updateAccount({ role: e.target.value })}
            className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5B3DF5]/50 transition-all"
          >
            <option value="" style={{ background: '#1a1f2e' }}>Select role…</option>
            {ROLES.map(r => <option key={r} value={r} style={{ background: '#1a1f2e' }}>{r}</option>)}
          </select>
        </div>
        {field('Organization Name', 'organization', 'text', 'Apex Capital Partners')}
        {field('Jurisdiction', 'jurisdiction', 'text', 'Delaware, USA')}
        {field('Email', 'email', 'email', 'areynolds@apexcap.com')}
        {field('Phone', 'phone', 'tel', '+1 (212) 555-0142')}
      </div>
    </div>
  );
};
