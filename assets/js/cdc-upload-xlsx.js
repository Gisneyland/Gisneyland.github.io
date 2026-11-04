(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CdcUploadXlsx = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const COLUMNS = 'ABCDEFGHIJKLMN'.split('');
  const NUMERIC_COLUMNS = new Set(['I', 'L']);
  const DATE_STYLE = 25;
  const TEXT_STYLE = 1;
  const SHEET_PATH = 'xl/worksheets/sheet1.xml';

  function escapeXml(value) {
    return String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
  }

  function cellXml(column, rowNumber, value) {
    if (value === '' || value === null || value === undefined) return '';
    const ref = `${column}${rowNumber}`;
    if (column === 'E') return `<c r="${ref}" s="${DATE_STYLE}"><v>${value}</v></c>`;
    if (NUMERIC_COLUMNS.has(column)) return `<c r="${ref}"><v>${value}</v></c>`;
    return `<c r="${ref}" s="${TEXT_STYLE}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  }

  // 保留範例檔第 1–10 列，從第 11 列起寫入資料
  function fillSheet(sheetXml, rows, firstRow) {
    const rowsXml = rows.map((row, index) => {
      const rowNumber = firstRow + index;
      return `<row r="${rowNumber}" spans="1:14">${COLUMNS.map(column => cellXml(column, rowNumber, row.cells[column])).join('')}</row>`;
    }).join('');
    const lastRow = Math.max(10, firstRow + rows.length - 1);
    return sheetXml
      .replace(/<dimension ref="[^"]*"\s*\/>/, `<dimension ref="A1:N${lastRow}" />`)
      .replace('</sheetData>', `${rowsXml}</sheetData>`);
  }

  async function buildWorkbook(JSZip, templateBuffer, rows, firstRow = 11) {
    const zip = await JSZip.loadAsync(templateBuffer);
    const sheet = zip.file(SHEET_PATH);
    if (!sheet) throw new Error('範例檔格式不符，找不到工作表。');
    zip.file(SHEET_PATH, fillSheet(await sheet.async('string'), rows, firstRow));
    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression: 'DEFLATE'
    });
  }

  return { fillSheet, buildWorkbook };
});
