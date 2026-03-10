import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const DOCUSIGN_CLIENT_ID = Deno.env.get("DOCUSIGN_CLIENT_ID");
  const DOCUSIGN_CLIENT_SECRET = Deno.env.get("DOCUSIGN_CLIENT_SECRET");
  const DOCUSIGN_REDIRECT_URI = Deno.env.get("DOCUSIGN_REDIRECT_URI");

  if (!DOCUSIGN_CLIENT_ID || !DOCUSIGN_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "DocuSign credentials not configured. Please add DOCUSIGN_CLIENT_ID and DOCUSIGN_CLIENT_SECRET." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { action, code, deal_id, user_id } = await req.json();

  try {
    if (action === "get_auth_url") {
      // Generate DocuSign OAuth authorization URL
      const authUrl = `https://account-d.docusign.com/oauth/auth?` +
        `response_type=code&` +
        `scope=signature%20impersonation&` +
        `client_id=${DOCUSIGN_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(DOCUSIGN_REDIRECT_URI || `${supabaseUrl}/functions/v1/docusign-oauth`)}`;

      return new Response(
        JSON.stringify({ auth_url: authUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "exchange_code") {
      // Exchange authorization code for tokens
      const tokenUrl = "https://account-d.docusign.com/oauth/token";
      const credentials = btoa(`${DOCUSIGN_CLIENT_ID}:${DOCUSIGN_CLIENT_SECRET}`);

      const tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=authorization_code&code=${code}`,
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Token exchange failed: ${err}`);
      }

      const tokens = await tokenRes.json();

      // Get user info
      const userInfoRes = await fetch("https://account-d.docusign.com/oauth/userinfo", {
        headers: { "Authorization": `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json();
      const account = userInfo.accounts?.[0];

      // Store connection
      const { error } = await supabase.from("docusign_connections").upsert({
        user_id,
        deal_id,
        account_id: account?.account_id,
        account_name: account?.account_name,
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        base_uri: account?.base_uri,
        status: "connected",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          email: userInfo.email,
          account_name: account?.account_name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      await supabase
        .from("docusign_connections")
        .update({ status: "disconnected", access_token: null, refresh_token: null })
        .eq("user_id", user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check_status") {
      const { data } = await supabase
        .from("docusign_connections")
        .select("status, email, account_name")
        .eq("user_id", user_id)
        .eq("status", "connected")
        .maybeSingle();

      return new Response(
        JSON.stringify({ connected: !!data, email: data?.email, account_name: data?.account_name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("DocuSign OAuth error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
