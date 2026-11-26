begin;

-- 後台批次匯入與刪除篩檢紀錄。
-- 需同時具備「查看」與「編輯」權限；匯入只能寫入問卷內容欄位，系統欄位（id、照片、處理紀錄）維持預設。
grant insert (response_data, language, schema_version, status, anonymous_consult_code, created_at)
  on table public.questionnaire_responses to authenticated;
grant delete on table public.questionnaire_responses to authenticated;

drop policy if exists "Authorized staff can import questionnaire responses" on public.questionnaire_responses;
create policy "Authorized staff can import questionnaire responses"
on public.questionnaire_responses
for insert
to authenticated
with check (
  public.has_admin_permission('questionnaire.read')
  and public.has_admin_permission('questionnaire.consultation')
  and jsonb_typeof(response_data) = 'object'
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

drop policy if exists "Authorized staff can delete questionnaire responses" on public.questionnaire_responses;
create policy "Authorized staff can delete questionnaire responses"
on public.questionnaire_responses
for delete
to authenticated
using (
  public.has_admin_permission('questionnaire.read')
  and public.has_admin_permission('questionnaire.consultation')
);

commit;
