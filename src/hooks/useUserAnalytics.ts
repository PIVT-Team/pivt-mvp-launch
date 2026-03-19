import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  organization: string | null;
  created_at: string;
  last_login: string | null;
  login_count: number;
  deals_created: number;
  documents_uploaded: number;
  newton_sessions: number;
  stakeholders_added: number;
  support_tickets: number;
  engagement_score: "high" | "medium" | "low" | "dormant";
  status: "active" | "inactive" | "new";
}

function computeEngagement(loginCount: number, dealsCreated: number, docsUploaded: number, newtonSessions: number, lastLogin: string | null): "high" | "medium" | "low" | "dormant" {
  const daysSinceLogin = lastLogin ? (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24) : 999;
  const activityScore = loginCount * 1 + dealsCreated * 3 + docsUploaded * 2 + newtonSessions * 2;
  
  if (daysSinceLogin > 30) return "dormant";
  if (activityScore >= 15 && daysSinceLogin < 7) return "high";
  if (activityScore >= 5) return "medium";
  return "low";
}

function computeStatus(lastLogin: string | null, created_at: string): "active" | "inactive" | "new" {
  const daysSinceCreation = (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24);
  const daysSinceLogin = lastLogin ? (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24) : 999;
  
  if (daysSinceCreation < 7 && daysSinceLogin > 3) return "new";
  if (daysSinceLogin > 14) return "inactive";
  return "active";
}

export function useUserDirectory() {
  return useQuery<UserProfile[]>({
    queryKey: ["admin-user-directory"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, organization, created_at");
      
      if (!profiles || profiles.length === 0) return [];

      // Fetch auth events for login data
      const { data: authEvents } = await supabase
        .from("auth_events")
        .select("user_id, email, event_type, created_at")
        .in("event_type", ["user_login", "account_created"]);

      // Fetch deals per user
      const { data: deals } = await supabase
        .from("deals")
        .select("created_by")
        .neq("visibility", "global_demo")
        .not("created_by", "is", null);

      // Fetch documents per user
      const { data: docs } = await supabase
        .from("contract_documents")
        .select("uploaded_by")
        .not("uploaded_by", "is", null);

      // Fetch newton runs per user
      const { data: agentRuns } = await supabase
        .from("agent_runs")
        .select("triggered_by")
        .not("triggered_by", "is", null);

      // Fetch stakeholders per user
      const { data: stakeholders } = await supabase
        .from("cap_table_entries")
        .select("created_by_user_id")
        .not("created_by_user_id", "is", null);

      // Fetch support tickets
      const { data: tickets } = await supabase
        .from("contact_submissions")
        .select("related_user_id, email");

      const events = authEvents ?? [];
      const dealsList = deals ?? [];
      const docsList = docs ?? [];
      const runsList = agentRuns ?? [];
      const stakeholdersList = stakeholders ?? [];
      const ticketsList = tickets ?? [];

      // Build per-user maps
      const loginMap = new Map<string, { count: number; lastLogin: string; email: string }>();
      events.forEach(e => {
        if (e.event_type === "user_login" && e.user_id) {
          const existing = loginMap.get(e.user_id);
          if (!existing) {
            loginMap.set(e.user_id, { count: 1, lastLogin: e.created_at, email: e.email ?? "" });
          } else {
            existing.count++;
            if (e.created_at > existing.lastLogin) existing.lastLogin = e.created_at;
            if (e.email) existing.email = e.email;
          }
        }
      });

      // Email map from account_created events
      const emailMap = new Map<string, string>();
      events.forEach(e => {
        if (e.user_id && e.email) emailMap.set(e.user_id, e.email);
      });

      const dealCounts = dealsList.reduce<Record<string, number>>((acc, d) => {
        if (d.created_by) acc[d.created_by] = (acc[d.created_by] || 0) + 1;
        return acc;
      }, {});

      const docCounts = docsList.reduce<Record<string, number>>((acc, d) => {
        if (d.uploaded_by) acc[d.uploaded_by] = (acc[d.uploaded_by] || 0) + 1;
        return acc;
      }, {});

      const newtonCounts = runsList.reduce<Record<string, number>>((acc, r) => {
        if (r.triggered_by) acc[r.triggered_by] = (acc[r.triggered_by] || 0) + 1;
        return acc;
      }, {});

      const stakeholderCounts = stakeholdersList.reduce<Record<string, number>>((acc, s) => {
        if (s.created_by_user_id) acc[s.created_by_user_id] = (acc[s.created_by_user_id] || 0) + 1;
        return acc;
      }, {});

      // Match tickets by email
      const ticketCountsByEmail = ticketsList.reduce<Record<string, number>>((acc, t) => {
        const email = t.email?.toLowerCase();
        if (email) acc[email] = (acc[email] || 0) + 1;
        return acc;
      }, {});

      return profiles.map(p => {
        const login = loginMap.get(p.user_id);
        const email = emailMap.get(p.user_id) ?? login?.email ?? "";
        const loginCount = login?.count ?? 0;
        const lastLogin = login?.lastLogin ?? null;
        const dealsCreated = dealCounts[p.user_id] ?? 0;
        const docsUploaded = docCounts[p.user_id] ?? 0;
        const newtonSessions = newtonCounts[p.user_id] ?? 0;
        const stakeholdersAdded = stakeholderCounts[p.user_id] ?? 0;
        const supportTickets = ticketCountsByEmail[email.toLowerCase()] ?? 0;

        return {
          user_id: p.user_id,
          full_name: p.full_name || "Unnamed User",
          email,
          organization: p.organization,
          created_at: p.created_at,
          last_login: lastLogin,
          login_count: loginCount,
          deals_created: dealsCreated,
          documents_uploaded: docsUploaded,
          newton_sessions: newtonSessions,
          stakeholders_added: stakeholdersAdded,
          support_tickets: supportTickets,
          engagement_score: computeEngagement(loginCount, dealsCreated, docsUploaded, newtonSessions, lastLogin),
          status: computeStatus(lastLogin, p.created_at),
        };
      });
    },
    refetchInterval: 60_000,
  });
}

export function useUserDetail(userId: string) {
  return useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const [profileRes, authEventsRes, dealsRes, docsRes, agentRunsRes, stakeholdersRes, dealEventsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("auth_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
        supabase.from("deals").select("*").eq("created_by", userId).neq("visibility", "global_demo").order("created_at", { ascending: false }),
        supabase.from("contract_documents").select("*").eq("uploaded_by", userId).order("created_at", { ascending: false }),
        supabase.from("agent_runs").select("*").eq("triggered_by", userId).order("created_at", { ascending: false }),
        supabase.from("cap_table_entries").select("*").eq("created_by_user_id", userId),
        supabase.from("deal_events").select("*").eq("actor_id", userId).order("created_at", { ascending: false }).limit(100),
      ]);

      const authEvents = authEventsRes.data ?? [];
      const logins = authEvents.filter(e => e.event_type === "user_login");
      const email = authEvents.find(e => e.email)?.email ?? "";

      // Build timeline from all events
      const timeline: Array<{ id: string; type: string; description: string; timestamp: string; category: string }> = [];

      authEvents.forEach(e => {
        const labels: Record<string, string> = {
          account_created: "Created an account",
          user_login: "Logged in",
          user_logout: "Logged out",
          failed_login_attempt: "Failed login attempt",
        };
        timeline.push({
          id: e.id,
          type: e.event_type,
          description: labels[e.event_type] ?? e.event_type,
          timestamp: e.created_at,
          category: "auth",
        });
      });

      (dealsRes.data ?? []).forEach(d => {
        timeline.push({
          id: d.id,
          type: "deal_created",
          description: `Created deal "${d.deal_name}"`,
          timestamp: d.created_at,
          category: "deal",
        });
      });

      (docsRes.data ?? []).forEach(d => {
        timeline.push({
          id: d.id,
          type: "document_uploaded",
          description: `Uploaded "${d.filename}"`,
          timestamp: d.uploaded_at ?? d.created_at,
          category: "document",
        });
      });

      (agentRunsRes.data ?? []).forEach(r => {
        timeline.push({
          id: r.id,
          type: "newton_run",
          description: `Newton ${r.agent_type.replace(/_/g, " ")} — ${r.status}`,
          timestamp: r.created_at,
          category: "newton",
        });
      });

      (dealEventsRes.data ?? []).forEach(e => {
        timeline.push({
          id: e.id,
          type: e.event_type,
          description: `${e.event_type.replace(/_/g, " ")}${e.new_state ? ` → ${e.new_state}` : ""}`,
          timestamp: e.created_at,
          category: "workflow",
        });
      });

      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Days active in last 30
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const activeDays = new Set(
        logins
          .filter(l => new Date(l.created_at).getTime() > thirtyDaysAgo)
          .map(l => new Date(l.created_at).toISOString().slice(0, 10))
      ).size;

      return {
        profile: profileRes.data,
        email,
        loginCount: logins.length,
        lastLogin: logins[0]?.created_at ?? null,
        firstLogin: logins.length > 0 ? logins[logins.length - 1].created_at : null,
        dealsCreated: dealsRes.data?.length ?? 0,
        deals: dealsRes.data ?? [],
        documentsUploaded: docsRes.data?.length ?? 0,
        documents: docsRes.data ?? [],
        newtonRuns: agentRunsRes.data?.length ?? 0,
        newtonCompleted: (agentRunsRes.data ?? []).filter(r => r.status === "completed").length,
        newtonFailed: (agentRunsRes.data ?? []).filter(r => r.status === "failed").length,
        stakeholdersAdded: stakeholdersRes.data?.length ?? 0,
        activeDaysLast30: activeDays,
        timeline: timeline.slice(0, 200),
      };
    },
    enabled: !!userId,
  });
}

export function useAdminUserOverview() {
  return useQuery({
    queryKey: ["admin-user-overview"],
    queryFn: async () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [profilesRes, authEventsRes, dealsRes, docsRes, agentRunsRes, ticketsRes, discrepanciesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, created_at", { count: "exact" }),
        supabase.from("auth_events").select("user_id, event_type, created_at").gte("created_at", monthAgo).limit(1000),
        supabase.from("deals").select("id, created_by, created_at").neq("visibility", "global_demo"),
        supabase.from("contract_documents").select("id, uploaded_by, created_at"),
        supabase.from("agent_runs").select("id, triggered_by, status, created_at"),
        supabase.from("contact_submissions").select("id, status"),
        supabase.from("discrepancies").select("id, severity, status").eq("status", "open"),
      ]);

      const profiles = profilesRes.data ?? [];
      const events = authEventsRes.data ?? [];
      const deals = dealsRes.data ?? [];
      const docs = docsRes.data ?? [];
      const agentRuns = agentRunsRes.data ?? [];
      const tickets = ticketsRes.data ?? [];
      const discrepancies = discrepanciesRes.data ?? [];

      const logins = events.filter(e => e.event_type === "user_login");
      const signups = events.filter(e => e.event_type === "account_created");

      const dau = new Set(logins.filter(e => e.created_at >= dayAgo).map(e => e.user_id)).size;
      const wau = new Set(logins.filter(e => e.created_at >= weekAgo).map(e => e.user_id)).size;
      const mau = new Set(logins.map(e => e.user_id)).size;

      const newAccountsThisWeek = profiles.filter(p => p.created_at >= weekAgo).length;

      // Unique users with logins
      const loggedInUserIds = [...new Set(logins.map(e => e.user_id).filter(Boolean))] as string[];
      const avgSessionsPerUser = loggedInUserIds.length > 0 ? Math.round(logins.length / loggedInUserIds.length * 10) / 10 : 0;

      const openTickets = tickets.filter(t => t.status === "new" || t.status === "in_progress").length;
      const criticalAlerts = discrepancies.filter(d => d.severity === "blocker").length;

      // Activation funnel
      const totalAccounts = profilesRes.count ?? profiles.length;
      const usersWhoLoggedIn = loggedInUserIds.length;
      const dealCreators = new Set(deals.map(d => d.created_by).filter(Boolean));
      const docUploaders = new Set(docs.map(d => d.uploaded_by).filter(Boolean));
      const newtonUsers = new Set(agentRuns.map(r => r.triggered_by).filter(Boolean));

      return {
        totalAccounts,
        newAccountsThisWeek,
        dau,
        wau,
        mau,
        avgSessionsPerUser,
        totalDocuments: docs.length,
        totalDeals: deals.length,
        totalNewtonSessions: agentRuns.length,
        openTickets,
        criticalAlerts,
        // Funnel
        funnelSignedUp: totalAccounts,
        funnelLoggedIn: usersWhoLoggedIn,
        funnelCreatedDeal: dealCreators.size,
        funnelUploadedDoc: docUploaders.size,
        funnelUsedNewton: newtonUsers.size,
      };
    },
    refetchInterval: 60_000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () => {
      const [authEventsRes, dealEventsRes] = await Promise.all([
        supabase.from("auth_events").select("id, user_id, email, event_type, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("deal_events").select("id, deal_id, actor_id, event_type, new_state, payload, created_at").order("created_at", { ascending: false }).limit(50),
      ]);

      const authEvents = (authEventsRes.data ?? []).map(e => ({
        id: e.id,
        user_id: e.user_id,
        user_label: e.email ?? "Unknown user",
        description: formatAuthEvent(e.event_type, e.email),
        event_type: e.event_type,
        category: "auth" as const,
        created_at: e.created_at,
      }));

      // Fetch deal names for deal events
      const dealIds = [...new Set((dealEventsRes.data ?? []).map(e => e.deal_id))];
      const { data: dealNames } = dealIds.length > 0
        ? await supabase.from("deals").select("id, deal_name").in("id", dealIds)
        : { data: [] };
      const dealNameMap = new Map((dealNames ?? []).map(d => [d.id, d.deal_name]));

      // Fetch profile names for actor_ids
      const actorIds = [...new Set((dealEventsRes.data ?? []).map(e => e.actor_id).filter(Boolean))];
      const { data: actorProfiles } = actorIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds)
        : { data: [] };
      const actorMap = new Map((actorProfiles ?? []).map(p => [p.user_id, p.full_name || "Unknown"]));

      const dealEvents = (dealEventsRes.data ?? []).map(e => ({
        id: e.id,
        user_id: e.actor_id,
        user_label: actorMap.get(e.actor_id ?? "") ?? "System",
        description: formatDealEvent(e.event_type, dealNameMap.get(e.deal_id) ?? "a deal", e.new_state),
        event_type: e.event_type,
        category: "deal" as const,
        created_at: e.created_at,
      }));

      const combined = [...authEvents, ...dealEvents]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 100);

      return combined;
    },
    refetchInterval: 30_000,
  });
}

function formatAuthEvent(type: string, email: string | null): string {
  const name = email ?? "A user";
  switch (type) {
    case "account_created": return `${name} created an account`;
    case "user_login": return `${name} logged in`;
    case "user_logout": return `${name} logged out`;
    case "failed_login_attempt": return `Failed login attempt for ${name}`;
    default: return `${name}: ${type.replace(/_/g, " ")}`;
  }
}

function formatDealEvent(type: string, dealName: string, newState: string | null): string {
  const stateLabel = newState ? ` → ${newState.replace(/_/g, " ")}` : "";
  switch (type) {
    case "state_transition": return `Deal "${dealName}" transitioned${stateLabel}`;
    case "deal_created": return `Created deal "${dealName}"`;
    default: return `${type.replace(/_/g, " ")} on "${dealName}"${stateLabel}`;
  }
}
