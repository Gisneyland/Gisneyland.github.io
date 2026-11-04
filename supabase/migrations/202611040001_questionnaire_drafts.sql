begin;

-- 受檢者可先送出「草稿」，由篩檢員稍後在後台補完篩檢結果。
alter table public.questionnaire_responses
  add column if not exists status text not null default 'submitted',
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.questionnaire_responses
  drop constraint if exists questionnaire_status_check;
alter table public.questionnaire_responses
  add constraint questionnaire_status_check check (status in ('draft', 'submitted'));

create index if not exists questionnaire_draft_idx
  on public.questionnaire_responses (created_at, id)
  where status = 'draft';

drop policy if exists "Allow anonymous questionnaire submissions" on public.questionnaire_responses;
create policy "Allow anonymous questionnaire submissions"
on public.questionnaire_responses
for insert
to anon
with check (
  jsonb_typeof(response_data) = 'object'
  and schema_version = 1
  and (
    status = 'draft'
    or (
      status = 'submitted'
      and jsonb_typeof(response_data -> 'screener') = 'string'
      and length(btrim(response_data ->> 'screener')) > 0
    )
  )
);

-- 篩檢員可在後台修正問卷內容與篩檢結果，並將草稿轉為已完成。
grant update (response_data, status, anonymous_consult_code, updated_at, updated_by)
  on table public.questionnaire_responses to authenticated;

create or replace function public.touch_questionnaire_response()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.status = 'submitted'
    and (jsonb_typeof(new.response_data -> 'screener') is distinct from 'string'
      or length(btrim(new.response_data ->> 'screener')) = 0) then
    raise exception 'Screener number is required before completing a questionnaire';
  end if;
  return new;
end;
$$;

drop trigger if exists touch_questionnaire_response on public.questionnaire_responses;
create trigger touch_questionnaire_response
before update on public.questionnaire_responses
for each row execute function public.touch_questionnaire_response();

commit;
