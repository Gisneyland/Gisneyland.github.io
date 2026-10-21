const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/staff-calendar-feed/index.ts'), 'utf8')
  .replace(/^import[^\n]*\n/, '');

async function hash(value) {
  const bytes = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function handler({ feed, profile, user, records }) {
  let serve;
  const mockClient = {
    auth: { admin: { async getUserById() { return { data: { user }, error: null }; } } },
    from(table) {
      const filters = {};
      const query = {
        select() { return this; },
        eq(key, value) { filters[key] = value; return this; },
        is(key, value) { filters[key] = value; return this; },
        in() { return this; }, order() { return this; },
        async maybeSingle() {
          if (table === 'staff_calendar_feeds') {
            return { data: feed?.token_hash === filters.token_hash && feed.revoked_at === null ? feed : null, error: null };
          }
          if (table === 'admin_profiles') return { data: profile, error: null };
          return { data: null, error: null };
        },
        async range() { return { data: records, error: null }; }
      };
      return query;
    }
  };
  const context = vm.createContext({
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://project.example', SUPABASE_SERVICE_ROLE_KEY: 'test' })[key] }, serve(callback) { serve = callback; } },
    createClient: () => mockClient,
    crypto: webcrypto,
    TextEncoder,
    Response,
    Request,
    Headers,
    Intl,
    Date,
    console
  });
  vm.runInContext(stripTypeScriptTypes(source), context);
  return serve;
}

function tomorrowTaipei() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

test('a private token feed returns published events and only that screener next slot', async () => {
  const token = 'a'.repeat(64);
  const feed = { user_id: 'staff-1', token_hash: await hash(token), revoked_at: null };
  const user = { id: 'staff-1', updated_at: '2026-10-20T00:00:00Z', user_metadata: { nickname: '林', private_note: 'must not leak', screening_preferences: {
    rules: [{ frequency: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], name: '新竹篩檢', startTime: '09:00', endTime: '10:00', place: { label: '風城部屋', coordinates: [120.97, 24.8] } }]
  } } };
  const profile = { nickname: '林', account_role: 'screener', approval_status: 'approved', privacy_consent_at: '2026-10-20' };
  const date = tomorrowTaipei();
  const serve = handler({ feed, user, profile, records: [
    { id: 3, content_type: 'event', title: '已發布活動', summary: '公開摘要', event_start: date, event_end: date, is_all_day: true, is_published: true, updated_at: '2026-10-20T00:00:00Z' },
    { id: 4, content_type: 'event', title: '草稿不可匯出', event_start: date, event_end: date, is_all_day: true, is_published: false }
  ] });

  const response = await serve(new Request(`https://project.example/functions/v1/staff-calendar-feed?token=${token}`));
  const calendar = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/calendar/);
  assert.match(calendar, /SUMMARY:已發布活動/);
  assert.match(calendar, /SUMMARY:篩檢規劃・林・新竹篩檢/);
  assert.match(calendar, /LOCATION:風城部屋/);
  assert.match(calendar, /GEO:24\.8;120\.97/);
  assert.doesNotMatch(calendar, /草稿不可匯出|must not leak/);

  const notModified = await serve(new Request(`https://project.example/functions/v1/staff-calendar-feed?token=${token}`, {
    headers: { 'if-none-match': response.headers.get('etag') }
  }));
  assert.equal(notModified.status, 304);
});

test('invalid or revoked feed tokens do not disclose calendar content', async () => {
  const token = 'b'.repeat(64);
  const feed = { user_id: 'staff-1', token_hash: await hash(token), revoked_at: new Date().toISOString() };
  const serve = handler({ feed, user: null, profile: null, records: [] });
  assert.equal((await serve(new Request('https://project.example/functions/v1/staff-calendar-feed?token=short'))).status, 404);
  assert.equal((await serve(new Request(`https://project.example/functions/v1/staff-calendar-feed?token=${token}`))).status, 404);
  assert.equal((await serve(new Request('https://project.example/functions/v1/staff-calendar-feed', { method: 'POST' }))).status, 405);
});