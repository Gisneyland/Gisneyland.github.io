(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.CdcUploadModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const UNITS = { local: '地方衛生局', cdc: '疾管署' };
  const DEFAULT_UNIT = 'cdc';
  const MAX_ROWS_PER_FILE = 500;
  const FIRST_DATA_ROW = 11;
  const CODE_PATTERN = /^\d{6}$/;

  function splitCodes(value) {
    return [...new Set(String(value || '').split(/[\r\n,，;；]+/).map(code => code.trim()).filter(Boolean))];
  }

  function normalizeUploads(uploads) {
    return (Array.isArray(uploads) ? uploads : [])
      .filter(item => item && typeof item.code === 'string')
      .map(item => ({
        code: item.code,
        unit: UNITS[item.unit] ? item.unit : DEFAULT_UNIT,
        uploaded_at: item.uploaded_at || null,
        uploaded_by: item.uploaded_by || null
      }));
  }

  // 代碼清單以 anonymous_consult_code 為準；consult_uploads 只補上各代碼的單位與上傳狀態
  function getCodeEntries(response) {
    const saved = new Map(normalizeUploads(response?.consult_uploads).map(item => [item.code, item]));
    const codes = splitCodes(response?.anonymous_consult_code ?? response?.response_data?.anonymous_consult_code);
    return codes.map(code => saved.get(code) || { code, unit: DEFAULT_UNIT, uploaded_at: null, uploaded_by: null });
  }

  function getUploadState(response) {
    if (response?.status === 'draft') return { key: 'draft', pending: [] };
    const entries = getCodeEntries(response);
    if (!entries.length) return { key: 'needs-code', pending: [] };
    const pending = entries.filter(entry => !entry.uploaded_at);
    if (pending.length) return { key: 'needs-upload', pending };
    return { key: 'uploaded', pending: [] };
  }

  function stateLabel(state) {
    if (state.key === 'draft') return '草稿';
    if (state.key === 'needs-code') return '待填諮詢代碼';
    if (state.key === 'needs-upload') {
      const units = [...new Set(state.pending.map(entry => UNITS[entry.unit]))];
      return `待上傳串接：${units.join('、')}`;
    }
    return '已上傳串接';
  }

  function excelDateSerial(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return null;
    const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Math.round((time - Date.UTC(1899, 11, 30)) / 86400000);
  }

  function hivResult(data) {
    const results = Array.isArray(data.screening_interpretation)
      ? data.screening_interpretation
      : [data.screening_interpretation];
    if (results.includes('hiv_positive')) return 1;
    if (results.includes('hiv_negative')) return 0;
    return null;
  }

  function cleanText(value) {
    return String(value ?? '').replace(/[,，\r\n]+/g, ' ').trim();
  }

  /*
   * 每個尚未上傳到指定單位的諮詢代碼產生一列。
   * options: { unit, includeUploaded, screeningUnitCode, siteCategory, method('rapid'|'initial'), rapidItem, initialItem, told, cooperation }
   */
  function buildImportRows(responses, options) {
    const rows = [];
    const skipped = [];
    const unit = options.unit;
    responses.forEach(response => {
      const data = response.response_data || {};
      getCodeEntries(response).forEach(entry => {
        if (entry.unit !== unit) return;
        if (entry.uploaded_at && !options.includeUploaded) return;
        const code = entry.code.replace(/^E/i, '');
        const reasons = [];
        if (response.status === 'draft') reasons.push('草稿尚未完成');
        if (!CODE_PATTERN.test(code)) reasons.push('諮詢代碼需為 6 碼數字（不含開頭 E）');
        const serial = excelDateSerial(data.screening_at);
        if (serial === null) reasons.push('缺少篩檢日期');
        if (!cleanText(data.screening_place)) reasons.push('缺少篩檢地點');
        const result = hivResult(data);
        if (result === null) reasons.push('缺少 HIV 篩檢判讀');
        if (reasons.length) {
          skipped.push({ id: response.id, code: entry.code, reason: reasons.join('；') });
          return;
        }
        const rapid = options.method === 'rapid';
        rows.push({
          responseId: response.id,
          code: entry.code,
          cells: {
            A: code,
            B: options.screeningUnitCode,
            C: String(options.siteCategory),
            D: cleanText(data.screening_place),
            E: serial,
            F: rapid ? '1' : '2',
            G: '',
            H: rapid ? String(options.rapidItem) : '',
            I: rapid ? result : '',
            J: rapid ? String(options.told) : '',
            K: rapid ? '' : String(options.initialItem),
            L: rapid ? '' : result,
            M: '',
            N: cleanText(options.cooperation)
          }
        });
      });
    });
    return { rows, skipped };
  }

  function chunkRows(rows, size = MAX_ROWS_PER_FILE) {
    const chunks = [];
    for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
    return chunks;
  }

  function validateOptions(options) {
    const unitCode = String(options.screeningUnitCode || '').trim();
    if (!/^(\d{10}|\d{8})$/.test(unitCode)) return '篩檢單位需為醫事機構 10 碼或統編 8 碼。';
    return '';
  }

  // 將指定單位下的這些代碼標記為已上傳，回傳完整的 consult_uploads
  function markUploaded(response, codes, unit, at, by) {
    const wanted = new Set(codes);
    return getCodeEntries(response).map(entry => (
      wanted.has(entry.code) && entry.unit === unit
        ? { ...entry, uploaded_at: at, uploaded_by: by || null }
        : entry
    ));
  }

  return {
    UNITS, DEFAULT_UNIT, MAX_ROWS_PER_FILE, FIRST_DATA_ROW,
    splitCodes, normalizeUploads, getCodeEntries, getUploadState, stateLabel,
    excelDateSerial, buildImportRows, chunkRows, validateOptions, markUploaded
  };
});
