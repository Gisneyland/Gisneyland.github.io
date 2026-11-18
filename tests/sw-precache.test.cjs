const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('shell styles exist and are shared by the layout and the service worker precache', () => {
  const styles = read('_data/shell_styles.yml').split('\n').filter((line) => line.startsWith('- ')).map((line) => line.slice(2).trim());
  assert.ok(styles.length > 0);
  for (const style of styles) assert.ok(fs.existsSync(path.join(root, style)), `${style} is missing, so cache.addAll would fail the SW install`);
  assert.match(read('_layouts/default.html'), /for style in site\.data\.shell_styles/);
  assert.match(read('sw.js'), /for style in site\.data\.shell_styles/);
});

test('precached icons and favicon exist', () => {
  for (const match of read('sw.js').matchAll(/"(\/assets\/images\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1])), `${match[1]} is missing`);
  }
});
