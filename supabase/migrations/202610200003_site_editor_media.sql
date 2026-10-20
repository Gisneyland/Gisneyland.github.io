begin;

-- Only public website assets belong here; questionnaire photos remain private.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-editor-media', 'site-editor-media', true, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/ogg','audio/wav','video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_editor_media_insert on storage.objects;
create policy site_editor_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-editor-media'
    and public.is_site_editor_administrator()
    and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
