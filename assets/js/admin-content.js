document.addEventListener('DOMContentLoaded', () => {
  const manager = document.getElementById('site-content-management');
  const contentForm = document.getElementById('site-content-form');
  const contentList = document.getElementById('site-content-list');
  const contentStatus = document.getElementById('site-content-status');
  const formStatus = document.getElementById('site-content-form-status');
  const emptyState = document.getElementById('site-content-empty');
  if (!manager || !contentForm || !window.questionnaireSupabase) return;

  const supabase = window.questionnaireSupabase;
  const contentId = document.getElementById('site-content-id');
  const contentType = document.getElementById('site-content-type');
  const categoryInput = document.getElementById('site-content-category');
  const titleInput = document.getElementById('site-content-title-input');
  const summaryInput = document.getElementById('site-content-summary');
  const bodyInput = document.getElementById('site-content-body');
  const eventFields = document.getElementById('site-content-event-fields');
  const eventStartInput = document.getElementById('site-content-event-start');
  const eventEndInput = document.getElementById('site-content-event-end');
  const locationInput = document.getElementById('site-content-location');
  const urlInput = document.getElementById('site-content-url');
  const publishedInput = document.getElementById('site-content-published');
  const filterSelect = document.getElementById('site-content-filter');
  const saveButton = contentForm.querySelector('[type="submit"]');
  let records = [];
  let activeUserId = null;

  document.getElementById('new-site-content-button').addEventListener('click', () => {
    contentForm.reset();
    contentId.value = '';
    updateEventFields();
    formStatus.hidden = true;
    contentForm.hidden = false;
    titleInput.focus();
  });

  document.getElementById('cancel-site-content-button').addEventListener('click', () => {
    contentForm.hidden = true;
    formStatus.hidden = true;
  });

  document.getElementById('refresh-site-content-button').addEventListener('click', loadRecords);
  filterSelect.addEventListener('change', renderRecords);
  contentType.addEventListener('change', updateEventFields);
  contentForm.addEventListener('submit', saveRecord);
  contentList.addEventListener('click', handleRecordAction);

  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => setSession(session), 0);
  });
  supabase.auth.getSession().then(({ data }) => setSession(data.session));

  async function setSession(session) {
    if (!session) {
      activeUserId = null;
      manager.hidden = true;
      return;
    }
    if (activeUserId === session.user.id && !manager.hidden) return;

    activeUserId = session.user.id;
    const { data: profile, error } = await supabase
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', activeUserId)
      .maybeSingle();

    if (activeUserId !== session.user.id) return;
    if (error || !profile) {
      manager.hidden = true;
      return;
    }

    manager.hidden = false;
    await loadRecords();
  }

  async function loadRecords() {
    showStatus(contentStatus, '新聞與活動載入中。');
    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showStatus(contentStatus, '無法載入內容。請先在 Supabase 執行 schema.sql 的 site_content migration。', true);
      return;
    }

    records = data || [];
    renderRecords();
    contentStatus.hidden = true;
  }

  function renderRecords() {
    const filter = filterSelect.value;
    const visibleRecords = records.filter(record => filter === 'all' || record.content_type === filter);
    contentList.replaceChildren();
    emptyState.hidden = visibleRecords.length > 0;

    visibleRecords.forEach(record => {
      const item = document.createElement('article');
      item.className = 'site-content-item';

      const information = document.createElement('div');
      information.className = 'site-content-item-info';
      const heading = document.createElement('h3');
      heading.textContent = record.title;
      const metadata = document.createElement('p');
      metadata.className = 'admin-muted';
      const typeLabel = record.content_type === 'event' ? '活動' : '新聞';
      const dateLabel = record.content_type === 'event'
        ? formatEventDates(record.event_start, record.event_end)
        : formatTimestamp(record.published_at || record.created_at);
      metadata.textContent = [typeLabel, record.category, dateLabel, record.location, record.is_published ? '已上架' : '草稿']
        .filter(Boolean)
        .join(' · ');
      const summary = document.createElement('p');
      summary.className = 'site-content-item-summary';
      summary.textContent = record.summary;
      information.append(heading, metadata, summary);

      const actions = document.createElement('div');
      actions.className = 'site-content-item-actions';
      actions.append(
        createActionButton('edit', record.id, '編輯'),
        createActionButton('toggle', record.id, record.is_published ? '下架' : '上架'),
        createActionButton('delete', record.id, '刪除')
      );
      item.append(information, actions);
      contentList.append(item);
    });
  }

  function createActionButton(action, id, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-button secondary';
    button.dataset.contentAction = action;
    button.dataset.contentId = id;
    button.textContent = label;
    return button;
  }

  function handleRecordAction(event) {
    const button = event.target.closest('[data-content-action]');
    if (!button) return;
    const record = records.find(item => item.id === button.dataset.contentId);
    if (!record) return;

    if (button.dataset.contentAction === 'edit') {
      editRecord(record);
    } else if (button.dataset.contentAction === 'toggle') {
      togglePublished(record);
    } else if (button.dataset.contentAction === 'delete') {
      deleteRecord(record);
    }
  }

  function editRecord(record) {
    contentForm.reset();
    contentId.value = record.id;
    contentType.value = record.content_type;
    categoryInput.value = record.category || '';
    titleInput.value = record.title;
    summaryInput.value = record.summary || '';
    bodyInput.value = record.body || '';
    eventStartInput.value = record.event_start || '';
    eventEndInput.value = record.event_end || '';
    locationInput.value = record.location || '';
    urlInput.value = record.url || '';
    publishedInput.checked = record.is_published;
    updateEventFields();
    formStatus.hidden = true;
    contentForm.hidden = false;
    titleInput.focus();
  }

  function updateEventFields() {
    const isEvent = contentType.value === 'event';
    eventFields.hidden = !isEvent;
    eventStartInput.required = isEvent;
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!contentForm.reportValidity()) return;

    const existing = records.find(record => record.id === contentId.value);
    const isEvent = contentType.value === 'event';
    if (isEvent && eventEndInput.value && eventEndInput.value < eventStartInput.value) {
      showStatus(formStatus, '活動結束日期不可早於開始日期。', true);
      eventEndInput.focus();
      return;
    }

    let url;
    try {
      url = normalizeUrl(urlInput.value);
    } catch {
      showStatus(formStatus, '連結請使用 http(s) 網址或以 / 開頭的站內路徑。', true);
      urlInput.focus();
      return;
    }

    const isPublished = publishedInput.checked;
    const payload = {
      content_type: contentType.value,
      category: categoryInput.value.trim(),
      title: titleInput.value.trim(),
      summary: summaryInput.value.trim(),
      body: bodyInput.value.trim(),
      url,
      event_start: isEvent ? eventStartInput.value : null,
      event_end: isEvent ? eventEndInput.value || null : null,
      location: isEvent ? locationInput.value.trim() : '',
      is_published: isPublished,
      published_at: isPublished ? existing?.published_at || new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    saveButton.disabled = true;
    showStatus(formStatus, '儲存中。');
    try {
      const result = existing
        ? await supabase.from('site_content').update(payload).eq('id', existing.id)
        : await supabase.from('site_content').insert({ ...payload, created_by: activeUserId });
      if (result.error) throw result.error;
      contentForm.hidden = true;
      formStatus.hidden = true;
      await loadRecords();
    } catch (error) {
      showStatus(formStatus, contentErrorMessage(error), true);
    } finally {
      saveButton.disabled = false;
    }
  }

  async function togglePublished(record) {
    const isPublished = !record.is_published;
    const { error } = await supabase
      .from('site_content')
      .update({
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);
    if (error) {
      showStatus(contentStatus, contentErrorMessage(error), true);
      return;
    }
    await loadRecords();
  }

  async function deleteRecord(record) {
    if (!window.confirm(`確定刪除「${record.title}」？`)) return;
    const { error } = await supabase.from('site_content').delete().eq('id', record.id);
    if (error) {
      showStatus(contentStatus, contentErrorMessage(error), true);
      return;
    }
    await loadRecords();
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid URL protocol');
    return parsed.href;
  }

  function formatEventDates(start, end) {
    if (!start) return '';
    const startLabel = formatDateOnly(start);
    return end && end !== start ? `${startLabel} 至 ${formatDateOnly(end)}` : startLabel;
  }

  function formatDateOnly(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' })
      .format(new Date(year, month - 1, day));
  }

  function formatTimestamp(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(new Date(value));
  }

  function contentErrorMessage(error) {
    return error?.code === '42501'
      ? '此帳號沒有內容管理權限。'
      : '儲存失敗，請確認資料庫已套用 site_content migration 後再試。';
  }

  function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.hidden = false;
  }
});