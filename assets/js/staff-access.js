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

  global.StaffAccess = Object.freeze({ PERMISSIONS, canAccess });
})(globalThis);