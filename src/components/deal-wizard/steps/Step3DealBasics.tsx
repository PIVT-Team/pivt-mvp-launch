import React from 'react';
import { useDealWizardStore } from '@/stores/dealWizardStore';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const DEAL_TYPES = [
  "Private Company Share Purchase", "Private Equity Acquisition", "Asset Acquisition", "Merger",
  "Leveraged Buyout", "Growth Equity", "Venture Investment", "Secondary Transaction", "Other",
];

const CURRENCY_GROUPS = [
  {
    label: "Major",
    currencies: [
      { code: "USD", name: "US Dollar", region: "United States" },
      { code: "EUR", name: "Euro", region: "European Union" },
      { code: "GBP", name: "British Pound", region: "United Kingdom" },
    ],
  },
  {
    label: "Asia-Pacific",
    currencies: [
      { code: "JPY", name: "Japanese Yen", region: "Japan" },
      { code: "CNY", name: "Chinese Yuan", region: "China" },
      { code: "SGD", name: "Singapore Dollar", region: "Singapore" },
      { code: "HKD", name: "Hong Kong Dollar", region: "Hong Kong" },
      { code: "KRW", name: "South Korean Won", region: "South Korea" },
      { code: "INR", name: "Indian Rupee", region: "India" },
      { code: "AUD", name: "Australian Dollar", region: "Australia" },
    ],
  },
  {
    label: "Americas",
    currencies: [
      { code: "CAD", name: "Canadian Dollar", region: "Canada" },
      { code: "BRL", name: "Brazilian Real", region: "Brazil" },
      { code: "MXN", name: "Mexican Peso", region: "Mexico" },
    ],
  },
  {
    label: "Europe",
    currencies: [
      { code: "CHF", name: "Swiss Franc", region: "Switzerland" },
      { code: "SEK", name: "Swedish Krona", region: "Sweden" },
      { code: "NOK", name: "Norwegian Krone", region: "Norway" },
      { code: "DKK", name: "Danish Krone", region: "Denmark" },
      { code: "PLN", name: "Polish Zloty", region: "Poland" },
    ],
  },
  {
    label: "Middle East & Africa",
    currencies: [
      { code: "AED", name: "UAE Dirham", region: "United Arab Emirates" },
      { code: "ZAR", name: "South African Rand", region: "South Africa" },
    ],
  },
];

export const Step3DealBasics: React.FC = () => {
  const { dealBasics, updateDealBasics } = useDealWizardStore();
  const selectedCurrencies = dealBasics.currency ? dealBasics.currency.split(',').filter(Boolean) : ['USD'];

  const toggleCurrency = (code: string) => {
    const updated = selectedCurrencies.includes(code)
      ? selectedCurrencies.filter((c) => c !== code)
      : [...selectedCurrencies, code];
    if (updated.length > 0) updateDealBasics({ currency: updated.join(',') });
  };

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
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Deal Type</label>
          <select
            value={dealBasics.dealType || ''}
            onChange={(e) => updateDealBasics({ dealType: e.target.value })}
            className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5B3DF5]/50 transition-all"
          >
            <option value="" style={{ background: '#1a1f2e' }}>Select type…</option>
            {DEAL_TYPES.map((t) => <option key={t} value={t} style={{ background: '#1a1f2e' }}>{t}</option>)}
          </select>
        </div>
        {field('Buyer Legal Name', 'buyerLegalName', 'text', 'Apex Capital Partners LLC')}
        {field('Seller Legal Name', 'sellerLegalName', 'text', 'Northbridge Software Inc.')}
        {field('Transaction Value', 'transactionValue', 'text', '185,000,000')}
        {field('Signing Date', 'signingDate', 'date')}
        {field('Target Close Date', 'targetCloseDate', 'date')}
        {/* Multi-currency selector */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-white/60 mb-1.5">Currencies</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedCurrencies.map((code) => (
              <Badge key={code} variant="secondary" className="gap-1 pr-1 bg-[#2A2F3A] text-white border border-white/10">
                {code}
                {selectedCurrencies.length > 1 && (
                  <button type="button" onClick={() => toggleCurrency(code)} className="ml-0.5 rounded-full hover:bg-white/10 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          <select
            value=""
            onChange={(e) => { if (e.target.value) toggleCurrency(e.target.value); }}
            className="w-full bg-[#2A2F3A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5B3DF5]/50 transition-all"
          >
            <option value="" style={{ background: '#1a1f2e' }}>Add currency…</option>
            {CURRENCY_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.currencies.map((c) => (
                  <option key={c.code} value={c.code} disabled={selectedCurrencies.includes(c.code)} style={{ background: '#1a1f2e' }}>
                    {c.code} — {c.name} ({c.region})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
