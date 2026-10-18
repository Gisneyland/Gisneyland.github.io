(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.SiteCalendarModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function localParts(value) {
    return Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
  }

  function dateKey(value) {
    const parts = localParts(value);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function localDateTime(value) {
    const parts = localParts(value);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function addDays(value, amount) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  function recordEvent(record) {
    if (record.content_type === 'event') {
      const timed = record.is_all_day === false && record.event_start_at && record.event_end_at;
      if (!record.event_start) return null;
      return {
        id: String(record.id), title: record.title, allDay: !timed,
        start: timed ? localDateTime(record.event_start_at) : record.event_start,
        end: timed ? localDateTime(record.event_end_at) : addDays(record.event_end || record.event_start, 1),
        extendedProps: { record }
      };
    }
    const timestamp = record.published_at || record.created_at;
    if (!timestamp) return null;
    return { id: String(record.id), title: record.title, start: dateKey(timestamp), allDay: true, extendedProps: { record } };
  }

  function timedPayload(startDate, startTime, endDate, endTime) {
    const start = new Date(`${startDate}T${startTime}:00+08:00`);
    const end = new Date(`${endDate}T${endTime}:00+08:00`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error('活動結束時間必須晚於開始時間。');
    return { event_start_at: start.toISOString(), event_end_at: end.toISOString() };
  }

  function openingForDate(date, schedule, exceptions, isHoliday) {
    const exception = exceptions.find(item => item.date === date);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const regular = schedule.find(item => Number(item.weekday) === weekday);
    const fallback = { is_closed: weekday < 2, opens_at: '14:00', closes_at: '22:00' };
    const setting = exception || regular || fallback;
    if (setting.is_closed || (!exception && isHoliday)) return { closed: true, exception: Boolean(exception), note: exception?.note || '' };
    return { closed: false, start: setting.opens_at.slice(0, 5), end: setting.closes_at.slice(0, 5), exception: Boolean(exception), note: exception?.note || '' };
  }

  function calendarWeek(value) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.floor(((date - start) / 86400000 + start.getUTCDay()) / 7) + 1;
  }

  function navigationLabels(view, selectedDate, now = new Date()) {
    const current = localParts(now);
    const [year, month] = selectedDate.slice(0, 10).split('-');
    if (view === 'dayGridMonth') return { title: `${year}年`, today: `${Number(current.month)}月` };
    if (view === 'listWeek') return { title: `${year}年${Number(month)}月`, today: `第${calendarWeek(dateKey(now))}週` };
    if (view === 'timeGridDay') return { title: `${year}年${Number(month)}月`, today: `${Number(current.day)}日` };
    return { title: `${year}年${Number(month)}月${Number(selectedDate.slice(8, 10))}日`, today: `${Number(current.hour)}時${Number(current.minute)}分` };
  }

  function icsTimestamp(value) {
    return new Date(value).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
  }

  function eventsForDate(events, date) {
    return events.filter(event => event.display !== 'background' && event.start.slice(0, 10) <= date
      && (event.end ? event.end > (event.allDay ? date : `${date}T00:00`) : event.start.slice(0, 10) === date));
  }

  function eventTimeLabel(event, date) {
    if (event.allDay) return '整天';
    return `${event.start.slice(0, 10) < date ? '00:00' : event.start.slice(11, 16)}–${event.end?.slice(0, 10) > date ? '24:00' : event.end?.slice(11, 16) || ''}`;
  }

  return { dateKey, localDateTime, addDays, recordEvent, timedPayload, openingForDate, calendarWeek, navigationLabels, icsTimestamp, eventsForDate, eventTimeLabel };
});