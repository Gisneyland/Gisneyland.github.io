const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/main.js'), 'utf8');
const photoCode = source.slice(source.indexOf('function initializeScreeningPhotos()'),
  source.indexOf('function validateScreeningInterpretation('));

function client(overrides = {}) {
  const draws = [];
  const urls = [];
  let closed = false;
  const canvas = {
    getContext: () => ({ fillRect() {}, drawImage: (...args) => draws.push(args), fillStyle: '' }),
    toBlob(callback, type) { callback(new Blob(['photo'], { type })); }
  };
  const context = vm.createContext({
    Blob,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: url => urls.push(url) },
    createImageBitmap: async () => ({ width: 4000, height: 3000, close() { closed = true; } }),
    document: { createElement: () => canvas },
    ...overrides
  });
  vm.runInContext(`
    const screeningPhotos = new Map();
    const screeningPhotoJobs = new Map();
    const screeningPhotoErrors = new Set();
    const maxScreeningPhotoBytes = 500_000;
    ${photoCode}
  `, context);
  return { context, canvas, draws, urls, closed: () => closed,
    compress: file => context.compressScreeningPhoto(file) };
}

const input = { type: 'image/jpeg', size: 10_000_000 };

test('photos become bounded JPEGs with preserved aspect ratio and released bitmap', async () => {
  const fixture = client();
  const blob = await fixture.compress(input);
  assert.equal(blob.type, 'image/jpeg');
  assert.ok(blob.size <= 500_000);
  assert.deepEqual(fixture.draws[0].slice(3), [1280, 960]);
  assert.equal(fixture.closed(), true);
  assert.equal(fixture.canvas.width, 1);
});

test('quality reduction is followed by resizing if the byte cap is still exceeded', async () => {
  const fixture = client();
  let attempts = 0;
  fixture.canvas.toBlob = (callback, type) => {
    attempts += 1;
    callback(new Blob([new Uint8Array(attempts <= 3 ? 500_001 : 500_000)], { type }));
  };
  assert.equal((await fixture.compress(input)).size, 500_000);
  assert.equal(attempts, 4);
  assert.deepEqual(fixture.draws.map(draw => draw.slice(3)), [[1280, 960], [960, 720]]);
});

test('small photos are not enlarged; invalid inputs and encoder failure are rejected', async () => {
  const fixture = client({ createImageBitmap: async () => ({ width: 100, height: 50 }) });
  await fixture.compress(input);
  assert.deepEqual(fixture.draws[0].slice(3), [100, 50]);
  await assert.rejects(fixture.compress({ type: 'text/plain', size: 1 }), /圖片/);
  await assert.rejects(fixture.compress({ ...input, size: 25_000_001 }), /過大/);
  fixture.canvas.toBlob = callback => callback(null);
  await assert.rejects(fixture.compress(input), /無法壓縮/);
});

test('uncompressible images fail without leaking decoded image resources', async () => {
  const fixture = client();
  fixture.canvas.toBlob = (callback, type) =>
    callback(new Blob([new Uint8Array(500_001)], { type }));
  await assert.rejects(fixture.compress(input), /過大/);
  assert.equal(fixture.closed(), true);
  assert.ok(fixture.draws.length > 1);
  assert.ok(fixture.draws.length < 10);
});

test('image-element fallback supports browsers without bitmap decoding and revokes URLs', async () => {
  class Image {
    width = 800;
    height = 600;
    set src(value) { this.onload(); }
  }
  const fixture = client({ createImageBitmap: undefined, Image });
  await fixture.compress(input);
  assert.deepEqual(fixture.draws[0].slice(3), [800, 600]);
  assert.deepEqual(fixture.urls, ['blob:test']);
  const failed = client({
    createImageBitmap: undefined,
    Image: class { set src(value) { this.onerror(); } }
  });
  await assert.rejects(failed.compress(input), /格式無法處理/);
  assert.deepEqual(failed.urls, ['blob:test']);
});

test('clear, replace, hide and reset invalidate pending photo work', async () => {
  const listeners = {};
  const formListeners = {};
  const elements = Object.fromEntries(['input', 'pick', 'clear', 'preview', 'image', 'status']
    .map(name => [name, {
      value: '', hidden: true, files: [input],
      addEventListener(type, callback) { listeners[`${name}:${type}`] = callback; },
      removeAttribute() {}, click() {}
    }]));
  const field = {
    dataset: { photoKind: 'hiv', photoRequires: 'hiv_positive' },
    querySelector(selector) { return elements[selector.match(/data-photo-(\w+)/)[1]]; }
  };
  const trigger = { checked: true };
  const form = {
    querySelector: () => trigger,
    addEventListener(type, callback) { formListeners[type] = callback; }
  };
  const fixture = client({
    document: { getElementById: () => form, querySelectorAll: () => [field] },
    window: { setTimeout: callback => callback() }
  });
  const completions = [];
  fixture.context.compressScreeningPhoto = () => new Promise(resolve => completions.push(resolve));
  fixture.context.initializeScreeningPhotos();
  const change = () => listeners['input:change']();
  const count = expression => vm.runInContext(expression, fixture.context);
  const old = change();
  assert.equal(count('screeningPhotoJobs.size'), 1);
  assert.equal(elements.preview.hidden, false);
  assert.equal(elements.image.hidden, true);
  const recent = change();
  completions[0](new Blob(['old']));
  await old;
  assert.equal(count('screeningPhotos.size'), 0);
  completions[1](new Blob(['new']));
  await recent;
  assert.equal(count('screeningPhotos.size'), 1);
  assert.equal(count('screeningPhotoJobs.size'), 0);
  for (const cancel of [
    () => listeners['clear:click'](),
    () => { trigger.checked = false; formListeners.change({ target: { matches: () => true } }); },
    () => formListeners.reset()
  ]) {
    const pending = change();
    cancel();
    completions.at(-1)(new Blob(['stale']));
    await pending;
    assert.equal(count('screeningPhotos.size'), 0);
    assert.equal(count('screeningPhotoJobs.size'), 0);
  }
  fixture.context.compressScreeningPhoto = async () => { throw new Error('Unsupported image'); };
  await change();
  assert.equal(count('screeningPhotoErrors.size'), 1);
  assert.equal(elements.preview.hidden, false);
  assert.equal(elements.image.hidden, true);
  listeners['clear:click']();
  assert.equal(count('screeningPhotoErrors.size'), 0);
  assert.equal(elements.preview.hidden, true);
});

function server({ uploadFailure = false, insertFailure = false } = {}) {
  const uploads = [];
  const removals = [];
  const inserts = [];
  const bucket = {
    async upload(...args) {
      uploads.push(args);
      return { error: uploadFailure && uploads.length === 2 ? new Error('offline') : null };
    },
    async remove(paths) { removals.push([...paths]); return { error: null }; }
  };
  let handler;
  const context = vm.createContext({
    Deno: { env: { get: () => undefined }, serve(callback) { handler = callback; } },
    createClient: () => ({
      storage: { from(name) { assert.equal(name, 'screening-test-photos'); return bucket; } },
      from: () => ({ async insert(payload) {
        inserts.push(payload);
        return { error: insertFailure ? new Error('offline') : null };
      } })
    }),
    console: { error() {} }, crypto, File, Uint8Array, Response
  });
  const code = fs.readFileSync(path.join(root, 'supabase/functions/submit-questionnaire/index.ts'), 'utf8')
    .replace(/^import[^\n]*\n/, '');
  vm.runInContext(stripTypeScriptTypes(code), context);
  return { handler, uploads, removals, inserts };
}

function request(secondPhoto = new File([new Uint8Array([255, 216, 255, 0])], 'second.jpg')) {
  const form = new FormData();
  form.append('payload', JSON.stringify({
    response_data: { screener: 'TEST', screening_interpretation: ['hiv_positive', 'syphilis_positive'] },
    language: 'zh-TW', schema_version: 1
  }));
  form.append('photo_hiv', new File([new Uint8Array([255, 216, 255, 0])], 'first.jpg'));
  form.append('photo_syphilis', secondPhoto);
  return new Request('https://example.test', {
    method: 'POST', body: form, headers: { 'content-length': '1000' }
  });
}

test('all photos are validated before any upload, avoiding partial-validation orphans', async () => {
  const fixture = server();
  const response = await fixture.handler(request(new File(['invalid'], 'bad.jpg')));
  assert.equal(response.status, 400);
  assert.equal(fixture.uploads.length, 0);
  assert.equal(fixture.inserts.length, 0);
});

test('successful uploads remain private, non-overwriting, uncached and referenced by paths', async () => {
  const fixture = server();
  assert.equal((await fixture.handler(request())).status, 201);
  assert.equal(fixture.uploads.length, 2);
  assert.equal(fixture.removals.length, 0);
  for (const [name, bytes, options] of fixture.uploads) {
    assert.match(name, /^[0-9a-f-]{36}\/(hiv|syphilis)\.jpg$/);
    assert.equal(bytes.length, 4);
    assert.deepEqual({ ...options }, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
  }
  assert.equal(fixture.inserts[0].response_data.screening_photos.hiv, fixture.uploads[0][0]);
});

test('upload and database failures clean up previously uploaded objects', async () => {
  for (const options of [{ uploadFailure: true }, { insertFailure: true }]) {
    const fixture = server(options);
    assert.equal((await fixture.handler(request())).status, 500);
    assert.deepEqual(fixture.removals[0], fixture.uploads
      .slice(0, options.uploadFailure ? 1 : 2).map(upload => upload[0]));
  }
});
