const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createHandler(fetchImplementation) {
  let handler;
  const context = vm.createContext({
    Deno: { serve(callback) { handler = callback; } },
    fetch: fetchImplementation, Response, AbortSignal, Date, Promise
  });
  const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/environment-feeds/index.ts'), 'utf8');
  vm.runInContext(source, context);
  return handler;
}

test('only fixed public sources are fetched and concurrent queries share a cache', async () => {
  const calls = [];
  const handler = createHandler(async url => {
    calls.push(url);
    return new Response('<feed xmlns="http://www.w3.org/2005/Atom"/>');
  });
  const requests = await Promise.all([
    handler(new Request('https://example.test/?url=https://untrusted.test', { method: 'POST' })),
    handler(new Request('https://example.test/', { method: 'POST' }))
  ]);
  await handler(new Request('https://example.test/', { method: 'POST' }));
  assert.deepEqual(calls.sort(), [
    'https://www.gdacs.org/xml/rss.xml',
    'https://www.tsunami.gov/events/xml/PAAQAtom.xml',
    'https://www.tsunami.gov/events/xml/PHEBAtom.xml'
  ]);
  const payload = await requests[0].json();
  assert.equal(payload.sources.length, 3);
  assert.ok(payload.sources.every(source => source.ok && Number.isFinite(Date.parse(source.fetchedAt))));
  assert.equal(requests[0].headers.get('access-control-allow-origin'), '*');
});

test('upstream failure and unsafe XML are returned as unknown, not an empty successful feed', async () => {
  const handler = createHandler(async url => {
    if (url.includes('gdacs')) throw new Error('Network unavailable');
    if (url.includes('PHEB')) return new Response('<!DOCTYPE feed><feed/>');
    return new Response('Unavailable', { status: 503 });
  });
  const response = await handler(new Request('https://example.test/', { method: 'POST' }));
  const payload = await response.json();
  assert.ok(payload.sources.every(source => source.ok === false && source.xml === null));
});

test('preflight and unsupported methods never fetch upstream data', async () => {
  let calls = 0;
  const handler = createHandler(async () => { calls += 1; throw new Error('Unexpected fetch'); });
  assert.equal((await handler(new Request('https://example.test/', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await handler(new Request('https://example.test/'))).status, 405);
  assert.equal(calls, 0);
});