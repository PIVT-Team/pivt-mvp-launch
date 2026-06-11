// OrgSwitcher — topbar dropdown for picking the active organization.
//
// Behaviors:
//   - Shows active org name + a small caret (matches the look of existing
//     topbar pills like AI Deal Scan / Import / See Demo).
//   - Dropdown lists the user's customer orgs, a separator, the demo org
//     (with a "Demo" pill so it's obvious), and a "Create new workspace"
//     CTA at the bottom.
//   - Switching the org persists to localStorage via OrgContext.
//   - If the multi-tenancy schema hasn't been deployed yet (`schemaReady`
//     false), we render a single non-interactive pill labelled "Setup
//     required" that links to the production checklist — keeps the UI
//     readable without the rest of the app breaking.
//   - Hidden entirely if the user isn't signed in (the auth guard handles
//     other pages, but defensive in case this gets used elsewhere).

import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2, Check, ChevronDown, Plus, PlayCircle, AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const OrgSwitcher: React.FC = () => {
  const { user } = useAuth();
  const { orgs, activeOrg, schemaReady, loading, setActiveOrgId, refresh } = useOrg();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBilling, setNewBilling] = useState("");
  const [creating, setCreating] = useState(false);

  // Hide entirely on unauthenticated routes.
  if (!user) return null;

  // Fallback: schema isn't deployed yet. Keep the app usable; surface the
  // gap so admins know what to do.
  if (!schemaReady) {
    return (
      <Link
        to="/contact"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 transition-colors text-xs font-medium"
        title="Multi-tenancy schema not deployed yet — see PRODUCTION_CHECKLIST.md"
      >
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Workspace setup needed</span>
      </Link>
    );
  }

  // Loading shim while the first fetch is in flight. Same shape as the
  // resolved button so the topbar doesn't jump.
  if (loading || !activeOrg) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 text-muted-foreground text-xs">
        <Building2 className="w-3.5 h-3.5" />
        <span className="opacity-50">Loading…</span>
      </div>
    );
  }

  const customerOrgs = orgs.filter((o) => o.org_type === "customer");
  const demoOrg = orgs.find((o) => o.org_type === "demo");
  const isDemoActive = activeOrg.org_type === "demo";

  const createOrg = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      // Use the create_workspace() SECURITY DEFINER RPC so org + owner
      // membership are inserted atomically without hitting the RLS chicken-
      // and-egg on organization_memberships. (The prior client-side two-step
      // insert was blocked by the policy that requires you to already be a
      // member to insert membership rows. The RPC bypasses RLS but only
      // ever makes the caller the owner — never lets you grant access to
      // someone else.)
      const { data: newOrgId, error: rpcErr } = await (supabase as any).rpc(
        "create_workspace",
        {
          workspace_name: newName.trim(),
          billing_email_in: newBilling.trim() || null,
        },
      );
      if (rpcErr || !newOrgId) throw rpcErr ?? new Error("No workspace id returned");

      toast.success(`${newName.trim()} created`);
      setNewName("");
      setNewBilling("");
      setCreateOpen(false);
      await refresh();
      setActiveOrgId(newOrgId as string);
    } catch (err: any) {
      toast.error(`Could not create workspace: ${err?.message || "unknown"}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
              isDemoActive
                ? "bg-accent/10 text-accent hover:bg-accent/20"
                : "bg-muted/30 text-foreground hover:bg-muted/50"
            }`}
            title={`Active workspace: ${activeOrg.name}`}
          >
            {isDemoActive ? (
              <PlayCircle className="w-3.5 h-3.5" />
            ) : (
              <Building2 className="w-3.5 h-3.5" />
            )}
            <span className="max-w-[140px] truncate">{activeOrg.name}</span>
            {isDemoActive && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-accent/40 text-accent">Demo</Badge>
            )}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Your workspaces
          </DropdownMenuLabel>
          {customerOrgs.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              You don't belong to any customer workspace yet.
            </div>
          )}
          {customerOrgs.map((o) => (
            <DropdownMenuItem key={o.id} onClick={() => setActiveOrgId(o.id)} className="gap-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{o.name}</span>
              {o.my_role && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">{o.my_role}</Badge>
              )}
              {activeOrg.id === o.id && <Check className="w-3.5 h-3.5 text-accent" />}
            </DropdownMenuItem>
          ))}
          {demoOrg && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Explore
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setActiveOrgId(demoOrg.id)} className="gap-2">
                <PlayCircle className="w-3.5 h-3.5 text-accent" />
                <span className="flex-1 truncate">{demoOrg.name}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-accent/40 text-accent">Demo</Badge>
                {activeOrg.id === demoOrg.id && <Check className="w-3.5 h-3.5 text-accent" />}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2 text-accent">
            <Plus className="w-3.5 h-3.5" />
            Create new workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create a new workspace</DialogTitle>
            <DialogDescription>
              A workspace is what your firm or team operates in. You'll be the owner and can invite teammates afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Workspace name</Label>
              <Input id="org-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Atlas Capital" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-billing">Billing email <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="org-billing" type="email" value={newBilling} onChange={(e) => setNewBilling(e.target.value)} placeholder={user.email || "billing@…"} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={createOrg} disabled={creating || !newName.trim()}>
              {creating ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
