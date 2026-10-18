create table if not exists public.staff_invite_authorizations (
  email text primary key check (email = lower(btrim(email))),
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.staff_invite_authorizations enable row level security;
revoke all on table public.staff_invite_authorizations from public, anon, authenticated;
grant all on table public.staff_invite_authorizations to service_role;

create or replace function public.create_staff_application_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_nickname text := nullif(btrim(metadata ->> 'nickname'), '');
  invitation_authorized boolean := false;
begin
  if requested_nickname is null or length(requested_nickname) > 40 then
    raise exception 'A valid staff nickname is required';
  end if;

  delete from public.staff_invite_authorizations
  where email = lower(btrim(coalesce(new.email, '')))
    and expires_at > now()
  returning true into invitation_authorized;
  invitation_authorized := coalesce(invitation_authorized, false);

  if not invitation_authorized and (
    metadata ->> 'privacy_consent' is distinct from 'true'
    or metadata ->> 'privacy_notice_version' is distinct from 'staff-privacy-2026-10-v1'
  ) then
    raise exception 'Current staff privacy consent is required';
  end if;

  insert into public.admin_profiles (
    user_id,
    email,
    nickname,
    full_name,
    phone,
    approval_status,
    account_role,
    permissions,
    privacy_consent_at,
    privacy_notice_version,
    access_model_version
  ) values (
    new.id,
    new.email,
    requested_nickname,
    nullif(btrim(metadata ->> 'full_name'), ''),
    nullif(btrim(metadata ->> 'phone'), ''),
    'pending',
    'screener',
    array[]::text[],
    case when invitation_authorized then null else now() end,
    case when invitation_authorized then null else 'staff-privacy-2026-10-v1' end,
    1
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_staff_application_for_auth_user() from public, anon, authenticated;