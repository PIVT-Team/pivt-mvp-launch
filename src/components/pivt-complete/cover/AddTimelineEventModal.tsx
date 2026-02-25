import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { usePIVTStore } from '@/stores/pivtStore';
import { useTimelineStore, EventCategory } from '@/stores/timelineStore';
import { useAuditStore } from '@/stores/auditStore';
import { Plus } from 'lucide-react';

const EVENT_TYPES: { value: EventCategory; label: string }[] = [
  { value: 'milestone', label: 'Milestone' },
  { value: 'note', label: 'Note' },
  { value: 'document', label: 'Document' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'approval', label: 'Approval' },
  { value: 'payment', label: 'Payment' },
  { value: 'system', label: 'System Event' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDealId?: string;
}

export const AddTimelineEventModal: React.FC<Props> = ({ open, onClose, defaultDealId }) => {
  const deals = usePIVTStore(s => s.deals);
  const addEvent = useTimelineStore(s => s.addEvent);
  const addAuditEvent = useAuditStore(s => s.addEvent);

  const [dealId, setDealId] = useState(defaultDealId || 'atlas');
  const [category, setCategory] = useState<EventCategory>('milestone');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'internal' | 'external'>('internal');

  const handleSubmit = () => {
    if (!title.trim()) return;
    const deal = deals.find(d => d.id === dealId);
    addEvent({
      dealId,
      dealName: deal?.name || dealId,
      actorId: 'current-user',
      actorName: 'Joanna Walsh',
      actorRole: 'Admin',
      actorType: 'user',
      eventCategory: category,
      title: title.trim(),
      description: description.trim(),
      relatedObjects: [],
      attachments: [],
      severity: 'info',
      visibility,
    });
    addAuditEvent({
      deal_id: dealId,
      actor_type: 'User',
      actor_id: 'current-user',
      actor_display_name: 'Joanna Walsh',
      actor_role: 'Admin',
      action: 'TIMELINE_EVENT_CREATED',
      object_type: 'Deal',
      object_id: dealId,
      severity: 'info',
      summary: `Created timeline event "${title}" on ${deal?.name || dealId}`,
      before_state: null,
      after_state: null,
      source: 'UI',
      ip_address: null,
      user_agent: null,
      correlation_id: null,
      category: 'user',
    });
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent" />
            Add Timeline Event
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Deal</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {deals.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Board approval received" />
          </div>
          <div className="space-y-1.5">
            <Label>Details</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as 'internal' | 'external')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>Add Event</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
