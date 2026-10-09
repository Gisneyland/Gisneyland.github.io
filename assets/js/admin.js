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
  const authForms = [loginForm, signupForm, passwordResetForm, passwordUpdateForm];
  const backFromPasswordUpdateButton = document.getElementById('back-from-password-update');
  let responses = [];
  let currentPage = 1;
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
      const isAdmin = await showAuthorizedSession(data.session);
      if (isAdmin) {
        await loadResponses();
      }
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
    document.getElementById('admin-user').textContent = session.user.email || '已登入管理員';
  }

  function showLogin() {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    signOutButton.hidden = true;
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
    const rows = [['id', 'created_at', 'language', 'response_data']];
    filtered.forEach(response => rows.push([
      response.id,
      response.created_at,
      response.language,
      JSON.stringify(response.response_data)
    ]));
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `questionnaire-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function csvCell(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  function showResponse(response) {
    responseDetails.replaceChildren();
    const data = response.response_data || {};
    const fields = [
      ['送出時間', formatDate(response.created_at)],
      ['語言', response.language],
      ...Object.entries(data).map(([key, value]) => [key, formatValue(value)])
    ];
    fields.forEach(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      responseDetails.append(term, description);
    });
    dialog.showModal();
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

  function formatValue(value) {
    if (Array.isArray(value)) {
      return value.join('、');
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    return value || '未填寫';
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
