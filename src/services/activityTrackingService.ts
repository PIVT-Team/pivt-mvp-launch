import { supabase } from "@/integrations/supabase/client";

let currentSessionId: string | null = null;

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = sessionStorage.getItem("pivt_session_id");
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      sessionStorage.setItem("pivt_session_id", currentSessionId);
    }
  }
  return currentSessionId;
}

export async function trackActivity(
  eventType: string,
  category: string = "general",
  metadata: Record<string, unknown> = {},
  dealId?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_activity_events" as any).insert({
      user_id: user.id,
      event_type: eventType,
      event_category: category,
      metadata,
      page_path: window.location.pathname,
      deal_id: dealId || null,
      session_id: getSessionId(),
    } as any);
  } catch {
    // Silently fail - analytics should never break the app
  }
}

// Convenience helpers
export const trackPageView = (path: string) =>
  trackActivity("page_viewed", "session", { path });

export const trackDealEvent = (eventType: string, dealId: string, meta: Record<string, unknown> = {}) =>
  trackActivity(eventType, "deal", meta, dealId);

export const trackDocumentEvent = (eventType: string, dealId: string, meta: Record<string, unknown> = {}) =>
  trackActivity(eventType, "document", meta, dealId);

export const trackNewtonEvent = (eventType: string, dealId?: string, meta: Record<string, unknown> = {}) =>
  trackActivity(eventType, "newton", meta, dealId);

export const trackSupportEvent = (eventType: string, meta: Record<string, unknown> = {}) =>
  trackActivity(eventType, "support", meta);

export const trackSessionStart = () =>
  trackActivity("session_started", "session", { started_at: new Date().toISOString() });

export const trackDashboardOpen = () =>
  trackActivity("dashboard_opened", "session");
