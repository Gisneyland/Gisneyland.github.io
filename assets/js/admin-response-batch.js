// 篩檢紀錄的批次匯入／刪除介面。資料列表與選取狀態由 admin.js 持有，這裡只透過 init 傳入的回呼互動。
(function (root) {
  const PHOTO_BUCKET = 'screening-test-photos';

  function init(options) {
    const {
      getSelectedResponses, onDeleted, onImported, showStatus, statusElement, format
    } = options;
    const Model = root.ResponseBatchModel;
    const importButton = document.getElementById('import-responses-button');
    const deleteButton = document.getElementById('delete-responses-button');
    const dialog = document.getElementById('response-import-dialog');
    const form = document.getElementById('response-import-form');
    if (!Model || !importButton || !deleteButton || !dialog || !form) return { setEnabled() {}, refresh() {} };

    const fileInput = document.getElementById('response-import-file');
    const submitButton = document.getElementById('response-import-submit');
    const scopeElement = document.getElementById('response-import-scope');
    const errorList = document.getElementById('response-import-errors');
    const importStatus = document.getElementById('response-import-status');
    let enabled = false;
    let parsed = null;
    let busy = false;

    function refresh() {
      const count = getSelectedResponses().length;
      importButton.hidden = !enabled;
      deleteButton.hidden = !enabled;
      deleteButton.disabled = busy || count === 0;
      deleteButton.title = count ? `刪除已選取的 ${count} 筆紀錄` : '刪除已選取的紀錄（請先勾選）';
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      refresh();
    }

    function download(filename, text) {
      const link = document.createElement('a');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      window.setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);
    }

    function renderErrors(errors, ignoredHeaders = []) {
      const shown = errors.slice(0, 20).map(item => `${item.line ? `第 ${item.line} 列：` : ''}${item.reason}`);
      if (errors.length > shown.length) shown.push(`另有 ${errors.length - shown.length} 筆錯誤未列出。`);
      if (ignoredHeaders.length) shown.push(`已忽略無法辨識的欄位：${ignoredHeaders.join('、')}`);
      errorList.replaceChildren(...shown.map(text => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
      errorList.hidden = shown.length === 0;
    }

    function resetImportDialog() {
      parsed = null;
      form.reset();
      submitButton.disabled = true;
      scopeElement.textContent = '';
      importStatus.hidden = true;
      renderErrors([]);
    }

    importButton.addEventListener('click', () => {
      resetImportDialog();
      if (!dialog.open) dialog.showModal();
    });
    document.getElementById('response-import-close').addEventListener('click', () => dialog.close());
    document.getElementById('response-import-template').addEventListener('click', () => {
      download('questionnaire-import-template.csv', Model.templateCsv());
    });

    fileInput.addEventListener('change', async () => {
      parsed = null;
      submitButton.disabled = true;
      importStatus.hidden = true;
      const file = fileInput.files[0];
      if (!file) return;
      const result = Model.buildImportRecords(Model.parseCsv(await file.text()), format);
      parsed = result;
      renderErrors(result.errors, result.ignoredHeaders);
      scopeElement.textContent = `可匯入 ${result.records.length} 筆，需修正 ${result.errors.length} 筆；將分成 ${Model.chunk(result.records).length} 批寫入。`;
      submitButton.disabled = result.records.length === 0;
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!parsed?.records.length || busy) return;
      const total = parsed.records.length;
      if (parsed.errors.length && !window.confirm(`有 ${parsed.errors.length} 筆資料有誤，將只匯入其餘 ${total} 筆。繼續？`)) return;
      busy = true;
      submitButton.disabled = true;
      refresh();
      let imported = 0;
      let failure = '';
      for (const batch of Model.chunk(parsed.records)) {
        showStatus(importStatus, `匯入中… ${imported} / ${total}`);
        const { data, error } = await root.SiteData.responses.insertMany(batch);
        if (error) {
          failure = `第 ${imported + 1}–${imported + batch.length} 筆寫入失敗（${error.message || '權限不足'}），已停止；先前 ${imported} 筆已匯入。請確認已執行 202611080001 migration 且帳號具編輯權限。`;
          break;
        }
        imported += data?.length ?? batch.length;
      }
      busy = false;
      refresh();
      if (failure) {
        showStatus(importStatus, failure, true);
        submitButton.disabled = true;
      } else {
        showStatus(importStatus, `已匯入 ${imported} 筆資料。`);
        parsed = null;
      }
      if (imported) await onImported(imported);
    });

    deleteButton.addEventListener('click', async () => {
      const targets = getSelectedResponses();
      if (!enabled || busy || !targets.length) return;
      const typed = window.prompt(`即將永久刪除 ${targets.length} 筆篩檢紀錄（含陽性試劑照片），無法復原。\n建議先匯出備份。若確定刪除，請輸入「刪除」：`);
      if (typed === null) return;
      if (typed.trim() !== '刪除') { showStatus(statusElement, '輸入不符，未刪除任何資料。', true); return; }

      busy = true;
      refresh();
      const deletedIds = [];
      let failure = '';
      for (const batch of Model.chunk(targets)) {
        showStatus(statusElement, `刪除中… ${deletedIds.length} / ${targets.length}`);
        const { data, error } = await root.SiteData.responses.deleteMany(batch.map(response => response.id));
        if (error) { failure = error.message || '權限不足'; break; }
        const removed = new Set((data || []).map(row => row.id));
        deletedIds.push(...removed);
        const paths = Model.collectPhotoPaths(batch.filter(response => removed.has(response.id)));
        if (paths.length) await root.SiteData.responses.removePhotos(PHOTO_BUCKET, paths).catch(() => {});
        if (removed.size < batch.length) { failure = '部分資料未被刪除，可能是權限不足或資料已被其他人刪除'; break; }
      }
      busy = false;
      if (deletedIds.length) onDeleted(deletedIds);
      else refresh();
      showStatus(
        statusElement,
        failure
          ? `已刪除 ${deletedIds.length} 筆，其餘未刪除：${failure}。請確認已執行 202611080001 migration 且帳號具編輯權限。`
          : `已刪除 ${deletedIds.length} 筆資料。`,
        Boolean(failure)
      );
    });

    return { setEnabled, refresh };
  }

  root.AdminResponseBatch = { init };
})(window);
