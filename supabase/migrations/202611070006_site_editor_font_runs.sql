begin;

-- Allow font size, font family and strikethrough in structured inline formatting (fixed vocabularies only).
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
      or run - array['text','bold','italic','underline','strike','highlight','color','script','href','size','family'] <> '{}'::jsonb
      or jsonb_typeof(run->'text') is distinct from 'string' then return false; end if;
    total := total + length(run->>'text');
    if total > 12000 then return false; end if;
    foreach flag in array array['bold','italic','underline','strike','highlight'] loop
      if run ? flag and jsonb_typeof(run->flag) is distinct from 'boolean' then return false; end if;
    end loop;
    if run ? 'color' and (jsonb_typeof(run->'color') is distinct from 'string'
      or run->>'color' !~ '^#[a-fA-F0-9]{6}$') then return false; end if;
    if run ? 'size' and (jsonb_typeof(run->'size') is distinct from 'string'
      or run->>'size' not in ('small','large','xlarge','xxlarge')) then return false; end if;
    if run ? 'family' and (jsonb_typeof(run->'family') is distinct from 'string'
      or run->>'family' not in ('sans','serif','kai','mono')) then return false; end if;
    if run ? 'script' and (jsonb_typeof(run->'script') is distinct from 'string'
      or run->>'script' not in ('sub','super')) then return false; end if;
    if run ? 'href' and (jsonb_typeof(run->'href') is distinct from 'string'
      or not public.site_editor_safe_url(run->>'href')) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

commit;
