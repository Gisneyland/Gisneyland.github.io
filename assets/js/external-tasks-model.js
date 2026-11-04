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

  function appliesTo(link, response, placeText) {
    if (response?.status === 'draft') return false;
    if (link.kind === 'nationality_questionnaire') {
      const wanted = norm(link.nationality);
      return Boolean(wanted) && responseNationalities(response).includes(wanted);
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
    return (links || [])
      .filter(link => appliesTo(link, response, placeText))
      .map(link => ({ link, done: Boolean(progress[link.id]?.done_at), done_at: progress[link.id]?.done_at || null }));
  }

  function summarize(tasks) {
    const done = tasks.filter(task => task.done).length;
    return { total: tasks.length, done, pending: tasks.length - done };
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

  return { KINDS, getTasks, summarize, setDone, isSafeUrl, norm };
});
