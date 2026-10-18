class SiteOpeningHours {
  constructor({ client, getDate, onChange }) {
    this.client = client;
    this.getDate = getDate;
    this.onChange = onChange;
    this.schedule = [];
    this.exceptions = [];
    this.available = false;
    this.dialog = document.getElementById('opening-hours-editor');
    this.form = document.getElementById('opening-hours-form');
    this.mode = document.getElementById('opening-hours-mode');
    this.date = document.getElementById('opening-hours-date');
    this.weekday = document.getElementById('opening-hours-weekday');
    this.closed = document.getElementById('opening-hours-closed');
    this.start = document.getElementById('opening-hours-start');
    this.end = document.getElementById('opening-hours-end');
    this.note = document.getElementById('opening-hours-note');
    this.status = document.getElementById('opening-hours-status');
    this.busy = false;
    document.getElementById('edit-opening-hours-button').addEventListener('click', () => {
      this.date.value = this.getDate();
      this.weekday.value = String(new Date(`${this.date.value}T00:00:00Z`).getUTCDay());
      this.renderForm();
      this.dialog.showModal();
    });
    [this.mode, this.date, this.weekday].forEach(input => input.addEventListener('change', () => this.renderForm()));
    this.closed.addEventListener('change', () => this.updateClosed());
    this.form.addEventListener('submit', event => { event.preventDefault(); this.save(false); });
    document.getElementById('opening-hours-reset').addEventListener('click', () => this.save(true));
    document.getElementById('opening-hours-cancel').addEventListener('click', () => { if (!this.busy) this.dialog.close(); });
    this.dialog.addEventListener('cancel', event => { if (this.busy) event.preventDefault(); });
  }

  async load() {
    try {
      const results = await Promise.all([
        this.client.from('site_opening_schedule').select('*'),
        this.client.from('site_opening_exceptions').select('*')
      ]);
      this.available = results.every(result => !result.error);
      if (this.available) {
        this.schedule = results[0].data || [];
        this.exceptions = results[1].data || [];
      }
    } catch { this.available = false; }
    this.onChange();
  }

  get(date, holiday) {
    return window.SiteCalendarModel.openingForDate(date, this.schedule, this.exceptions, holiday);
  }

  updateClosed() {
    this.start.disabled = this.closed.checked;
    this.end.disabled = this.closed.checked;
  }

  renderForm() {
    const weekly = this.mode.value === 'weekly';
    this.form.querySelectorAll('[data-opening-date]').forEach(element => { element.hidden = weekly; });
    this.form.querySelectorAll('[data-opening-weekday]').forEach(element => { element.hidden = !weekly; });
    this.date.required = !weekly;
    const weekday = weekly ? Number(this.weekday.value) : new Date(`${this.date.value}T00:00:00Z`).getUTCDay();
    const record = weekly ? this.schedule.find(item => Number(item.weekday) === weekday) : this.exceptions.find(item => item.date === this.date.value);
    const setting = record || this.schedule.find(item => Number(item.weekday) === weekday) || { is_closed: weekday < 2, opens_at: '14:00', closes_at: '22:00' };
    this.closed.checked = setting.is_closed;
    this.start.value = setting.opens_at.slice(0, 5);
    this.end.value = setting.closes_at.slice(0, 5);
    this.note.value = record?.note || '';
    this.updateClosed();
    this.status.hidden = this.available;
    this.status.textContent = this.available ? '' : '尚未啟用營業設定，請先套用 calendar_scheduling migration。';
  }

  async save(reset) {
    if (this.busy || !this.form.reportValidity()) return;
    if (!this.available) { this.renderForm(); return; }
    if (!reset && !this.closed.checked && this.end.value <= this.start.value) {
      this.status.textContent = '結束時間必須晚於開放時間；跨午夜請分為兩日設定。';
      this.status.hidden = false;
      return;
    }
    const weekly = this.mode.value === 'weekly';
    const weekday = Number(this.weekday.value);
    const payload = {
      is_closed: reset ? weekday < 2 : this.closed.checked,
      opens_at: reset || this.closed.checked ? '14:00' : this.start.value,
      closes_at: reset || this.closed.checked ? '22:00' : this.end.value,
      updated_at: new Date().toISOString(),
      ...(weekly ? { weekday } : { date: this.date.value, note: this.note.value.trim() })
    };
    this.busy = true;
    this.form.querySelectorAll('button').forEach(button => { button.disabled = true; });
    this.status.hidden = false;
    this.status.textContent = '儲存中。';
    try {
      const result = !weekly && reset
        ? await this.client.from('site_opening_exceptions').delete().eq('date', this.date.value)
        : await this.client.from(weekly ? 'site_opening_schedule' : 'site_opening_exceptions').upsert(payload, { onConflict: weekly ? 'weekday' : 'date' });
      if (result.error) throw result.error;
      await this.load();
      this.dialog.close();
    } catch {
      this.status.textContent = '儲存失敗，請確認管理員權限及 migration。';
    } finally {
      this.busy = false;
      this.form.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }
}