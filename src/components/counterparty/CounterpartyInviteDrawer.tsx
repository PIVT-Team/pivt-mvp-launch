import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'counsel', label: 'Counsel' },
  { value: 'escrow_agent', label: 'Escrow Agent' },
  { value: 'paying_agent', label: 'Paying Agent' },
  { value: 'financial_advisor', label: 'Financial Advisor' },
  { value: 'management_rep', label: 'Management Rep' },
] as const;

type RoleType = (typeof ROLE_OPTIONS)[number]['value'];

interface Props {
  dealId: string;
  dealName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LookupResponse {
  found: boolean;
  display_name?: string | null;
  firm_name?: string | null;
  role_type?: string | null;
  kyc_status?: string;
  deals_participated?: number;
  preverified?: boolean;
}

export const CounterpartyInviteDrawer: React.FC<Props> = ({ dealId, dealName, open, onOpenChange }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [roleType, setRoleType] = useState<RoleType | ''>('');
  const [message, setMessage] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    if (!open) {
      setEmail('');
      setDisplayName('');
      setFirmName('');
      setRoleType('');
      setMessage('');
      setLookup(null);
      setInviteUrl('');
      setLookupLoading(false);
      setInviteLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    if (!open || !normalized || !normalized.includes('@') || !user) {
      setLookup(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLookupLoading(true);
      const { data, error } = await supabase.functions.invoke('counterparty-identity', {
        body: { action: 'lookupByEmail', email: normalized, dealId },
      });

      if (error) {
        setLookup(null);
      } else {
        const next = (data ?? null) as LookupResponse | null;
        setLookup(next);
        if (next?.found) {
          setDisplayName((current) => current || next.display_name || '');
          setFirmName((current) => current || next.firm_name || '');
          setRoleType((current) => current || (next.role_type as RoleType | null) || '');
        }
      }

      setLookupLoading(false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [dealId, email, open, user]);

  const preverifiedMessage = useMemo(() => {
    if (!lookup?.found) return null;
    const dealCount = lookup.deals_participated ?? 0;

    if (dealCount >= 3) {
      return `✓ Pre-verified — ${lookup.firm_name || 'Known firm'} / ${lookup.display_name || email} has participated in ${dealCount} PIVT deals. No re-onboarding required.`;
    }

    return `This person has participated in ${dealCount} previous PIVT deals. Their information is pre-verified.`;
  }, [email, lookup]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied');
  };

  const submitInvite = async () => {
    const normalized = email.trim().toLowerCase();
    if (!user) {
      toast.error('Please sign in to send invitations.');
      return;
    }

    if (!normalized || !normalized.includes('@')) {
      toast.error('Enter a valid email address.');
      return;
    }

    if (!roleType) {
      toast.error('Select a counterparty role.');
      return;
    }

    setInviteLoading(true);
    const { data, error } = await supabase.functions.invoke('counterparty-identity', {
      body: {
        action: 'createInvitation',
        dealId,
        email: normalized,
        displayName: displayName.trim() || null,
        firmName: firmName.trim() || null,
        roleType,
        message: message.trim() || null,
      },
    });

    setInviteLoading(false);

    if (error || !data?.inviteUrl) {
      toast.error(error?.message || data?.error || 'Could not create invite.');
      return;
    }

    setInviteUrl(data.inviteUrl);
    toast.success('Counterparty invite created.');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-accent" />
            Invite Counterparty
          </SheetTitle>
          <SheetDescription>
            Reuse verified identity across deals and send a scoped join link for {dealName || 'this deal'}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Counterparty identity</CardTitle>
              <CardDescription>We check whether this email already has a reusable Deal Passport.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="counterparty-email">Email</Label>
                <div className="relative">
                  <Input
                    id="counterparty-email"
                    type="email"
                    placeholder="partner@firm.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  {lookupLoading && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>

              {lookup?.found && (
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Known counterparty</p>
                      <p className="text-sm text-muted-foreground mt-1">{preverifiedMessage}</p>
                    </div>
                    <Badge variant="outline" className="border-accent/30 text-accent">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      {lookup.kyc_status === 'verified' ? 'Verified' : 'Known'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <p className="text-foreground font-medium">Profile</p>
                      <p>{lookup.display_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-foreground font-medium">Firm</p>
                      <p>{lookup.firm_name || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {!lookupLoading && lookup && !lookup.found && email.trim().includes('@') && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  No existing Deal Passport found. We’ll send a scoped signup link and create one during onboarding.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="counterparty-name">Display name</Label>
                  <Input
                    id="counterparty-name"
                    placeholder="Jordan Blake"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="counterparty-firm">Firm</Label>
                  <Input
                    id="counterparty-firm"
                    placeholder="Latham & Watkins"
                    value={firmName}
                    onChange={(event) => setFirmName(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={roleType} onValueChange={(value) => setRoleType(value as RoleType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select counterparty role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="counterparty-message">Message</Label>
                <Textarea
                  id="counterparty-message"
                  placeholder="Optional onboarding note for the invitee"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </div>

              <Button onClick={submitInvite} className="w-full" disabled={inviteLoading}>
                {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Create join link
              </Button>
            </CardContent>
          </Card>

          {inviteUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-validated" />
                  Join link ready
                </CardTitle>
                <CardDescription>Share this secure onboarding link with the counterparty.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono break-all">
                  {inviteUrl}
                </div>
                <Button variant="outline" className="w-full" onClick={copyLink}>
                  Copy join link
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};