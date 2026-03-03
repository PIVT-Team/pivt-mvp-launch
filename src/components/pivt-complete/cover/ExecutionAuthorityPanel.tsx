import React, { useState } from 'react';
import { Shield, UserCheck, Users, Lock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface ExecutorAssignment {
  userId: string;
  name: string;
  role: 'EXECUTOR' | 'APPROVER' | 'EDITOR' | 'VIEWER';
  assignedAt: string;
}

// Mock data
const MOCK_EXECUTORS: ExecutorAssignment[] = [
  { userId: '1', name: 'Sarah Chen', role: 'EXECUTOR', assignedAt: '2026-02-10' },
  { userId: '2', name: 'Michael Ross', role: 'EXECUTOR', assignedAt: '2026-02-10' },
];

const MOCK_DEAL_MEMBERS = [
  { userId: '1', name: 'Sarah Chen', currentRole: 'EXECUTOR' },
  { userId: '2', name: 'Michael Ross', currentRole: 'EXECUTOR' },
  { userId: '3', name: 'David Kim', currentRole: 'APPROVER' },
  { userId: '4', name: 'Jennifer Lee', currentRole: 'EDITOR' },
  { userId: '5', name: 'Robert Taylor', currentRole: 'VIEWER' },
];

interface ExecutionBlocker {
  label: string;
  met: boolean;
}

interface ExecutionAuthorityPanelProps {
  userIsExecutor?: boolean;
  dealId?: string;
}

export const ExecutionAuthorityPanel: React.FC<ExecutionAuthorityPanelProps> = ({
  userIsExecutor = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [separationOfDuties, setSeparationOfDuties] = useState(true);
  const [dualExecution, setDualExecution] = useState(false);

  const executionBlockers: ExecutionBlocker[] = [
    { label: 'User has EXECUTOR role', met: userIsExecutor },
    { label: 'Intent status is APPROVED', met: true },
    { label: 'No blocking discrepancies', met: false },
    { label: 'All conditions satisfied', met: true },
    { label: 'Compliance checks passed', met: true },
    { label: 'Wire instructions confirmed', met: true },
  ];

  const allMet = executionBlockers.every(b => b.met);
  const unmetCount = executionBlockers.filter(b => !b.met).length;

  return (
    <div className="pivt-card border border-border/40">
      {/* Header */}
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
              {MOCK_EXECUTORS.length} designated executor{MOCK_EXECUTORS.length !== 1 ? 's' : ''} •
              {dualExecution ? ' Dual execution required' : ' Single execution'} •
              {separationOfDuties ? ' Separation enforced' : ' No separation'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!userIsExecutor && (
            <Badge className="bg-muted/60 text-muted-foreground text-[10px]">
              <Lock className="w-3 h-3 mr-1" />
              Not Executor
            </Badge>
          )}
          {userIsExecutor && allMet && (
            <Badge className="bg-validated/10 text-validated text-[10px]">
              <UserCheck className="w-3 h-3 mr-1" />
              Authorized
            </Badge>
          )}
          {userIsExecutor && !allMet && (
            <Badge className="bg-discrepancy/10 text-discrepancy text-[10px]">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {unmetCount} blocker{unmetCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/30 p-5 space-y-6">
          {/* Execution Gating Checklist */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Execution Gating</h4>
            <div className="space-y-1.5">
              {executionBlockers.map((blocker, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${blocker.met ? 'bg-validated/15' : 'bg-blocking/15'}`}>
                    {blocker.met ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-validated" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-blocking" />
                    )}
                  </div>
                  <span className={blocker.met ? 'text-foreground' : 'text-muted-foreground'}>{blocker.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Designated Executors */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Designated Executors</h4>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-accent" onClick={() => toast.info('Assign executor modal coming soon')}>
                <Users className="w-3 h-3 mr-1" /> Assign
              </Button>
            </div>
            <div className="space-y-2">
              {MOCK_EXECUTORS.map(exec => (
                <div key={exec.userId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-semibold text-accent">
                      {exec.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm font-medium">{exec.name}</span>
                  </div>
                  <Badge className="bg-accent/10 text-accent text-[10px]">{exec.role}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Deal-Level Role Assignments */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Role Assignments</h4>
            <div className="space-y-1.5">
              {MOCK_DEAL_MEMBERS.map(member => (
                <div key={member.userId} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/15 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm">{member.name}</span>
                  </div>
                  <Select defaultValue={member.currentRole} onValueChange={(val) => toast.success(`${member.name} → ${val}`)}>
                    <SelectTrigger className="h-7 w-28 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                      <SelectItem value="EDITOR">Editor</SelectItem>
                      <SelectItem value="APPROVER">Approver</SelectItem>
                      <SelectItem value="EXECUTOR">Executor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4 pt-2 border-t border-border/30">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Execution Settings</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enforce Separation of Duties</p>
                <p className="text-[11px] text-muted-foreground">Creator/approver cannot execute the same intent</p>
              </div>
              <Switch checked={separationOfDuties} onCheckedChange={setSeparationOfDuties} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require Dual Execution</p>
                <p className="text-[11px] text-muted-foreground">Two executors must independently confirm</p>
              </div>
              <Switch checked={dualExecution} onCheckedChange={setDualExecution} />
            </div>
          </div>
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
