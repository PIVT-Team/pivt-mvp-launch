import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, Users, Lock, AlertTriangle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

interface DealUserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface DealSettings {
  enforce_separation_of_duties: boolean;
  require_dual_execution: boolean;
}

interface ExecutionAuthorityPanelProps {
  userIsExecutor?: boolean;
  dealId?: string;
}

export const ExecutionAuthorityPanel: React.FC<ExecutionAuthorityPanelProps> = () => {
  const { dealId } = useDealWorkspace();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [roles, setRoles] = useState<DealUserRole[]>([]);
  const [settings, setSettings] = useState<DealSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    Promise.all([
      supabase.from('deal_user_roles').select('*').eq('deal_id', dealId),
      supabase.from('deal_settings').select('*').eq('deal_id', dealId).maybeSingle(),
    ]).then(([rolesRes, settingsRes]) => {
      setRoles(rolesRes.data || []);
      setSettings(settingsRes.data || null);
      setLoading(false);
    });
  }, [dealId]);

  if (loading) {
    return (
      <div className="pivt-card border border-border/40 p-4 flex items-center justify-center h-16">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const executors = roles.filter(r => r.role === 'executor');
  const userIsExecutor = executors.some(r => r.user_id === user?.id);
  const separationOfDuties = settings?.enforce_separation_of_duties ?? false;
  const dualExecution = settings?.require_dual_execution ?? false;

  if (roles.length === 0) {
    return (
      <div className="pivt-card border border-border/40 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center">
            <Shield className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Execution Authority</h3>
            <p className="text-[11px] text-muted-foreground">No execution authority configured yet</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Add designated execution approvers or derive them from governance approvals.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => toast.info('Add execution authority coming soon')}>
            <Plus className="w-3 h-3" /> Add Execution Authority
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pivt-card border border-border/40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-accent" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold">Execution Authority</h3>
            <p className="text-[11px] text-muted-foreground">
              {executors.length} designated executor{executors.length !== 1 ? 's' : ''} •
              {dualExecution ? ' Dual execution required' : ' Single execution'} •
              {separationOfDuties ? ' Separation enforced' : ' No separation'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {userIsExecutor ? (
            <Badge className="bg-validated/10 text-validated text-[10px]">
              <UserCheck className="w-3 h-3 mr-1" /> Authorized
            </Badge>
          ) : (
            <Badge className="bg-muted/60 text-muted-foreground text-[10px]">
              <Lock className="w-3 h-3 mr-1" /> Not Executor
            </Badge>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/30 p-5 space-y-6">
          {/* Executors */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Designated Executors</h4>
            {executors.length > 0 ? (
              <div className="space-y-2">
                {executors.map(exec => (
                  <div key={exec.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-semibold text-accent">
                        E
                      </div>
                      <span className="text-sm font-medium font-mono">{exec.user_id.slice(0, 8)}</span>
                    </div>
                    <Badge className="bg-accent/10 text-accent text-[10px]">{exec.role.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No executors assigned.</p>
            )}
          </div>

          {/* All roles */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Role Assignments</h4>
            <div className="space-y-1.5">
              {roles.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/15 transition-colors">
                  <span className="text-sm font-mono">{r.user_id.slice(0, 8)}</span>
                  <Badge variant="outline" className="text-[10px]">{r.role.toUpperCase()}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Settings display */}
          {settings && (
            <div className="space-y-3 pt-2 border-t border-border/30">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Execution Settings</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Separation of Duties</span>
                  <Badge variant="outline" className="text-[10px]">{separationOfDuties ? 'Enforced' : 'Off'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Dual Execution</span>
                  <Badge variant="outline" className="text-[10px]">{dualExecution ? 'Required' : 'Off'}</Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Execute button with RBAC gating
interface ExecuteButtonProps {
  intentId: string;
  intentStatus: string;
  userIsExecutor: boolean;
  blockers: string[];
  dualExecutionPending?: boolean;
  onExecute: () => void;
}

export const ExecuteButton: React.FC<ExecuteButtonProps> = ({
  intentStatus,
  userIsExecutor,
  blockers,
  dualExecutionPending,
  onExecute,
}) => {
  const canExecute = userIsExecutor && blockers.length === 0 && (intentStatus === 'eligible' || intentStatus === 'APPROVED');

  const tooltipContent = !userIsExecutor
    ? 'Execution restricted to designated Executors'
    : blockers.length > 0
    ? `Blocked: ${blockers.join(', ')}`
    : dualExecutionPending
    ? 'Awaiting second executor confirmation'
    : 'Ready to execute';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              size="sm"
              disabled={!canExecute}
              onClick={onExecute}
              className={`h-7 text-xs ${canExecute ? 'bg-accent text-accent-foreground hover:bg-accent/90' : ''}`}
            >
              {dualExecutionPending ? 'Awaiting 2nd Executor' : 'Execute'}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px]">
          <p className="text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
