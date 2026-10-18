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
const { PERMISSIONS, canAccess } = context.StaffAccess;

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