begin;

-- Structured inline formatting only; no HTML, arbitrary CSS, or renderer options.
create or replace function public.site_editor_valid_runs(value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public
as $$
declare
  run jsonb;
  flag text;
  total integer := 0;
begin
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  if jsonb_array_length(value) > 500 then return false; end if;
  for run in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(run) is distinct from 'object'
      or run - array['text','bold','italic','underline','highlight','color','script','href'] <> '{}'::jsonb
      or jsonb_typeof(run->'text') is distinct from 'string' then return false; end if;
    total := total + length(run->>'text');
    if total > 12000 then return false; end if;
    foreach flag in array array['bold','italic','underline','highlight'] loop
      if run ? flag and jsonb_typeof(run->flag) is distinct from 'boolean' then return false; end if;
    end loop;
    if run ? 'color' and (jsonb_typeof(run->'color') is distinct from 'string'
      or run->>'color' !~ '^#[a-fA-F0-9]{6}$') then return false; end if;
    if run ? 'script' and (jsonb_typeof(run->'script') is distinct from 'string'
      or run->>'script' not in ('sub','super')) then return false; end if;
    if run ? 'href' and (jsonb_typeof(run->'href') is distinct from 'string'
      or not public.site_editor_safe_url(run->>'href')) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

-- Replace the existing function in place so CHECK constraints and checked RPCs
-- retain their dependencies. No table, role, policy or RPC grants are changed.
create or replace function public.site_editor_valid_document(value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public
as $$
declare
  entry record;
  item jsonb;
  group_name text;
  seen text[];
  row_text text;
  row_count integer;
begin
  if jsonb_typeof(value) is distinct from 'object'
    or value - array['version','patches','orders','blocks','navigation'] <> '{}'::jsonb
    or not (value ?& array['version','patches','orders','blocks','navigation'])
    or value->'version' <> '1'::jsonb
    or octet_length(value::text) > 600000
    or jsonb_typeof(value->'patches') is distinct from 'object'
    or jsonb_typeof(value->'orders') is distinct from 'object'
    or jsonb_typeof(value->'blocks') is distinct from 'array' then return false; end if;
  if (select count(*) from jsonb_object_keys(value->'patches')) > 2500
    or (select count(*) from jsonb_object_keys(value->'orders')) > 500
    or jsonb_array_length(value->'blocks') > 200 then return false; end if;
  for entry in select * from jsonb_each(value->'patches') loop
    if entry.key !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
      or entry.key in ('__proto__','constructor','prototype')
      or jsonb_typeof(entry.value) is distinct from 'object'
      or entry.value - array['text','href','deleted','rich','style'] <> '{}'::jsonb then return false; end if;
    if entry.value ? 'text' and (jsonb_typeof(entry.value->'text') is distinct from 'string'
      or length(entry.value->>'text') > 12000) then return false; end if;
    if entry.value ? 'href' and (jsonb_typeof(entry.value->'href') is distinct from 'string'
      or not public.site_editor_safe_url(entry.value->>'href')) then return false; end if;
    if entry.value ? 'deleted' and jsonb_typeof(entry.value->'deleted') is distinct from 'boolean' then return false; end if;
    if entry.value ? 'rich' and not public.site_editor_valid_runs(entry.value->'rich') then return false; end if;
    if entry.value ? 'style' and (jsonb_typeof(entry.value->'style') is distinct from 'string'
      or entry.value->>'style' not in ('p','h1','h2','h3','blockquote','ul','ol')) then return false; end if;
  end loop;
  for entry in select * from jsonb_each(value->'orders') loop
    if entry.key !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
      or entry.key in ('__proto__','constructor','prototype')
      or jsonb_typeof(entry.value) is distinct from 'array' or jsonb_array_length(entry.value) > 500 then return false; end if;
    seen := array[]::text[];
    for item in select * from jsonb_array_elements(entry.value) loop
      if jsonb_typeof(item) is distinct from 'string' or (item #>> '{}') !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
        or (item #>> '{}') = any(seen)
        or (item #>> '{}') in ('__proto__','constructor','prototype') then return false; end if;
      seen := array_append(seen, item #>> '{}');
    end loop;
  end loop;
  seen := array[]::text[];
  for item in select * from jsonb_array_elements(value->'blocks') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['id','parent','before','title','body','url','label','type','rich','style','language'] <> '{}'::jsonb
      or not (item ?& array['id','parent','title','body','url','label'])
      or jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
      or item->>'id' in ('__proto__','constructor','prototype') or item->>'id' = any(seen)
      or jsonb_typeof(item->'parent') is distinct from 'string' or item->>'parent' !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
      or item->>'parent' in ('__proto__','constructor','prototype')
      or jsonb_typeof(item->'title') is distinct from 'string' or length(item->>'title') > 300
      or jsonb_typeof(item->'body') is distinct from 'string' or length(item->>'body') > 12000
      or jsonb_typeof(item->'label') is distinct from 'string' or length(item->>'label') > 300
      or jsonb_typeof(item->'url') is distinct from 'string'
      or (item->>'url' <> '' and not public.site_editor_safe_url(item->>'url')) then return false; end if;
    if item ? 'before' and (jsonb_typeof(item->'before') is distinct from 'string'
      or (item->>'before' <> '' and item->>'before' !~ '^[a-zA-Z0-9_./:#-]{1,240}$')
      or item->>'before' in ('__proto__','constructor','prototype')) then return false; end if;
    if item ? 'type' and (jsonb_typeof(item->'type') is distinct from 'string'
      or item->>'type' not in ('paragraph','card','image','audio','video','table','code','math','music','mermaid','markdown')) then return false; end if;
    if item ? 'rich' and not public.site_editor_valid_runs(item->'rich') then return false; end if;
    if item ? 'style' and (jsonb_typeof(item->'style') is distinct from 'string'
      or item->>'style' not in ('p','h1','h2','h3','blockquote','ul','ol')) then return false; end if;
    if item ? 'language' and (jsonb_typeof(item->'language') is distinct from 'string'
      or length(item->>'language') > 40) then return false; end if;
    if item->>'type' in ('image','audio','video') and item->>'url' <> ''
      and item->>'url' !~* '^(/([^/]|$)|https?://)' then return false; end if;
    if item->>'type' = 'table' then
      row_count := 0;
      foreach row_text in array string_to_array(item->>'body', E'\n') loop
        row_count := row_count + 1;
        if row_count > 100 or cardinality(string_to_array(row_text, E'\t')) > 30 then return false; end if;
      end loop;
    end if;
    seen := array_append(seen, item->>'id');
  end loop;
  if value->'navigation' <> 'null'::jsonb then
    if jsonb_typeof(value->'navigation') is distinct from 'object'
      or (value->'navigation') - array['main','more'] <> '{}'::jsonb then return false; end if;
    seen := array[]::text[];
    foreach group_name in array array['main','more'] loop
      if jsonb_typeof(value->'navigation'->group_name) is distinct from 'array'
        or jsonb_array_length(value->'navigation'->group_name) > 30 then return false; end if;
      for item in select * from jsonb_array_elements(value->'navigation'->group_name) loop
        if jsonb_typeof(item) is distinct from 'object' or item - array['id','label','url'] <> '{}'::jsonb
          or not (item ?& array['id','label','url'])
          or jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' !~ '^[a-zA-Z0-9_./:#-]{1,240}$'
          or item->>'id' in ('__proto__','constructor','prototype') or item->>'id' = any(seen)
          or jsonb_typeof(item->'label') is distinct from 'string' or length(item->>'label') > 100
          or jsonb_typeof(item->'url') is distinct from 'string'
          or not public.site_editor_safe_url(item->>'url') then return false; end if;
        seen := array_append(seen, item->>'id');
      end loop;
    end loop;
  end if;
  return true;
exception when others then return false;
end;
$$;

revoke all on function public.site_editor_valid_runs(jsonb) from public, anon;
grant execute on function public.site_editor_valid_runs(jsonb) to authenticated;
commit;
