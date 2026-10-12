const RESPONSE_DETAIL_GROUPS = [
  { title: '填答者基本資料', fields: ['nickname', 'gender', 'gender_others', 'orientation', 'orientation_others', 'birth', 'nationality', 'hometown', 'hometown_others', 'residence', 'residence_others', 'education'] },
  { title: '同意與過往篩檢', fields: ['agreement', 'needle_consent', 'privacy_consent', 'privacy_notice_version', 'frequency_screening', 'last_screening_at'] },
  { title: '性行為風險', fields: ['frequency_sex', 'frequency_condom', 'frequency_closed_relationship', 'closed_relationship_aids', 'frequency_online_dating', 'frequency_public_dating', 'frequency_sex_service', 'frequency_sex_consumption'] },
  { title: '物質使用', fields: ['frequency_alcohol', 'frequency_drug', 'usage_drug', 'drug_amphetamine', 'drug_amphetamine_inhalant', 'drug_amphetamine_injection', 'drug_amphetamine_oral', 'drug_ghb', 'drug_mdma', 'drug_ketamine', 'drug_rush', 'drug_mephedrone', 'drug_heroin', 'drug_weed', 'drug_other_choice', 'drug_others', 'frequency_drug_now'] },
  { title: '性病與預防措施', fields: ['frequency_std', 'std_aids', 'std_aids_reason', 'std_genital_warts', 'std_syphilis', 'std_chlamydia', 'std_gonorrhea', 'std_genital_herpes', 'std_hepatitis_a', 'std_hepatitis_c', 'std_other_choice', 'std_others', 'frequency_pep', 'frequency_pep_willingness', 'frequency_prep', 'frequency_prep_willingness'] },
  { title: '篩檢結果與陽性轉介', fields: ['screener', 'screening_at', 'screening_place', 'screening_interpretation', 'hiv_window_period', 'hiv_positive_contacts', 'hiv_positive_contact_phone', 'hiv_positive_appointment', 'hiv_positive_address', 'hiv_positive_notes', 'screening_photos'] }
];

const RESPONSE_FIELD_LABELS = {
  nickname: '暱稱', gender: '性別', gender_others: '其他性別', orientation: '性傾向',
  orientation_others: '其他性傾向', birth: '出生年份', nationality: '國籍',
  hometown: '成年前居住地', hometown_others: '其他成年前居住地', residence: '目前居住地',
  residence_others: '其他居住地', education: '教育程度', agreement: '同意篩檢諮詢與陽性轉介',
  needle_consent: '同意針具採血', privacy_consent: '同意個人資料使用',
  privacy_notice_version: '個資告知版本', frequency_screening: '篩檢頻率',
  last_screening_at: '最近一次篩檢日期', frequency_sex: '一年內有性行為',
  frequency_condom: '全程正確使用保險套', frequency_closed_relationship: '僅與固定性伴侶發生性行為',
  closed_relationship_aids: '固定性伴侶為 HIV 感染者', frequency_online_dating: '透過網路認識性伴侶並發生性行為',
  frequency_public_dating: '透過娛樂場所認識性伴侶並發生性行為', frequency_sex_service: '提供性交易服務',
  frequency_sex_consumption: '性消費或買春', frequency_alcohol: '性行為前後飲酒',
  frequency_drug: '性行為前後使用娛樂性藥物', usage_drug: '曾使用成癮藥物',
  drug_amphetamine: '安非他命／甲基安非他命', drug_amphetamine_inhalant: '安非他命使用方式：吸入',
  drug_amphetamine_injection: '安非他命使用方式：注射', drug_amphetamine_oral: '安非他命使用方式：口服',
  drug_ghb: '神仙水（GHB）', drug_mdma: '搖頭丸（MDMA）', drug_ketamine: '愷他命',
  drug_rush: '快樂水（Rush）', drug_mephedrone: '合成卡西酮類物質', drug_heroin: '海洛因',
  drug_weed: '大麻', drug_other_choice: '使用其他成癮藥物', drug_others: '其他成癮藥物內容',
  frequency_drug_now: '目前仍持續使用成癮藥物', frequency_std: '一年內曾感染性病',
  std_aids: '愛滋', std_aids_reason: '再次篩檢原因', std_genital_warts: '菜花（尖形濕疣）',
  std_syphilis: '梅毒', std_chlamydia: '披衣菌', std_gonorrhea: '淋病', std_genital_herpes: '性皰疹',
  std_hepatitis_a: 'A 型肝炎', std_hepatitis_c: 'C 型肝炎', std_other_choice: '其他性病',
  std_others: '其他性病內容', frequency_pep: '使用過 PEP',
  frequency_pep_willingness: '有意願使用 PEP', frequency_prep: '聽過 PrEP',
  frequency_prep_willingness: '有意願使用 PrEP', screener: '篩檢員編號',
  screening_at: '篩檢日期', screening_place: '篩檢地點', screening_interpretation: '篩檢判讀',
  hiv_window_period: 'HIV 空窗期', hiv_positive_contacts: '陽性轉介聯絡方式', hiv_positive_contact_phone: '陽性轉介聯絡電話',
  hiv_positive_appointment: '預約門診', hiv_positive_address: '就診地址', hiv_positive_notes: '陽性轉介備註',
  screening_photos: '陽性試劑照片'
};

const SCREENING_PHOTO_LABELS = { hiv: 'HIV 陽性試劑照片', syphilis: '梅毒陽性試劑照片' };
const SCREENING_PHOTO_BUCKET = 'screening-test-photos';
const SCREENING_PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(hiv|syphilis)\.(jpg|png|webp)$/;

const RESPONSE_VALUE_LABELS = {
  gender: { cisman: '順性別男性', transman: '跨性別男性', ciswoman: '順性別女性', transwoman: '跨性別女性', gender_others: '其他' },
  orientation: { heterosexual: '異性戀', homosexual: '同性戀', bisexual: '雙性戀', orientation_others: '其他' },
  education: { illiterate: '不識字', primary: '小學', junior_high: '國中', senior_high: '高中', university: '大學', master: '碩士', phd: '博士' },
  frequency_screening: { '-1': '從未篩檢', '0': '偶爾篩檢', '1': '定期篩檢' },
  screening_interpretation: { hiv_positive: 'HIV 陽性', hiv_negative: 'HIV 陰性', syphilis_positive: '梅毒陽性', syphilis_negative: '梅毒陰性' },
  hiv_window_period: { '1_month': '一個月空窗期', '3_months': '三個月空窗期' }
};

const RESPONSE_YES_NO_FIELDS = new Set([
  'agreement', 'needle_consent', 'privacy_consent', 'frequency_sex', 'frequency_condom',
  'frequency_closed_relationship', 'closed_relationship_aids', 'frequency_online_dating',
  'frequency_public_dating', 'frequency_sex_service', 'frequency_sex_consumption',
  'frequency_alcohol', 'frequency_drug', 'usage_drug', 'frequency_drug_now', 'frequency_std',
  'std_aids', 'std_genital_warts', 'std_syphilis', 'std_chlamydia', 'std_gonorrhea',
  'std_genital_herpes', 'std_hepatitis_a', 'std_hepatitis_c', 'std_other_choice',
  'frequency_pep', 'frequency_pep_willingness', 'frequency_prep', 'frequency_prep_willingness',
  'drug_amphetamine', 'drug_amphetamine_inhalant', 'drug_amphetamine_injection',
  'drug_amphetamine_oral', 'drug_ghb', 'drug_mdma', 'drug_ketamine', 'drug_rush',
  'drug_mephedrone', 'drug_heroin', 'drug_weed', 'drug_other_choice'
]);

document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const passwordResetForm = document.getElementById('password-reset-form');
  const passwordUpdateForm = document.getElementById('password-update-form');
  const loginStatus = document.getElementById('login-status');
  const dashboardStatus = document.getElementById('dashboard-status');
  const signOutButton = document.getElementById('sign-out-button');
  const openQuestionnaireButton = document.getElementById('open-questionnaire-button');
  const refreshButton = document.getElementById('refresh-button');
  const exportButton = document.getElementById('export-button');
  const previousPageButton = document.getElementById('previous-page');
  const nextPageButton = document.getElementById('next-page');
  const pageStatus = document.getElementById('page-status');
  const searchInput = document.getElementById('search-responses');
  const languageFilter = document.getElementById('language-filter');
  const responseBody = document.getElementById('responses-body');
  const emptyState = document.getElementById('empty-state');
  const dialog = document.getElementById('response-dialog');
  const closeDialogButton = document.getElementById('close-dialog-button');
  const responseDetails = document.getElementById('response-details');
  const screenerNumberForm = document.getElementById('screener-number-form');
  const screenerNumberInput = document.getElementById('screener-number-input');
  const screenerNumberStatus = document.getElementById('screener-number-status');
  const saveScreenerNumberButton = document.getElementById('save-screener-number');
  let responses = [];
  let currentPage = 1;
  let screenerNumberUserId = null;
  const pageSize = 25;

  if (!window.questionnaireSupabase) {
    showStatus(loginStatus, '資料服務尚未設定，請聯絡系統管理員。', true);
    loginForm.querySelector('button').disabled = true;
    return;
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    setButtonBusy(loginForm.querySelector('button'), true, '登入中');
    showStatus(loginStatus, '登入中，請稍候。');

    const { error } = await window.questionnaireSupabase.auth.signInWithPassword({
      email: formData.get('email'),
      password: formData.get('password')
    });

    setButtonBusy(loginForm.querySelector('button'), false, '登入後台');
    if (error) {
      showStatus(loginStatus, '登入失敗，請確認帳號與密碼。', true);
      return;
    }

    await loadSession();
  });

  document.getElementById('show-signup').addEventListener('click', () => showAuthForm(signupForm));
  document.getElementById('show-password-reset').addEventListener('click', () => {
    document.getElementById('reset-email').value = document.getElementById('admin-email').value;
    showAuthForm(passwordResetForm);
  });
  document.querySelectorAll('[data-back-to-login]').forEach(button => {
    button.addEventListener('click', () => showAuthForm(loginForm));
  });
  backFromPasswordUpdateButton.addEventListener('click', async () => {
    await window.questionnaireSupabase.auth.signOut();
    showAuthForm(loginForm);
  });

  signupForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const password = formData.get('password');
    if (password !== formData.get('password-confirm')) {
      showStatus(loginStatus, '兩次輸入的密碼不一致。', true);
      return;
    }

    const submitButton = signupForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, '送出中');
    const { data, error } = await window.questionnaireSupabase.auth.signUp({
      email: formData.get('email'),
      password,
      options: { emailRedirectTo: getAdminRedirectUrl() }
    });
    setButtonBusy(submitButton, false, '送出帳號申請');
    if (error) {
      showStatus(loginStatus, '申請失敗，請確認電子郵件與密碼設定。', true);
      return;
    }

    signupForm.reset();
    if (data.session) {
      await showAuthorizedSession(data.session);
      if (dashboard.hidden) {
        showStatus(loginStatus, '申請已送出。管理員核准前，帳號無法查看問卷資料。', false);
      }
    } else {
      showAuthForm(loginForm);
      showStatus(loginStatus, '申請已送出。請依電子郵件完成驗證，並等待管理員核准。');
    }
  });

  passwordResetForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = passwordResetForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, '寄送中');
    const { error } = await window.questionnaireSupabase.auth.resetPasswordForEmail(
      new FormData(passwordResetForm).get('email'),
      { redirectTo: getAdminRedirectUrl() }
    );
    setButtonBusy(submitButton, false, '寄送重設連結');
    if (error) {
      showStatus(loginStatus, '目前無法寄送重設連結，請稍後再試或聯絡管理員。', true);
      return;
    }

    showStatus(loginStatus, '若此電子郵件已註冊，您將收到密碼重設連結。請檢查收件匣與垃圾郵件。');
  });

  passwordUpdateForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(passwordUpdateForm);
    const password = formData.get('password');
    if (password !== formData.get('password-confirm')) {
      showStatus(loginStatus, '兩次輸入的密碼不一致。', true);
      return;
    }

    const submitButton = passwordUpdateForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, '更新中');
    const { error } = await window.questionnaireSupabase.auth.updateUser({ password });
    setButtonBusy(submitButton, false, '更新密碼');
    if (error) {
      showStatus(loginStatus, '密碼更新失敗，請重新開啟重設連結後再試。', true);
      return;
    }

    passwordUpdateForm.reset();
    const cleanUrl = new URL(window.location.href);
    cleanUrl.hash = '';
    cleanUrl.searchParams.delete('type');
    window.history.replaceState(null, '', cleanUrl);
    await loadSession();
    if (!dashboard.hidden) {
      showStatus(dashboardStatus, '密碼已更新。');
    }
  });

  signOutButton.addEventListener('click', async () => {
    await window.questionnaireSupabase.auth.signOut();
    showLogin();
  });

  refreshButton.addEventListener('click', loadResponses);
  exportButton.addEventListener('click', exportResponses);
  previousPageButton.addEventListener('click', () => changePage(-1));
  nextPageButton.addEventListener('click', () => changePage(1));
  searchInput.addEventListener('input', () => { currentPage = 1; renderResponses(); });
  languageFilter.addEventListener('change', () => { currentPage = 1; renderResponses(); });
  closeDialogButton.addEventListener('click', () => dialog.close());
  screenerNumberForm.addEventListener('submit', saveScreenerNumber);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  window.questionnaireSupabase.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
      showAuthForm(passwordUpdateForm);
      backFromPasswordUpdateButton.hidden = false;
    }
  });

  loadSession();

  async function loadSession() {
    if (isPasswordRecovery()) {
      showAuthForm(passwordUpdateForm);
      backFromPasswordUpdateButton.hidden = false;
      return;
    }
    const { data } = await window.questionnaireSupabase.auth.getSession();
    if (data.session) {
      showDashboard(data.session);
      await loadScreenerNumber(data.session);
      await loadResponses();
    } else {
      showLogin();
    }
  }

  async function showAuthorizedSession(session) {
    const { data, error } = await window.questionnaireSupabase
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!error && data) {
      showDashboard(session);
      await loadScreenerNumber(session);
      return true;
    }

    await window.questionnaireSupabase.auth.signOut();
    showLogin();
    showStatus(loginStatus, error
      ? '無法確認管理權限，請稍後再試或聯絡系統管理員。'
      : '帳號尚未獲管理員核准，核准前無法查看問卷資料。', true);
    return false;
  }

  function showAuthForm(activeForm) {
    authForms.forEach(form => { form.hidden = form !== activeForm; });
    document.getElementById('show-signup').hidden = activeForm !== loginForm;
    document.getElementById('show-password-reset').hidden = activeForm !== loginForm;
    backFromPasswordUpdateButton.hidden = activeForm !== passwordUpdateForm;
    loginStatus.hidden = true;
    loginStatus.textContent = '';
  }

  function getAdminRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function isPasswordRecovery() {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
  }

  function showDashboard(session) {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    signOutButton.hidden = false;
    openQuestionnaireButton.hidden = false;
    document.getElementById('admin-user').textContent = session.user.email || '已登入管理員';
  }

  async function loadScreenerNumber(session) {
    screenerNumberUserId = session.user.id;
    screenerNumberInput.value = '';
    screenerNumberInput.disabled = true;
    saveScreenerNumberButton.disabled = true;
    showStatus(screenerNumberStatus, '正在讀取帳號綁定資料。');

    const { data, error } = await window.questionnaireSupabase
      .from('admin_profiles')
      .select('screener_number')
      .eq('user_id', screenerNumberUserId)
      .maybeSingle();

    if (error || !data) {
      showStatus(screenerNumberStatus, error
        ? '無法載入篩檢員編號。請確認資料庫已更新並聯絡系統管理員。'
        : '此帳號不在管理員名單中，無法設定篩檢員編號。', true);
      return;
    }

    screenerNumberInput.disabled = false;
    saveScreenerNumberButton.disabled = false;
    screenerNumberInput.value = data.screener_number || '';
    showStatus(screenerNumberStatus, data.screener_number
      ? `目前綁定編號：${data.screener_number}`
      : '尚未綁定編號。請輸入已分配給此帳號的篩檢員編號。');
  }

  async function saveScreenerNumber(event) {
    event.preventDefault();
    const screenerNumber = screenerNumberInput.value.trim();
    screenerNumberInput.value = screenerNumber;
    if (!screenerNumberInput.reportValidity() || !screenerNumberUserId) return;

    setButtonBusy(saveScreenerNumberButton, true, '儲存中');
    const { data, error } = await window.questionnaireSupabase
      .from('admin_profiles')
      .update({ screener_number: screenerNumber })
      .eq('user_id', screenerNumberUserId)
      .select('screener_number')
      .maybeSingle();
    setButtonBusy(saveScreenerNumberButton, false, '儲存編號');

    if (error || !data) {
      const message = error?.code === '23505'
        ? '此篩檢員編號已綁定其他帳號，請確認編號後再試。'
        : '儲存失敗。請確認資料庫已更新，或聯絡系統管理員。';
      showStatus(screenerNumberStatus, message, true);
      return;
    }

    screenerNumberInput.value = data.screener_number;
    showStatus(screenerNumberStatus, `已綁定篩檢員編號：${data.screener_number}`);
  }

  function showLogin() {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    signOutButton.hidden = true;
    openQuestionnaireButton.hidden = true;
    screenerNumberUserId = null;
    screenerNumberInput.value = '';
    screenerNumberInput.disabled = true;
    saveScreenerNumberButton.disabled = true;
    screenerNumberStatus.hidden = true;
    loginForm.reset();
    showAuthForm(loginForm);
  }

  async function loadResponses() {
    showStatus(dashboardStatus, '資料載入中。');
    const { data, error } = await window.questionnaireSupabase
      .from('questionnaire_responses')
      .select('id, created_at, language, schema_version, response_data')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      showStatus(dashboardStatus, '無法載入資料，請確認你的帳號是否在管理員白名單中。', true);
      return;
    }

    responses = data || [];
    currentPage = 1;
    renderResponses();
    showStatus(dashboardStatus, `已載入 ${responses.length} 筆資料。`);
  }

  function renderResponses() {
    const keyword = searchInput.value.trim().toLowerCase();
    const language = languageFilter.value;
    const filtered = responses.filter(response => {
      const data = response.response_data || {};
      const searchable = [data.nickname, data.screener, data.screening_place]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (!keyword || searchable.includes(keyword))
        && (language === 'all' || response.language === language);
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const visibleResponses = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    document.getElementById('total-count').textContent = responses.length;
    document.getElementById('zh-count').textContent = responses.filter(item => item.language === 'zh-TW').length;
    document.getElementById('en-count').textContent = responses.filter(item => item.language === 'en').length;
    document.getElementById('filtered-count').textContent = filtered.length;
    pageStatus.textContent = `第 ${currentPage} / ${totalPages} 頁`;
    previousPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages;

    responseBody.replaceChildren();
    emptyState.hidden = filtered.length !== 0;
    visibleResponses.forEach(response => {
      const data = response.response_data || {};
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(formatDate(response.created_at))}</td>
        <td>${escapeHtml(data.nickname || '未填寫')}</td>
        <td>${escapeHtml(data.screener || '未填寫')}</td>
        <td>${escapeHtml(data.screening_place || '未填寫')}</td>
        <td>${escapeHtml(response.language || '未標示')}</td>
        <td><button class="table-action" type="button" data-response-id="${response.id}">查看</button></td>
      `;
      row.querySelector('button').addEventListener('click', () => showResponse(response));
      responseBody.appendChild(row);
    });
  }

  function changePage(direction) {
    currentPage += direction;
    renderResponses();
  }

  function exportResponses() {
    const keyword = searchInput.value.trim().toLowerCase();
    const language = languageFilter.value;
    const filtered = responses.filter(response => {
      const data = response.response_data || {};
      const searchable = [data.nickname, data.screener, data.screening_place]
        .filter(Boolean).join(' ').toLowerCase();
      return (!keyword || searchable.includes(keyword))
        && (language === 'all' || response.language === language);
    });
    const knownFields = new Set(RESPONSE_DETAIL_GROUPS.flatMap(group => group.fields));
    const exportFields = [
      ...RESPONSE_DETAIL_GROUPS.flatMap(group => group.fields.map(key => ({
        key,
        label: `${group.title} - ${RESPONSE_FIELD_LABELS[key] || humanizeFieldName(key)}`
      }))),
      ...Array.from(new Set(filtered.flatMap(response => Object.keys(response.response_data || {}))))
        .filter(key => !knownFields.has(key))
        .sort((left, right) => left.localeCompare(right, 'zh-TW'))
        .map(key => ({ key, label: `其他資料 - ${humanizeFieldName(key)}` }))
    ];
    const rows = [[
      '資料編號', '送出時間', '填答語言', '問卷版本',
      ...exportFields.map(field => field.label)
    ]];
    filtered.forEach(response => {
      const data = response.response_data || {};
      rows.push([
        response.id,
        formatDate(response.created_at),
        response.language === 'en' ? 'English' : '繁體中文',
        response.schema_version ? `第 ${response.schema_version} 版` : '',
        ...exportFields.map(({ key }) => hasResponseValue(data[key]) ? formatResponseValue(key, data[key]) : '')
      ]);
    });
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `questionnaire-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(objectUrl);
    }, 1000);
    showStatus(dashboardStatus, `已匯出 ${filtered.length} 筆資料。`);
  }

  function csvCell(value) {
    const text = String(value);
    const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  }

  function showResponse(response) {
    responseDetails.replaceChildren();
    const data = response.response_data || {};
    const knownFields = new Set(RESPONSE_DETAIL_GROUPS.flatMap(group => group.fields));
    const groups = [
      {
        title: '提交資訊',
        fields: [
          ['record_id', '資料編號', response.id],
          ['created_at', '送出時間', formatDate(response.created_at)],
          ['language', '填答語言', response.language === 'en' ? 'English' : '繁體中文'],
          ['schema_version', '問卷版本', response.schema_version ? `第 ${response.schema_version} 版` : '']
        ]
      },
      ...RESPONSE_DETAIL_GROUPS.map(group => ({
        title: group.title,
        fields: group.fields.map(key => [key, RESPONSE_FIELD_LABELS[key] || humanizeFieldName(key), data[key]])
      })),
      {
        title: '其他資料',
        fields: Object.entries(data)
          .filter(([key]) => !knownFields.has(key))
          .sort(([left], [right]) => left.localeCompare(right, 'zh-TW'))
          .map(([key, value]) => [key, humanizeFieldName(key), value])
      }
    ];

    let sectionIndex = 0;
    groups.forEach(group => {
      const visibleFields = group.fields.filter(([key, , value]) => key !== 'screening_photos' && hasResponseValue(value));
      if (!visibleFields.length) return;

      const section = document.createElement('section');
      section.className = 'response-section';
      section.setAttribute('aria-labelledby', `response-section-${sectionIndex}`);
      const heading = document.createElement('h3');
      heading.id = `response-section-${sectionIndex}`;
      heading.className = 'response-section-title';
      heading.textContent = group.title;
      const details = document.createElement('dl');
      details.className = 'response-details';

      visibleFields.forEach(([key, label, value]) => {
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = key === 'created_at' ? value : formatResponseValue(key, value);
        details.append(term, description);
      });

      section.append(heading, details);
      responseDetails.append(section);
      sectionIndex += 1;
    });
    dialog.showModal();
    appendScreeningPhotos(data.screening_photos).catch(() => {});
  }

  async function appendScreeningPhotos(photos) {
    if (!photos || typeof photos !== 'object') return;
    const entries = Object.entries(photos)
      .filter(([kind, path]) => SCREENING_PHOTO_LABELS[kind] && SCREENING_PHOTO_PATH.test(String(path)) && String(path).includes(`/${kind}.`));
    if (!entries.length) return;

    const section = document.createElement('section');
    section.className = 'response-section';
    const heading = document.createElement('h3');
    heading.className = 'response-section-title';
    heading.textContent = '陽性試劑照片';
    const content = document.createElement('div');
    content.className = 'response-photos';
    content.textContent = '照片載入中。';
    section.append(heading, content);
    responseDetails.append(section);

    const { data, error } = await window.questionnaireSupabase.storage
      .from(SCREENING_PHOTO_BUCKET)
      .createSignedUrls(entries.map(([, path]) => path), 300);
    if (!section.isConnected) return;
    if (error || !data) {
      content.textContent = '無法載入照片，請確認資料庫已更新且帳號具管理權限。';
      return;
    }

    content.replaceChildren();
    entries.forEach(([kind], index) => {
      const signedUrl = data[index]?.signedUrl;
      if (!signedUrl) return;
      const figure = document.createElement('figure');
      figure.className = 'response-photo';
      const link = document.createElement('a');
      link.href = signedUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const image = document.createElement('img');
      image.src = signedUrl;
      image.alt = SCREENING_PHOTO_LABELS[kind];
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      link.append(image);
      const caption = document.createElement('figcaption');
      caption.textContent = SCREENING_PHOTO_LABELS[kind];
      figure.append(link, caption);
      content.append(figure);
    });
    if (!content.children.length) content.textContent = '無法載入照片。';
  }

  function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.hidden = false;
  }

  function setButtonBusy(button, busy, label) {
    button.disabled = busy;
    button.querySelector('.material-icons')?.classList.toggle('spin', busy);
    const text = Array.from(button.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    if (text) {
      text.textContent = ` ${label}`;
    }
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat('zh-TW', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  function hasResponseValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value === null || value === undefined) return false;
    return typeof value !== 'string' || value.trim() !== '';
  }

  function formatResponseValue(key, value) {
    if (key === 'hiv_positive_contacts' && Array.isArray(value)) {
      return value.map(formatReferralContact).filter(Boolean).join('；');
    }
    if (key === 'screening_photos' && value && typeof value === 'object') {
      return Object.keys(value).map(kind => SCREENING_PHOTO_LABELS[kind] || kind).join('、');
    }
    if (Array.isArray(value)) {
      return value.map(item => formatResponseScalar(key, item)).join('、');
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    return formatResponseScalar(key, value);
  }

  function formatReferralContact(contact) {
    if (!contact || typeof contact !== 'object' || !contact.value) return '';
    const labels = {
      email: 'Mail', line: 'LINE', facebook: 'FB', instagram: 'IG', threads: 'Threads',
      whatsapp: 'WhatsApp', telegram: 'Telegram', address: '通訊地址'
    };
    const phoneLabels = { mobile: '手機', landline: '市話' };
    const label = contact.type === 'phone'
      ? phoneLabels[contact.phone_kind] || '電話'
      : labels[contact.type] || String(contact.type || '其他');
    return `${label}：${contact.value}`;
  }

  function formatResponseScalar(key, value) {
    const stringValue = String(value);
    if (key === 'hiv_positive_appointment' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stringValue)) {
      const [datePart, timePart] = stringValue.split('T');
      const [year, month, day] = datePart.split('-');
      return `${year}年${Number(month)}月${Number(day)}日 ${timePart}`;
    }
    const fieldLabels = RESPONSE_VALUE_LABELS[key];
    if (fieldLabels && Object.hasOwn(fieldLabels, stringValue)) return fieldLabels[stringValue];
    if (key === 'nationality' && /^[A-Z]{2}$/.test(stringValue)) {
      try {
        return new Intl.DisplayNames(['zh-TW'], { type: 'region' }).of(stringValue) || stringValue;
      } catch {
        return stringValue;
      }
    }
    if (RESPONSE_YES_NO_FIELDS.has(key)) {
      const commonLabels = { yes: '是', no: '否', none: '無', unknown: '不知道', accepted: '已同意' };
      if (Object.hasOwn(commonLabels, stringValue)) return commonLabels[stringValue];
    }
    if (key === 'screening_at' && /^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
      const [year, month, day] = stringValue.split('-');
      return `${year}年${Number(month)}月${Number(day)}日`;
    }
    if (key === 'last_screening_at' && /^\d{4}-\d{2}$/.test(stringValue)) {
      const [year, month] = stringValue.split('-');
      return `${year}年${Number(month)}月`;
    }
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return stringValue;
  }

  function humanizeFieldName(key) {
    return key.replaceAll('_', ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
});
