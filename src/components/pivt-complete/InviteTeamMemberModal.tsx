import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTeamStore, TeamRole } from '@/stores/teamStore';
import { usePIVTStore } from '@/stores/pivtStore';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

const ROLES: TeamRole[] = [
  'Admin', 'Deal Manager', 'Finance Ops', 'Compliance',
  'Legal Counsel (Buyer)', 'Legal Counsel (Seller)', 'Viewer',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InviteTeamMemberModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { addInvite } = useTeamStore();
  const { deals } = usePIVTStore();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<TeamRole | ''>('');
  const [accessScope, setAccessScope] = useState<'company-wide' | 'specific-deals'>('company-wide');
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [inviteToken, setInviteToken] = useState('');
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail(''); setFullName(''); setRole(''); setAccessScope('company-wide');
    setSelectedDeals([]); setMessage(''); setStep('form'); setInviteToken(''); setCopied(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = () => {
    if (!email || !isValidEmail(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!role) {
      toast.error('Please select a role.');
      return;
    }
    if (accessScope === 'specific-deals' && selectedDeals.length === 0) {
      toast.error('Please select at least one deal.');
      return;
    }

    const member = addInvite({
      email,
      name: fullName || email.split('@')[0],
      role: role as TeamRole,
      accessScope,
      dealIds: accessScope === 'specific-deals' ? selectedDeals : [],
      invitedBy: 'JW (You)',
    });

    setInviteToken(member.inviteToken || '');
    setStep('success');
    toast.success(`Invite sent to ${email}.`);
  };

  const inviteUrl = `${window.location.origin}/invite?token=${inviteToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success('Invite link copied.');
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleDeal = (id: string) => {
    setSelectedDeals((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" style={{ background: 'hsl(var(--card))' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'hsl(var(--foreground))' }}>
            {step === 'form' ? 'Invite Team Member' : 'Invite Sent'}
          </DialogTitle>
          <DialogDescription>
            {step === 'form'
              ? 'Add a new member to your team with role-based access.'
              : `Invitation created for ${email}.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Role *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Access Scope *</Label>
              <Select value={accessScope} onValueChange={(v) => setAccessScope(v as 'company-wide' | 'specific-deals')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company-wide">Company-wide access</SelectItem>
                  <SelectItem value="specific-deals">Specific deals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {accessScope === 'specific-deals' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Select Deals</Label>
                {deals.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No deals found. Create a deal first or use company-wide access.</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1" style={{ borderColor: 'hsl(var(--border))' }}>
                    {deals.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-1 rounded hover:bg-muted/30">
                        <input
                          type="checkbox"
                          checked={selectedDeals.includes(d.id)}
                          onChange={() => toggleDeal(d.id)}
                          className="rounded"
                        />
                        <span className="truncate">{d.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Message (optional)</Label>
              <Textarea
                placeholder="Add a personal note..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Send Invite
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="pivt-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Share this invite link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-lg truncate font-mono">
                  {inviteUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Role:</strong> {role}</p>
              <p><strong>Access:</strong> {accessScope === 'company-wide' ? 'All deals' : `${selectedDeals.length} deal(s)`}</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
