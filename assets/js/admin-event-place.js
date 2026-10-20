class SiteEventPlace {
  constructor({ input, form }) {
    this.input = input;
    this.form = form;
    this.latitude = document.getElementById('event-location-latitude');
    this.longitude = document.getElementById('event-location-longitude');
    this.results = document.getElementById('event-location-results');
    this.status = document.getElementById('event-location-status');
    this.map = null;
    this.marker = null;
    this.features = [];
    this.request = null;
    this.reverseRequest = null;
    this.positionRevision = 0;
    document.getElementById('event-location-search').addEventListener('click', () => this.search());
    document.getElementById('event-location-clear').addEventListener('click', () => { this.reset(); this.dirty(); });
    input.addEventListener('input', () => this.reset());
    this.results.addEventListener('change', () => {
      const feature = this.features[Number(this.results.value)];
      if (!feature || this.results.value === '') return;
      this.input.value = this.label(feature);
      this.set(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
    });
    [this.latitude, this.longitude].forEach(input => input.addEventListener('change', () => {
      if (this.latitude.value && this.longitude.value && this.latitude.checkValidity() && this.longitude.checkValidity()) this.set(Number(this.latitude.value), Number(this.longitude.value));
    }));
  }

  dirty() { this.form.dispatchEvent(new Event('input', { bubbles: true })); }

  label(feature) {
    return window.AdminPlaceSearch.label(feature);
  }

  reset() {
    this.positionRevision += 1;
    this.request?.abort();
    this.reverseRequest?.abort();
    this.latitude.value = '';
    this.longitude.value = '';
    this.results.hidden = true;
    this.status.textContent = '';
    if (this.marker) { this.marker.remove(); this.marker = null; }
  }

  load(record) {
    this.reset();
    if (Number.isFinite(record?.location_latitude) && Number.isFinite(record?.location_longitude)) this.set(record.location_latitude, record.location_longitude, false);
  }

  show() {
    if (!window.L) { this.status.textContent = '地圖無法載入，可直接輸入經緯度。'; return; }
    if (!this.map) {
      this.map = window.L.map('event-location-map', { scrollWheelZoom: false }).setView([24.8036, 120.9719], 15);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(this.map);
      this.map.on('click', event => this.choosePosition(event.latlng.lat, event.latlng.lng));
    }
    this.map.invalidateSize();
    if (this.latitude.value && this.longitude.value) this.set(Number(this.latitude.value), Number(this.longitude.value), false);
  }

  set(latitude, longitude, dirty = true) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
    this.positionRevision += 1;
    this.latitude.value = latitude.toFixed(6);
    this.longitude.value = longitude.toFixed(6);
    if (this.map) {
      this.map.setView([latitude, longitude], 16);
      if (!this.marker) {
        this.marker = window.L.marker([latitude, longitude], { draggable: true }).addTo(this.map);
        this.marker.on('dragend', () => { const position = this.marker.getLatLng(); this.choosePosition(position.lat, position.lng); });
      } else this.marker.setLatLng([latitude, longitude]);
    }
    this.status.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    if (dirty) this.dirty();
  }

  async choosePosition(latitude, longitude) {
    this.set(latitude, longitude);
    const revision = this.positionRevision;
    const previousLabel = this.input.value;
    this.reverseRequest?.abort();
    const request = new AbortController();
    this.reverseRequest = request;
    try {
      const features = await window.AdminPlaceSearch.reverse(latitude, longitude, { signal: request.signal });
      if (revision !== this.positionRevision || this.input.value !== previousLabel) return;
      if (features[0]) this.input.value = this.label(features[0]);
      this.dirty();
    } catch {
      if (revision === this.positionRevision) this.status.textContent = '地址查詢未完成，已更新地圖座標。';
    }
  }

  read() {
    if (!this.latitude.value && !this.longitude.value) return { location_latitude: null, location_longitude: null };
    if (!this.latitude.value || !this.longitude.value) throw new Error('地點需同時填寫緯度與經度，或清除座標。');
    return { location_latitude: Number(this.latitude.value), location_longitude: Number(this.longitude.value) };
  }

  async search() {
    const query = this.input.value.trim();
    if (!query) { this.status.textContent = '請先輸入地點。'; return; }
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    this.results.hidden = true;
    this.status.textContent = '搜尋地點中…';
    try {
      const features = await window.AdminPlaceSearch.search(query, { signal: request.signal });
      if (this.request !== request || request.signal.aborted) return;
      this.features = features;
      this.results.replaceChildren(new Option('選擇地點', ''));
      this.features.forEach((feature, index) => this.results.add(new Option(this.label(feature), String(index))));
      this.results.hidden = !this.features.length;
      this.status.textContent = this.features.length ? '請選擇地點。' : '沒有結果，可在地圖點選位置。';
    } catch {
      if (this.request === request && !request.signal.aborted) this.status.textContent = '搜尋失敗，可在地圖點選或輸入經緯度。';
    }
  }
}