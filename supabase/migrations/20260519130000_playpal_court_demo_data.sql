-- Full demo seed: rename venue → Playpal Court, 4 courts, 10 players,
-- Gold/Silver memberships, 35 bookings (Apr–May 2026), payments, 4 recurring.
-- Safe to re-run: deletes all venue data first, then rebuilds.

do $$
declare
  _venue_id     integer;
  _owner_id     integer;
  -- courts
  _ca           integer;   -- Badminton Court A
  _cb           integer;   -- Badminton Court B
  _cc           integer;   -- Squash Court 1
  _cd           integer;   -- Tennis Court (Outdoor)
  -- membership types
  _mt_gold      integer;
  _mt_silver    integer;
  -- players
  _p_somchai    integer;
  _p_nattaporn  integer;
  _p_wanlapa    integer;
  _p_pruek      integer;
  _p_malee      integer;
  _p_arthit     integer;
  _p_siriporn   integer;
  _p_chaiwat    integer;
  _p_rossarin   integer;
  _p_tanawat    integer;
begin

  -- ── 1. Resolve venue ──────────────────────────────────
  select id, owner_id into _venue_id, _owner_id
  from public.venues order by id limit 1;
  if _venue_id is null then
    raise exception 'No venue found — cannot seed demo data.';
  end if;

  -- ── 2. Update venue profile ───────────────────────────
  update public.venues set
    name                     = 'Playpal Court',
    name_en                  = 'Playpal Court',
    name_th                  = 'เพลย์พัล คอร์ต',
    address                  = '28/4 Sukhumvit Soi 22, Khlong Toei, Bangkok 10110',
    address_line1            = '28/4 Sukhumvit Soi 22',
    subdistrict              = 'Khlong Toei',
    district                 = 'Khlong Toei',
    city                     = 'Bangkok',
    province                 = 'Bangkok',
    country                  = 'Thailand',
    postcode                 = '10110',
    email                    = 'hello@playpalcourt.th',
    phone                    = '+66 2 123 4567',
    description              = 'Premium indoor sports facility in the heart of Sukhumvit. Air-conditioned badminton & squash courts plus a floodlit outdoor tennis court.',
    venue_type               = 'Sports Complex',
    opening_hours            = '{
      "Mon": {"isOpen": true, "openTime": "07:00", "closeTime": "22:00"},
      "Tue": {"isOpen": true, "openTime": "07:00", "closeTime": "22:00"},
      "Wed": {"isOpen": true, "openTime": "07:00", "closeTime": "22:00"},
      "Thu": {"isOpen": true, "openTime": "07:00", "closeTime": "22:00"},
      "Fri": {"isOpen": true, "openTime": "07:00", "closeTime": "22:00"},
      "Sat": {"isOpen": true, "openTime": "08:00", "closeTime": "22:00"},
      "Sun": {"isOpen": true, "openTime": "08:00", "closeTime": "22:00"}
    }'::jsonb,
    sports_supported         = array['Badminton', 'Squash', 'Tennis', 'Table Tennis'],
    default_slot_duration_mins = 60,
    is_active                = true,
    status                   = 'SUBMITTED'
  where id = _venue_id;

  -- ── 3. Clear existing venue data (ordered to respect FKs) ──
  delete from public.recurring_bookings  where venue_id = _venue_id;
  delete from public.payments            where venue_id = _venue_id;
  delete from public.bookings            where venue_id = _venue_id;
  delete from public.player_notes        where venue_id = _venue_id;
  delete from public.player_memberships  where venue_id = _venue_id;
  delete from public.membership_types    where venue_id = _venue_id;
  delete from public.players             where venue_id = _venue_id;
  delete from public.courts              where venue_id = _venue_id;

  -- ── 4. Courts ─────────────────────────────────────────
  insert into public.courts (venue_id, name, sport, sport_type, environment,
    weekday_price_per_hour_thb, weekend_price_per_hour_thb,
    has_lighting, is_active, status, buffer_minutes, amenities)
  values (_venue_id, 'Badminton Court A', 'Badminton', 'Badminton', 'Indoor',
    300, 350, true, true, 'active', 15,
    '{"ac": true, "showers": true, "lockers": true}'::json)
  returning id into _ca;

  insert into public.courts (venue_id, name, sport, sport_type, environment,
    weekday_price_per_hour_thb, weekend_price_per_hour_thb,
    has_lighting, is_active, status, buffer_minutes, amenities)
  values (_venue_id, 'Badminton Court B', 'Badminton', 'Badminton', 'Indoor',
    300, 350, true, true, 'active', 15,
    '{"ac": true, "showers": true, "lockers": true}'::json)
  returning id into _cb;

  insert into public.courts (venue_id, name, sport, sport_type, environment,
    weekday_price_per_hour_thb, weekend_price_per_hour_thb,
    has_lighting, is_active, status, buffer_minutes, amenities)
  values (_venue_id, 'Squash Court 1', 'Squash', 'Squash', 'Indoor',
    350, 400, true, true, 'active', 15,
    '{"ac": true, "showers": true, "equipment_rental": true}'::json)
  returning id into _cc;

  insert into public.courts (venue_id, name, sport, sport_type, environment,
    weekday_price_per_hour_thb, weekend_price_per_hour_thb,
    has_lighting, is_active, status, buffer_minutes, amenities)
  values (_venue_id, 'Tennis Court (Outdoor)', 'Tennis', 'Tennis', 'Outdoor',
    400, 450, true, true, 'active', 30,
    '{"floodlights": true, "showers": true, "ball_machine": true}'::json)
  returning id into _cd;

  -- ── 5. Membership types ───────────────────────────────
  insert into public.membership_types (venue_id, name, description_public, status,
    fixed_hourly_rate, early_booking_hours, auto_confirm, allow_peak)
  values (_venue_id, 'Gold',
    'Fixed ฿200/hr on all courts. Bookings auto-confirmed. 48 h early access.',
    'active', 200, 48, true, true)
  returning id into _mt_gold;

  insert into public.membership_types (venue_id, name, description_public, status,
    percent_discount, early_booking_hours, auto_confirm, allow_peak)
  values (_venue_id, 'Silver',
    '20% discount on all bookings. 24 h early booking access.',
    'active', 20, 24, false, true)
  returning id into _mt_silver;

  -- ── 6. Players ────────────────────────────────────────
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Somchai Jaidee',     'somchai.j@gmail.com',  '+66 81 234 5678') returning id into _p_somchai;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Nattaporn Srisuk',   'natta.s@gmail.com',    '+66 89 234 5678') returning id into _p_nattaporn;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Wanlapa Chaiyo',     'wan.chai@hotmail.com', '+66 82 234 5678') returning id into _p_wanlapa;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Pruek Saengdao',     'pruek.s@gmail.com',    '+66 83 234 5678') returning id into _p_pruek;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Malee Thongpoon',    'malee.t@gmail.com',    '+66 84 234 5678') returning id into _p_malee;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Arthit Nakorn',      'arthit.n@gmail.com',   '+66 85 234 5678') returning id into _p_arthit;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Siriporn Boonma',    'siri.b@gmail.com',     '+66 86 234 5678') returning id into _p_siriporn;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Chaiwat Sriwong',    'chai.w@gmail.com',     '+66 87 234 5678') returning id into _p_chaiwat;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Rossarin Petcharat', 'ross.p@gmail.com',     '+66 88 234 5678') returning id into _p_rossarin;
  insert into public.players (venue_id, name, email, phone) values
    (_venue_id, 'Tanawat Pimol',      'tana.p@gmail.com',     '+66 90 234 5678') returning id into _p_tanawat;

  -- ── 7. Memberships ────────────────────────────────────
  insert into public.player_memberships
    (venue_id, player_id, membership_type_id, status, start_date)
  values
    (_venue_id, _p_somchai,   _mt_gold,   'active', '2026-01-01'),
    (_venue_id, _p_wanlapa,   _mt_gold,   'active', '2026-01-15'),
    (_venue_id, _p_nattaporn, _mt_silver, 'active', '2026-02-01'),
    (_venue_id, _p_arthit,    _mt_silver, 'active', '2026-03-01');

  -- ── 8. Player notes ───────────────────────────────────
  if _owner_id is not null then
    insert into public.player_notes (venue_id, player_id, note, created_by) values
      (_venue_id, _p_somchai,   'Prefers Court A. Books the Monday 07:00 slot every week without fail.',     _owner_id),
      (_venue_id, _p_nattaporn, 'Brings own racket and shoes. Prefers back-to-back squash sessions.',        _owner_id),
      (_venue_id, _p_wanlapa,   'Plays with husband on weekends. Usually books 90-min tennis slots.',        _owner_id),
      (_venue_id, _p_siriporn,  'New member — referred by Somchai. Still learning badminton technique.',     _owner_id),
      (_venue_id, _p_rossarin,  'Competitive tennis player. Interested in upgrading to Gold membership.',    _owner_id);
  end if;

  -- ── 9. Bookings ───────────────────────────────────────
  -- Disable membership trigger so we can set final_price explicitly.
  alter table public.bookings disable trigger handle_booking_membership;

  -- ── April (all paid, historical revenue) ──────────────
  -- Columns: venue_id, court_id, slot_start, slot_end, duration_minutes,
  --          status, total_price, final_price, currency,
  --          booking_number, player_name, player_email, player_id,
  --          membership_type, membership_type_id,
  --          source, payment_status, created_at, updated_at
  insert into public.bookings (
    venue_id, court_id, slot_start, slot_end, duration_minutes,
    status, total_price, final_price, currency,
    booking_number, player_name, player_email, player_id,
    membership_type, membership_type_id,
    source, payment_status, created_at, updated_at
  ) values
  -- Apr 7 Mon 09:00 | Court A | Somchai Gold 60min ฿200
  (_venue_id,_ca,'2026-04-07 02:00+00','2026-04-07 03:00+00',60,'paid',300,200,'THB',
   'BK900001','Somchai Jaidee','somchai.j@gmail.com',_p_somchai,'Gold',_mt_gold,
   'PlayPal App','Paid','2026-04-06 14:00+00','2026-04-07 03:30+00'),
  -- Apr 8 Tue 14:00 | Court C | Nattaporn Silver 60min ฿280
  (_venue_id,_cc,'2026-04-08 07:00+00','2026-04-08 08:00+00',60,'paid',350,280,'THB',
   'BK900002','Nattaporn Srisuk','natta.s@gmail.com',_p_nattaporn,'Silver',_mt_silver,
   'PlayPal App','Paid','2026-04-07 12:00+00','2026-04-08 08:30+00'),
  -- Apr 9 Wed 09:00 | Court B | Wanlapa Gold 60min ฿200
  (_venue_id,_cb,'2026-04-09 02:00+00','2026-04-09 03:00+00',60,'paid',300,200,'THB',
   'BK900003','Wanlapa Chaiyo','wan.chai@hotmail.com',_p_wanlapa,'Gold',_mt_gold,
   'Manual','Paid','2026-04-08 10:00+00','2026-04-09 03:30+00'),
  -- Apr 10 Thu 19:00 | Court C | Arthit Silver 60min ฿280
  (_venue_id,_cc,'2026-04-10 12:00+00','2026-04-10 13:00+00',60,'paid',350,280,'THB',
   'BK900004','Arthit Nakorn','arthit.n@gmail.com',_p_arthit,'Silver',_mt_silver,
   'API','Paid','2026-04-09 09:00+00','2026-04-10 13:30+00'),
  -- Apr 11 Sat 10:00 | Court D | Chaiwat 90min ฿700 (weekend tennis)
  (_venue_id,_cd,'2026-04-11 03:00+00','2026-04-11 04:30+00',90,'paid',700,700,'THB',
   'BK900005','Chaiwat Sriwong','chai.w@gmail.com',_p_chaiwat,null,null,
   'Manual','Paid','2026-04-10 08:00+00','2026-04-11 05:00+00'),
  -- Apr 14 Mon 09:00 | Court A | Somchai Gold 60min ฿200
  (_venue_id,_ca,'2026-04-14 02:00+00','2026-04-14 03:00+00',60,'paid',300,200,'THB',
   'BK900006','Somchai Jaidee','somchai.j@gmail.com',_p_somchai,'Gold',_mt_gold,
   'PlayPal App','Paid','2026-04-13 15:00+00','2026-04-14 03:30+00'),
  -- Apr 15 Tue 14:00 | Court C | Nattaporn Silver 60min ฿280
  (_venue_id,_cc,'2026-04-15 07:00+00','2026-04-15 08:00+00',60,'paid',350,280,'THB',
   'BK900007','Nattaporn Srisuk','natta.s@gmail.com',_p_nattaporn,'Silver',_mt_silver,
   'PlayPal App','Paid','2026-04-14 11:00+00','2026-04-15 08:30+00'),
  -- Apr 16 Wed 09:00 | Court B | Pruek 60min ฿300
  (_venue_id,_cb,'2026-04-16 02:00+00','2026-04-16 03:00+00',60,'paid',300,300,'THB',
   'BK900008','Pruek Saengdao','pruek.s@gmail.com',_p_pruek,null,null,
   'Manual','Paid','2026-04-15 14:00+00','2026-04-16 03:30+00'),
  -- Apr 17 Thu 19:00 | Court C | Arthit Silver 60min ฿280
  (_venue_id,_cc,'2026-04-17 12:00+00','2026-04-17 13:00+00',60,'paid',350,280,'THB',
   'BK900009','Arthit Nakorn','arthit.n@gmail.com',_p_arthit,'Silver',_mt_silver,
   'API','Paid','2026-04-16 10:00+00','2026-04-17 13:30+00'),
  -- Apr 19 Sat 10:00 | Court D | Wanlapa Gold 90min ฿300
  (_venue_id,_cd,'2026-04-19 03:00+00','2026-04-19 04:30+00',90,'paid',675,300,'THB',
   'BK900010','Wanlapa Chaiyo','wan.chai@hotmail.com',_p_wanlapa,'Gold',_mt_gold,
   'Manual','Paid','2026-04-18 08:00+00','2026-04-19 05:00+00'),
  -- Apr 21 Mon 09:00 | Court A | Somchai Gold 90min ฿300
  (_venue_id,_ca,'2026-04-21 02:00+00','2026-04-21 03:30+00',90,'paid',450,300,'THB',
   'BK900011','Somchai Jaidee','somchai.j@gmail.com',_p_somchai,'Gold',_mt_gold,
   'PlayPal App','Paid','2026-04-20 15:00+00','2026-04-21 04:00+00'),
  -- Apr 22 Tue 14:00 | Court C | Nattaporn Silver 60min ฿280
  (_venue_id,_cc,'2026-04-22 07:00+00','2026-04-22 08:00+00',60,'paid',350,280,'THB',
   'BK900012','Nattaporn Srisuk','natta.s@gmail.com',_p_nattaporn,'Silver',_mt_silver,
   'PlayPal App','Paid','2026-04-21 12:00+00','2026-04-22 08:30+00'),
  -- Apr 23 Wed 09:00 | Court B | Chaiwat 60min ฿300
  (_venue_id,_cb,'2026-04-23 02:00+00','2026-04-23 03:00+00',60,'paid',300,300,'THB',
   'BK900013','Chaiwat Sriwong','chai.w@gmail.com',_p_chaiwat,null,null,
   'Manual','Paid','2026-04-22 10:00+00','2026-04-23 03:30+00'),
  -- Apr 24 Thu 19:00 | Court C | Arthit Silver 60min ฿280
  (_venue_id,_cc,'2026-04-24 12:00+00','2026-04-24 13:00+00',60,'paid',350,280,'THB',
   'BK900014','Arthit Nakorn','arthit.n@gmail.com',_p_arthit,'Silver',_mt_silver,
   'API','Paid','2026-04-23 09:00+00','2026-04-24 13:30+00'),
  -- Apr 26 Sat 10:00 | Court D | Pruek 90min ฿700 (weekend tennis)
  (_venue_id,_cd,'2026-04-26 03:00+00','2026-04-26 04:30+00',90,'paid',700,700,'THB',
   'BK900015','Pruek Saengdao','pruek.s@gmail.com',_p_pruek,null,null,
   'Manual','Paid','2026-04-25 08:00+00','2026-04-26 05:00+00'),
  -- Apr 28 Mon 09:00 | Court A | Somchai Gold 60min ฿200
  (_venue_id,_ca,'2026-04-28 02:00+00','2026-04-28 03:00+00',60,'paid',300,200,'THB',
   'BK900016','Somchai Jaidee','somchai.j@gmail.com',_p_somchai,'Gold',_mt_gold,
   'PlayPal App','Paid','2026-04-27 14:00+00','2026-04-28 03:30+00'),
  -- Apr 29 Tue 14:00 | Court C | Nattaporn Silver 90min ฿420
  (_venue_id,_cc,'2026-04-29 07:00+00','2026-04-29 08:30+00',90,'paid',525,420,'THB',
   'BK900017','Nattaporn Srisuk','natta.s@gmail.com',_p_nattaporn,'Silver',_mt_silver,
   'PlayPal App','Paid','2026-04-28 11:00+00','2026-04-29 09:00+00'),
  -- Apr 30 Wed 09:00 | Court B | Wanlapa Gold 60min ฿200
  (_venue_id,_cb,'2026-04-30 02:00+00','2026-04-30 03:00+00',60,'paid',300,200,'THB',
   'BK900018','Wanlapa Chaiyo','wan.chai@hotmail.com',_p_wanlapa,'Gold',_mt_gold,
   'Manual','Paid','2026-04-29 10:00+00','2026-04-30 03:30+00'),
  -- CANCELLED Apr 17 12:00 | Court A | Pruek (no-show, different court/time from BK900009)
  (_venue_id,_ca,'2026-04-17 05:00+00','2026-04-17 06:00+00',60,'cancelled',300,300,'THB',
   'BK900019','Pruek Saengdao','pruek.s@gmail.com',_p_pruek,null,null,
   'PlayPal App',null,'2026-04-16 08:00+00','2026-04-17 01:00+00');

  -- ── Last 7 days (May 12–18) — all paid → drives weekly revenue ──
  insert into public.bookings (
    venue_id, court_id, slot_start, slot_end, duration_minutes,
    status, total_price, final_price, currency,
    booking_number, player_name, player_email, player_id,
    membership_type, membership_type_id,
    source, payment_status, created_at, updated_at
  ) values
  -- May 12 Mon 09:00 | Court A | Somchai Gold 60min ฿200
  (_venue_id,_ca,'2026-05-12 02:00+00','2026-05-12 03:00+00',60,'paid',300,200,'THB',
   'BK900020','Somchai Jaidee','somchai.j@gmail.com',_p_somchai,'Gold',_mt_gold,
   'PlayPal App','Paid','2026-05-11 15:00+00','2026-05-12 03:30+00'),
  -- May 13 Tue 14:00 | Court C | Nattaporn Silver 60min ฿280
  (_venue_id,_cc,'2026-05-13 07:00+00','2026-05-13 08:00+00',60,'paid',350,280,'THB',
   'BK900021','Nattaporn Srisuk','natta.s@gmail.com',_p_nattaporn,'Silver',_mt_silver,
   'PlayPal App','Paid','2026-05-12 12:00+00','2026-05-13 08:30+00'),
  -- May 14 Wed 09:00 | Court B | Malee 60min ฿300 (NEW member — first booking)
  (_venue_id,_cb,'2026-05-14 02:00+00','2026-05-14 03:00+00',60,'paid',300,300,'THB',
   'BK900022','Malee Thongpoon','malee.t@gmail.com',_p_malee,null,null,
   'Manual','Paid','2026-05-14 01:00+00','2026-05-14 03:30+00'),
  -- May 15 Thu 19:00 | Court C | Arthit Silver 60min ฿280
  (_venue_id,_cc,'2026-05-15 12:00+00','2026-05-15 13:00+00',60,'paid',350,280,'THB',
   'BK900023','Arthit Nakorn','arthit.n@gmail.com',_p_arthit,'Silver',_mt_silver,
   'API','Paid','2026-05-14 09:00+00','2026-05-15 13:30+00'),
  -- May 16 Sat 10:00 | Court D | Rossarin 90min ฿700 (NEW member — first booking)
  (_venue_id,_cd,'2026-05-16 03:00+00','2026-05-16 04:30+00',90,'paid',700,700,'THB',
   'BK900024','Rossarin Petcharat','ross.p@gmail.com',_p_rossarin,null,null,
   'Manual','Paid','2026-05-16 01:00+00','2026-05-16 05:00+00'),
  -- May 17 Sun 09:00 | Court A | Pruek 60min ฿350 (weekend rate)
  (_venue_id,_ca,'2026-05-17 02:00+00','2026-05-17 03:00+00',60,'paid',350,350,'THB',
   'BK900025','Pruek Saengdao','pruek.s@gmail.com',_p_pruek,null,null,
   'Manual','Paid','2026-05-16 14:00+00','2026-05-17 03:30+00'),
  -- May 18 Sun 09:00 | Court B | Siriporn 60min ฿350 (NEW member — first booking)
  (_venue_id,_cb,'2026-05-18 02:00+00','2026-05-18 03:00+00',60,'paid',350,350,'THB',
   'BK900026','Siriporn Boonma','siri.b@gmail.com',_p_siriporn,null,null,
   'PlayPal App','Paid','2026-05-18 01:00+00','2026-05-18 03:30+00'),
  -- May 18 Sun 14:00 | Court C | Tanawat 60min ฿400 (squash weekend, NEW member)
  (_venue_id,_cc,'2026-05-18 07:00+00','2026-05-18 08:00+00',60,'paid',400,400,'THB',
   'BK900027','Tanawat Pimol','tana.p@gmail.com',_p_tanawat,null,null,
   'PlayPal App','Paid','2026-05-18 01:30+00','2026-05-18 08:30+00');

  -- ── Today (May 19) & upcoming ─────────────────────────
  insert into public.bookings (
    venue_id, court_id, slot_start, slot_end, duration_minutes,
    status, total_price, final_price, currency,
    booking_number, player_name, player_email, player_id,
    membership_type, membership_type_id,
    source, payment_status, created_at, updated_at
  ) values
  -- TODAY May 19 09:00 | Court A | Somchai Gold 90min ฿300 — confirmed
  (_venue_id,_ca,'2026-05-19 02:00+00','2026-05-19 03:30+00',90,'confirmed',450,300,'THB',
   'BK900028','Somchai Jaidee','somchai.j@gmail.com',_p_somchai,'Gold',_mt_gold,
   'PlayPal App','Pending','2026-05-18 10:00+00','2026-05-18 10:00+00'),
  -- TODAY May 19 14:00 | Court B | Nattaporn Silver 60min ฿240 — confirmed
  (_venue_id,_cb,'2026-05-19 07:00+00','2026-05-19 08:00+00',60,'confirmed',300,240,'THB',
   'BK900029','Nattaporn Srisuk','natta.s@gmail.com',_p_nattaporn,'Silver',_mt_silver,
   'PlayPal App','Pending','2026-05-18 11:00+00','2026-05-18 11:00+00'),
  -- TODAY May 19 19:00 | Court C | Arthit Silver 60min ฿280 — pending
  (_venue_id,_cc,'2026-05-19 12:00+00','2026-05-19 13:00+00',60,'pending',350,280,'THB',
   'BK900030','Arthit Nakorn','arthit.n@gmail.com',_p_arthit,'Silver',_mt_silver,
   'API','Pending','2026-05-19 04:00+00','2026-05-19 04:00+00'),
  -- May 20 Tue 09:00 | Court A | Wanlapa Gold 60min ฿200 — confirmed
  (_venue_id,_ca,'2026-05-20 02:00+00','2026-05-20 03:00+00',60,'confirmed',300,200,'THB',
   'BK900031','Wanlapa Chaiyo','wan.chai@hotmail.com',_p_wanlapa,'Gold',_mt_gold,
   'Manual','Pending','2026-05-19 05:00+00','2026-05-19 05:00+00'),
  -- May 21 Wed 14:00 | Court B | Chaiwat 90min ฿450 — confirmed
  (_venue_id,_cb,'2026-05-21 07:00+00','2026-05-21 08:30+00',90,'confirmed',450,450,'THB',
   'BK900032','Chaiwat Sriwong','chai.w@gmail.com',_p_chaiwat,null,null,
   'Manual','Pending','2026-05-19 06:00+00','2026-05-19 06:00+00'),
  -- May 22 Thu 14:00 | Court C | Nattaporn Silver 60min ฿280 — pending
  -- (Thu 19:00 is Nattaporn's recurring slot — using 14:00 here to keep calendar clean)
  (_venue_id,_cc,'2026-05-22 07:00+00','2026-05-22 08:00+00',60,'pending',350,280,'THB',
   'BK900033','Nattaporn Srisuk','natta.s@gmail.com',_p_nattaporn,'Silver',_mt_silver,
   'PlayPal App','Pending','2026-05-19 07:00+00','2026-05-19 07:00+00'),
  -- May 24 Sat 14:00 | Court D | Pruek 90min ฿700 — confirmed
  -- (Sat 10:00 is Wanlapa's recurring slot — using 14:00 here to keep calendar clean)
  (_venue_id,_cd,'2026-05-24 07:00+00','2026-05-24 08:30+00',90,'confirmed',700,700,'THB',
   'BK900034','Pruek Saengdao','pruek.s@gmail.com',_p_pruek,null,null,
   'Manual','Pending','2026-05-19 08:00+00','2026-05-19 08:00+00'),
  -- May 25 Sun 09:00 | Court A | Malee 60min ฿350 (weekend) — pending
  (_venue_id,_ca,'2026-05-25 02:00+00','2026-05-25 03:00+00',60,'pending',350,350,'THB',
   'BK900035','Malee Thongpoon','malee.t@gmail.com',_p_malee,null,null,
   'PlayPal App','Pending','2026-05-19 09:00+00','2026-05-19 09:00+00');

  alter table public.bookings enable trigger handle_booking_membership;

  -- ── 10. Payments (all paid bookings) ──────────────────
  insert into public.payments
    (venue_id, booking_id, amount, currency, payment_method, status,
     transaction_id, transaction_date, created_at, updated_at)
  select
    b.venue_id,
    b.id,
    b.final_price,
    'THB',
    case (row_number() over (order by b.id) % 4)
      when 0 then 'Cash'
      when 1 then 'QR Code'
      when 2 then 'Bank Transfer'
      else   'Credit Card'
    end,
    'completed'::public.payment_status,
    'TXN-' || to_char(b.id, 'FM000000'),
    b.slot_end,
    b.slot_end,
    b.slot_end
  from public.bookings b
  where b.venue_id = _venue_id
    and b.status = 'paid';

  -- ── 11. Recurring bookings ────────────────────────────
  -- Somchai: Badminton Court A every Monday 07:00 (Gold — auto-confirms)
  -- Nattaporn: Squash Court 1 every Tue + Thu 19:00 (Silver)
  -- Wanlapa: Tennis Court every Saturday 10:00 (Gold — auto-confirms)
  insert into public.recurring_bookings
    (venue_id, court_id, day_of_week, time, duration,
     player_name, player_email, status, start_date)
  values
    (_venue_id, _ca, 1, '07:00:00', 60, 'Somchai Jaidee',   'somchai.j@gmail.com',  'active', '2026-03-02'),
    (_venue_id, _cc, 2, '19:00:00', 60, 'Nattaporn Srisuk', 'natta.s@gmail.com',    'active', '2026-04-01'),
    (_venue_id, _cc, 4, '19:00:00', 60, 'Nattaporn Srisuk', 'natta.s@gmail.com',    'active', '2026-04-03'),
    (_venue_id, _cd, 6, '10:00:00', 90, 'Wanlapa Chaiyo',   'wan.chai@hotmail.com', 'active', '2026-04-05');

  raise notice 'Demo data seeded for venue % → Playpal Court (35 bookings, 26 paid, 4 recurring)', _venue_id;

end $$;
