import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Building2, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AiConfidenceBadge } from '@/components/AiConfidenceBadge';
import { hasMeaningfulChange, isAiDerivedRecord, recordFieldCorrections } from '@/lib/fieldCorrections';
import { FieldHistoryButton } from './FieldHistoryButton';

type StakeholderType = 'individual' | 'entity';

const ROLE_GROUPS = [
  { label: 'Transaction Parties', roles: ['Buyer', 'Seller', 'Target', 'Merger Sub'] },
  { label: 'Advisors & Counsel', roles: ['Buyer Counsel', 'Seller Counsel', 'Paying Agent'] },
  { label: 'Execution & Custody', roles: ['Escrow Agent', 'Lender', 'Administrative Agent'] },
  { label: 'Representatives & Signatories', roles: ['Buyer Signatory', 'Seller Signatory', 'Seller Representative', 'Target Signatory'] },
  { label: 'Ownership', roles: ['Shareholder', 'Investor', 'Founder', 'LP', 'Advisor', 'Employee'] },
] as const;

interface StakeholderData {
  id: string;
  shareholder_name: string;
  email: string | null;
  role: string;
  stakeholder_type: string;
  ownership_pct: number;
  payout_amount: number;
  created_by_source?: string;
  confidence_status?: string;
  ai_confidence?: number | null;
  locked?: boolean;
  locked_reason?: string | null;
}

interface EditStakeholderModalProps {
  open: boolean;
  onClose: () => void;
  stakeholder: StakeholderData | null;
  dealId?: string;
  onUpdated?: () => void;
}

export const EditStakeholderModal: React.FC<EditStakeholderModalProps> = ({ open, onClose, stakeholder, dealId, onUpdated }) => {
  const { user } = useAuth();
  const [type, setType] = useState<StakeholderType>('individual');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ownership, setOwnership] = useState('');
  const [payout, setPayout] = useState('');
  const [role, setRole] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isLocked = stakeholder?.locked === true;
  const isAiDerived = isAiDerivedRecord(stakeholder?.created_by_source, stakeholder?.confidence_status);

  useEffect(() => {
    if (stakeholder && open) {
      setType(stakeholder.stakeholder_type === 'entity' ? 'entity' : 'individual');
      setName(stakeholder.shareholder_name);
      setEmail(stakeholder.email || '');
      setOwnership(String(stakeholder.ownership_pct));
      setPayout(String(stakeholder.payout_amount));
      setRole(stakeholder.role);
      setErrors({});
    }
  }, [stakeholder, open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Valid email is required';
    if (!role) errs.role = 'Role is required';
    const ownershipNum = parseFloat(ownership);
    if (isNaN(ownershipNum) || ownershipNum < 0 || ownershipNum > 100) errs.ownership = 'Must be 0–100';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !stakeholder || !dealId) return;
    if (isLocked) {
      toast.error(`This record is locked: ${stakeholder.locked_reason || 'downstream workflow step'}`);
      return;
    }
    setSaving(true);

    const wasNewtonCreated = stakeholder.created_by_source === 'newton' || stakeholder.created_by_source === 'agent';
    const corrections = isAiDerived ? [
      hasMeaningfulChange(stakeholder.shareholder_name, name) ? {
        tableName: 'cap_table_entries',
        recordId: stakeholder.id,
        fieldName: 'shareholder_name',
        aiOutput: stakeholder.shareholder_name,
        humanCorrection: name.trim(),
        aiConfidence: stakeholder.ai_confidence ?? null,
      } : null,
      hasMeaningfulChange(stakeholder.email, email) ? {
        tableName: 'cap_table_entries',
        recordId: stakeholder.id,
        fieldName: 'email',
        aiOutput: stakeholder.email,
        humanCorrection: email.trim(),
        aiConfidence: stakeholder.ai_confidence ?? null,
      } : null,
      hasMeaningfulChange(stakeholder.role, role) ? {
        tableName: 'cap_table_entries',
        recordId: stakeholder.id,
        fieldName: 'role',
        aiOutput: stakeholder.role,
        humanCorrection: role,
        aiConfidence: stakeholder.ai_confidence ?? null,
      } : null,
      hasMeaningfulChange(stakeholder.ownership_pct, parseFloat(ownership) || 0) ? {
        tableName: 'cap_table_entries',
        recordId: stakeholder.id,
        fieldName: 'ownership_pct',
        aiOutput: stakeholder.ownership_pct,
        humanCorrection: parseFloat(ownership) || 0,
        aiConfidence: stakeholder.ai_confidence ?? null,
      } : null,
      hasMeaningfulChange(stakeholder.payout_amount, parseFloat(payout) || 0) ? {
        tableName: 'cap_table_entries',
        recordId: stakeholder.id,
        fieldName: 'payout_amount',
        aiOutput: stakeholder.payout_amount,
        humanCorrection: parseFloat(payout) || 0,
        aiConfidence: stakeholder.ai_confidence ?? null,
      } : null,
      hasMeaningfulChange(stakeholder.stakeholder_type, type) ? {
        tableName: 'cap_table_entries',
        recordId: stakeholder.id,
        fieldName: 'stakeholder_type',
        aiOutput: stakeholder.stakeholder_type,
        humanCorrection: type,
        aiConfidence: stakeholder.ai_confidence ?? null,
      } : null,
    ].filter(Boolean) : [];

    if (corrections.length > 0) {
      try {
        await recordFieldCorrections(corrections);
        toast.success('Correction saved — helping PIVT learn');
      } catch (correctionError: any) {
        setSaving(false);
        toast.error(`Failed to save correction: ${correctionError.message}`);
        return;
      }
    }

    const { error } = await supabase
      .from('cap_table_entries')
      .update({
        shareholder_name: name.trim(),
        email: email.trim(),
        role,
        stakeholder_type: type,
        ownership_pct: parseFloat(ownership) || 0,
        payout_amount: parseFloat(payout) || 0,
        last_updated_by_source: 'manual',
        last_updated_by_user_id: user?.id || null,
        needs_review: false, // User has reviewed by editing
        confidence_status: corrections.length > 0 ? 'human_verified' : stakeholder.confidence_status,
      })
      .eq('id', stakeholder.id);

    if (error) {
      toast.error(`Failed to update stakeholder: ${error.message}`);
    } else {
      // Log manual edit of Newton-created record
      if (wasNewtonCreated && user?.id) {
        await supabase.from('audit_log').insert({
          deal_id: dealId,
          user_id: user.id,
          action: 'newton_record_manually_edited',
          details: {
            entity_type: 'cap_table_entries',
            entity_id: stakeholder.id,
            original_source: stakeholder.created_by_source,
            edited_fields: ['shareholder_name', 'email', 'role', 'stakeholder_type', 'ownership_pct', 'payout_amount'],
          },
        });
      }
      toast.success('Stakeholder updated');
      onUpdated?.();
      onClose();
    }
    setSaving(false);
  };

  if (!open || !stakeholder) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold">Edit Stakeholder</h2>
              {isLocked && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Lock className="w-3 h-3" /> {stakeholder.locked_reason || 'Locked by downstream workflow'}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <div className="p-5 space-y-5">
            {/* Type selector */}
            <div className="flex gap-2">
              {(['individual', 'entity'] as StakeholderType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                    type === t ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t === 'individual' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  {t === 'individual' ? 'Individual' : 'Entity'}
                </button>
              ))}
            </div>

            {/* Name */}
             <div className="space-y-1.5 group">
                <Label className="text-xs flex items-center gap-2">{type === 'entity' ? 'Entity Name' : 'Full Legal Name'}{isAiDerived && <AiConfidenceBadge aiConfidence={stakeholder.ai_confidence} />}<FieldHistoryButton tableName="cap_table_entries" recordId={stakeholder.id} fieldName="shareholder_name" fieldLabel={type === 'entity' ? 'Entity Name' : 'Full Legal Name'} currentValue={name} /></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'entity' ? 'Acme Holdings LLC' : 'John Smith'} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Email */}
             <div className="space-y-1.5 group">
                <Label className="text-xs flex items-center gap-2">Email{isAiDerived && <AiConfidenceBadge aiConfidence={stakeholder.ai_confidence} />}<FieldHistoryButton tableName="cap_table_entries" recordId={stakeholder.id} fieldName="email" fieldLabel="Email" currentValue={email} /></Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
               <Label className="text-xs flex items-center gap-2">Role{isAiDerived && <AiConfidenceBadge aiConfidence={stakeholder.ai_confidence} />}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent className="z-[110]">
                  {ROLE_GROUPS.map(g => (
                    <SelectGroup key={g.label}>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</SelectLabel>
                      {g.roles.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
            </div>

            {/* Ownership + Payout row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                 <Label className="text-xs flex items-center gap-2">Ownership %{isAiDerived && <AiConfidenceBadge aiConfidence={stakeholder.ai_confidence} />}</Label>
                <Input type="number" min={0} max={100} step={0.01} value={ownership} onChange={(e) => setOwnership(e.target.value)} />
                {errors.ownership && <p className="text-xs text-destructive">{errors.ownership}</p>}
              </div>
              <div className="space-y-1.5">
                 <Label className="text-xs flex items-center gap-2">Payout Amount ($){isAiDerived && <AiConfidenceBadge aiConfidence={stakeholder.ai_confidence} />}</Label>
                <Input type="number" min={0} value={payout} onChange={(e) => setPayout(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-5 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
