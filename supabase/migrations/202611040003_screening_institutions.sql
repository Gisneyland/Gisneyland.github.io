begin;

-- 機構內篩檢地點：串接上傳檔的「篩檢地點類別」遇到這些機構會填 1（機構內），其餘為 7（外展）。
create table if not exists public.screening_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  address text not null default '' check (length(address) <= 200),
  aliases text[] not null default array[]::text[] check (cardinality(aliases) <= 20),
  created_at timestamptz not null default now()
);

alter table public.screening_institutions enable row level security;
revoke all on table public.screening_institutions from anon, authenticated;
grant select, insert, update, delete on table public.screening_institutions to authenticated;

drop policy if exists "Staff can read screening institutions" on public.screening_institutions;
create policy "Staff can read screening institutions" on public.screening_institutions
for select to authenticated using (public.has_admin_permission('questionnaire.read'));

drop policy if exists "Staff can manage screening institutions" on public.screening_institutions;
create policy "Staff can manage screening institutions" on public.screening_institutions
for all to authenticated
using (public.has_admin_permission('questionnaire.consultation'))
with check (public.has_admin_permission('questionnaire.consultation'));

insert into public.screening_institutions (name, aliases)
select seed.name, seed.aliases
from (values
  ('財團法人台灣紅絲帶基金會', array['紅絲帶基金會', '紅絲帶']),
  ('風城部屋', array[]::text[]),
  ('紅樓部屋', array[]::text[]),
  ('桃園部屋', array[]::text[]),
  ('諸羅部屋', array[]::text[])
) as seed(name, aliases)
where not exists (select 1 from public.screening_institutions);

commit;
