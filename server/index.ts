import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "crypto";
import { z } from "zod";
import { pool } from "./db";
import { requireUser, type AuthedRequest } from "./auth";
import {
  courtsSchema,
  photoTypeEnum,
  photosPayloadSchema,
  venueProfileSchema,
  venueStatusEnum,
} from "../src/shared/venueOnboardingSchemas";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const uploadStore = new Map<string, { buffer: Buffer; contentType: string }>();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:8080" }));
app.use(express.json({ limit: "2mb" }));

const ensureVenueAccess = async (userId: string, venueId: string) => {
  const { rows } = await pool.query(
    "select 1 from public.user_roles where user_id = $1 and venue_id = $2 limit 1",
    [userId, venueId],
  );
  return rows.length > 0;
};

const getPrimaryVenueId = async (userId: string) => {
  const { rows } = await pool.query<{ venue_id: string }>(
    "select venue_id from public.user_roles where user_id = $1 order by created_at asc limit 1",
    [userId],
  );
  return rows[0]?.venue_id ?? null;
};

app.post("/api/upload", requireUser, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "File is required" });
    return;
  }

  const isValidType = ["image/jpeg", "image/png"].includes(file.mimetype);
  if (!isValidType) {
    res.status(400).json({ error: "Only JPG/PNG files are allowed" });
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    res.status(400).json({ error: "File exceeds 10MB limit" });
    return;
  }

  const id = randomUUID();
  uploadStore.set(id, { buffer: file.buffer, contentType: file.mimetype });
  res.json({ url: `http://localhost:${port}/api/uploads/${id}` });
});

app.get("/api/uploads/:id", (req, res) => {
  const entry = uploadStore.get(req.params.id);
  if (!entry) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", entry.contentType);
  res.send(entry.buffer);
});

app.post("/api/venues/draft", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const profileDraftSchema = venueProfileSchema.partial();
  const parsed = profileDraftSchema.safeParse(authedReq.body.profile ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rows: existing } = await pool.query(
    "select venue_id from public.user_roles where user_id = $1 order by created_at asc limit 1",
    [authedReq.user.id],
  );
  if (existing.length) {
    res.json({ venueId: existing[0].venue_id });
    return;
  }

  const profile = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
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
        new_venue.id,
        coalesce($1, 'New Venue'),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb,
        $11,
        $12,
        $13,
        'DRAFT',
        'venue-' || substring(replace(new_venue.id::text, '-', '') from 1 for 12)
      from new_venue
      returning id`,
      [
        profile.venueNameEn ?? null,
        profile.venueNameTh ?? null,
        profile.venueType ?? null,
        profile.addressLine1 ?? null,
        profile.subdistrict ?? null,
        profile.district ?? null,
        profile.province ?? null,
        profile.postcode ?? null,
        profile.googleMapsUrl ?? null,
        profile.openingHours ? JSON.stringify(profile.openingHours) : null,
        profile.defaultSlotDurationMins ?? null,
        profile.email ?? authedReq.user.email,
        profile.phone ?? null,
      ],
    );

    const venueId = rows[0].id as string;

    await client.query(
      "insert into public.user_profiles (id, venue_id, email) values ($1, $2, $3)",
      [authedReq.user.id, venueId, authedReq.user.email ?? ""],
    );

    await client.query(
      "insert into public.user_roles (user_id, venue_id, role) values ($1, $2, 'owner')",
      [authedReq.user.id, venueId],
    );

    await client.query(
      "insert into public.venue_settings (venue_id) values ($1) on conflict (venue_id) do nothing",
      [venueId],
    );

    await client.query(
      "insert into public.user_settings (user_id, venue_id) values ($1, $2) on conflict (user_id, venue_id) do nothing",
      [authedReq.user.id, venueId],
    );

    await client.query("commit");
    res.json({ venueId });
  } catch (error) {
    await client.query("rollback");
    res.status(500).json({ error: "Failed to create draft venue" });
  } finally {
    client.release();
  }
});

app.put("/api/venues/:venueId", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const bodySchema = z.object({
    profile: venueProfileSchema,
    status: venueStatusEnum.optional(),
  });
  const parsed = bodySchema.safeParse(authedReq.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const venueId = authedReq.params.venueId;
  if (!(await ensureVenueAccess(authedReq.user.id, venueId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { profile, status } = parsed.data;
  await pool.query(
    `update public.venues
     set name = $1,
         name_en = $1,
         name_th = $2,
         venue_type = $3,
         address_line1 = $4,
         subdistrict = $5,
         district = $6,
         province = $7,
         postcode = $8,
         google_maps_url = $9,
         opening_hours = $10::jsonb,
         default_slot_duration_mins = $11,
         email = $12,
         phone = $13,
         status = coalesce($14, status),
         updated_at = now()
     where id = $15`,
    [
      profile.venueNameEn,
      profile.venueNameTh ?? null,
      profile.venueType,
      profile.addressLine1,
      profile.subdistrict,
      profile.district,
      profile.province,
      profile.postcode,
      profile.googleMapsUrl,
      JSON.stringify(profile.openingHours),
      profile.defaultSlotDurationMins,
      profile.email,
      profile.phone,
      status ?? null,
      venueId,
    ],
  );

  res.json({ ok: true });
});

app.post("/api/venues/:venueId/courts", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const schema = z.object({ courts: courtsSchema });
  const parsed = schema.safeParse(authedReq.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const venueId = authedReq.params.venueId;
  if (!(await ensureVenueAccess(authedReq.user.id, venueId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from public.courts where venue_id = $1", [venueId]);

    const inserted = [];
    for (const court of parsed.data.courts) {
      const { rows } = await client.query(
        `insert into public.courts (
          venue_id,
          name,
          sport,
          sport_type,
          environment,
          surface_type,
          has_lighting,
          weekday_price_per_hour_thb,
          weekend_price_per_hour_thb,
          peak_price,
          off_peak_price
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        returning id`,
        [
          venueId,
          court.courtName,
          court.sportType,
          court.sportType,
          court.environment,
          court.surfaceType,
          court.hasLighting,
          court.weekdayPricePerHourThb,
          court.weekendPricePerHourThb,
          court.weekendPricePerHourThb,
          court.weekdayPricePerHourThb,
        ],
      );
      inserted.push({ id: rows[0].id });
    }

    await client.query("commit");
    res.json({ courts: inserted });
  } catch (error) {
    await client.query("rollback");
    res.status(500).json({ error: "Failed to save courts" });
  } finally {
    client.release();
  }
});

app.post("/api/venues/:venueId/photos", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const parsed = photosPayloadSchema.safeParse(authedReq.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const venueId = authedReq.params.venueId;
  if (!(await ensureVenueAccess(authedReq.user.id, venueId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const incomingPhotos = parsed.data.photos as Array<{
    courtId?: string | null;
    type: string;
    url: string;
  }>;

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from public.photos where venue_id = $1", [venueId]);

    for (const photo of incomingPhotos) {
      await client.query(
        `insert into public.photos (venue_id, court_id, type, url)
         values ($1, $2, $3, $4)`,
        [venueId, photo.courtId ?? null, photo.type, photo.url],
      );
    }

    await client.query("commit");
    res.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    res.status(500).json({ error: "Failed to save photos" });
  } finally {
    client.release();
  }
});

app.post("/api/venues/:venueId/submit", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = authedReq.params.venueId;
  if (!(await ensureVenueAccess(authedReq.user.id, venueId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { rows: venueRows } = await pool.query(
    `select
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
      phone
     from public.venues
     where id = $1`,
    [venueId],
  );

  if (!venueRows.length) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const venueRow = venueRows[0];
  const profilePayload = {
    venueNameEn: venueRow.name_en || "",
    venueNameTh: venueRow.name_th || "",
    venueType: venueRow.venue_type,
    addressLine1: venueRow.address_line1 || "",
    subdistrict: venueRow.subdistrict || "",
    district: venueRow.district || "",
    province: venueRow.province || "",
    postcode: venueRow.postcode || "",
    googleMapsUrl: venueRow.google_maps_url || "",
    phone: venueRow.phone || "",
    email: venueRow.email || "",
    openingHours: venueRow.opening_hours || {},
    defaultSlotDurationMins: venueRow.default_slot_duration_mins,
  };

  const profileCheck = venueProfileSchema.safeParse(profilePayload);
  if (!profileCheck.success) {
    res.status(400).json({ error: "Profile incomplete" });
    return;
  }

  const { rows: courtRows } = await pool.query(
    "select id from public.courts where venue_id = $1",
    [venueId],
  );
  if (!courtRows.length) {
    res.status(400).json({ error: "At least one court is required" });
    return;
  }

  const { rows: photoRows } = await pool.query<{ type: string; court_id: string | null }>(
    "select type, court_id from public.photos where venue_id = $1",
    [venueId],
  );

  const hasCover = photoRows.some(
    (photo: { type: string; court_id: string | null }) =>
      photo.type === photoTypeEnum.Enum.COVER,
  );
  if (!hasCover) {
    res.status(400).json({ error: "Venue cover photo is required" });
    return;
  }

  for (const court of courtRows) {
    const hasCourtPhoto = photoRows.some(
      (photo: { type: string; court_id: string | null }) =>
        photo.type === photoTypeEnum.Enum.COURT && photo.court_id === court.id,
    );
    if (!hasCourtPhoto) {
      res.status(400).json({ error: "Each court requires at least one photo" });
      return;
    }
  }

  await pool.query(
    "update public.venues set status = 'SUBMITTED', updated_at = now() where id = $1",
    [venueId],
  );

  res.json({ ok: true });
});

app.get("/api/venues/:venueId/bookings", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = authedReq.params.venueId;
  if (!(await ensureVenueAccess(authedReq.user.id, venueId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const start = authedReq.query.start ? new Date(String(authedReq.query.start)) : null;
  const end = authedReq.query.end ? new Date(String(authedReq.query.end)) : null;
  const courtId = authedReq.query.courtId ? String(authedReq.query.courtId) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    res.status(400).json({ error: "Invalid start/end range" });
    return;
  }

  const params: Array<string | Date> = [venueId, start.toISOString(), end.toISOString()];
  let courtFilter = "";
  if (courtId) {
    params.push(courtId);
    courtFilter = `and b.court_id = $${params.length}`;
  }

  const { rows } = await pool.query<{
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

  res.json(payload);
});

app.get("/payments/summary", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const status = authedReq.query.status ? String(authedReq.query.status) : null;
  const query = authedReq.query.q ? String(authedReq.query.q) : null;

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

  const { rows } = await pool.query<{
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
  res.json({
    completedAmount: Number(summary?.completed_amount ?? 0),
    completedCount: Number(summary?.completed_count ?? 0),
    pendingAmount: Number(summary?.pending_booking_amount ?? 0),
    pendingCount: Number(summary?.pending_booking_count ?? 0),
    refundedAmount: Number(summary?.refunded_amount ?? 0),
    refundedCount: Number(summary?.refunded_count ?? 0),
    totalCount: Number(summary?.total_count ?? 0),
  });
});

app.get("/payments", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const status = authedReq.query.status ? String(authedReq.query.status) : null;
  const query = authedReq.query.q ? String(authedReq.query.q) : null;
  const page = Number(authedReq.query.page ?? 1);
  const pageSize = Number(authedReq.query.pageSize ?? 10);
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

  const { rows: data } = await pool.query(
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

  const { rows: totalRows } = await pool.query<{ count: string }>(
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

  res.json({
    data: data.map((row) => ({
      ...row,
      status: row.status ? String(row.status).toUpperCase() : "PENDING",
      method: row.payment_method,
      player_name: row.player_name ?? "-",
    })),
    total: Number(totalRows[0]?.count ?? 0),
  });
});

app.get("/payments/export", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const status = authedReq.query.status ? String(authedReq.query.status) : null;
  const query = authedReq.query.q ? String(authedReq.query.q) : null;

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

  const { rows } = await pool.query(
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
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  res.send(csvRows.join("\n"));
});

app.get("/payments/pending", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const query = authedReq.query.q ? String(authedReq.query.q) : null;
  const page = Number(authedReq.query.page ?? 1);
  const pageSize = Number(authedReq.query.pageSize ?? 10);
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

  const { rows: data } = await pool.query(
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

  const { rows: totalRows } = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from public.bookings b
      where b.venue_id = $1
        and b.status = 'pending'
        ${searchClause}
    `,
    params.slice(0, params.length - 2),
  );

  res.json({
    data,
    total: Number(totalRows[0]?.count ?? 0),
  });
});

app.get("/crm/memberships", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const status = authedReq.query.status ? String(authedReq.query.status) : null;
  const query = authedReq.query.q ? String(authedReq.query.q) : null;

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

  const { rows } = await pool.query(
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

  res.json(rows);
});

app.post("/crm/memberships", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const payload = authedReq.body as {
    name?: string;
    description_public?: string | null;
    description_internal?: string | null;
    status?: string | null;
    fixed_hourly_rate?: number | null;
    percent_discount?: number | null;
    early_booking_hours?: number | null;
    auto_confirm?: boolean | null;
    allow_peak?: boolean | null;
    cancellation_window_hours?: number | null;
    no_show_forgiveness?: boolean | null;
  };

  if (!payload?.name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const status = payload.status ? String(payload.status).toLowerCase() : null;
  const { rows } = await pool.query(
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

  res.json(rows[0]);
});

app.put("/crm/memberships/:membershipId", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const membershipId = authedReq.params.membershipId;
  const payload = authedReq.body as {
    name?: string;
    description_public?: string | null;
    description_internal?: string | null;
    status?: string | null;
    fixed_hourly_rate?: number | null;
    percent_discount?: number | null;
    early_booking_hours?: number | null;
    auto_confirm?: boolean | null;
    allow_peak?: boolean | null;
    cancellation_window_hours?: number | null;
    no_show_forgiveness?: boolean | null;
  };

  const status = payload.status ? String(payload.status).toLowerCase() : null;
  const { rows } = await pool.query(
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

  res.json(rows[0]);
});

app.get("/crm/players", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const query = authedReq.query.q ? String(authedReq.query.q) : null;
  const membershipTypeId = authedReq.query.membershipTypeId
    ? String(authedReq.query.membershipTypeId)
    : null;
  const page = Number(authedReq.query.page ?? 1);
  const pageSize = Number(authedReq.query.pageSize ?? 20);
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

  const { rows: data } = await pool.query(
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

  const { rows: totalRows } = await pool.query<{ count: string }>(
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

  res.json({
    data,
    total: Number(totalRows[0]?.count ?? 0),
  });
});

app.post("/crm/players", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const payload = authedReq.body as {
    name?: string;
    phone?: string | null;
    email?: string | null;
    tags?: string[] | null;
  };

  if (!payload?.name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const { rows } = await pool.query(
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

  res.json(rows[0]);
});

app.put("/crm/players/:playerId", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const playerId = authedReq.params.playerId;
  const payload = authedReq.body as {
    name?: string;
    phone?: string | null;
    email?: string | null;
    tags?: string[] | null;
  };

  const { rows } = await pool.query(
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

  res.json(rows[0]);
});

app.post("/crm/players/:playerId/membership", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const playerId = authedReq.params.playerId;
  const payload = authedReq.body as {
    membershipTypeId?: string | null;
    status?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };

  await pool.query(
    `
      update public.player_memberships
      set status = 'inactive', updated_at = now()
      where player_id = $1 and status = 'active'
    `,
    [playerId],
  );

  if (!payload.membershipTypeId) {
    res.json({ ok: true });
    return;
  }

  const status = payload.status ? String(payload.status).toLowerCase() : null;
  const { rows } = await pool.query(
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

  res.json(rows[0]);
});

app.post("/crm/players/:playerId/notes", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const playerId = authedReq.params.playerId;
  const payload = authedReq.body as { note?: string };
  if (!payload?.note?.trim()) {
    res.status(400).json({ error: "Note is required" });
    return;
  }

  const { rows } = await pool.query(
    `
      insert into public.player_notes (venue_id, player_id, note, created_by)
      values ($1, $2, $3, $4)
      returning *
    `,
    [venueId, playerId, payload.note.trim(), authedReq.user.id],
  );

  res.json(rows[0]);
});

app.get("/crm/players/:playerId", requireUser, async (req, res) => {
  const authedReq = req as AuthedRequest;
  const venueId = await getPrimaryVenueId(authedReq.user.id);
  if (!venueId) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }

  const playerId = authedReq.params.playerId;

  const { rows: playerRows } = await pool.query(
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
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const { rows: notes } = await pool.query(
    `
      select id, note, created_by, created_at
      from public.player_notes
      where player_id = $1
      order by created_at desc
    `,
    [playerId],
  );

  const { rows: bookings } = await pool.query(
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

  res.json({
    player: playerRows[0],
    notes,
    bookings,
  });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on ${port}`);
});
