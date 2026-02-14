import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface Props {
  interestRate: number;
  clientSplit: number;
  platformSplit: number;
}

export const InterestTooltip: React.FC<Props> = ({ interestRate, clientSplit, platformSplit }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[320px] p-3 space-y-2">
          <p className="text-xs font-semibold">Interest Accrual Methodology</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Interest is calculated using simple interest on the held escrow balance:
          </p>
          <code className="block text-[10px] bg-muted/50 rounded px-2 py-1.5 font-mono text-accent">
            Interest = Balance × ({interestRate}% ÷ 100) × (Days ÷ 365)
          </code>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Earnings are split: {clientSplit}% to client, {platformSplit}% to platform.
            Interest begins accruing when escrow status is "funded" and stops upon disbursement.
          </p>
          <p className="text-[10px] text-muted-foreground italic">
            Projections are simulated for pilot. Actual rates set by partner institution.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
