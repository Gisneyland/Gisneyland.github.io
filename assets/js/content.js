document.addEventListener('DOMContentLoaded', () => {
  loadManagedNews();
  initializeActivityCalendar();
});

const governmentCalendarCache = new Map();
const governmentCalendarDataUrl = 'https://raw.githubusercontent.com/ruyut/TaiwanCalendar/master/data';

async function fetchPublishedContent(contentType) {
  if (!window.questionnaireSupabase) {
    throw new Error('Content service is unavailable.');
  }

  let query = window.questionnaireSupabase
    .from('site_content')
    .select('*')
    .eq('content_type', contentType)
    .eq('is_published', true);

  query = contentType === 'event'
    ? query.order('event_start', { ascending: true })
    : query.order('published_at', { ascending: false }).order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function loadManagedNews() {
  const feeds = Array.from(document.querySelectorAll('[data-managed-news]'));
  if (!feeds.length) return;

  try {
    const records = await fetchPublishedContent('news');
    feeds.forEach(feed => renderNewsFeed(feed, records));
  } catch (error) {
    console.warn('無法載入上架新聞，保留靜態備援內容。', error);
  }
}

function renderNewsFeed(feed, records) {
  feed.replaceChildren();
  const cardClass = feed.dataset.cardClass || 'news-card';
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'content-feed-empty';
    empty.textContent = '目前沒有已上架的最新消息。';
    feed.append(empty);
    return;
  }

  records.forEach(record => {
    const article = document.createElement('article');
    article.className = cardClass;

    const tag = document.createElement('span');
    tag.className = cardClass === 'news-card' ? 'news-tag' : 'event-tag';
    tag.textContent = record.category || '最新消息';
    const title = document.createElement('h3');
    title.textContent = record.title;
    const summary = document.createElement('p');
    summary.textContent = record.summary;
    article.append(tag, title, summary);

    if (record.url) {
      const link = createContentLink(record.url, '閱讀完整內容');
      if (link) article.append(link);
    }
    feed.append(article);
  });
}

async function initializeActivityCalendar() {
  const calendarElement = document.getElementById('activity-calendar');
  if (!calendarElement) return;

  const status = document.getElementById('activity-calendar-status');
  const details = document.getElementById('activity-event-details');
  const infoPopover = document.getElementById('calendar-info-popover');
  if (infoPopover) {
    document.addEventListener('click', event => {
      if (infoPopover.open && !infoPopover.contains(event.target)) infoPopover.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && infoPopover.open) {
        infoPopover.open = false;
        infoPopover.querySelector('summary')?.focus();
      }
    });
  }
  const savedLanguage = localStorage.getItem('site-language') || 'zh-TW';
  const calendarLocales = { 'zh-TW': 'zh-tw', tl: 'fil' };
  const internationalLocales = { 'zh-TW': 'zh-TW', tl: 'fil' };
  const compactWeekdays = {
    'zh-TW': ['日', '一', '二', '三', '四', '五', '六'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    th: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
    vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
    my: ['နွေ', 'လာ', 'ဂါ', 'ဟူး', 'ကြာ', 'သော', 'နေ'],
    tl: ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'],
    km: ['អា', 'ច', 'អ', 'ពុ', 'ព្រ', 'សុ', 'សៅ'],
    bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি']
  };
  const fullWeekdays = {
    my: ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ'],
    km: ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍']
  };
  if (!window.FullCalendar?.Calendar) {
    status.textContent = '行事曆元件載入失敗，請重新整理頁面。';
    return;
  }

  const calendar = new FullCalendar.Calendar(calendarElement, {
    initialView: 'dayGridMonth',
    initialDate: new Date(),
    locale: calendarLocales[savedLanguage] || savedLanguage,
    timeZone: 'Asia/Taipei',
    dayHeaderContent: ({ date }) => {
      const language = localStorage.getItem('site-language') || 'zh-TW';
      const weekdayIndex = date.getDay();
      const locale = internationalLocales[language] || language;
      let weekday = compactWeekdays[language]?.[weekdayIndex];
      if (!weekday) weekday = new Intl.DateTimeFormat('en', { weekday: 'narrow' }).format(date);
      const label = document.createElement('span');
      label.className = 'notranslate';
      label.setAttribute('translate', 'no');
      label.setAttribute('aria-label', fullWeekdays[language]?.[weekdayIndex]
        || new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date));
      label.textContent = weekday;
      return { domNodes: [label] };
    },
    height: 'auto',
    fixedWeekCount: false,
    dayMaxEvents: true,
    dayCellContent: ({ date }) => {
      const dayNumber = document.createElement('span');
      dayNumber.className = 'notranslate';
      dayNumber.setAttribute('translate', 'no');
      dayNumber.textContent = String(date.getDate());
      return { domNodes: [dayNumber] };
    },
    headerToolbar: {
      left: 'title',
      center: '',
      right: 'today prev,next'
    },
    buttonText: { today: '今天' },
    events: async (fetchInfo, successCallback) => {
      const lastVisibleDate = new Date(fetchInfo.end.getTime() - 1);
      const years = Array.from(
        { length: lastVisibleDate.getFullYear() - fetchInfo.start.getFullYear() + 1 },
        (_value, index) => fetchInfo.start.getFullYear() + index
      );
      const results = await Promise.allSettled([
        fetchPublishedContent('event'),
        fetchOpeningSettings(),
        ...years.map(fetchGovernmentCalendarYear)
      ]);
      const publishedResult = results[0];
      const publishedEvents = publishedResult.status === 'fulfilled' ? publishedResult.value : [];
      const settings = results[1].status === 'fulfilled' ? results[1].value : { schedule: [], exceptions: [] };
      const officialDays = results.slice(2)
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value);
      const events = publishedEvents.map(record => {
        const event = window.SiteCalendarModel.recordEvent(record);
        return event ? { ...event, extendedProps: { kind: 'activity', record } } : null;
      }).filter(Boolean);

      const calendarDayMap = new Map(officialDays.map(day => [formatGovernmentDate(day.date), day]));
      const visibleDay = new Date(
        fetchInfo.start.getFullYear(),
        fetchInfo.start.getMonth(),
        fetchInfo.start.getDate()
      );
      const endDay = new Date(lastVisibleDate.getFullYear(), lastVisibleDate.getMonth(), lastVisibleDate.getDate() + 1);

      while (visibleDay < endDay) {
        const date = formatLocalDate(visibleDay);
        const governmentDay = calendarDayMap.get(date);
        const description = String(governmentDay?.description || '').trim();
        const isNamedHoliday = governmentDay?.isHoliday && description.length > 0;
        const isMakeupWorkday = !governmentDay?.isHoliday && /補行上班|調整上班/.test(description);

        if (isNamedHoliday) {
          events.push({
            id: `dgpa-holiday-${date}`,
            title: description,
            start: date,
            allDay: true,
            classNames: ['dgpa-holiday-event'],
            extendedProps: { kind: 'government-holiday', description }
          });
        } else if (isMakeupWorkday) {
          events.push({
            id: `dgpa-makeup-${date}`,
            title: `${description}（補班）`,
            start: date,
            allDay: true,
            classNames: ['dgpa-makeup-event'],
            extendedProps: { kind: 'government-makeup-workday', description }
          });
        }

        const opening = window.SiteCalendarModel.openingForDate(date, settings.schedule, settings.exceptions, isNamedHoliday);
        if (!opening.closed) {
          events.push({
            id: `opening-hours-${date}`,
            title: `風城部屋開放時段 ${opening.start}–${opening.end}`,
            start: date,
            allDay: true,
            display: 'background',
            classNames: ['opening-hours-event'],
            extendedProps: { kind: 'opening-hours', opening }
          });
        } else if (opening.exception) {
          events.push({ id: `opening-closed-${date}`, title: `休館${opening.note ? ` · ${opening.note}` : ''}`, start: date, allDay: true,
            classNames: ['dgpa-holiday-event'], extendedProps: { kind: 'opening-closure', description: opening.note || '休館' } });
        }

        visibleDay.setDate(visibleDay.getDate() + 1);
      }

      if (publishedResult.status === 'rejected') {
        const missingTable = ['PGRST205', '42P01'].includes(publishedResult.reason?.code);
        status.textContent = missingTable
          ? '活動資料庫尚未設定；開放時段與政府假日仍可查看。'
          : '活動資料暫時無法載入；開放時段與政府假日仍可查看。';
      } else if (results[1].status === 'rejected') {
        status.textContent = '營業設定暫時無法載入，目前顯示預設時段；請以團隊公告為準。';
      } else if (results.slice(2).some(result => result.status === 'rejected')) {
        status.textContent = `開放時段與 ${officialDays.length ? '部分' : '無'}政府假日已載入${publishedEvents.length ? `；另有 ${publishedEvents.length} 場已上架活動` : ''}。`;
      } else {
        status.textContent = `開放日期已依固定時段、國定假日與單日例外更新${publishedEvents.length ? `；${publishedEvents.length} 場已上架活動` : ''}。`;
      }
      successCallback(events);
    },
    eventContent: info => {
      const { kind, description } = info.event.extendedProps;
      if (kind === 'opening-hours') return { domNodes: [] };
      if (kind !== 'government-holiday' && kind !== 'government-makeup-workday') return;

      const badge = document.createElement('span');
      badge.className = 'notranslate';
      badge.setAttribute('translate', 'no');
      badge.setAttribute('aria-label', description || info.event.title);
      badge.title = description || info.event.title;
      badge.classList.add('calendar-holiday-label');
      badge.textContent = description || info.event.title;
      return { domNodes: [badge] };
    },
    eventDidMount: info => {
      const { kind, description, record } = info.event.extendedProps;
      const hoverText = kind === 'opening-hours'
        ? info.event.title
        : kind === 'government-holiday' || kind === 'government-makeup-workday'
          ? `${description || info.event.title}：${formatIsoDate(info.event.startStr)}`
          : record
            ? [
              record.title,
              formatManagedEventDates(record),
              record.location && `地點：${record.location}`,
              record.summary,
              record.body
            ].filter(Boolean).join('\n')
            : info.event.title;
      if (hoverText) {
        info.el.title = hoverText;
        info.el.setAttribute('aria-label', hoverText);
      }
      if (kind === 'opening-hours') {
        info.el.style.pointerEvents = 'auto';
        info.el.style.cursor = 'help';
      }
    },
    eventClick: info => {
      info.jsEvent.preventDefault();
      const { kind, description, record } = info.event.extendedProps;
      if (record) {
        renderEventDetails(details, record);
        return;
      }
      if (kind === 'government-holiday' || kind === 'government-makeup-workday' || kind === 'opening-closure') {
        renderCalendarNotice(details, kind === 'government-holiday' ? '國定假日' : kind === 'opening-closure' ? '休館' : '補班日', info.event.startStr, description);
      }
    }
  });

  calendar.render();
  document.addEventListener('site-language-change', () => calendar.render());

  document.getElementById('calendar-export-button')?.addEventListener('click', () => {
    exportActivityCalendar(status);
  });
}

function renderCalendarNotice(container, title, date, description) {
  container.hidden = false;
  document.getElementById('activity-event-title').textContent = title;
  document.getElementById('activity-event-date').textContent = formatEventDateRange(date);
  const location = document.getElementById('activity-event-location');
  location.hidden = true;
  location.textContent = '';
  const summary = document.getElementById('activity-event-summary');
  summary.textContent = description || '';
  summary.hidden = !description;
  const link = document.getElementById('activity-event-link');
  link.hidden = true;
  link.removeAttribute('href');
}

async function fetchGovernmentCalendarYear(year) {
  if (governmentCalendarCache.has(year)) return governmentCalendarCache.get(year);
  const request = fetch(`${governmentCalendarDataUrl}/${year}.json`, { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`DGPA calendar ${year} unavailable`);
      return response.json();
    })
    .catch(error => {
      governmentCalendarCache.delete(year);
      throw error;
    });
  governmentCalendarCache.set(year, request);
  return request;
}

function formatGovernmentDate(value) {
  const digits = String(value || '').replaceAll('-', '');
  if (!/^\d{8}$/.test(digits)) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function formatLocalDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function exportActivityCalendar(status) {
  const button = document.getElementById('calendar-export-button');
  const currentYear = Number(window.SiteCalendarModel.dateKey(new Date()).slice(0, 4));
  const years = [currentYear, currentYear + 1];
  button.disabled = true;
  try {
    const settings = await fetchOpeningSettings();
    const holidayResults = await Promise.allSettled(years.map(fetchGovernmentCalendarYear));
    const availableYears = holidayResults
      .map((result, index) => result.status === 'fulfilled' ? years[index] : null)
      .filter(year => year !== null);
    if (!availableYears.length) throw new Error('DGPA calendar data unavailable');

    const holidayRows = holidayResults
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value);
    const calendarDayMap = new Map(holidayRows.map(day => [formatGovernmentDate(day.date), day]));
    let activityRecords = [];
    try {
      activityRecords = await fetchPublishedContent('event');
    } catch (error) {
      console.warn('匯出行事曆時無法載入活動資料。', error);
    }

    const firstDateKey = window.SiteCalendarModel.dateKey(new Date());
    const lastDateKey = `${Math.max(...availableYears) + 1}-01-01`;
    const firstDate = new Date(`${firstDateKey}T00:00:00Z`);
    const lastDate = new Date(`${lastDateKey}T00:00:00Z`);
    const calendarEvents = [];
    const day = new Date(firstDate);

    while (day < lastDate) {
      const date = day.toISOString().slice(0, 10);
      const dateRow = calendarDayMap.get(date);
      const description = String(dateRow?.description || '').trim();
      const isPublicHoliday = dateRow?.isHoliday && description.length > 0;
      const isMakeupWorkday = !dateRow?.isHoliday && /補行上班|調整上班/.test(description);

      if (isPublicHoliday) {
        calendarEvents.push(createIcsEvent(`holiday-${date}`, description, [
          `DTSTART;VALUE=DATE:${toIcsDate(date)}`,
          `DTEND;VALUE=DATE:${toIcsDate(addIsoDays(date, 1))}`,
          'CATEGORIES:台灣國定假日',
          'DESCRIPTION:依行政院人事行政總處政府行政機關辦公日曆表。'
        ]));
      } else if (isMakeupWorkday) {
        calendarEvents.push(createIcsEvent(`makeup-${date}`, description, [
          `DTSTART;VALUE=DATE:${toIcsDate(date)}`,
          `DTEND;VALUE=DATE:${toIcsDate(addIsoDays(date, 1))}`,
          'CATEGORIES:政府補班日',
          'DESCRIPTION:依行政院人事行政總處政府行政機關辦公日曆表。'
        ]));
      }

      const opening = window.SiteCalendarModel.openingForDate(date, settings.schedule, settings.exceptions, isPublicHoliday);
      if (!opening.closed) {
        calendarEvents.push(createIcsEvent(`opening-${date}`, '風城部屋開放時段', [
          `DTSTART:${window.SiteCalendarModel.icsTimestamp(`${date}T${opening.start}:00+08:00`)}`,
          `DTEND:${window.SiteCalendarModel.icsTimestamp(`${date}T${opening.end}:00+08:00`)}`,
          'CATEGORIES:開放時段',
          `DESCRIPTION:${escapeIcsText(`風城部屋開放 ${opening.start}–${opening.end}（Asia/Taipei）${opening.note ? `；${opening.note}` : ''}`)}`,
          'URL:https://hackmd.io/@HsinchuPride/Welcome'
        ]));
      }
      day.setUTCDate(day.getUTCDate() + 1);
    }

    activityRecords.forEach(record => {
      const event = window.SiteCalendarModel.recordEvent(record);
      if (!event || event.end <= firstDateKey || event.start >= lastDateKey) return;
      const start = record.event_start;
      const end = record.event_end ? addIsoDays(record.event_end, 1) : addIsoDays(start, 1);
      calendarEvents.push(createIcsEvent(`activity-${record.id}`, record.title, [
        ...(event.allDay ? [
          `DTSTART;VALUE=DATE:${toIcsDate(start)}`,
          `DTEND;VALUE=DATE:${toIcsDate(end)}`
        ] : [
          `DTSTART:${window.SiteCalendarModel.icsTimestamp(record.event_start_at)}`,
          `DTEND:${window.SiteCalendarModel.icsTimestamp(record.event_end_at)}`
        ]),
        `DESCRIPTION:${escapeIcsText([record.summary, record.body].filter(Boolean).join('\n'))}`,
        ...(record.location ? [`LOCATION:${escapeIcsText(record.location)}`] : []),
        ...(Number.isFinite(record.location_latitude) && Number.isFinite(record.location_longitude) ? [`GEO:${record.location_latitude};${record.location_longitude}`] : []),
        ...(record.url ? [`URL:${escapeIcsText(resolveContentUrl(record.url))}`] : []),
        'CATEGORIES:風城部屋活動'
      ]));
    });

    const calendarName = '風城部屋開放時段、活動與台灣國定假日';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GisneyLand//Activity Calendar//ZH-TW',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
      'X-WR-TIMEZONE:Asia/Taipei',
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Taipei',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0800',
      'TZOFFSETTO:+0800',
      'TZNAME:CST',
      'END:STANDARD',
      'END:VTIMEZONE',
      ...calendarEvents.flat(),
      'END:VCALENDAR'
    ].map(foldIcsLine).join('\r\n');

    const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
    const downloadLink = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    downloadLink.href = objectUrl;
    downloadLink.download = 'gisneyland-activity-calendar.ics';
    downloadLink.hidden = true;
    document.body.append(downloadLink);
    downloadLink.click();
    window.setTimeout(() => {
      downloadLink.remove();
      URL.revokeObjectURL(objectUrl);
    }, 1000);
    status.textContent = `已匯出 ${calendarEvents.length} 筆開放時段、活動與政府假日，涵蓋 ${Math.min(...availableYears)}–${Math.max(...availableYears)} 年。`;
  } catch (error) {
    console.error('匯出行事曆失敗。', error);
    status.textContent = '無法匯出行事曆，請確認網路連線後再試。';
  } finally {
    button.disabled = false;
  }
}

function createIcsEvent(uid, summary, properties) {
  const timestamp = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@gisneyland.github.io`,
    `DTSTAMP:${timestamp}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    ...properties,
    'END:VEVENT'
  ];
}

function escapeIcsText(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replace(/\r\n?|\n/g, '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function foldIcsLine(line) {
  let folded = '';
  let lineBytes = 0;
  for (const character of line) {
    const characterBytes = new TextEncoder().encode(character).length;
    if (lineBytes + characterBytes > 75) {
      folded += '\r\n ';
      lineBytes = 1;
    }
    folded += character;
    lineBytes += characterBytes;
  }
  return folded;
}

function toIcsDate(value) {
  return String(value).replaceAll('-', '');
}

function toIcsUtc(date, time) {
  return `${toIcsDate(date)}T${time}Z`;
}

function resolveContentUrl(value) {
  try {
    return value.startsWith('/') && !value.startsWith('//')
      ? new URL(value, window.location.origin).href
      : new URL(value).href;
  } catch {
    return '';
  }
}

function renderEventDetails(container, record) {
  container.hidden = false;
  document.getElementById('activity-event-title').textContent = record.title;
  document.getElementById('activity-event-date').textContent = formatManagedEventDates(record);

  const location = document.getElementById('activity-event-location');
  location.textContent = record.location ? `地點：${record.location}` : '';
  location.hidden = !record.location;

  const summary = document.getElementById('activity-event-summary');
  summary.textContent = record.body || record.summary || '';
  summary.hidden = !summary.textContent;

  const link = document.getElementById('activity-event-link');
  link.hidden = true;
  link.removeAttribute('href');
  link.removeAttribute('target');
  link.removeAttribute('rel');
  if (record.url) {
    const safeLink = createContentLink(record.url, '活動詳情');
    if (safeLink) {
      link.href = safeLink.href;
      link.textContent = safeLink.textContent;
      if (safeLink.target) link.target = safeLink.target;
      if (safeLink.rel) link.rel = safeLink.rel;
      link.hidden = false;
    }
  }
}

function formatManagedEventDates(record) {
  if (record.is_all_day === false && record.event_start_at && record.event_end_at) {
    const formatter = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return `${formatter.format(new Date(record.event_start_at))} 至 ${formatter.format(new Date(record.event_end_at))}`;
  }
  return `${formatEventDateRange(record.event_start, record.event_end)}（整天）`;
}

async function fetchOpeningSettings() {
  const results = await Promise.all([
    window.questionnaireSupabase.from('site_opening_schedule').select('*'),
    window.questionnaireSupabase.from('site_opening_exceptions').select('*')
  ]);
  for (const result of results) {
    if (result.error && !['PGRST205', '42P01'].includes(result.error.code)) throw result.error;
  }
  return { schedule: results[0].data || [], exceptions: results[1].data || [] };
}

function formatEventDateRange(start, end) {
  const startDate = formatIsoDate(start);
  return end && end !== start ? `${startDate} 至 ${formatIsoDate(end)}` : startDate;
}

function formatIsoDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'long' })
    .format(new Date(year, month - 1, day));
}

function addIsoDays(value, days) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function createContentLink(value, label) {
  try {
    const url = value.startsWith('/') && !value.startsWith('//')
      ? new URL(value, window.location.origin)
      : new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    const link = document.createElement('a');
    link.href = url.href;
    link.textContent = label;
    if (url.origin !== window.location.origin) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    return link;
  } catch {
    return null;
  }
}