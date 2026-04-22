import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gavel,
  Loader2,
  Plus,
  ShieldAlert,
  TimerReset,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type RegulatoryCondition = Tables<'regulatory_conditions'>;
type DealMember = Tables<'deal_members'>;

type RegulatoryStatus = RegulatoryCondition['status'];
type RegulatoryType = RegulatoryCondition['condition_type'];

const CONDITION_LABELS: Record<RegulatoryType, string> = {
  hsr: 'HSR',
  cfius: 'CFIUS',
  state_puc: 'State PUC',
  state_banking: 'State Banking',
  state_insurance: 'State Insurance',
  eu_fsr: 'EU FSR',
  uk_nsi: 'UK NSI',
  other: 'Other',
};

const STATUS_LABELS: Record<RegulatoryStatus, string> = {
  not_filed: 'Not filed',
  filed: 'Filed',
  waiting_period_active: 'Waiting period',
  early_termination_requested: 'Early termination requested',
  cleared: 'Cleared',
  second_request: 'Second request',
  withdrawn: 'Withdrawn',
};

const ACTIVE_STATUSES: RegulatoryStatus[] = ['filed', 'waiting_period_active', 'early_termination_requested', 'second_request'];

const formatDate = (value: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '—');

const differenceInDays = (date: string | null) => {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};

const getCountdownCopy = (condition: RegulatoryCondition) => {
  if (!condition.waiting_period_end || !ACTIVE_STATUSES.includes(condition.status)) return null;
  const days = differenceInDays(condition.waiting_period_end);
  if (days === null) return null;

  const label = CONDITION_LABELS[condition.condition_type];
  if (days < 0) return `${label} waiting period expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return `${label} waiting period expires today`;
  return `${label} waiting period expires in ${days} day${days === 1 ? '' : 's'}`;
};

const getPipelineStep = (status: RegulatoryStatus) => {
  if (status === 'cleared') return 3;
  if (status === 'second_request') return 2;
  if (ACTIVE_STATUSES.includes(status)) return 2;
  return 1;
};

const conditionAllowsAutoDeadline = (type: RegulatoryType) => type === 'hsr' || type === 'cfius';

const emptyCreateState = {
  conditionType: 'hsr' as RegulatoryType,
  status: 'not_filed' as RegulatoryStatus,
  filedAt: '',
  waitingPeriodEnd: '',
  assignedTo: 'unassigned',
  notes: '',
};

const emptyUpdateState = {
  status: 'waiting_period_active' as RegulatoryStatus,
  filedAt: '',
  waitingPeriodEnd: '',
  notes: '',
  earlyTerminationGrantedAt: '',
};

export const RegulatoryConditionsPanel: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { user } = useAuth();
  const [conditions, setConditions] = useState<RegulatoryCondition[]>([]);
  const [members, setMembers] = useState<DealMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<RegulatoryCondition | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateState);
  const [updateForm, setUpdateForm] = useState(emptyUpdateState);

  const loadData = useCallback(async () => {
    if (!dealId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [conditionsRes, membersRes] = await Promise.all([
      supabase
        .from('regulatory_conditions')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      supabase
        .from('deal_members')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true }),
    ]);

    if (conditionsRes.error) toast.error(conditionsRes.error.message || 'Failed to load regulatory conditions');
    if (membersRes.error) toast.error(membersRes.error.message || 'Failed to load assignees');

    setConditions((conditionsRes.data || []) as RegulatoryCondition[]);
    setMembers((membersRes.data || []) as DealMember[]);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!dealId) return;

    const channel = supabase
      .channel(`regulatory-conditions-${dealId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'regulatory_conditions', filter: `deal_id=eq.${dealId}` }, () => {
        void loadData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dealId, loadData]);

  const memberOptions = useMemo(
    () => members.map((member) => ({ id: member.id, label: member.role.replace(/_/g, ' ') })),
    [members],
  );

  const activeConditions = useMemo(
    () => conditions.filter((condition) => !['cleared', 'withdrawn'].includes(condition.status)),
    [conditions],
  );

  const timelineConditions = useMemo(
    () => [...conditions].sort((a, b) => {
      const aTime = a.filed_at ? new Date(a.filed_at).getTime() : new Date(a.created_at).getTime();
      const bTime = b.filed_at ? new Date(b.filed_at).getTime() : new Date(b.created_at).getTime();
      return aTime - bTime;
    }),
    [conditions],
  );

  const createCondition = async () => {
    if (!dealId) return;
    setSaving(true);

    const payload: Tables<'regulatory_conditions'>['Insert'] = {
      deal_id: dealId,
      condition_type: createForm.conditionType,
      status: createForm.status,
      filed_at: createForm.filedAt || null,
      waiting_period_end: conditionAllowsAutoDeadline(createForm.conditionType) ? null : createForm.waitingPeriodEnd || null,
      assigned_to: createForm.assignedTo === 'unassigned' ? null : createForm.assignedTo,
      notes: createForm.notes || null,
    };

    const { error } = await supabase.from('regulatory_conditions').insert(payload);
    if (error) {
      toast.error(error.message || 'Could not create regulatory condition');
      setSaving(false);
      return;
    }

    await supabase.from('audit_log').insert({
      deal_id: dealId,
      user_id: user?.id,
      action: 'regulatory_condition_created',
      details: {
        condition_type: createForm.conditionType,
        status: createForm.status,
      },
    });

    toast.success('Regulatory condition created');
    setCreateForm(emptyCreateState);
    setCreateOpen(false);
    setSaving(false);
    void loadData();
  };

  const openUpdateDialog = (condition: RegulatoryCondition) => {
    setUpdateTarget(condition);
    setUpdateForm({
      status: condition.status,
      filedAt: condition.filed_at || '',
      waitingPeriodEnd: condition.waiting_period_end || '',
      notes: condition.notes || '',
      earlyTerminationGrantedAt: condition.early_termination_granted_at || '',
    });
  };

  const saveUpdate = async () => {
    if (!updateTarget) return;
    setSaving(true);

    const patch: Tables<'regulatory_conditions'>['Update'] = {
      status: updateForm.status,
      filed_at: updateForm.filedAt || null,
      waiting_period_end: conditionAllowsAutoDeadline(updateTarget.condition_type) ? null : updateForm.waitingPeriodEnd || null,
      notes: updateForm.notes || null,
      early_termination_granted_at: updateForm.earlyTerminationGrantedAt || null,
      cleared_at: updateForm.status === 'cleared' ? new Date().toISOString().slice(0, 10) : null,
    };

    const { error } = await supabase.from('regulatory_conditions').update(patch).eq('id', updateTarget.id);
    if (error) {
      toast.error(error.message || 'Could not save regulatory update');
      setSaving(false);
      return;
    }

    await supabase.from('audit_log').insert({
      deal_id: updateTarget.deal_id,
      user_id: user?.id,
      action: 'regulatory_condition_updated',
      details: {
        regulatory_condition_id: updateTarget.id,
        next_status: updateForm.status,
        notes: updateForm.notes,
      },
    });

    toast.success('Regulatory update logged');
    setUpdateTarget(null);
    setSaving(false);
    void loadData();
  };

  const markCleared = async (condition: RegulatoryCondition) => {
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from('regulatory_conditions')
      .update({ status: 'cleared', cleared_at: today })
      .eq('id', condition.id);

    if (error) {
      toast.error(error.message || 'Could not mark condition cleared');
      setSaving(false);
      return;
    }

    await supabase.from('audit_log').insert({
      deal_id: condition.deal_id,
      user_id: user?.id,
      action: 'regulatory_condition_cleared',
      details: {
        regulatory_condition_id: condition.id,
        condition_type: condition.condition_type,
      },
    });

    toast.success('Regulatory condition marked cleared');
    setSaving(false);
    void loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Gavel className="h-5 w-5 text-accent" />
            Regulatory Conditions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track antitrust and regulatory clearances with linked checklist completion and automatic waiting-period deadlines.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="w-full lg:w-auto">
          <Plus className="h-4 w-4" />
          Add Condition
        </Button>
      </div>

      {activeConditions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-9 w-9 text-muted-foreground" />
            <div>
              <p className="font-medium">No active regulatory conditions</p>
              <p className="mt-1 text-sm text-muted-foreground">Create HSR, CFIUS, or other closing conditions to start the deadline tracker.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {activeConditions.map((condition) => {
            const countdown = getCountdownCopy(condition);
            const daysRemaining = differenceInDays(condition.waiting_period_end);
            const warning = daysRemaining !== null && daysRemaining < 7 && daysRemaining >= 0 && ACTIVE_STATUSES.includes(condition.status);
            const overdue = daysRemaining !== null && daysRemaining < 0 && ACTIVE_STATUSES.includes(condition.status);
            const pipelineStep = getPipelineStep(condition.status);
            const earlyTerminationWindow = condition.condition_type === 'hsr' && condition.status === 'early_termination_requested' && condition.filed_at
              ? new Date(new Date(`${condition.filed_at}T00:00:00`).getTime() + 15 * 86_400_000).toISOString().slice(0, 10)
              : null;

            return (
              <Card key={condition.id} className="border-border/70">
                <CardHeader className="space-y-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{CONDITION_LABELS[condition.condition_type]}</CardTitle>
                        <Badge variant="outline">{STATUS_LABELS[condition.status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Filed {formatDate(condition.filed_at)} · Waiting period ends {formatDate(condition.waiting_period_end)}
                      </p>
                    </div>
                    {condition.status === 'cleared' ? (
                      <Badge className="bg-validated/10 text-validated">Cleared</Badge>
                    ) : null}
                  </div>

                  <div className="rounded-md border border-border/60 bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TimerReset className="h-4 w-4 text-accent" />
                      {countdown ?? 'Waiting period not active yet'}
                    </div>
                    {earlyTerminationWindow ? (
                      <p className="mt-2 text-xs text-muted-foreground">Early termination decision window: {formatDate(earlyTerminationWindow)}</p>
                    ) : null}
                    {warning ? (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-discrepancy/30 bg-discrepancy/10 px-3 py-2 text-xs text-discrepancy">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Waiting period ends within 7 days.
                      </div>
                    ) : null}
                    {overdue ? (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-blocking/30 bg-blocking/10 px-3 py-2 text-xs text-blocking">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Waiting period has expired and still needs an update.
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Filed', active: pipelineStep >= 1 },
                      { label: condition.status === 'second_request' ? 'Second Request' : 'Waiting Period', active: pipelineStep >= 2 },
                      { label: 'Cleared', active: pipelineStep >= 3 },
                    ].map((step) => (
                      <div
                        key={step.label}
                        className={`rounded-md border px-3 py-2 text-center text-xs font-medium ${step.active ? 'border-accent/30 bg-accent/10 text-foreground' : 'border-border/60 bg-muted/20 text-muted-foreground'}`}
                      >
                        {step.label}
                      </div>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned</p>
                      <p className="mt-1 font-medium">{memberOptions.find((member) => member.id === condition.assigned_to)?.label ?? 'Unassigned'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Checklist Sync</p>
                      <p className="mt-1 font-medium">{condition.checklist_item_id ? 'Linked and synced' : 'Pending link'}</p>
                    </div>
                  </div>
                  {condition.notes ? <p className="text-sm text-muted-foreground">{condition.notes}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openUpdateDialog(condition)} disabled={saving}>
                      <Clock3 className="h-4 w-4" />
                      Log Update
                    </Button>
                    {condition.status !== 'cleared' ? (
                      <Button onClick={() => markCleared(condition)} disabled={saving}>
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Cleared
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Regulatory Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timelineConditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Timeline events will appear once conditions are created.</p>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4">
                {timelineConditions.map((condition, index) => (
                  <div key={condition.id} className="flex items-start gap-4">
                    <div className="w-64 rounded-lg border border-border/70 bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{CONDITION_LABELS[condition.condition_type]}</span>
                        <Badge variant="outline">{STATUS_LABELS[condition.status]}</Badge>
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p>Filed: <span className="text-foreground">{formatDate(condition.filed_at)}</span></p>
                        <p>Waiting window: <span className="text-foreground">{formatDate(condition.waiting_period_end)}</span></p>
                        <p>Cleared: <span className="text-foreground">{formatDate(condition.cleared_at)}</span></p>
                      </div>
                    </div>
                    {index < timelineConditions.length - 1 ? <div className="mt-8 h-px w-12 bg-border" /> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create regulatory condition</DialogTitle>
            <DialogDescription>Add a tracked clearance item and automatically link it to the closing checklist.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Condition type</Label>
              <Select value={createForm.conditionType} onValueChange={(value) => setCreateForm((current) => ({ ...current, conditionType: value as RegulatoryType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={createForm.status} onValueChange={(value) => setCreateForm((current) => ({ ...current, status: value as RegulatoryStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assigned to</Label>
                <Select value={createForm.assignedTo} onValueChange={(value) => setCreateForm((current) => ({ ...current, assignedTo: value }))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {memberOptions.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Filed date</Label>
                <Input type="date" value={createForm.filedAt} onChange={(event) => setCreateForm((current) => ({ ...current, filedAt: event.target.value }))} />
              </div>
              {!conditionAllowsAutoDeadline(createForm.conditionType) ? (
                <div className="grid gap-2">
                  <Label>Waiting period end</Label>
                  <Input type="date" value={createForm.waitingPeriodEnd} onChange={(event) => setCreateForm((current) => ({ ...current, waitingPeriodEnd: event.target.value }))} />
                </div>
              ) : (
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Deadline will be calculated automatically from the filed date.
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Add filing details, counsel notes, or key instructions." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createCondition} disabled={saving}>{saving ? 'Saving…' : 'Create condition'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(updateTarget)} onOpenChange={(open) => { if (!open) setUpdateTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log regulatory update</DialogTitle>
            <DialogDescription>Record a new status update and keep the linked closing checklist in sync automatically.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={updateForm.status} onValueChange={(value) => setUpdateForm((current) => ({ ...current, status: value as RegulatoryStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Filed date</Label>
                <Input type="date" value={updateForm.filedAt} onChange={(event) => setUpdateForm((current) => ({ ...current, filedAt: event.target.value }))} />
              </div>
            </div>
            {!updateTarget || conditionAllowsAutoDeadline(updateTarget.condition_type) ? (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Waiting-period end is calculated automatically for {updateTarget ? CONDITION_LABELS[updateTarget.condition_type] : 'this condition'}.
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Waiting period end</Label>
                <Input type="date" value={updateForm.waitingPeriodEnd} onChange={(event) => setUpdateForm((current) => ({ ...current, waitingPeriodEnd: event.target.value }))} />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Early termination granted</Label>
              <Input type="date" value={updateForm.earlyTerminationGrantedAt} onChange={(event) => setUpdateForm((current) => ({ ...current, earlyTerminationGrantedAt: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={updateForm.notes} onChange={(event) => setUpdateForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Describe the latest filing, extension, agency response, or counsel guidance." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateTarget(null)}>Cancel</Button>
            <Button onClick={saveUpdate} disabled={saving}>{saving ? 'Saving…' : 'Log update'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};