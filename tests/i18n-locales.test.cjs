const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, '_data/i18n.json'), 'utf8'));

function loadI18n(fetchLocale) {
  const appended = [];
  const context = vm.createContext({
    URL,
    document: {
      currentScript: { src: 'https://site.example/assets/js/i18n.js?v=abc' },
      baseURI: 'https://site.example/',
      createElement: () => ({}),
      head: { append(script) { appended.push(script); queueMicrotask(() => fetchLocale(script, context)); } },
      querySelectorAll: () => []
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8') + '\nthis.api = { i18n, loadLocale, localeOrder };', context);
  return { api: context.api, appended };
}

test('generated locale files are up to date', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/build-i18n.cjs'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('every locale file defines every key', () => {
  for (const locale of data.locales) {
    const context = vm.createContext({ i18n: {} });
    vm.runInContext(fs.readFileSync(path.join(root, `assets/js/i18n/${locale}.js`), 'utf8'), context);
    assert.deepEqual(Object.keys(context.i18n[locale]), Object.keys(data.rows), locale);
  }
});

test('loadLocale fetches a locale once, with the cache-busting query', async () => {
  const { api, appended } = loadI18n((script, context) => {
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/i18n/en.js'), 'utf8'), context);
    script.onload();
  });
  const [first, second] = await Promise.all([api.loadLocale('en'), api.loadLocale('en')]);
  assert.ok(first && second);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, 'https://site.example/assets/js/i18n/en.js?v=abc');
  assert.equal(api.i18n.en.language, 'Language');
  assert.equal(await api.loadLocale('en'), true);
  assert.equal(appended.length, 1);
});

test('loadLocale rejects unknown locales and recovers from load errors', async () => {
  let fail = true;
  const { api } = loadI18n((script, context) => {
    if (fail) return script.onerror();
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/i18n/th.js'), 'utf8'), context);
    script.onload();
  });
  assert.equal(await api.loadLocale('xx'), false);
  assert.equal(await api.loadLocale('th'), false);
  fail = false;
  assert.equal(await api.loadLocale('th'), true);
});
