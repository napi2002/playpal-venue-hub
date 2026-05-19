-- Seed 30 mock bookings for demo/development purposes.
-- Targets the first venue found and distributes across its courts.
do $$
declare
  _venue_id integer;
  _courts   integer[];
  _nc       integer;
begin
  select id into _venue_id from public.venues order by id limit 1;
  if _venue_id is null then
    raise notice 'No venue found — skipping mock booking seed.';
    return;
  end if;

  select array_agg(id order by id) into _courts
  from public.courts where venue_id = _venue_id;

  if _courts is null then
    raise notice 'No courts found for venue % — skipping.', _venue_id;
    return;
  end if;

  _nc := array_length(_courts, 1);

  insert into public.bookings (
    venue_id, court_id, slot_start, slot_end, duration_minutes,
    status, total_price, currency, booking_number,
    player_name, player_email, source, payment_status, date, time
  ) values
    -- 1  Apr 4 09:00 BKK (02:00 UTC) – 60 min
    (_venue_id, _courts[1 + (0  % _nc)], '2026-04-04 02:00:00+00', '2026-04-04 03:00:00+00', 60,
     'paid',      600,  'THB', 'BK846201', 'Somchai Jaidee',    'somchai.j@gmail.com',    'PlayPal App', 'Paid',    '2026-04-04', '09:00'),
    -- 2  Apr 7 14:00 BKK – 90 min
    (_venue_id, _courts[1 + (1  % _nc)], '2026-04-07 07:00:00+00', '2026-04-07 08:30:00+00', 90,
     'paid',      900,  'THB', 'BK846202', 'Nattaporn Srisuk',  'natta.s@gmail.com',      'PlayPal App', 'Paid',    '2026-04-07', '14:00'),
    -- 3  Apr 9 08:00 BKK – 60 min
    (_venue_id, _courts[1 + (2  % _nc)], '2026-04-09 01:00:00+00', '2026-04-09 02:00:00+00', 60,
     'paid',      600,  'THB', 'BK846203', 'Wanlapa Chaiyo',    'wan.chai@hotmail.com',   'Manual',      'Paid',    '2026-04-09', '08:00'),
    -- 4  Apr 12 10:00 BKK – 120 min – cancelled
    (_venue_id, _courts[1 + (3  % _nc)], '2026-04-12 03:00:00+00', '2026-04-12 05:00:00+00', 120,
     'cancelled', 1200, 'THB', 'BK846204', 'Pruek Saengdao',    'pruek.s@gmail.com',      'PlayPal App', 'Refunded','2026-04-12', '10:00'),
    -- 5  Apr 14 16:00 BKK – 60 min
    (_venue_id, _courts[1 + (4  % _nc)], '2026-04-14 09:00:00+00', '2026-04-14 10:00:00+00', 60,
     'paid',      600,  'THB', 'BK846205', 'Malee Thongpoon',   'malee.t@gmail.com',      'Manual',      'Paid',    '2026-04-14', '16:00'),
    -- 6  Apr 16 11:00 BKK – 90 min
    (_venue_id, _courts[1 + (5  % _nc)], '2026-04-16 04:00:00+00', '2026-04-16 05:30:00+00', 90,
     'paid',      900,  'THB', 'BK846206', 'Arthit Nakorn',     'arthit.n@gmail.com',     'API',         'Paid',    '2026-04-16', '11:00'),
    -- 7  Apr 18 09:00 BKK – 60 min
    (_venue_id, _courts[1 + (6  % _nc)], '2026-04-18 02:00:00+00', '2026-04-18 03:00:00+00', 60,
     'paid',      600,  'THB', 'BK846207', 'Siriporn Boonma',   'siri.b@gmail.com',       'PlayPal App', 'Paid',    '2026-04-18', '09:00'),
    -- 8  Apr 21 15:00 BKK – 60 min – cancelled
    (_venue_id, _courts[1 + (7  % _nc)], '2026-04-21 08:00:00+00', '2026-04-21 09:00:00+00', 60,
     'cancelled', 600,  'THB', 'BK846208', 'Chaiwat Sriwong',   'chai.w@gmail.com',       'Manual',      'Refunded','2026-04-21', '15:00'),
    -- 9  Apr 23 17:00 BKK – 90 min
    (_venue_id, _courts[1 + (8  % _nc)], '2026-04-23 10:00:00+00', '2026-04-23 11:30:00+00', 90,
     'paid',      900,  'THB', 'BK846209', 'Rossarin Petcharat','ross.p@gmail.com',       'PlayPal App', 'Paid',    '2026-04-23', '17:00'),
    -- 10 Apr 25 08:00 BKK – 60 min
    (_venue_id, _courts[1 + (9  % _nc)], '2026-04-25 01:00:00+00', '2026-04-25 02:00:00+00', 60,
     'paid',      600,  'THB', 'BK846210', 'Tanawat Pimol',     'tana.p@gmail.com',       'API',         'Paid',    '2026-04-25', '08:00'),
    -- 11 Apr 27 10:00 BKK – 120 min
    (_venue_id, _courts[1 + (10 % _nc)], '2026-04-27 03:00:00+00', '2026-04-27 05:00:00+00', 120,
     'paid',      1200, 'THB', 'BK846211', 'Somchai Jaidee',    'somchai.j@gmail.com',    'Manual',      'Paid',    '2026-04-27', '10:00'),
    -- 12 Apr 29 13:00 BKK – 60 min
    (_venue_id, _courts[1 + (11 % _nc)], '2026-04-29 06:00:00+00', '2026-04-29 07:00:00+00', 60,
     'paid',      600,  'THB', 'BK846212', 'Nattaporn Srisuk',  'natta.s@gmail.com',      'PlayPal App', 'Paid',    '2026-04-29', '13:00'),
    -- 13 May 1 09:00 BKK – 90 min
    (_venue_id, _courts[1 + (12 % _nc)], '2026-05-01 02:00:00+00', '2026-05-01 03:30:00+00', 90,
     'paid',      900,  'THB', 'BK846213', 'Wanlapa Chaiyo',    'wan.chai@hotmail.com',   'Manual',      'Paid',    '2026-05-01', '09:00'),
    -- 14 May 3 16:00 BKK – 60 min – cancelled
    (_venue_id, _courts[1 + (13 % _nc)], '2026-05-03 09:00:00+00', '2026-05-03 10:00:00+00', 60,
     'cancelled', 600,  'THB', 'BK846214', 'Pruek Saengdao',    'pruek.s@gmail.com',      'PlayPal App', 'Refunded','2026-05-03', '16:00'),
    -- 15 May 5 11:00 BKK – 60 min
    (_venue_id, _courts[1 + (14 % _nc)], '2026-05-05 04:00:00+00', '2026-05-05 05:00:00+00', 60,
     'paid',      600,  'THB', 'BK846215', 'Malee Thongpoon',   'malee.t@gmail.com',      'API',         'Paid',    '2026-05-05', '11:00'),
    -- 16 May 7 14:00 BKK – 90 min
    (_venue_id, _courts[1 + (15 % _nc)], '2026-05-07 07:00:00+00', '2026-05-07 08:30:00+00', 90,
     'paid',      900,  'THB', 'BK846216', 'Arthit Nakorn',     'arthit.n@gmail.com',     'Manual',      'Paid',    '2026-05-07', '14:00'),
    -- 17 May 9 09:00 BKK – 60 min
    (_venue_id, _courts[1 + (16 % _nc)], '2026-05-09 02:00:00+00', '2026-05-09 03:00:00+00', 60,
     'paid',      600,  'THB', 'BK846217', 'Siriporn Boonma',   'siri.b@gmail.com',       'PlayPal App', 'Paid',    '2026-05-09', '09:00'),
    -- 18 May 11 18:00 BKK – 120 min
    (_venue_id, _courts[1 + (17 % _nc)], '2026-05-11 11:00:00+00', '2026-05-11 13:00:00+00', 120,
     'paid',      1200, 'THB', 'BK846218', 'Chaiwat Sriwong',   'chai.w@gmail.com',       'Manual',      'Paid',    '2026-05-11', '18:00'),
    -- 19 May 13 08:00 BKK – 60 min – cancelled
    (_venue_id, _courts[1 + (18 % _nc)], '2026-05-13 01:00:00+00', '2026-05-13 02:00:00+00', 60,
     'cancelled', 600,  'THB', 'BK846219', 'Rossarin Petcharat','ross.p@gmail.com',       'PlayPal App', null,      '2026-05-13', '08:00'),
    -- 20 May 15 10:00 BKK – 90 min
    (_venue_id, _courts[1 + (19 % _nc)], '2026-05-15 03:00:00+00', '2026-05-15 04:30:00+00', 90,
     'paid',      900,  'THB', 'BK846220', 'Tanawat Pimol',     'tana.p@gmail.com',       'API',         'Paid',    '2026-05-15', '10:00'),
    -- 21 May 17 09:00 BKK – 60 min
    (_venue_id, _courts[1 + (20 % _nc)], '2026-05-17 02:00:00+00', '2026-05-17 03:00:00+00', 60,
     'paid',      600,  'THB', 'BK846221', 'Somchai Jaidee',    'somchai.j@gmail.com',    'Manual',      'Paid',    '2026-05-17', '09:00'),
    -- 22 May 18 14:00 BKK – 60 min
    (_venue_id, _courts[1 + (21 % _nc)], '2026-05-18 07:00:00+00', '2026-05-18 08:00:00+00', 60,
     'paid',      600,  'THB', 'BK846222', 'Nattaporn Srisuk',  'natta.s@gmail.com',      'PlayPal App', 'Paid',    '2026-05-18', '14:00'),
    -- 23 May 19 09:00 BKK – 90 min – today (confirmed)
    (_venue_id, _courts[1 + (22 % _nc)], '2026-05-19 02:00:00+00', '2026-05-19 03:30:00+00', 90,
     'confirmed', 900,  'THB', 'BK846223', 'Wanlapa Chaiyo',    'wan.chai@hotmail.com',   'Manual',      'Pending', '2026-05-19', '09:00'),
    -- 24 May 19 15:00 BKK – 60 min – today (confirmed)
    (_venue_id, _courts[1 + (23 % _nc)], '2026-05-19 08:00:00+00', '2026-05-19 09:00:00+00', 60,
     'confirmed', 600,  'THB', 'BK846224', 'Pruek Saengdao',    'pruek.s@gmail.com',      'PlayPal App', 'Pending', '2026-05-19', '15:00'),
    -- 25 May 20 10:00 BKK – 60 min – pending
    (_venue_id, _courts[1 + (24 % _nc)], '2026-05-20 03:00:00+00', '2026-05-20 04:00:00+00', 60,
     'pending',   600,  'THB', 'BK846225', 'Malee Thongpoon',   'malee.t@gmail.com',      'PlayPal App', 'Pending', '2026-05-20', '10:00'),
    -- 26 May 21 09:00 BKK – 90 min – confirmed
    (_venue_id, _courts[1 + (25 % _nc)], '2026-05-21 02:00:00+00', '2026-05-21 03:30:00+00', 90,
     'confirmed', 900,  'THB', 'BK846226', 'Arthit Nakorn',     'arthit.n@gmail.com',     'API',         'Pending', '2026-05-21', '09:00'),
    -- 27 May 23 14:00 BKK – 60 min – pending
    (_venue_id, _courts[1 + (26 % _nc)], '2026-05-23 07:00:00+00', '2026-05-23 08:00:00+00', 60,
     'pending',   600,  'THB', 'BK846227', 'Siriporn Boonma',   'siri.b@gmail.com',       'Manual',      'Pending', '2026-05-23', '14:00'),
    -- 28 May 24 11:00 BKK – 120 min – confirmed
    (_venue_id, _courts[1 + (27 % _nc)], '2026-05-24 04:00:00+00', '2026-05-24 06:00:00+00', 120,
     'confirmed', 1200, 'THB', 'BK846228', 'Chaiwat Sriwong',   'chai.w@gmail.com',       'PlayPal App', 'Pending', '2026-05-24', '11:00'),
    -- 29 May 26 16:00 BKK – 60 min – pending
    (_venue_id, _courts[1 + (28 % _nc)], '2026-05-26 09:00:00+00', '2026-05-26 10:00:00+00', 60,
     'pending',   600,  'THB', 'BK846229', 'Rossarin Petcharat','ross.p@gmail.com',       'Manual',      'Pending', '2026-05-26', '16:00'),
    -- 30 May 28 09:00 BKK – 90 min – pending
    (_venue_id, _courts[1 + (29 % _nc)], '2026-05-28 02:00:00+00', '2026-05-28 03:30:00+00', 90,
     'pending',   900,  'THB', 'BK846230', 'Tanawat Pimol',     'tana.p@gmail.com',       'PlayPal App', 'Pending', '2026-05-28', '09:00')
  on conflict (booking_number) do nothing;

  raise notice 'Seeded 30 mock bookings for venue %.', _venue_id;
end $$;
