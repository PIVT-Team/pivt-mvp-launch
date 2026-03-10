import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Activity, FileText, Landmark, ArrowRightLeft, Shield, AlertTriangle,
  CheckCircle2, Clock, RefreshCw, Loader2, Network,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';

interface WorkflowEvent {
  id: string;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
}

const eventIcons: Record<string, React.ElementType> = {
  document_workflow_processed: FileText,
  wire_instructions_created: Landmark,
  payment_allocations_created: ArrowRightLeft,
  deal_graph_rebuilt: Network,
  discrepancy_engine_triggered: AlertTriangle,
  cap_table_processed: Shield,
  spa_processed: FileText,
  prior_extraction_superseded: RefreshCw,
  escrow_agreement_processed: Shield,
  payoff_letter_processed: Landmark,
  wire_instruction_verified: CheckCircle2,
};

const eventLabels: Record<string, string> = {
  document_workflow_processed: 'Document processed by orchestrator',
  wire_instructions_created: 'Wire instructions extracted',
  payment_allocations_created: 'Payment allocations generated',
  deal_graph_rebuilt: 'Deal graph rebuilt',
  discrepancy_engine_triggered: 'Discrepancy engine triggered',
  cap_table_processed: 'Cap table data extracted',
  spa_processed: 'SPA data extracted',
  prior_extraction_superseded: 'Prior extraction superseded',
  escrow_agreement_processed: 'Escrow agreement processed',
  payoff_letter_processed: 'Payoff letter processed',
  wire_instruction_verified: 'Wire instruction verified',
};

export const WorkflowActivityFeed: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    if (!dealId) return;
    setLoading(true);
    const { data } = await supabase
      .from('audit_log')
      .select('id, action, details, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(30);
    setEvents((data || []) as WorkflowEvent[]);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="pivt-card p-12 text-center">
        <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-medium">No workflow events yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload documents in Deal Inputs to trigger the orchestration pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            Workflow Activity
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Orchestration events for this deal</p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={fetchEvents}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      <div className="pivt-card overflow-hidden">
        <div className="relative pl-6 py-4 space-y-4">
          <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-border" />
          {events.map((evt) => {
            const Icon = eventIcons[evt.action] || Clock;
            const label = eventLabels[evt.action] || evt.action.replace(/_/g, ' ');
            const details = evt.details || {};
            const detailChips: string[] = [];

            if (details.wires_created) detailChips.push(`${details.wires_created} wires`);
            if (details.allocations_created) detailChips.push(`${details.allocations_created} allocations`);
            if (details.count) detailChips.push(`${details.count} records`);
            if (details.node_count) detailChips.push(`${details.node_count} nodes`);
            if (details.edge_count) detailChips.push(`${details.edge_count} edges`);
            if (details.fields_updated) detailChips.push(`${details.fields_updated.length} fields`);
            if (details.doc_type) detailChips.push(details.doc_type);

            return (
              <motion.div key={evt.id} {...fadeInUp} className="relative flex items-start gap-3">
                <div className="absolute left-[-16px] w-3 h-3 rounded-full bg-accent/20 border-2 border-accent mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-sm font-medium capitalize">{label}</span>
                  </div>
                  {detailChips.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {detailChips.map((chip, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{chip}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap shrink-0">
                  {new Date(evt.created_at).toLocaleString()}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
