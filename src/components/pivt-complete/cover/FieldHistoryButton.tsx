import React from 'react';
import { Clock3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface FieldHistoryButtonProps {
  tableName: string;
  recordId: string;
  fieldName: string;
  fieldLabel: string;
  currentValue: string | number | null | undefined;
  className?: string;
}

interface HistoryRow {
  id: string;
  created_at: string;
  ai_output: string | null;
  human_correction: string | null;
  resolution_type: string | null;
  user_id: string;
}

interface TimelineEntry {
  id: string;
  label: string;
  value: string;
  actor: string;
  timestamp: string;
  tone: 'ai' | 'human' | 'current';
}

const resolutionTypeLabel: Record<string, string> = {
  ai_accepted: 'AI accepted',
  human_kept: 'Human kept current value',
  human_corrected: 'Human corrected value',
  waived: 'Waived',
};

const stringifyValue = (value: string | number | null | undefined) => {
  if (value == null || value === '') return '—';
  return String(value);
};

export const FieldHistoryButton: React.FC<FieldHistoryButtonProps> = ({
  tableName,
  recordId,
  fieldName,
  fieldLabel,
  currentValue,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [timeline, setTimeline] = React.useState<TimelineEntry[]>([]);

  const loadHistory = React.useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('field_corrections')
      .select('id, created_at, ai_output, human_correction, resolution_type, user_id')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .eq('field_name', fieldName)
      .order('created_at', { ascending: true });

    if (error) {
      setTimeline([
        {
          id: 'current-value',
          label: 'Current value',
          value: stringifyValue(currentValue),
          actor: 'Workspace',
          timestamp: new Date().toISOString(),
          tone: 'current',
        },
      ]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as HistoryRow[];
    const uniqueUserIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));

    let namesByUserId = new Map<string, string>();
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', uniqueUserIds);

      namesByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.full_name]));
    }

    const entries: TimelineEntry[] = [];

    if (rows[0]?.ai_output) {
      entries.push({
        id: `${rows[0].id}-ai`,
        label: 'AI original value',
        value: stringifyValue(rows[0].ai_output),
        actor: 'Newton AI',
        timestamp: rows[0].created_at,
        tone: 'ai',
      });
    }

    rows.forEach((row) => {
      entries.push({
        id: row.id,
        label: row.resolution_type ? resolutionTypeLabel[row.resolution_type] ?? 'Manual edit' : 'Manual edit',
        value: stringifyValue(row.human_correction),
        actor: namesByUserId.get(row.user_id) ?? 'Deal participant',
        timestamp: row.created_at,
        tone: 'human',
      });
    });

    entries.push({
      id: 'current-value',
      label: 'Current value',
      value: stringifyValue(currentValue),
      actor: 'Workspace',
      timestamp: new Date().toISOString(),
      tone: 'current',
    });

    setTimeline(entries);
    setLoading(false);
  }, [currentValue, fieldName, recordId, tableName]);

  React.useEffect(() => {
    if (open) {
      void loadHistory();
    }
  }, [loadHistory, open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={['h-6 w-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground', className]
            .filter(Boolean)
            .join(' ')}
        >
          <Clock3 className="h-3.5 w-3.5" />
          <span className="sr-only">Open history for {fieldLabel}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{fieldLabel} history</SheetTitle>
          <SheetDescription>
            Review the full provenance chain for this structured field, from the AI extraction to the current value.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading field history…
            </div>
          ) : (
            timeline.map((entry, index) => (
              <div key={entry.id} className="relative rounded-xl border border-border bg-card p-4">
                {index < timeline.length - 1 ? <div className="absolute left-6 top-14 h-8 w-px bg-border" /> : null}
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      'mt-1 h-3 w-3 rounded-full border',
                      entry.tone === 'ai' ? 'border-discrepancy bg-discrepancy/20' : '',
                      entry.tone === 'human' ? 'border-accent bg-accent/20' : '',
                      entry.tone === 'current' ? 'border-validated bg-validated/20' : '',
                    ].join(' ')}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{entry.label}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {entry.actor}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground break-words">
                      {entry.value}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};