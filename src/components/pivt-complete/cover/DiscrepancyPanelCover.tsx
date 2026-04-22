import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { NewtonDiscrepancyPanel, type DiscrepancyItem } from './newton/NewtonDiscrepancyPanel';

type DiscrepancyRow = {
  id: string;
  rule_key: string;
  severity: 'blocker' | 'warn' | 'info';
  status: string;
  message: string;
  object_type: string;
  details: Record<string, unknown> | null;
};

const mapSeverity = (severity: DiscrepancyRow['severity']): DiscrepancyItem['severity'] => {
  switch (severity) {
    case 'blocker':
      return 'critical';
    case 'warn':
      return 'medium';
    case 'info':
    default:
      return 'low';
  }
};

const buildDiscrepancyItem = (row: DiscrepancyRow): DiscrepancyItem => {
  const details = row.details ?? {};
  const affectedEntities = Array.isArray(details.affected_entities)
    ? details.affected_entities
        .filter((entity): entity is { type?: string; id?: string; label?: string } => typeof entity === 'object' && entity !== null)
        .map((entity, index) => ({
          type: entity.type ?? 'entity',
          id: entity.id ?? `${row.id}-${index}`,
          label: entity.label ?? 'Linked entity',
        }))
    : [];

  return {
    id: row.id,
    rule_key: row.rule_key,
    severity: mapSeverity(row.severity),
    category: typeof details.category === 'string' ? details.category : row.object_type,
    title: typeof details.title === 'string' ? details.title : row.message,
    description: row.message,
    expected_value: typeof details.expected_value === 'string' ? details.expected_value : undefined,
    actual_value: typeof details.actual_value === 'string' ? details.actual_value : undefined,
    recommendation:
      typeof details.recommendation === 'string'
        ? details.recommendation
        : 'Review the conflicting field values and confirm the authoritative value.',
    affected_entities: affectedEntities,
    resolved: row.status === 'resolved' || row.status === 'waived',
  };
};

export const DiscrepancyPanelCover: React.FC = () => {
  const { dealId, realDeal } = useDealWorkspace();
  const { toast } = useToast();
  const [items, setItems] = React.useState<DiscrepancyItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadDiscrepancies = React.useCallback(async () => {
    if (!dealId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('discrepancies')
      .select('id, rule_key, severity, status, message, object_type, details')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Unable to load discrepancies',
        description: error.message,
        variant: 'destructive',
      });
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []).map((row) => buildDiscrepancyItem(row as unknown as DiscrepancyRow)));
    setLoading(false);
  }, [dealId, toast]);

  React.useEffect(() => {
    void loadDiscrepancies();
  }, [loadDiscrepancies]);

  const handleResolve = React.useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('discrepancies')
        .update({ status: 'resolved' })
        .eq('id', id);

      if (error) {
        toast({
          title: 'Unable to update discrepancy',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setItems((current) => current.map((item) => (item.id === id ? { ...item, resolved: true } : item)));
      toast({
        title: 'Discrepancy resolved',
        description: 'The discrepancy has been marked as resolved.',
      });
    },
    [toast],
  );

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading discrepancies…
        </div>
      </div>
    );
  }

  if (!dealId) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
        <AlertTriangle className="mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">No active deal selected</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Select a deal to review extraction conflicts, field mismatches, and wire discrepancies.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Discrepancy Resolution</h2>
        <p className="text-sm text-muted-foreground">
          Review detected conflicts for {realDeal?.deal_name ?? 'this deal'} and resolve them before execution.
        </p>
      </div>

      <NewtonDiscrepancyPanel
        discrepancies={items}
        onResolve={handleResolve}
        dealName={realDeal?.deal_name}
      />
    </section>
  );
};