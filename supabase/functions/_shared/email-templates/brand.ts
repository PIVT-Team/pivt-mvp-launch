/**
 * Where the logo in transactional email comes from.
 *
 * Every template had the project ref baked into the image URL, so email sent
 * from any other Supabase project — a staging environment, or this project
 * after a migration — would render a broken image. `SUPABASE_URL` is set in
 * every edge-function runtime, so the correct host is already available.
 */
const BASE = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");

export const LOGO_URL = BASE
  ? `${BASE}/storage/v1/object/public/email-assets/pivt-logo.png`
  // No base URL means no reachable image; an empty src renders nothing, which
  // is better than a broken-image icon in a sign-in email.
  : "";
