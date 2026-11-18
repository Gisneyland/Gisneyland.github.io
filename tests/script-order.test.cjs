const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const layouts = ['_layouts/default.html', '_layouts/admin.html'];

function scriptsOf(layout) {
  const html = fs.readFileSync(path.join(root, layout), 'utf8');
  return [...html.matchAll(/<script[^>]+src="\{\{\s*'\/assets\/js\/([^']+)'/g)].map((match) => match[1]);
}

function read(file) {
  return fs.readFileSync(path.join(root, 'assets/js', file), 'utf8');
}

// Globals a file reads while it is first evaluated (2-space-indented const inside its IIFE).
function loadTimeGlobals(source) {
  return [...source.matchAll(/^ {2}const \w+ = (?:global|root|window)\.([A-Z]\w+)/gm)].map((match) => match[1]);
}

function exportsOf(source) {
  return [...source.matchAll(/(?:global|root|window)\.([A-Z]\w+)\s*=[^=]/g)].map((match) => match[1]);
}

for (const layout of layouts) {
  test(`${layout} loads every script it references and defers none of its load-time globals`, () => {
    const scripts = scriptsOf(layout);
    const providers = new Map();
    for (const file of scripts) {
      assert.ok(fs.existsSync(path.join(root, 'assets/js', file)), `${file} is missing`);
      for (const name of exportsOf(read(file))) providers.set(name, file);
    }

    scripts.forEach((file, index) => {
      for (const name of loadTimeGlobals(read(file))) {
        const provider = providers.get(name);
        if (!provider || provider === file) continue;
        assert.ok(scripts.indexOf(provider) < index, `${file} needs ${name} from ${provider}, which loads later`);
      }
    });
  });
}

test('admin.js loads after the modules whose staff-profile-ready listeners it must not outrun', () => {
  const scripts = scriptsOf('_layouts/admin.html');
  for (const file of ['supabase-config.js', 'supabase-data.js', 'staff-access.js', 'admin-staff.js', 'admin-content.js', 'admin-response-format.js', 'screening-plan-model.js']) {
    assert.ok(scripts.indexOf(file) >= 0 && scripts.indexOf(file) < scripts.indexOf('admin.js'), `${file} must load before admin.js`);
  }
});

test('supabase-data.js loads right after the client is configured on every page', () => {
  for (const layout of layouts) {
    const scripts = scriptsOf(layout);
    assert.equal(scripts.indexOf('supabase-data.js'), scripts.indexOf('supabase-config.js') + 1, layout);
  }
});
