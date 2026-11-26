const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const calls = [];
  const builder = (table) => {
    const chain = { table, steps: [] };
    const proxy = new Proxy(chain, {
      get(target, name) {
        if (name === 'then') return undefined;
        return (...args) => { target.steps.push([name, ...args]); return proxy; };
      }
    });
    calls.push(chain);
    return proxy;
  };
  const window = { questionnaireSupabase: { from: builder } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/supabase-data.js'), 'utf8'), { window });
  return { SiteData: window.SiteData, calls };
}

test('profiles.fetchOwn selects the requested columns for one user', () => {
  const { SiteData, calls } = load();
  SiteData.profiles.fetchOwn('u1', SiteData.profiles.columns.screenerNumber);
  assert.equal(calls[0].table, 'admin_profiles');
  assert.deepEqual(calls[0].steps, [['select', 'screener_number'], ['eq', 'user_id', 'u1'], ['maybeSingle']]);
});

test('responses.listRecent only filters coded rows for the completed view', () => {
  const { SiteData, calls } = load();
  SiteData.responses.listRecent('pending');
  SiteData.responses.listRecent('completed');
  assert.equal(calls[0].steps.some(([name]) => name === 'not'), false);
  assert.deepEqual(calls[1].steps.at(-1), ['not', 'anonymous_consult_code', 'is', null]);
  assert.deepEqual(calls[1].steps.find(([name]) => name === 'limit'), ['limit', 200]);
});

test('responses.listPendingPage pages oldest-first over uncoded rows', () => {
  const { SiteData, calls } = load();
  SiteData.responses.listPendingPage(400, 200);
  assert.deepEqual(calls[0].steps.at(-1), ['range', 400, 599]);
  assert.deepEqual(calls[0].steps.find(([name]) => name === 'is'), ['is', 'anonymous_consult_code', null]);
});

test('batch insert uses database defaults and deletion returns current photo data', () => {
  const { SiteData, calls } = load();
  const rows = [{ created_at: '2026-11-04T00:00:00Z' }, {}];
  SiteData.responses.insertMany(rows);
  SiteData.responses.deleteMany(['1']);
  assert.equal(calls[0].steps[0][0], 'insert');
  assert.equal(calls[0].steps[0][2].defaultToNull, false);
  assert.deepEqual(calls[1].steps.at(-1), ['select', 'id, response_data']);
});
