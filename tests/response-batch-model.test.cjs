const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/js/response-batch-model.js');
const format = require('../assets/js/admin-response-format.js');

test('chunk splits into fixed-size batches', () => {
  assert.deepEqual(model.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(model.chunk([]), []);
});

test('parseCsv handles BOM, quotes, embedded commas and newlines', () => {
  const rows = model.parseCsv('\uFEFFa,b\r\n"x, y","line1\nline2 ""q"""\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'line1\nline2 "q"']]);
});

test('buildImportRecords maps keys, labels and values, and reports bad rows', () => {
  const table = model.parseCsv([
    'status,screener,篩檢日期,screening_interpretation,anonymous_consult_code,screening_photos,未知欄位',
    'submitted,A001,2026-11-04,HIV 陰性|梅毒陽性,123456,x/y.jpg,1',
    'submitted,,2026-11-04,,,,',
    'draft,,,,,,',
    'submitted,A002,2026-11-04,,bad code!,,',
    'weird,A003,,,,,'
  ].join('\n'));
  const { records, errors, ignoredHeaders } = model.buildImportRecords(table, format);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].response_data, {
    screener: 'A001', screening_at: '2026-11-04', screening_interpretation: ['hiv_negative', 'syphilis_positive'], anonymous_consult_code: '123456'
  });
  assert.equal(records[0].anonymous_consult_code, '123456');
  assert.deepEqual(errors.map(item => item.line), [3, 5, 6]);
  assert.deepEqual(ignoredHeaders, ['未知欄位']);
});

test('buildImportRecords enforces the row limit and header presence', () => {
  assert.equal(model.buildImportRecords([['screener']], format).errors.length, 1);
  assert.equal(model.buildImportRecords([['screener'], ['a'], ['b']], format, { maxRows: 1 }).records.length, 0);
});

test('collectPhotoPaths ignores unsafe paths and duplicates', () => {
  const paths = model.collectPhotoPaths([
    { response_data: { screening_photos: { hiv: 'a/hiv.jpg', syphilis: '../x' } } },
    { response_data: { screening_photos: { hiv: 'a/hiv.jpg' } } },
    { response_data: {} }
  ]);
  assert.deepEqual(paths, ['a/hiv.jpg']);
});

test('import reverses exported nationalities and date values', () => {
  const headers = ['screener', 'nationality', 'screening_at', 'last_screening_at', 'hiv_positive_appointment'];
  const original = ['A001', ['TW', 'US'], '2026-11-04', '2025-03', '2026-11-04T09:30'];
  const exported = original.map((value, index) => format.formatResponseValue(headers[index], value));
  const result = model.buildImportRecords([headers, exported, ['A002', 'TW', '', '', ''], ['A003', '不存在', '', '', '']], format);
  assert.deepEqual(result.records.map(record => record.response_data), [
    { screener: 'A001', nationality: ['TW', 'US'], screening_at: '2026-11-04', last_screening_at: '2025-03', hiv_positive_appointment: '2026-11-04T09:30' },
    { screener: 'A002', nationality: ['TW'] }
  ]);
  assert.equal(result.errors[0].line, 4);
  assert.match(result.errors[0].reason, /國籍/);
});

test('blocked fields are ignored after resolving Chinese and grouped headers', () => {
  const result = model.buildImportRecords([
    ['screener', 'screening_photos', '陽性試劑照片', '篩檢結果與陽性轉介 - 陽性試劑照片'],
    ['A001', 'one', 'two', 'three']
  ], format);
  assert.deepEqual(result.records[0].response_data, { screener: 'A001' });
});
