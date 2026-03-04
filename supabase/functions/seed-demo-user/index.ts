import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const DEMO_EMAIL = "demo@pivt.app";
  const DEMO_PASSWORD = "Pivt2026!";

  // Check if demo user already exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const demoUser = existingUsers?.users?.find((u: any) => u.email === DEMO_EMAIL);

  if (demoUser) {
    return new Response(JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, exists: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create demo user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Demo User" },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Assign demo deals to this user by updating created_by on demo deals
  await supabaseAdmin
    .from("deals")
    .update({ created_by: data.user.id })
    .eq("deal_kind", "demo");

  return new Response(JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, created: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});