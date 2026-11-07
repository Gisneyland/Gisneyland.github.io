begin;

-- 組織合作的地方衛生局名單；諮詢代碼的 consult_uploads 以 bureau_id 指定要上傳到哪一個衛生局。
create table if not exists public.local_health_bureaus (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.local_health_bureaus enable row level security;
revoke all on table public.local_health_bureaus from anon, authenticated;
grant select, insert, update, delete on table public.local_health_bureaus to authenticated;

drop policy if exists "Staff can read local health bureaus" on public.local_health_bureaus;
create policy "Staff can read local health bureaus" on public.local_health_bureaus
for select to authenticated using (public.has_admin_permission('questionnaire.read'));

drop policy if exists "Staff can manage local health bureaus" on public.local_health_bureaus;
create policy "Staff can manage local health bureaus" on public.local_health_bureaus
for all to authenticated
using (public.has_admin_permission('questionnaire.consultation'))
with check (public.has_admin_permission('questionnaire.consultation'));

commit;
