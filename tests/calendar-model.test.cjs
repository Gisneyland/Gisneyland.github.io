const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../assets/js/calendar-model.js');

test('legacy events remain all-day with inclusive final date', () => {
  const event = model.recordEvent({ id: 'old', content_type: 'event', event_start: '2026-10-18', event_end: '2026-10-20' });
  assert.equal(event.allDay, true);
  assert.equal(event.end, '2026-10-21');
});

test('timed events preserve Taipei wall clock and support overnight schedules', () => {
  const payload = model.timedPayload('2026-10-18', '23:30', '2026-10-19', '01:00');
  const event = model.recordEvent({ id: 'timed', content_type: 'event', event_start: '2026-10-18', is_all_day: false, ...payload });
  assert.equal(event.start, '2026-10-18T23:30');
  assert.equal(event.end, '2026-10-19T01:00');
  assert.equal(event.allDay, false);
  assert.equal(model.icsTimestamp(payload.event_start_at), '20261018T153000Z');
  assert.throws(() => model.timedPayload('2026-10-18', '12:00', '2026-10-18', '12:00'));
});

test('single-day closures and extra opening override schedule and holidays', () => {
  assert.equal(model.openingForDate('2026-10-20', [], [{ date: '2026-10-20', is_closed: true }], false).closed, true);
  const opening = model.openingForDate('2026-10-18', [], [{ date: '2026-10-18', is_closed: false, opens_at: '08:00:00', closes_at: '12:00:00' }], true);
  assert.equal(opening.start, '08:00');
  assert.equal(opening.closed, false);
  assert.equal(model.openingForDate('2026-10-20', [], [], true).closed, true);
});

test('navigation uses current clock while heading follows selected period', () => {
  const now = new Date('2026-10-18T05:03:00+08:00');
  assert.deepEqual(model.navigationLabels('dayGridMonth', '2028-03-01', now), { title: '2028年', today: '10月' });
  assert.equal(model.navigationLabels('timeGridDay', '2028-03-01', now).today, '18日');
  assert.equal(model.navigationLabels('listMonth', '2026-10-18', now).today, '5時3分');
  assert.equal(model.navigationLabels('listWeek', '2026-10-18', now).today, '第43週');
  assert.equal(model.calendarWeek('2026-10-19'), 43);
  assert.equal(model.calendarWeek('2026-10-18'), 43);
});

test('stream splits overnight activities and treats midnight endings as exclusive', () => {
  const overnight = { start: '2026-10-18T23:30', end: '2026-10-19T01:00', allDay: false };
  const midnight = { start: '2026-10-18T20:00', end: '2026-10-19T00:00', allDay: false };
  assert.equal(model.eventsForDate([overnight, midnight], '2026-10-19').length, 1);
  assert.equal(model.eventTimeLabel(overnight, '2026-10-18'), '23:30–24:00');
  assert.equal(model.eventTimeLabel(overnight, '2026-10-19'), '00:00–01:00');
  assert.equal(model.eventsForDate([{ start: '2026-10-18', end: '2026-10-19', allDay: true }], '2026-10-19').length, 0);
});

test('ICS exports timed UTC, inclusive all-day dates, coordinates and opening exceptions', async () => {
  let captured;
  const tables = {
    site_content: [
      { id: 'timed', content_type: 'event', title: 'Timed', event_start: '2026-10-18', event_end: '2026-10-19', is_all_day: false, event_start_at: '2026-10-18T15:30:00Z', event_end_at: '2026-10-18T17:00:00Z', location_latitude: 25.033, location_longitude: 121.5654 },
      { id: 'legacy', content_type: 'event', title: 'All day', event_start: '2026-10-18', event_end: '2026-10-19' }
    ],
    site_opening_schedule: [],
    site_opening_exceptions: [
      { date: '2026-10-18', is_closed: false, opens_at: '08:00', closes_at: '12:00', note: 'Extra opening' },
      { date: '2026-10-20', is_closed: true }
    ]
  };
  const client = { from(table) { return { select() { return { eq() { return this; }, order() { return this; }, then(resolve) { return Promise.resolve({ data: tables[table], error: null }).then(resolve); } }; } }; } };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-17T21:03:00Z'])); }
  }
  class ObjectURL extends URL {
    static createObjectURL(blob) { captured = blob; return 'blob:test'; }
    static revokeObjectURL() {}
  }
  const status = { textContent: '' };
  const context = vm.createContext({
    window: { SiteCalendarModel: model, questionnaireSupabase: client, setTimeout() {}, location: { origin: 'https://example.test' } },
    document: { addEventListener() {}, getElementById() { return { disabled: false }; }, createElement() { return { click() {}, remove() {} }; }, body: { append() {} } },
    fetch: async () => ({ ok: true, json: async () => [] }),
    Date: FixedDate, URL: ObjectURL, Blob, TextEncoder, console, status
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/content.js'), 'utf8'), context);
  await vm.runInContext('exportActivityCalendar(status)', context);
  assert.match(status.textContent, /已匯出/);
  const text = (await captured.text()).replaceAll('\r\n ', '');
  const blocks = text.split('BEGIN:VEVENT');
  const timed = blocks.find(block => block.includes('UID:activity-timed@'));
  const allDay = blocks.find(block => block.includes('UID:activity-legacy@'));
  const opening = blocks.find(block => block.includes('UID:opening-2026-10-18@'));
  assert.match(timed, /DTSTART:20261018T153000Z/);
  assert.match(timed, /DTEND:20261018T170000Z/);
  assert.match(timed, /GEO:25.033;121.5654/);
  assert.match(allDay, /DTEND;VALUE=DATE:20261020/);
  assert.match(opening, /DTSTART:20261018T000000Z/);
  assert.match(opening, /DTEND:20261018T040000Z/);
  assert.ok(!text.includes('UID:opening-2026-10-20@'));
});