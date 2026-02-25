import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useReminderStore, ReminderChannel,
  getRecipientForNotification, getDefaultMessage,
} from '@/stores/reminderStore';
import { AppNotification } from '@/stores/notificationStore';
import { toast } from 'sonner';
import { Loader2, Mail, MessageSquare, Copy } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: AppNotification | null;
}

export const SendReminderModal: React.FC<Props> = ({ open, onOpenChange, notification }) => {
  const { addReminder } = useReminderStore();
  const recipient = notification ? getRecipientForNotification(notification.type, notification.entityId) : null;

  const [channel, setChannel] = useState<ReminderChannel>('email');
  const [message, setMessage] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const [sending, setSending] = useState(false);

  // Reset message when notification changes
  React.useEffect(() => {
    if (notification) {
      setMessage(getDefaultMessage(notification.type, notification.title));
      setChannel('email');
      setIncludeContext(true);
      setSending(false);
    }
  }, [notification?.id]);

  if (!notification) return null;

  const handleSend = async () => {
    if (!recipient) {
      toast.error('No recipient found. Please add contact info in Stakeholders.');
      return;
    }

    setSending(true);

    // Simulate send delay
    await new Promise((r) => setTimeout(r, 1200));

    const finalMessage = includeContext
      ? `${message}\n\nDeal: ATLAS-2024-001\nItem: ${notification.title}\nStatus: ${notification.severity}`
      : message;

    if (channel === 'clipboard') {
      await navigator.clipboard.writeText(finalMessage);
      toast.success('Message copied to clipboard.');
    }

    addReminder({
      notificationId: notification.id,
      dealId: notification.dealId,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      channel,
      message: finalMessage,
      sentBy: 'JW (You)',
    });

    const channelLabel = channel === 'email' ? 'Email' : channel === 'slack' ? 'Slack' : 'Clipboard';
    toast.success(`Reminder sent to ${recipient.name} via ${channelLabel}.`);
    setSending(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" style={{ background: 'hsl(var(--card))' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'hsl(var(--foreground))' }}>Send Reminder</DialogTitle>
          <DialogDescription>
            Send a follow-up for: {notification.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Recipient */}
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            {recipient ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 border border-border text-sm">
                <span className="font-medium">{recipient.name}</span>
                <span className="text-muted-foreground text-xs">({recipient.email})</span>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{recipient.role}</span>
              </div>
            ) : (
              <div className="px-3 py-2.5 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
                No recipient found — add contact info in Stakeholders.
              </div>
            )}
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label className="text-xs">Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as ReminderChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Email</span>
                </SelectItem>
                <SelectItem value="slack">
                  <span className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Slack</span>
                </SelectItem>
                <SelectItem value="clipboard">
                  <span className="flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copy message</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>

          {/* Include context */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={includeContext}
              onCheckedChange={(v) => setIncludeContext(!!v)}
              id="include-context"
            />
            <label htmlFor="include-context" className="text-xs text-muted-foreground cursor-pointer">
              Include deal + item details
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !recipient}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {sending ? 'Sending...' : 'Send Reminder'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
