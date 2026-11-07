begin;

-- 允許以逗號分隔儲存任意數量匿名諮詢代碼（舊限制僅允許單一代碼）。
alter table public.questionnaire_responses
  drop constraint if exists questionnaire_consult_code_check;
alter table public.questionnaire_responses
  add constraint questionnaire_consult_code_check
  check (anonymous_consult_code is null or anonymous_consult_code ~ '^[A-Za-z0-9-]{4,32}(,[A-Za-z0-9-]{4,32})*$');

alter table public.questionnaire_responses
  drop constraint if exists questionnaire_consult_uploads_check;
alter table public.questionnaire_responses
  add constraint questionnaire_consult_uploads_check
  check (jsonb_typeof(consult_uploads) = 'array');

commit;
