(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.ResponseBatchModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const BATCH_SIZE = 100;
  const MAX_IMPORT_ROWS = 2000;
  const MAX_DATA_BYTES = 100000;
  const CODE_PATTERN = /^[A-Za-z0-9-]{4,32}(,[A-Za-z0-9-]{4,32})*$/;
  const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
  // 這些欄位由系統維護（照片、編號、處理紀錄），不接受由檔案寫入
  const BLOCKED_KEYS = new Set(['screening_photos', 'id', 'consult_uploads', 'task_progress']);
  const STATUS_ALIASES = { draft: 'draft', 草稿: 'draft', submitted: 'submitted', 已完成: 'submitted' };
  const LANGUAGE_ALIASES = { 'zh-TW': 'zh-TW', 繁體中文: 'zh-TW', en: 'en', English: 'en' };
  const ARRAY_KEYS = new Set(['screening_interpretation']);

  function chunk(items, size = BATCH_SIZE) {
    const batches = [];
    for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
    return batches;
  }

  // RFC 4180：支援引號、換行與 "" 跳脫；回傳字串二維陣列
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (quoted) {
        if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(cell); cell = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && source[index + 1] === '\n') index += 1;
        row.push(cell); cell = '';
        rows.push(row); row = [];
      } else {
        cell += char;
      }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(items => items.some(value => value.trim() !== ''));
  }

  // 標題可用欄位代碼、中文欄位名稱，或匯出檔的「分組 - 欄位名稱」
  function buildHeaderMap(format) {
    const map = new Map();
    format.RESPONSE_DETAIL_GROUPS.forEach(group => group.fields.forEach(key => {
      const label = format.RESPONSE_FIELD_LABELS[key] || format.humanizeFieldName(key);
      map.set(key, key);
      map.set(label, key);
      map.set(`${group.title} - ${label}`, key);
    }));
    return map;
  }

  function reverseValue(format, key, text) {
    const labels = format.RESPONSE_VALUE_LABELS[key];
    if (labels) {
      const hit = Object.entries(labels).find(([, label]) => label === text);
      if (hit) return hit[0];
    }
    if (format.RESPONSE_BOOLEAN_FIELD_PATTERN.test(key)) {
      if (/^(true|是|yes)$/i.test(text)) return true;
      if (/^(false|否|no)$/i.test(text)) return false;
    }
    if (format.RESPONSE_YES_NO_FIELDS.has(key)) {
      if (text === '是') return 'yes';
      if (text === '否') return 'no';
    }
    return text;
  }

  function parseValue(format, key, raw) {
    const text = String(raw).trim();
    if (ARRAY_KEYS.has(key)) {
      return text.split(/[|、;；]+/).map(item => reverseValue(format, key, item.trim())).filter(Boolean);
    }
    return reverseValue(format, key, text);
  }

  function buildImportRecords(table, format, { maxRows = MAX_IMPORT_ROWS } = {}) {
    const result = { records: [], errors: [], ignoredHeaders: [] };
    if (table.length < 2) {
      result.errors.push({ line: 1, reason: '檔案沒有資料列。第一列需為欄位標題。' });
      return result;
    }
    if (table.length - 1 > maxRows) {
      result.errors.push({ line: 0, reason: `一次最多匯入 ${maxRows} 筆，請分檔後再匯入。` });
      return result;
    }
    const headerMap = buildHeaderMap(format);
    const columns = table[0].map(header => {
      const name = header.trim();
      if (['status', '處理狀態'].includes(name)) return { meta: 'status' };
      if (['language', '填答語言'].includes(name)) return { meta: 'language' };
      if (name === 'created_at') return { meta: 'created_at' };
      if (BLOCKED_KEYS.has(name)) return { ignored: name };
      if (headerMap.has(name)) return { key: headerMap.get(name) };
      if (KEY_PATTERN.test(name)) return { key: name };
      if (name) result.ignoredHeaders.push(name);
      return { ignored: name };
    });
    if (!columns.some(column => column.key)) {
      result.errors.push({ line: 1, reason: '找不到可辨識的欄位標題，請下載範本確認格式。' });
      return result;
    }

    table.slice(1).forEach((cells, offset) => {
      const line = offset + 2;
      const data = {};
      const record = { response_data: data, language: 'zh-TW', schema_version: 1, status: 'submitted' };
      let failure = '';
      columns.forEach((column, index) => {
        const raw = cells[index];
        if (raw === undefined || raw.trim() === '') return;
        if (column.key) data[column.key] = parseValue(format, column.key, raw);
        else if (column.meta === 'status') {
          if (STATUS_ALIASES[raw.trim()]) record.status = STATUS_ALIASES[raw.trim()];
          else failure = `未知的處理狀態「${raw.trim()}」。`;
        } else if (column.meta === 'language') {
          if (LANGUAGE_ALIASES[raw.trim()]) record.language = LANGUAGE_ALIASES[raw.trim()];
          else failure = `未知的填答語言「${raw.trim()}」。`;
        } else if (column.meta === 'created_at') {
          const time = Date.parse(raw.trim());
          if (Number.isNaN(time)) failure = '送出時間（created_at）需為 ISO 格式，例如 2026-11-04T10:30:00+08:00。';
          else record.created_at = new Date(time).toISOString();
        }
      });
      if (!Object.keys(data).length) return;
      if (!failure && record.status === 'submitted' && !String(data.screener || '').trim()) failure = '已完成的紀錄必須填寫篩檢員編號。';
      if (!failure && data.anonymous_consult_code !== undefined) {
        if (CODE_PATTERN.test(data.anonymous_consult_code)) record.anonymous_consult_code = data.anonymous_consult_code;
        else failure = '匿名諮詢代碼格式不正確（4–32 碼英數字，多組以逗號分隔）。';
      }
      if (!failure && new TextEncoder().encode(JSON.stringify(data)).length > MAX_DATA_BYTES) failure = '單筆資料過大。';
      if (failure) result.errors.push({ line, reason: failure });
      else result.records.push(record);
    });
    return result;
  }

  function templateCsv() {
    const keys = ['screener', 'screening_at', 'screening_place', 'nationality', 'screening_interpretation', 'anonymous_consult_code'];
    const header = ['status', ...keys];
    const sample = ['submitted', 'A001', '2026-11-04', '範例地點', 'TW', 'hiv_negative', ''];
    const quote = value => `"${String(value).replaceAll('"', '""')}"`;
    return `\uFEFF${[header, sample].map(row => row.map(quote).join(',')).join('\r\n')}`;
  }

  // 刪除問卷時一併清除的照片路徑；略過不安全路徑
  function collectPhotoPaths(responses) {
    return [...new Set(responses.flatMap(response => {
      const photos = response?.response_data?.screening_photos;
      if (!photos || typeof photos !== 'object') return [];
      return Object.values(photos).filter(path => typeof path === 'string' && path && !path.includes('..'));
    }))];
  }

  return { BATCH_SIZE, MAX_IMPORT_ROWS, chunk, parseCsv, buildImportRecords, templateCsv, collectPhotoPaths };
});
