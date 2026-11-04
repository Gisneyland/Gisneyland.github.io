const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/js/external-tasks-model.js');

const links = [
  { id: 'a', kind: 'nationality_questionnaire', nationality: 'TH', label: '泰國問卷 2026', url: 'https://example.com/th' },
  { id: 'b', kind: 'nationality_questionnaire', nationality: 'th', label: '泰國問卷 B', url: 'https://example.com/th2' },
  { id: 'c', kind: 'nationality_questionnaire', nationality: 'JP', label: '日本問卷', url: 'https://example.com/jp' },
  { id: 'd', kind: 'agency_site', match_keywords: [], label: '疾管署', url: 'https://example.com/cdc' },
  { id: 'e', kind: 'agency_site', match_keywords: ['新竹市'], label: '新竹市衛生局', url: 'https://example.com/hc' },
  { id: 'f', kind: 'agency_site', match_keywords: ['台北市'], label: '台北市衛生局', url: 'https://example.com/tp' }
];

test('tasks follow every nationality, multiple links and place keywords', () => {
  const response = { status: 'submitted', response_data: { nationality: ['TH', 'JP', 'TW'], screening_place: '新竹市東區某處' } };
  const tasks = model.getTasks(response, links);
  assert.deepEqual(tasks.map(task => task.link.id), ['a', 'b', 'c', 'd', 'e']);
});

test('progress is tracked per link and drafts have no tasks', () => {
  const response = { status: 'submitted', task_progress: { a: { done_at: 'now' } }, response_data: { nationality: 'TH', screening_place: 'x' } };
  const tasks = model.getTasks(response, links);
  assert.deepEqual(model.summarize(tasks), { total: 3, done: 1, pending: 2 });
  assert.deepEqual(model.getTasks({ ...response, status: 'draft' }, links), []);
  assert.deepEqual(Object.keys(model.setDone(response.task_progress, 'b', true, 'now', 'u')), ['a', 'b']);
  assert.deepEqual(model.setDone(response.task_progress, 'a', false), {});
});

test('only http(s) urls are accepted', () => {
  assert.equal(model.isSafeUrl('https://example.com/x'), true);
  assert.equal(model.isSafeUrl('javascript:alert(1)'), false);
});
