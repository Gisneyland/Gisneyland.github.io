// Single place that knows the admin_profiles and questionnaire_responses table shapes.
// Every method returns Supabase's { data, error } so callers keep their existing error handling.
(function (global) {
  const client = () => global.questionnaireSupabase;

  const PROFILE_COLUMNS = {
    session: 'user_id, nickname, approval_status, account_role, permissions, privacy_consent_at, privacy_notice_version',
    roster: 'user_id, email, nickname, full_name, phone, approval_status, account_role, permissions, privacy_consent_at, screener_number',
    editorAccess: 'account_role,approval_status,privacy_consent_at',
    screenerAccess: 'screener_number, approval_status, privacy_consent_at',
    screenerNumber: 'screener_number'
  };

  const RESPONSE_COLUMNS = {
    list: 'id, created_at, language, schema_version, response_data, anonymous_consult_code, consult_uploads, task_progress, status, updated_at'
  };

  const profiles = {
    columns: PROFILE_COLUMNS,
    fetchOwn(userId, columns) {
      return client().from('admin_profiles').select(columns).eq('user_id', userId).maybeSingle();
    },
    listRoster() {
      return client().from('admin_profiles').select(PROFILE_COLUMNS.roster).order('nickname', { ascending: true });
    },
    update(userId, patch, returning) {
      return client().from('admin_profiles').update(patch).eq('user_id', userId).select(returning).maybeSingle();
    }
  };

  const responses = {
    columns: RESPONSE_COLUMNS,
    insert(payload) {
      return client().from('questionnaire_responses').insert(payload);
    },
    // Oldest first, uncoded only.
    listPendingPage(offset, size) {
      return client().from('questionnaire_responses')
        .select(RESPONSE_COLUMNS.list)
        .is('anonymous_consult_code', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + size - 1);
    },
    listRecent(filter, limit = 200) {
      let query = client().from('questionnaire_responses')
        .select(RESPONSE_COLUMNS.list)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      if (filter === 'completed') query = query.not('anonymous_consult_code', 'is', null);
      return query;
    },
    update(id, patch, returning) {
      return client().from('questionnaire_responses').update(patch).eq('id', id).select(returning).maybeSingle();
    }
  };

  global.SiteData = { profiles, responses };
})(window);
