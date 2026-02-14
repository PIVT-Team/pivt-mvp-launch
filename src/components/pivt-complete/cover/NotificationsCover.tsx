import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Bell, CheckCircle2, AlertTriangle, FileCheck, Send, Shield, Clock, DollarSign, Upload,
  Settings, Filter, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const NOTIFICATIONS = [
  { id: '1', type: 'approval', title: 'Approval Required', message: 'Waterfall Schedule v3 requires your approval for Project ATLAS', time: '2 min ago', read: false, priority: 'critical' as const },
  { id: '2', type: 'payment', title: 'Payment Executed', message: 'Wire of $224M to Tiger Global Management completed successfully', time: '15 min ago', read: false, priority: 'high' as const },
  { id: '3', type: 'kyc', title: 'KYC Status Change', message: 'GIC Private Limited KYC verification failed — action required', time: '1 hr ago', read: false, priority: 'critical' as const },
  { id: '4', type: 'document', title: 'Document Uploaded', message: 'Escrow Agreement amendment uploaded by Seller Counsel', time: '2 hr ago', read: true, priority: 'low' as const },
  { id: '5', type: 'deal', title: 'Deal Created', message: 'Project CIPHER has been created by Titan Strategic Group', time: '3 hr ago', read: true, priority: 'low' as const },
  { id: '6', type: 'approval', title: 'Buyer-Side Approval', message: 'Buyer Counsel submitted approval for Project ATLAS payout', time: '5 hr ago', read: true, priority: 'medium' as const },
  { id: '7', type: 'escrow', title: 'Escrow Funded', message: '$280M deposited into escrow for Project ATLAS', time: '1 day ago', read: true, priority: 'high' as const },
  { id: '8', type: 'wire', title: 'Wire Instructions Updated', message: 'Index Ventures updated IBAN for Project CIPHER', time: '1 day ago', read: true, priority: 'medium' as const },
  { id: '9', type: 'system', title: 'System Health', message: 'All systems operational — 99.9% uptime last 30 days', time: '2 days ago', read: true, priority: 'low' as const },
];

const typeIcons: Record<string, React.ElementType> = {
  approval: Send, payment: DollarSign, kyc: Shield, document: FileCheck,
  deal: CheckCircle2, escrow: Shield, wire: AlertTriangle, system: Settings,
};

const priorityColors = {
  critical: 'bg-blocking/10 text-blocking border-blocking/20',
  high: 'bg-discrepancy/10 text-discrepancy border-discrepancy/20',
  medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  low: 'bg-muted text-muted-foreground border-border',
};

export const NotificationsCover: React.FC = () => {
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'critical') return n.priority === 'critical' || n.priority === 'high';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Notifications</h2>
          {unreadCount > 0 && <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">{unreadCount} unread</Badge>}
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={markAllRead} disabled={unreadCount === 0}>
          <Check className="mr-1 h-3 w-3" />Mark all read
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" className="text-xs">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread" className="text-xs">Unread ({unreadCount})</TabsTrigger>
          <TabsTrigger value="critical" className="text-xs">Critical ({notifications.filter(n => n.priority === 'critical' || n.priority === 'high').length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.map((notification) => {
          const Icon = typeIcons[notification.type] || Bell;
          return (
            <motion.div
              key={notification.id}
              {...fadeInUp}
              onClick={() => markRead(notification.id)}
              className={`pivt-card p-4 flex items-start gap-4 cursor-pointer transition-colors hover:bg-muted/30 ${!notification.read ? 'border-l-4 border-l-accent bg-accent/5' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notification.read ? 'bg-muted' : 'bg-accent/10'}`}>
                <Icon className={`w-4 h-4 ${notification.read ? 'text-muted-foreground' : 'text-accent'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm ${notification.read ? 'font-medium' : 'font-semibold'}`}>{notification.title}</span>
                  <Badge variant="outline" className={`text-[10px] ${priorityColors[notification.priority]}`}>{notification.priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{notification.message}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{notification.time}</span>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="pivt-card p-12 text-center">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No notifications to show</p>
        </div>
      )}
    </div>
  );
};
