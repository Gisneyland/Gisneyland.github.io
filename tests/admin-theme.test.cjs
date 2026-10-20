const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/admin-theme.js'), 'utf8');

function setup(saved, dark = false, blocked = false) {
  const events = {}, windowEvents = {}, mediaEvents = {}, clicks = {};
  const icon = {}, button = {
    dataset: {}, setAttribute(key, value) { this[key] = value; },
    querySelector() { return icon; }, addEventListener(name, fn) { clicks.toggle = fn; }
  };
  let ready = false;
  const document = {
    documentElement: { dataset: {} },
    getElementById(id) {
      if (!ready) return null;
      return id === 'theme-toggle-button' ? button : { addEventListener(name, fn) { clicks.auto = fn; } };
    },
    addEventListener(name, fn) { events[name] = fn; }
  };
  const media = { matches: dark, addEventListener(name, fn) { mediaEvents[name] = fn; } };
  const storage = {
    getItem() { if (blocked) throw Error('Denied'); return saved; },
    setItem(key, value) { if (blocked) throw Error('Denied'); saved = value; }
  };
  vm.runInNewContext(source, {
    document, localStorage: storage,
    window: { matchMedia: () => media, addEventListener(name, fn) { windowEvents[name] = fn; } }
  });
  const initial = { ...document.documentElement.dataset };
  ready = true; events.DOMContentLoaded();
  return { document, initial, media, mediaEvents, clicks, button, icon, storage, windowEvents };
}

test('admin applies public theme preference before DOM ready and persists accessible toggles', () => {
  const env = setup('dark');
  assert.deepEqual(env.initial, { mode: 'dark', theme: 'dark' });
  assert.equal(env.button['aria-label'], '暗黑主題');
  env.clicks.toggle();
  assert.equal(env.document.documentElement.dataset.theme, 'light');
  assert.equal(env.storage.getItem('site-mode'), 'light');
  assert.equal(env.icon.textContent, 'light_mode');
  env.clicks.auto();
  assert.equal(env.storage.getItem('site-mode'), 'auto');
  env.media.matches = true; env.mediaEvents.change();
  assert.equal(env.document.documentElement.dataset.theme, 'dark');
});

test('admin tracks system only in auto mode and syncs theme changes from other tabs', () => {
  const env = setup(null, true);
  assert.equal(env.initial.theme, 'dark');
  env.clicks.toggle();
  env.mediaEvents.change();
  assert.equal(env.document.documentElement.dataset.theme, 'light');
  env.storage.setItem('site-mode', 'dark');
  env.windowEvents.storage({ key: 'site-mode' });
  assert.equal(env.document.documentElement.dataset.theme, 'dark');
  env.storage.setItem('site-mode', 'invalid');
  env.windowEvents.storage({ key: null });
  assert.equal(env.document.documentElement.dataset.mode, 'auto');
});

test('admin theme remains functional when storage is unavailable', () => {
  const env = setup(null, true, true);
  assert.equal(env.initial.theme, 'dark');
  env.clicks.toggle();
  assert.equal(env.document.documentElement.dataset.theme, 'light');
  env.clicks.auto();
  assert.equal(env.document.documentElement.dataset.theme, 'dark');
});
