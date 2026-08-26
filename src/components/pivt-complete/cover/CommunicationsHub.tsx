import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareText, Filter, Search, Clock, ArrowRight, Inbox, AtSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { SampleDataNotice } from './SampleDataNotice';

// Demo aggregated comments across deals
const DEMO_COMMENTS = [
  {
    id: 'c1', dealId: 'atlas', dealName: 'Project ATLAS',
    author: 'Sarah Chen', authorInitials: 'SC',
    body: 'Wire instructions for a16z trust account are still missing. Can someone follow up with their ops team?',
    sectionContext: 'payments', createdAt: '2026-02-26T14:32:00Z', unread: true, hasReply: true,
    replyCount: 2, lastReplyAuthor: 'Marcus Williams',
  },
  {
    id: 'c2', dealId: 'atlas', dealName: 'Project ATLAS',
    author: 'Deal Admin', authorInitials: 'DA',
    body: 'Waterfall Schedule v3 has been uploaded and is pending review. @BuyerCounsel please approve.',
    sectionContext: 'documents', createdAt: '2026-02-26T11:15:00Z', unread: true, hasReply: false,
    replyCount: 0, mentionsYou: true,
  },
  {
    id: 'c3', dealId: 'beacon', dealName: 'Project BEACON',
    author: 'Compliance Team', authorInitials: 'CT',
    body: 'KYC verification for GIC Private Limited has failed due to TIN mismatch. Escalating to admin review.',
    sectionContext: 'stakeholders', createdAt: '2026-02-25T16:45:00Z', unread: false, hasReply: true,
    replyCount: 1, lastReplyAuthor: 'Sarah Chen',
  },
  {
    id: 'c4', dealId: 'cipher', dealName: 'Project CIPHER',
    author: 'Titan Legal', authorInitials: 'TL',
    body: 'All escrow conditions have been met. Ready to proceed with fund release authorization.',
    sectionContext: 'escrow', createdAt: '2026-02-25T09:00:00Z', unread: false, hasReply: false,
    replyCount: 0,
  },
  {
    id: 'c5', dealId: 'atlas', dealName: 'Project ATLAS',
    author: 'Marcus Williams', authorInitials: 'MW',
    body: 'ESOP pool discrepancy between 7.2% and 7.0% needs to be resolved before final cap table sign-off.',
    sectionContext: 'cap-table', createdAt: '2026-02-24T15:20:00Z', unread: false, hasReply: true,
    replyCount: 3, lastReplyAuthor: 'Deal Admin',
  },
  {
    id: 'c6', dealId: 'beacon', dealName: 'Project BEACON',
    author: 'Meridian Holdings', authorInitials: 'MH',
    body: 'Requesting an extension on the closing date due to outstanding diligence items.',
    sectionContext: 'general', createdAt: '2026-02-23T10:30:00Z', unread: false, hasReply: true,
    replyCount: 4, lastReplyAuthor: 'Deal Admin',
  },
];

const SECTION_COLORS: Record<string, string> = {
  payments: 'bg-amber-500/10 text-amber-600',
  documents: 'bg-blue-500/10 text-blue-600',
  stakeholders: 'bg-purple-500/10 text-purple-600',
  escrow: 'bg-emerald-500/10 text-emerald-600',
  'cap-table': 'bg-indigo-500/10 text-indigo-600',
  general: 'bg-muted/60 text-muted-foreground',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const CommunicationsHub: React.FC = () => {
  const { deals, setActiveSection, setSelectedDealId } = usePIVTStore();
  const [dealFilter, setDealFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    let result = DEMO_COMMENTS;
    if (dealFilter !== 'all') result = result.filter(c => c.dealId === dealFilter);
    if (showUnreadOnly) result = result.filter(c => c.unread || c.mentionsYou);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.body.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q) ||
        c.dealName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [dealFilter, searchQuery, showUnreadOnly]);

  const unreadCount = DEMO_COMMENTS.filter(c => c.unread).length;
  const mentionCount = DEMO_COMMENTS.filter(c => c.mentionsYou).length;

  const handleCommentClick = (comment: typeof DEMO_COMMENTS[0]) => {
    setSelectedDealId(comment.dealId);
    setActiveSection('workspace' as ActiveSection);
  };

  return (
    <motion.div {...staggerChildren} className="space-y-8">
      <SampleDataNotice what="This communications view" className="mb-4" />
      {/* Header */}
      <motion.div {...fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3" style={{ letterSpacing: '-0.03em' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(220 80% 55% / 0.1)' }}>
              <MessageSquareText className="w-5 h-5" style={{ color: '#2F6BFF' }} />
            </div>
            Communications
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">View and respond to deal comments across your portfolio.</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Badge className="bg-accent/10 text-accent text-xs px-2.5 py-1">
              {unreadCount} unread
            </Badge>
          )}
          {mentionCount > 0 && (
            <Badge className="bg-blue-500/10 text-blue-600 text-xs px-2.5 py-1">
              <AtSign className="w-3 h-3 mr-1" />
              {mentionCount} mention{mentionCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div {...fadeInUp} className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Search comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={dealFilter} onValueChange={setDealFilter}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All deals" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deals</SelectItem>
            {deals.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.codeName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          className={`h-9 px-3.5 rounded-lg text-xs font-medium border transition-colors ${
            showUnreadOnly
              ? 'bg-accent/10 text-accent border-accent/20'
              : 'text-muted-foreground border-border hover:bg-muted/40'
          }`}
        >
          Unread & Mentions
        </button>
      </motion.div>

      {/* Feed */}
      <motion.div {...fadeInUp} className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pivt-card p-12 text-center"
            >
              <Inbox className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No communications yet. Comments will appear here once your team starts collaborating on deals.
              </p>
            </motion.div>
          ) : (
            filtered.map((comment) => (
              <motion.button
                key={comment.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                onClick={() => handleCommentClick(comment)}
                className={`pivt-card w-full text-left p-5 hover:bg-muted/20 transition-all group ${
                  comment.unread ? 'border-l-[3px]' : ''
                }`}
                style={comment.unread ? { borderLeftColor: 'hsl(var(--accent))' } : undefined}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                    style={{
                      background: 'var(--pivt-gradient-primary)',
                      color: '#FFFFFF',
                    }}
                  >
                    {comment.authorInitials}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{comment.author}</span>
                      <span className="text-[10px] text-muted-foreground/60">in</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium border-accent/20 text-accent">
                        {comment.dealName}
                      </Badge>
                      {comment.sectionContext && comment.sectionContext !== 'general' && (
                        <Badge className={`text-[9px] px-1.5 py-0 ${SECTION_COLORS[comment.sectionContext] || SECTION_COLORS.general}`}>
                          {comment.sectionContext}
                        </Badge>
                      )}
                      {comment.mentionsYou && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-blue-500/10 text-blue-600">
                          <AtSign className="w-2.5 h-2.5 mr-0.5" />
                          You
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground/50 ml-auto flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(comment.createdAt)}
                      </span>
                    </div>

                    {/* Body */}
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{comment.body}</p>

                    {/* Footer */}
                    {comment.hasReply && (
                      <p className="text-[11px] text-muted-foreground/50 mt-2">
                        {comment.replyCount} repl{comment.replyCount === 1 ? 'y' : 'ies'} · Last from {comment.lastReplyAuthor}
                      </p>
                    )}
                  </div>

                  {/* Navigate arrow */}
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors shrink-0 mt-1" />
                </div>
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};
