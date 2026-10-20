const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/admin-place-search.js'), 'utf8');
const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [120.97, 24.8] }, properties: { name: '新竹' } };
const json = payload => ({ ok: true, json: async () => payload });

function setup(fetch, extras = {}) {
  const context = vm.createContext({ fetch, URLSearchParams, AbortSignal, AbortController, setTimeout, clearTimeout, ...extras });
  vm.runInContext(source, context);
  return context.AdminPlaceSearch;
}

test('Photon uses local language without unsupported language or country parameters', async () => {
  const search = setup(async url => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'photon.komoot.io');
    assert.equal(parsed.searchParams.get('q'), '新竹');
    assert.equal(parsed.searchParams.has('lang'), false);
    assert.equal(parsed.searchParams.has('countrycodes'), false);
    return json({ features: [point] });
  });
  const results = await search.search('新竹');
  assert.equal(results.length, 1);
  assert.equal(search.label(results[0]), '新竹');
});

test('network, HTTP, empty and malformed Photon responses fall back to Nominatim', async t => {
  for (const primary of [
    () => { throw new TypeError('Offline'); },
    () => ({ ok: false }),
    () => json({ features: [] }),
    () => json({ features: {} }),
    () => json({ features: [null, { geometry: { type: 'Point', coordinates: [181, 91] } }] })
  ]) {
    await t.test(String(primary), async () => {
      const calls = [];
      const search = setup(async url => {
        calls.push(url);
        if (calls.length === 1) return primary();
        assert.equal(new URL(url).hostname, 'nominatim.openstreetmap.org');
        return json([{ lat: '24.8', lon: '120.97', display_name: '新竹市', name: '新竹' }]);
      });
      const results = await search.search('新竹');
      assert.equal(calls.length, 2);
      assert.equal(search.label(results[0]), '新竹市');
      assert.deepEqual(Array.from(results[0].geometry.coordinates), [120.97, 24.8]);
    });
  }
});

test('reverse lookup also falls back and preserves longitude/latitude order', async () => {
  const search = setup(async url => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/reverse');
    assert.equal(parsed.searchParams.get('lat'), '24.8');
    assert.equal(parsed.searchParams.get('lon'), '120.97');
    return parsed.hostname === 'photon.komoot.io'
      ? json({ features: [] })
      : json({ lat: '24.8', lon: '120.97', display_name: '新竹市' });
  });
  assert.equal(search.label((await search.reverse(24.8, 120.97))[0]), '新竹市');
});

test('invalid coordinates are never offered and clean empty results remain empty', async () => {
  const search = setup(async url => new URL(url).hostname === 'photon.komoot.io'
    ? json({ features: [
      { ...point, geometry: { type: 'Point', coordinates: [120, NaN] } },
      { ...point, geometry: { type: 'Point', coordinates: [120] } },
      { ...point, geometry: { type: 'Point', coordinates: ['120', '24'] } }
    ] })
    : json([{ display_name: 'Missing coordinates' }, { lat: '100', lon: '120', display_name: 'Invalid' }]));
  assert.equal((await search.search('未知地點')).length, 0);
});

test('all failed sources report an error', async () => {
  const search = setup(async () => { throw new TypeError('Offline'); });
  await assert.rejects(search.search('新竹'), /Place lookup unavailable/);
});

test('cancellation does not start fallback or publish stale results', async () => {
  const controller = new AbortController();
  let calls = 0;
  const search = setup(async (url, { signal }) => {
    calls += 1;
    controller.abort();
    signal.throwIfAborted();
  });
  await assert.rejects(search.search('新竹', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('provider timeout falls back without cancelling the user request', async () => {
  const controller = new AbortController();
  const search = setup(async (url, { signal }) => {
    if (new URL(url).hostname === 'photon.komoot.io') {
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    }
    return json([{ lat: '24.8', lon: '120.97', display_name: '新竹市' }]);
  }, {
    setTimeout: callback => setTimeout(callback, 0),
    AbortSignal: {}
  });
  assert.equal((await search.search('新竹', { signal: controller.signal })).length, 1);
  assert.equal(controller.signal.aborted, false);
});

test('Nominatim fallback requests are spaced at least one second apart', async () => {
  const delays = [];
  const search = setup(async url => new URL(url).hostname === 'photon.komoot.io'
    ? json({ features: [] }) : json([]), {
    Date: { now: () => 1000 },
    setTimeout: (callback, delay) => {
      if (delay === 6000) return setTimeout(callback, delay);
      delays.push(delay);
      return setTimeout(callback, 0);
    }
  });
  await search.search('新竹');
  await search.search('竹南');
  assert.deepEqual(delays, [1100]);
});
