document.addEventListener('DOMContentLoaded', () => {
  const skyPanel = document.getElementById('calendar-sky-panel');
  const disasterPanel = document.getElementById('calendar-disaster-panel');
  if (!skyPanel || !disasterPanel) return;

  const skyDate = document.getElementById('calendar-sky-date');
  const skyContent = document.getElementById('calendar-sky-content');
  const moonSummary = document.getElementById('calendar-moon-summary');
  const disasterContent = document.getElementById('calendar-disaster-content');
  const disasterSummary = document.getElementById('calendar-disaster-summary');
  const disasterScope = document.getElementById('calendar-disaster-scope');
  const disasterType = document.getElementById('calendar-disaster-type');
  const refreshButton = document.getElementById('calendar-disaster-refresh');
  const dateFormatter = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const timeFormatter = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const phaseNames = ['新月', '眉月', '上弦月', '盈凸月', '滿月', '虧凸月', '下弦月', '殘月'];
  const sources = [
    { id: 'usgs', label: 'USGS｜近 24 小時 M2.5+ 地震（非預警）', url: 'https://earthquake.usgs.gov/earthquakes/map/' },
    { id: 'gdacs', label: 'GDACS｜全球災害衝擊評估（非當地撤離命令）', url: 'https://www.gdacs.org/' },
    { id: 'ptwc', label: 'NOAA PTWC｜太平洋海嘯公告', url: 'https://www.tsunami.gov/' },
    { id: 'ntwc', label: 'NOAA NTWC｜北美海嘯公告', url: 'https://www.tsunami.gov/' }
  ];
  let location = { name: '風城部屋・新竹', latitude: 24.8036, longitude: 120.9719 };
  let disasterData = new Map();
  let querying = false;
  let initialized = false;

  skyDate.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  skyDate.addEventListener('change', renderSky);
  skyPanel.addEventListener('toggle', () => { if (skyPanel.open) renderSky(); });
  disasterScope.addEventListener('change', renderDisasters);
  disasterType.addEventListener('change', renderDisasters);
  refreshButton.addEventListener('click', loadDisasters);
  document.addEventListener('calendar-location-change', event => {
    location = { ...event.detail };
    renderSky();
    renderDisasters();
    if (!initialized) {
      initialized = true;
      loadDisasters();
    }
  });
  document.addEventListener('calendar-date-change', event => {
    skyDate.value = event.detail;
    renderSky();
  });
  window.setInterval(() => {
    if (initialized && !document.hidden) loadDisasters();
  }, 300000);
  document.addEventListener('visibilitychange', () => {
    if (initialized && !document.hidden) renderDisasters();
  });

  function renderSky() {
    const astronomy = window.Astronomy;
    if (!astronomy) {
      moonSummary.textContent = '天文資料未載入';
      skyContent.textContent = '天文元件無法載入，請重新整理。';
      return;
    }
    if (!skyDate.value || !skyDate.validity.valid) return;
    const evening = new Date(`${skyDate.value}T20:00:00+08:00`);
    const phase = astronomy.MoonPhase(evening);
    const phaseName = phaseNames[Math.round(phase / 45) % 8];
    const illuminated = Math.round(astronomy.Illumination('Moon', evening).phase_fraction * 100);
    moonSummary.textContent = `${phaseName} · 照明 ${illuminated}%`;
    if (!skyPanel.open) return;
    skyContent.replaceChildren();
    const observer = new astronomy.Observer(location.latitude, location.longitude, 0);
    const start = new Date(`${skyDate.value}T00:00:00+08:00`);
    const facts = document.createElement('div');
    facts.className = 'calendar-sky-facts';
    appendFact(facts, 'brightness_2', `${phaseName} · ${illuminated}%`);
    for (const [body, label, icon] of [['Sun', '日', 'wb_sunny'], ['Moon', '月', 'brightness_2']]) {
      const rise = astronomy.SearchRiseSet(body, observer, 1, start, 1);
      const set = astronomy.SearchRiseSet(body, observer, -1, start, 1);
      appendFact(facts, icon, `${label}出 ${rise ? timeFormatter.format(rise.date) : '當日無'} / ${label}落 ${set ? timeFormatter.format(set.date) : '當日無'}`);
    }
    skyContent.append(facts);

    const table = document.createElement('table');
    table.className = 'calendar-sky-table';
    const caption = table.createCaption();
    caption.textContent = `${location.name} · ${skyDate.value} 20:00（UTC+8）`;
    const header = table.createTHead().insertRow();
    ['行星', '方位', '高度', '所在星座（IAU）'].forEach(label => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      header.append(cell);
    });
    const body = table.createTBody();
    for (const [planet, name] of [['Mercury', '水星'], ['Venus', '金星'], ['Mars', '火星'], ['Jupiter', '木星'], ['Saturn', '土星']]) {
      const equatorial = astronomy.Equator(planet, evening, observer, true, true);
      const horizontal = astronomy.Horizon(evening, observer, equatorial.ra, equatorial.dec, 'normal');
      const j2000 = astronomy.Equator(planet, evening, observer, false, true);
      const constellation = astronomy.Constellation(j2000.ra, j2000.dec);
      const constellationNames = { Ari: '白羊座', Tau: '金牛座', Gem: '雙子座', Cnc: '巨蟹座', Leo: '獅子座', Vir: '室女座', Lib: '天秤座', Sco: '天蠍座', Oph: '蛇夫座', Sgr: '人馬座', Cap: '摩羯座', Aqr: '寶瓶座', Psc: '雙魚座', Cet: '鯨魚座', Ori: '獵戶座', Aur: '御夫座', Sex: '六分儀座' };
      const direction = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'][Math.round(horizontal.azimuth / 45) % 8];
      const row = body.insertRow();
      [name, `${direction} ${Math.round(horizontal.azimuth)}°`, `${horizontal.altitude.toFixed(1)}°${horizontal.altitude < 0 ? '（地平線下）' : ''}`, constellationNames[constellation.symbol] || constellation.name].forEach(value => {
        row.insertCell().textContent = value;
      });
    }
    skyContent.append(table);
    const heading = document.createElement('h4');
    heading.textContent = '接續天象（UTC+8）';
    const events = document.createElement('ul');
    events.className = 'calendar-sky-events';
    let quarter = astronomy.SearchMoonQuarter(start);
    for (let index = 0; index < 4; index += 1) {
      appendListText(events, `${dateFormatter.format(quarter.time.date)} · ${['新月', '上弦月', '滿月', '下弦月'][quarter.quarter]}`);
      quarter = astronomy.NextMoonQuarter(quarter);
    }
    const solarEclipse = astronomy.SearchGlobalSolarEclipse(start);
    const lunarEclipse = astronomy.SearchLunarEclipse(start);
    appendListText(events, `${dateFormatter.format(solarEclipse.peak.date)} · 下一次全球日食`);
    appendListText(events, `${dateFormatter.format(lunarEclipse.peak.date)} · 下一次全球月食`);
    const caveat = document.createElement('p');
    caveat.className = 'admin-muted';
    caveat.textContent = '全球食象不代表所選地點可見；觀測日食需專用安全濾鏡，勿直視太陽。';
    skyContent.append(heading, events, caveat);
  }

  function appendFact(container, iconName, text) {
    const fact = document.createElement('span');
    const icon = document.createElement('span');
    icon.className = 'material-icons notranslate';
    icon.setAttribute('translate', 'no');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = iconName;
    fact.append(icon, document.createTextNode(text));
    container.append(fact);
  }

  function appendListText(list, text) {
    const item = document.createElement('li');
    item.textContent = text;
    list.append(item);
  }

  async function loadDisasters() {
    if (querying) return;
    querying = true;
    refreshButton.disabled = true;
    disasterSummary.textContent = '查詢中…';
    const earthquakeRequest = (async () => {
      try {
        const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('USGS unavailable');
        const payload = await response.json();
        if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features) || !Number.isFinite(payload.metadata?.generated)) throw new Error('Invalid USGS feed');
        const entries = payload.features.filter(feature => Number.isFinite(feature.properties?.time) && Number.isFinite(feature.properties?.mag)).map(feature => ({
          title: `M${feature.properties.mag.toFixed(1)} · ${feature.properties.place || '位置未提供'}`,
          time: feature.properties.time, url: feature.properties.url,
          latitude: feature.geometry?.coordinates?.[1], longitude: feature.geometry?.coordinates?.[0],
          description: '', type: 'EQ'
        }));
        disasterData.set('usgs', { ok: true, checkedAt: Date.now(), generatedAt: payload.metadata.generated, entries });
      } catch {
        disasterData.set('usgs', { ok: false, entries: [] });
      }
    })();
    const feedRequest = (async () => {
      try {
        const { data, error } = await window.questionnaireSupabase.functions.invoke('environment-feeds', { body: {}, timeout: 20000 });
        if (error || !Array.isArray(data?.sources)) throw new Error('Feed proxy unavailable');
        for (const source of sources.slice(1)) {
          const feed = data.sources.find(item => item.id === source.id);
          if (!feed?.ok) {
            disasterData.set(source.id, { ok: false, entries: [] });
            continue;
          }
          try {
            disasterData.set(source.id, { ok: true, checkedAt: Date.parse(feed.fetchedAt), entries: parseDisasterFeed(feed.xml, source.id) });
          } catch {
            disasterData.set(source.id, { ok: false, entries: [] });
          }
        }
      } catch {
        sources.slice(1).forEach(source => disasterData.set(source.id, { ok: false, entries: [] }));
      }
    })();
    await Promise.allSettled([earthquakeRequest, feedRequest]);
    querying = false;
    refreshButton.disabled = false;
    renderDisasters();
  }

  function parseDisasterFeed(xml, sourceId) {
    if (typeof xml !== 'string' || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Invalid XML');
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
    if (documentXml.querySelector('parsererror')) throw new Error('Invalid feed');
    const text = (element, tag) => element.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() || '';
    const isGdacs = sourceId === 'gdacs';
    if (!['rss', 'feed'].includes(documentXml.documentElement.localName)) throw new Error('Unknown feed');
    const feedTitle = text(documentXml.documentElement, 'title');
    const nodes = [...documentXml.getElementsByTagNameNS('*', isGdacs ? 'item' : 'entry')];
    return nodes.map(node => {
      const title = text(node, 'title');
      const time = Date.parse(text(node, isGdacs ? 'datemodified' : 'updated') || text(node, 'pubDate'));
      const point = text(node, 'point').split(/\s+/).map(Number);
      const entryLink = isGdacs ? text(node, 'link') : [...node.getElementsByTagNameNS('*', 'link')].find(link => ['alternate', ''].includes(link.getAttribute('rel') || ''))?.getAttribute('href');
      const type = text(node, 'eventtype');
      const level = text(node, 'alertlevel');
      const current = text(node, 'iscurrent');
      const currentLabel = current === 'true' ? '上游標記：目前事件' : current === 'false' ? '上游標記：非目前事件' : '上游未提供目前事件標記';
      const description = new DOMParser().parseFromString(text(node, isGdacs ? 'description' : 'summary'), 'text/html').body.textContent || '';
      const types = { TC: '熱帶氣旋／颱風', EQ: '地震', TS: '海嘯', FL: '洪水', VO: '火山', DR: '乾旱', WF: '野火' };
      return {
        title: isGdacs ? `${types[type] || type} · ${title}` : `${feedTitle} · ${title}`,
        time, url: entryLink || 'https://www.tsunami.gov/',
        latitude: point.length === 2 ? point[0] : undefined, longitude: point.length === 2 ? point[1] : undefined,
        description: isGdacs ? `${level ? `GDACS ${level} 評估 · ` : ''}${currentLabel} · ${description}` : description,
        type: isGdacs ? type : 'TS',
        id: text(node, isGdacs ? 'guid' : 'id') || entryLink
      };
    }).filter(entry => entry.title && Number.isFinite(entry.time)).filter((entry, index, entries) => !entry.id || entries.findIndex(other => other.id === entry.id) === index);
  }

  function renderDisasters() {
    if (!initialized) return;
    disasterContent.replaceChildren();
    const radius = Number(disasterScope.value);
    let unavailable = 0;
    let total = 0;
    sources.forEach(source => {
      const data = disasterData.get(source.id);
      const section = document.createElement('section');
      section.className = 'calendar-disaster-source';
      const heading = document.createElement('h3');
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.label;
      heading.append(link);
      const status = document.createElement('p');
      if (!data?.ok || !Number.isFinite(data.checkedAt) || Date.now() - data.checkedAt > 600000 || (data.generatedAt && Date.now() - data.generatedAt > 600000)) {
        unavailable += 1;
        status.className = 'calendar-disaster-unavailable';
        status.textContent = '無法確認最新資料，請查看原始來源。';
        section.append(heading, status);
        disasterContent.append(section);
        return;
      }
      const entries = data.entries.filter(entry => disasterType.value === 'all' || entry.type === disasterType.value)
        .filter(entry => source.id !== 'usgs' || Date.now() - entry.time <= 86400000).map(entry => {
        const distance = Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude) && Math.abs(entry.latitude) <= 90 && Math.abs(entry.longitude) <= 180 && window.L
          ? window.L.latLng(location.latitude, location.longitude).distanceTo(window.L.latLng(entry.latitude, entry.longitude)) / 1000 : null;
        return { ...entry, distance };
      }).filter(entry => !radius || source.id === 'ptwc' || source.id === 'ntwc' || entry.distance === null || entry.distance <= radius).sort((first, second) => second.time - first.time);
      total += entries.length;
      status.textContent = `查詢 ${dateFormatter.format(data.checkedAt)}（UTC+8） · ${entries.length} 筆${entries.length > 10 ? '，列出最新 10 筆' : ''}。空清單不代表沒有風險。`;
      section.append(heading, status);
      const list = document.createElement('ul');
      entries.slice(0, 10).forEach(entry => {
        const item = document.createElement('li');
        const anchor = document.createElement('a');
        const url = safeDisasterUrl(entry.url);
        if (url) { anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
        anchor.textContent = entry.title;
        const time = document.createElement('time');
        time.dateTime = new Date(entry.time).toISOString();
        time.textContent = ` · ${dateFormatter.format(entry.time)}（UTC+8）${entry.distance !== null ? ` · 距事件中心約 ${Math.round(entry.distance)} 公里` : ''}`;
        item.append(anchor, time);
        if (entry.description) {
          const details = document.createElement('details');
          const summary = document.createElement('summary');
          summary.textContent = '公告內容';
          const description = document.createElement('p');
          description.textContent = entry.description;
          details.append(summary, description);
          item.append(details);
        }
        list.append(item);
      });
      section.append(list);
      disasterContent.append(section);
    });
    disasterSummary.textContent = `${total} 筆來源事件／公告${unavailable ? ` · ${unavailable} 個來源無法確認` : ''}`;
    const drawerSummary = document.getElementById('calendar-environment-alert-summary');
    if (drawerSummary) {
      drawerSummary.textContent = unavailable ? `${unavailable} 個來源未連線` : `${total} 筆事件／公告`;
      drawerSummary.classList.toggle('is-unavailable', unavailable > 0);
      drawerSummary.title = disasterSummary.textContent;
    }
  }

  function safeDisasterUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['www.gdacs.org', 'gdacs.org', 'www.tsunami.gov', 'tsunami.gov', 'earthquake.usgs.gov'].includes(url.hostname) ? url.href : null;
    } catch { return null; }
  }
});