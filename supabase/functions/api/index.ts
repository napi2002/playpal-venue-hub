import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DATABASE_URL = Deno.env.get("DATABASE_URL") ?? Deno.env.get("SUPABASE_DB_URL");
const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN") ?? "*";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL/SUPABASE_DB_URL");
}

const pool = new Pool(DATABASE_URL, 3, true);
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const textResponse = (data: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(data, {
    status,
    headers: {
      ...corsHeaders,
      ...headers,
    },
  });

type PortalContext = {
  authUserId: string;
  dbUserId: number;
  email: string | null;
  username: string | null;
  role: "admin" | "court" | "user";
  venueId: number | null;
  courtIds: number[];
  primaryCourtId: number | null;
};

const getUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
};

const getAdminUserId = async (
  client: ReturnType<typeof pool.connect>,
  authUser: { id: string },
) => {
  const { rows } = await client.queryObject<{ id: number; role: string }>(
    "select id, role from public.users where auth_id = $1 limit 1",
    [authUser.id],
  );
  if (!rows[0] || rows[0].role !== "admin") return null;
  return rows[0].id;
};

const ensureVenueAccess = async (
  client: ReturnType<typeof pool.connect>,
  ownerId: number,
  venueId: number,
) => {
  const { rows } = await client.queryObject(
    "select 1 from public.venues where id = $1 and owner_id = $2 limit 1",
    [venueId, ownerId],
  );
  return rows.length > 0;
};

const getPrimaryVenueId = async (client: ReturnType<typeof pool.connect>, ownerId: number) => {
  const { rows } = await client.queryObject<{ id: number }>(
    "select id from public.venues where owner_id = $1 order by created_at asc limit 1",
    [ownerId],
  );
  return rows[0]?.id ?? null;
};

const parseJsonBody = async (req: Request) => {
  if (req.headers.get("content-type")?.includes("application/json")) {
    return await req.json();
  }
  return {};
};

const parseId = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeEmail = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;

const normalizeUsername = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;

const getPasswordSetupRedirectTo = () =>
  Deno.env.get("PORTAL_PASSWORD_SETUP_URL") ??
  Deno.env.get("PORTAL_URL") ??
  CORS_ORIGIN;

const getPortalContext = async (
  client: ReturnType<typeof pool.connect>,
  authUser: { id: string },
): Promise<PortalContext | null> => {
  const { rows } = await client.queryObject<{
    id: number;
    role: "admin" | "court" | "user";
    email: string | null;
    username: string | null;
  }>(
    `
      select id, role, email, username
      from public.users
      where auth_id = $1
        and is_active = true
      limit 1
    `,
    [authUser.id],
  );

  const dbUser = rows[0];
  if (!dbUser) return null;

  if (dbUser.role === "admin") {
    const venueId = await getPrimaryVenueId(client, dbUser.id);
    return {
      authUserId: authUser.id,
      dbUserId: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      role: dbUser.role,
      venueId,
      courtIds: [],
      primaryCourtId: null,
    };
  }

  if (dbUser.role === "court") {
    const { rows: accountRows } = await client.queryObject<{
      venue_id: number;
      court_id: number;
    }>(
      `
        select venue_id, court_id
        from public.court_portal_accounts
        where user_id = $1
          and is_active = true
        order by created_at asc
      `,
      [dbUser.id],
    );

    const courtIds = accountRows.map((row) => row.court_id);
    return {
      authUserId: authUser.id,
      dbUserId: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      role: dbUser.role,
      venueId: accountRows[0]?.venue_id ?? null,
      courtIds,
      primaryCourtId: courtIds[0] ?? null,
    };
  }

  return {
    authUserId: authUser.id,
    dbUserId: dbUser.id,
    email: dbUser.email,
    username: dbUser.username,
    role: dbUser.role,
    venueId: null,
    courtIds: [],
    primaryCourtId: null,
  };
};

const ensurePortalVenueAccess = async (
  client: ReturnType<typeof pool.connect>,
  portalUser: PortalContext,
  venueId: number,
) => {
  if (portalUser.role === "admin") {
    return await ensureVenueAccess(client, portalUser.dbUserId, venueId);
  }

  if (portalUser.role === "court") {
    return portalUser.venueId === venueId;
  }

  return false;
};

const ensureCourtScopedAccess = (portalUser: PortalContext, courtId: number | null) => {
  if (portalUser.role === "admin") return true;
  if (portalUser.role !== "court") return false;
  if (!courtId) return false;
  return portalUser.courtIds.includes(courtId);
};

const sendPasswordSetupEmail = async (email: string) => {
  const redirectTo = getPasswordSetupRedirectTo();
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    throw error;
  }
};

function extractLatLngFromMapsUrl(
  url: string | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!url) return null;
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) return { latitude: parseFloat(qMatch[1]), longitude: parseFloat(qMatch[2]) };
  const placeMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (placeMatch) return { latitude: parseFloat(placeMatch[1]), longitude: parseFloat(placeMatch[2]) };
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  let pathname = url.pathname.replace(/^\/functions\/v1/, "");
  if (pathname.startsWith("/api/payments") || pathname.startsWith("/api/crm")) {
    pathname = pathname.replace("/api", "");
  }

  if (req.method === "POST" && pathname === "/api/auth/login-identifier") {
    const client = await pool.connect();
    try {
      const body = await parseJsonBody(req);
      const rawIdentifier =
        typeof body.identifier === "string" ? body.identifier.trim() : "";

      if (!rawIdentifier) {
        return jsonResponse({ error: "Identifier is required" }, 400);
      }

      const email = normalizeEmail(rawIdentifier);
      if (email) {
        return jsonResponse({ email });
      }

      const username = normalizeUsername(rawIdentifier);
      const { rows } = await client.queryObject<{ email: string }>(
        `
          select email
          from public.users
          where lower(username) = $1
            and is_active = true
            and role in ('admin', 'court')
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
  }

  const user = await getUser(req);
  if (!user) {
    return jsonResponse({ error: "Invalid auth token" }, 401);
  }

  const client = await pool.connect();
  try {
    const portalUser = await getPortalContext(client, { id: user.id });
    if (!portalUser || (portalUser.role !== "admin" && portalUser.role !== "court")) {
      return jsonResponse({ error: "Portal access required" }, 403);
    }
    const adminUserId = portalUser.role === "admin" ? portalUser.dbUserId : -1;

    if (req.method === "POST" && pathname === "/api/upload") {
      if (portalUser.role !== "admin") {
        return jsonResponse({ error: "Admin access required" }, 403);
      }

      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return jsonResponse({ error: "File is required" }, 400);
      }
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        return jsonResponse({ error: "Only JPG/PNG files are allowed" }, 400);
      }
      if (file.size > 10 * 1024 * 1024) {
        return jsonResponse({ error: "File exceeds 10MB limit" }, 400);
      }

      const id = crypto.randomUUID();
      const ext = file.name.split(".").pop() ?? "png";
      const filePath = `${user.id}/${id}.${ext}`;
      const bucket = "venue-uploads";

      const { error } = await supabaseAdmin.storage.from(bucket).upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
      return jsonResponse({ url: data.publicUrl });
    }

    if (req.method === "POST" && pathname === "/api/venues/draft") {
      const body = await parseJsonBody(req);
      const profile = body.profile ?? {};

      const { rows: existing } = await client.queryObject<{ id: number }>(
        "select id from public.venues where owner_id = $1 order by created_at desc limit 1",
        [adminUserId],
      );
      if (existing.length) {
        return jsonResponse({ venueId: existing[0].id });
      }

      await client.queryObject("begin");
      try {
        const { rows } = await client.queryObject<{ id: number }>(
          `
          insert into public.venues (
            name,
            name_en,
            name_th,
            venue_type,
            address_line1,
            subdistrict,
            district,
            province,
            postcode,
            google_maps_url,
            opening_hours,
            default_slot_duration_mins,
            email,
            phone,
            status,
            owner_id
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'DRAFT', $15
          )
          returning id
          `,
          [
            profile.venueNameEn ?? "New Venue",
            profile.venueNameEn ?? null,
            profile.venueNameTh ?? null,
            profile.venueType ?? null,
            profile.addressLine1 ?? null,
            profile.subdistrict ?? null,
            profile.district ?? null,
            profile.province ?? null,
            profile.postcode ?? null,
            profile.googleMapsUrl ?? null,
            profile.openingHours ?? null,
            profile.defaultSlotDurationMins ?? null,
            profile.email ?? null,
            profile.phone ?? null,
            adminUserId,
          ],
        );

        const venueId = rows[0]?.id;
        if (!venueId) {
          throw new Error("Failed to create venue");
        }

        await client.queryObject("commit");
        return jsonResponse({ venueId });
      } catch (error) {
        await client.queryObject("rollback");
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed" }, 500);
      }
    }

    if (req.method === "PUT" && pathname.startsWith("/api/venues/")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      const body = await parseJsonBody(req);
      const profile = body.profile ?? body ?? {};

      const latitude = typeof body.latitude === "number" ? body.latitude : null;
      const longitude = typeof body.longitude === "number" ? body.longitude : null;

      await client.queryObject(
        `
          update public.venues
          set
            name = $1,
            name_en = $2,
            name_th = $3,
            venue_type = $4,
            address_line1 = $5,
            subdistrict = $6,
            district = $7,
            province = $8,
            postcode = $9,
            google_maps_url = $10,
            opening_hours = $11,
            default_slot_duration_mins = $12,
            email = $13,
            phone = $14,
            sports_supported = $15,
            latitude = coalesce($17::numeric, latitude),
            longitude = coalesce($18::numeric, longitude),
            updated_at = now()
          where id = $16
        `,
        [
          profile.venueNameEn ?? profile.name_en ?? profile.name ?? "New Venue",
          profile.venueNameEn ?? profile.name_en ?? null,
          profile.venueNameTh ?? profile.name_th ?? null,
          profile.venueType ?? profile.venue_type ?? null,
          profile.addressLine1 ?? profile.address_line1 ?? null,
          profile.subdistrict ?? null,
          profile.district ?? null,
          profile.province ?? null,
          profile.postcode ?? null,
          profile.googleMapsUrl ?? profile.google_maps_url ?? null,
          profile.openingHours ?? profile.opening_hours ?? null,
          profile.defaultSlotDurationMins ?? profile.default_slot_duration_mins ?? null,
          profile.email ?? null,
          profile.phone ?? null,
          profile.sports_supported ?? profile.sportsSupported ?? [],
          venueId,
          latitude,
          longitude,
        ],
      );
      return jsonResponse({ ok: true });
    }

    if (req.method === "POST" && pathname.endsWith("/courts")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      const body = await parseJsonBody(req);
      const courts = Array.isArray(body.courts) ? body.courts : [];
      if (!courts.length) return jsonResponse({ error: "Add at least 1 court" }, 400);

      await client.queryObject("begin");
      try {
        await client.queryObject("delete from public.courts where venue_id = $1", [venueId]);
        for (const court of courts) {
          await client.queryObject(
            `
            insert into public.courts (
              venue_id,
              name,
              sport_type,
              environment,
              surface_type,
              has_lighting,
              weekday_price_per_hour_thb,
              weekend_price_per_hour_thb,
              sport,
              status,
              peak_price,
              off_peak_price,
              buffer_minutes
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12)
          `,
            [
              venueId,
              court.courtName,
              court.sportType,
              court.environment,
              court.surfaceType,
              court.hasLighting ?? false,
              court.weekdayPricePerHourThb ?? 0,
              court.weekendPricePerHourThb ?? 0,
              court.sportType,
              court.weekendPricePerHourThb ?? 0,
              court.weekdayPricePerHourThb ?? 0,
              15,
            ],
          );
        }
        await client.queryObject("commit");
        return jsonResponse({ ok: true });
      } catch (error) {
        await client.queryObject("rollback");
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed" }, 500);
      }
    }

    if (req.method === "POST" && pathname.endsWith("/courts/create")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      const body = await parseJsonBody(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return jsonResponse({ error: "Court name is required" }, 400);

      const { rows } = await client.queryObject<{ id: number }>(
        `
          insert into public.courts (
            venue_id,
            name,
            sport_type,
            sport,
            status,
            environment,
            weekday_price_per_hour_thb,
            weekend_price_per_hour_thb
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8)
          returning id
        `,
        [
          venueId,
          name,
          body.sport_type ?? null,
          body.sport ?? null,
          body.status ?? "active",
          body.environment ?? null,
          body.weekday_price_per_hour_thb ?? null,
          body.weekend_price_per_hour_thb ?? null,
        ],
      );
      return jsonResponse({ id: rows[0]?.id ?? null });
    }

    if (req.method === "POST" && pathname.endsWith("/photos")) {
      if (portalUser.role !== "admin") {
        return jsonResponse({ error: "Admin access required" }, 403);
      }
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      const body = await parseJsonBody(req);
      const photos = Array.isArray(body.photos) ? body.photos : [];
      if (!photos.length) return jsonResponse({ error: "Photos are required" }, 400);

      for (const photo of photos) {
        await client.queryObject(
          `
            insert into public.photos (venue_id, court_id, type, url)
            values ($1, $2, $3, $4)
          `,
          [venueId, photo.courtId ?? null, photo.type, photo.url],
        );
      }

      return jsonResponse({ ok: true });
    }

    if (req.method === "GET" && pathname === "/api/me") {
      return jsonResponse({
        id: portalUser.authUserId,
        dbUserId: portalUser.dbUserId,
        email: portalUser.email,
        username: portalUser.username,
        role: portalUser.role,
        venueId: portalUser.venueId,
        courtIds: portalUser.courtIds,
        primaryCourtId: portalUser.primaryCourtId,
      });
    }

    if (req.method === "GET" && pathname.endsWith("/court-accounts")) {
      if (portalUser.role !== "admin") {
        return jsonResponse({ error: "Admin access required" }, 403);
      }

      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const { rows } = await client.queryObject(
        `
          select
            cpa.id,
            cpa.venue_id,
            cpa.court_id,
            c.name as court_name,
            cpa.username,
            cpa.login_email,
            cpa.plan,
            cpa.plan_notes,
            cpa.is_active,
            cpa.invite_sent_at,
            cpa.password_reset_sent_at,
            cpa.last_activated_at,
            cpa.created_at,
            u.full_name
          from public.court_portal_accounts cpa
          join public.courts c on c.id = cpa.court_id
          join public.users u on u.id = cpa.user_id
          where cpa.venue_id = $1
          order by c.name asc
        `,
        [venueId],
      );
      return jsonResponse(rows);
    }

    if (req.method === "POST" && pathname.endsWith("/court-accounts")) {
      if (portalUser.role !== "admin") {
        return jsonResponse({ error: "Admin access required" }, 403);
      }

      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const body = await parseJsonBody(req);
      const courtId = parseId(String(body.courtId ?? body.court_id ?? ""));
      const email = normalizeEmail(body.email ?? body.login_email);
      const username = normalizeUsername(body.username);
      const temporaryPassword =
        typeof body.temporaryPassword === "string" && body.temporaryPassword.length >= 8
          ? body.temporaryPassword
          : null;
      const plan =
        body.plan === "free" || body.plan === "pro" || body.plan === "custom"
          ? body.plan
          : "free";
      const fullName =
        typeof body.fullName === "string" && body.fullName.trim()
          ? body.fullName.trim()
          : null;
      const planNotes =
        typeof body.planNotes === "string" && body.planNotes.trim()
          ? body.planNotes.trim()
          : null;

      if (!courtId || !email || !username || !temporaryPassword) {
        return jsonResponse({ error: "Court, email, username, and temporary password are required" }, 400);
      }
      if (!ensureCourtScopedAccess(portalUser, courtId)) {
        return jsonResponse({ error: "Court not available" }, 400);
      }

      const { rows: courtRows } = await client.queryObject<{ id: number }>(
        "select id from public.courts where id = $1 and venue_id = $2 limit 1",
        [courtId, venueId],
      );
      if (!courtRows[0]?.id) {
        return jsonResponse({ error: "Court not found" }, 404);
      }

      await client.queryObject("begin");
      try {
        const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            username,
            role: "court",
            venue_id: venueId,
            court_id: courtId,
          },
        });
        if (authUserError || !authUserData.user) {
          throw authUserError ?? new Error("Failed to create auth user");
        }

        const authUserId = authUserData.user.id;

        const { rows: userRows } = await client.queryObject<{ id: number }>(
          `
            insert into public.users (email, role, full_name, username, auth_id)
            values ($1, 'court', $2, $3, $4)
            returning id
          `,
          [email, fullName, username, authUserId],
        );

        const userId = userRows[0]?.id;
        if (!userId) {
          throw new Error("Failed to create portal user");
        }

        const { rows: accountRows } = await client.queryObject(
          `
            insert into public.court_portal_accounts (
              user_id,
              venue_id,
              court_id,
              username,
              login_email,
              plan,
              plan_notes,
              invited_by,
              invite_sent_at,
              password_reset_sent_at,
              is_active
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now(),true)
            returning id
          `,
          [userId, venueId, courtId, username, email, plan, planNotes, adminUserId],
        );

        await sendPasswordSetupEmail(email);
        await client.queryObject("commit");
        return jsonResponse({ id: accountRows[0]?.id ?? null, email, username });
      } catch (error) {
        await client.queryObject("rollback");
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed to create court account" }, 500);
      }
    }

    if (req.method === "PUT" && pathname.startsWith("/api/court-accounts/")) {
      if (portalUser.role !== "admin") {
        return jsonResponse({ error: "Admin access required" }, 403);
      }

      const accountId = parseId(pathname.split("/")[3]);
      if (!accountId) return jsonResponse({ error: "Court account not found" }, 404);

      const body = await parseJsonBody(req);
      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email ?? body.login_email);
      const temporaryPassword =
        typeof body.temporaryPassword === "string" && body.temporaryPassword.length >= 8
          ? body.temporaryPassword
          : null;
      const plan =
        body.plan === "free" || body.plan === "pro" || body.plan === "custom"
          ? body.plan
          : null;
      const planNotes =
        typeof body.planNotes === "string" ? body.planNotes.trim() : undefined;
      const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
      const resendPasswordEmail = body.resendPasswordEmail === true;

      const { rows: accountRows } = await client.queryObject<{
        user_id: number;
        venue_id: number;
        auth_id: string;
        login_email: string;
      }>(
        `
          select cpa.user_id, cpa.venue_id, u.auth_id, cpa.login_email
          from public.court_portal_accounts cpa
          join public.users u on u.id = cpa.user_id
          where cpa.id = $1
          limit 1
        `,
        [accountId],
      );

      const account = accountRows[0];
      if (!account) return jsonResponse({ error: "Court account not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, account.venue_id);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      await client.queryObject("begin");
      try {
        if (account.auth_id && (email || temporaryPassword)) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(account.auth_id, {
            email: email ?? undefined,
            password: temporaryPassword ?? undefined,
          });
          if (error) throw error;
        }

        await client.queryObject(
          `
            update public.users
            set
              email = coalesce($2, email),
              username = coalesce($3, username),
              updated_at = now()
            where id = $1
          `,
          [account.user_id, email, username],
        );

        await client.queryObject(
          `
            update public.court_portal_accounts
            set
              username = coalesce($2, username),
              login_email = coalesce($3, login_email),
              plan = coalesce($4::public.court_plan, plan),
              plan_notes = coalesce($5, plan_notes),
              is_active = coalesce($6, is_active),
              password_reset_sent_at = case when $7 then now() else password_reset_sent_at end,
              updated_at = now()
            where id = $1
          `,
          [accountId, username, email, plan, planNotes, isActive, resendPasswordEmail],
        );

        if (resendPasswordEmail) {
          await sendPasswordSetupEmail(email ?? account.login_email);
        }

        await client.queryObject("commit");
        return jsonResponse({ ok: true });
      } catch (error) {
        await client.queryObject("rollback");
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed to update court account" }, 500);
      }
    }

    if (req.method === "GET" && pathname === "/api/venue") {
      if (!portalUser.venueId) {
        return jsonResponse(null);
      }
      const { rows } = await client.queryObject(
        "select * from public.venues where id = $1 limit 1",
        [portalUser.venueId],
      );
      return jsonResponse(rows[0] ?? null);
    }

    if (req.method === "GET" && pathname.endsWith("/courts")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const params: Array<number | number[]> = [venueId];
      const courtScopeClause =
        portalUser.role === "court" && portalUser.courtIds.length
          ? `and id = any($2::int[])`
          : "";
      if (portalUser.role === "court" && portalUser.courtIds.length) {
        params.push(portalUser.courtIds);
      }

      const { rows } = await client.queryObject(
        `select * from public.courts where venue_id = $1 ${courtScopeClause} order by name asc`,
        params,
      );
      return jsonResponse(rows);
    }

    if (req.method === "GET" && pathname.endsWith("/photos")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      const { rows } = await client.queryObject(
        "select * from public.photos where venue_id = $1 order by created_at desc",
        [venueId],
      );
      return jsonResponse(rows);
    }

    if (req.method === "GET" && pathname.endsWith("/recurring-booking-exceptions")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      if (!start || !end) return jsonResponse({ error: "Start and end are required" }, 400);

      const params: Array<string | number | number[]> = [venueId, start, end];
      const courtScopeClause =
        portalUser.role === "court" && portalUser.courtIds.length
          ? "and recurring_booking_id in (select id from public.recurring_bookings where court_id = any($4::int[]))"
          : "";
      if (portalUser.role === "court" && portalUser.courtIds.length) {
        params.push(portalUser.courtIds);
      }

      const { rows } = await client.queryObject(
        `
          select recurring_booking_id, occurrence_date
          from public.recurring_booking_exceptions
          where venue_id = $1
            and occurrence_date >= $2::date
            and occurrence_date < $3::date
            ${courtScopeClause}
        `,
        params,
      );
      return jsonResponse(rows);
    }

    if (req.method === "POST" && pathname.endsWith("/submit")) {
      if (portalUser.role !== "admin") {
        return jsonResponse({ error: "Admin access required" }, 403);
      }
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      await client.queryObject(
        "update public.venues set status = 'SUBMITTED', updated_at = now() where id = $1",
        [venueId],
      );
      return jsonResponse({ ok: true });
    }

    if (req.method === "POST" && pathname.endsWith("/bookings") && !pathname.endsWith("/bookings/list")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      const body = await parseJsonBody(req);
      const courtId = parseId(String(body.courtId ?? body.court_id ?? ""));
      if (!ensureCourtScopedAccess(portalUser, courtId)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const slotStart = body.slotStart ?? body.start_at ?? body.startAt;
      const slotEnd = body.slotEnd ?? body.end_at ?? body.endAt;
      if (!slotStart || !slotEnd) {
        return jsonResponse({ error: "slotStart and slotEnd are required" }, 400);
      }

      const { rows } = await client.queryObject(
        `
          insert into public.bookings (
            venue_id,
            court_id,
            slot_start,
            slot_end,
            duration_minutes,
            status,
            total_price,
            currency,
            notes,
            booking_number,
            player_name,
            player_email,
            source,
            payment_status
          )
          values ($1,$2,$3,$4,$5,coalesce($6,'pending')::public.booking_status,$7,coalesce($8,'THB'),$9,$10,$11,$12,$13,$14)
          returning *
        `,
        [
          venueId,
          courtId,
          slotStart,
          slotEnd,
          body.durationMinutes ?? body.duration ?? 60,
          body.status ?? null,
          body.totalPrice ?? body.amount ?? 0,
          body.currency ?? "THB",
          body.notes ?? null,
          body.bookingNumber ?? null,
          body.playerName ?? body.player_name ?? null,
          body.playerEmail ?? body.player_email ?? null,
          body.source ?? "Manual",
          body.paymentStatus ?? body.payment_status ?? null,
        ],
      );
      const booking = rows[0];
      const paymentStatusRaw = String(booking?.payment_status ?? "").toLowerCase();
      const bookingStatusRaw = String(booking?.status ?? "").toLowerCase();
      const derivedPaymentStatus =
        paymentStatusRaw === "paid" || paymentStatusRaw === "completed"
          ? "completed"
          : paymentStatusRaw === "pending"
            ? "pending"
            : paymentStatusRaw === "failed"
              ? "failed"
              : paymentStatusRaw === "refunded"
                ? "refunded"
                : bookingStatusRaw === "paid"
                  ? "completed"
                  : bookingStatusRaw === "confirmed"
                    ? "pending"
                    : null;

      if (booking && derivedPaymentStatus) {
        const amount = Number(booking.final_price ?? booking.total_price ?? 0);
        await client.queryObject(
          `
            insert into public.payments (
              booking_id,
              venue_id,
              user_id,
              amount,
              currency,
              status,
              payment_method
            )
            values ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            booking.id,
            booking.venue_id,
            booking.user_id ?? null,
            amount,
            booking.currency ?? "THB",
            derivedPaymentStatus,
            body.paymentMethod ?? body.payment_method ?? null,
          ],
        );
      }

      return jsonResponse(booking);
    }

    if (req.method === "GET" && pathname.endsWith("/bookings/list")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const params: Array<number | number[]> = [venueId];
      const courtScopeClause =
        portalUser.role === "court" && portalUser.courtIds.length
          ? "and b.court_id = any($2::int[])"
          : "";
      if (portalUser.role === "court" && portalUser.courtIds.length) {
        params.push(portalUser.courtIds);
      }

      const { rows } = await client.queryObject(
        `
          select
            b.*,
            c.name as court_name,
            c.sport_type as sport_type,
            c.sport as sport
          from public.bookings b
          left join public.courts c on c.id = b.court_id
          where b.venue_id = $1
            ${courtScopeClause}
          order by b.created_at desc
        `,
        params,
      );
      return jsonResponse(rows);
    }

    if (req.method === "PUT" && pathname.startsWith("/api/bookings/")) {
      const bookingId = parseId(pathname.split("/")[3]);
      if (!bookingId) return jsonResponse({ error: "Booking not found" }, 404);
      const body = await parseJsonBody(req);
      const { rows } = await client.queryObject<{ venue_id: number; court_id: number }>(
        "select venue_id, court_id from public.bookings where id = $1",
        [bookingId],
      );
      const venueId = rows[0]?.venue_id;
      if (!venueId) return jsonResponse({ error: "Booking not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      if (!ensureCourtScopedAccess(portalUser, rows[0]?.court_id ?? null)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const { rows: updated } = await client.queryObject(
        `
          update public.bookings
          set
            status = coalesce($2::public.booking_status, status),
            payment_status = coalesce($3, payment_status),
            cancellation_reason = $4,
            cancellation_timestamp = $5,
            updated_at = now()
          where id = $1
          returning *
        `,
        [
          bookingId,
          body.status ?? null,
          body.paymentStatus ?? body.payment_status ?? null,
          body.cancellationReason ?? null,
          body.cancellationTimestamp ?? null,
        ],
      );
      const booking = updated[0];
      const paymentStatusRaw = String(booking?.payment_status ?? "").toLowerCase();
      const bookingStatusRaw = String(booking?.status ?? "").toLowerCase();
      const derivedPaymentStatus =
        paymentStatusRaw === "paid" || paymentStatusRaw === "completed"
          ? "completed"
          : paymentStatusRaw === "pending"
            ? "pending"
            : paymentStatusRaw === "failed"
              ? "failed"
              : paymentStatusRaw === "refunded"
                ? "refunded"
                : bookingStatusRaw === "paid"
                  ? "completed"
                  : bookingStatusRaw === "confirmed"
                    ? "pending"
                    : null;

      if (booking && derivedPaymentStatus) {
        const amount = Number(booking.final_price ?? booking.total_price ?? 0);
        const { rows: existing } = await client.queryObject<{ id: number }>(
          "select id from public.payments where booking_id = $1 limit 1",
          [bookingId],
        );

        if (existing[0]?.id) {
          await client.queryObject(
            `
              update public.payments
              set
                amount = $2,
                currency = $3,
                status = $4,
                payment_method = $5,
                transaction_id = $6,
                transaction_date = now(),
                updated_at = now()
              where id = $1
            `,
            [
              existing[0].id,
              amount,
              booking.currency ?? "THB",
              derivedPaymentStatus,
              body.paymentMethod ?? body.payment_method ?? null,
              body.transactionId ?? body.transaction_id ?? null,
            ],
          );
        } else {
          await client.queryObject(
            `
              insert into public.payments (
                booking_id,
                venue_id,
                user_id,
                amount,
                currency,
                status,
                payment_method,
                transaction_id
              )
              values ($1,$2,$3,$4,$5,$6,$7,$8)
            `,
            [
              booking.id,
              booking.venue_id,
              booking.user_id ?? null,
              amount,
              booking.currency ?? "THB",
              derivedPaymentStatus,
              body.paymentMethod ?? body.payment_method ?? null,
              body.transactionId ?? body.transaction_id ?? null,
            ],
          );
        }
      }

      return jsonResponse(booking);
    }

    if (req.method === "PUT" && pathname.startsWith("/api/courts/")) {
      const courtId = parseId(pathname.split("/")[3]);
      if (!courtId) return jsonResponse({ error: "Court not found" }, 404);
      const body = await parseJsonBody(req);

      const { rows: venueRows } = await client.queryObject<{ venue_id: number }>(
        "select venue_id from public.courts where id = $1",
        [courtId],
      );
      const venueId = venueRows[0]?.venue_id;
      if (!venueId) return jsonResponse({ error: "Court not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const { rows } = await client.queryObject(
        `
          update public.courts
          set
            name = coalesce($2, name),
            sport_type = $3,
            sport = $4,
            status = coalesce($5, status),
            environment = $6,
            weekday_price_per_hour_thb = $7,
            weekend_price_per_hour_thb = $8,
            updated_at = now()
          where id = $1
          returning *
        `,
        [
          courtId,
          body.name ?? null,
          body.sport_type ?? null,
          body.sport ?? null,
          body.status ?? null,
          body.environment ?? null,
          body.weekday_price_per_hour_thb ?? null,
          body.weekend_price_per_hour_thb ?? null,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "PUT" && pathname.startsWith("/payments/")) {
      const paymentId = parseId(pathname.split("/")[2]);
      if (!paymentId) return jsonResponse({ error: "Payment not found" }, 404);
      const body = await parseJsonBody(req);

      const { rows: venueRows } = await client.queryObject<{ venue_id: number }>(
        "select venue_id from public.payments where id = $1",
        [paymentId],
      );
      const venueId = venueRows[0]?.venue_id;
      if (!venueId) return jsonResponse({ error: "Payment not found" }, 404);
      const ok = await ensureVenueAccess(client, adminUserId, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const { rows } = await client.queryObject(
        `
          update public.payments
          set
            status = coalesce($2, status),
            payment_method = $3,
            transaction_id = $4,
            updated_at = now()
          where id = $1
          returning *
        `,
        [
          paymentId,
          body.status ?? null,
          body.payment_method ?? null,
          body.transaction_id ?? null,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "GET" && pathname.startsWith("/api/venues/") && pathname.endsWith("/bookings")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      const courtId = url.searchParams.get("courtId");
      if (!start || !end) return jsonResponse({ error: "Start and end are required" }, 400);

      if (portalUser.role === "court" && courtId && !portalUser.courtIds.includes(Number(courtId))) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const params: Array<number | string | number[]> = [venueId, start, end];
      let courtFilter = "";
      if (courtId) {
        params.push(courtId);
        courtFilter = "and b.court_id = $4";
      } else if (portalUser.role === "court" && portalUser.courtIds.length) {
        params.push(portalUser.courtIds);
        courtFilter = "and b.court_id = any($4::int[])";
      }

      const { rows } = await client.queryObject<{
        id: string;
        courtId: string;
        courtName: string;
        startAt: string;
        endAt: string;
        status: string;
        eventName: string | null;
      }>(
        `
          select
            b.id,
            b.court_id as "courtId",
            c.name as "courtName",
            b.slot_start as "startAt",
            b.slot_end as "endAt",
            b.status,
            b.player_name as "eventName"
          from public.bookings b
          join public.courts c on c.id = b.court_id
          where b.venue_id = $1
            and b.status in ('pending', 'paid', 'confirmed', 'held')
            and b.slot_start < $3
            and b.slot_end > $2
            ${courtFilter}
          order by "startAt" asc
        `,
        params,
      );

      const payload = rows.map((row) => ({
        id: row.id,
        courtId: row.courtId,
        courtName: row.courtName,
        start: new Date(row.startAt).toISOString(),
        end: new Date(row.endAt).toISOString(),
        eventName: row.eventName,
        status: row.status === "paid" ? "PAID" : "PENDING",
      }));
      return jsonResponse(payload);
    }

    if (req.method === "GET" && pathname.endsWith("/recurring-bookings")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const params: Array<number | number[]> = [venueId];
      const courtScopeClause =
        portalUser.role === "court" && portalUser.courtIds.length
          ? "and rb.court_id = any($2::int[])"
          : "";
      if (portalUser.role === "court" && portalUser.courtIds.length) {
        params.push(portalUser.courtIds);
      }

      const { rows } = await client.queryObject(
        `
          select
            rb.*,
            c.name as court_name
          from public.recurring_bookings rb
          left join public.courts c on c.id = rb.court_id
          where rb.venue_id = $1
            ${courtScopeClause}
          order by rb.day_of_week asc, rb.time asc
        `,
        params,
      );
      return jsonResponse(rows);
    }

    if (req.method === "POST" && pathname.endsWith("/recurring-bookings")) {
      const venueId = parseId(pathname.split("/")[3]);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      const body = await parseJsonBody(req);
      const courtId = parseId(String(body.court_id ?? body.courtId ?? ""));
      if (!ensureCourtScopedAccess(portalUser, courtId)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const { rows } = await client.queryObject(
        `
          insert into public.recurring_bookings (
            venue_id,
            court_id,
            day_of_week,
            time,
            duration,
            player_name,
            player_email,
            status,
            start_date,
            end_date
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          returning *
        `,
        [
          venueId,
          courtId,
          body.day_of_week ?? body.dayOfWeek,
          body.time,
          body.duration ?? body.duration_minutes ?? 60,
          body.player_name ?? body.playerName,
          body.player_email ?? body.playerEmail,
          body.status ?? "active",
          body.start_date ?? body.startDate,
          body.end_date ?? body.endDate ?? null,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "PUT" && pathname.startsWith("/api/recurring-bookings/")) {
      const recurringId = parseId(pathname.split("/")[3]);
      if (!recurringId) return jsonResponse({ error: "Recurring booking not found" }, 404);
      const body = await parseJsonBody(req);

      const { rows: venueRows } = await client.queryObject<{ venue_id: number; court_id: number }>(
        "select venue_id, court_id from public.recurring_bookings where id = $1",
        [recurringId],
      );
      const venueId = venueRows[0]?.venue_id;
      if (!venueId) return jsonResponse({ error: "Recurring booking not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      if (!ensureCourtScopedAccess(portalUser, venueRows[0]?.court_id ?? null)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const { rows } = await client.queryObject(
        `
          update public.recurring_bookings
          set
            day_of_week = coalesce($2, day_of_week),
            time = coalesce($3, time),
            duration = coalesce($4, duration),
            player_name = coalesce($5, player_name),
            player_email = $6,
            status = coalesce($7, status),
            start_date = coalesce($8, start_date),
            end_date = $9,
            updated_at = now()
          where id = $1
          returning *
        `,
        [
          recurringId,
          body.day_of_week ?? body.dayOfWeek ?? null,
          body.time ?? null,
          body.duration ?? null,
          body.player_name ?? body.playerName ?? null,
          body.player_email ?? body.playerEmail ?? null,
          body.status ?? null,
          body.start_date ?? body.startDate ?? null,
          body.end_date ?? body.endDate ?? null,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "POST" && pathname.startsWith("/api/recurring-bookings/") && pathname.endsWith("/cancel-date")) {
      const recurringId = parseId(pathname.split("/")[3]);
      if (!recurringId) return jsonResponse({ error: "Recurring booking not found" }, 404);
      const body = await parseJsonBody(req);
      const occurrenceDate = typeof body.date === "string" ? body.date : null;
      if (!occurrenceDate) return jsonResponse({ error: "Date is required" }, 400);

      const { rows: venueRows } = await client.queryObject<{ venue_id: number; court_id: number }>(
        "select venue_id, court_id from public.recurring_bookings where id = $1",
        [recurringId],
      );
      const venueId = venueRows[0]?.venue_id;
      if (!venueId) return jsonResponse({ error: "Recurring booking not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      if (!ensureCourtScopedAccess(portalUser, venueRows[0]?.court_id ?? null)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      try {
        await client.queryObject(
          `
            insert into public.recurring_booking_exceptions (
              venue_id,
              recurring_booking_id,
              occurrence_date
            ) values ($1,$2,$3::date)
            on conflict (recurring_booking_id, occurrence_date) do nothing
          `,
          [venueId, recurringId, occurrenceDate],
        );
        return jsonResponse({ ok: true });
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to cancel occurrence" },
          500,
        );
      }
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/recurring-bookings/")) {
      const recurringId = parseId(pathname.split("/")[3]);
      if (!recurringId) return jsonResponse({ error: "Recurring booking not found" }, 404);

      const { rows: venueRows } = await client.queryObject<{ venue_id: number; court_id: number }>(
        "select venue_id, court_id from public.recurring_bookings where id = $1",
        [recurringId],
      );
      const venueId = venueRows[0]?.venue_id;
      if (!venueId) return jsonResponse({ error: "Recurring booking not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      if (!ensureCourtScopedAccess(portalUser, venueRows[0]?.court_id ?? null)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      await client.queryObject("delete from public.recurring_bookings where id = $1", [recurringId]);
      return jsonResponse({ ok: true });
    }

    if (req.method === "POST" && pathname.startsWith("/api/recurring-bookings/") && pathname.endsWith("/generate")) {
      const recurringId = parseId(pathname.split("/")[3]);
      if (!recurringId) return jsonResponse({ error: "Recurring booking not found" }, 404);

      const { rows: recurringRows } = await client.queryObject<{ venue_id: number; court_id: number }>(
        "select venue_id, court_id from public.recurring_bookings where id = $1",
        [recurringId],
      );
      const venueId = recurringRows[0]?.venue_id;
      if (!venueId) return jsonResponse({ error: "Recurring booking not found" }, 404);
      const ok = await ensurePortalVenueAccess(client, portalUser, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      if (!ensureCourtScopedAccess(portalUser, recurringRows[0]?.court_id ?? null)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      return jsonResponse(0);
    }

    if (req.method === "GET" && pathname === "/payments/summary") {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);

      const status = url.searchParams.get("status");
      const query = url.searchParams.get("q");

      const params: Array<string> = [venueId];
      let statusClause = "";
      let searchClause = "";

      if (status && status.toLowerCase() !== "all") {
        params.push(status);
        statusClause = `and lower(p.status) = lower($${params.length})`;
      }

      if (query) {
        params.push(`%${query}%`);
        searchClause = `and (
          p.booking_id::text ilike $${params.length} or
          b.player_name ilike $${params.length} or
          p.transaction_id ilike $${params.length} or
          b.booking_number ilike $${params.length}
        )`;
      }

      const { rows } = await client.queryObject<{
        completed_amount: string;
        completed_count: number;
        pending_amount: string;
        pending_count: number;
        refunded_amount: string;
        refunded_count: number;
        total_count: number;
        pending_booking_amount: string;
        pending_booking_count: number;
      }>(
        `
          select
            coalesce(sum(case when p.status = 'completed' then p.amount::numeric else 0 end), 0) as completed_amount,
            count(*) filter (where p.status = 'completed') as completed_count,
            coalesce(sum(case when p.status = 'pending' then p.amount::numeric else 0 end), 0) as pending_amount,
            count(*) filter (where p.status = 'pending') as pending_count,
            coalesce(sum(case when p.status = 'refunded' then p.amount::numeric else 0 end), 0) as refunded_amount,
            count(*) filter (where p.status = 'refunded') as refunded_count,
            count(*) as total_count,
            (
              select coalesce(sum(b.total_price::numeric), 0)
              from public.bookings b
              where b.venue_id = $1
                and b.status = 'pending'
            ) as pending_booking_amount,
            (
              select count(*)
              from public.bookings b
              where b.venue_id = $1
                and b.status = 'pending'
            ) as pending_booking_count
          from public.payments p
          left join public.bookings b on b.id = p.booking_id
          where p.venue_id = $1
          ${statusClause}
          ${searchClause}
        `,
        params,
      );

      const summary = rows[0];
      return jsonResponse({
        completedAmount: Number(summary?.completed_amount ?? 0),
        completedCount: Number(summary?.completed_count ?? 0),
        pendingAmount: Number(summary?.pending_booking_amount ?? 0),
        pendingCount: Number(summary?.pending_booking_count ?? 0),
        refundedAmount: Number(summary?.refunded_amount ?? 0),
        refundedCount: Number(summary?.refunded_count ?? 0),
        totalCount: Number(summary?.total_count ?? 0),
      });
    }

    if (req.method === "GET" && pathname === "/payments") {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);

      const status = url.searchParams.get("status");
      const query = url.searchParams.get("q");
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
      const offset = (Number.isNaN(page) ? 0 : Math.max(page - 1, 0)) * pageSize;

      const params: Array<string | number> = [venueId];
      let statusClause = "";
      let searchClause = "";

      if (status && status.toLowerCase() !== "all") {
        params.push(status);
        statusClause = `and lower(p.status) = lower($${params.length})`;
      }

      if (query) {
        params.push(`%${query}%`);
        searchClause = `and (
          p.booking_id::text ilike $${params.length} or
          b.player_name ilike $${params.length} or
          p.transaction_id ilike $${params.length} or
          b.booking_number ilike $${params.length}
        )`;
      }

      params.push(pageSize);
      params.push(offset);
      const limitParam = params.length - 1;
      const offsetParam = params.length;

      const { rows: data } = await client.queryObject(
        `
          select
            p.id,
            p.booking_id,
            b.player_name as player_name,
            p.amount,
            p.currency,
            p.status,
            p.payment_method,
            p.transaction_id,
            p.created_at,
            b.booking_number
          from public.payments p
          left join public.bookings b on b.id = p.booking_id
          where p.venue_id = $1
          ${statusClause}
          ${searchClause}
          order by p.created_at desc
          limit $${limitParam} offset $${offsetParam}
        `,
        params,
      );

      const { rows: totalRows } = await client.queryObject<{ count: string }>(
        `
          select count(*)::text as count
          from public.payments p
          left join public.bookings b on b.id = p.booking_id
          where p.venue_id = $1
          ${statusClause}
          ${searchClause}
        `,
        params.slice(0, params.length - 2),
      );

      return jsonResponse({
        data: data.map((row) => ({
          ...row,
          status: row.status ? String(row.status).toUpperCase() : "PENDING",
          method: row.payment_method,
          player_name: row.player_name ?? "-",
        })),
        total: Number(totalRows[0]?.count ?? 0),
      });
    }

    if (req.method === "GET" && pathname === "/payments/export") {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);

      const status = url.searchParams.get("status");
      const query = url.searchParams.get("q");

      const params: Array<string> = [venueId];
      let statusClause = "";
      let searchClause = "";

      if (status && status.toLowerCase() !== "all") {
        params.push(status);
        statusClause = `and lower(p.status) = lower($${params.length})`;
      }

      if (query) {
        params.push(`%${query}%`);
        searchClause = `and (
          p.booking_id::text ilike $${params.length} or
          b.player_name ilike $${params.length} or
          p.transaction_id ilike $${params.length} or
          b.booking_number ilike $${params.length}
        )`;
      }

      const { rows } = await client.queryObject(
        `
          select
            p.id,
            p.booking_id,
            b.player_name as player_name,
            p.amount,
            p.currency,
            p.status,
            p.payment_method,
            p.transaction_id,
            p.created_at,
            b.booking_number
          from public.payments p
          left join public.bookings b on b.id = p.booking_id
          where p.venue_id = $1
          ${statusClause}
          ${searchClause}
          order by p.created_at desc
        `,
        params,
      );

      const headers = [
        "transaction_id",
        "booking_id",
        "player_name",
        "amount",
        "currency",
        "status",
        "method",
        "created_at",
      ];
      const csvRows = [headers.join(",")];
      for (const row of rows) {
        const values = [
          row.transaction_id ?? row.id,
          row.booking_number ?? row.booking_id,
          row.player_name ?? "",
          row.amount,
          row.currency ?? "THB",
          row.status ? String(row.status).toUpperCase() : "PENDING",
          row.payment_method ?? "",
          row.created_at,
        ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`);
        csvRows.push(values.join(","));
      }
      const filename = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
      return textResponse(csvRows.join("\n"), 200, {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      });
    }

    if (req.method === "GET" && pathname === "/payments/pending") {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);

      const query = url.searchParams.get("q");
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
      const offset = (Number.isNaN(page) ? 0 : Math.max(page - 1, 0)) * pageSize;

      const params: Array<string | number> = [venueId];
      let searchClause = "";
      if (query) {
        params.push(`%${query}%`);
        searchClause = `and (
          b.booking_number ilike $${params.length} or
          b.player_name ilike $${params.length}
        )`;
      }

      params.push(pageSize);
      params.push(offset);
      const limitParam = params.length - 1;
      const offsetParam = params.length;

      const { rows: data } = await client.queryObject(
        `
          select
            b.id,
            b.booking_number,
            b.player_name,
            b.date,
            b.time,
            b.total_price as amount,
            b.status,
            b.created_at,
            c.name as court_name
          from public.bookings b
          left join public.courts c on c.id = b.court_id
          where b.venue_id = $1
            and b.status = 'pending'
            ${searchClause}
          order by b.created_at desc
          limit $${limitParam} offset $${offsetParam}
        `,
        params,
      );

      const { rows: totalRows } = await client.queryObject<{ count: string }>(
        `
          select count(*)::text as count
          from public.bookings b
          where b.venue_id = $1
            and b.status = 'pending'
            ${searchClause}
        `,
        params.slice(0, params.length - 2),
      );

      return jsonResponse({
        data,
        total: Number(totalRows[0]?.count ?? 0),
      });
    }

    if (req.method === "GET" && pathname === "/crm/memberships") {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);

      const status = url.searchParams.get("status");
      const query = url.searchParams.get("q");
      const params: Array<string> = [venueId];
      let statusClause = "";
      let searchClause = "";

      if (status && status.toLowerCase() !== "all") {
        params.push(status);
        statusClause = `and lower(mt.status) = lower($${params.length})`;
      }
      if (query) {
        params.push(`%${query}%`);
        searchClause = `and mt.name ilike $${params.length}`;
      }

      const { rows } = await client.queryObject(
        `
          select
            mt.id,
            mt.name,
            mt.description_public,
            mt.description_internal,
            mt.status,
            mt.fixed_hourly_rate,
            mt.percent_discount,
            mt.early_booking_hours,
            mt.auto_confirm,
            mt.allow_peak,
            mt.cancellation_window_hours,
            mt.no_show_forgiveness,
            mt.created_at,
            mt.updated_at
          from public.membership_types mt
          where mt.venue_id = $1
          ${statusClause}
          ${searchClause}
          order by mt.created_at desc
        `,
        params,
      );
      return jsonResponse(rows);
    }

    if (req.method === "POST" && pathname === "/crm/memberships") {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const payload = await parseJsonBody(req);
      if (!payload?.name?.trim()) return jsonResponse({ error: "Name is required" }, 400);

      const status = payload.status ? String(payload.status).toLowerCase() : null;
      const { rows } = await client.queryObject(
        `
          insert into public.membership_types (
            venue_id,
            name,
            description_public,
            description_internal,
            status,
            fixed_hourly_rate,
            percent_discount,
            early_booking_hours,
            auto_confirm,
            allow_peak,
            cancellation_window_hours,
            no_show_forgiveness
          ) values (
            $1, $2, $3, $4, coalesce($5::public.membership_type_status, 'active'::public.membership_type_status),
            $6, $7, $8, coalesce($9, false), coalesce($10, true), $11, coalesce($12, false)
          )
          returning *
        `,
        [
          venueId,
          payload.name.trim(),
          payload.description_public ?? null,
          payload.description_internal ?? null,
          status,
          payload.fixed_hourly_rate ?? null,
          payload.percent_discount ?? null,
          payload.early_booking_hours ?? null,
          payload.auto_confirm ?? false,
          payload.allow_peak ?? true,
          payload.cancellation_window_hours ?? null,
          payload.no_show_forgiveness ?? false,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "PUT" && pathname.startsWith("/crm/memberships/")) {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const membershipId = pathname.split("/")[3];
      const payload = await parseJsonBody(req);
      const status = payload.status ? String(payload.status).toLowerCase() : null;
      const { rows } = await client.queryObject(
        `
          update public.membership_types
          set
            name = coalesce($3, name),
            description_public = $4,
            description_internal = $5,
            status = coalesce($6::public.membership_type_status, status),
            fixed_hourly_rate = $7,
            percent_discount = $8,
            early_booking_hours = $9,
            auto_confirm = coalesce($10, auto_confirm),
            allow_peak = coalesce($11, allow_peak),
            cancellation_window_hours = $12,
            no_show_forgiveness = coalesce($13, no_show_forgiveness),
            updated_at = now()
          where id = $1 and venue_id = $2
          returning *
        `,
        [
          membershipId,
          venueId,
          payload.name?.trim() ?? null,
          payload.description_public ?? null,
          payload.description_internal ?? null,
          status,
          payload.fixed_hourly_rate ?? null,
          payload.percent_discount ?? null,
          payload.early_booking_hours ?? null,
          payload.auto_confirm ?? null,
          payload.allow_peak ?? null,
          payload.cancellation_window_hours ?? null,
          payload.no_show_forgiveness ?? null,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "GET" && pathname === "/crm/players") {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);

      const query = url.searchParams.get("q");
      const membershipTypeId = url.searchParams.get("membershipTypeId");
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const offset = (Number.isNaN(page) ? 0 : Math.max(page - 1, 0)) * pageSize;

      const params: Array<string | number> = [venueId];
      let searchClause = "";
      let membershipClause = "";

      if (query) {
        params.push(`%${query}%`);
        searchClause = `and (
          p.name ilike $${params.length} or
          p.phone ilike $${params.length} or
          p.email ilike $${params.length}
        )`;
      }

      if (membershipTypeId) {
        params.push(membershipTypeId);
        membershipClause = `and pm.membership_type_id = $${params.length}`;
      }

      params.push(pageSize);
      params.push(offset);
      const limitParam = params.length - 1;
      const offsetParam = params.length;

      const { rows: data } = await client.queryObject(
        `
          with stats as (
            select
              b.player_id,
              count(*)::int as total_bookings,
              coalesce(sum(b.total_price::numeric), 0)::numeric as total_spend,
              max(b.slot_start) as last_visit
            from public.bookings b
            where b.venue_id = $1
            group by b.player_id
          )
          select
            p.id,
            p.name,
            p.phone,
            p.email,
            p.tags,
            coalesce(stats.total_bookings, 0) as total_bookings,
            coalesce(stats.total_spend, 0) as total_spend,
            stats.last_visit,
            pm.status as membership_status,
            mt.id as membership_type_id,
            mt.name as membership_type_name
          from public.players p
          left join public.player_memberships pm
            on pm.player_id = p.id
            and pm.status = 'active'
          left join public.membership_types mt on mt.id = pm.membership_type_id
          left join stats on stats.player_id = p.id
          where p.venue_id = $1
          ${searchClause}
          ${membershipClause}
          order by p.created_at desc
          limit $${limitParam} offset $${offsetParam}
        `,
        params,
      );

      const { rows: totalRows } = await client.queryObject<{ count: string }>(
        `
          select count(*)::text as count
          from public.players p
          left join public.player_memberships pm
            on pm.player_id = p.id
            and pm.status = 'active'
          where p.venue_id = $1
          ${searchClause}
          ${membershipClause}
        `,
        params.slice(0, params.length - 2),
      );

      return jsonResponse({
        data,
        total: Number(totalRows[0]?.count ?? 0),
      });
    }

    if (req.method === "POST" && pathname === "/crm/players") {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const payload = await parseJsonBody(req);
      if (!payload?.name?.trim()) return jsonResponse({ error: "Name is required" }, 400);

      const { rows } = await client.queryObject(
        `
          insert into public.players (venue_id, name, phone, email, tags)
          values ($1, $2, $3, $4, $5)
          returning *
        `,
        [
          venueId,
          payload.name.trim(),
          payload.phone ?? null,
          payload.email ? payload.email.toLowerCase() : null,
          payload.tags ?? [],
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "PUT" && pathname.startsWith("/crm/players/") && pathname.split("/").length === 4) {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const playerId = pathname.split("/")[3];
      const payload = await parseJsonBody(req);
      const { rows } = await client.queryObject(
        `
          update public.players
          set
            name = coalesce($3, name),
            phone = $4,
            email = $5,
            tags = coalesce($6, tags),
            updated_at = now()
          where id = $1 and venue_id = $2
          returning *
        `,
        [
          playerId,
          venueId,
          payload.name?.trim() ?? null,
          payload.phone ?? null,
          payload.email ? payload.email.toLowerCase() : null,
          payload.tags ?? null,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "POST" && pathname.endsWith("/membership")) {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const playerId = pathname.split("/")[3];
      const payload = await parseJsonBody(req);

      await client.queryObject(
        `
          update public.player_memberships
          set status = 'inactive', updated_at = now()
          where player_id = $1 and status = 'active'
        `,
        [playerId],
      );

      if (!payload.membershipTypeId) {
        return jsonResponse({ ok: true });
      }

      const status = payload.status ? String(payload.status).toLowerCase() : null;
      const { rows } = await client.queryObject(
        `
          insert into public.player_memberships (
            venue_id,
            player_id,
            membership_type_id,
            status,
            start_date,
            end_date
          ) values (
            $1, $2, $3,
            coalesce($4::public.membership_status, 'active'::public.membership_status),
            $5, $6
          )
          returning *
        `,
        [
          venueId,
          playerId,
          payload.membershipTypeId,
          status,
          payload.startDate ?? null,
          payload.endDate ?? null,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "POST" && pathname.endsWith("/notes")) {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const playerId = pathname.split("/")[3];
      const payload = await parseJsonBody(req);
      if (!payload?.note?.trim()) return jsonResponse({ error: "Note is required" }, 400);

      const { rows } = await client.queryObject(
        `
          insert into public.player_notes (venue_id, player_id, note, created_by)
          values ($1, $2, $3, $4)
          returning *
        `,
        [venueId, playerId, payload.note.trim(), adminUserId],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "GET" && pathname.startsWith("/crm/players/") && pathname.split("/").length === 4) {
      const venueId = await getPrimaryVenueId(client, adminUserId);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const playerId = pathname.split("/")[3];

      const { rows: playerRows } = await client.queryObject(
        `
          with stats as (
            select
              b.player_id,
              count(*)::int as total_bookings,
              coalesce(sum(b.total_price::numeric), 0)::numeric as total_spend,
              max(b.slot_start) as last_visit
            from public.bookings b
            where b.player_id = $1
            group by b.player_id
          )
          select
            p.id,
            p.name,
            p.phone,
            p.email,
            p.tags,
            coalesce(stats.total_bookings, 0) as total_bookings,
            coalesce(stats.total_spend, 0) as total_spend,
            stats.last_visit,
            pm.status as membership_status,
            pm.start_date,
            pm.end_date,
            mt.id as membership_type_id,
            mt.name as membership_type_name
          from public.players p
          left join public.player_memberships pm
            on pm.player_id = p.id
            and pm.status = 'active'
          left join public.membership_types mt on mt.id = pm.membership_type_id
          left join stats on stats.player_id = p.id
          where p.id = $1 and p.venue_id = $2
          limit 1
        `,
        [playerId, venueId],
      );

      if (!playerRows[0]) {
        return jsonResponse({ error: "Player not found" }, 404);
      }

      const { rows: notes } = await client.queryObject(
        `
          select id, note, created_by, created_at
          from public.player_notes
          where player_id = $1
          order by created_at desc
        `,
        [playerId],
      );

      const { rows: bookings } = await client.queryObject(
        `
          select
            id,
            booking_number,
            date,
            time,
            start_at,
            end_at,
            total_price as amount,
            status,
            membership_type,
            final_price,
            created_at
          from public.bookings
          where player_id = $1
          order by created_at desc
          limit 50
        `,
        [playerId],
      );

      return jsonResponse({
        player: playerRows[0],
        notes,
        bookings,
      });
    }

    if (req.method === "GET" && pathname === "/api/resolve-url") {
      const rawUrl = url.searchParams.get("url");
      if (!rawUrl) return jsonResponse({ error: "url query param required" }, 400);

      try {
        const response = await fetch(rawUrl, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PlayPal/1.0; +https://playpal.app)",
          },
        });

        const resolvedUrl = response.url;
        const coords = extractLatLngFromMapsUrl(resolvedUrl);

        return jsonResponse({
          resolvedUrl,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          extracted: coords !== null,
        });
      } catch (err) {
        console.error("resolve-url error:", err);
        return jsonResponse({ error: "Failed to resolve URL" }, 500);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Server error" }, 500);
  } finally {
    client.release();
  }
});
