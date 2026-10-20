-- Run only against a disposable PostgreSQL database with the project migrations installed.
-- The caller supplies fixture admin_profiles and auth.uid() backed by request.jwt.claim.sub.
-- UUIDs ending in 001 / 002 / 003 respectively:
-- approved administrator with privacy consent / approved screener / approved administrator without consent.
begin;
do $$
declare
  doc jsonb := '{"version":1,"patches":{},"orders":{},"blocks":[],"navigation":null}';
  nav jsonb := '{"version":1,"patches":{},"orders":{},"blocks":[],"navigation":{"main":[{"id":"home","label":"Home","url":"/"}],"more":[]}}';
  revisions jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  if not public.is_site_editor_administrator() then raise exception 'Approved administrator denied'; end if;
  if public.site_editor_valid_document(doc || '{"html":"<script>"}') then raise exception 'Raw HTML accepted'; end if;
  if public.site_editor_safe_url('javascript:alert(1)') or public.site_editor_safe_url('//example.org') then raise exception 'Unsafe URL accepted'; end if;
  if not public.site_editor_safe_url('/news/') then raise exception 'Safe URL rejected'; end if;
  revisions := public.save_site_editor_drafts('/', doc, nav, 0, 0);
  if revisions <> '{"page_revision":1,"navigation_revision":1}'::jsonb then raise exception 'Save failed'; end if;
  if exists(select 1 from public.site_editor_publications) then raise exception 'Draft leaked into publications'; end if;
  begin
    perform public.save_site_editor_drafts('/', doc, nav, 0, 0);
    raise exception 'Stale save accepted';
  exception when raise_exception then
    if sqlerrm = 'Stale save accepted' then raise; end if;
  end;
  begin
    perform public.publish_site_editor('/', 2, 1);
    raise exception 'Stale publish accepted';
  exception when raise_exception then
    if sqlerrm = 'Stale publish accepted' then raise; end if;
  end;
  perform public.publish_site_editor('/', 1, 1);
  if (select count(*) from public.site_editor_publications) <> 2 then raise exception 'Publish was not atomic'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
do $$ begin
  if (select count(*) from public.site_editor_drafts) <> 2 then raise exception 'Admin draft read denied'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$ begin
  if public.is_site_editor_administrator() then raise exception 'Screener granted administrator'; end if;
  if exists(select 1 from public.site_editor_drafts) then raise exception 'Screener can read drafts'; end if;
  begin
    perform public.publish_site_editor('/', 1, 1);
    raise exception 'Screener published';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.site_editor_publications;
    raise exception 'Direct write granted';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
do $$ begin
  if public.is_site_editor_administrator() then raise exception 'Unconsented admin granted access'; end if;
  if exists(select 1 from public.site_editor_drafts) then raise exception 'Unconsented admin read draft'; end if;
end $$;

set local role anon;
do $$ begin
  if (select count(*) from public.site_editor_publications) <> 2 then raise exception 'Anonymous publications denied'; end if;
  begin
    perform 1 from public.site_editor_drafts;
    raise exception 'Anonymous draft permission granted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.publish_site_editor('/', 1, 1);
    raise exception 'Anonymous RPC granted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
