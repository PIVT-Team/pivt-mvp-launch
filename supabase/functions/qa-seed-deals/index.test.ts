import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("qa-seed-deals requires authentication", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/qa-seed-deals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.success, false);
  assertEquals(body.error, "Authentication required");
});

Deno.test("qa-seed-deals returns CORS headers on OPTIONS", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/qa-seed-deals`, {
    method: "OPTIONS",
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
  const origin = res.headers.get("Access-Control-Allow-Origin");
  assertExists(origin);
});
