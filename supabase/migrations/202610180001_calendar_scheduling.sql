alter table public.site_content
  add column if not exists is_all_day boolean not null default true,
  add column if not exists event_start_at timestamptz,
  add column if not exists event_end_at timestamptz,
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision;

alter table public.site_content drop constraint if exists site_content_timed_range_check;
alter table public.site_content add constraint site_content_timed_range_check check (
  (is_all_day and event_start_at is null and event_end_at is null)
  or (content_type = 'event' and not is_all_day
    and event_start_at is not null and event_end_at is not null and event_end_at > event_start_at
    and event_start = (event_start_at at time zone 'Asia/Taipei')::date
    and event_end is not null and event_end = (event_end_at at time zone 'Asia/Taipei')::date)
);

alter table public.site_content drop constraint if exists site_content_location_coordinates_check;
alter table public.site_content add constraint site_content_location_coordinates_check check (
  (location_latitude is null and location_longitude is null)
  or (location_latitude is not null and location_longitude is not null
    and location_latitude between -90 and 90 and location_longitude between -180 and 180)
);

create table if not exists public.site_opening_schedule (
  weekday smallint primary key check (weekday between 0 and 6),
  is_closed boolean not null default false,
  opens_at time not null default '14:00',
  closes_at time not null default '22:00',
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at)
);

insert into public.site_opening_schedule (weekday, is_closed)
select weekday, weekday < 2 from generate_series(0, 6) as weekday
on conflict (weekday) do nothing;

create table if not exists public.site_opening_exceptions (
  date date primary key,
  is_closed boolean not null default false,
  opens_at time not null default '14:00',
  closes_at time not null default '22:00',
  note text not null default '' check (length(note) <= 300),
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at)
);

alter table public.site_opening_schedule enable row level security;
alter table public.site_opening_exceptions enable row level security;
revoke all on public.site_opening_schedule, public.site_opening_exceptions from anon, authenticated;
grant select on public.site_opening_schedule, public.site_opening_exceptions to anon, authenticated;
grant insert, update, delete on public.site_opening_schedule, public.site_opening_exceptions to authenticated;

drop policy if exists "Anyone can read opening schedule" on public.site_opening_schedule;
create policy "Anyone can read opening schedule" on public.site_opening_schedule for select to anon, authenticated using (true);
drop policy if exists "Anyone can read opening exceptions" on public.site_opening_exceptions;
create policy "Anyone can read opening exceptions" on public.site_opening_exceptions for select to anon, authenticated using (true);
drop policy if exists "Admins can manage opening schedule" on public.site_opening_schedule;
create policy "Admins can manage opening schedule" on public.site_opening_schedule for all to authenticated
using (exists (select 1 from public.admin_profiles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_profiles where user_id = (select auth.uid())));
drop policy if exists "Admins can manage opening exceptions" on public.site_opening_exceptions;
create policy "Admins can manage opening exceptions" on public.site_opening_exceptions for all to authenticated
using (exists (select 1 from public.admin_profiles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_profiles where user_id = (select auth.uid())));