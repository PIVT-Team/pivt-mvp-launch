// AcceptInvitePage — landing page for /accept-invite?token=...
//
// Three states:
//   - Loading: validating the token (looking up the row + its org).
//   - Signed-out: shows org name + role + "Sign in to accept", routes to
//     /login?next=/accept-invite?token=... so the same URL is returned to
//     after auth (works for both Sign In and Sign Up).
//   - Signed-in: shows a single "Accept and join" button that calls the
//     accept_organization_invite RPC, then redirects into the workspace.
//
// Defensive: if the migration isn't deployed yet (PGRST205 / 42P01), the
// page renders an error pointing at MULTI_TENANCY_DEPLOY.md so the admin
// who sent the link knows what's wrong.

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2, CheckCircle2, AlertCircle, Loader2, LogIn, UserPlus, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";

type PageState = "loading" | "ready" | "expired" | "revoked" | "used" | "not_found" | "schema_missing" | "error";

interface InviteDetails {
  org_name: string;
  org_type: string;
  role: "owner" | "editor" | "viewer";
  email: string;
  expires_at: string;
  invited_by_name: string | null;
}

const AcceptInvitePage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, loading: authLoading } = useAuth();
  const { setActiveOrgId, refresh: refreshOrgs } = useOrg();
  const navigate = useNavigate();

  const [state, setState] = useState<PageState>("loading");
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [accepting, setAccepting] = useState(false);

  // Load invite details on mount. Doesn't require auth — anyone with a token
  // can preview what org they're being invited to.
  useEffect(() => {
    if (!token) {
      setState("not_found");
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("organization_invites")
          .select("email, role, expires_at, accepted_at, revoked_at, org_id, organizations:org_id(name, org_type)")
          .eq("token", token)
          .maybeSingle();

        if (error) {
          if (error.code === "PGRST205" || error.code === "42P01") {
            setState("schema_missing");
            return;
          }
          throw error;
        }
        if (!data) {
          setState("not_found");
          return;
        }

        // Token is valid — figure out which state to render.
        if (data.revoked_at) { setState("revoked"); return; }
        if (data.accepted_at) { setState("used"); return; }
        if (new Date(data.expires_at).getTime() < Date.now()) { setState("expired"); return; }

        const org = (data as any).organizations || {};
        setDetails({
          org_name: org.name || "this workspace",
          org_type: org.org_type || "customer",
          role: data.role as InviteDetails["role"],
          email: data.email,
          expires_at: data.expires_at,
          invited_by_name: null,
        });
        setState("ready");
      } catch (e: any) {
        setErrorMsg(e?.message || "Could not load invite");
        setState("error");
      }
    })();
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc("accept_organization_invite", { _token: token });
      if (error) throw error;
      const orgId = (data as any)?.org_id;
      if (orgId) {
        setActiveOrgId(orgId);
        await refreshOrgs();
        toast.success(`Joined ${details?.org_name}`);
        // Land them on the workspace's Deals view.
        navigate(`/?section=deals`);
      } else {
        toast.success("Joined successfully");
        navigate("/");
      }
    } catch (e: any) {
      const msg = e?.message || "Could not accept invite";
      // Friendlier message for the well-known error cases.
      if (/already used|already accepted/i.test(msg)) setState("used");
      else if (/expired/i.test(msg)) setState("expired");
      else if (/revoked/i.test(msg)) setState("revoked");
      else {
        setErrorMsg(msg);
        setState("error");
      }
    } finally {
      setAccepting(false);
    }
  };

  // Build a /login link that returns the user here after authenticating.
  const loginNextParam = encodeURIComponent(`/accept-invite?token=${token || ""}`);

  return (
    <div className="min-h-screen flex items-center justify-center pivt-ambient-bg px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md"
      >
        <div className="pivt-card p-8 space-y-6">
          <header className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--pivt-gradient-primary)' }}>
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">PIVT Workspace Invitation</p>
          </header>

          {state === "loading" || authLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Validating your invite…
            </div>
          ) : state === "not_found" ? (
            <ErrorPanel
              title="Invite not found"
              message="The link is malformed or the invite no longer exists. Ask your teammate to send a fresh invite."
            />
          ) : state === "expired" ? (
            <ErrorPanel
              title="This invite expired"
              message="Invite links are good for 14 days. Ask the workspace admin to create a new one."
            />
          ) : state === "revoked" ? (
            <ErrorPanel
              title="This invite was revoked"
              message="The workspace admin cancelled this invite. Ask them to send a new one if you should still have access."
            />
          ) : state === "used" ? (
            <ErrorPanel
              title="Invite already used"
              message="This invite was already accepted. If you're the one who used it, you should already see the workspace once you sign in."
              actionLabel="Sign in"
              actionTo="/login"
            />
          ) : state === "schema_missing" ? (
            <ErrorPanel
              title="Workspace setup incomplete"
              message="Multi-tenancy is configured on this app but the database migration hasn't been applied. Ask the project owner to run the migration described in MULTI_TENANCY_DEPLOY.md."
            />
          ) : state === "error" ? (
            <ErrorPanel
              title="Something went wrong"
              message={errorMsg || "Please try again, or ask the workspace admin to re-send the invite."}
            />
          ) : details && (
            <>
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">You've been invited to join</p>
                  <h1 className="text-2xl font-semibold text-foreground flex items-center justify-center gap-2">
                    <Building2 className="w-5 h-5 text-accent" />
                    {details.org_name}
                  </h1>
                </div>
                <div className="rounded-lg bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Invited as</span>
                    <Badge variant="outline" className="capitalize">{details.role}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Invitation for</span>
                    <span className="font-mono text-xs">{details.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span className="text-xs">{new Date(details.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              {!user ? (
                // Signed-out: prompt to sign in or sign up; both come back here.
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">
                    Sign in (or sign up) with <span className="font-mono">{details.email}</span> to accept this invitation.
                  </p>
                  <Button asChild className="w-full pivt-btn-primary gap-2">
                    <Link to={`/login?next=${loginNextParam}`}>
                      <LogIn className="w-4 h-4" /> Sign in to accept
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full gap-2">
                    <Link to={`/login?next=${loginNextParam}`}>
                      <UserPlus className="w-4 h-4" /> Don't have an account? Sign up
                    </Link>
                  </Button>
                </div>
              ) : user.email && user.email.toLowerCase() !== details.email.toLowerCase() ? (
                // Signed in as the wrong account.
                <div className="space-y-3">
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      You're signed in as <strong>{user.email}</strong> but this invite was sent to <strong>{details.email}</strong>. You can still accept (the membership lands on your current account) — or sign out and try again with the intended email.
                    </div>
                  </div>
                  <Button onClick={accept} disabled={accepting} className="w-full pivt-btn-primary gap-2">
                    {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Accept anyway and join {details.org_name}
                  </Button>
                </div>
              ) : (
                <Button onClick={accept} disabled={accepting} className="w-full pivt-btn-primary gap-2">
                  {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Accept and join {details.org_name}
                </Button>
              )}
            </>
          )}
        </div>
        <p className="text-center text-[11px] text-muted-foreground/70 mt-4">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span className="mx-1.5">·</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span className="mx-1.5">·</span>
          <Link to="/dpa" className="hover:text-foreground transition-colors">DPA</Link>
        </p>
      </motion.div>
    </div>
  );
};

const ErrorPanel: React.FC<{ title: string; message: string; actionLabel?: string; actionTo?: string }> = ({ title, message, actionLabel, actionTo }) => (
  <div className="text-center space-y-3">
    <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
      <AlertCircle className="w-5 h-5 text-destructive" />
    </div>
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{message}</p>
    </div>
    {actionLabel && actionTo && (
      <Button asChild variant="outline" className="gap-1.5">
        <Link to={actionTo}>{actionLabel}</Link>
      </Button>
    )}
  </div>
);

export default AcceptInvitePage;
