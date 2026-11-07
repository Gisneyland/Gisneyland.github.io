const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/admin-nav.js'), 'utf8');

test('collapsed admin tabs retain accessible names', () => {
  const tabs = ['篩檢分析', '新聞與活動', '設定'].map(text => ({
    querySelector: () => ({ textContent: text }),
    setAttribute(name, value) { this[name] = value; }
  }));
  const nav = {
    classList: { toggle(name, value) { this.collapsed = value; } },
    querySelectorAll: () => tabs
  };
  const toggle = {
    attributes: {},
    querySelector(selector) { return selector === '.admin-nav-toggle-label' ? this.label : this.icon; },
    label: {}, icon: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener() {}
  };
  const media = { matches: true, addEventListener() {} };
  const document = {
    documentElement: { classList: { toggle() {} } },
    getElementById(id) { return id === 'admin-nav' ? nav : toggle; }
  };
  vm.runInNewContext(source, {
    document, window: { matchMedia: () => media },
    localStorage: { getItem: () => '1', setItem() {} }
  });

  assert.equal(nav.classList.collapsed, true);
  assert.deepEqual(tabs.map(tab => tab['aria-label']), ['篩檢分析', '新聞與活動', '設定']);
});
