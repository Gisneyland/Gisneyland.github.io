(function (root) {
  let nextNominatimRequest = 0;

  function label(feature) {
    const properties = feature?.properties || {};
    return (properties.display_name || [...new Set([
      properties.name, properties.housenumber, properties.street, properties.district,
      properties.city, properties.county, properties.state, properties.country
    ].filter(Boolean))].join('、')).slice(0, 180);
  }

  function validFeatures(features) {
    return (Array.isArray(features) ? features : []).filter(feature => {
      const coordinates = feature?.geometry?.coordinates;
      return feature?.geometry?.type === 'Point' && Array.isArray(coordinates)
        && coordinates.length === 2 && coordinates.every(Number.isFinite)
        && Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 90 && label(feature);
    });
  }

  function nominatimFeatures(payload) {
    return validFeatures((Array.isArray(payload) ? payload : [payload]).filter(Boolean).map(place => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [place.lon === undefined ? NaN : Number(place.lon), place.lat === undefined ? NaN : Number(place.lat)]
      },
      properties: { name: place.name || place.display_name, display_name: place.display_name }
    })));
  }

  async function waitForNominatim(signal) {
    signal?.throwIfAborted();
    const now = Date.now();
    const delay = Math.max(0, nextNominatimRequest - now);
    nextNominatimRequest = now + delay + 1100;
    if (!delay) return;
    await new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, delay);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }

  async function fetchJson(url, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Place lookup unavailable');
      return await response.json();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  async function lookup(photonParams, nominatimParams, { signal } = {}) {
    let failed = false;
    for (const source of ['photon', 'nominatim']) {
      signal?.throwIfAborted();
      try {
        if (source === 'nominatim') await waitForNominatim(signal);
        const reverse = photonParams.has('lat') && !photonParams.has('q');
        const url = source === 'photon'
          ? `https://photon.komoot.io/${reverse ? 'reverse' : 'api/'}?${photonParams}`
          : `https://nominatim.openstreetmap.org/${reverse ? 'reverse' : 'search'}?${nominatimParams}`;
        const payload = await fetchJson(url, signal);
        const features = source === 'photon' ? validFeatures(payload?.features) : nominatimFeatures(payload);
        if (features.length) return features;
      } catch (error) {
        signal?.throwIfAborted();
        failed = true;
      }
    }
    if (failed) throw new Error('Place lookup unavailable');
    return [];
  }

  function search(query, options) {
    // Photon does not support lang=zh; omit it to use the place's local language.
    return lookup(
      new URLSearchParams({ q: query, limit: '6', lat: '24.8', lon: '120.97' }),
      new URLSearchParams({ q: query, format: 'jsonv2', limit: '6', 'accept-language': 'zh-TW' }),
      options
    );
  }

  function reverse(latitude, longitude, options) {
    const coordinates = { lat: String(latitude), lon: String(longitude) };
    return lookup(
      new URLSearchParams(coordinates),
      new URLSearchParams({ ...coordinates, format: 'jsonv2', 'accept-language': 'zh-TW' }),
      options
    );
  }

  root.AdminPlaceSearch = { search, reverse, label };
})(typeof window === 'undefined' ? globalThis : window);
