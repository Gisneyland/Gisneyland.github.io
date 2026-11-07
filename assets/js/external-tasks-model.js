(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.ExternalTasksModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const KINDS = { nationality_questionnaire: '外國問卷', agency_site: '衛生局／疾管署網站' };

  function norm(value) {
    return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
  }

  function responseNationalities(response) {
    const value = response?.response_data?.nationality;
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return values.map(norm).filter(Boolean);
  }

  // 一份連結可對應多個國籍；舊資料只有 nationality 單一欄位
  function linkNationalities(link) {
    const list = Array.isArray(link?.nationalities) && link.nationalities.length ? link.nationalities : [link?.nationality];
    return [...new Set(list.map(norm).filter(Boolean))];
  }

  function appliesTo(link, response, placeText) {
    if (response?.status === 'draft') return false;
    if (link.kind === 'nationality_questionnaire') {
      const wanted = linkNationalities(link);
      const held = responseNationalities(response);
      return wanted.some(code => held.includes(code));
    }
    if (link.kind === 'agency_site') {
      const keywords = (link.match_keywords || []).map(norm).filter(Boolean);
      if (!keywords.length) return true;
      const place = norm(placeText);
      return keywords.some(keyword => place.includes(keyword));
    }
    return false;
  }

  // placeTextFor(response) 可提供地點名稱與地址，用於比對縣市關鍵字
  function getTasks(response, links, placeTextFor) {
    const progress = response?.task_progress && typeof response.task_progress === 'object' ? response.task_progress : {};
    const placeText = placeTextFor ? placeTextFor(response) : response?.response_data?.screening_place;
    const tasks = (links || [])
      .filter(link => appliesTo(link, response, placeText))
      .map(link => ({ link, done: Boolean(progress[link.id]?.done_at), done_at: progress[link.id]?.done_at || null, locked: false }));
    // 每筆篩檢紀錄只能填一份外國問卷：已完成其中一份後，其餘外國問卷不再需要填寫
    const questionnaires = tasks.filter(task => task.link.kind === 'nationality_questionnaire');
    if (questionnaires.some(task => task.done)) questionnaires.forEach(task => { task.locked = !task.done; });
    return tasks;
  }

  function summarize(tasks) {
    const active = tasks.filter(task => !task.locked);
    const done = active.filter(task => task.done).length;
    return { total: active.length, done, pending: active.length - done };
  }

  function setDone(progress, linkId, done, at, by) {
    const next = { ...(progress || {}) };
    if (done) next[linkId] = { done_at: at, by: by || null };
    else delete next[linkId];
    return next;
  }

  function isSafeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  return { KINDS, linkNationalities, getTasks, summarize, setDone, isSafeUrl, norm };
});
