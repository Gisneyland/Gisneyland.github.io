const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/js/cdc-upload-model.js');

const base = { screening_at: '2026-11-03', screening_place: 'OO三溫暖', screening_interpretation: ['hiv_negative'] };
const options = { unit: 'cdc', screeningUnitCode: '9801181045', method: 'initial', initialItem: 3, cooperation: '' };

test('upload state follows draft, code and per-code upload progress', () => {
  assert.equal(model.getUploadState({ status: 'draft' }).key, 'draft');
  assert.equal(model.getUploadState({ status: 'submitted' }).key, 'needs-code');
  const response = {
    status: 'submitted',
    anonymous_consult_code: '123456,654321',
    consult_uploads: [
      { code: '123456', unit: 'cdc', uploaded_at: '2026-11-04T00:00:00Z' },
      { code: '654321', unit: 'local', uploaded_at: null }
    ]
  };
  const state = model.getUploadState(response);
  assert.equal(state.key, 'needs-upload');
  assert.equal(model.stateLabel(state), '待上傳串接：地方衛生局');
  response.consult_uploads[1].uploaded_at = '2026-11-04T01:00:00Z';
  assert.equal(model.getUploadState(response).key, 'uploaded');
});

test('codes without upload records default to the CDC and stay pending', () => {
  const [entry] = model.getCodeEntries({ anonymous_consult_code: '123456' });
  assert.deepEqual([entry.unit, entry.uploaded_at], ['cdc', null]);
});

test('import rows are per code, per unit, and skip uploaded or invalid entries', () => {
  const responses = [
    { id: 1, status: 'submitted', anonymous_consult_code: 'E123456,222222', consult_uploads: [{ code: '222222', unit: 'local' }], response_data: base },
    { id: 2, status: 'submitted', anonymous_consult_code: '333333', consult_uploads: [{ code: '333333', unit: 'cdc', uploaded_at: 'x' }], response_data: base },
    { id: 3, status: 'submitted', anonymous_consult_code: 'ABC', response_data: base },
    { id: 4, status: 'submitted', anonymous_consult_code: '444444', response_data: { ...base, screening_interpretation: [] } }
  ];
  const { rows, skipped } = model.buildImportRows(responses, options);
  assert.deepEqual(rows.map(row => row.cells.A), ['123456']);
  assert.equal(rows[0].cells.E, 46329);
  assert.equal(rows[0].cells.L, 0);
  assert.equal(skipped.length, 2);
  assert.equal(model.buildImportRows(responses, { ...options, unit: 'local' }).rows[0].cells.A, '222222');
  assert.equal(model.buildImportRows(responses, { ...options, includeUploaded: true }).rows.length, 2);
});

test('rapid tests fill the rapid columns only, and files are capped at 500 rows', () => {
  const { rows } = model.buildImportRows([{ id: 1, anonymous_consult_code: '123456', response_data: { ...base, hiv_window_period: '1_month', screening_interpretation: ['hiv_positive'] } }],
    { ...options, method: 'rapid', told: 1 });
  assert.deepEqual([rows[0].cells.F, rows[0].cells.H, rows[0].cells.I, rows[0].cells.J, rows[0].cells.K, rows[0].cells.L], ['1', '4', 1, '1', '', '']);
  assert.deepEqual(model.chunkRows(Array(1001).fill(0)).map(chunk => chunk.length), [500, 500, 1]);
});

test('markUploaded only touches the exported codes for that unit', () => {
  const response = { anonymous_consult_code: '111111,222222', consult_uploads: [{ code: '222222', unit: 'local' }] };
  const next = model.markUploaded(response, ['111111', '222222'], 'cdc', 'now', 'u1');
  assert.equal(next.find(item => item.code === '111111').uploaded_at, 'now');
  assert.equal(next.find(item => item.code === '222222').uploaded_at, null);
});

test('site category uses the configured institutions and rapid item follows the window period', () => {
  const institutions = [{ name: '財團法人台灣紅絲帶基金會', aliases: ['紅絲帶基金會'] }, { name: '風城部屋' }, { name: '諸羅部屋' }];
  assert.equal(model.siteCategory('紅絲帶基金會（台北）', institutions), 1);
  assert.equal(model.siteCategory('風城部屋', institutions), 1);
  assert.equal(model.siteCategory('諸羅部屋 ', institutions), 1);
  assert.equal(model.siteCategory('竹螺單位', institutions), 7);
  assert.equal(model.siteCategory('風城部屋', []), 7);
  const withAddress = [{ name: '新據點', address: '新竹市東區民族路 25 號 6 樓' }];
  assert.equal(model.siteCategory('新竹市東區民族路25號6樓', withAddress), 1);
  assert.equal(model.siteCategory('某店（新竹市東區民族路 25 號 6 樓）', withAddress), 1);
  assert.equal(model.siteCategory('民族路 25 號 6 樓', withAddress), 1);
  assert.equal(model.siteCategory('民族路', withAddress), 7);
  assert.equal(model.siteCategory('新竹市北區中正路 1 號', withAddress), 7);
  assert.equal(model.rapidItem('1_month'), 4);
  assert.equal(model.rapidItem('3_months'), 5);
  const rapid = { ...options, method: 'rapid', told: 1, institutions };
  const make = (place, windowPeriod) => ({ id: 1, anonymous_consult_code: '123456', response_data: { ...base, screening_place: place, hiv_window_period: windowPeriod } });
  const ok = model.buildImportRows([make('風城部屋', '3_months')], rapid).rows[0].cells;
  assert.deepEqual([ok.C, ok.H], ['1', '5']);
  assert.equal(model.buildImportRows([make('OO寺', undefined)], rapid).skipped.length, 1);
});

test('local codes carry a bureau, export and marking respect it, and labels use bureau names', () => {
  const bureaus = [{ id: 'b1', name: '新竹市衛生局' }, { id: 'b2', name: '桃園市衛生局' }];
  const response = {
    id: 1, status: 'submitted', anonymous_consult_code: '111111,222222,333333', response_data: base,
    consult_uploads: [
      { code: '111111', unit: 'local', bureau_id: 'b1' },
      { code: '222222', unit: 'local', bureau_id: 'b2' },
      { code: '333333', unit: 'local', bureau_id: 'gone' }
    ]
  };
  const local = { ...options, unit: 'local' };
  assert.deepEqual(model.buildImportRows([response], { ...local, bureauId: 'b1' }).rows.map(row => row.cells.A), ['111111']);
  assert.equal(model.buildImportRows([response], local).rows.length, 3);
  const next = model.markUploaded(response, ['111111', '222222'], 'local', 'now', 'u1', 'b1');
  assert.deepEqual(next.map(item => Boolean(item.uploaded_at)), [true, false, false]);
  assert.equal(model.getCodeEntries(response).map(entry => model.unitLabel(entry, bureaus)).join('|'), '新竹市衛生局|桃園市衛生局|地方衛生局（已刪除）');
  assert.equal(model.stateLabel(model.getUploadState(response), bureaus), '待上傳串接：新竹市衛生局、桃園市衛生局、地方衛生局（已刪除）');
});
