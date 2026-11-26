const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Model = require('../assets/js/response-batch-model.js');
const format = require('../assets/js/admin-response-format.js');

function setup(storage = new Map()) {
  const ids = ['import-responses-button', 'delete-responses-button', 'response-import-dialog',
    'response-import-form', 'response-import-file', 'response-import-submit', 'response-import-scope',
    'response-import-errors', 'response-import-status', 'response-import-close', 'response-import-template',
    'response-photo-cleanup', 'response-photo-cleanup-paths', 'response-photo-cleanup-retry'];
  const elements = Object.fromEntries(ids.map(id => [id, {
    listeners: {}, files: [], addEventListener(type, handler) { this.listeners[type] = handler; },
    replaceChildren(...children) { this.children = children; }, reset() {}, showModal() { this.open = true; }, close() {}
  }]));
  const window = {
    ResponseBatchModel: Model,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    prompt: () => '刪除',
    SiteData: { responses: {} }
  };
  const document = { getElementById: id => elements[id], createElement: () => ({}) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/admin-response-batch.js'), 'utf8'), { window, document });
  const statuses = [];
  let selected = [];
  const controller = window.AdminResponseBatch.init({
    format, getSelectedResponses: () => selected, onDeleted: () => {}, onImported: () => {},
    statusElement: {}, showStatus: (_, message, error) => statuses.push({ message, error })
  });
  controller.setEnabled(true);
  return { elements, window, storage, statuses, select: value => { selected = value; } };
}

test('out-of-order file reads cannot replace the selected import', async () => {
  const { elements } = setup();
  const input = elements['response-import-file'];
  let resolveFirst;
  const first = { text: () => new Promise(resolve => { resolveFirst = resolve; }) };
  const second = { text: async () => 'screener\nB001\nB002' };
  input.files = [first];
  const pending = input.listeners.change();
  input.files = [second];
  await input.listeners.change();
  resolveFirst('screener\nA001');
  await pending;
  assert.match(elements['response-import-scope'].textContent, /可匯入 2 筆/);
});

test('deletion uses returned photos, retains failed paths across reload and retries', async () => {
  const context = setup();
  const { elements, window, storage, statuses } = context;
  context.select([{ id: '1', response_data: { screening_photos: { hiv: 'old.jpg' } } }]);
  window.SiteData.responses.deleteMany = async () => ({
    data: [{ id: '1', response_data: { screening_photos: { hiv: 'new.jpg' } } }], error: null
  });
  let attempted;
  window.SiteData.responses.removePhotos = async (_, paths) => { attempted = [...paths]; return { error: { message: 'denied' } }; };
  await elements['delete-responses-button'].listeners.click();
  assert.deepEqual(attempted, ['new.jpg']);
  assert.match(statuses.at(-1).message, /照片刪除未完成/);
  assert.equal(elements['response-photo-cleanup-paths'].value, 'new.jpg');

  const reloaded = setup(storage);
  assert.equal(reloaded.elements['response-photo-cleanup-paths'].value, 'new.jpg');
  reloaded.window.SiteData.responses.removePhotos = async (_, paths) => {
    assert.deepEqual([...paths], ['new.jpg']);
    return { error: null };
  };
  await reloaded.elements['response-photo-cleanup-retry'].listeners.click();
  assert.equal(reloaded.elements['response-photo-cleanup'].hidden, true);
  assert.equal(storage.get('response-batch-pending-photos'), '[]');
});

test('thrown storage errors remain retryable even when browser storage fails', async () => {
  const context = setup();
  context.window.localStorage.setItem = () => { throw new Error('unavailable'); };
  context.select([{ id: '1' }]);
  context.window.SiteData.responses.deleteMany = async () => ({
    data: [{ id: '1', response_data: { screening_photos: { hiv: 'photo.jpg' } } }]
  });
  context.window.SiteData.responses.removePhotos = async () => { throw new Error('offline'); };
  await context.elements['delete-responses-button'].listeners.click();
  assert.match(context.statuses.at(-1).message, /複製待清理路徑/);
  assert.equal(context.elements['response-photo-cleanup-paths'].value, 'photo.jpg');
});
