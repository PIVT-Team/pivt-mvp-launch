import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Bell, Clock, MessageSquare, CheckCircle2, AlertTriangle, XCircle, Info,
  FileText, Users, CreditCard, Shield, Filter, Inbox, Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WorkflowActivityFeed } from './WorkflowActivityFeed';

type ActivityView = 'orchestration' | 'timeline' | 'discussions';

const categoryConfig = {
  success: { icon: CheckCircle2, color: 'text-validated', bg: 'bg-validated/10', border: 'border-validated/20' },
  warning: { icon: AlertTriangle, color: 'text-discrepancy', bg: 'bg-discrepancy/10', border: 'border-discrepancy/20' },
  error: { icon: XCircle, color: 'text-blocking', bg: 'bg-blocking/10', border: 'border-blocking/20' },
  info: { icon: Info, color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
};

interface TimelineEntry {
  id: string;
  action: string;
  actor: string;
  time: string;
  category: string;
}

interface Discussion {
  id: string;
  section_context: string | null;
  body: string;
  author_user_id: string;
  created_at: string;
  reply_count: number;
}

const objectIcons: Record<string, React.ElementType> = {
  Discrepancy: AlertTriangle,
  Document: FileText,
  Stakeholder: Users,
  Approval: CheckCircle2,
  'Cap Table': CreditCard,
};

function mapEventToCategory(eventType: string): string {
  if (eventType.includes('approval') || eventType.includes('APPROV')) return 'approval';
  if (eventType.includes('document') || eventType.includes('DOC') || eventType.includes('upload')) return 'document';
  if (eventType.includes('payment') || eventType.includes('wire') || eventType.includes('PAYMENT')) return 'payment';
  if (eventType.includes('kyc') || eventType.includes('compliance') || eventType.includes('VERIF')) return 'compliance';
  if (eventType.includes('escrow')) return 'escrow';
  if (eventType.includes('reconcil') || eventType.includes('discrep')) return 'reconciliation';
  return 'deal';
}

export const DealActivityCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [view, setView] = useState<ActivityView>('orchestration');
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);

    // Fetch deal_events + audit_log in parallel
    Promise.all([
      supabase
        .from('deal_events')
        .select('id, event_type, actor_id, created_at, payload')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('audit_log')
        .select('id, action, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('deal_comments')
        .select('id, section_context, body, author_user_id, created_at, parent_id')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([eventsRes, auditRes, commentsRes]) => {
      // Merge events and audit into timeline
      const eventEntries: TimelineEntry[] = (eventsRes.data || []).map((e: any) => ({
        id: e.id,
        action: e.event_type.replace(/_/g, ' '),
        actor: 'System',
        time: new Date(e.created_at).toLocaleString(),
        category: mapEventToCategory(e.event_type),
      }));

      const auditEntries: TimelineEntry[] = (auditRes.data || []).map((e: any) => ({
        id: e.id,
        action: e.action,
        actor: 'System',
        time: new Date(e.created_at).toLocaleString(),
        category: mapEventToCategory(e.action),
      }));

      // Deduplicate by id, sort by time descending
      const merged = [...eventEntries, ...auditEntries];
      const seen = new Set<string>();
      const unique = merged.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      unique.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setTimeline(unique.slice(0, 50));

      // Build discussions from top-level comments
      const comments = commentsRes.data || [];
      const topLevel = comments.filter((c: any) => !c.parent_id);
      const replyCountMap: Record<string, number> = {};
      comments.forEach((c: any) => {
        if (c.parent_id) {
          replyCountMap[c.parent_id] = (replyCountMap[c.parent_id] || 0) + 1;
        }
      });

      setDiscussions(topLevel.map((c: any) => ({
        id: c.id,
        section_context: c.section_context,
        body: c.body,
        author_user_id: c.author_user_id,
        created_at: new Date(c.created_at).toLocaleString(),
        reply_count: replyCountMap[c.id] || 0,
      })));

      setLoading(false);
    });
  }, [dealId]);

  const timelineCategories = ['all', ...new Set(timeline.map(e => e.category))];

  const views: { id: ActivityView; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'orchestration', label: 'Workflow', icon: Activity },
    { id: 'timeline', label: 'Timeline', icon: Clock, count: timeline.length },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare, count: discussions.length },
  ];

  const hasNoData = timeline.length === 0 && discussions.length === 0;

  return (
    <motion.div {...staggerChildren} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Activity</h2>
        <p className="text-base text-muted-foreground">Deal-scoped events, audit trail, and discussions</p>
      </div>

      {loading && (
        <div className="pivt-card p-12 text-center text-muted-foreground text-sm">Loading activity…</div>
      )}

      {!loading && hasNoData && (
        <div className="pivt-card p-12 text-center">
          <Inbox className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No compliance activity recorded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Compliance events, alerts, and validations will appear here as the deal progresses.
          </p>
        </div>
      )}

      {!loading && !hasNoData && (
        <>
          {/* Section toggle */}
          <div className="flex gap-1 rounded-xl p-1 bg-muted/40">
            {views.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base transition-all ${
                  view === v.id ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <v.icon className="w-4 h-4" />
                {v.label}
                {v.count !== undefined && v.count > 0 && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">{v.count}</Badge>
                )}
              </button>
            ))}
          </div>

          {/* ── Workflow Orchestration View ── */}
          {view === 'orchestration' && <WorkflowActivityFeed />}

          {/* ── Timeline View ── */}
          {view === 'timeline' && (
            <div className="space-y-3">
              {timelineCategories.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                  {timelineCategories.map(cat => (
                    <button key={cat} onClick={() => setTimelineFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${timelineFilter === cat ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              <div className="pivt-card p-5">
                <div className="relative pl-5 space-y-5">
                  <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-border" />
                  {timeline
                    .filter(e => timelineFilter === 'all' || e.category === timelineFilter)
                    .map((entry) => (
                      <div key={entry.id} className="relative flex items-start gap-3">
                        <div className="absolute left-[-14px] w-2.5 h-2.5 rounded-full bg-accent mt-1.5 border-2 border-background" />
                        <div className="flex-1">
                          <p className="text-base">{entry.action}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">{entry.actor}</span>
                            <Badge variant="outline" className="text-xs capitalize">{entry.category}</Badge>
                          </div>
                        </div>
                        <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">{entry.time}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Discussions View ── */}
          {view === 'discussions' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Discussions are attached to specific deal objects. No global threads.</p>
              {discussions.length === 0 ? (
                <div className="pivt-card p-8 text-center text-muted-foreground text-sm">
                  No discussions yet for this deal.
                </div>
              ) : (
                <div className="pivt-card divide-y divide-border">
                  {discussions.map(d => (
                    <motion.div key={d.id} {...fadeInUp} className="p-5 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <MessageSquare className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {d.section_context && (
                            <Badge variant="outline" className="text-xs">{d.section_context}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">{d.body}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm text-muted-foreground font-mono">{d.created_at}</span>
                        {d.reply_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <MessageSquare className="w-3 h-3 mr-1" />{d.reply_count}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
