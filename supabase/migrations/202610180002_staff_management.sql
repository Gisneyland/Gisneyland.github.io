alter table public.admin_profiles
  add column if not exists email text,
  add column if not exists nickname text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists approval_status text not null default 'pending',
  add column if not exists account_role text not null default 'screener',
  add column if not exists permissions text[] not null default array[]::text[],
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_notice_version text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.admin_profiles
  drop constraint if exists admin_profiles_screener_number_required;

do $$
begin
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.admin_profiles'::regclass
      and attname = 'access_model_version'
      and not attisdropped
  ) then
    alter table public.admin_profiles add column access_model_version smallint;
    update public.admin_profiles
    set approval_status = 'approved',
        account_role = 'administrator',
        permissions = array[
          'questionnaire.read',
          'questionnaire.consultation',
          'site_content.manage',
          'staff.manage'
        ]::text[],
        access_model_version = 1;
    alter table public.admin_profiles
      alter column access_model_version set default 1,
      alter column access_model_version set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_profiles'::regclass
      and conname = 'admin_profiles_approval_status_check'
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected', 'suspended'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_profiles'::regclass
      and conname = 'admin_profiles_account_role_check'
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_account_role_check
      check (account_role in ('screener', 'administrator'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_profiles'::regclass
      and conname = 'admin_profiles_nickname_nonempty'
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_nickname_nonempty
      check (nickname is null or (length(btrim(nickname)) between 1 and 40));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_profiles'::regclass
      and conname = 'admin_profiles_optional_profile_lengths'
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_optional_profile_lengths
      check (
        (full_name is null or length(full_name) <= 80)
        and (phone is null or length(phone) <= 30)
      );
  end if;
end $$;

update public.admin_profiles as profiles
set email = users.email,
    nickname = coalesce(
      nullif(btrim(profiles.nickname), ''),
      left(coalesce(
        nullif(btrim(users.raw_user_meta_data ->> 'nickname'), ''),
        nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
        '工作人員'
      ), 40)
    )
from auth.users as users
where users.id = profiles.user_id;

insert into public.admin_profiles (
  user_id,
  email,
  nickname,
  approval_status,
  account_role,
  permissions,
  access_model_version
)
select
  users.id,
  users.email,
  coalesce(
    left(nullif(btrim(users.raw_user_meta_data ->> 'nickname'), ''), 40),
    left(nullif(split_part(coalesce(users.email, ''), '@', 1), ''), 40),
    '新申請者'
  ),
  'pending',
  'screener',
  array[]::text[],
  1
from auth.users as users
left join public.admin_profiles as profiles on profiles.user_id = users.id
where profiles.user_id is null
on conflict (user_id) do nothing;

create or replace function public.has_admin_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_profiles as profile
    where profile.user_id = auth.uid()
      and profile.approval_status = 'approved'
      and profile.privacy_consent_at is not null
      and (
        profile.account_role = 'administrator'
        or required_permission = any(coalesce(profile.permissions, array[]::text[]))
      )
  );
$$;

revoke all on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated;

create or replace function public.accept_staff_privacy_notice(notice_version text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if notice_version is distinct from 'staff-privacy-2026-10-v1' then
    raise exception 'Privacy notice version is not current';
  end if;

  update public.admin_profiles
  set privacy_consent_at = now(),
      privacy_notice_version = notice_version,
      updated_at = now()
  where user_id = auth.uid();

  if not found then
    raise exception 'Account application not found';
  end if;
end;
$$;

revoke all on function public.accept_staff_privacy_notice(text) from public, anon;
grant execute on function public.accept_staff_privacy_notice(text) to authenticated;

create or replace function public.create_staff_application_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_nickname text := nullif(btrim(metadata ->> 'nickname'), '');
begin
  if requested_nickname is null or length(requested_nickname) > 40 then
    raise exception 'A valid staff nickname is required';
  end if;
  if metadata ->> 'privacy_consent' is distinct from 'true'
    or metadata ->> 'privacy_notice_version' is distinct from 'staff-privacy-2026-10-v1' then
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
    now(),
    'staff-privacy-2026-10-v1',
    1
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_staff_application_after_auth_signup on auth.users;
create trigger create_staff_application_after_auth_signup
after insert on auth.users
for each row execute function public.create_staff_application_for_auth_user();

revoke all on function public.create_staff_application_for_auth_user() from public, anon, authenticated;

create or replace function public.sync_staff_profile_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.admin_profiles
  set email = new.email,
      updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_staff_profile_email_after_auth_email_update on auth.users;
create trigger sync_staff_profile_email_after_auth_email_update
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_staff_profile_email();

revoke all on function public.sync_staff_profile_email() from public, anon, authenticated;

create or replace function public.admin_update_staff_profile(
  target_user_id uuid,
  target_status text,
  target_role text,
  target_permissions text[],
  target_screener_number text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_profile public.admin_profiles%rowtype;
  keeps_staff_access boolean;
begin
  if auth.uid() is null or not public.has_admin_permission('staff.manage') then
    raise exception 'Staff management permission required';
  end if;
  if target_status is null or target_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'Invalid application status';
  end if;
  if target_role is null or target_role not in ('screener', 'administrator') then
    raise exception 'Invalid account role';
  end if;
  if exists (
    select 1
    from unnest(coalesce(target_permissions, array[]::text[])) as supplied(permission)
    where supplied.permission is null or supplied.permission not in (
      'questionnaire.read',
      'questionnaire.consultation',
      'site_content.manage',
      'staff.manage'
    )
  ) then
    raise exception 'Invalid permission';
  end if;

  select * into current_profile
  from public.admin_profiles
  where user_id = target_user_id
  for update;
  if not found then
    raise exception 'Account application not found';
  end if;
  if target_status = 'approved' and current_profile.privacy_consent_at is null then
    raise exception 'Current privacy consent is required before approval';
  end if;

  keeps_staff_access := target_status = 'approved'
    and (target_role = 'administrator' or 'staff.manage' = any(coalesce(target_permissions, array[]::text[])));

  if target_user_id = auth.uid() and not keeps_staff_access then
    raise exception 'You cannot remove your own staff management access';
  end if;
  if current_profile.approval_status = 'approved'
    and (current_profile.account_role = 'administrator' or 'staff.manage' = any(current_profile.permissions))
    and not keeps_staff_access
    and not exists (
      select 1
      from public.admin_profiles as other_profile
      where other_profile.user_id <> target_user_id
        and other_profile.approval_status = 'approved'
        and other_profile.privacy_consent_at is not null
        and (
          other_profile.account_role = 'administrator'
          or 'staff.manage' = any(coalesce(other_profile.permissions, array[]::text[]))
        )
    ) then
    raise exception 'At least one active staff manager must remain';
  end if;

  update public.admin_profiles
  set approval_status = target_status,
      account_role = target_role,
      permissions = coalesce(target_permissions, array[]::text[]),
      screener_number = nullif(btrim(target_screener_number), ''),
      reviewed_at = case when current_profile.approval_status <> target_status then now() else reviewed_at end,
      reviewed_by = case when current_profile.approval_status <> target_status then auth.uid() else reviewed_by end,
      updated_at = now()
  where user_id = target_user_id;
end;
$$;

revoke all on function public.admin_update_staff_profile(uuid, text, text, text[], text) from public, anon;
grant execute on function public.admin_update_staff_profile(uuid, text, text, text[], text) to authenticated;

alter table public.admin_profiles enable row level security;
revoke all on table public.admin_profiles from anon, authenticated;
grant select on table public.admin_profiles to authenticated;
grant update (screener_number, nickname, full_name, phone) on table public.admin_profiles to authenticated;

drop policy if exists "Admins can view their own profile" on public.admin_profiles;
drop policy if exists "Admins can update their own screener number" on public.admin_profiles;
drop policy if exists "Staff can view own profile and managers can view staff" on public.admin_profiles;
drop policy if exists "Staff can update their own profile" on public.admin_profiles;

create policy "Staff can view own profile and managers can view staff"
on public.admin_profiles
for select
to authenticated
using (user_id = (select auth.uid()) or public.has_admin_permission('staff.manage'));

create policy "Staff can update their own profile"
on public.admin_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Admins can view questionnaire responses" on public.questionnaire_responses;
drop policy if exists "Admins can update questionnaire consultation codes" on public.questionnaire_responses;

create policy "Authorized staff can view questionnaire responses"
on public.questionnaire_responses
for select
to authenticated
using (public.has_admin_permission('questionnaire.read'));

create policy "Authorized staff can update questionnaire consultation codes"
on public.questionnaire_responses
for update
to authenticated
using (
  public.has_admin_permission('questionnaire.read')
  and public.has_admin_permission('questionnaire.consultation')
)
with check (
  public.has_admin_permission('questionnaire.read')
  and public.has_admin_permission('questionnaire.consultation')
);

drop policy if exists "Admins can view all site content" on public.site_content;
drop policy if exists "Admins can insert site content" on public.site_content;
drop policy if exists "Admins can update site content" on public.site_content;
drop policy if exists "Admins can delete site content" on public.site_content;

create policy "Authorized staff can view all site content"
on public.site_content
for select
to authenticated
using (public.has_admin_permission('site_content.manage'));

create policy "Authorized staff can insert site content"
on public.site_content
for insert
to authenticated
with check (public.has_admin_permission('site_content.manage'));

create policy "Authorized staff can update site content"
on public.site_content
for update
to authenticated
using (public.has_admin_permission('site_content.manage'))
with check (public.has_admin_permission('site_content.manage'));

create policy "Authorized staff can delete site content"
on public.site_content
for delete
to authenticated
using (public.has_admin_permission('site_content.manage'));

drop policy if exists "Admins can manage opening schedule" on public.site_opening_schedule;
drop policy if exists "Admins can manage opening exceptions" on public.site_opening_exceptions;

create policy "Authorized staff can manage opening schedule"
on public.site_opening_schedule
for all
to authenticated
using (public.has_admin_permission('site_content.manage'))
with check (public.has_admin_permission('site_content.manage'));

create policy "Authorized staff can manage opening exceptions"
on public.site_opening_exceptions
for all
to authenticated
using (public.has_admin_permission('site_content.manage'))
with check (public.has_admin_permission('site_content.manage'));

drop policy if exists "Admins can view screening test photos" on storage.objects;
create policy "Authorized staff can view screening test photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'screening-test-photos'
  and public.has_admin_permission('questionnaire.read')
);