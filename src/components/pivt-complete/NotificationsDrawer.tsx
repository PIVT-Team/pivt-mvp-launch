import React, { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNotificationStore, NotificationType, NotificationSeverity, AppNotification } from '@/stores/notificationStore';
import { useReminderStore, REMINDER_ELIGIBLE_TYPES, isActionable } from '@/stores/reminderStore';
import { SendReminderModal } from './SendReminderModal';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCircle2, AlertTriangle, XCircle, Info,
  FileText, Shield, CreditCard, GitCompare, UserCheck, Settings2,
  CheckCheck, Trash2, Send,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const severityConfig: Record<NotificationSeverity, { icon: React.ElementType; color: string }> = {
  info: { icon: Info, color: 'text-blue-500' },
  success: { icon: CheckCircle2, color: 'text-emerald-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  error: { icon: XCircle, color: 'text-red-500' },
};

const typeConfig: Record<NotificationType, { icon: React.ElementType; label: string; badgeClass: string }> = {
  KYC: { icon: UserCheck, label: 'KYC', badgeClass: 'bg-purple-100 text-purple-700' },
  Payment: { icon: CreditCard, label: 'Payment', badgeClass: 'bg-emerald-100 text-emerald-700' },
  Document: { icon: FileText, label: 'Document', badgeClass: 'bg-blue-100 text-blue-700' },
  Discrepancy: { icon: GitCompare, label: 'Discrepancy', badgeClass: 'bg-amber-100 text-amber-700' },
  Approval: { icon: Shield, label: 'Approval', badgeClass: 'bg-orange-100 text-orange-700' },
  System: { icon: Settings2, label: 'System', badgeClass: 'bg-gray-100 text-gray-700' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationsDrawer: React.FC<Props> = ({ open, onOpenChange }) => {
  const { notifications, markRead, markAllRead, clearAll } = useNotificationStore();
  const { getRemindersForNotification } = useReminderStore();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<AppNotification | null>(null);

  const filtered = useMemo(
    () => (unreadOnly ? notifications.filter((n) => !n.read) : notifications),
    [notifications, unreadOnly]
  );

  const handleClick = (notif: AppNotification) => {
    markRead(notif.id);
    onOpenChange(false);
    if (notif.actionRoute) {
      navigate(notif.actionRoute);
    } else if (!notif.dealId) {
      navigate('/pivt?section=deals');
      toast.info('Select a deal to view details.');
    }
  };

  const canRemind = (notif: AppNotification) =>
    REMINDER_ELIGIBLE_TYPES.has(notif.type) && isActionable(notif.title, notif.severity);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col" style={{ background: 'hsl(var(--card))' }}>
          <SheetHeader className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                Notifications
              </SheetTitle>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { markAllRead(); toast.success('All marked as read'); }}
                  className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { clearAll(); toast('Notifications cleared'); }}
                  className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} className="scale-75" />
              <span className="text-xs text-muted-foreground">Unread only</span>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bell className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'hsl(var(--border))' }}>
                {filtered.map((notif) => {
                  const sev = severityConfig[notif.severity];
                  const typ = typeConfig[notif.type];
                  const SevIcon = sev.icon;
                  const showReminder = canRemind(notif);
                  const reminders = getRemindersForNotification(notif.id);
                  const lastReminder = reminders[0];

                  return (
                    <div key={notif.id} className="relative hover:bg-muted/30 transition-colors">
                      <button
                        onClick={() => handleClick(notif)}
                        className="w-full text-left px-5 py-3.5 flex gap-3 items-start"
                      >
                        {!notif.read && (
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                        <div className={`mt-0.5 shrink-0 ${sev.color}`}>
                          <SevIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[13px] font-medium ${notif.read ? 'text-muted-foreground' : ''}`} style={{ color: notif.read ? undefined : 'hsl(var(--foreground))' }}>
                              {notif.title}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typ.badgeClass}`}>
                              {typ.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{notif.description}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(notif.createdAt)}</p>
                        </div>
                      </button>

                      {/* Send Reminder row */}
                      {showReminder && (
                        <div className="px-5 pb-3 flex items-center gap-2 -mt-1">
                          <div className="w-4 shrink-0" /> {/* icon spacer */}
                          {lastReminder ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-[10px] text-validated flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Sent {timeAgo(lastReminder.sentAt)}
                              </span>
                              {reminders.length > 1 && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({reminders.length} reminders)
                                </span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setReminderTarget(notif); }}
                                className="text-[11px] text-accent hover:underline ml-1"
                              >
                                Send again
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setReminderTarget(notif); }}
                              className="flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 transition-colors font-medium"
                            >
                              <Send className="w-3 h-3" />
                              Send Reminder
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <SendReminderModal
        open={!!reminderTarget}
        onOpenChange={(v) => { if (!v) setReminderTarget(null); }}
        notification={reminderTarget}
      />
    </>
  );
};
