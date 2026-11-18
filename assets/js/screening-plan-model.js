(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.ScreeningPlanModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function getTaipeiParts(date = new Date()) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  }

  function formatTaipeiDateTime(timestamp) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function parseTaipeiDateTime(value, endOfMinute) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}:${endOfMinute ? '59' : '00'}+08:00`);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  // `now` is injectable so slot and conflict lookups can be tested at a fixed Taipei time.
  function findScreeningPlanConflict(rules, now = getTaipeiParts()) {
    const today = Date.UTC(Number(now.year), Number(now.month) - 1, Number(now.day));
    const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
    const matchesDate = (rule, date) => {
      const weekday = date.getUTCDay();
      if (rule.frequency === 'weekly') return rule.weekdays.includes(weekday);
      if (rule.frequency !== 'monthly' || Number(rule.weekday) !== weekday) return false;
      const day = date.getUTCDate();
      const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      return Number(rule.ordinal) === -1
        ? day + 7 > monthEnd
        : Math.floor((day - 1) / 7) + 1 === Number(rule.ordinal);
    };
    for (let offset = 0; offset <= 366; offset += 1) {
      const date = new Date(today + offset * 86400000);
      const active = rules.map((rule, index) => ({ rule, index }))
        .filter(({ rule }) => matchesDate(rule, date))
        .filter(({ rule }) => offset > 0
          || Number(rule.endTime.slice(0, 2)) * 60 + Number(rule.endTime.slice(3, 5)) > currentMinutes);
      for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
        const left = active[leftIndex];
        const leftStart = Number(left.rule.startTime.slice(0, 2)) * 60 + Number(left.rule.startTime.slice(3, 5));
        const leftEnd = Number(left.rule.endTime.slice(0, 2)) * 60 + Number(left.rule.endTime.slice(3, 5));
        for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
          const right = active[rightIndex];
          const rightStart = Number(right.rule.startTime.slice(0, 2)) * 60 + Number(right.rule.startTime.slice(3, 5));
          const rightEnd = Number(right.rule.endTime.slice(0, 2)) * 60 + Number(right.rule.endTime.slice(3, 5));
          const overlaps = Math.max(leftStart, rightStart) < Math.min(leftEnd, rightEnd);
          if (!overlaps) continue;
          const leftCoordinates = left.rule.place.coordinates;
          const rightCoordinates = right.rule.place.coordinates;
          const samePlace = left.rule.place.label === right.rule.place.label
            && leftCoordinates.length === rightCoordinates.length
            && leftCoordinates.every((coordinate, index) => Math.abs(coordinate - rightCoordinates[index]) < 0.00001);
          if (samePlace) continue;
          const year = date.getUTCFullYear();
          return {
            dateLabel: new Intl.DateTimeFormat('zh-TW', {
              timeZone: 'UTC', month: 'long', day: 'numeric'
            }).format(new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate(), 12))),
            startTime: `${String(Math.floor(Math.max(leftStart, rightStart) / 60)).padStart(2, '0')}:${String(Math.max(leftStart, rightStart) % 60).padStart(2, '0')}`,
            endTime: `${String(Math.floor(Math.min(leftEnd, rightEnd) / 60)).padStart(2, '0')}:${String(Math.min(leftEnd, rightEnd) % 60).padStart(2, '0')}`,
            left,
            right
          };
        }
      }
    }
    return null;
  }

  function getNextScreeningSlot(preferences, now = getTaipeiParts()) {
    if (!Array.isArray(preferences?.rules) || !preferences.rules.length) return null;
    const today = Date.UTC(Number(now.year), Number(now.month) - 1, Number(now.day));
    const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
    for (let offset = 0; offset <= 370; offset += 1) {
      const date = new Date(today + offset * 86400000);
      const weekday = date.getUTCDay();
      const dayOfMonth = date.getUTCDate();
      const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      const candidates = preferences.rules.filter(rule => {
        if (!rule.place?.label || !Array.isArray(rule.place.coordinates)
          || rule.place.coordinates.length !== 2 || !rule.place.coordinates.every(Number.isFinite)
          || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.startTime || '')
          || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.endTime || '')
          || rule.startTime >= rule.endTime) return false;
        if (rule.frequency === 'weekly') return Array.isArray(rule.weekdays) && rule.weekdays.includes(weekday);
        if (rule.frequency !== 'monthly' || Number(rule.weekday) !== weekday) return false;
        if (Number(rule.ordinal) === -1) return dayOfMonth + 7 > daysInMonth;
        return Number.isInteger(Number(rule.ordinal))
          && Math.floor((dayOfMonth - 1) / 7) + 1 === Number(rule.ordinal);
      }).filter(rule => offset > 0 || currentMinutes < Number(rule.endTime.slice(0, 2)) * 60 + Number(rule.endTime.slice(3, 5)));
      if (!candidates.length) continue;
      candidates.sort((left, right) => left.startTime.localeCompare(right.startTime));
      const rule = candidates[0];
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return {
        dateKey: `${year}-${month}-${day}`,
        dateLabel: new Intl.DateTimeFormat('zh-TW', {
          timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric'
        }).format(new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate(), 12))),
        startTime: rule.startTime,
        endTime: rule.endTime,
        name: rule.name || '',
        place: rule.place
      };
    }
    return null;
  }

  function distanceBetweenKm(latitudeA, longitudeA, latitudeB, longitudeB) {
    const radians = degrees => degrees * Math.PI / 180;
    const latitudeDelta = radians(latitudeB - latitudeA);
    const longitudeDelta = radians(longitudeB - longitudeA);
    const factor = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(factor), Math.sqrt(1 - factor));
  }

  function normalizePlace(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s、，,。.]/g, '');
  }

  return {
    getTaipeiParts, formatTaipeiDateTime, parseTaipeiDateTime, findScreeningPlanConflict,
    getNextScreeningSlot, distanceBetweenKm, normalizePlace
  };
});
