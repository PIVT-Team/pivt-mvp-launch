/**
 * Timeline Cover - Global "My Timeline" + deal drill-down
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { useTimelineStore, TimelineEvent, EventCategory } from '@/stores/timelineStore';
import { useAuditStore } from '@/stores/auditStore';
import { AddTimelineEventModal } from './AddTimelineEventModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Clock, Plus, Search, Download, FileText, UserCheck, CreditCard,
  Shield, AlertTriangle, Send, Activity, Plug, Bell, BarChart3,
  Flag, MoreVertical, Paperclip, ExternalLink, Copy,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, formatDistanceToNow } from 'date-fns';

// Category config
const CATEGORY_CONFIG: Record<EventCategory, { icon: React.ElementType; colorClass: string; label: string }> = {
  milestone: { icon: Flag, colorClass: 'text-accent', label: 'Milestones' },
  document: { icon: FileText, colorClass: 'text-validated', label: 'Documents' },
  payment: { icon: CreditCard, colorClass: 'text-accent/70', label: 'Payments' },
  approval: { icon: Send, colorClass: 'text-amber-400', label: 'Approvals' },
  compliance: { icon: UserCheck, colorClass: 'text-cyan-400', label: 'Compliance' },
  discrepancy: { icon: AlertTriangle, colorClass: 'text-blocking', label: 'Discrepancies' },
  integration: { icon: Plug, colorClass: 'text-violet-400', label: 'Integrations' },
  system: { icon: Activity, colorClass: 'text-muted-foreground', label: 'System' },
  reminder: { icon: Bell, colorClass: 'text-discrepancy', label: 'Reminders' },
  report: { icon: BarChart3, colorClass: 'text-validated', label: 'Reports' },
  note: { icon: FileText, colorClass: 'text-muted-foreground', label: 'Notes' },
};

const FILTER_CHIPS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'document', label: 'Documents' },
  { value: 'payment', label: 'Payments' },
  { value: 'approval', label: 'Approvals' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'discrepancy', label: 'Discrepancies' },
  { value: 'integration', label: 'Integrations' },
];

export const TimelineCover: React.FC = () => {
  const deals = usePIVTStore(s => s.deals);
  const { setActiveSection, setSelectedDealId } = usePIVTStore();
  const events = useTimelineStore(s => s.events);
  const allEvents = useMemo(() => [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [events]);
  const addAuditEvent = useAuditStore(s => s.addEvent);

  const [dealFilter, setDealFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);

  const selectedDeal = dealFilter !== 'all' ? deals.find(d => d.id === dealFilter) : null;

  const filteredEvents = useMemo(() => {
    let events = allEvents;
    if (dealFilter !== 'all') events = events.filter(e => e.dealId === dealFilter);
    if (categoryFilter !== 'all') events = events.filter(e => e.eventCategory === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q) ||
        e.dealName.toLowerCase().includes(q)
      );
    }
    return events;
  }, [allEvents, dealFilter, categoryFilter, searchQuery]);

  const handleClickRelated = (obj: { type: string; id: string }) => {
    // Navigate to the relevant section based on object type
    switch (obj.type) {
      case 'document':
        if (dealFilter !== 'all') setSelectedDealId(dealFilter);
        setActiveSection('workspace');
        break;
      case 'stakeholder':
        if (dealFilter !== 'all') setSelectedDealId(dealFilter);
        setActiveSection('workspace');
        break;
      case 'payment':
      case 'escrow':
        if (dealFilter !== 'all') setSelectedDealId(dealFilter);
        setActiveSection('workspace');
        break;
      case 'approval':
        if (dealFilter !== 'all') setSelectedDealId(dealFilter);
        setActiveSection('workspace');
        break;
      case 'deal':
        setDealFilter(obj.id);
        break;
      case 'discrepancy':
        if (dealFilter !== 'all') setSelectedDealId(dealFilter);
        setActiveSection('workspace');
        break;
    }
  };

  const handleDealNameClick = (dealId: string) => {
    setDealFilter(dealId);
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Deal', 'Actor', 'Category', 'Title', 'Description', 'Severity'].join(','),
      ...filteredEvents.map(e =>
        [
          format(new Date(e.timestamp), 'yyyy-MM-dd HH:mm'),
          `"${e.dealName}"`,
          `"${e.actorName}"`,
          e.eventCategory,
          `"${e.title}"`,
          `"${e.description}"`,
          e.severity,
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addAuditEvent({
      deal_id: null,
      actor_type: 'User',
      actor_id: 'current-user',
      actor_display_name: 'Joanna Walsh',
      actor_role: 'Admin',
      action: 'TIMELINE_EXPORTED',
      object_type: 'Report',
      object_id: null,
      severity: 'info',
      summary: `Exported ${filteredEvents.length} timeline events as CSV`,
      before_state: null,
      after_state: null,
      source: 'UI',
      ip_address: null,
      user_agent: null,
      correlation_id: null,
      category: 'user',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedDeal ? `${selectedDeal.name} Timeline` : 'My Timeline'}
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            {selectedDeal
              ? `${selectedDeal.targetCompany} · $${(selectedDeal.consideration / 1e6).toFixed(0)}M · Closing ${selectedDeal.closingDate} · ${selectedDeal.readyToPayPercent}% ready`
              : 'Activity across all your deals'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={dealFilter} onValueChange={setDealFilter}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="All Deals" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deals</SelectItem>
            {deals.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Category filter chips */}
      <div
        className="flex flex-nowrap gap-3 p-3 rounded-2xl w-full overflow-x-auto"
        style={{
          background: 'rgba(20, 15, 45, 0.4)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {FILTER_CHIPS.map(chip => {
          const isActive = categoryFilter === chip.value;
          return (
            <motion.button
              key={chip.value}
              onClick={() => setCategoryFilter(chip.value)}
              className="relative flex items-center gap-1.5 rounded-full font-medium transition-all duration-200 outline-none whitespace-nowrap flex-shrink-0"
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FFFFFF' : '#E3DBFF',
                background: isActive
                  ? 'linear-gradient(135deg, #5B3DF5 0%, #7C3AED 40%, #9333EA 100%)'
                  : 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(168,85,247,0.05))',
                border: isActive
                  ? '1px solid rgba(168, 85, 247, 0.6)'
                  : '1px solid rgba(124, 58, 237, 0.25)',
                boxShadow: isActive
                  ? '0 6px 18px rgba(124, 58, 237, 0.35)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                transform: isActive ? 'scale(1.04)' : 'scale(1)',
              }}
              whileHover={!isActive ? {
                background: 'rgba(124, 58, 237, 0.16)',
                color: '#FFFFFF',
                y: -1,
                scale: 1.02,
              } : {}}
              whileTap={{ scale: 0.98 }}
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                  style={{ opacity: 0.15 }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                      width: '200%',
                    }}
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.div>
              )}
              <span className="relative z-10">{chip.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Event count */}
      <p className="text-sm text-muted-foreground">{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}</p>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
        <div className="space-y-0">
          <AnimatePresence initial={false}>
            {filteredEvents.map((event, i) => (
              <EventCard
                key={event.id}
                event={event}
                index={i}
                showDealName={dealFilter === 'all'}
                onDealClick={handleDealNameClick}
                onRelatedClick={handleClickRelated}
              />
            ))}
          </AnimatePresence>
          {filteredEvents.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No events match your filters.
            </div>
          )}
        </div>
      </div>

      <AddTimelineEventModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        defaultDealId={dealFilter !== 'all' ? dealFilter : undefined}
      />
    </div>
  );
};

// ── Event Card ──
interface EventCardProps {
  event: TimelineEvent;
  index: number;
  showDealName: boolean;
  onDealClick: (dealId: string) => void;
  onRelatedClick: (obj: { type: string; id: string }) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, index, showDealName, onDealClick, onRelatedClick }) => {
  const config = CATEGORY_CONFIG[event.eventCategory] || CATEGORY_CONFIG.system;
  const Icon = config.icon;
  const ts = new Date(event.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="relative flex items-start gap-3 py-3 group"
    >
      {/* Dot */}
      <div className={`relative z-10 w-[38px] h-[38px] rounded-full border flex items-center justify-center shrink-0 ${
        event.severity === 'error'
          ? 'border-blocking/30 bg-blocking/10'
          : event.severity === 'warning'
            ? 'border-discrepancy/30 bg-discrepancy/10'
            : 'border-border bg-card'
      }`}>
        <Icon className={`w-4 h-4 ${
          event.severity === 'error' ? 'text-blocking' :
          event.severity === 'warning' ? 'text-discrepancy' :
          config.colorClass
        }`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 bg-card border border-border rounded-lg px-5 py-4 hover:border-accent/20 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold">{event.title}</span>
              {event.severity !== 'info' && (
                <Badge variant={event.severity === 'error' ? 'destructive' : 'outline'} className="text-xs h-5">
                  {event.severity}
                </Badge>
              )}
              {event.visibility === 'external' && (
                <Badge variant="outline" className="text-xs h-5 border-accent/30 text-accent">
                  External
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap" title={format(ts, 'PPpp')}>
              {formatDistanceToNow(ts, { addSuffix: true })}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem className="text-sm">
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />View details
                </DropdownMenuItem>
                <DropdownMenuItem className="text-sm" onClick={() => navigator.clipboard.writeText(`${event.title}: ${event.description}`)}>
                  <Copy className="w-3.5 h-3.5 mr-2" />Copy link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {/* Actor */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[11px] font-bold text-accent">
              {event.actorName.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <span className="text-sm text-muted-foreground">{event.actorName}</span>
          </div>

          {/* Deal name (global view) */}
          {showDealName && (
            <button
              onClick={() => onDealClick(event.dealId)}
              className="text-sm text-accent hover:underline"
            >
              {event.dealName}
            </button>
          )}

          {/* Related objects */}
          {event.relatedObjects.map((obj, i) => (
            <button
              key={i}
              onClick={() => onRelatedClick(obj)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/50 border border-border text-sm text-foreground hover:border-accent/30 hover:text-accent transition-colors"
            >
              {obj.label}
            </button>
          ))}

          {/* Attachments */}
          {event.attachments.map((att, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-sm text-accent">
              <Paperclip className="w-3.5 h-3.5" />
              {att.name}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
