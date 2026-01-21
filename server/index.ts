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
        b.status
      from public.bookings b
      join public.courts c on c.id = b.court_id
      where b.venue_id = $1
        and b.status in ('pending', 'paid')
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

  const payload = rows.map((row: { id: any; courtId: any; courtName: any; startAt: string | number | Date; endAt: string | number | Date; status: string; }) => ({
    id: row.id,
    courtId: row.courtId,
    courtName: row.courtName,
    start: new Date(row.startAt).toISOString(),
    end: new Date(row.endAt).toISOString(),
    status: row.status === "paid" ? "PAID" : "PENDING",
  }));

  res.json(payload);
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on ${port}`);
});
