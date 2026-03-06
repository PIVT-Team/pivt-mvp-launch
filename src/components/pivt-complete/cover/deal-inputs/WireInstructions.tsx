import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Landmark, Building2, Vault } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FieldGroup: React.FC<{ label: string; placeholder?: string }> = ({ label, placeholder }) => (
  <div>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input placeholder={placeholder || label} className="mt-1.5" />
  </div>
);

export const WireInstructions: React.FC = () => (
  <div className="space-y-8">
    <motion.div {...fadeInUp}>
      <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Wire Instructions</h2>
      <p className="text-sm text-muted-foreground mt-1">Payment destination information for all deal parties.</p>
    </motion.div>

    {/* Buyer Funding Source */}
    <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
      <div className="p-5 border-b border-border/30">
        <div className="flex items-center gap-3"><Building2 className="w-5 h-5 text-blue-500" /><h3 className="font-semibold">Buyer Funding Source</h3></div>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <FieldGroup label="Bank Name" placeholder="JPMorgan Chase" />
        <FieldGroup label="Account Holder" placeholder="Apex Capital Partners LLC" />
        <FieldGroup label="Account Number" placeholder="••••••7742" />
        <FieldGroup label="Routing Number" placeholder="021000021" />
        <FieldGroup label="SWIFT / BIC" placeholder="CHASUS33" />
        <FieldGroup label="IBAN (if applicable)" placeholder="—" />
      </div>
    </motion.div>

    {/* Seller Payment Accounts */}
    <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
      <div className="p-5 border-b border-border/30">
        <div className="flex items-center gap-3"><Landmark className="w-5 h-5 text-emerald-500" /><h3 className="font-semibold">Seller Payment Accounts</h3></div>
        <p className="text-xs text-muted-foreground ml-8 mt-1">One entry per seller / beneficiary. Allocations must sum to 100%.</p>
      </div>
      <div className="p-5 space-y-6">
        {/* Beneficiary 1 */}
        <div className="border border-border/30 rounded-lg p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">Beneficiary 1</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Beneficiary Name" placeholder="John Smith" />
            <FieldGroup label="Bank Name" placeholder="Bank of America" />
            <FieldGroup label="Account Number" placeholder="••••••1234" />
            <FieldGroup label="Routing / SWIFT" placeholder="026009593" />
            <FieldGroup label="Payment Allocation %" placeholder="45%" />
          </div>
        </div>
        {/* Beneficiary 2 */}
        <div className="border border-border/30 rounded-lg p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">Beneficiary 2</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Beneficiary Name" placeholder="Jane Doe" />
            <FieldGroup label="Bank Name" placeholder="Wells Fargo" />
            <FieldGroup label="Account Number" placeholder="••••••5678" />
            <FieldGroup label="Routing / SWIFT" placeholder="121000248" />
            <FieldGroup label="Payment Allocation %" placeholder="35%" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">Additional beneficiaries can be added from the Stakeholders tab.</p>
      </div>
    </motion.div>

    {/* Escrow Account */}
    <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
      <div className="p-5 border-b border-border/30">
        <div className="flex items-center gap-3"><Vault className="w-5 h-5 text-accent" /><h3 className="font-semibold">Escrow Account</h3></div>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <FieldGroup label="Escrow Agent" placeholder="JPMorgan Escrow Services" />
        <FieldGroup label="Escrow Bank" placeholder="JPMorgan Chase" />
        <FieldGroup label="Account Number" placeholder="FBO ••••7742" />
        <FieldGroup label="Routing Number" placeholder="021000021" />
      </div>
    </motion.div>
  </div>
);
