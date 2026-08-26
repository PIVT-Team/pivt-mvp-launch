import React from 'react';
import { Info } from 'lucide-react';

/**
 * Marks a screen that is showing illustrative content rather than this deal.
 *
 * Several covers render `DEMO_*` constants with no data source behind them at
 * all. They look like live analysis of the open deal — risk scores, payment
 * runs, AI findings — and a user has no way to tell. On a product whose whole
 * claim is "know whether this transaction can close", a screen that invents its
 * answer is worse than a screen that is empty.
 *
 * This is a stopgap that makes the state legible. The real fix is to wire each
 * screen to its data or remove it.
 */
export const SampleDataNotice: React.FC<{ what?: string; className?: string }> = ({
  what = 'this view',
  className = '',
}) => (
  <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border border-border bg-muted/40 ${className}`}>
    <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
    <div className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">Sample data.</span>{' '}
      {what} shows illustrative content, not figures from this transaction. Do not
      rely on anything here for a closing decision.
    </div>
  </div>
);
