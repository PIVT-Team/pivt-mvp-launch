// OrgContext — multi-tenancy at the app level.
//
// Phase-1 design: the user belongs to one or more organizations (one
// personal org created at signup; potentially more after invites). One org
// is "active" at a time — the org switcher in the topbar flips this.
// The active org id is persisted in localStorage so refreshes don't bounce
// the user back to a different org.
//
// Defensive: if the organizations / organization_members tables don't yet
// exist (the migration hasn't been deployed), this context detects the
// "schema missing" condition and goes into a fallback mode where every
// API surface degrades gracefully. The app keeps working in
// single-tenant-like mode until the schema lands.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type OrgType = "customer" | "demo" | "system";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  legal_entity_name: string | null;
  billing_email: string | null;
  org_type: OrgType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Filled in from `organization_memberships.role` for the current user.
   *  Existing schema uses `owner | editor | viewer` (not `owner|admin|member`). */
  my_role?: "owner" | "editor" | "viewer";
}

interface OrgContextValue {
  /** All orgs the current user can see (their own orgs + the demo org). */
  orgs: Organization[];
  /** The org the user is currently scoped to. null while loading or if user belongs to none. */
  activeOrg: Organization | null;
  /** Convenience: just the id of the active org. */
  activeOrgId: string | null;
  /** Whether the multi-tenancy schema has been deployed. False = fallback mode. */
  schemaReady: boolean;
  /** True while the first load is in flight. */
  loading: boolean;
  /** Switch the active org. Persisted to localStorage. */
  setActiveOrgId: (id: string) => void;
  /** Force a refetch (after invite, after create, etc). */
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  activeOrg: null,
  activeOrgId: null,
  schemaReady: false,
  loading: true,
  setActiveOrgId: () => undefined,
  refresh: async () => undefined,
});

const ACTIVE_ORG_KEY = "pivt-active-org-id";

// Schema-missing detection covers BOTH the case where the tables don't
// exist (PGRST205 from Supabase's REST layer, or 42P01 from raw Postgres)
// AND the case where deals.org_id hasn't been added yet (column-missing
// errors when joining via org_id). When this fires we fall into a
// fallback mode so the rest of the app stays usable.
const isSchemaMissing = (err: { code?: string; message?: string } | null | undefined): boolean => {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST204") return true;
  const m = (err.message || "").toLowerCase();
  if (m.includes("could not find the table")) return true;
  if (m.includes("does not exist") && (m.includes("organization") || m.includes("org_id"))) return true;
  if (m.includes("schema cache") && m.includes("organization")) return true;
  return false;
};

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_ORG_KEY); } catch { return null; }
  });
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
    try { localStorage.setItem(ACTIVE_ORG_KEY, id); } catch { /* private-mode no-op */ }
  }, []);

  const fetchOrgs = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // We do two reads: (a) the user's memberships joined with the org row,
    // and (b) the demo org (visible to all authenticated users). If either
    // errors with "relation/column does not exist" we flip schemaReady=false
    // and quietly fall back to single-tenant-like behavior.
    //
    // Note the table name is `organization_memberships` (plural, with the
    // S) — that's the existing repo schema. Columns we expect from the
    // extended migration: slug, org_type, billing_email, created_by,
    // legal_entity_name, updated_at. If the migration hasn't deployed,
    // these will be missing and isSchemaMissing should fire.
    const [membersRes, demoRes] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select("role, org_id, organizations:org_id(*)")
        .eq("user_id", user.id),
      supabase
        .from("organizations")
        .select("*")
        .eq("org_type", "demo")
        .limit(1),
    ]);

    if (isSchemaMissing(membersRes.error) || isSchemaMissing(demoRes.error)) {
      setSchemaReady(false);
      setOrgs([]);
      setLoading(false);
      return;
    }

    if (membersRes.error) {
      console.warn("[OrgContext] failed to load memberships:", membersRes.error.message);
    }

    const memberships = (membersRes.data || []) as Array<{
      role: "owner" | "editor" | "viewer";
      org_id: string;
      organizations: Organization | null;
    }>;
    const own: Organization[] = memberships
      .filter((m) => m.organizations)
      .map((m) => ({ ...(m.organizations as Organization), my_role: m.role }));

    const demoOrg = (demoRes.data || [])[0] as Organization | undefined;
    const all = demoOrg && !own.some((o) => o.id === demoOrg.id) ? [...own, demoOrg] : own;

    setOrgs(all);
    setSchemaReady(true);

    // Pick a sensible default if the persisted activeOrgId is no longer valid
    // (user got removed from that org, etc) or never set. Prefer a customer
    // org owned by this user; fall back to the first non-demo; finally demo.
    setActiveOrgIdState((prev) => {
      if (prev && all.some((o) => o.id === prev)) return prev;
      const ownedCustomer = own.find((o) => o.org_type === "customer");
      const firstCustomer = own.find((o) => o.org_type === "customer");
      const pick = ownedCustomer?.id || firstCustomer?.id || all[0]?.id || null;
      if (pick) {
        try { localStorage.setItem(ACTIVE_ORG_KEY, pick); } catch { /* no-op */ }
      }
      return pick;
    });

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const activeOrg = useMemo(
    () => (activeOrgId ? orgs.find((o) => o.id === activeOrgId) || null : null),
    [orgs, activeOrgId],
  );

  return (
    <OrgContext.Provider
      value={{
        orgs,
        activeOrg,
        activeOrgId,
        schemaReady,
        loading,
        setActiveOrgId,
        refresh: fetchOrgs,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => useContext(OrgContext);
