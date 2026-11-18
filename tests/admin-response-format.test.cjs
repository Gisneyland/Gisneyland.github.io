const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../assets/js/admin-response-format.js');

test('formats scalar, boolean, list and referral values for display', () => {
  assert.equal(F.formatResponseValue('gender', 'transman'), '跨性別男性');
  assert.equal(F.formatResponseValue('agreement', 'yes'), '是');
  assert.equal(F.formatResponseValue('std_aids', true), '是');
  assert.equal(F.formatResponseValue('screening_at', '2026-03-05'), '2026年3月5日');
  assert.equal(F.formatResponseValue('last_screening_at', '2026-03'), '2026年3月');
  assert.equal(F.formatResponseValue('hiv_positive_appointment', '2026-03-05T09:30'), '2026年3月5日 09:30');
  assert.equal(F.formatResponseValue('screening_photos', { hiv: 'a.jpg' }), 'HIV 陽性試劑照片');
  assert.equal(
    F.formatResponseValue('hiv_positive_contacts', [{ type: 'phone', phone_kind: 'mobile', value: '0912' }, { type: 'line', value: 'abc' }, { type: 'email' }]),
    '手機：0912；LINE：abc'
  );
  assert.equal(F.formatResponseValue('screening_interpretation', ['hiv_negative', 'syphilis_positive']), 'HIV 陰性、梅毒陽性');
});

test('hasResponseValue and escapeHtml keep their edge cases', () => {
  assert.deepEqual([[], '  ', null, undefined, 0, false].map(F.hasResponseValue), [false, false, false, false, true, true]);
  assert.equal(F.escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
  assert.equal(F.humanizeFieldName('hiv_positive_notes'), 'Hiv Positive Notes');
});

test('every displayed field has a label and conditional children are displayed fields', () => {
  const grouped = new Set(F.RESPONSE_DETAIL_GROUPS.flatMap((group) => group.fields));
  for (const field of grouped) assert.ok(F.RESPONSE_FIELD_LABELS[field], `${field} has no label`);
  for (const group of F.RESPONSE_CONDITIONAL_GROUPS) {
    assert.ok(grouped.has(group.parent), group.parent);
    group.children.forEach((child) => assert.ok(grouped.has(child), child));
  }
});

test('admin.js no longer redefines the extracted formatting helpers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/admin.js'), 'utf8');
  assert.doesNotMatch(source, /function (?:formatResponseValue|formatResponseScalar|escapeHtml|hasResponseValue|csvCell|getNextScreeningSlot|findScreeningPlanConflict|getTaipeiParts|distanceBetweenKm)\b/);
  assert.doesNotMatch(source, /^const RESPONSE_(?:DETAIL_GROUPS|FIELD_LABELS|VALUE_LABELS)\b/m);
});
