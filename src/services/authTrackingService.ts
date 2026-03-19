import { supabase } from "@/integrations/supabase/client";

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Other";
}

export type AuthEventType = "account_created" | "user_login" | "user_logout" | "failed_login_attempt";

interface TrackAuthEventOptions {
  eventType: AuthEventType;
  userId?: string;
  email?: string;
  loginMethod?: string;
  metadata?: Record<string, any>;
}

export async function trackAuthEvent({
  eventType,
  userId,
  email,
  loginMethod = "password",
  metadata = {},
}: TrackAuthEventOptions): Promise<void> {
  try {
    const { error } = await supabase.from("auth_events").insert({
      user_id: userId ?? null,
      event_type: eventType,
      email: email ?? null,
      login_method: loginMethod,
      device_type: getDeviceType(),
      browser: getBrowser(),
      user_agent: navigator.userAgent.slice(0, 500),
      metadata,
    });

    if (error) {
      console.error("Failed to track auth event:", error.message);
    }
  } catch (err) {
    // Non-blocking — never let tracking break the app
    console.error("Auth event tracking error:", err);
  }
}
