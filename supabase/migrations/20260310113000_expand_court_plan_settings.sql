do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'court_plan'
      and e.enumlabel = 'free'
  ) then
    alter type public.court_plan rename value 'free' to 'starter';
  end if;
end
$$;

alter type public.court_plan add value if not exists 'starter';
alter type public.court_plan add value if not exists 'growth';

alter table public.court_portal_accounts
  add column if not exists monthly_fee_thb numeric(10,2) not null default 0,
  add column if not exists commission_percent numeric(5,2) not null default 0;

update public.court_portal_accounts
set
  monthly_fee_thb = case plan::text
    when 'starter' then 0
    when 'growth' then 600
    when 'pro' then 1200
    else monthly_fee_thb
  end,
  commission_percent = case plan::text
    when 'starter' then 10
    when 'growth' then 8
    when 'pro' then 5
    else commission_percent
  end
where monthly_fee_thb = 0
  and commission_percent = 0;
