document.addEventListener('DOMContentLoaded', () => {
  const manager = document.getElementById('site-content-management');
  const contentTab = document.getElementById('admin-tab-content');
  const calendarElement = document.getElementById('site-content-calendar');
  const calendarOutlook = document.getElementById('site-content-calendar-outlook');
  const contentForm = document.getElementById('site-content-form');
  const contentEditor = document.getElementById('site-content-editor');
  const editorTitle = document.getElementById('site-content-editor-title');
  const calendarView = document.getElementById('site-content-calendar-view');
  const recordsView = document.getElementById('site-content-records-view');
  const contentList = document.getElementById('site-content-list');
  const contentStatus = document.getElementById('site-content-status');
  const calendarSubscribeButton = document.getElementById('calendar-subscribe-button');
  const formStatus = document.getElementById('site-content-form-status');
  const emptyState = document.getElementById('site-content-empty');
  if (!manager || !contentForm || !window.questionnaireSupabase) return;

  const supabase = window.questionnaireSupabase;
  const contentId = document.getElementById('site-content-id');
  const contentType = document.getElementById('site-content-type');
  const categoryInput = document.getElementById('site-content-category');
  const titleInput = document.getElementById('site-content-title-input');
  const summaryInput = document.getElementById('site-content-summary');
  const bodyInput = document.getElementById('site-content-body');
  const eventFields = document.getElementById('site-content-event-fields');
  const eventStartInput = document.getElementById('site-content-event-start');
  const eventEndInput = document.getElementById('site-content-event-end');
  const allDayInput = document.getElementById('site-content-all-day');
  const startTimeInput = document.getElementById('site-content-start-time');
  const endTimeInput = document.getElementById('site-content-end-time');
  const locationInput = document.getElementById('site-content-location');
  const urlInput = document.getElementById('site-content-url');
  const publishedInput = document.getElementById('site-content-published');
  const filterSelect = document.getElementById('site-content-filter');
  const saveButton = contentForm.querySelector('[type="submit"]');
  const model = window.SiteCalendarModel;
  const eventPlace = new SiteEventPlace({ input: locationInput, form: contentForm });
  let calendarUI = null;
  const openingHours = new SiteOpeningHours({ client: supabase, getDate: () => calendarUI?.selected || model.dateKey(new Date()), onChange: () => renderCalendar() });
  const governmentCalendarCache = new Map();
  const governmentCalendarData = new Map();
  const governmentCalendarRequested = new Set();
  const governmentCalendarFailures = new Set();
  const almanacCache = new Map();
  const weatherForecast = new Map();
  const governmentCalendarDataUrl = 'https://raw.githubusercontent.com/ruyut/TaiwanCalendar/master/data';
  const defaultForecastLocation = { name: '風城部屋・新竹', latitude: 24.8036, longitude: 120.9719 };
  let forecastLocation = { ...defaultForecastLocation };
  let weatherRequest = null;
  let locationSearchRequest = null;
  let locationResults = [];
  let locationSelectionVersion = 0;
  const almanacTraditionalizer = window.OpenCC?.Converter?.({ from: 'cn', to: 'tw' });
  let records = [];
  let activeUserId = null;
  let screeningPlanCalendar = null;
  let calendar = null;
  let calendarViewType = 'dayGridMonth';
  let weatherForecastLoaded = false;
  let weatherForecastFailed = false;
  let editorDirty = false;
  let editorOpener = null;

  document.addEventListener('screening-plan-calendar-change', event => {
    screeningPlanCalendar = event.detail?.slot ? event.detail : null;
    renderCalendar();
  });
  calendarSubscribeButton?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('open-screening-calendar-subscription'));
  });

  manager.querySelectorAll('[data-content-filter]').forEach(button => button.addEventListener('click', () => {
    filterSelect.value = button.dataset.contentFilter;
    filterSelect.dispatchEvent(new Event('change'));
  }));
  manager.querySelectorAll('[data-content-view]').forEach(button => button.addEventListener('click', () => {
    const isCalendar = button.dataset.contentView === 'calendar';
    calendarView.hidden = !isCalendar;
    recordsView.hidden = isCalendar;
    manager.querySelectorAll('[data-content-view]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
    if (isCalendar) window.requestAnimationFrame(() => {
      if (calendar) calendar.updateSize();
      else initializeCalendar();
    });
  }));
  contentForm.addEventListener('input', () => { editorDirty = true; });
  contentForm.addEventListener('change', () => { editorDirty = true; });
  document.getElementById('close-site-content-editor').addEventListener('click', () => closeContentEditor());
  contentEditor.addEventListener('cancel', event => {
    event.preventDefault();
    closeContentEditor();
  });
  document.addEventListener('click', event => {
    manager.querySelectorAll('.content-action-menu[open]').forEach(menu => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
  manager.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menu = event.target.closest('.content-action-menu[open]');
    if (menu) { menu.open = false; menu.querySelector('summary').focus(); }
  });

  const locationStatus = document.getElementById('calendar-location-status');
  const locationResultsSelect = document.getElementById('calendar-location-results');
  const locateButton = document.getElementById('calendar-locate');
  document.getElementById('calendar-location-form')?.addEventListener('submit', searchForecastLocations);
  locateButton?.addEventListener('click', detectForecastLocation);
  document.getElementById('calendar-location-reset')?.addEventListener('click', () => setForecastLocation(defaultForecastLocation));
  locationResultsSelect?.addEventListener('change', () => {
    if (locationResultsSelect.value === '') return;
    const result = locationResults[Number(locationResultsSelect.value)];
    if (result) setForecastLocation(result);
  });

  document.getElementById('new-site-content-button').addEventListener('click', () => openContentForm());
  contentTab?.addEventListener('click', () => {
    window.requestAnimationFrame(() => {
      if (calendar) {
        calendar.updateSize();
        return;
      }
      initializeCalendar();
    });
  });

  document.getElementById('cancel-site-content-button').addEventListener('click', () => closeContentEditor());

  document.getElementById('refresh-site-content-button').addEventListener('click', async () => {
    await loadRecords();
    await openingHours.load();
  });
  filterSelect.addEventListener('change', () => {
    manager.querySelectorAll('[data-content-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.contentFilter === filterSelect.value)));
    renderRecords();
    renderCalendar();
  });
  contentType.addEventListener('change', updateEventFields);
  allDayInput.addEventListener('change', updateEventFields);
  contentForm.addEventListener('submit', saveRecord);
  contentList.addEventListener('click', handleRecordAction);

  document.addEventListener('staff-profile-ready', event => {
    const profile = event.detail;
    activeUserId = profile?.user_id || null;
    const canManage = window.StaffAccess.canAccess(profile, 'site_content.manage');
    if (!canManage) closeContentEditor(true);
    manager.hidden = !canManage;
    updateContentTabVisibility();
    if (!canManage) return;
    loadRecords();
    openingHours.load();
  });

  function updateContentTabVisibility() {
    if (!contentTab) return;
    contentTab.hidden = manager.hidden;
    if (manager.hidden && contentTab.getAttribute('aria-selected') === 'true') {
      document.getElementById('admin-tab-questionnaire')?.click();
    }
  }

  async function loadRecords() {
    showStatus(contentStatus, '新聞與活動載入中。');
    const loaded = [];
    try {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('site_content').select('*')
          .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499);
        if (error) throw error;
        loaded.push(...(data || []));
        if (!data || data.length < 500) break;
      }
    } catch {
      showStatus(contentStatus, '無法載入內容。請先在 Supabase 執行 schema.sql 的 site_content migration。', true);
      return;
    }

    records = loaded;
    renderRecords();
    renderCalendar();
    contentStatus.hidden = true;
  }

  function openContentForm(startDate = '') {
    contentForm.reset();
    contentId.value = '';
    contentType.value = startDate || filterSelect.value === 'event' ? 'event' : 'news';
    updateEventFields();
    if (startDate) {
      eventStartInput.value = startDate.slice(0, 10);
      eventEndInput.value = startDate.slice(0, 10);
      if (startDate.includes('T')) {
        allDayInput.checked = false;
        startTimeInput.value = startDate.slice(11, 16);
        const end = new Date(`${startDate.slice(0, 16)}:00+08:00`);
        end.setTime(end.getTime() + 3600000);
        eventEndInput.value = model.dateKey(end);
        endTimeInput.value = model.localDateTime(end).slice(11, 16);
        updateEventFields();
      }
    }
    eventPlace.reset();
    formStatus.hidden = true;
    showContentEditor();
  }

  function showContentEditor() {
    editorDirty = false;
    editorOpener = document.activeElement;
    contentForm.hidden = false;
    updateEditorTitle();
    if (!contentEditor.open) contentEditor.showModal();
    titleInput.focus();
    if (contentType.value === 'event') window.requestAnimationFrame(() => eventPlace.show());
  }

  function updateEditorTitle() {
    editorTitle.textContent = `${contentId.value ? '編輯' : '新增'}${contentType.value === 'event' ? '活動' : '新聞'}`;
  }

  function closeContentEditor(force = false) {
    if (!contentEditor.open) return;
    if (!force && (saveButton.disabled || (editorDirty && !window.confirm('尚有未儲存的變更，確定放棄？')))) return;
    contentEditor.close();
    contentForm.hidden = true;
    formStatus.hidden = true;
    editorDirty = false;
    const target = editorOpener?.isConnected && editorOpener !== document.body ? editorOpener : document.getElementById('new-site-content-button');
    target?.focus();
  }

  function initializeCalendar() {
    if (!calendarElement || !window.FullCalendar?.Calendar) {
      showStatus(contentStatus, '行事曆載入失敗，請重新整理頁面。', true);
      return;
    }

    calendar = new FullCalendar.Calendar(calendarElement, {
      initialView: 'dayGridMonth',
      locale: 'zh-tw',
      timeZone: 'Asia/Taipei',
      height: 'auto',
      lazyFetching: false,
      initialDate: model.dateKey(new Date()),
      now: () => model.localDateTime(new Date()),
      nowIndicator: true,
      scrollTime: '00:00:00',
      slotMinTime: '00:00:00',
      slotMaxTime: '24:00:00',
      slotDuration: '00:30:00',
      slotLabelInterval: '01:00:00',
      slotLabelContent: info => info.date.toISOString().slice(11, 16),
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      allDayText: '整天',
      firstDay: 0,
      listDayFormat: { month: 'numeric', day: 'numeric', weekday: 'short' },
      listDaySideFormat: false,
      noEventsText: '這個期間沒有安排',
      fixedWeekCount: false,
      dayMaxEvents: true,
      dayCellContent: ({ date, view }) => {
        if (!view.type.startsWith('dayGrid')) return { domNodes: [] };
        const dateKey = formatTaipeiDateKey(date);
        const almanac = getAlmanacInfo(dateKey);
        const dayContent = document.createElement('span');
        dayContent.className = 'admin-calendar-day-content';

        const dayNumber = document.createElement('span');
        dayNumber.className = 'admin-calendar-day-number notranslate';
        dayNumber.setAttribute('translate', 'no');
        dayNumber.textContent = String(date.getDate());
        dayContent.append(dayNumber);

        if (almanac) {
          const lunarDate = document.createElement('span');
          lunarDate.className = 'admin-calendar-lunar-date notranslate';
          lunarDate.setAttribute('translate', 'no');
          lunarDate.textContent = almanac.lunarDayLabel;
          dayContent.append(lunarDate);

          if (almanac.solarTerm) {
            const solarTerm = document.createElement('span');
            solarTerm.className = 'admin-calendar-solar-term notranslate';
            solarTerm.setAttribute('translate', 'no');
            solarTerm.textContent = almanac.solarTerm;
            dayContent.append(solarTerm);
          }
        }

        const forecast = weatherForecast.get(dateKey);
        if (forecast) {
          const weather = createWeatherIcon(forecast.weatherCode);
          weather.classList.add('admin-calendar-day-weather');
          weather.setAttribute('aria-label', `${weatherForecastDescription(forecast.weatherCode)}，最高 ${Math.round(forecast.maxTemperature)} 度`);
          dayContent.append(weather);
        }

        dayContent.title = getCalendarDateDetails(dateKey);
        dayContent.setAttribute('aria-label', dayContent.title);
        return { domNodes: [dayContent] };
      },
      dayHeaderContent: info => {
        if (!info.view.type.startsWith('timeGrid')) return info.text;
        return { domNodes: [createCalendarDayHeader(info.date)] };
      },
      headerToolbar: false,
      buttonText: { today: '今天', month: '月', week: '週', day: '日', list: '列表' },
      datesSet: info => {
        const nextViewType = info.view.type;
        const viewChanged = calendarViewType !== nextViewType;
        calendarViewType = nextViewType;
        calendarUI?.onDatesSet(info);
        if (viewChanged) window.requestAnimationFrame(() => calendar?.refetchEvents());
        window.requestAnimationFrame(updateCalendarButtonLabels);
      },
      events: (fetchInfo, successCallback, failureCallback) => {
        try {
          successCallback(fetchCalendarEvents(fetchInfo));
        } catch (error) {
          failureCallback(error);
        }
      },
      dateClick: info => openContentForm(info.dateStr),
      eventClick: info => {
        const record = info.event.extendedProps.record;
        if (record) editRecord(record);
        else if (info.event.extendedProps.kind === 'government-holiday') {
          showStatus(contentStatus, `${info.event.extendedProps.description}：${info.event.startStr}`);
        } else if (info.event.extendedProps.kind === 'government-makeup-workday') {
          showStatus(contentStatus, `${info.event.extendedProps.description}：${info.event.startStr}`);
        } else if (info.event.extendedProps.kind === 'solar-term') {
          showStatus(contentStatus, `${info.event.extendedProps.description}：${info.event.startStr}`);
        } else if (info.event.extendedProps.kind === 'screening-plan') {
          showStatus(contentStatus, info.event.extendedProps.description);
        }
      },
      eventDidMount: info => {
        const { kind, description, record } = info.event.extendedProps;
        const hoverText = kind === 'opening-hours'
          ? getCalendarDateDetails(info.event.startStr.slice(0, 10))
          : kind === 'government-holiday' || kind === 'government-makeup-workday'
            ? `${description || info.event.title}：${info.event.startStr}`
            : kind === 'solar-term'
              ? `${description}：${info.event.startStr}`
              : kind === 'screening-plan'
                ? description
            : record
              ? [record.title, record.location, record.summary].filter(Boolean).join('\n')
              : info.event.title;
        info.el.title = hoverText;
        info.el.setAttribute('aria-label', hoverText);
        if (info.event.endStr && !info.event.allDay) info.el.dataset.end = info.event.endStr.slice(0, 16);
        window.requestAnimationFrame(() => calendarUI?.updatePast());
      }
    });
    calendarUI = new SiteCalendarUI({ calendar, element: calendarElement,
      getEvents: (start, end) => fetchCalendarEvents({ start: new Date(`${start}T00:00:00Z`), end: new Date(`${end}T00:00:00Z`) }, 'stream'),
      onEvent: editRecord, onDate: openContentForm });
    calendar.render();
    renderCalendar();
    renderCalendarOutlook();
    loadWeatherForecast();
    locationStatus.textContent = `${forecastLocation.name} · 台北時間 UTC+8`;
    document.dispatchEvent(new CustomEvent('calendar-location-change', { detail: forecastLocation }));
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(permission => {
        if (permission.state === 'granted' && forecastLocation.name === defaultForecastLocation.name) detectForecastLocation();
      }).catch(() => {});
    }
  }

  function renderCalendar() {
    if (!calendar) return;
    calendar.refetchEvents();
    calendarUI?.refresh();
  }

  function fetchCalendarEvents(fetchInfo, viewType = calendarViewType) {
    const filter = filterSelect.value;
    const visibleRecords = records.filter(record => filter === 'all' || record.content_type === filter);
    const contentEvents = visibleRecords.map(record => {
      const event = model.recordEvent(record);
      if (!event) return null;

      return {
        ...event,
        classNames: [
          `site-content-event-${record.content_type}`,
          record.is_published ? 'is-published' : 'is-draft'
        ],
        extendedProps: { record }
      };
    }).filter(Boolean);

    const lastVisibleDate = new Date(fetchInfo.end.getTime() - 1);
    const firstYear = Number(formatTaipeiDateKey(fetchInfo.start).slice(0, 4));
    const lastYear = Number(formatTaipeiDateKey(lastVisibleDate).slice(0, 4));
    const years = Array.from({ length: lastYear - firstYear + 1 }, (_value, index) => firstYear + index);
    years.forEach(year => {
      if (governmentCalendarData.has(year) || governmentCalendarRequested.has(year)) return;
      governmentCalendarRequested.add(year);
      fetchGovernmentCalendarYear(year)
        .then(days => {
          governmentCalendarData.set(year, days);
          governmentCalendarFailures.delete(year);
          governmentCalendarRequested.delete(year);
          renderCalendar();
        })
        .catch(() => {
          governmentCalendarRequested.delete(year);
          governmentCalendarFailures.add(year);
          updateGovernmentCalendarStatus(years);
        });
    });
    updateGovernmentCalendarStatus(years);
    const governmentDays = years.flatMap(year => governmentCalendarData.get(year) || []);
    const governmentDaysByDate = new Map(governmentDays.map(day => [formatGovernmentDate(day.date), day]));
    const events = [...contentEvents];
    const plannedScreening = screeningPlanCalendar;
    if (plannedScreening?.slot?.dateKey) {
      const { slot, nickname, userId } = plannedScreening;
      const startAt = new Date(`${slot.dateKey}T${slot.startTime}:00+08:00`);
      const endAt = new Date(`${slot.dateKey}T${slot.endTime}:00+08:00`);
      if (startAt < fetchInfo.end && endAt > fetchInfo.start) {
        const description = [
          `篩檢員：${nickname}`,
          `安排：${slot.name || '篩檢'}`,
          `地點：${slot.place.label}`
        ].join('\n');
        events.push({
          id: `screening-plan-${userId}-${slot.dateKey}-${slot.startTime}`,
          title: `${nickname}・篩檢${slot.name ? `・${slot.name}` : ''}`,
          start: `${slot.dateKey}T${slot.startTime}:00`,
          end: `${slot.dateKey}T${slot.endTime}:00`,
          allDay: false,
          classNames: ['screening-plan-event'],
          extendedProps: { kind: 'screening-plan', description, screeningPlan: plannedScreening }
        });
      }
    }
    const visibleDate = new Date(`${formatTaipeiDateKey(fetchInfo.start)}T00:00:00Z`);
    const lastDate = new Date(`${formatTaipeiDateKey(lastVisibleDate)}T00:00:00Z`);
    const isTimeGrid = viewType.startsWith('timeGrid');
    const isListView = viewType.startsWith('list') || viewType === 'stream';

    while (visibleDate <= lastDate) {
      const date = visibleDate.toISOString().slice(0, 10);
      const governmentDay = governmentDaysByDate.get(date);
      const description = String(governmentDay?.description || '').trim();
      const isNamedHoliday = Boolean(governmentDay?.isHoliday && description);
      const isMakeupWorkday = !governmentDay?.isHoliday && /補行上班|調整上班/.test(description);
      const almanac = getAlmanacInfo(date);

      if (isNamedHoliday) {
        events.push({
          id: `admin-holiday-${date}`,
          title: description,
          start: date,
          allDay: true,
          classNames: ['dgpa-holiday-event'],
          extendedProps: { kind: 'government-holiday', description }
        });
      } else if (isMakeupWorkday) {
        events.push({
          id: `admin-makeup-${date}`,
          title: `${description}（補班）`,
          start: date,
          allDay: true,
          classNames: ['dgpa-makeup-event'],
          extendedProps: { kind: 'government-makeup-workday', description }
        });
      }

      if (isListView && almanac?.solarTerm) {
        events.push({
          id: `admin-solar-term-${date}`,
          title: `節氣 ${almanac.solarTerm}`,
          start: date,
          allDay: true,
          classNames: ['solar-term-event'],
          extendedProps: { kind: 'solar-term', description: almanac.solarTerm }
        });
      }

      const opening = openingHours.get(date, isNamedHoliday);
      if (!opening.closed) {
        events.push({
          id: `admin-opening-hours-${date}`,
          title: isListView ? `${opening.exception ? '加開／調整開放' : '開放'}${opening.note ? ` · ${opening.note}` : ''}` : '',
          start: isTimeGrid || isListView ? `${date}T${opening.start}:00` : date,
          end: isTimeGrid || isListView ? `${date}T${opening.end}:00` : addCalendarDay(date),
          allDay: !isTimeGrid && !isListView,
          display: isListView ? 'auto' : 'background',
          classNames: ['opening-hours-event', opening.exception ? 'opening-exception-event' : ''],
          extendedProps: { kind: 'opening-hours' }
        });
      } else if (isListView || opening.exception) {
        events.push({ id: `admin-closed-${date}`, title: `休館${opening.note ? ` · ${opening.note}` : ''}`, start: date, end: addCalendarDay(date), allDay: true,
          classNames: ['opening-closed-event'], extendedProps: { kind: 'opening-hours' } });
      }

      visibleDate.setUTCDate(visibleDate.getUTCDate() + 1);
    }

    return events;
  }

  function fetchGovernmentCalendarYear(year) {
    if (governmentCalendarCache.has(year)) return governmentCalendarCache.get(year);
    const request = fetch(`${governmentCalendarDataUrl}/${year}.json`, { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Government calendar ${year} unavailable`);
        return response.json();
      })
      .catch(error => {
        governmentCalendarCache.delete(year);
        throw error;
      });
    governmentCalendarCache.set(year, request);
    return request;
  }

  function updateGovernmentCalendarStatus(years) {
    if (calendarUI && !years.includes(Number(calendarUI.selected.slice(0, 4)))) return;
    const missing = years.filter(year => governmentCalendarFailures.has(year) && !governmentCalendarData.has(year));
    const status = document.getElementById('calendar-source-status');
    status.hidden = !missing.length;
    status.textContent = missing.length ? `${missing.join('、')} 年政府日曆尚未取得，國定假日可能不完整；營業時段仍會套用已儲存設定。` : '';
  }

  async function loadWeatherForecast() {
    if (weatherForecastLoaded) return;
    weatherForecastLoaded = true;
    weatherRequest?.abort();
    const request = new AbortController();
    weatherRequest = request;
    const timeout = window.setTimeout(() => request.abort(), 15000);
    try {
      const parameters = new URLSearchParams({
        latitude: String(forecastLocation.latitude), longitude: String(forecastLocation.longitude),
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        timezone: 'Asia/Taipei', forecast_days: '7'
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`, { signal: request.signal });
      if (!response.ok) throw new Error('Weather forecast unavailable');
      const payload = await response.json();
      if (weatherRequest !== request) return;
      payload.daily.time.forEach((date, index) => {
        weatherForecast.set(date, {
          weatherCode: payload.daily.weather_code[index],
          maxTemperature: payload.daily.temperature_2m_max[index],
          minTemperature: payload.daily.temperature_2m_min[index],
          precipitationProbability: payload.daily.precipitation_probability_max[index]
        });
      });
    } catch {
      if (weatherRequest !== request) return;
      weatherForecastFailed = true;
    } finally {
      window.clearTimeout(timeout);
    }
    renderCalendarOutlook();
    calendar?.refetchEvents();
  }

  function setForecastLocation(location) {
    locationSelectionVersion += 1;
    forecastLocation = { ...location };
    weatherRequest?.abort();
    weatherForecast.clear();
    weatherForecastLoaded = false;
    weatherForecastFailed = false;
    locationStatus.textContent = `${location.name} · ${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)} · 台北時間 UTC+8`;
    document.dispatchEvent(new CustomEvent('calendar-location-change', { detail: forecastLocation }));
    renderCalendarOutlook();
    calendar?.refetchEvents();
    loadWeatherForecast();
  }

  async function searchForecastLocations(event) {
    event.preventDefault();
    const query = document.getElementById('calendar-location-query').value.trim();
    if (!query) return;
    locationSearchRequest?.abort();
    const request = new AbortController();
    locationSearchRequest = request;
    const timeout = window.setTimeout(() => request.abort(), 12000);
    locationStatus.textContent = '搜尋地點中…';
    locationResultsSelect.hidden = true;
    try {
      const parameters = new URLSearchParams({ name: query, count: '8', language: 'zh', format: 'json' });
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`, { signal: request.signal });
      if (!response.ok) throw new Error('Location search unavailable');
      const payload = await response.json();
      if (locationSearchRequest !== request) return;
      locationResults = (payload.results || []).map(result => ({
        name: traditionalizeAlmanacText([...new Set((result.country_code === 'TW'
          ? [result.name, '台灣']
          : [result.name, result.admin1, result.country]).filter(Boolean))].join('・')),
        latitude: result.latitude, longitude: result.longitude
      }));
      locationResultsSelect.replaceChildren(new Option('選擇地點', ''));
      locationResults.forEach((result, index) => locationResultsSelect.add(new Option(result.name, String(index))));
      locationResultsSelect.hidden = !locationResults.length;
      locationStatus.textContent = locationResults.length ? `找到 ${locationResults.length} 個地點。` : '找不到地點，請試城市英文名稱。';
    } catch {
      if (locationSearchRequest === request) locationStatus.textContent = '地點搜尋失敗，請稍後再試。';
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function detectForecastLocation() {
    if (!navigator.geolocation) {
      locationStatus.textContent = '瀏覽器不支援定位，請搜尋地點。';
      return;
    }
    locateButton.disabled = true;
    const selectionVersion = ++locationSelectionVersion;
    locationStatus.textContent = '取得目前位置中…';
    navigator.geolocation.getCurrentPosition(position => {
      locateButton.disabled = false;
      if (selectionVersion !== locationSelectionVersion) return;
      setForecastLocation({ name: '目前位置', latitude: position.coords.latitude, longitude: position.coords.longitude });
    }, error => {
      locateButton.disabled = false;
      if (selectionVersion !== locationSelectionVersion) return;
      locationStatus.textContent = error.code === 1 ? '定位未授權，請搜尋地點或調整瀏覽器權限。' : '無法取得位置，請搜尋地點。';
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }

  function renderCalendarOutlook() {
    if (!calendarOutlook) return;
    document.getElementById('calendar-environment-location-summary').textContent = forecastLocation.name;
    const weatherSummary = document.getElementById('calendar-environment-weather-summary');
    const todayForecast = weatherForecast.get(formatTaipeiDateKey(new Date()));
    weatherSummary.replaceChildren();
    if (todayForecast) {
      weatherSummary.append(createWeatherIcon(todayForecast.weatherCode), document.createTextNode(`${Math.round(todayForecast.minTemperature)}–${Math.round(todayForecast.maxTemperature)}°C`));
      weatherSummary.title = weatherForecastDescription(todayForecast.weatherCode);
    } else {
      weatherSummary.textContent = weatherForecastFailed ? '天氣未連線' : '天氣載入中';
      weatherSummary.removeAttribute('title');
    }
    calendarOutlook.replaceChildren();

    const heading = document.createElement('span');
    heading.className = 'site-content-calendar-outlook-heading';
    heading.textContent = `${forecastLocation.name}・未來 7 日`;
    heading.append(document.createTextNode(' · '));
    const sourceLink = document.createElement('a');
    sourceLink.className = 'site-content-calendar-outlook-source';
    sourceLink.href = 'https://open-meteo.com/';
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = 'Open-Meteo';
    heading.append(sourceLink);

    const days = document.createElement('div');
    days.className = 'site-content-calendar-outlook-days';
    const details = document.createElement('p');
    details.className = 'site-content-calendar-outlook-details';
    details.hidden = true;
    const firstDay = new Date(`${formatTaipeiDateKey(new Date())}T00:00:00Z`);

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(firstDay);
      date.setUTCDate(date.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const almanac = getAlmanacInfo(dateKey);
      const forecast = weatherForecast.get(dateKey);
      const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'short', timeZone: 'Asia/Taipei' })
        .format(new Date(`${dateKey}T12:00:00+08:00`))
        .replace('週', '');
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'site-content-calendar-outlook-day';

      const dateLabel = document.createElement('span');
      dateLabel.className = 'site-content-calendar-outlook-date';
      dateLabel.textContent = `${Number(dateKey.slice(8))} ${weekday}`;
      item.append(dateLabel);

      if (forecast) {
        const weatherRow = document.createElement('span');
        weatherRow.className = 'site-content-calendar-outlook-weather';
        const icon = createWeatherIcon(forecast.weatherCode);
        icon.setAttribute('aria-hidden', 'true');
        const temperature = document.createElement('span');
        temperature.textContent = `${Math.round(forecast.maxTemperature)}°`;
        weatherRow.append(icon, temperature);
        item.append(weatherRow);
      } else {
        const weatherUnavailable = document.createElement('span');
        weatherUnavailable.className = 'site-content-calendar-outlook-weather unavailable';
        weatherUnavailable.textContent = weatherForecastFailed ? '—' : '…';
        item.append(weatherUnavailable);
      }

      if (almanac) {
        const lunarDate = document.createElement('span');
        lunarDate.className = 'site-content-calendar-outlook-lunar';
        lunarDate.textContent = almanac.lunarDayLabel;
        item.append(lunarDate);
        if (almanac.solarTerm) {
          const term = document.createElement('span');
          term.className = 'site-content-calendar-outlook-term';
          term.textContent = almanac.solarTerm;
          item.append(term);
        }
      }

      item.title = getCalendarDateDetails(dateKey);
      item.setAttribute('aria-label', item.title);
      item.addEventListener('click', () => {
        calendarUI?.goTo(dateKey);
        document.dispatchEvent(new CustomEvent('calendar-date-change', { detail: dateKey }));
        details.textContent = getCalendarDateDetails(dateKey);
        details.hidden = false;
      });
      days.append(item);
    }

    calendarOutlook.append(heading, days, details);
  }

  function createCalendarDayHeader(date) {
    const dateKey = formatTaipeiDateKey(date);
    const almanac = getAlmanacInfo(dateKey);
    const header = document.createElement('span');
    header.className = 'admin-calendar-day-header';

    const solarDate = document.createElement('span');
    solarDate.className = 'admin-calendar-header-solar-date';
    const weekday = new Intl.DateTimeFormat('zh-TW', {
      weekday: 'narrow',
      timeZone: 'Asia/Taipei'
    }).format(date);
    solarDate.textContent = `${weekday}${Number(dateKey.slice(8))}`;
    header.append(solarDate);

    if (almanac) {
      const lunarDate = document.createElement('span');
      lunarDate.className = 'admin-calendar-header-lunar-date';
      lunarDate.textContent = almanac.lunarDayLabel;
      header.append(lunarDate);
      if (almanac.solarTerm) {
        const term = document.createElement('span');
        term.className = 'admin-calendar-solar-term';
        term.textContent = almanac.solarTerm;
        header.append(term);
      }
    }

    const forecast = weatherForecast.get(dateKey);
    if (forecast) {
      const weather = document.createElement('span');
      weather.className = 'admin-calendar-header-weather';
      weather.append(createWeatherIcon(forecast.weatherCode), document.createTextNode(`${Math.round(forecast.minTemperature)}°–${Math.round(forecast.maxTemperature)}°`));
      header.append(weather);
    }

    header.title = getCalendarDateDetails(dateKey);
    header.setAttribute('aria-label', header.title);
    return header;
  }

  function getAlmanacInfo(dateKey) {
    if (almanacCache.has(dateKey)) return almanacCache.get(dateKey);
    if (!window.Solar?.fromYmd) return null;
    const [year, month, day] = dateKey.split('-').map(Number);
    const lunar = window.Solar.fromYmd(year, month, day).getLunar();
    const lunarMonth = traditionalizeAlmanacText(lunar.getMonthInChinese());
    const lunarDay = traditionalizeAlmanacText(lunar.getDayInChinese());
    const solarTerm = traditionalizeSolarTerm(lunar.getJieQi());
    const info = {
      lunarDayLabel: lunar.getDay() === 1 ? `${lunarMonth}月` : lunarDay,
      lunarDateLabel: `${lunarMonth}月${lunarDay}`,
      solarTerm,
      suitable: lunar.getDayYi().filter(item => item !== '无').map(traditionalizeAlmanacText),
      unsuitable: lunar.getDayJi().filter(item => item !== '无').map(traditionalizeAlmanacText)
    };
    almanacCache.set(dateKey, info);
    return info;
  }

  function getCalendarDateDetails(dateKey) {
    const almanac = getAlmanacInfo(dateKey);
    const forecast = weatherForecast.get(dateKey);
    const details = [`國曆 ${dateKey}`];
    const [year, month, day] = dateKey.split('-').map(Number);
    const governmentDay = (governmentCalendarData.get(year) || [])
      .find(item => formatGovernmentDate(item.date) === dateKey);
    const holidayDescription = String(governmentDay?.description || '').trim();
    const isNamedHoliday = Boolean(governmentDay?.isHoliday && holidayDescription);
    const opening = openingHours.get(dateKey, isNamedHoliday);

    if (almanac) {
      details.push(`農曆 ${almanac.lunarDateLabel}`);
      if (almanac.solarTerm) details.push(`節氣 ${almanac.solarTerm}`);
      if (almanac.suitable.length) details.push(`宜 ${almanac.suitable.join('、')}`);
      if (almanac.unsuitable.length) details.push(`忌 ${almanac.unsuitable.join('、')}`);
    }
    if (isNamedHoliday) {
      details.push(holidayDescription);
    }
    details.push(opening.closed ? '休館' : `開放時間 ${opening.start}–${opening.end}`);
    if (opening.note) details.push(opening.note);
    if (forecast) {
      details.push(`${weatherForecastDescription(forecast.weatherCode)}，${Math.round(forecast.minTemperature)}°–${Math.round(forecast.maxTemperature)}°，降雨機率 ${forecast.precipitationProbability ?? '—'}%`);
    } else if (weatherForecastFailed) {
      details.push('天氣預報暫時無法載入');
    }
    return details.join('\n');
  }

  function createWeatherIcon(weatherCode) {
    const iconNames = {
      sunny: 'wb_sunny',
      cloudy: 'cloud',
      partlyCloudy: 'wb_cloudy',
      fog: 'blur_on',
      rain: 'umbrella',
      snow: 'ac_unit',
      thunderstorm: 'flash_on'
    };
    const icon = document.createElement('span');
    icon.className = 'material-icons notranslate';
    icon.setAttribute('translate', 'no');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = iconNames[weatherForecastKind(weatherCode)];
    return icon;
  }

  function weatherForecastKind(weatherCode) {
    if ([0].includes(weatherCode)) return 'sunny';
    if ([1].includes(weatherCode)) return 'partlyCloudy';
    if ([2].includes(weatherCode)) return 'partlyCloudy';
    if ([3].includes(weatherCode)) return 'cloudy';
    if ([45, 48].includes(weatherCode)) return 'fog';
    if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'snow';
    if ([95, 96, 99].includes(weatherCode)) return 'thunderstorm';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return 'rain';
    return 'cloudy';
  }

  function weatherForecastDescription(weatherCode) {
    const descriptions = {
      0: '晴朗', 1: '晴時多雲', 2: '多雲時晴', 3: '陰天', 45: '有霧', 48: '霧凇',
      51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 56: '凍毛毛雨', 57: '凍毛毛雨',
      61: '小雨', 63: '中雨', 65: '大雨', 66: '凍雨', 67: '凍雨', 71: '小雪',
      73: '中雪', 75: '大雪', 77: '雪粒', 80: '陣雨', 81: '陣雨', 82: '強陣雨',
      85: '陣雪', 86: '強陣雪', 95: '雷雨', 96: '雷雨伴隨冰雹', 99: '強雷雨伴隨冰雹'
    };
    return descriptions[weatherCode] || '天氣狀況未知';
  }

  function traditionalizeSolarTerm(value) {
    return traditionalizeAlmanacText(value);
  }

  function traditionalizeAlmanacText(value) {
    return almanacTraditionalizer ? almanacTraditionalizer(String(value)) : String(value);
  }

  function updateCalendarButtonLabels() {
    const labels = [
      ['.fc-dayGridMonth-button', '月檢視'],
      ['.fc-timeGridWeek-button', '週檢視'],
      ['.fc-timeGridDay-button', '日檢視'],
      ['.fc-listMonth-button', '列表檢視']
    ];
    labels.forEach(([selector, label]) => {
      const button = calendarElement?.querySelector(selector);
      if (!button) return;
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }

  function formatGovernmentDate(value) {
    const digits = String(value || '').replaceAll('-', '');
    if (!/^\d{8}$/.test(digits)) return '';
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  function formatTaipeiDateKey(value) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(value).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function formatCalendarDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function addCalendarDay(value) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + 1));
    return date.toISOString().slice(0, 10);
  }

  function renderRecords() {
    const filter = filterSelect.value;
    const visibleRecords = records.filter(record => filter === 'all' || record.content_type === filter);
    contentList.replaceChildren();
    emptyState.hidden = visibleRecords.length > 0;
    document.getElementById('site-content-count').textContent = `${visibleRecords.length} 筆內容`;
    emptyState.textContent = filter === 'all' ? '目前尚無新聞或活動。' : `目前沒有${filter === 'event' ? '活動' : '新聞'}。`;

    visibleRecords.forEach(record => {
      const item = document.createElement('tr');
      item.className = 'site-content-item';

      const dateCell = document.createElement('td');
      dateCell.className = 'site-content-item-date';
      dateCell.textContent = record.content_type === 'event'
        ? formatRecordDates(record)
        : formatTimestamp(record.published_at || record.created_at);
      const information = document.createElement('td');
      information.className = 'site-content-item-info';
      const heading = document.createElement('h3');
      heading.textContent = record.title;
      const metadata = document.createElement('p');
      metadata.className = 'admin-muted';
      const typeLabel = record.content_type === 'event' ? '活動' : '新聞';
      metadata.textContent = [typeLabel, record.category, record.location]
        .filter(Boolean)
        .join(' · ');
      const summary = document.createElement('p');
      summary.className = 'site-content-item-summary';
      summary.textContent = record.summary;
      information.append(heading, metadata, summary);

      const state = document.createElement('td');
      state.className = 'site-content-item-state';
      const publishSwitch = createActionButton('toggle', record.id, `${record.is_published ? '下架' : '上架'}「${record.title}」`);
      publishSwitch.className = 'content-publish-switch';
      publishSwitch.setAttribute('role', 'switch');
      publishSwitch.setAttribute('aria-checked', String(record.is_published));
      const track = document.createElement('span');
      track.className = 'content-switch-track';
      track.setAttribute('aria-hidden', 'true');
      publishSwitch.replaceChildren(track, document.createTextNode(record.is_published ? '已上架' : '草稿'));
      state.append(publishSwitch);

      const actions = document.createElement('td');
      actions.className = 'site-content-item-actions';
      actions.append(createActionButton('edit', record.id, `編輯「${record.title}」`));
      const menu = document.createElement('details');
      menu.className = 'content-action-menu';
      const menuButton = document.createElement('summary');
      menuButton.title = `更多操作：${record.title}`;
      menuButton.setAttribute('aria-label', menuButton.title);
      const menuIcon = document.createElement('span');
      menuIcon.className = 'material-icons notranslate';
      menuIcon.setAttribute('translate', 'no');
      menuIcon.setAttribute('aria-hidden', 'true');
      menuIcon.textContent = 'more_vert';
      menuButton.append(menuIcon);
      const deleteButton = createActionButton('delete', record.id, '刪除');
      deleteButton.classList.remove('icon-only');
      deleteButton.classList.add('content-delete-button');
      deleteButton.append(document.createTextNode('刪除'));
      menu.append(menuButton, deleteButton);
      actions.append(menu);
      item.append(dateCell, information, state, actions);
      contentList.append(item);
    });
  }

  function createActionButton(action, id, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-button secondary icon-only';
    button.dataset.contentAction = action;
    button.dataset.contentId = id;
    button.title = label;
    button.setAttribute('aria-label', label);
    const icon = document.createElement('span');
    icon.className = 'material-icons notranslate';
    icon.setAttribute('translate', 'no');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = { edit: 'edit', toggle: 'publish', delete: 'delete_outline' }[action];
    button.append(icon);
    return button;
  }

  async function handleRecordAction(event) {
    const button = event.target.closest('[data-content-action]');
    if (!button) return;
    const record = records.find(item => item.id === button.dataset.contentId);
    if (!record) return;

    if (button.dataset.contentAction === 'edit') {
      editRecord(record);
    } else {
      button.disabled = true;
      button.closest('.content-action-menu')?.removeAttribute('open');
      try {
        if (button.dataset.contentAction === 'toggle') await togglePublished(record);
        else if (button.dataset.contentAction === 'delete') await deleteRecord(record);
      } catch (error) {
        showStatus(contentStatus, contentErrorMessage(error), true);
      } finally {
        button.disabled = false;
      }
    }
  }

  function editRecord(record) {
    contentForm.reset();
    contentId.value = record.id;
    contentType.value = record.content_type;
    categoryInput.value = record.category || '';
    titleInput.value = record.title;
    summaryInput.value = record.summary || '';
    bodyInput.value = record.body || '';
    eventStartInput.value = record.event_start || '';
    eventEndInput.value = record.event_end || '';
    allDayInput.checked = record.is_all_day !== false;
    startTimeInput.value = record.event_start_at ? model.localDateTime(record.event_start_at).slice(11, 16) : '14:00';
    endTimeInput.value = record.event_end_at ? model.localDateTime(record.event_end_at).slice(11, 16) : '16:00';
    locationInput.value = record.location || '';
    urlInput.value = record.url || '';
    publishedInput.checked = record.is_published;
    eventPlace.load(record);
    updateEventFields();
    formStatus.hidden = true;
    showContentEditor();
  }

  function updateEventFields() {
    updateEditorTitle();
    const isEvent = contentType.value === 'event';
    eventFields.hidden = !isEvent;
    eventStartInput.required = isEvent;
    eventFields.querySelectorAll('input,select,button').forEach(input => { input.disabled = !isEvent; });
    eventEndInput.required = isEvent && !allDayInput.checked;
    contentForm.querySelector('label[for="site-content-event-end"]').textContent = allDayInput.checked ? '活動結束日期（含當日，可留空）' : '活動結束日期';
    contentForm.querySelectorAll('[data-event-time]').forEach(element => { element.hidden = !isEvent || allDayInput.checked; });
    startTimeInput.required = isEvent && !allDayInput.checked;
    endTimeInput.required = isEvent && !allDayInput.checked;
    startTimeInput.disabled = !isEvent || allDayInput.checked;
    endTimeInput.disabled = !isEvent || allDayInput.checked;
    if (isEvent && contentEditor.open) window.requestAnimationFrame(() => eventPlace.show());
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (saveButton.disabled) return;
    if (!contentForm.reportValidity()) return;

    const existing = records.find(record => record.id === contentId.value);
    const isEvent = contentType.value === 'event';
    if (isEvent && eventEndInput.value && eventEndInput.value < eventStartInput.value) {
      showStatus(formStatus, '活動結束日期不可早於開始日期。', true);
      eventEndInput.focus();
      return;
    }

    let url;
    try {
      url = normalizeUrl(urlInput.value);
    } catch {
      showStatus(formStatus, '連結請使用 http(s) 網址或以 / 開頭的站內路徑。', true);
      urlInput.focus();
      return;
    }

    let timePayload = { event_start_at: null, event_end_at: null };
    let coordinates = { location_latitude: null, location_longitude: null };
    try {
      if (isEvent && !allDayInput.checked) timePayload = model.timedPayload(eventStartInput.value, startTimeInput.value, eventEndInput.value, endTimeInput.value);
      if (isEvent) coordinates = eventPlace.read();
    } catch (error) {
      showStatus(formStatus, error.message, true);
      return;
    }
    const isPublished = publishedInput.checked;
    const payload = {
      content_type: contentType.value,
      category: categoryInput.value.trim(),
      title: titleInput.value.trim(),
      summary: summaryInput.value.trim(),
      body: bodyInput.value.trim(),
      url,
      event_start: isEvent ? eventStartInput.value : null,
      event_end: isEvent ? eventEndInput.value || null : null,
      is_all_day: !isEvent || allDayInput.checked,
      ...timePayload,
      ...coordinates,
      location: isEvent ? locationInput.value.trim() : '',
      is_published: isPublished,
      published_at: isPublished ? existing?.published_at || new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    saveButton.disabled = true;
    showStatus(formStatus, '儲存中。');
    try {
      const result = existing
        ? await supabase.from('site_content').update(payload).eq('id', existing.id)
        : await supabase.from('site_content').insert({ ...payload, created_by: activeUserId });
      if (result.error) throw result.error;
      closeContentEditor(true);
      await loadRecords();
    } catch (error) {
      showStatus(formStatus, contentErrorMessage(error), true);
    } finally {
      saveButton.disabled = false;
    }
  }

  async function togglePublished(record) {
    const isPublished = !record.is_published;
    const { error } = await supabase
      .from('site_content')
      .update({
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);
    if (error) {
      showStatus(contentStatus, contentErrorMessage(error), true);
      return;
    }
    await loadRecords();
  }

  async function deleteRecord(record) {
    if (!window.confirm(`確定刪除「${record.title}」？`)) return;
    const { error } = await supabase.from('site_content').delete().eq('id', record.id);
    if (error) {
      showStatus(contentStatus, contentErrorMessage(error), true);
      return;
    }
    await loadRecords();
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid URL protocol');
    return parsed.href;
  }

  function formatEventDates(start, end) {
    if (!start) return '';
    const startLabel = formatDateOnly(start);
    return end && end !== start ? `${startLabel} 至 ${formatDateOnly(end)}` : startLabel;
  }

  function formatRecordDates(record) {
    if (record.is_all_day !== false || !record.event_start_at || !record.event_end_at) return `${formatEventDates(record.event_start, record.event_end)}（整天）`;
    const formatter = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return `${formatter.format(new Date(record.event_start_at))}–${formatter.format(new Date(record.event_end_at))}`;
  }

  function formatDateOnly(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' })
      .format(new Date(year, month - 1, day));
  }

  function formatTimestamp(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(new Date(value));
  }

  function contentErrorMessage(error) {
    if (['PGRST204', '42703'].includes(error?.code)) return '請先套用 calendar_scheduling migration，以啟用活動時間與地圖座標。';
    return error?.code === '42501'
      ? '此帳號沒有內容管理權限。'
      : '儲存失敗，請確認資料庫已套用 site_content migration 後再試。';
  }

  function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.hidden = false;
  }
});