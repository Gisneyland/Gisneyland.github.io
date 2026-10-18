(function (global) {
  const PERMISSIONS = Object.freeze([
    { key: 'questionnaire.read', label: '查看篩檢資料' },
    { key: 'questionnaire.consultation', label: '編輯匿名諮詢資料' },
    { key: 'site_content.manage', label: '管理網站內容與行事曆' },
    { key: 'staff.manage', label: '管理工作人員帳號與權限' }
  ]);

  function canAccess(profile, permission) {
    if (!profile || profile.approval_status !== 'approved' || !profile.privacy_consent_at) return false;
    if (!PERMISSIONS.some(item => item.key === permission)) return false;
    if (profile.account_role === 'administrator') return true;
    return profile.account_role === 'screener'
      && Array.isArray(profile.permissions)
      && profile.permissions.includes(permission);
  }

  function signupErrorMessage(error) {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || error?.status || 'AUTH_ERROR');
    if (code === 'user_already_exists' || /already registered|already exists/.test(message)) {
      return '此電子郵件已在系統中註冊。請使用登入或忘記密碼；若仍無法登入，請聯絡管理員確認帳號狀態。';
    }
    if (code === 'over_email_send_rate_limit' || /rate limit|too many requests/.test(message)) {
      return '此信箱近期申請或寄信次數過多，請稍後再試。';
    }
    if (/valid staff nickname|staff nickname is required/.test(message)) {
      return '請填寫有效暱稱後重新送出申請。';
    }
    if (/privacy consent|privacy notice/.test(message)) {
      return '請勾選並完成員工帳號個資告知同意後再送出。';
    }
    if (/database error|saving new user|trigger/.test(message)) {
      return `系統無法建立申請資料，請確認暱稱與個資同意欄位已填寫；若仍失敗，請將錯誤代碼 ${code} 提供給管理員。`;
    }
    return `申請未成功（${code}）。請確認必填欄位與網路連線後重試；若仍失敗，請將此代碼提供給管理員。`;
  }

  global.StaffAccess = Object.freeze({ PERMISSIONS, canAccess, signupErrorMessage });
})(globalThis);