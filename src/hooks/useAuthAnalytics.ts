import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AuthAnalytics {
  dau: number;
  wau: number;
  mau: number;
  totalAccounts: number;
  newSignupsThisWeek: number;
  failedLoginsThisWeek: number;
  loginsByMethod: Record<string, number>;
  loginsByBrowser: Record<string, number>;
  loginsByDevice: Record<string, number>;
  // Engagement metrics
  usersWhoCreatedDeal: number;
  usersWhoUsedNewton: number;
  usersWhoCompletedWorkflowStep: number;
  totalLoggedInUsers: number;
  // Retention
  firstTimeUsers: number;
  returningUsers: number;
  recentEvents: Array<{
    id: string;
    event_type: string;
    email: string | null;
    device_type: string | null;
    browser: string | null;
    login_method: string | null;
    created_at: string;
  }>;
}

export function useAuthAnalytics() {
  return useQuery<AuthAnalytics>({
    queryKey: ["admin-auth-analytics"],
    queryFn: async () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all auth events for the month
      const { data: events } = await supabase
        .from("auth_events")
        .select("*")
        .gte("created_at", monthAgo)
        .order("created_at", { ascending: false })
        .limit(1000);

      const allEvents = events ?? [];
      const logins = allEvents.filter(e => e.event_type === "user_login");
      const signups = allEvents.filter(e => e.event_type === "account_created");
      const failedLogins = allEvents.filter(e => e.event_type === "failed_login_attempt");

      // DAU/WAU/MAU - unique users who logged in
      const dauUsers = new Set(logins.filter(e => e.created_at >= dayAgo).map(e => e.user_id)).size;
      const wauUsers = new Set(logins.filter(e => e.created_at >= weekAgo).map(e => e.user_id)).size;
      const mauUsers = new Set(logins.map(e => e.user_id)).size;

      // Signups this week
      const newSignupsThisWeek = signups.filter(e => e.created_at >= weekAgo).length;
      const failedLoginsThisWeek = failedLogins.filter(e => e.created_at >= weekAgo).length;

      // Login method breakdown
      const loginsByMethod: Record<string, number> = {};
      const loginsByBrowser: Record<string, number> = {};
      const loginsByDevice: Record<string, number> = {};
      logins.forEach(e => {
        const method = e.login_method ?? "unknown";
        loginsByMethod[method] = (loginsByMethod[method] || 0) + 1;
        const browser = e.browser ?? "unknown";
        loginsByBrowser[browser] = (loginsByBrowser[browser] || 0) + 1;
        const device = e.device_type ?? "unknown";
        loginsByDevice[device] = (loginsByDevice[device] || 0) + 1;
      });

      // First-time vs returning
      const userLoginCounts = logins.reduce<Record<string, number>>((acc, e) => {
        if (e.user_id) acc[e.user_id] = (acc[e.user_id] || 0) + 1;
        return acc;
      }, {});
      const firstTimeUsers = Object.values(userLoginCounts).filter(c => c === 1).length;
      const returningUsers = Object.values(userLoginCounts).filter(c => c > 1).length;

      // Cross-reference with deal/newton activity
      const loggedInUserIds = [...new Set(logins.map(e => e.user_id).filter(Boolean))] as string[];
      const totalLoggedInUsers = loggedInUserIds.length;

      // Users who created deals
      const { data: dealCreators } = await supabase
        .from("deals")
        .select("owner_id")
        .neq("visibility", "global_demo")
        .not("owner_id", "is", null);
      const dealCreatorIds = new Set((dealCreators ?? []).map(d => d.owner_id));
      const usersWhoCreatedDeal = loggedInUserIds.filter(id => dealCreatorIds.has(id)).length;

      // Users who used Newton (agent_runs)
      const { data: newtonUsers } = await supabase
        .from("agent_runs")
        .select("triggered_by")
        .not("triggered_by", "is", null);
      const newtonUserIds = new Set((newtonUsers ?? []).map(r => r.triggered_by));
      const usersWhoUsedNewton = loggedInUserIds.filter(id => newtonUserIds.has(id)).length;

      // Users who completed a workflow step (deal_events)
      const { data: workflowUsers } = await supabase
        .from("deal_events")
        .select("actor_id")
        .not("actor_id", "is", null);
      const workflowUserIds = new Set((workflowUsers ?? []).map(e => e.actor_id));
      const usersWhoCompletedWorkflowStep = loggedInUserIds.filter(id => workflowUserIds.has(id)).length;

      // Total accounts
      const { count: totalAccounts } = await supabase.from("profiles").select("id", { count: "exact", head: true });

      return {
        dau: dauUsers,
        wau: wauUsers,
        mau: mauUsers,
        totalAccounts: totalAccounts ?? 0,
        newSignupsThisWeek,
        failedLoginsThisWeek,
        loginsByMethod,
        loginsByBrowser,
        loginsByDevice,
        usersWhoCreatedDeal,
        usersWhoUsedNewton,
        usersWhoCompletedWorkflowStep,
        totalLoggedInUsers,
        firstTimeUsers,
        returningUsers,
        recentEvents: allEvents.slice(0, 50).map(e => ({
          id: e.id,
          event_type: e.event_type,
          email: e.email,
          device_type: e.device_type,
          browser: e.browser,
          login_method: e.login_method,
          created_at: e.created_at,
        })),
      };
    },
    refetchInterval: 60_000,
  });
}
