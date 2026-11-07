begin;

-- 允許以逗號分隔儲存最多 20 組匿名諮詢代碼（舊限制僅允許單一代碼）。
alter table public.questionnaire_responses
  drop constraint if exists questionnaire_consult_code_check;
alter table public.questionnaire_responses
  add constraint questionnaire_consult_code_check
  check (anonymous_consult_code is null or anonymous_consult_code ~ '^[A-Za-z0-9-]{4,32}(,[A-Za-z0-9-]{4,32}){0,19}$');

commit;
