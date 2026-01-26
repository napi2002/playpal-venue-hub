import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DATABASE_URL = Deno.env.get("DATABASE_URL");
const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN") ?? "*";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL");
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

const getUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
};

const ensureVenueAccess = async (client: ReturnType<typeof pool.connect>, userId: string, venueId: string) => {
  const { rows } = await client.queryObject(
    "select 1 from public.user_roles where user_id = $1 and venue_id = $2 limit 1",
    [userId, venueId],
  );
  return rows.length > 0;
};

const getPrimaryVenueId = async (client: ReturnType<typeof pool.connect>, userId: string) => {
  const { rows } = await client.queryObject<{ venue_id: string }>(
    "select venue_id from public.user_roles where user_id = $1 order by created_at asc limit 1",
    [userId],
  );
  return rows[0]?.venue_id ?? null;
};

const parseJsonBody = async (req: Request) => {
  if (req.headers.get("content-type")?.includes("application/json")) {
    return await req.json();
  }
  return {};
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/^\/functions\/v1/, "");
  const user = await getUser(req);
  if (!user) {
    return jsonResponse({ error: "Invalid auth token" }, 401);
  }

  const client = await pool.connect();
  try {
    if (req.method === "POST" && pathname === "/api/upload") {
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

      const { rows: existing } = await client.queryObject<{ venue_id: string }>(
        "select venue_id from public.user_roles where user_id = $1 order by created_at asc limit 1",
        [user.id],
      );
      if (existing.length) {
        return jsonResponse({ venueId: existing[0].venue_id });
      }

      await client.queryObject("begin");
      try {
        const { rows } = await client.queryObject<{ id: string }>(
          `with new_venue as (
            select gen_random_uuid() as id
          )
          insert into public.venues (
            id,
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
            slug
          )
          select
            id,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            'DRAFT',
            $15
          from new_venue
          returning id`,
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
            `${user.id}-venue`,
          ],
        );

        const venueId = rows[0]?.id;
        if (!venueId) {
          throw new Error("Failed to create venue");
        }

        await client.queryObject(
          `insert into public.user_roles (user_id, venue_id, role)
          values ($1, $2, 'owner')`,
          [user.id, venueId],
        );
        await client.queryObject("commit");
        return jsonResponse({ venueId });
      } catch (error) {
        await client.queryObject("rollback");
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed" }, 500);
      }
    }

    if (req.method === "PUT" && pathname.startsWith("/api/venues/")) {
      const venueId = pathname.split("/")[3];
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, user.id, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);
      const body = await parseJsonBody(req);
      const profile = body.profile ?? {};

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
            updated_at = now()
          where id = $15
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
          venueId,
        ],
      );
      return jsonResponse({ ok: true });
    }

    if (req.method === "POST" && pathname.endsWith("/courts")) {
      const venueId = pathname.split("/")[3];
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, user.id, venueId);
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

    if (req.method === "POST" && pathname.endsWith("/photos")) {
      const venueId = pathname.split("/")[3];
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, user.id, venueId);
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

    if (req.method === "POST" && pathname.endsWith("/submit")) {
      const venueId = pathname.split("/")[3];
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, user.id, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      await client.queryObject(
        "update public.venues set status = 'SUBMITTED', updated_at = now() where id = $1",
        [venueId],
      );
      return jsonResponse({ ok: true });
    }

    if (req.method === "GET" && pathname.startsWith("/api/venues/") && pathname.endsWith("/bookings")) {
      const venueId = pathname.split("/")[3];
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const ok = await ensureVenueAccess(client, user.id, venueId);
      if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      const courtId = url.searchParams.get("courtId");
      if (!start || !end) return jsonResponse({ error: "Start and end are required" }, 400);

      const params = [venueId, start, end];
      const courtFilter = courtId ? "and b.court_id = $4" : "";
      if (courtId) params.push(courtId);

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
            coalesce(b.start_at, (b.date + b.time) at time zone 'Asia/Bangkok') as "startAt",
            coalesce(
              b.end_at,
              coalesce(b.start_at, (b.date + b.time) at time zone 'Asia/Bangkok') + make_interval(mins => b.duration)
            ) as "endAt",
            b.status,
            b.player_name as "eventName"
          from public.bookings b
          join public.courts c on c.id = b.court_id
          where b.venue_id = $1
            and b.status in ('pending', 'paid', 'confirmed', 'held')
            and coalesce(b.start_at, (b.date + b.time) at time zone 'Asia/Bangkok') < $3
            and coalesce(
              b.end_at,
              coalesce(b.start_at, (b.date + b.time) at time zone 'Asia/Bangkok') + make_interval(mins => b.duration)
            ) > $2
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

    if (req.method === "GET" && pathname === "/payments/summary") {
      const venueId = await getPrimaryVenueId(client, user.id);
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
            coalesce(sum(case when upper(p.status) = 'COMPLETED' then p.amount::numeric else 0 end), 0) as completed_amount,
            count(*) filter (where upper(p.status) = 'COMPLETED') as completed_count,
            coalesce(sum(case when upper(p.status) = 'PENDING' then p.amount::numeric else 0 end), 0) as pending_amount,
            count(*) filter (where upper(p.status) = 'PENDING') as pending_count,
            coalesce(sum(case when upper(p.status) = 'REFUNDED' then p.amount::numeric else 0 end), 0) as refunded_amount,
            count(*) filter (where upper(p.status) = 'REFUNDED') as refunded_count,
            count(*) as total_count,
            (
              select coalesce(sum(b.amount::numeric), 0)
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
      const venueId = await getPrimaryVenueId(client, user.id);
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
      const venueId = await getPrimaryVenueId(client, user.id);
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
        ].map((value) => `"${String(value ?? "").replace(/\"/g, '\"\"')}"`);
        csvRows.push(values.join(","));
      }
      const filename = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
      return textResponse(csvRows.join("\n"), 200, {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      });
    }

    if (req.method === "GET" && pathname === "/payments/pending") {
      const venueId = await getPrimaryVenueId(client, user.id);
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
            b.amount,
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
      const venueId = await getPrimaryVenueId(client, user.id);
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
      const venueId = await getPrimaryVenueId(client, user.id);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const payload = await parseJsonBody(req);
      if (!payload?.name?.trim()) return jsonResponse({ error: "Name is required" }, 400);

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
            $1, $2, $3, $4, coalesce($5, 'active'),
            $6, $7, $8, coalesce($9, false), coalesce($10, true), $11, coalesce($12, false)
          )
          returning *
        `,
        [
          venueId,
          payload.name.trim(),
          payload.description_public ?? null,
          payload.description_internal ?? null,
          payload.status ?? null,
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
      const venueId = await getPrimaryVenueId(client, user.id);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const membershipId = pathname.split("/")[3];
      const payload = await parseJsonBody(req);
      const { rows } = await client.queryObject(
        `
          update public.membership_types
          set
            name = coalesce($3, name),
            description_public = $4,
            description_internal = $5,
            status = coalesce($6, status),
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
          payload.status ?? null,
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
      const venueId = await getPrimaryVenueId(client, user.id);
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
              coalesce(sum(b.amount::numeric), 0)::numeric as total_spend,
              max(coalesce(b.start_at, (b.date + b.time) at time zone 'Asia/Bangkok')) as last_visit
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
      const venueId = await getPrimaryVenueId(client, user.id);
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
      const venueId = await getPrimaryVenueId(client, user.id);
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
      const venueId = await getPrimaryVenueId(client, user.id);
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

      const { rows } = await client.queryObject(
        `
          insert into public.player_memberships (
            venue_id,
            player_id,
            membership_type_id,
            status,
            start_date,
            end_date
          ) values ($1, $2, $3, coalesce($4, 'active'), $5, $6)
          returning *
        `,
        [
          venueId,
          playerId,
          payload.membershipTypeId,
          payload.status ?? "active",
          payload.startDate ?? null,
          payload.endDate ?? null,
        ],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "POST" && pathname.endsWith("/notes")) {
      const venueId = await getPrimaryVenueId(client, user.id);
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
        [venueId, playerId, payload.note.trim(), user.id],
      );
      return jsonResponse(rows[0]);
    }

    if (req.method === "GET" && pathname.startsWith("/crm/players/") && pathname.split("/").length === 4) {
      const venueId = await getPrimaryVenueId(client, user.id);
      if (!venueId) return jsonResponse({ error: "Venue not found" }, 404);
      const playerId = pathname.split("/")[3];

      const { rows: playerRows } = await client.queryObject(
        `
          with stats as (
            select
              b.player_id,
              count(*)::int as total_bookings,
              coalesce(sum(b.amount::numeric), 0)::numeric as total_spend,
              max(coalesce(b.start_at, (b.date + b.time) at time zone 'Asia/Bangkok')) as last_visit
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
            amount,
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

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Server error" }, 500);
  } finally {
    client.release();
  }
});
