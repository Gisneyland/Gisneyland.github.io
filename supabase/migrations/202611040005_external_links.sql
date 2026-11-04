begin;

-- 外國問卷（依國籍）與衛生局／疾管署網站的連結，數量不限。
-- kind = nationality_questionnaire：nationality 填國碼（如 TH）；kind = agency_site：match_keywords 為空代表全部適用，
-- 否則篩檢地點包含任一關鍵字（如縣市名）才適用。
create table if not exists public.external_links (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('nationality_questionnaire', 'agency_site')),
  nationality text not null default '' check (length(nationality) <= 80),
  match_keywords text[] not null default array[]::text[] check (cardinality(match_keywords) <= 30),
  label text not null check (length(btrim(label)) between 1 and 120),
  url text not null check (url ~* '^https?://' and length(url) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.external_links enable row level security;
revoke all on table public.external_links from anon, authenticated;
grant select, insert, update, delete on table public.external_links to authenticated;

drop policy if exists "Staff can read external links" on public.external_links;
create policy "Staff can read external links" on public.external_links
for select to authenticated using (public.has_admin_permission('questionnaire.read'));

drop policy if exists "Staff can manage external links" on public.external_links;
create policy "Staff can manage external links" on public.external_links
for all to authenticated
using (public.has_admin_permission('questionnaire.consultation'))
with check (public.has_admin_permission('questionnaire.consultation'));

-- 每筆紀錄的待辦完成狀態：{ "<link id>": { "done_at": "...", "by": "uuid" } }
alter table public.questionnaire_responses
  add column if not exists task_progress jsonb not null default '{}'::jsonb;
alter table public.questionnaire_responses
  drop constraint if exists questionnaire_task_progress_check;
alter table public.questionnaire_responses
  add constraint questionnaire_task_progress_check check (jsonb_typeof(task_progress) = 'object');

grant update (response_data, status, anonymous_consult_code, consult_uploads, task_progress, updated_at, updated_by)
  on table public.questionnaire_responses to authenticated;

commit;
