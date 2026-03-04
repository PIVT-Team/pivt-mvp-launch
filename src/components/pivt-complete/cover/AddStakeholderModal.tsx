import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, DemoStakeholder } from '@/stores/pivtStore';
import { X, User, Building2, AlertTriangle, Send, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type StakeholderType = 'individual' | 'entity';

const ROLE_GROUPS = [
  { label: 'Transaction Parties', roles: ['Buyer', 'Seller', 'Target', 'Merger Sub'] },
  { label: 'Advisors & Counsel', roles: ['Buyer Counsel', 'Seller Counsel', 'Paying Agent'] },
  { label: 'Execution & Custody', roles: ['Escrow Agent', 'Lender', 'Administrative Agent'] },
  { label: 'Representatives & Signatories', roles: ['Buyer Signatory', 'Seller Signatory', 'Seller Representative', 'Target Signatory'] },
  { label: 'Ownership', roles: ['Shareholder', 'Investor', 'Founder', 'LP', 'Advisor', 'Employee'] },
] as const;
const SHARE_CLASSES = ['Common', 'Preferred A', 'Preferred B', 'Options', 'Warrants', 'Other'] as const;

interface AddStakeholderModalProps {
  open: boolean;
  onClose: () => void;
}

export const AddStakeholderModal: React.FC<AddStakeholderModalProps> = ({ open, onClose }) => {
  const { stakeholders } = usePIVTStore();
  const addStakeholder = usePIVTStore(s => s.addStakeholder);

  const [type, setType] = useState<StakeholderType>('individual');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ownership, setOwnership] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [shareClass, setShareClass] = useState('');
  const [notes, setNotes] = useState('');
  const [showKycPrompt, setShowKycPrompt] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentTotal = stakeholders.reduce((s, x) => s + x.ownershipPct, 0);
  const ownershipNum = parseFloat(ownership) || 0;
  const newTotal = currentTotal + ownershipNum;
  const exceedsMax = newTotal > 100;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const trimName = name.trim();
    const trimEmail = email.trim();

    if (!trimName || trimName.length > 200) errs.name = trimName ? 'Name must be under 200 characters' : 'Name is required';
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) errs.email = 'Valid email is required';
    if (trimEmail.length > 255) errs.email = 'Email must be under 255 characters';
    if (ownership === '' || ownershipNum < 0 || ownershipNum > 100) errs.ownership = 'Must be between 0 and 100';
    if (ownershipNum > 0 && exceedsMax) errs.ownership = `Would exceed 100% (current total: ${currentTotal}%)`;
    if (!role) errs.role = 'Role is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const newStakeholder: DemoStakeholder = {
      id: `s-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      ownershipPct: ownershipNum,
      role,
      kycStatus: 'pending',
      payoutAmount: 0,
    };

    addStakeholder(newStakeholder);
    setShowKycPrompt(true);
  };

  const resetAndClose = () => {
    setName(''); setEmail(''); setOwnership(''); setRole('');
    setPhone(''); setShareClass(''); setNotes('');
    setErrors({}); setShowKycPrompt(false); setType('individual');
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={resetAndClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="bg-card border border-border rounded-xl max-w-lg w-full mx-4 shadow-2xl overflow-hidden"
        >
          {/* KYC Prompt after creation */}
          {showKycPrompt ? (
            <div className="p-8 text-center space-y-5">
              <div className="w-12 h-12 rounded-full bg-validated/10 flex items-center justify-center mx-auto">
                <Send className="w-5 h-5 text-validated" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Stakeholder Added</h3>
                <p className="text-sm text-muted-foreground mt-1">Send KYC request now?</p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={resetAndClose}
                  className="px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
                >
                  Yes, Send Now
                </button>
                <button
                  onClick={resetAndClose}
                  className="px-5 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors border border-border"
                >
                  Later
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-semibold">Add Stakeholder</h2>
                <button onClick={resetAndClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Type Toggle */}
                <div className="flex gap-2 p-1 rounded-xl bg-muted/50">
                  {([
                    { key: 'individual' as const, label: 'Individual', icon: User },
                    { key: 'entity' as const, label: 'Entity', icon: Building2 },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setType(opt.key)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                        type === opt.key
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Required Fields */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">
                      {type === 'individual' ? 'Full Name' : 'Entity Name'} *
                    </Label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={type === 'individual' ? 'e.g. Sarah Chen' : 'e.g. Sequoia Capital Fund XIV'}
                      maxLength={200}
                      className={errors.name ? 'border-blocking' : ''}
                    />
                    {errors.name && <p className="text-[11px] text-blocking mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Email *</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      maxLength={255}
                      className={errors.email ? 'border-blocking' : ''}
                    />
                    {errors.email && <p className="text-[11px] text-blocking mt-1">{errors.email}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Ownership % *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={ownership}
                        onChange={e => setOwnership(e.target.value)}
                        placeholder="e.g. 15"
                        className={errors.ownership ? 'border-blocking' : ''}
                      />
                      {errors.ownership && <p className="text-[11px] text-blocking mt-1">{errors.ownership}</p>}
                    </div>

                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Role *</Label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className={errors.role ? 'border-blocking' : ''}>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_GROUPS.map(group => (
                            <SelectGroup key={group.label}>
                              <SelectLabel>{group.label}</SelectLabel>
                              {group.roles.map(r => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.role && <p className="text-[11px] text-blocking mt-1">{errors.role}</p>}
                    </div>
                  </div>
                </div>

                {/* Ownership Warning */}
                {ownershipNum > 0 && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
                    exceedsMax ? 'bg-blocking/10 text-blocking' :
                    newTotal < 100 ? 'bg-discrepancy/10 text-discrepancy' :
                    'bg-validated/10 text-validated'
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      {exceedsMax
                        ? `Total ownership would be ${newTotal.toFixed(2)}% — exceeds 100%`
                        : newTotal < 100
                        ? `Total ownership will be ${newTotal.toFixed(2)}% — ${(100 - newTotal).toFixed(2)}% unallocated`
                        : `Total ownership will be exactly 100%`}
                    </span>
                  </div>
                )}

                {/* Optional Fields */}
                <details className="group">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Optional fields
                  </summary>
                  <div className="mt-3 space-y-4">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Phone</Label>
                      <Input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        maxLength={30}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Share Class</Label>
                      <Select value={shareClass} onValueChange={setShareClass}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select share class" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHARE_CLASSES.map(sc => (
                            <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Notes</Label>
                      <Textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Additional context..."
                        maxLength={500}
                        rows={2}
                      />
                    </div>
                  </div>
                </details>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
                <button
                  onClick={resetAndClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={exceedsMax}
                  className="px-5 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Stakeholder
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
