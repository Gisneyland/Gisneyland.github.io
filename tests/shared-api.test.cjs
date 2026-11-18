const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const jsDir = path.join(__dirname, '../assets/js');
const files = fs.readdirSync(jsDir).filter((file) => file.endsWith('.js'));
const sources = new Map(files.map((file) => [file, fs.readFileSync(path.join(jsDir, file), 'utf8')]));

const SHARED = [
  'SiteEditorModel', 'SiteEditorRich', 'SiteEditorDOM', 'SiteEditorInline',
  'RichContentModel', 'RichContent', 'AdminRichEditor', 'SocialDiscussion',
  'StaffAccess', 'SiteData', 'SiteCalendarModel'
];

const owners = new Map(SHARED.map((name) => [
  name,
  [...sources].find(([, source]) => new RegExp(`(?:global|root|window)\\.${name}\\s*=[^=]`).test(source))[0]
]));

// Modules guard on their dependencies, so evaluate them together in dependency order.
const context = { document: {} };
context.globalThis = context;
context.window = context;
vm.createContext(context);
for (const file of [
  'site-editor-model.js', 'site-editor-rich.js', 'site-editor-dom.js', 'site-editor-inline.js',
  'rich-content-model.js', 'rich-content.js', 'admin-rich-editor.js', 'social-discussion.js',
  'staff-access.js', 'supabase-data.js', 'calendar-model.js'
]) vm.runInContext(sources.get(file), context, { filename: file });

const apiOf = (name) => Object.keys(context[name] || {});

// Members each consumer reads from a shared module, whether directly or through a local alias.
function usesOf(source, name) {
  const aliases = [name];
  for (const match of source.matchAll(new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:global|root|window|globalThis)\\.${name}\\s*(?:;|$)`, 'gm'))) aliases.push(match[1]);
  const members = new Set();
  for (const alias of aliases) {
    for (const match of source.matchAll(new RegExp(`(?<![\\w.])(?:(?:global|window|root|globalThis)\\.)?${alias}\\??\\.(\\w+)`, 'g'))) members.add(match[1]);
  }
  for (const match of source.matchAll(new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*(?:global|root|window|globalThis)\\.${name}\\b`, 'g'))) {
    for (const part of match[1].split(',')) if (part.trim()) members.add(part.split(':')[0].trim());
  }
  return members;
}

for (const name of SHARED) {
  test(`every member read from ${name} is part of its exported API`, () => {
    const api = new Set(apiOf(name));
    assert.ok(api.size > 0, `${name} exports nothing`);
    const owner = owners.get(name);
    for (const [file, source] of sources) {
      if (file === owner || file.startsWith('i18n')) continue;
      for (const member of usesOf(source, name)) {
        assert.ok(api.has(member), `${file} uses ${name}.${member}, which is not exported by ${owner}`);
      }
    }
  });
}
