// WorkspaceSettingsPanel — org-level settings UI for the active workspace.
//
// Phase-2 scope: rename the org, see the members list (with roles),
// leave the org. Invite / accept flow is intentionally out of scope for
// this session — it needs an invite_token table + email sending +
// signup-via-invite-link and that's a Phase 3 piece.
//
// Defensive: if multi-tenancy schema isn't deployed yet, render a
// concise "set up multi-tenancy first" placeholder instead of breaking.

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Users, Edit3, LogOut, Loader2, Check, X, AlertTriangle, CheckCircle2,
  Mail, Copy, Trash2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PersonaTemplateSettings } from "@/components/persona/PersonaTemplateSettings";

interface MemberRow {
  user_id: string;
  role: "owner" | "editor" | "viewer";
  joined_at?: string;
  /** Joined-in metadata — may be missing if the auth.users row isn't visible
   *  to the current user. We render gracefully either way. */
  email?: string | null;
  full_name?: string | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  token: string;
  expires_at: string;
  created_at: string;
}

export const WorkspaceSettingsPanel: React.FC = () => {
  const { user } = useAuth();
  const { activeOrg, schemaReady, loading: orgLoading, refresh: refreshOrgs, setActiveOrgId, orgs } = useOrg();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // ── Load members for the active workspace ──
  const loadMembers = useCallback(async () => {
    if (!activeOrg || !schemaReady) return;
    setMembersLoading(true);
    try {
      // Plain membership rows. Joining auth.users isn't directly possible
      // from the anon client; we resolve names/emails for the CURRENT user
      // (from useAuth) and leave others as "Teammate" until Phase 3's
      // proper profiles table arrives.
      const { data, error } = await supabase
        .from("organization_memberships")
        .select("user_id, role, created_at")
        .eq("org_id", activeOrg.id)
        .order("created_at");
      if (error) throw error;
      const rows = (data || []) as Array<{ user_id: string; role: MemberRow["role"]; created_at: string }>;
      setMembers(
        rows.map((r) => ({
          user_id: r.user_id,
          role: r.role,
          joined_at: r.created_at,
          email: r.user_id === user?.id ? user.email : null,
          full_name: r.user_id === user?.id
            ? ((user.user_metadata as any)?.full_name ?? null)
            : null,
        })),
      );
    } catch (err: any) {
      console.warn("[WorkspaceSettings] load members failed:", err?.message);
    } finally {
      setMembersLoading(false);
    }
  }, [activeOrg, schemaReady, user?.id, user?.email, user?.user_metadata]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ── Load pending invites for the active workspace ──
  const loadInvites = useCallback(async () => {
    if (!activeOrg || !schemaReady) return;
    setInvitesLoading(true);
    try {
      const { data, error } = await supabase
        .from("organization_invites")
        .select("id, email, role, token, expires_at, created_at")
        .eq("org_id", activeOrg.id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) {
        // Migration not deployed yet — soft-fail, don't render the section.
        if (error.code === "PGRST205" || error.code === "42P01") {
          setInvites([]);
          return;
        }
        throw error;
      }
      setInvites((data || []) as InviteRow[]);
    } catch (err: any) {
      console.warn("[WorkspaceSettings] load invites failed:", err?.message);
    } finally {
      setInvitesLoading(false);
    }
  }, [activeOrg, schemaReady]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  // Re-seed the rename input whenever the active org changes.
  useEffect(() => {
    setRenameValue(activeOrg?.name || "");
  }, [activeOrg?.name]);

  // Clear the success-link banner whenever the dialog closes.
  useEffect(() => {
    if (!inviteOpen) {
      setLastInviteLink(null);
      setLinkCopied(false);
    }
  }, [inviteOpen]);

  if (!schemaReady) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-3xl">
        <section className="pivt-card p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">Workspaces not yet activated</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Multi-tenancy is staged on dev but the database migration hasn't been deployed for this project. See
                <code className="mx-1 text-[11px] bg-muted/60 px-1 py-0.5 rounded">MULTI_TENANCY_DEPLOY.md</code>
                for the one-step setup. Once deployed, this panel will show your active workspace, members, and let you rename / leave.
              </p>
            </div>
          </div>
        </section>
      </motion.div>
    );
  }

  if (orgLoading || !activeOrg) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading workspace…
      </div>
    );
  }

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isAdmin = myMembership?.role === "owner" || myMembership?.role === "editor";
  const isOwner = myMembership?.role === "owner";
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const isDemoWorkspace = activeOrg.org_type === "demo";

  // ── Rename ──
  const handleRename = async () => {
    if (!activeOrg) return;
    const next = renameValue.trim();
    if (!next || next === activeOrg.name) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: next, updated_at: new Date().toISOString() })
        .eq("id", activeOrg.id);
      if (error) throw error;
      toast.success(`Workspace renamed to "${next}"`);
      setRenameOpen(false);
      await refreshOrgs();
    } catch (err: any) {
      toast.error(`Rename failed: ${err?.message ?? "unknown"}`);
    } finally {
      setRenaming(false);
    }
  };

  // ── Invite teammate ──
  // Creates an organization_invites row + returns a shareable accept URL.
  // The admin shares the link however they want (email, Slack, etc).
  // A future iteration will hand off to an edge function that sends via
  // Resend automatically — see Phase 4.
  const handleInvite = async () => {
    if (!activeOrg || !user?.id) return;
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase
        .from("organization_invites")
        .insert({
          org_id: activeOrg.id,
          email: email.toLowerCase(),
          role: inviteRole,
          invited_by: user.id,
        })
        .select("token")
        .single();
      if (error) throw error;
      const link = `${window.location.origin}/accept-invite?token=${data.token}`;
      setLastInviteLink(link);
      // Best-effort clipboard so the admin doesn't have to copy manually.
      try {
        await navigator.clipboard.writeText(link);
        setLinkCopied(true);
      } catch { /* no clipboard in this browser */ }
      // Audit log — keeps the workspace's history complete.
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "org_invite_created",
        details: { org_id: activeOrg.id, email, role: inviteRole },
      });
      await loadInvites();
    } catch (err: any) {
      // Common case: duplicate invite (unique partial index on
      // (org_id, lower(email)) where pending). Surface a useful message.
      if (err?.code === "23505" || /duplicate key/.test(err?.message || "")) {
        toast.error(`A pending invite to ${email} already exists. Revoke it first to re-invite.`);
      } else {
        toast.error(`Couldn't create invite: ${err?.message ?? "unknown"}`);
      }
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!lastInviteLink) return;
    try {
      await navigator.clipboard.writeText(lastInviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Could not copy automatically — select the link and copy manually.");
    }
  };

  const handleRevoke = async (invite: InviteRow) => {
    if (!user?.id) return;
    setRevokingId(invite.id);
    try {
      const { error } = await supabase
        .from("organization_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "org_invite_revoked",
        details: { invite_id: invite.id, email: invite.email },
      });
      toast.success(`Revoked invite to ${invite.email}`);
      await loadInvites();
    } catch (err: any) {
      toast.error(`Revoke failed: ${err?.message ?? "unknown"}`);
    } finally {
      setRevokingId(null);
    }
  };

  // ── Leave (member removes self) ──
  const confirmLeave = async () => {
    if (!user?.id || !activeOrg) return;
    if (isOwner && ownerCount === 1) {
      toast.error(
        "You're the only owner. Promote another member to owner first, or delete the workspace instead.",
      );
      setLeaveOpen(false);
      return;
    }
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("organization_memberships")
        .delete()
        .eq("org_id", activeOrg.id)
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success(`Left ${activeOrg.name}`);
      // Refresh + switch to whichever workspace we still belong to.
      await refreshOrgs();
      const remaining = orgs.filter((o) => o.id !== activeOrg.id && o.org_type === "customer");
      if (remaining[0]) setActiveOrgId(remaining[0].id);
      setLeaveOpen(false);
    } catch (err: any) {
      toast.error(`Leave failed: ${err?.message ?? "unknown"}`);
    } finally {
      setLeaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      {/* ── Active workspace + rename ── */}
      <section className="pivt-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent" />
            <h3 className="font-semibold">Workspace</h3>
            {isDemoWorkspace && (
              <Badge className="bg-accent/10 text-accent text-[10px]">Demo (read-only)</Badge>
            )}
          </div>
          {isAdmin && !isDemoWorkspace && (
            <Button variant="outline" size="sm" onClick={() => setRenameOpen(true)} className="gap-1.5">
              <Edit3 className="w-3.5 h-3.5" /> Rename
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Name</p>
            <p className="font-medium">{activeOrg.name}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</p>
            <p className="font-medium capitalize">{activeOrg.org_type}</p>
          </div>
          {activeOrg.slug && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Slug</p>
              <p className="font-mono text-xs">{activeOrg.slug}</p>
            </div>
          )}
          {activeOrg.billing_email && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Billing email</p>
              <p className="font-medium">{activeOrg.billing_email}</p>
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Your role</p>
            <p className="font-medium capitalize">{myMembership?.role ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Created</p>
            <p className="font-medium">{new Date(activeOrg.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </section>

      {/* ── Members ── */}
      <section className="pivt-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="font-semibold">Members</h3>
            <Badge variant="outline" className="text-[10px]">{members.length}</Badge>
          </div>
          {isAdmin && !isDemoWorkspace && (
            <Button variant="outline" size="sm" onClick={() => { setInviteEmail(""); setInviteRole("editor"); setInviteOpen(true); }} className="gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Invite teammate
            </Button>
          )}
        </div>
        {membersLoading ? (
          <div className="py-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading members…
          </div>
        ) : members.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">No members yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">
                    {m.full_name || m.email || (m.user_id === user?.id ? "You" : "Teammate")}
                    {m.user_id === user?.id && <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>}
                  </p>
                  {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                  {!m.email && <p className="text-[10px] font-mono text-muted-foreground/70">{m.user_id.slice(0, 8)}…</p>}
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{m.role}</Badge>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Invited teammates auto-create their account on first sign-in and join with the role you chose.
        </p>
      </section>

      {/* ── Pending invites ── */}
      {isAdmin && !isDemoWorkspace && (invitesLoading || invites.length > 0) && (
        <section className="pivt-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            <h3 className="font-semibold">Pending invites</h3>
            <Badge variant="outline" className="text-[10px]">{invites.length}</Badge>
          </div>
          {invitesLoading ? (
            <div className="py-4 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading invites…
            </div>
          ) : (
            <div className="divide-y divide-border">
              {invites.map((inv) => {
                const expiresIn = Math.max(0, Math.round((new Date(inv.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                const link = `${window.location.origin}/accept-invite?token=${inv.token}`;
                return (
                  <div key={inv.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{inv.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Role: <span className="capitalize">{inv.role}</span> · Expires in {expiresIn} day{expiresIn === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(link); toast.success('Invite link copied'); }
                        catch { toast.error('Copy failed — select the link manually'); }
                      }}
                      title="Copy invite link"
                      className="gap-1.5 text-xs"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(inv)}
                      disabled={revokingId === inv.id}
                      className="gap-1.5 text-xs text-destructive hover:bg-destructive/5"
                      title="Revoke invite"
                    >
                      {revokingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Persona identity verification (per-org templates) ── */}
      {!isDemoWorkspace && (
        <PersonaTemplateSettings orgId={activeOrg.id} canManage={isAdmin} />
      )}

      {/* ── Leave ── */}
      {!isDemoWorkspace && myMembership && (
        <section className="pivt-card p-6 space-y-4 border-destructive/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold text-destructive">Leave workspace</h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)} className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5">
              <LogOut className="w-3.5 h-3.5" /> Leave
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Removes your access to {activeOrg.name}. You won't be able to see this workspace's deals afterwards. {isOwner && ownerCount === 1 && (
              <span className="text-destructive font-medium">You're the only owner — promote another member to owner first.</span>
            )}
          </p>
        </section>
      )}

      {/* ── Invite dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) setInviteOpen(false); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Invite a teammate to {activeOrg.name}</DialogTitle>
            <DialogDescription>
              They'll get a one-time-use link valid for 14 days. When they sign in (or sign up) using the link, they'll automatically join {activeOrg.name} with the role you choose.
            </DialogDescription>
          </DialogHeader>
          {!lastInviteLink ? (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@firm.com"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v: "editor" | "viewer") => setInviteRole(v)}>
                    <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">
                        <div>
                          <div className="font-medium">Editor</div>
                          <div className="text-[11px] text-muted-foreground">Can create + manage deals, invite teammates</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <div>
                          <div className="font-medium">Viewer</div>
                          <div className="text-[11px] text-muted-foreground">Read-only access to deals in this workspace</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  <Mail className="w-3.5 h-3.5 mr-1.5" /> Create invite link
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <div className="rounded-md border border-validated/30 bg-validated/5 p-3 text-sm text-foreground flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-validated mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Invite created{linkCopied ? ' and link copied to clipboard' : ''}.</p>
                    <p className="text-xs text-muted-foreground mt-1">Send this link to {inviteEmail.trim()} — once they open it they'll join {activeOrg.name}.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Invite link</Label>
                  <div className="flex gap-2">
                    <Input value={lastInviteLink} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button onClick={handleCopyLink} variant="outline" className="gap-1.5 shrink-0">
                      <Copy className="w-3.5 h-3.5" /> {linkCopied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Link expires in 14 days. Anyone with it can join {activeOrg.name} once.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Done</Button>
                <Button onClick={() => { setLastInviteLink(null); setInviteEmail(''); setLinkCopied(false); }}>
                  <Mail className="w-3.5 h-3.5 mr-1.5" /> Invite another
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Rename dialog ── */}
      <AlertDialog open={renameOpen} onOpenChange={(o) => { if (!o) setRenameOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename workspace</AlertDialogTitle>
            <AlertDialogDescription>This updates the name shown in the topbar switcher and on deal records.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 my-2">
            <Label htmlFor="rename">New name</Label>
            <Input id="rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRename(); }}
              disabled={renaming || !renameValue.trim() || renameValue.trim() === activeOrg.name}
            >
              {renaming && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              <Check className="w-3.5 h-3.5 mr-1.5" /> Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Leave confirmation ── */}
      <AlertDialog open={leaveOpen} onOpenChange={(o) => { if (!o) setLeaveOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-destructive" /> Leave {activeOrg.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose access to this workspace's deals. Existing audit-log entries you created stay attributed to you, but you won't see them from this workspace anymore.
              {isOwner && ownerCount === 1 && (
                <span className="block mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive text-xs">
                  <strong>Blocked:</strong> You're the only owner. Promote a teammate to owner first, or delete the workspace entirely.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmLeave(); }}
              disabled={leaving || (isOwner && ownerCount === 1)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Leave workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};
