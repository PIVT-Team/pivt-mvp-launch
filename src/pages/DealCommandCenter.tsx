import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Lock, Sparkles,
  MessageSquareText, History, ChevronRight, ShieldCheck, FileText, Users, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type NodeStatus = "complete" | "in_progress" | "pending" | "blocked";

interface PathNode {
  id: string;
  label: string;
  status: NodeStatus;
  owner?: string | null;
  due?: string | null;
  meta?: string;
  blockedBy?: string[];
}

interface PhaseGroup {
  id: "parties" | "documentation" | "verification" | "execution";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  nodes: PathNode[];
}

// ─────────────────────────────────────────────────────────
// Status helpers (use existing semantic tokens only)
// ─────────────────────────────────────────────────────────
const statusBadge: Record<NodeStatus, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  complete:    { label: "Cleared",     cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", Icon: CheckCircle2 },
  in_progress: { label: "In progress", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20",      Icon: Clock },
  pending:     { label: "Pending",     cls: "bg-muted text-muted-foreground border-border",            Icon: Circle },
  blocked:     { label: "Blocked",     cls: "bg-destructive/10 text-destructive border-destructive/20", Icon: AlertTriangle },
};

function fmtDate(d?: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return null; }
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────
export default function DealCommandCenter() {
  const { id: dealId } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<any>(null);
  const [phases, setPhases] = useState<PhaseGroup[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");

  // Fetch everything for the command center
  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [
        dealRes,
        capTableRes,
        complianceRes,
        docsRes,
        condRes,
        regRes,
        discRes,
        approvalsRes,
        commentsRes,
        eventsRes,
      ] = await Promise.all([
        supabase.from("deals").select("*").eq("id", dealId).maybeSingle(),
        supabase.from("cap_table_entries").select("id,shareholder_name,role,verification_status").eq("deal_id", dealId),
        supabase.from("compliance_checks").select("id,check_type,status,party_id").eq("deal_id", dealId),
        supabase.from("contract_documents").select("id,filename,doc_type,status,extraction_confidence").eq("deal_id", dealId),
        supabase.from("conditions").select("id,title,status").eq("deal_id", dealId),
        supabase.from("regulatory_conditions" as any).select("id,condition_type,status,filed_at,cleared_at,waiting_period_end").eq("deal_id", dealId),
        supabase.from("discrepancies" as any).select("id,severity,status,description").eq("deal_id", dealId),
        supabase.from("deal_approvals").select("id,approver_role,approval_side,status,approver_name,sent_at,completed_at").eq("deal_id", dealId),
        supabase.from("deal_comments").select("id,body,created_at,section_context,author_user_id").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(40),
        supabase.from("deal_events").select("id,event_type,created_at,payload,actor_id").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(40),
      ]);

      if (cancelled) return;

      const d = dealRes.data;
      const capTable = capTableRes.data ?? [];
      const compliance = complianceRes.data ?? [];
      const docs = docsRes.data ?? [];
      const conditions = condRes.data ?? [];
      const regs = (regRes.data as any[]) ?? [];
      const discrepancies = (discRes.data as any[]) ?? [];
      const approvals = approvalsRes.data ?? [];

      setDeal(d);
      setComments(commentsRes.data ?? []);
      setEvents(eventsRes.data ?? []);
      setPhases(buildPhases({ capTable, compliance, docs, conditions, regs, discrepancies, approvals }));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [dealId]);

  const allNodes = useMemo(() => phases.flatMap(p => p.nodes), [phases]);
  const selectedNode = useMemo(
    () => allNodes.find(n => n.id === selectedNodeId) ?? null,
    [allNodes, selectedNodeId]
  );

  const totalNodes = allNodes.length;
  const clearedNodes = allNodes.filter(n => n.status === "complete").length;
  const blockedNodes = allNodes.filter(n => n.status === "blocked").length;
  const readinessPct = totalNodes ? Math.round((clearedNodes / totalNodes) * 100) : 0;
  const executionLocked = blockedNodes > 0 || clearedNodes < totalNodes - 1; // Execution Gate is the last node

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Deal not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header strip */}
      <div className="border-b border-border bg-card/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/deals/${dealId}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Workspace
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <h1 className="text-sm font-semibold tracking-tight truncate">{deal.deal_name}</h1>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{deal.deal_number}</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Readiness</div>
            <div className="text-sm font-mono font-semibold">{readinessPct}%</div>
          </div>
          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                blockedNodes > 0 ? "bg-destructive" : "bg-emerald-500"
              )}
              style={{ width: `${readinessPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3-panel grid */}
      <div className="grid grid-cols-12 gap-0 flex-1 min-h-0">
        {/* LEFT — Critical Path */}
        <aside className="col-span-3 border-r border-border bg-card/30 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Critical Path</h2>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={cn("text-[10px] px-2 py-0.5 rounded", viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("graph")}
                className={cn("text-[10px] px-2 py-0.5 rounded", viewMode === "graph" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              >
                Graph
              </button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {viewMode === "list" ? (
              <div className="p-3 space-y-4">
                {phases.map((phase, pi) => (
                  <div key={phase.id}>
                    <div className="flex items-center gap-2 px-2 mb-2">
                      <phase.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Phase {pi + 1} · {phase.label}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {phase.nodes.map(node => (
                        <NodeRow
                          key={node.id}
                          node={node}
                          selected={selectedNodeId === node.id}
                          onSelect={() => setSelectedNodeId(node.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-xs text-muted-foreground">
                <div className="rounded-md border border-dashed border-border p-6 text-center space-y-2">
                  <Sparkles className="w-5 h-5 mx-auto text-muted-foreground/60" />
                  <p>Graph view uses the existing Intelligence Map.</p>
                  <Link to={`/pivt/intelligence-map`} className="text-accent hover:underline">
                    Open full map →
                  </Link>
                </div>
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* CENTER — Active Workspace */}
        <main className="col-span-6 overflow-auto">
          {selectedNode ? (
            <NodeDetail node={selectedNode} dealId={dealId!} executionLocked={executionLocked} clearedNodes={clearedNodes} totalNodes={totalNodes} />
          ) : (
            <DealOverviewPane deal={deal} phases={phases} readinessPct={readinessPct} />
          )}
        </main>

        {/* RIGHT — Contextual Intelligence Rail */}
        <aside className="col-span-3 border-l border-border bg-card/30 flex flex-col min-h-0">
          <Tabs defaultValue="newton" className="flex flex-col h-full">
            <TabsList className="grid grid-cols-3 mx-3 mt-3">
              <TabsTrigger value="newton" className="text-xs"><Sparkles className="w-3 h-3 mr-1" />Newton</TabsTrigger>
              <TabsTrigger value="comms" className="text-xs"><MessageSquareText className="w-3 h-3 mr-1" />Comms</TabsTrigger>
              <TabsTrigger value="audit" className="text-xs"><History className="w-3 h-3 mr-1" />Audit</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1 mt-2">
              <TabsContent value="newton" className="px-3 pb-3 mt-0 space-y-2">
                <NewtonInsights node={selectedNode} blocked={blockedNodes} cleared={clearedNodes} total={totalNodes} />
              </TabsContent>
              <TabsContent value="comms" className="px-3 pb-3 mt-0 space-y-2">
                <CommsFeed comments={comments} sectionFilter={selectedNode?.id ?? null} />
              </TabsContent>
              <TabsContent value="audit" className="px-3 pb-3 mt-0 space-y-2">
                <AuditFeed events={events} nodeFilter={selectedNode?.id ?? null} />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Build phases from supabase data
// ─────────────────────────────────────────────────────────
function buildPhases(data: {
  capTable: any[]; compliance: any[]; docs: any[]; conditions: any[];
  regs: any[]; discrepancies: any[]; approvals: any[];
}): PhaseGroup[] {
  const { capTable, compliance, docs, conditions, regs, discrepancies, approvals } = data;

  // Phase 1 — Parties & Compliance (one node per party with KYC + sanctions roll-up)
  const partyNodes: PathNode[] = capTable.slice(0, 6).map((p: any) => {
    const partyChecks = compliance.filter(c => c.party_id === p.id);
    const failed = partyChecks.some(c => c.status === "failed");
    const passed = partyChecks.length > 0 && partyChecks.every(c => c.status === "passed" || c.status === "approved");
    const status: NodeStatus =
      failed ? "blocked" :
      p.verification_status === "verified" ? "complete" :
      partyChecks.length > 0 ? "in_progress" : "pending";
    return {
      id: `party-${p.id}`,
      label: p.shareholder_name || "Unnamed party",
      status,
      meta: p.role,
    };
  });
  if (partyNodes.length === 0) {
    partyNodes.push({ id: "party-empty", label: "No parties added", status: "pending", meta: "Add stakeholders" });
  }

  // Phase 2 — Documentation
  const docNodes: PathNode[] = docs.slice(0, 6).map((d: any) => ({
    id: `doc-${d.id}`,
    label: d.filename || d.doc_type || "Untitled document",
    status:
      d.status === "verified" || d.status === "extracted" ? "complete" :
      d.status === "processing" ? "in_progress" : "pending",
    meta: d.doc_type,
  }));
  if (docNodes.length === 0) {
    docNodes.push({ id: "doc-empty", label: "No documents uploaded", status: "pending" });
  }

  // Phase 3 — Verification & Approvals
  const openDiscrepancies = discrepancies.filter(d => d.status !== "resolved" && d.status !== "waived");
  const verificationNodes: PathNode[] = [
    {
      id: "discrepancies",
      label: "Discrepancy resolution",
      status: openDiscrepancies.length === 0 ? "complete" : openDiscrepancies.some(d => d.severity === "blocker") ? "blocked" : "in_progress",
      meta: `${openDiscrepancies.length} open`,
    },
    ...regs.slice(0, 4).map((r: any) => ({
      id: `reg-${r.id}`,
      label: regulatoryLabel(r.condition_type),
      status: (r.status === "cleared" ? "complete" : r.status === "withdrawn" ? "complete" : r.filed_at ? "in_progress" : "pending") as NodeStatus,
      meta: r.cleared_at ? `Cleared ${fmtDate(r.cleared_at)}` : r.filed_at ? `Filed ${fmtDate(r.filed_at)}` : "Not filed",
      due: r.waiting_period_end,
    })),
    ...approvals.slice(0, 6).map((a: any) => ({
      id: `appr-${a.id}`,
      label: `${approvalLabel(a.approver_role)} approval (${a.approval_side})`,
      status: (a.status === "completed" || a.status === "signed" ? "complete" : a.status === "declined" ? "blocked" : a.status === "sent" || a.status === "viewed" ? "in_progress" : "pending") as NodeStatus,
      owner: a.approver_name,
    })),
  ];

  // Phase 4 — Execution Gate (a single node)
  const cpsSatisfied = conditions.length > 0 && conditions.every((c: any) => c.status === "satisfied");
  const allUpstreamCleared =
    partyNodes.every(n => n.status === "complete") &&
    docNodes.every(n => n.status === "complete") &&
    verificationNodes.every(n => n.status === "complete") &&
    cpsSatisfied;

  const executionNode: PathNode = {
    id: "execution-gate",
    label: "Execution Gate · Wire Pack",
    status: allUpstreamCleared ? "in_progress" : "pending",
    meta: allUpstreamCleared ? "Ready to dispatch" : "Locked — upstream conditions outstanding",
  };

  return [
    { id: "parties",       label: "Parties & Compliance",     icon: Users,      nodes: partyNodes },
    { id: "documentation", label: "Documentation",            icon: FileText,   nodes: docNodes },
    { id: "verification",  label: "Verification & Approvals", icon: ShieldCheck, nodes: verificationNodes },
    { id: "execution",     label: "Execution",                icon: Banknote,   nodes: [executionNode] },
  ];
}

function regulatoryLabel(t: string) {
  const map: Record<string, string> = {
    hsr: "HSR clearance", cfius: "CFIUS review", state_puc: "State PUC", state_banking: "State banking",
    state_insurance: "State insurance", eu_fsr: "EU FSR", uk_nsi: "UK NSI", other: "Other regulatory",
  };
  return map[t] ?? "Regulatory";
}
function approvalLabel(role?: string | null) {
  if (!role) return "Approver";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────
function NodeRow({ node, selected, onSelect }: { node: PathNode; selected: boolean; onSelect: () => void }) {
  const s = statusBadge[node.status];
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-2 py-2 rounded-md transition-colors flex items-start gap-2 group",
        selected ? "bg-accent/20" : "hover:bg-muted/50"
      )}
    >
      <s.Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0",
        node.status === "complete" && "text-emerald-500",
        node.status === "in_progress" && "text-amber-500",
        node.status === "blocked" && "text-destructive",
        node.status === "pending" && "text-muted-foreground/60",
      )} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{node.label}</div>
        {node.meta && <div className="text-[10px] text-muted-foreground truncate">{node.meta}</div>}
      </div>
      <ChevronRight className="w-3 h-3 text-muted-foreground/40 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function DealOverviewPane({ deal, phases, readinessPct }: { deal: any; phases: PhaseGroup[]; readinessPct: number }) {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Closing Command Center</div>
        <h2 className="text-xl font-semibold mt-1">{deal.deal_name}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select a node on the left to act on it. Newton, Comms and the Audit Log on the right will filter to whatever you've focused.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {phases.map(p => {
          const cleared = p.nodes.filter(n => n.status === "complete").length;
          return (
            <Card key={p.id} className="bg-card/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <p.icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase tracking-wider">{p.label}</span>
                </div>
                <div className="text-lg font-mono font-semibold">{cleared}<span className="text-muted-foreground text-sm">/{p.nodes.length}</span></div>
                <div className="text-[10px] text-muted-foreground">cleared</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Closing readiness · {readinessPct}%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {phases.map(p => {
              const cleared = p.nodes.filter(n => n.status === "complete").length;
              const pct = p.nodes.length ? Math.round((cleared / p.nodes.length) * 100) : 0;
              const blocked = p.nodes.some(n => n.status === "blocked");
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{p.label}</span>
                    <span className="font-mono text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-500", blocked ? "bg-destructive" : pct === 100 ? "bg-emerald-500" : "bg-amber-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NodeDetail({ node, dealId, executionLocked, clearedNodes, totalNodes }: {
  node: PathNode; dealId: string; executionLocked: boolean; clearedNodes: number; totalNodes: number;
}) {
  const s = statusBadge[node.status];

  if (node.id === "execution-gate") {
    return <ExecutionGatePane locked={executionLocked} cleared={clearedNodes} total={totalNodes} dealId={dealId} />;
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active node</div>
          <h2 className="text-lg font-semibold mt-0.5">{node.label}</h2>
          {node.meta && <p className="text-xs text-muted-foreground mt-1">{node.meta}</p>}
        </div>
        <Badge variant="outline" className={cn("border", s.cls)}>
          <s.Icon className="w-3 h-3 mr-1" />{s.label}
        </Badge>
      </div>

      <Card className="bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Action</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            This node is wired to existing PIVT data. Use the corresponding workspace surface to update it — changes will reflect here in real time.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={`/deals/${dealId}`}>Open in workspace</Link>
            </Button>
            {node.due && (
              <Badge variant="outline" className="text-[10px]">
                <Clock className="w-3 h-3 mr-1" />Due {fmtDate(node.due)}
              </Badge>
            )}
            {node.owner && (
              <Badge variant="outline" className="text-[10px]">
                <Users className="w-3 h-3 mr-1" />{node.owner}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExecutionGatePane({ locked, cleared, total, dealId }: { locked: boolean; cleared: number; total: number; dealId: string }) {
  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Execution Gate</div>
          <h2 className="text-lg font-semibold mt-0.5">Wire Pack dispatch</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {locked ? "Locked — upstream conditions outstanding." : "All conditions cleared. Ready to dispatch."}
          </p>
        </div>
        <Badge variant="outline" className={cn("border",
          locked ? "bg-muted text-muted-foreground border-border" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        )}>
          {locked ? <Lock className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
          {locked ? "Locked" : "Ready"}
        </Badge>
      </div>

      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Pre-execution checklist</span>
            <span className="text-xs font-mono text-muted-foreground">{cleared} / {total} conditions met</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500", locked ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${total ? Math.round((cleared / total) * 100) : 0}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            This is the immutable audit trail of the closing — read-only, hash-anchored, regulator-grade.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button disabled={locked} className={cn(!locked && "bg-emerald-500 text-white hover:bg-emerald-600")}>
          {locked ? <><Lock className="w-3 h-3 mr-1.5" />Dispatch locked</> : "Dispatch Wire Pack"}
        </Button>
        <Button asChild variant="outline">
          <Link to={`/deals/${dealId}`}>Open execution workspace</Link>
        </Button>
      </div>
    </div>
  );
}

function NewtonInsights({ node, blocked, cleared, total }: { node: PathNode | null; blocked: number; cleared: number; total: number }) {
  const insights = useMemo(() => {
    const list: { tone: "info" | "warn" | "good"; text: string }[] = [];
    if (!node) {
      list.push({ tone: "info", text: `${cleared} of ${total} closing conditions cleared.` });
      if (blocked > 0) list.push({ tone: "warn", text: `${blocked} blocking condition${blocked > 1 ? "s" : ""} require attention.` });
      else list.push({ tone: "good", text: "No blocking conditions detected on the critical path." });
      return list;
    }
    if (node.status === "blocked") list.push({ tone: "warn", text: `${node.label} is blocking downstream execution.` });
    if (node.status === "in_progress") list.push({ tone: "info", text: `${node.label} is in progress.${node.due ? ` Deadline ${fmtDate(node.due)}.` : ""}` });
    if (node.status === "pending") list.push({ tone: "info", text: `${node.label} hasn't been started.` });
    if (node.status === "complete") list.push({ tone: "good", text: `${node.label} cleared.` });
    list.push({ tone: "info", text: "Ask Newton for a recommendation in the deal workspace." });
    return list;
  }, [node, blocked, cleared, total]);

  return (
    <>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pt-1">
        {node ? "Node insights" : "Deal insights"}
      </div>
      {insights.map((i, idx) => (
        <Card key={idx} className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Sparkles className={cn("w-3.5 h-3.5 mt-0.5",
                i.tone === "warn" && "text-destructive",
                i.tone === "good" && "text-emerald-500",
                i.tone === "info" && "text-accent",
              )} />
              <p className="text-xs text-foreground/90 leading-relaxed">{i.text}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function CommsFeed({ comments, sectionFilter }: { comments: any[]; sectionFilter: string | null }) {
  const filtered = sectionFilter
    ? comments.filter(c => c.section_context === sectionFilter)
    : comments;
  if (filtered.length === 0) {
    return <p className="text-xs text-muted-foreground px-1 py-4">No comments {sectionFilter ? "for this node" : "yet"}.</p>;
  }
  return (
    <>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pt-1">
        {sectionFilter ? "Node thread" : "All comments"}
      </div>
      {filtered.map(c => (
        <Card key={c.id} className="bg-card/50">
          <CardContent className="p-3">
            <p className="text-xs text-foreground/90 leading-relaxed">{c.body}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function AuditFeed({ events, nodeFilter }: { events: any[]; nodeFilter: string | null }) {
  const filtered = nodeFilter
    ? events.filter(e => {
        const payload = (e.payload ?? {}) as any;
        return payload?.node_id === nodeFilter || payload?.section === nodeFilter;
      })
    : events;
  if (filtered.length === 0) {
    return <p className="text-xs text-muted-foreground px-1 py-4">No audit events {nodeFilter ? "for this node" : "yet"}.</p>;
  }
  return (
    <>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pt-1">
        {nodeFilter ? "Node history" : "Recent activity"}
      </div>
      {filtered.map(e => (
        <Card key={e.id} className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <History className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-medium">{e.event_type}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{new Date(e.created_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
