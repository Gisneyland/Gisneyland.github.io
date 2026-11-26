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
