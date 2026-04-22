export type JwtClaims = Record<string, unknown> & {
  sub?: string;
  exp?: number;
  iat?: number;
};

type CorsHeaders = Record<string, string>;

function jsonUnauthorized(corsHeaders: CorsHeaders) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJson<T>(input: string): T {
  const bytes = decodeBase64Url(input);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function verifyHs256Jwt(token: string, secret: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const header = decodeJson<{ alg?: string }>(encodedHeader);
  if (header.alg !== "HS256") {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );

  if (!isValid) {
    return null;
  }

  return decodeJson<JwtClaims>(encodedPayload);
}

export async function requireJwt(req: Request, corsHeaders: CorsHeaders) {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw jsonUnauthorized(corsHeaders);
  }

  const secret = Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) {
    throw jsonUnauthorized(corsHeaders);
  }

  const token = authHeader.slice(7).trim();
  const claims = await verifyHs256Jwt(token, secret);
  if (!claims?.sub || (typeof claims.exp === "number" && claims.exp <= Math.floor(Date.now() / 1000))) {
    throw jsonUnauthorized(corsHeaders);
  }

  return {
    authHeader,
    claims,
    userId: claims.sub,
  };
}