begin;

alter table public.screening_institutions
  add column if not exists contact text not null default '' check (length(contact) <= 200),
  add column if not exists staff text[] not null default array[]::text[] check (cardinality(staff) <= 50);

commit;
