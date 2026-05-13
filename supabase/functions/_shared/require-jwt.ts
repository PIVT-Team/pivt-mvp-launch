// Shared JWT-verification helper for edge functions.
//
// Earlier versions manually verified HS256 using a `SUPABASE_JWT_SECRET`
// env var that Supabase does NOT auto-inject. When that secret was missing,
// every function using this helper returned a generic "Unauthorized" / 500
// "Unknown error" — including document-ai, manual-verify, newton-execute, etc.
//
// This version uses Supabase's own auth service (auth.getUser) which validates
// the user token using the auto-injected `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
// No manual secret config needed. Same return shape as before so existing
// callers ({ authHeader, claims, userId } destructuring) keep working.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type JwtClaims = Record<string, unknown> & {
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
  role?: string;
};

type CorsHeaders = Record<string, string>;

function jsonUnauthorized(corsHeaders: CorsHeaders) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireJwt(req: Request, corsHeaders: CorsHeaders) {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw jsonUnauthorized(corsHeaders);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw jsonUnauthorized(corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    // Server misconfiguration — log and refuse rather than silently failing.
    console.error("require-jwt: missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
    throw jsonUnauthorized(corsHeaders);
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    throw jsonUnauthorized(corsHeaders);
  }

  const user = data.user;
  const claims: JwtClaims = {
    sub: user.id,
    email: user.email ?? undefined,
    role: user.role ?? undefined,
    iat: user.created_at ? Math.floor(new Date(user.created_at).getTime() / 1000) : undefined,
  };

  return {
    authHeader,
    claims,
    userId: user.id,
  };
}
