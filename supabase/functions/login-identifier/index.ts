import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL") ?? Deno.env.get("SUPABASE_DB_URL");
const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN") ?? "*";

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL or SUPABASE_DB_URL");
}

const pool = new Pool(DATABASE_URL, 2, true);

const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeEmail = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;

const normalizeUsername = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const body = req.headers.get("content-type")?.includes("application/json")
    ? await req.json()
    : {};
  const rawIdentifier =
    typeof body.identifier === "string" ? body.identifier.trim() : "";

  if (!rawIdentifier) {
    return jsonResponse({ error: "Identifier is required" }, 400);
  }

  const email = normalizeEmail(rawIdentifier);
  if (email && email.includes("@")) {
    return jsonResponse({ email });
  }

  const username = normalizeUsername(rawIdentifier);
  const client = await pool.connect();

  try {
    const { rows } = await client.queryObject<{ email: string }>(
      `
        select email
        from (
          select u.email
          from public.users u
          where lower(u.username) = $1
            and u.is_active = true
            and u.role in ('admin', 'internal')

          union all

          select cpa.login_email as email
          from public.court_portal_accounts cpa
          where lower(cpa.username) = $1
            and cpa.is_active = true
        ) lookup
        limit 1
      `,
      [username],
    );

    if (!rows[0]?.email) {
      return jsonResponse({ error: "Login account not found" }, 404);
    }

    return jsonResponse({ email: rows[0].email });
  } finally {
    client.release();
  }
});
