-- 驗證批次匯入／刪除的 RLS：在完整 migration 套用後以 psql 執行，結束時一律 rollback。
-- 資料以一般 DML 建立，不停用任何 trigger 或約束。
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'editor@example.test',
    '{"nickname":"editor","privacy_consent":true,"privacy_notice_version":"staff-privacy-2026-10-v1"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'reader@example.test',
    '{"nickname":"reader","privacy_consent":true,"privacy_notice_version":"staff-privacy-2026-10-v1"}');

insert into public.admin_profiles
  (user_id, nickname, screener_number, approval_status, account_role, permissions, privacy_consent_at, access_model_version)
values
  ('00000000-0000-0000-0000-0000000000a1', 'editor', 'E001', 'approved', 'screener',
    array['questionnaire.read', 'questionnaire.consultation'], now(), 1),
  ('00000000-0000-0000-0000-0000000000a2', 'reader', 'R001', 'approved', 'screener',
    array['questionnaire.read'], now(), 1)
on conflict (user_id) do update set
  nickname = excluded.nickname,
  screener_number = excluded.screener_number,
  approval_status = excluded.approval_status,
  account_role = excluded.account_role,
  permissions = excluded.permissions,
  privacy_consent_at = excluded.privacy_consent_at,
  access_model_version = excluded.access_model_version;

insert into public.questionnaire_responses (id, response_data, status) values
  (900001, '{"screener":"A001"}', 'submitted'),
  (900002, '{"screener":"A002"}', 'submitted');

-- 只有查看權限：不能匯入，也不能刪除
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$
declare removed int;
begin
  begin
    insert into public.questionnaire_responses (response_data, status) values ('{"screener":"X"}', 'submitted');
    raise exception 'reader import should be blocked';
  exception when insufficient_privilege then null;
  end;
  delete from public.questionnaire_responses where id in (900001, 900002);
  get diagnostics removed = row_count;
  if removed <> 0 then raise exception 'reader deleted % rows', removed; end if;
end $$;

-- 查看加編輯權限：可批次匯入與刪除，但已完成的紀錄仍須有篩檢員編號，且不能寫入系統欄位
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare removed int;
begin
  insert into public.questionnaire_responses (response_data, status, language, schema_version, created_at)
  select jsonb_build_object('screener', 'B' || n), 'submitted', 'zh-TW', 1, now() from generate_series(1, 150) as n;
  begin
    insert into public.questionnaire_responses (response_data, status) values ('{"nickname":"x"}', 'submitted');
    raise exception 'submitted import without screener should be blocked';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.questionnaire_responses (id, response_data) values (1, '{}');
    raise exception 'importing system columns should be blocked';
  exception when insufficient_privilege then null;
  end;
  delete from public.questionnaire_responses where id in (900001, 900002);
  get diagnostics removed = row_count;
  if removed <> 2 then raise exception 'editor deleted % rows, expected 2', removed; end if;
end $$;

rollback;
