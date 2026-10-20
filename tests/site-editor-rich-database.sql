-- Run in a disposable PostgreSQL database after both site editor migrations.
begin;
do $$
declare
  doc jsonb := '{"version":1,"patches":{},"orders":{},"blocks":[],"navigation":null}';
  block jsonb := '{"id":"new","parent":"main","title":"Title","body":"a\tb\nc\td","url":"","label":""}';
  run jsonb;
  kind text;
  bad jsonb;
begin
  if not public.site_editor_valid_document(doc) then raise exception 'Legacy document rejected'; end if;
  foreach kind in array array['paragraph','card','image','audio','video','table','code','math','music','mermaid','markdown'] loop
    if not public.site_editor_valid_document(jsonb_set(doc, '{blocks}', jsonb_build_array(
      block || jsonb_build_object('type', kind, 'style', 'h2', 'language', 'text',
        'rich', '[{"text":"Safe","bold":true,"italic":false,"underline":true,"highlight":true,"color":"#a0B1f2","script":"super","href":"/safe"}]'::jsonb)))) then
      raise exception 'Rich block type rejected: %', kind;
    end if;
  end loop;
  if not public.site_editor_valid_document(jsonb_set(doc, '{patches}', '{"text":{"style":"ol","rich":[{"text":"one\ntwo"}]}}')) then
    raise exception 'Rich patch rejected';
  end if;
  for run in select * from jsonb_array_elements(
    '[null,{},{"text":null},{"text":"x","html":"bad"},{"text":"x","bold":"true"},{"text":"x","highlight":null},
      {"text":"x","script":"sup"},{"text":"x","color":"red"},{"text":"x","href":"javascript:alert(1)"}]'::jsonb) loop
    if public.site_editor_valid_runs(jsonb_build_array(run)) then raise exception 'Malformed run accepted: %', run; end if;
  end loop;
  if public.site_editor_valid_runs(jsonb_build_array(jsonb_build_object('text', repeat('a', 6001)), jsonb_build_object('text', repeat('b', 6000)))) then
    raise exception 'Aggregate run text bound missing';
  end if;
  if public.site_editor_valid_runs((select jsonb_agg(jsonb_build_object('text', '')) from generate_series(1,501))) then
    raise exception 'Run count bound missing';
  end if;
  for bad in select * from jsonb_array_elements('[{"type":"html"},{"type":null},{"style":null},{"rich":null},{"language":null},
    {"type":"image","url":"mailto:user@example.org"},{"type":"audio","url":"blob:https://example.org/id"},
    {"type":"video","url":"data:video/mp4,x"},{"type":"image","url":"//evil.example/x"}]'::jsonb) loop
    if public.site_editor_valid_document(jsonb_set(doc, '{blocks}', jsonb_build_array(block || bad))) then
      raise exception 'Malformed rich block accepted: %', bad;
    end if;
  end loop;
  if public.site_editor_valid_document(jsonb_set(doc, '{blocks}', jsonb_build_array(block || jsonb_build_object('language', repeat('x',41)))))
    or public.site_editor_valid_document(jsonb_set(doc, '{blocks}', jsonb_build_array(block || jsonb_build_object('type','table','body',repeat(E'x\n',100)))))
    or public.site_editor_valid_document(jsonb_set(doc, '{blocks}', jsonb_build_array(block || jsonb_build_object('type','table','body',repeat(E'x\t',30)))))
    or public.site_editor_valid_document(null)
    or public.site_editor_valid_document('null'::jsonb)
    or public.site_editor_valid_document(jsonb_set(doc,'{patches}','{"text":{"style":null}}')) then
    raise exception 'Type or finite bounds check missing';
  end if;
end;
$$;
rollback;
