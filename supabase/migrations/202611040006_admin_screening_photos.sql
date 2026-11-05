begin;

-- 讓有「諮詢處理」權限的人員可從後台補傳、取代陽性試劑照片。
drop policy if exists "Staff can upload screening test photos" on storage.objects;
create policy "Staff can upload screening test photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'screening-test-photos'
  and public.has_admin_permission('questionnaire.consultation')
);

drop policy if exists "Staff can replace screening test photos" on storage.objects;
create policy "Staff can replace screening test photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'screening-test-photos'
  and public.has_admin_permission('questionnaire.consultation')
)
with check (
  bucket_id = 'screening-test-photos'
  and public.has_admin_permission('questionnaire.consultation')
);

drop policy if exists "Staff can delete screening test photos" on storage.objects;
create policy "Staff can delete screening test photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'screening-test-photos'
  and public.has_admin_permission('questionnaire.consultation')
);

commit;
