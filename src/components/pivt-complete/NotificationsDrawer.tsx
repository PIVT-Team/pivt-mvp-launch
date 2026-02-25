import React, { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNotificationStore, NotificationType, NotificationSeverity } from '@/stores/notificationStore';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCircle2, AlertTriangle, XCircle, Info,
  FileText, Shield, CreditCard, GitCompare, UserCheck, Settings2,
  CheckCheck, Trash2,
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
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(
    () => (unreadOnly ? notifications.filter((n) => !n.read) : notifications),
    [notifications, unreadOnly]
  );

  const handleClick = (notif: (typeof notifications)[0]) => {
    markRead(notif.id);
    onOpenChange(false);
    if (notif.actionRoute) {
      navigate(notif.actionRoute);
    } else if (!notif.dealId) {
      navigate('/pivt?section=deals');
      toast.info('Select a deal to view details.');
    }
  };

  return (
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
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className="w-full text-left px-5 py-3.5 hover:bg-muted/30 transition-colors flex gap-3 items-start relative"
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
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
