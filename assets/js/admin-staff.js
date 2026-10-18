document.addEventListener('DOMContentLoaded', () => {
  const manager = document.getElementById('staff-management');
  const list = document.getElementById('staff-list');
  const status = document.getElementById('staff-management-status');
  const emptyState = document.getElementById('staff-list-empty');
  const refreshButton = document.getElementById('refresh-staff-list');
  const inviteForm = document.getElementById('staff-invite-form');
  const inviteSubmitButton = document.getElementById('staff-invite-submit');
  const client = window.questionnaireSupabase;
  const access = window.StaffAccess;
  if (!manager || !list || !client || !access) return;

  let activeProfile = null;
  let loadVersion = 0;
  refreshButton.addEventListener('click', loadStaff);
  inviteForm.addEventListener('submit', sendInvitation);
  document.addEventListener('staff-profile-ready', event => {
    activeProfile = event.detail;
    const canManage = access.canAccess(activeProfile, 'staff.manage');
    manager.hidden = !canManage;
    if (canManage) loadStaff();
    else list.replaceChildren();
  });

  async function loadStaff() {
    if (!access.canAccess(activeProfile, 'staff.manage')) return;
    const version = ++loadVersion;
    showStatus('工作人員帳號載入中。');
    const { data, error } = await client
      .from('admin_profiles')
      .select('user_id, email, nickname, full_name, phone, approval_status, account_role, permissions, privacy_consent_at, screener_number')
      .order('nickname', { ascending: true });
    if (version !== loadVersion) return;
    if (error) {
      showStatus('無法載入工作人員帳號，請確認管理權限後重試。', true);
      return;
    }

    list.replaceChildren();
    const profiles = data || [];
    profiles.forEach(profile => list.append(createStaffRow(profile)));
    emptyState.hidden = profiles.length !== 0;
    showStatus(`共 ${profiles.length} 個工作人員帳號。`);
  }

  async function sendInvitation(event) {
    event.preventDefault();
    if (!access.canAccess(activeProfile, 'staff.manage') || !inviteForm.reportValidity()) return;

    const formData = new FormData(inviteForm);
    inviteSubmitButton.disabled = true;
    showStatus('正在寄送工作人員邀請。');
    try {
      const { error } = await access.sendStaffInvitation(
        client,
        formData.get('email'),
        formData.get('nickname')
      );
      if (error) {
        let code = error.code;
        try {
          code = (await error.context.json()).code || code;
        } catch {
          // Keep the SDK error code when no JSON response is available.
        }
        const messages = {
          email_already_registered: '此信箱已有帳號，請重新整理工作人員清單並管理既有帳號。',
          invitation_pending: '此信箱已有尚未完成的邀請。',
          email_rate_limited: '近期寄信次數過多，請稍後再試。',
          invalid_email: '請輸入有效的電子郵件地址。',
          invalid_nickname: '暱稱須為 1 至 40 個字。',
          staff_management_required: '目前帳號沒有邀請工作人員的權限。'
        };
        showStatus(messages[code] || '邀請未能寄出，請稍後重試或聯絡系統管理員。', true);
        return;
      }

      inviteForm.reset();
      await loadStaff();
      showStatus('邀請已寄出。受邀者接受個資告知後，仍須由管理員核准。');
    } catch {
      showStatus('目前無法寄送邀請，請稍後重試。', true);
    } finally {
      inviteSubmitButton.disabled = false;
    }
  }

  function createStaffRow(profile) {
    const row = document.createElement('tr');
    const identity = document.createElement('td');
    identity.className = 'staff-identity';
    const nickname = document.createElement('strong');
    nickname.textContent = profile.nickname || '未設定暱稱';
    const email = document.createElement('span');
    email.textContent = profile.email || '沒有電子郵件';
    identity.append(nickname, email);
    if (profile.full_name || profile.phone) {
      const contact = document.createElement('small');
      contact.textContent = [profile.full_name, profile.phone].filter(Boolean).join(' · ');
      identity.append(contact);
    }
    const consent = document.createElement('small');
    consent.className = profile.privacy_consent_at ? 'staff-consent-ok' : 'staff-consent-missing';
    consent.textContent = profile.privacy_consent_at ? '已完成個資同意' : '尚未完成個資同意';
    identity.append(consent);
    row.append(identity);

    const statusCell = document.createElement('td');
    const statusSelect = createSelect([
      ['pending', '待審核'], ['approved', '已核准'], ['rejected', '未核准'], ['suspended', '已停用']
    ], profile.approval_status);
    statusCell.append(statusSelect);
    row.append(statusCell);

    const roleCell = document.createElement('td');
    const roleSelect = createSelect([['screener', '篩檢員'], ['administrator', '管理員']], profile.account_role);
    roleCell.append(roleSelect);
    row.append(roleCell);

    const permissionsCell = document.createElement('td');
    const permissionsDetails = document.createElement('details');
    permissionsDetails.className = 'staff-permission-details';
    const permissionsSummary = document.createElement('summary');
    permissionsSummary.textContent = profile.account_role === 'administrator'
      ? '管理員（全部權限）'
      : `權限（${(profile.permissions || []).length}）`;
    permissionsDetails.append(permissionsSummary);
    const permissionList = document.createElement('div');
    permissionList.className = 'staff-permission-list';
    const permissionInputs = access.PERMISSIONS.map(permission => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = permission.key;
      input.checked = Array.isArray(profile.permissions) && profile.permissions.includes(permission.key);
      const text = document.createElement('span');
      text.textContent = permission.label;
      label.append(input, text);
      permissionList.append(label);
      return input;
    });
    const permissionHelp = document.createElement('small');
    permissionHelp.textContent = '管理員角色自動擁有全部權限。';
    permissionList.append(permissionHelp);
    permissionsDetails.append(permissionList);
    roleSelect.addEventListener('change', () => {
      permissionInputs.forEach(input => { input.disabled = roleSelect.value === 'administrator'; });
      permissionsSummary.textContent = roleSelect.value === 'administrator'
        ? '管理員（全部權限）'
        : `權限（${permissionInputs.filter(input => input.checked).length}）`;
    });
    roleSelect.dispatchEvent(new Event('change'));
    permissionInputs.forEach(input => input.addEventListener('change', () => {
      permissionsSummary.textContent = `權限（${permissionInputs.filter(item => item.checked).length}）`;
    }));
    permissionsCell.append(permissionsDetails);
    row.append(permissionsCell);

    const numberCell = document.createElement('td');
    const screenerNumber = document.createElement('input');
    screenerNumber.type = 'text';
    screenerNumber.maxLength = 80;
    screenerNumber.autocomplete = 'off';
    screenerNumber.value = profile.screener_number || '';
    screenerNumber.setAttribute('aria-label', `${profile.nickname || profile.email} 的篩檢員編號`);
    numberCell.append(screenerNumber);
    row.append(numberCell);

    const actionCell = document.createElement('td');
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'admin-button staff-save-button';
    saveButton.textContent = '儲存';
    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true;
      showStatus(`正在更新 ${profile.nickname || profile.email}。`);
      const { error } = await client.rpc('admin_update_staff_profile', {
        target_user_id: profile.user_id,
        target_status: statusSelect.value,
        target_role: roleSelect.value,
        target_permissions: permissionInputs.filter(input => input.checked).map(input => input.value),
        target_screener_number: screenerNumber.value.trim()
      });
      saveButton.disabled = false;
      if (error) {
        const message = error.message.includes('privacy consent')
          ? '此帳號尚未完成個資同意，完成前不能核准。'
          : error.message.includes('At least one active staff manager')
            ? '至少須保留一位有效的帳號管理員。'
            : error.message.includes('unique') || error.code === '23505'
              ? '此篩檢員編號已由其他帳號使用。'
              : '更新失敗，請確認狀態與權限設定後重試。';
        showStatus(message, true);
        return;
      }
      showStatus('工作人員帳號已更新。');
      document.dispatchEvent(new CustomEvent('staff-profile-refresh'));
    });
    actionCell.append(saveButton);
    row.append(actionCell);
    return row;
  }

  function createSelect(options, value) {
    const select = document.createElement('select');
    options.forEach(([optionValue, label]) => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = label;
      select.append(option);
    });
    select.value = value;
    return select;
  }

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
    status.hidden = false;
  }
});