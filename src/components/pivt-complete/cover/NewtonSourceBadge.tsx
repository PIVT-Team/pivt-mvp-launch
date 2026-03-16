import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Bot, AlertTriangle, Lock, Eye } from 'lucide-react';

interface NewtonSourceBadgeProps {
  created_by_source?: string;
  needs_review?: boolean;
  confidence_status?: string;
  locked?: boolean;
  locked_reason?: string | null;
  compact?: boolean;
}

/**
 * Subtle inline indicator for Newton-created or Newton-updated records.
 * Shows source provenance, review status, confidence, and lock state.
 */
export const NewtonSourceBadge: React.FC<NewtonSourceBadgeProps> = ({
  created_by_source,
  needs_review,
  confidence_status,
  locked,
  locked_reason,
  compact = false,
}) => {
  if (created_by_source === 'manual' && !needs_review && !locked) return null;

  const badges: React.ReactNode[] = [];

  // Newton source indicator
  if (created_by_source === 'newton' || created_by_source === 'agent') {
    badges.push(
      <Tooltip key="source">
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1 text-[10px] px-1.5 py-0 h-5 font-medium border-accent/30 text-accent bg-accent/5"
          >
            <Bot className="w-3 h-3" />
            {!compact && 'Newton'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          Imported by Newton. This record is fully editable in the standard interface.
        </TooltipContent>
      </Tooltip>
    );
  }

  // Needs review
  if (needs_review) {
    badges.push(
      <Tooltip key="review">
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1 text-[10px] px-1.5 py-0 h-5 font-medium border-yellow-500/30 text-yellow-600 bg-yellow-500/5"
          >
            <Eye className="w-3 h-3" />
            {!compact && 'Needs review'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          This record was auto-generated and should be reviewed for accuracy.
        </TooltipContent>
      </Tooltip>
    );
  }

  // Low confidence
  if (confidence_status === 'low') {
    badges.push(
      <Tooltip key="confidence">
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1 text-[10px] px-1.5 py-0 h-5 font-medium border-destructive/30 text-destructive bg-destructive/5"
          >
            <AlertTriangle className="w-3 h-3" />
            {!compact && 'Low confidence'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          Extraction confidence is low. Please verify this data manually.
        </TooltipContent>
      </Tooltip>
    );
  }

  // Locked
  if (locked) {
    badges.push(
      <Tooltip key="locked">
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1 text-[10px] px-1.5 py-0 h-5 font-medium border-muted-foreground/30 text-muted-foreground bg-muted/50"
          >
            <Lock className="w-3 h-3" />
            {!compact && 'Locked'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          {locked_reason || 'This record is locked by a downstream workflow step.'}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (badges.length === 0) return null;

  return <span className="inline-flex items-center gap-1">{badges}</span>;
};
