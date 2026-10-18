class SiteCalendarUI {
  constructor({ calendar, element, getEvents, onEvent, onDate }) {
    this.calendar = calendar;
    this.element = element;
    this.getEvents = getEvents;
    this.onEvent = onEvent;
    this.onDate = onDate;
    this.model = window.SiteCalendarModel;
    this.mode = 'dayGridMonth';
    this.selected = this.model.dateKey(new Date());
    this.stream = document.getElementById('calendar-stream');
    this.days = document.getElementById('calendar-stream-days');
    this.yearDialog = document.getElementById('calendar-year-dialog');
    this.ready = false;
    this.extending = false;
    this.timeFormat = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    document.querySelectorAll('[data-calendar-mode]').forEach(button => button.addEventListener('click', () => this.choose(button.dataset.calendarMode)));
    document.getElementById('calendar-previous').addEventListener('click', () => this.navigate(-1));
    document.getElementById('calendar-next').addEventListener('click', () => this.navigate(1));
    document.getElementById('calendar-now').addEventListener('click', () => this.goTo(this.model.dateKey(new Date())));
    document.getElementById('calendar-period-title').addEventListener('click', () => {
      document.getElementById('calendar-year-input').value = this.selected.slice(0, 4);
      this.yearDialog.showModal();
      document.getElementById('calendar-year-input').focus();
    });
    document.getElementById('calendar-year-cancel').addEventListener('click', () => this.yearDialog.close());
    document.getElementById('calendar-year-form').addEventListener('submit', event => {
      event.preventDefault();
      const year = Number(document.getElementById('calendar-year-input').value);
      if (!Number.isInteger(year) || year < 1900 || year > 2200) return;
      const month = this.selected.slice(5, 7);
      const maximum = new Date(year, Number(month), 0).getDate();
      this.goTo(`${year}-${month}-${String(Math.min(Number(this.selected.slice(8)), maximum)).padStart(2, '0')}`);
      this.yearDialog.close();
    });
    this.observer = new IntersectionObserver(entries => {
      if (!this.ready || this.extending || this.mode !== 'listMonth') return;
      const entry = entries.find(item => item.isIntersecting);
      if (entry) this.extend(entry.target.id.endsWith('before') ? -1 : 1);
    }, { root: this.stream, rootMargin: '150px' });
    this.observer.observe(document.getElementById('calendar-stream-before'));
    this.observer.observe(document.getElementById('calendar-stream-after'));
    this.stream.addEventListener('scroll', () => {
      if (this.mode !== 'listMonth' || this.extending) return;
      const top = this.stream.getBoundingClientRect().top;
      const section = [...this.days.children].find(item => item.getBoundingClientRect().bottom > top + 30);
      if (section) { this.selected = section.dataset.date; this.updateNavigation(); }
    }, { passive: true });
    window.setInterval(() => {
      if (document.hidden) return;
      this.updateNavigation();
    }, 1000);
    window.setInterval(() => {
      if (document.hidden) return;
      this.updatePast();
    }, 30000);
    this.updateNavigation();
  }

  onDatesSet(info) {
    if (this.mode !== 'listMonth') {
      this.mode = info.view.type;
      this.selected = this.model.dateKey(this.calendar.getDate());
    }
    this.updateNavigation();
    window.requestAnimationFrame(() => this.updatePast());
  }

  choose(mode) {
    this.mode = mode;
    const streamed = mode === 'listMonth';
    this.element.hidden = streamed;
    this.stream.hidden = !streamed;
    if (streamed) this.resetStream(this.model.dateKey(new Date()));
    else {
      this.calendar.changeView(mode, this.selected);
      this.calendar.updateSize();
      this.calendar.refetchEvents();
    }
    this.updateNavigation();
  }

  goTo(date) {
    this.selected = date;
    if (this.mode === 'listMonth') this.resetStream(date);
    else this.calendar.gotoDate(date);
    this.updateNavigation();
  }

  navigate(direction) {
    if (this.mode === 'listMonth') this.goTo(this.model.addDays(this.selected, direction));
    else if (direction < 0) this.calendar.prev();
    else this.calendar.next();
  }

  updateNavigation() {
    const labels = this.model.navigationLabels(this.mode, this.selected);
    document.getElementById('calendar-period-label').textContent = labels.title;
    const nowButton = document.getElementById('calendar-now');
    nowButton.textContent = labels.today;
    nowButton.setAttribute('aria-label', `回到現在：${labels.today}`);
    document.querySelectorAll('[data-calendar-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.calendarMode === this.mode)));
  }

  refresh() {
    if (this.mode === 'listMonth' && this.first) {
      const scroll = this.stream.scrollTop;
      this.renderStream();
      this.stream.scrollTop = scroll;
    }
    this.updatePast();
  }

  resetStream(date) {
    this.ready = false;
    this.first = this.model.addDays(date, -15);
    this.last = this.model.addDays(date, 30);
    this.renderStream();
    window.requestAnimationFrame(() => {
      const section = this.days.querySelector(`[data-date="${date}"]`);
      const now = new Date();
      const target = date === this.model.dateKey(now)
        ? [...(section?.querySelectorAll('[data-start]') || [])].find(item => item.dataset.end > this.model.localDateTime(now)) || section
        : section;
      if (target) this.stream.scrollTop += target.getBoundingClientRect().top - this.stream.getBoundingClientRect().top - 10;
      this.selected = date;
      this.ready = true;
      this.updateNavigation();
    });
  }

  extend(direction) {
    this.extending = true;
    const height = this.stream.scrollHeight;
    const scroll = this.stream.scrollTop;
    if (direction < 0) this.first = this.model.addDays(this.first, -30);
    else this.last = this.model.addDays(this.last, 30);
    this.renderStream();
    this.stream.scrollTop = scroll + (direction < 0 ? this.stream.scrollHeight - height : 0);
    window.requestAnimationFrame(() => { this.extending = false; });
  }

  renderStream() {
    const events = this.getEvents(this.first, this.model.addDays(this.last, 1));
    this.days.replaceChildren();
    for (let date = this.first; date <= this.last; date = this.model.addDays(date, 1)) {
      const section = document.createElement('section');
      section.className = 'calendar-stream-day';
      section.dataset.date = date;
      const heading = document.createElement('h3');
      heading.textContent = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00+08:00`));
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'admin-button secondary icon-only';
      add.title = `${date} 新增活動`;
      add.setAttribute('aria-label', add.title);
      const icon = document.createElement('span');
      icon.className = 'material-icons notranslate';
      icon.setAttribute('translate', 'no');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'add';
      add.append(icon);
      add.addEventListener('click', () => this.onDate(date));
      heading.append(add);
      section.append(heading);
      const dayEvents = this.model.eventsForDate(events, date);
      dayEvents.sort((first, second) => String(first.start).localeCompare(String(second.start)));
      for (const event of dayEvents) {
        const item = document.createElement(event.extendedProps?.record ? 'button' : 'div');
        if (item.tagName === 'BUTTON') item.type = 'button';
        item.className = `calendar-stream-event ${(event.classNames || []).join(' ')}`;
        item.dataset.start = event.start;
        item.dataset.end = event.end || this.model.addDays(date, 1);
        const time = document.createElement('span');
        time.className = 'calendar-stream-time';
        time.textContent = this.model.eventTimeLabel(event, date);
        const label = document.createElement('span');
        label.textContent = event.title;
        item.append(time, label);
        if (event.extendedProps?.record) item.addEventListener('click', () => this.onEvent(event.extendedProps.record));
        section.append(item);
      }
      if (!dayEvents.length) {
        const empty = document.createElement('p');
        empty.className = 'admin-muted';
        empty.textContent = '沒有安排';
        section.append(empty);
      }
      this.days.append(section);
    }
  }

  updatePast() {
    this.element.querySelectorAll('.calendar-past-overlay').forEach(element => element.remove());
    if (this.mode !== 'timeGridDay') return;
    const now = new Date();
    const currentDate = this.model.dateKey(now);
    const localTime = this.model.localDateTime(now);
    const minutes = Number(localTime.slice(11, 13)) * 60 + Number(localTime.slice(14, 16));
    this.element.querySelectorAll('.fc-timegrid-col[data-date]').forEach(column => {
      const percent = column.dataset.date < currentDate ? 100 : column.dataset.date === currentDate ? minutes / 14.4 : 0;
      if (!percent) return;
      const overlay = document.createElement('div');
      overlay.className = 'calendar-past-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.height = `${percent}%`;
      column.querySelector('.fc-timegrid-col-frame')?.append(overlay);
    });
    this.element.querySelectorAll('.fc-timegrid-event[data-end]').forEach(event => event.classList.toggle('is-past', event.dataset.end <= localTime));
  }
}