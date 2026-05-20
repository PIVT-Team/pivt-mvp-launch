// PersonaTemplateSettings — per-org Persona template configuration.
//
// Rendered inside WorkspaceSettingsPanel. Lets owners/editors point this
// org at custom Persona template IDs for KYC, KYB, and Watchlist. Falls
// back silently to platform defaults (env vars) when blank.
//
// Defensive paths handled:
//   • organization_persona_templates table not deployed yet → render the
//     "schema not deployed" hint instead of crashing.
//   • Persona API key not set in Supabase → we don't surface a banner
//     here because that's a *deploy* concern; the verify button itself
//     shows that warning when a user tries to verify without keys set.

import React, { useEffect, useState, useCallback } from 'react';
import { Shield, Save, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

type Kind = 'kyc' | 'kyb' | 'watchlist';

interface TemplateRow {
  id?: string;
  kind: Kind;
  persona_template_id: string;
  is_active: boolean;
}

const KIND_LABELS: Record<Kind, { title: string; helper: string }> = {
  kyc: {
    title: 'Individual KYC template',
    helper: 'Used for natural-person stakeholders (sellers, UBOs, signatories).',
  },
  kyb: {
    title: 'Business KYB template',
    helper: 'Used for entity stakeholders (funds, holdings, counterparties).',
  },
  watchlist: {
    title: 'Watchlist Report template',
    helper: 'Runs sanctions/PEP/adverse-media checks against verified identities.',
  },
};

interface Props {
  orgId: string | null;
  canManage: boolean;
}

export const PersonaTemplateSettings: React.FC<Props> = ({ orgId, canManage }) => {
  const [rows, setRows] = useState<Record<Kind, TemplateRow>>({
    kyc: { kind: 'kyc', persona_template_id: '', is_active: true },
    kyb: { kind: 'kyb', persona_template_id: '', is_active: true },
    watchlist: { kind: 'watchlist', persona_template_id: '', is_active: true },
  });
  const [loading, setLoading] = useState(true);
  const [savingKind, setSavingKind] = useState<Kind | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('organization_persona_templates' as never)
      .select('id, kind, persona_template_id, is_active')
      .eq('org_id', orgId);

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === 'PGRST205' || code === 'PGRST204' || code === '42P01' ||
          (error.message || '').toLowerCase().includes('does not exist')) {
        setSchemaMissing(true);
        setLoading(false);
        return;
      }
      console.error('PersonaTemplateSettings load error:', error);
      setLoading(false);
      return;
    }

    const next: Record<Kind, TemplateRow> = {
      kyc: { kind: 'kyc', persona_template_id: '', is_active: true },
      kyb: { kind: 'kyb', persona_template_id: '', is_active: true },
      watchlist: { kind: 'watchlist', persona_template_id: '', is_active: true },
    };
    for (const row of (data as TemplateRow[]) || []) {
      next[row.kind] = row;
    }
    setRows(next);
    setSchemaMissing(false);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (kind: Kind) => {
    if (!orgId) return;
    setSavingKind(kind);
    const row = rows[kind];
    const trimmed = row.persona_template_id.trim();

    if (!trimmed && row.is_active) {
      toast.message('Leaving template blank reverts this workspace to the platform default.');
    }

    const payload = {
      org_id: orgId,
      kind,
      persona_template_id: trimmed,
      is_active: row.is_active,
    };

    const { error } = await supabase
      .from('organization_persona_templates' as never)
      .upsert(payload as never, { onConflict: 'org_id,kind' });

    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success(`${KIND_LABELS[kind].title} updated`);
      await load();
    }
    setSavingKind(null);
  };

  if (!orgId) return null;

  if (schemaMissing) {
    return (
      <section className="pivt-card p-6 space-y-3 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="font-semibold text-amber-700 dark:text-amber-300">Persona schema not deployed</h3>
        </div>
        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
          Apply the latest migration in your database to enable per-workspace Persona template overrides.
        </p>
      </section>
    );
  }

  return (
    <section className="pivt-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <div>
            <h3 className="font-semibold">Persona identity verification</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Override the platform-default templates for this workspace. Leave blank to use platform defaults. {' '}
              <a
                href="https://app.withpersona.com/dashboard/templates"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                Open Persona dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates…
        </div>
      ) : (
        <div className="space-y-4">
          {(['kyc', 'kyb', 'watchlist'] as Kind[]).map((kind) => {
            const row = rows[kind];
            const label = KIND_LABELS[kind];
            return (
              <div key={kind} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">{label.title}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{label.helper}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground" htmlFor={`active-${kind}`}>
                      {row.is_active ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      id={`active-${kind}`}
                      checked={row.is_active}
                      disabled={!canManage}
                      onCheckedChange={(checked) =>
                        setRows((prev) => ({ ...prev, [kind]: { ...prev[kind], is_active: checked } }))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-[11px] text-muted-foreground">Template ID</Label>
                    <Input
                      placeholder="itmpl_xxxxxxxxxxxxxxxx"
                      value={row.persona_template_id}
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [kind]: { ...prev[kind], persona_template_id: e.target.value },
                        }))
                      }
                      disabled={!canManage}
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canManage || savingKind === kind}
                    onClick={() => save(kind)}
                    className="gap-1.5"
                  >
                    {savingKind === kind ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
          {!canManage && (
            <p className="text-[11px] text-muted-foreground">
              Only workspace owners and editors can change identity verification templates.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
