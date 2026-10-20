begin;

-- Separate physical tables: no anonymous SELECT policy can accidentally expose drafts.
create or replace function public.is_site_editor_administrator()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and account_role = 'administrator'
      and approval_status = 'approved' and privacy_consent_at is not null
  );
$$;
revoke all on function public.is_site_editor_administrator() from public, anon;
grant execute on function public.is_site_editor_administrator() to authenticated;

create or replace function public.site_editor_safe_url(value text)
returns boolean language sql immutable set search_path = pg_catalog
as $$
  select value is not null and length(value) between 1 and 2048
    and value !~ '[[:space:][:cntrl:]\\]'
    and (value ~ '^/([^/]|$)' or value ~ '^[#?]' or value ~* '^(https?://|mailto:|tel:)')
    and value !~* '^https?://[^/]*@';
$$;

create or replace function public.site_editor_valid_document(value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public
as $$
declare
  entry record;
  item jsonb;
  group_name text;
  seen text[];
begin
  if jsonb_typeof(value) <> 'object'
    or value - array['version','patches','orders','blocks','navigation'] <> '{}'::jsonb
    or not (value ?& array['version','patches','orders','blocks','navigation'])
    or value->'version' <> '1'::jsonb
    or octet_length(value::text) > 600000
    or jsonb_typeof(value->'patches') <> 'object'
    or jsonb_typeof(value->'orders') <> 'object'
    or jsonb_typeof(value->'blocks') <> 'array' then return false; end if;
  if (select count(*) from jsonb_object_keys(value->'patches')) > 2500
    or (select count(*) from jsonb_object_keys(value->'orders')) > 500
    or jsonb_array_length(value->'blocks') > 200 then return false; end if;
  for entry in select * from jsonb_each(value->'patches') loop
    if entry.key !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
      or entry.key in ('__proto__','constructor','prototype')
      or jsonb_typeof(entry.value) <> 'object'
      or entry.value - array['text','href','deleted'] <> '{}'::jsonb then return false; end if;
    if entry.value ? 'text' and (jsonb_typeof(entry.value->'text') <> 'string'
      or length(entry.value->>'text') > 12000) then return false; end if;
    if entry.value ? 'href' and (jsonb_typeof(entry.value->'href') <> 'string'
      or not public.site_editor_safe_url(entry.value->>'href')) then return false; end if;
    if entry.value ? 'deleted' and jsonb_typeof(entry.value->'deleted') <> 'boolean' then return false; end if;
  end loop;
  for entry in select * from jsonb_each(value->'orders') loop
    if entry.key !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
      or entry.key in ('__proto__','constructor','prototype')
      or jsonb_typeof(entry.value) <> 'array' or jsonb_array_length(entry.value) > 500 then return false; end if;
    seen := array[]::text[];
    for item in select * from jsonb_array_elements(entry.value) loop
      if jsonb_typeof(item) <> 'string' or (item #>> '{}') !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
        or (item #>> '{}') = any(seen)
        or (item #>> '{}') in ('__proto__','constructor','prototype') then return false; end if;
      seen := array_append(seen, item #>> '{}');
    end loop;
  end loop;
  seen := array[]::text[];
  for item in select * from jsonb_array_elements(value->'blocks') loop
    if jsonb_typeof(item) <> 'object'
      or item - array['id','parent','title','body','url','label'] <> '{}'::jsonb
      or not (item ?& array['id','parent','title','body','url','label'])
      or jsonb_typeof(item->'id') <> 'string' or item->>'id' !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
      or item->>'id' = any(seen)
      or jsonb_typeof(item->'parent') <> 'string' or item->>'parent' !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
      or jsonb_typeof(item->'title') <> 'string' or length(item->>'title') > 300
      or jsonb_typeof(item->'body') <> 'string' or length(item->>'body') > 12000
      or jsonb_typeof(item->'label') <> 'string' or length(item->>'label') > 300
      or jsonb_typeof(item->'url') <> 'string'
      or (item->>'url' <> '' and not public.site_editor_safe_url(item->>'url')) then return false; end if;
    seen := array_append(seen, item->>'id');
  end loop;
  if value->'navigation' <> 'null'::jsonb then
    if jsonb_typeof(value->'navigation') <> 'object'
      or (value->'navigation') - array['main','more'] <> '{}'::jsonb then return false; end if;
    seen := array[]::text[];
    foreach group_name in array array['main','more'] loop
      if jsonb_typeof(value->'navigation'->group_name) is distinct from 'array'
        or jsonb_array_length(value->'navigation'->group_name) > 30 then return false; end if;
      for item in select * from jsonb_array_elements(value->'navigation'->group_name) loop
        if jsonb_typeof(item) <> 'object' or item - array['id','label','url'] <> '{}'::jsonb
          or not (item ?& array['id','label','url'])
          or jsonb_typeof(item->'id') <> 'string' or item->>'id' !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
          or item->>'id' = any(seen)
          or jsonb_typeof(item->'label') <> 'string' or length(item->>'label') > 100
          or jsonb_typeof(item->'url') <> 'string'
          or not public.site_editor_safe_url(item->>'url') then return false; end if;
        seen := array_append(seen, item->>'id');
      end loop;
    end loop;
  end if;
  return true;
exception when others then return false;
end;
$$;

create table if not exists public.site_editor_drafts (
  page_key text primary key check (page_key = '@navigation' or (page_key ~ '^/[a-zA-Z0-9_/-]*$' and page_key !~ '^/admin(/|$)')),
  document jsonb not null check (public.site_editor_valid_document(document)),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.site_editor_publications (
  page_key text primary key,
  document jsonb not null check (public.site_editor_valid_document(document)),
  revision bigint not null check (revision > 0),
  published_at timestamptz not null default now()
);
alter table public.site_editor_drafts enable row level security;
alter table public.site_editor_publications enable row level security;
revoke all on public.site_editor_drafts from public, anon, authenticated;
revoke all on public.site_editor_publications from public, anon, authenticated;
grant select on public.site_editor_drafts to authenticated;
grant select on public.site_editor_publications to anon, authenticated;
drop policy if exists site_editor_private_read on public.site_editor_drafts;
create policy site_editor_private_read on public.site_editor_drafts for select to authenticated
  using (public.is_site_editor_administrator());
drop policy if exists site_editor_public_read on public.site_editor_publications;
create policy site_editor_public_read on public.site_editor_publications for select to anon, authenticated using (true);
-- All writes go through checked RPCs, never table grants or broad staff.manage permission.

create or replace function public.save_site_editor_drafts(
  target_page text, page_document jsonb, navigation_document jsonb,
  expected_page_revision bigint, expected_navigation_revision bigint
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  page_version bigint;
  navigation_version bigint;
begin
  if not public.is_site_editor_administrator() then raise exception 'Administrator approval and privacy consent required' using errcode = '42501'; end if;
  if target_page is null or target_page !~ '^/[a-zA-Z0-9_/-]*$' or target_page ~ '^/admin(/|$)'
    or not public.site_editor_valid_document(page_document)
    or not public.site_editor_valid_document(navigation_document)
    or page_document->'navigation' <> 'null'::jsonb
    or navigation_document->'navigation' = 'null'::jsonb
    or navigation_document->'patches' <> '{}'::jsonb
    or navigation_document->'orders' <> '{}'::jsonb
    or navigation_document->'blocks' <> '[]'::jsonb then raise exception 'Invalid structured site document'; end if;
  -- Serialize the global navigation/page pair, including first insert.
  perform pg_advisory_xact_lock(726140020);
  select revision into page_version from public.site_editor_drafts where page_key = target_page;
  select revision into navigation_version from public.site_editor_drafts where page_key = '@navigation';
  if expected_page_revision is distinct from coalesce(page_version, 0)
    or expected_navigation_revision is distinct from coalesce(navigation_version, 0) then
    raise exception 'Draft changed in another editor. Reload before saving (草稿已由其他管理員修改，請重新整理).';
  end if;
  page_version := coalesce(page_version, 0) + 1;
  navigation_version := coalesce(navigation_version, 0) + 1;
  insert into public.site_editor_drafts(page_key, document, revision) values (target_page, page_document, page_version)
    on conflict (page_key) do update set document = excluded.document, revision = excluded.revision, updated_at = now();
  insert into public.site_editor_drafts(page_key, document, revision) values ('@navigation', navigation_document, navigation_version)
    on conflict (page_key) do update set document = excluded.document, revision = excluded.revision, updated_at = now();
  return jsonb_build_object('page_revision', page_version, 'navigation_revision', navigation_version);
end;
$$;

create or replace function public.publish_site_editor(
  target_page text, expected_page_revision bigint, expected_navigation_revision bigint
) returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  page_row public.site_editor_drafts;
  nav_row public.site_editor_drafts;
begin
  if not public.is_site_editor_administrator() then raise exception 'Administrator approval and privacy consent required' using errcode = '42501'; end if;
  if target_page is null or target_page !~ '^/[a-zA-Z0-9_/-]*$' or target_page ~ '^/admin(/|$)' then raise exception 'Invalid page'; end if;
  perform pg_advisory_xact_lock(726140020);
  select * into page_row from public.site_editor_drafts where page_key = target_page;
  select * into nav_row from public.site_editor_drafts where page_key = '@navigation';
  if page_row.revision is null or nav_row.revision is null
    or expected_page_revision is distinct from page_row.revision
    or expected_navigation_revision is distinct from nav_row.revision then
    raise exception 'Save current drafts first; another editor may have changed them (請先儲存或重新整理草稿).';
  end if;
  insert into public.site_editor_publications(page_key, document, revision)
    values (target_page, page_row.document, page_row.revision), ('@navigation', nav_row.document, nav_row.revision)
    on conflict (page_key) do update set document = excluded.document, revision = excluded.revision, published_at = now();
end;
$$;

revoke all on function public.site_editor_safe_url(text) from public, anon;
revoke all on function public.site_editor_valid_document(jsonb) from public, anon;
grant execute on function public.site_editor_safe_url(text), public.site_editor_valid_document(jsonb) to authenticated;
revoke all on function public.save_site_editor_drafts(text,jsonb,jsonb,bigint,bigint) from public, anon;
revoke all on function public.publish_site_editor(text,bigint,bigint) from public, anon;
grant execute on function public.save_site_editor_drafts(text,jsonb,jsonb,bigint,bigint) to authenticated;
grant execute on function public.publish_site_editor(text,bigint,bigint) to authenticated;
commit;
