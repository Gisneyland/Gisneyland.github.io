begin;

create table if not exists public.staff_calendar_feeds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.staff_calendar_feeds enable row level security;
revoke all on table public.staff_calendar_feeds from public, anon, authenticated;
grant all on table public.staff_calendar_feeds to service_role;

create or replace function public.has_staff_calendar_feed()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.admin_profiles
      where user_id = auth.uid() and account_role in ('administrator', 'screener')
        and approval_status = 'approved' and privacy_consent_at is not null
    )
    and exists (
      select 1 from public.staff_calendar_feeds
      where user_id = auth.uid() and revoked_at is null
    );
$$;
revoke all on function public.has_staff_calendar_feed() from public, anon;
grant execute on function public.has_staff_calendar_feed() to authenticated;

create or replace function public.create_staff_calendar_feed(p_token_hash text)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid calendar feed request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.admin_profiles
    where user_id = actor and account_role in ('administrator', 'screener')
      and approval_status = 'approved' and privacy_consent_at is not null
  ) then
    raise exception 'Approved staff consent required' using errcode = '42501';
  end if;

  insert into public.staff_calendar_feeds(user_id, token_hash, created_at, revoked_at)
  values (actor, p_token_hash, now(), null)
  on conflict (user_id) do update
    set token_hash = excluded.token_hash, created_at = now(), revoked_at = null;
end;
$$;
revoke all on function public.create_staff_calendar_feed(text) from public, anon;
grant execute on function public.create_staff_calendar_feed(text) to authenticated;

create or replace function public.revoke_staff_calendar_feed()
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.staff_calendar_feeds set revoked_at = now()
  where user_id = auth.uid() and revoked_at is null;
end;
$$;
revoke all on function public.revoke_staff_calendar_feed() from public, anon;
grant execute on function public.revoke_staff_calendar_feed() to authenticated;

commit;