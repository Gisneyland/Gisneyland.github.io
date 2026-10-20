const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

test('public editor media has a separate bounded bucket with approved-admin insert policy', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202610200003_site_editor_media.sql'), 'utf8');
  assert.match(sql, /'site-editor-media', 'site-editor-media', true, 10485760/);
  assert.match(sql, /for insert to authenticated/);
  assert.match(sql, /public\.is_site_editor_administrator\(\)/);
  assert.match(sql, /storage\.foldername\(name\).*auth\.uid\(\)/s);
  assert.doesNotMatch(sql, /image\/svg|text\/html|screening-test-photos|for (?:update|delete|all)/);
});

test('upload requires explicit public-media consent and uses unique non-overwriting paths', () => {
  const controller = fs.readFileSync(path.join(root, 'assets/js/site-editor.js'), 'utf8');
  assert.match(controller, /file\.size > 10485760/);
  assert.match(controller, /global\.confirm\('此檔案上傳後即為公開素材/);
  assert.match(controller, /activeUserId.*crypto\.randomUUID\(\)/);
  assert.match(controller, /upsert: false/);
  assert.match(controller, /if \(!authorized\(token\)\) return null/);
});
