begin;

-- 每組諮詢代碼對應的串接單位（local＝地方衛生局、cdc＝疾管署）與上傳紀錄：
-- [{ "code": "123456", "unit": "cdc", "uploaded_at": "...", "uploaded_by": "uuid" }]
alter table public.questionnaire_responses
  add column if not exists consult_uploads jsonb not null default '[]'::jsonb;

alter table public.questionnaire_responses
  drop constraint if exists questionnaire_consult_uploads_check;
alter table public.questionnaire_responses
  add constraint questionnaire_consult_uploads_check
  check (jsonb_typeof(consult_uploads) = 'array' and jsonb_array_length(consult_uploads) <= 20);

grant update (response_data, status, anonymous_consult_code, consult_uploads, updated_at, updated_by)
  on table public.questionnaire_responses to authenticated;

commit;
