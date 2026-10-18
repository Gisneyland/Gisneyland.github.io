const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'staff-access.js'), 'utf8'),
  context
);
const { PERMISSIONS, canAccess, signupErrorMessage, otpErrorMessage, requestEmailOtp, verifyEmailOtp, sendStaffInvitation } = context.StaffAccess;

const approvedProfile = {
  approval_status: 'approved',
  account_role: 'screener',
  permissions: ['questionnaire.read'],
  privacy_consent_at: '2026-10-18T00:00:00Z'
};

test('only approved staff with recorded privacy consent receive assigned access', () => {
  assert.equal(canAccess(approvedProfile, 'questionnaire.read'), true);
  assert.equal(canAccess(approvedProfile, 'site_content.manage'), false);
  assert.equal(canAccess({ ...approvedProfile, approval_status: 'pending' }, 'questionnaire.read'), false);
  assert.equal(canAccess({ ...approvedProfile, privacy_consent_at: null }, 'questionnaire.read'), false);
});

test('administrators receive all known permissions after approval and consent', () => {
  const administrator = { ...approvedProfile, account_role: 'administrator', permissions: [] };
  for (const { key } of PERMISSIONS) assert.equal(canAccess(administrator, key), true);
});

test('unknown roles and malformed permission lists are denied', () => {
  assert.equal(canAccess({ ...approvedProfile, account_role: 'unknown' }, 'questionnaire.read'), false);
  assert.equal(canAccess({ ...approvedProfile, permissions: 'questionnaire.read' }, 'questionnaire.read'), false);
});

test('signup errors explain duplicate accounts, throttling, and database trigger failures', () => {
  assert.match(signupErrorMessage({ code: 'user_already_exists' }), /已在系統中註冊/);
  assert.match(signupErrorMessage({ code: 'over_email_send_rate_limit' }), /稍後再試/);
  assert.match(signupErrorMessage({ message: 'Database error saving new user', code: 'unexpected_failure' }), /錯誤代碼 unexpected_failure/);
  assert.match(signupErrorMessage({ message: 'A valid staff nickname is required' }), /有效暱稱/);
});

test('OTP errors explain email confirmation, throttling, and invalid codes', () => {
  assert.match(otpErrorMessage({ code: 'email_not_confirmed' }), /尚未完成驗證/);
  assert.match(otpErrorMessage({ code: 'over_email_send_rate_limit' }), /稍後再試/);
  assert.match(otpErrorMessage({ message: 'Token has expired' }, true), /錯誤或已過期/);
});

test('email OTP sends only to existing users and verifies with email OTP type', async () => {
  const calls = [];
  const client = { auth: {
    signInWithOtp: async options => { calls.push(['send', options]); return { error: null }; },
    verifyOtp: async options => { calls.push(['verify', options]); return { error: null }; }
  } };
  await requestEmailOtp(client, ' staff@example.org ', 'https://example.org/admin/');
  await verifyEmailOtp(client, ' staff@example.org ', ' 123456 ');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['send', {
    email: 'staff@example.org',
    options: { shouldCreateUser: false, emailRedirectTo: 'https://example.org/admin/' }
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), ['verify', { email: 'staff@example.org', token: '123456', type: 'email' }]);
});

test('staff invitations call the protected function with normalized email and nickname', async () => {
  const calls = [];
  const client = { functions: {
    invoke: async (...args) => { calls.push(args); return { data: { code: 'invitation_sent' }, error: null }; }
  } };
  await sendStaffInvitation(client, ' Staff@Example.org ', ' Staff One ');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[ 'invite-staff', {
    body: { email: 'staff@example.org', nickname: 'Staff One' }
  } ]]);
});