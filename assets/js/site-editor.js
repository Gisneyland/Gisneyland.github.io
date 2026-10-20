(function (global) {
  'use strict';
  const M = global.SiteEditorModel;
  const page = document.body.dataset.siteEditorPage;
  const enabled = page && !/^\/admin(?:\/|$)/.test(page);
  const baseline = global.SiteEditorDOM.capture(enabled ? document.getElementById('main-content') : null,
    document.querySelector('.site-navigation'));
  let client, admin = false, generation = 0, operation = 0, busy = false, dirty = false, preview = false, overlayActive = false;
  let activeUserId = null, profileCheck = 0;
  let published = M.empty(), publishedNav = M.empty(), draft = null, navDraft = null;
  let pageRevision = 0, navRevision = 0, panel, trigger;
  let inline, visual = false, restoring = false;
  const undo = [], redo = [];
  const $ = id => document.getElementById(`site-editor-${id}`);
  const copy = value => JSON.parse(JSON.stringify(value));
  function message(value) {
    if ($('status')) $('status').textContent = value;
    if ($('mode-status')) $('mode-status').textContent = value;
  }
  function historyControls() {
    if ($('undo')) $('undo').disabled = busy || !undo.length;
    if ($('redo')) $('redo').disabled = busy || !redo.length;
  }
  function editing(value) {
    visual = value;
    document.body.classList.toggle('site-editor-editing', value);
    if ($('mode-actions')) $('mode-actions').hidden = !value;
    trigger?.setAttribute('aria-pressed', String(value));
    if (!value) inline?.stop();
    historyControls();
  }
  function authorized(token) { return admin && token === generation; }
  function errorMessage(error) {
    return `編輯服務無法使用：${error?.message || '連線失敗'}。請確認已依序執行 supabase/migrations/202610200001_site_editor.sql、202610200002_site_editor_rich.sql、202610200003_site_editor_media.sql，且管理員已核准並完成個資同意。原網站不受影響。`;
  }
  function showPublished() {
    editing(false);
    applyOverlay(published, publishedNav);
    preview = false; document.body.classList.remove('site-editor-preview');
    if ($('preview-toolbar')) $('preview-toolbar').hidden = true;
  }
  function applyOverlay(content, navigation) {
    inline?.stop();
    const nextOverlay = Boolean(Object.keys(content.patches).length || Object.keys(content.orders).length
      || content.blocks.length || navigation.navigation);
    if (overlayActive || nextOverlay) baseline.render(content, navigation);
    overlayActive = nextOverlay;
    if (visual && !busy) inline?.start();
  }
  function revoke() {
    generation += 1; operation += 1; profileCheck += 1;
    activeUserId = null; admin = false; busy = false; dirty = false;
    draft = null; navDraft = null;
    undo.length = 0; redo.length = 0;
    if (trigger) trigger.hidden = true;
    if (panel) {
      panel.hidden = true; trigger?.setAttribute('aria-expanded', 'false');
      panel.querySelectorAll('input,textarea').forEach(node => { node.value = ''; });
      for (const id of ['text', 'link', 'node', 'parent', 'before', 'block', 'nav-item']) $(id).replaceChildren();
      message(''); $('node-info').textContent = '';
    }
    showPublished();
  }
  async function read(table, key) {
    const { data, error } = await client.from(table).select('document,revision').eq('page_key', key).maybeSingle();
    if (error) throw error;
    return { document: data ? M.normalize(data.document) : null, revision: data?.revision || 0 };
  }
  async function loadPublished() {
    try {
      const [content, nav] = await Promise.all([
        enabled ? read('site_editor_publications', page) : Promise.resolve({ document: null }),
        read('site_editor_publications', '@navigation')
      ]);
      published = content.document || M.empty(); publishedNav = nav.document || M.empty();
      if (!preview && !visual) showPublished();
    } catch (error) {
      // Missing migrations and network failures never blank or disable the static site.
      if (admin) message(errorMessage(error));
    }
  }
  async function checkSession(session, token, check, preserve) {
    try {
      const { data, error } = await client.from('admin_profiles')
        .select('account_role,approval_status,privacy_consent_at').eq('user_id', session.user.id).maybeSingle();
      if (token !== generation || check !== profileCheck || activeUserId !== session.user.id) return;
      if (error || !M.administrator(data)) { revoke(); return; }
      admin = true; trigger.hidden = false;
      if (!preserve && new URLSearchParams(location.search).get('site-editor') === '1') open();
    } catch {
      if (token === generation && check === profileCheck) revoke();
    }
  }
  function scheduleSession(session, event) {
    const userId = event === 'SIGNED_OUT' ? null : session?.user?.id || null;
    const preserve = Boolean(userId && userId === activeUserId && admin);
    if (!preserve) revoke();
    activeUserId = userId;
    const token = generation, check = ++profileCheck;
    if (!userId || !enabled) return;
    // Same-user refreshes retain drafts while the server-authoritative profile is rechecked.
    // Defer Supabase queries until its auth callback has released the auth lock.
    global.setTimeout(() => {
      if (token === generation && check === profileCheck) checkSession(session, token, check, preserve);
    }, 0);
  }
  function setBusy(value) {
    busy = value;
    panel.querySelectorAll('button,select,input,textarea').forEach(node => { node.disabled = value || !draft; });
    $('close').disabled = false;
    for (const id of ['reopen', 'preview-leave']) $(id).disabled = value;
    for (const id of ['mode-save', 'settings']) if ($(id)) $(id).disabled = value || !draft;
    if (value) inline?.stop();
    else if (visual) inline?.start();
    historyControls();
    if (!value && draft) nodeSelection();
    if (!value && preview && panel.hidden) $('reopen').focus();
  }
  async function run(action) {
    if (!admin || busy) return;
    if (inline?.flush() === false) return;
    const token = generation, currentOperation = ++operation;
    setBusy(true);
    try { await action(token); }
    catch (error) { if (authorized(token) && currentOperation === operation) message(errorMessage(error)); }
    finally { if (authorized(token) && currentOperation === operation) setBusy(false); }
  }
  function selected(id) { return $(id).value; }
  function fill(id, entries, value, first) {
    const select = $(id); select.replaceChildren();
    if (first) { const option = document.createElement('option'); option.value = ''; option.textContent = first; select.append(option); }
    for (const [key, label] of entries) {
      const option = document.createElement('option'); option.value = key; option.textContent = label;
      select.append(option);
    }
    if (Array.from(select.options).some(option => option.value === value)) select.value = value;
  }
  function textSelection() {
    const id = selected('text');
    $('text-value').value = draft.patches[id]?.text ?? baseline.texts.get(id)?.original ?? '';
  }
  function linkSelection() {
    const id = selected('link');
    $('link-value').value = draft.patches[id]?.href ?? baseline.links.get(id)?.original ?? '';
  }
  function nodeSelection() {
    const id = selected('node'), target = baseline.nodes.get(id);
    $('node-info').textContent = target
      ? `${target.element.textContent.trim().slice(0, 65)}${draft.patches[id]?.deleted ? '（已刪除）' : ''}${target.deletable ? '' : '（互動工具，無法移動或刪除）'}` : '';
    $('node-delete').disabled = !target?.deletable;
    $('node-up').disabled = !target?.movable;
    $('node-down').disabled = !target?.movable;
  }
  function blockSelection() {
    const block = draft.blocks.find(item => item.id === selected('block'));
    for (const field of ['title', 'body', 'url', 'label']) $('block-' + field).value = block?.[field] || '';
    $('parent').value = block?.parent || baseline.root;
    beforeSelection(block?.before || '');
  }
  function beforeSelection(value = '') {
    const parentId = selected('parent');
    fill('before', Array.from(baseline.nodes).filter(([, node]) => node.parent === parentId && node.movable)
      .map(([id, node]) => [id, `${node.label} — ${node.element.textContent.trim().slice(0, 55)}`]), value, '容器末端');
  }
  function navSelection() {
    const item = navDraft.navigation[selected('nav-group')].find(entry => entry.id === selected('nav-item'));
    $('nav-label').value = item?.label || ''; $('nav-url').value = item?.url || '';
  }
  function refreshNav(value) {
    fill('nav-item', navDraft.navigation[selected('nav-group')].map(item => [item.id, item.label]), value, '新增導覽項目');
    navSelection();
  }
  function refresh() {
    if (!draft || !navDraft) return;
    fill('text', Array.from(baseline.texts, ([id, item]) => [id, `${item.element.tagName}: ${item.label}`]), selected('text'));
    fill('link', Array.from(baseline.links, ([id, item]) => [id, item.label]), selected('link'));
    const nodeEntries = Array.from(baseline.nodes).filter(([, item]) => item.parent
      && /^(SECTION|ARTICLE|DIV|LI|A|H[1-6]|P|UL|OL)$/.test(item.element.tagName));
    fill('node', nodeEntries.map(([id, item]) => [id, `${'·'.repeat(Math.min(id.split('/').length, 8))} ${item.label} — ${item.element.textContent.trim().slice(0, 45)}`]), selected('node'));
    fill('parent', Array.from(baseline.parents).filter(([, item]) => /^(MAIN|SECTION|ARTICLE|DIV)$/.test(item.element.tagName))
      .map(([id, item]) => [id, item.element.querySelector('h1,h2,h3,h4')?.textContent.trim().slice(0, 55)
        || item.element.textContent.trim().slice(0, 55) || '頁面內容']), selected('parent') || baseline.root);
    fill('block', draft.blocks.map(block => [block.id, block.title || '未命名區塊']), selected('block'), '新增區塊');
    textSelection(); linkSelection(); nodeSelection(); blockSelection(); refreshNav(selected('nav-item'));
  }
  function changed() {
    draft = M.normalize(draft); navDraft = M.normalize(navDraft); dirty = true;
    if (preview || visual) applyOverlay(draft, navDraft);
    message('草稿已修改，尚未儲存／發布。');
  }
  function mutate(action) {
    if (!admin || busy || !draft) return;
    const before = copy(draft), navBefore = copy(navDraft);
    try {
      action();
      draft = M.normalize(draft); navDraft = M.normalize(navDraft);
      if (JSON.stringify([before, navBefore]) === JSON.stringify([draft, navDraft])) return;
      if (!restoring) {
        undo.push([before, navBefore]); if (undo.length > 100) undo.shift();
        redo.length = 0;
      }
      changed(); historyControls();
    }
    catch (error) { draft = before; navDraft = navBefore; message(error.message); }
  }
  async function open() {
    if (!admin) return;
    panel.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    $('close').focus();
    if (draft) {
      editing(true); applyOverlay(draft, navDraft); refresh(); return;
    }
    await run(async token => {
      message('載入私人草稿…');
      const [content, nav] = await Promise.all([read('site_editor_drafts', page), read('site_editor_drafts', '@navigation')]);
      if (!authorized(token)) return;
      draft = content.document || copy(published); navDraft = nav.document || copy(publishedNav);
      if (!navDraft.navigation) navDraft.navigation = copy(baseline.baselineNavigation);
      pageRevision = content.revision; navRevision = nav.revision; dirty = false;
      editing(true); applyOverlay(draft, navDraft);
      refresh(); message('私人草稿已載入。點文字編輯，長按元件調整順序；儲存後再發布。');
    });
  }
  async function save(token) {
    if (!draft || !authorized(token)) throw new Error('請先載入草稿');
    const { data, error } = await client.rpc('save_site_editor_drafts', {
      target_page: page, page_document: M.normalize(draft), navigation_document: M.normalize(navDraft),
      expected_page_revision: pageRevision, expected_navigation_revision: navRevision
    });
    if (error) throw error;
    if (!authorized(token)) return false;
    pageRevision = data.page_revision; navRevision = data.navigation_revision; dirty = false;
    message('私人草稿已儲存，尚未發布。'); return true;
  }
  async function uploadMedia(file) {
    if (!admin || !visual || busy || !activeUserId) throw new Error('請先進入管理員編輯模式');
    const types = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
      'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/webm': 'webm' };
    const extension = types[file?.type];
    if (!extension || !file.size || file.size > 10485760) throw new Error('請選擇 10 MB 以內的 PNG、JPEG、WebP、GIF、MP3、OGG、WAV、MP4 或 WebM 檔案');
    if (!global.confirm('此檔案上傳後即為公開素材，即使尚未發布草稿也可經網址讀取。確認不含個資、健康資料，且有權使用？')) return null;
    const token = generation;
    const name = `${activeUserId}/${global.crypto.randomUUID()}.${extension}`;
    const bucket = client.storage.from('site-editor-media');
    const { error } = await bucket.upload(name, file, { contentType: file.type, upsert: false });
    if (!authorized(token)) return null;
    if (error) throw new Error(`上傳失敗：${error.message}。請確認已安裝 202610200003_site_editor_media.sql`);
    const { data } = bucket.getPublicUrl(name);
    if (!M.safeURL(data?.publicUrl)) throw new Error('素材網址無效');
    return data.publicUrl;
  }
  function close() {
    if (inline?.flush() === false) return;
    panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    showPublished(); trigger.focus();
  }
  function move(array, id, direction) {
    const index = array.findIndex(item => (typeof item === 'string' ? item : item.id) === id);
    const next = index + direction;
    if (index >= 0 && next >= 0 && next < array.length) [array[index], array[next]] = [array[next], array[index]];
  }
  function wire() {
    trigger.addEventListener('click', () => { if (visual) close(); else open(); });
    $('close').addEventListener('click', close);
    $('reopen').addEventListener('click', open);
    $('preview-leave').addEventListener('click', () => {
      showPublished(); message('已離開預覽；可重新開啟草稿。'); trigger.focus();
    });
    $('mode-save')?.addEventListener('click', () => run(save));
    $('settings')?.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      trigger.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) $('close').focus();
    });
    for (const [id, source, destination] of [['undo', undo, redo], ['redo', redo, undo]]) {
      $(id)?.addEventListener('click', () => {
        if (!admin || busy || !draft) return;
        if (inline?.flush() === false) return;
        const state = source.pop();
        if (!state) return;
        destination.push([copy(draft), copy(navDraft)]);
        restoring = true;
        try {
          [draft, navDraft] = copy(state); changed(); refresh(); historyControls();
        } finally { restoring = false; }
      });
    }
    document.addEventListener('keydown', event => {
      if (!visual || busy || !(event.ctrlKey || event.metaKey) || event.altKey
        || !['z', 'y'].includes(event.key.toLowerCase())) return;
      const target = event.target;
      if (target.closest('input,textarea') && !target.closest('.site-editor-inline-ui')) return;
      event.preventDefault();
      $(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo')?.click();
    });
    document.addEventListener('input', event => {
      if (visual && event.target.closest('.site-editor-editable,.site-editor-inline-ui')) dirty = true;
    });
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    $('page').value = document.body.dataset.siteEditorUrl;
    $('page').addEventListener('change', () => run(async token => {
      const target = selected('page');
      if (!M.publicPage(target)) throw new Error('請選擇站內公開頁面');
      const destination = new URL(location.origin);
      destination.pathname = target;
      destination.searchParams.set('site-editor', '1');
      if (!await save(token)) return;
      if (authorized(token)) location.assign(destination.href);
    }));
    $('save').addEventListener('click', () => run(save));
    $('preview').addEventListener('click', () => run(async token => {
      if (!await save(token) || !authorized(token) || panel.hidden) return;
      editing(false);
      preview = true; applyOverlay(draft, navDraft); document.body.classList.add('site-editor-preview');
      panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
      $('preview-toolbar').hidden = false; $('reopen').focus();
      message('管理員草稿預覽中；訪客仍看到已發布版本。');
    }));
    $('exit').addEventListener('click', () => { showPublished(); message('已離開預覽；可重新開啟草稿。'); });
    $('publish').addEventListener('click', () => run(async token => {
      if (!draft) throw new Error('請先載入草稿');
      if (dirty) { message('請先儲存草稿，再發布。'); return; }
      if (!global.confirm('發布目前頁面與全站導覽？所有訪客將可看到內容。')) return;
      const { error } = await client.rpc('publish_site_editor', { target_page: page,
        expected_page_revision: pageRevision, expected_navigation_revision: navRevision });
      if (error) throw error;
      if (!authorized(token)) return;
      published = copy(draft); publishedNav = copy(navDraft); showPublished(); message('已發布目前頁面與全站導覽。');
    }));
    $('reset').addEventListener('click', () => {
      if (global.confirm('將目前頁面草稿還原為原始版面？導覽不變；儲存、發布後才對訪客生效。')) {
        mutate(() => { draft = M.empty(); }); refresh();
      }
    });
    $('text').addEventListener('change', textSelection);
    $('link').addEventListener('change', linkSelection);
    $('node').addEventListener('change', nodeSelection);
    $('text-apply').addEventListener('click', () => mutate(() => {
      const id = selected('text'); if (!baseline.texts.has(id)) return;
      draft.patches[id] = { ...draft.patches[id], text: $('text-value').value };
      delete draft.patches[id].rich;
    }));
    $('link-apply').addEventListener('click', () => mutate(() => {
      const id = selected('link'); if (!baseline.links.has(id)) return;
      draft.patches[id] = { ...draft.patches[id], href: $('link-value').value };
    }));
    for (const [name, direction] of [['up', -1], ['down', 1]]) {
      $('node-' + name).addEventListener('click', () => mutate(() => {
        const id = selected('node'), parent = baseline.nodes.get(id)?.parent;
        if (!parent || !baseline.nodes.get(id).movable) return;
        const order = draft.orders[parent] || [...baseline.parents.get(parent).ids];
        move(order, id, direction); draft.orders[parent] = order;
      }));
      $('block-' + name).addEventListener('click', () => {
        mutate(() => move(draft.blocks, selected('block'), direction)); refresh();
      });
      $('nav-' + name).addEventListener('click', () => {
        const id = selected('nav-item');
        mutate(() => move(navDraft.navigation[selected('nav-group')], id, direction)); refreshNav(id);
      });
    }
    $('node-delete').addEventListener('click', () => {
      mutate(() => {
        const id = selected('node'); if (!baseline.nodes.get(id)?.deletable) return;
        draft.patches[id] = { ...draft.patches[id], deleted: !draft.patches[id]?.deleted };
      }); nodeSelection();
    });
    $('block').addEventListener('change', blockSelection);
    $('parent').addEventListener('change', () => beforeSelection());
    $('block-apply').addEventListener('click', () => {
      let id = selected('block');
      mutate(() => {
        if (!id) id = `block-${global.crypto.randomUUID()}`;
        const block = { ...draft.blocks.find(item => item.id === id), id, parent: selected('parent'), before: selected('before') };
        if (block.body !== $('block-body').value) delete block.rich;
        for (const field of ['title', 'body', 'url', 'label']) block[field] = $('block-' + field).value;
        const index = draft.blocks.findIndex(item => item.id === id);
        if (index < 0) draft.blocks.push(block); else draft.blocks[index] = block;
      });
      refresh(); $('block').value = id; blockSelection();
    });
    $('block-delete').addEventListener('click', () => { mutate(() => {
      draft.blocks = draft.blocks.filter(item => item.id !== selected('block'));
    }); refresh(); });
    $('nav-group').addEventListener('change', () => refreshNav(''));
    $('nav-item').addEventListener('change', navSelection);
    $('nav-apply').addEventListener('click', () => {
      let id = selected('nav-item');
      mutate(() => {
        if (!id) id = `nav-${global.crypto.randomUUID()}`;
        const list = navDraft.navigation[selected('nav-group')];
        const item = { id, label: $('nav-label').value, url: $('nav-url').value };
        const index = list.findIndex(entry => entry.id === id);
        if (index < 0) list.push(item); else list[index] = item;
      }); refreshNav(id);
    });
    $('nav-delete').addEventListener('click', () => {
      mutate(() => {
        navDraft.navigation[selected('nav-group')] = navDraft.navigation[selected('nav-group')].filter(item => item.id !== selected('nav-item'));
      }); refreshNav('');
    });
    global.addEventListener('beforeunload', event => {
      if (admin && dirty) { event.preventDefault(); event.returnValue = ''; }
    });
  }
  document.addEventListener('DOMContentLoaded', async () => {
    panel = document.getElementById('site-editor'); trigger = $('button'); client = global.questionnaireSupabase;
    if (!panel || !trigger || !client) return;
    inline = global.SiteEditorInline?.create({
      baseline, getDraft: () => draft, mutate,
      active: () => Boolean(admin && visual && !busy && draft), notify: message, uploadMedia
    });
    wire();
    const startGeneration = generation;
    client.auth.onAuthStateChange((event, session) => scheduleSession(session, event));
    loadPublished();
    try {
      const { data, error } = await client.auth.getSession();
      if (!error && startGeneration === generation) scheduleSession(data?.session);
    } catch { revoke(); }
  });
})(globalThis);
