-- Run after the site editor and component migrations in a disposable database.
begin;
do $$
declare
  doc jsonb := '{"version":1,"patches":{},"orders":{},"blocks":[],"navigation":null}';
  block jsonb := '{"id":"new","parent":"main","title":"","body":"","url":"/logo.png","label":"Visual"}';
  kind text;
  bad jsonb;
begin
  foreach kind in array array['button','icon','logo'] loop
    if not public.site_editor_valid_document(jsonb_set(doc, '{blocks}', jsonb_build_array(
      block || jsonb_build_object('type',kind,'icon','arrow_forward','variant','outline','alt','Safe logo')))) then
      raise exception 'Component block rejected: %', kind;
    end if;
  end loop;
  if not public.site_editor_valid_document(jsonb_set(doc, '{patches}',
    '{"visual":{"src":"https://example.org/logo.png","alt":"Logo","icon":"favorite","href":"/go","variant":"secondary"}}')) then
    raise exception 'Safe visual patch rejected';
  end if;
  if not public.site_editor_valid_document(jsonb_set(doc, '{navigation}',
    '{"main":[{"id":"home","label":"Home","url":"/","icon":"home","src":"/logo.png","alt":"Logo"}],"more":[]}'))
    or not public.site_editor_valid_document(jsonb_set(doc, '{navigation}',
    '{"main":[{"id":"home","label":"Home","url":"/","icon":"","src":"","alt":""}],"more":[]}')) then
    raise exception 'Safe navigation visuals rejected';
  end if;
  for bad in select * from jsonb_array_elements(
    '[{"icon":null},{"icon":"<svg>"},{"icon":"home star"},{"src":null},{"src":"javascript:alert(1)"},
      {"src":"//evil.example/logo"},{"src":"mailto:a@b.test"},{"alt":null},{"html":"<svg>"}]'::jsonb) loop
    if public.site_editor_valid_document(jsonb_set(doc, '{navigation}',
      jsonb_build_object('main',jsonb_build_array('{"id":"home","label":"Home","url":"/"}'::jsonb || bad),'more','[]'::jsonb))) then
      raise exception 'Unsafe navigation visual accepted: %', bad;
    end if;
  end loop;
  for bad in select * from jsonb_array_elements(
    '[{"icon":null},{"icon":""},{"icon":"<svg>"},{"icon":"home star"},{"variant":null},{"variant":"display:none"},
      {"alt":null},{"src":"javascript:alert(1)"},{"src":"//evil.example/image"},{"src":"mailto:a@b.test"},{"src":""},
      {"src":null},{"src":"data:image/svg+xml,x"},{"html":"<svg>"}]'::jsonb) loop
    if public.site_editor_valid_document(jsonb_set(doc, '{patches}', jsonb_build_object('visual',bad))) then
      raise exception 'Unsafe visual patch accepted: %', bad;
    end if;
    if not bad ? 'src' and public.site_editor_valid_document(jsonb_set(doc, '{blocks}', jsonb_build_array(block || bad))) then
      raise exception 'Unsafe visual block accepted: %', bad;
    end if;
  end loop;
  if public.site_editor_valid_document(jsonb_set(doc,'{patches}',jsonb_build_object('v',jsonb_build_object('alt',repeat('a',301)))))
    or public.site_editor_valid_document(jsonb_set(doc,'{patches}',jsonb_build_object('v',jsonb_build_object('icon',repeat('a',65)))))
    or public.site_editor_valid_document(jsonb_set(doc,'{blocks}',jsonb_build_array(block || '{"type":"logo","url":"mailto:a@b.test"}'::jsonb)))
    or public.site_editor_valid_document(jsonb_set(doc,'{blocks}',jsonb_build_array(block || '{"type":"logo","url":"javascript:alert(1)"}'::jsonb))) then
    raise exception 'Component bounds or image URL guard missing';
  end if;
  insert into public.site_editor_drafts(page_key, document) values ('/visual-validation/',
    jsonb_set(doc,'{blocks}',jsonb_build_array(block || '{"type":"logo","alt":"Logo"}'::jsonb)));
  begin
    insert into public.site_editor_drafts(page_key, document) values ('/invalid-visual/',
      jsonb_set(doc,'{patches}','{"visual":{"icon":"<svg>"}}'));
    raise exception 'Table CHECK accepted unsafe visual';
  exception when check_violation then null;
  end;
end;
$$;
rollback;
