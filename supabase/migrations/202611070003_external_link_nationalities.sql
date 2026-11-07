begin;

-- 一份外國問卷連結可適用多個國籍；舊的單一 nationality 欄位保留作相容，並回填到新欄位。
alter table public.external_links
  add column if not exists nationalities text[] not null default array[]::text[];

alter table public.external_links
  drop constraint if exists external_links_nationalities_check;
alter table public.external_links
  add constraint external_links_nationalities_check check (cardinality(nationalities) <= 300);

update public.external_links
set nationalities = array[nationality]
where kind = 'nationality_questionnaire'
  and cardinality(nationalities) = 0
  and btrim(nationality) <> '';

commit;
