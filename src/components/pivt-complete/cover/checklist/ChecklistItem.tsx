import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  FileText,
  Link2,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type ChecklistStatus = 'pending' | 'in_progress' | 'satisfied' | 'waived' | 'not_applicable';

export interface ChecklistComment {
  id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}

export interface ChecklistPresenceUser {
  key: string;
  label: string;
}

export interface ChecklistItemModel {
  id: string;
  title: string;
  description: string | null;
  status: ChecklistStatus;
  category: string;
  parent_id: string | null;
  supporting_document_id: string | null;
  entity_id: string | null;
  waiver_justification: string | null;
}

interface ChecklistItemProps {
  item: ChecklistItemModel;
  depth?: number;
  isSection?: boolean;
  isSelected: boolean;
  isReadOnly: boolean;
  responsiblePartyLabel?: string | null;
  entityLabel?: string | null;
  supportingDocumentLabel?: string | null;
  unreadCount: number;
  comments: ChecklistComment[];
  presenceUsers?: ChecklistPresenceUser[];
  onSelect: (checked: boolean) => void;
  onMarkSatisfied: () => void;
  onWaive: () => void;
  onOpenEntity: () => void;
  onAddComment: (body: string) => Promise<void>;
  onCommentsViewed: () => void;
  children?: React.ReactNode;
}

const STATUS_STYLES: Record<ChecklistStatus, { dot: string; badge: string; label: string }> = {
  pending: {
    dot: 'bg-muted-foreground/40',
    badge: 'bg-muted text-muted-foreground border-transparent',
    label: 'Pending',
  },
  in_progress: {
    dot: 'bg-accent',
    badge: 'bg-accent/10 text-accent border-accent/20',
    label: 'In Progress',
  },
  satisfied: {
    dot: 'bg-validated',
    badge: 'bg-validated/10 text-validated border-validated/20',
    label: 'Satisfied',
  },
  waived: {
    dot: 'bg-discrepancy',
    badge: 'bg-discrepancy/10 text-discrepancy border-discrepancy/20',
    label: 'Waived',
  },
  not_applicable: {
    dot: 'bg-blocking',
    badge: 'bg-blocking/10 text-blocking border-blocking/20',
    label: 'Not Applicable',
  },
};

const initialsFromLabel = (label?: string | null) => {
  if (!label) return '—';
  const parts = label.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || '—';
};

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
  item,
  depth = 0,
  isSection = false,
  isSelected,
  isReadOnly,
  responsiblePartyLabel,
  entityLabel,
  supportingDocumentLabel,
  unreadCount,
  comments,
  presenceUsers = [],
  onSelect,
  onMarkSatisfied,
  onWaive,
  onOpenEntity,
  onAddComment,
  onCommentsViewed,
  children,
}) => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draftComment, setDraftComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const statusStyle = STATUS_STYLES[item.status];
  const hasChildren = Boolean(children);
  const paddingLeft = depth * 18;

  const supportingMeta = useMemo(() => {
    if (item.status === 'waived' && item.waiver_justification) {
      return {
        icon: ShieldAlert,
        label: item.waiver_justification,
      };
    }

    if (supportingDocumentLabel) {
      return {
        icon: FileText,
        label: supportingDocumentLabel,
      };
    }

    return null;
  }, [item.status, item.waiver_justification, supportingDocumentLabel]);

  const handleCommentSubmit = async () => {
    const next = draftComment.trim();
    if (!next) return;
    setSubmittingComment(true);
    try {
      await onAddComment(next);
      setDraftComment('');
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/70 transition-colors',
        isSection ? 'bg-muted/20' : 'hover:border-accent/20',
      )}
      style={{ marginLeft: paddingLeft }}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex items-center gap-3 pt-0.5">
          <Checkbox checked={isSelected} onCheckedChange={(checked) => onSelect(Boolean(checked))} />
          <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', statusStyle.dot)} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {hasChildren ? (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {isSection ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                ) : null}
                <h3 className={cn('truncate', isSection ? 'text-base font-semibold' : 'text-sm font-semibold')}>
                  {item.title}
                </h3>
                <Badge className={statusStyle.badge}>{statusStyle.label}</Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {item.category}
                </Badge>
              </div>
              {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {presenceUsers.length > 0 ? (
                <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 py-1">
                  <div className="flex -space-x-2">
                    {presenceUsers.slice(0, 3).map((viewer) => (
                      <Avatar key={viewer.key} className="h-6 w-6 border border-background">
                        <AvatarFallback className="text-[10px] font-semibold">{initialsFromLabel(viewer.label)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {presenceUsers.length} viewing
                  </span>
                </div>
              ) : null}

              {responsiblePartyLabel ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-2 py-1.5">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] font-semibold">{initialsFromLabel(responsiblePartyLabel)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-foreground">{responsiblePartyLabel}</span>
                </div>
              ) : null}
            </div>
          </div>

          {(entityLabel || supportingMeta) ? (
            <div className="flex flex-wrap items-center gap-2">
              {entityLabel ? (
                <button
                  type="button"
                  onClick={onOpenEntity}
                  className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
                >
                  <Link2 className="h-3 w-3" />
                  {entityLabel}
                </button>
              ) : null}
              {supportingMeta ? (
                <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                  <supportingMeta.icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{supportingMeta.label}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isSection ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={onMarkSatisfied} disabled={isReadOnly}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark satisfied
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onWaive} disabled={isReadOnly}>
                <CircleSlash className="h-3.5 w-3.5" />
                Waive
              </Button>
            </div>
          ) : null}

          <Collapsible
            open={commentsOpen}
            onOpenChange={(open) => {
              setCommentsOpen(open);
              if (open) onCommentsViewed();
            }}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Comment thread</span>
                <Badge variant="secondary" className="min-w-5 justify-center px-1.5 py-0 text-[10px]">
                  {unreadCount > 0 ? unreadCount : comments.length}
                </Badge>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="rounded-lg border border-border/60 bg-background/70 p-3 space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border border-border/50 bg-card px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">{comment.authorLabel}</span>
                          <span>{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="mt-1 text-sm text-foreground/90">{comment.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {!isReadOnly ? (
                  <div className="space-y-2">
                    <Textarea
                      value={draftComment}
                      onChange={(event) => setDraftComment(event.target.value)}
                      placeholder="Add a collaboration note…"
                      className="min-h-[88px]"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleCommentSubmit} disabled={submittingComment || !draftComment.trim()}>
                        Add comment
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {hasChildren ? <div className="space-y-3 pt-1">{children}</div> : null}
        </div>
      </div>
    </div>
  );
};