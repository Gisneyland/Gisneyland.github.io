const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/js/screening-plan-model.js');
const F = require('../assets/js/admin-response-format.js');

const place = (label, coordinates = [25.04, 121.51]) => ({ label, coordinates });
const rule = (overrides) => ({
  frequency: 'weekly', weekdays: [5], startTime: '18:00', endTime: '21:00', place: place('A'), ...overrides
});
// Friday 2026-03-06 19:00 Taipei
const friday = (hour = '19', minute = '00') => ({ year: '2026', month: '03', day: '06', hour, minute });

test('getNextScreeningSlot picks today while a rule is still running, else the next matching day', () => {
  const preferences = { rules: [rule({ name: '週五場' })] };
  assert.equal(M.getNextScreeningSlot(preferences, friday()).dateKey, '2026-03-06');
  assert.equal(M.getNextScreeningSlot(preferences, friday('21', '00')).dateKey, '2026-03-13');
});

test('getNextScreeningSlot ignores invalid rules and supports last-week-of-month rules', () => {
  assert.equal(M.getNextScreeningSlot({ rules: [rule({ startTime: '21:00', endTime: '18:00' })] }, friday()), null);
  assert.equal(M.getNextScreeningSlot({ rules: [rule({ place: { label: 'A', coordinates: [1] } })] }, friday()), null);
  const last = { rules: [{ ...rule({}), frequency: 'monthly', weekday: 5, ordinal: -1 }] };
  assert.equal(M.getNextScreeningSlot(last, friday()).dateKey, '2026-03-27');
});

test('findScreeningPlanConflict reports overlaps at different places only', () => {
  const overlapping = [rule({}), rule({ startTime: '20:00', endTime: '22:00', place: place('B', [24.99, 121.3]) })];
  const conflict = M.findScreeningPlanConflict(overlapping, friday());
  assert.equal(conflict.startTime, '20:00');
  assert.equal(conflict.endTime, '21:00');
  assert.equal(M.findScreeningPlanConflict([rule({}), rule({ startTime: '20:00', endTime: '22:00' })], friday()), null);
  assert.equal(M.findScreeningPlanConflict([rule({}), rule({ startTime: '21:00', endTime: '22:00', place: place('B') })], friday()), null);
});

test('Taipei date helpers round-trip and reject malformed input', () => {
  const stamp = M.parseTaipeiDateTime('2026-03-06T19:00');
  assert.equal(M.formatTaipeiDateTime(stamp), '2026-03-06T19:00');
  assert.equal(M.parseTaipeiDateTime('2026-03-06T19:00', true) - stamp, 59000);
  assert.equal(M.parseTaipeiDateTime('2026-03-06'), null);
});

test('distance and place normalisation helpers', () => {
  assert.ok(Math.abs(M.distanceBetweenKm(25.0478, 121.5170, 24.1477, 120.6736) - 130) < 5);
  assert.equal(M.distanceBetweenKm(1, 1, 1, 1), 0);
  assert.equal(M.normalizePlace(' Ｔａｉｐｅｉ，　Ｃｉｔｙ。'), 'taipeicity');
});

test('csvCell quotes and neutralises spreadsheet formulas', () => {
  assert.equal(F.csvCell('a"b'), '"a""b"');
  assert.equal(F.csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(F.csvCell(' \t@x'), '"\' \t@x"');
});
