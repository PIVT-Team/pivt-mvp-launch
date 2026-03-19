import { supabase } from "@/integrations/supabase/client";

export type AdminAction =
  | "admin_login"
  | "admin_page_access"
  | "role_change"
  | "ticket_update"
  | "analytics_export"
  | "allowlist_add"
  | "allowlist_remove"
  | "allowlist_update"
  | "sensitive_action";

interface LogAdminActionOptions {
  action: AdminAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAdminAction({
  action,
  targetType,
  targetId,
  metadata = {},
}: LogAdminActionOptions): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("admin_audit_log" as any).insert({
      user_id: user.id,
      email: user.email ?? null,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      metadata,
    });
  } catch (err) {
    console.error("Admin audit log error:", err);
  }
}
