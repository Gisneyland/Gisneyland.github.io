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
  let navGroup = 'main', navId = null, navOpen = false, publicationRequest = 0;
  let moreWasHidden = null;
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
  function updateNavigationToggle() {
    const toggle = $('nav-toggle');
    if (!toggle) return;
    const collapsed = visual && panel?.hidden;
    toggle.textContent = collapsed ? '編輯 ＋' : '導覽 ＋';
    toggle.setAttribute('aria-label', collapsed ? '展開編輯面板' : '編輯全站導覽');
    toggle.setAttribute('aria-controls', collapsed ? 'site-editor' : 'site-editor-nav');
    toggle.setAttribute('aria-expanded', String(collapsed ? false : navOpen));
  }
  function editing(value) {
    visual = value;
    document.body.classList.toggle('site-editor-editing', value);
    if ($('mode-actions')) $('mode-actions').hidden = !value;
    if (panel) panel.hidden = !value;
    if ($('nav-toggle')) $('nav-toggle').hidden = !value;
    if (!value) hideNavigation();
    trigger?.setAttribute('aria-pressed', String(value));
    trigger?.setAttribute('aria-expanded', String(value));
    if (!value) inline?.stop();
    historyControls();
    updateNavigationToggle();
  }
  function authorized(token) { return admin && token === generation; }
  function errorMessage(error) {
    return `編輯服務無法使用：${error?.message || '連線失敗'}。請確認已依序執行 supabase/migrations/202610200001_site_editor.sql、202610200002_site_editor_rich.sql、202610200003_site_editor_media.sql、202610200004_site_editor_components.sql，且管理員已核准並完成個資同意。原網站不受影響。`;
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
      $('nav').querySelectorAll('input').forEach(node => { node.value = ''; });
      navId = null; $('nav-form').hidden = true; $('nav-hint').textContent = '';
      message('');
    }
    showPublished();
  }
  async function read(table, key) {
    const { data, error } = await client.from(table).select('document,revision').eq('page_key', key).maybeSingle();
    if (error) throw error;
    return { document: data ? M.normalize(data.document) : null, revision: data?.revision || 0 };
  }
  async function loadPublished() {
    const request = ++publicationRequest;
    try {
      const [content, nav] = await Promise.all([
        enabled ? read('site_editor_publications', page) : Promise.resolve({ document: null }),
        read('site_editor_publications', '@navigation')
      ]);
      if (request !== publicationRequest) return;
      published = content.document || M.empty(); publishedNav = nav.document || M.empty();
      if (!preview && !visual) showPublished();
    } catch (error) {
      // Missing migrations and network failures never blank or disable the static site.
      if (request === publicationRequest && admin) message(errorMessage(error));
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
    if ($('mode-save')) $('mode-save').disabled = value || !draft;
    $('nav').querySelectorAll('button,input').forEach(node => { node.disabled = value || !draft; });
    $('nav-toggle').disabled = value || !draft;
    if (value) inline?.stop();
    else if (visual) inline?.start();
    historyControls();
    if (!value && draft) refreshNavigation();
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
  function navRoot(group = navGroup) {
    return document.querySelector(group === 'main' ? '.site-navigation .bottom-nav' : '#navigation-more-menu');
  }
  function positionNavigation() {
    const root = navRoot(navOpen && navGroup === 'more' ? 'more' : 'main');
    if (!root || !$('nav')) return;
    const bottom = Math.max(8, Math.min(global.innerHeight - 180, global.innerHeight - root.getBoundingClientRect().top + 8));
    $('nav').style.bottom = `${bottom}px`; $('nav-toggle').style.bottom = `${bottom}px`;
    $('nav').style.maxHeight = `${Math.min(global.innerHeight * .55, global.innerHeight - bottom - 8)}px`;
  }
  function hideNavigation() {
    navOpen = false;
    if ($('nav')) $('nav').hidden = true;
    $('nav-toggle')?.setAttribute('aria-expanded', 'false');
    document.querySelectorAll('.site-editor-nav-selected').forEach(node => node.classList.remove('site-editor-nav-selected'));
    const more = navRoot('more');
    if (more && moreWasHidden !== null) {
      more.hidden = moreWasHidden;
      document.getElementById('navigation-more-button')?.setAttribute('aria-expanded', String(!more.hidden));
    }
    moreWasHidden = null;
    updateNavigationToggle();
  }
  function refreshNavigation() {
    if (!navDraft?.navigation) return;
    const list = navDraft.navigation[navGroup], index = list.findIndex(item => item.id === navId);
    $('nav-main').setAttribute('aria-pressed', String(navGroup === 'main'));
    $('nav-more').setAttribute('aria-pressed', String(navGroup === 'more'));
    $('nav-form').hidden = navId === null;
    $('nav-hint').textContent = navId === '' ? '新增全站導覽項目' : index < 0
      ? '點選導覽連結修改，或新增項目。' : `編輯：${list[index].label}`;
    $('nav-up').disabled = busy || index <= 0;
    $('nav-down').disabled = busy || index < 0 || index === list.length - 1;
    $('nav-delete').disabled = busy || index < 0;
    document.querySelectorAll('.site-editor-nav-selected').forEach(node => node.classList.remove('site-editor-nav-selected'));
    const anchors = Array.from(navRoot()?.querySelectorAll(':scope > a') || []).filter(node => !node.hidden);
    if (index >= 0 && navOpen) anchors[index]?.classList.add('site-editor-nav-selected');
    positionNavigation();
  }
  function selectNavigation(group, id = null) {
    if (!admin || !visual || busy || !navDraft) return;
    if (inline?.flush() === false) return;
    navGroup = group; navId = id; navOpen = true;
    const more = navRoot('more');
    if (more) {
      if (moreWasHidden === null) moreWasHidden = more.hidden;
      more.hidden = group !== 'more';
      document.getElementById('navigation-more-button')?.setAttribute('aria-expanded', String(!more.hidden));
    }
    const item = navDraft.navigation[group].find(entry => entry.id === id);
    navigationFields(item);
    $('nav').hidden = false; $('nav-toggle').setAttribute('aria-expanded', 'true');
    refreshNavigation();
    if (id !== null) $('nav-label').focus();
  }
  function navigationFields(item) {
    const original = baseline.baselineNavigation[navGroup].find(entry => entry.id === item?.id);
    for (const field of ['label', 'url', 'icon', 'src', 'alt']) {
      $('nav-' + field).value = item?.[field] ?? (item ? original?.[field] : '') ?? '';
    }
  }
  function refresh() {
    if (navId !== null) {
      const item = navDraft?.navigation[navGroup].find(entry => entry.id === navId);
      if (navId && !item) navId = null;
      navigationFields(item);
    }
    refreshNavigation();
  }
  function changed() {
    draft = M.normalize(draft); navDraft = M.normalize(navDraft); dirty = true;
    if (preview || visual) applyOverlay(draft, navDraft);
    refreshNavigation();
    message('草稿已修改，尚未儲存／發布。');
  }
  function mutate(action, resetting = false) {
    if (!admin || (busy && !resetting) || !draft) return false;
    const before = copy(draft), navBefore = copy(navDraft);
    try {
      action();
      draft = M.normalize(draft); navDraft = M.normalize(navDraft);
      if (JSON.stringify([before, navBefore]) === JSON.stringify([draft, navDraft])) return true;
      if (!restoring) {
        undo.push([before, navBefore]); if (undo.length > 100) undo.shift();
        redo.length = 0;
      }
      changed(); historyControls(); return true;
    }
    catch (error) { draft = before; navDraft = navBefore; message(error.message); return false; }
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
  function collapsePanel() {
    if (inline?.flush() === false) return;
    hideNavigation();
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    updateNavigationToggle();
    $('nav-toggle').focus();
  }
  function move(array, id, direction) {
    const index = array.findIndex(item => (typeof item === 'string' ? item : item.id) === id);
    const next = index + direction;
    if (index >= 0 && next >= 0 && next < array.length) [array[index], array[next]] = [array[next], array[index]];
  }
  function wire() {
    const navigation = document.querySelector('.site-navigation');
    if (navigation) navigation.append($('nav'), $('nav-toggle'));
    trigger.addEventListener('click', () => { if (visual) close(); else open(); });
    $('close').addEventListener('click', collapsePanel);
    $('reopen').addEventListener('click', open);
    $('preview-leave').addEventListener('click', () => {
      showPublished(); message('已離開預覽；可重新開啟草稿。'); trigger.focus();
    });
    $('mode-save')?.addEventListener('click', () => run(save));
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
    $('preview').addEventListener('click', () => run(async token => {
      if (!await save(token) || !authorized(token) || panel.hidden) return;
      editing(false);
      preview = true; applyOverlay(draft, navDraft); document.body.classList.add('site-editor-preview');
      panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
      $('preview-toolbar').hidden = false; $('reopen').focus();
      message('管理員草稿預覽中；訪客仍看到已發布版本。');
    }));
    $('publish').addEventListener('click', () => run(async token => {
      if (!draft) throw new Error('請先載入草稿');
      if (dirty) { message('請先儲存草稿，再發布。'); return; }
      if (!global.confirm('發布目前頁面與全站導覽？所有訪客將可看到內容。')) return;
      const { error } = await client.rpc('publish_site_editor', { target_page: page,
        expected_page_revision: pageRevision, expected_navigation_revision: navRevision });
      if (error) throw error;
      if (!authorized(token)) return;
      publicationRequest += 1;
      published = copy(draft); publishedNav = copy(navDraft); showPublished(); message('已發布目前頁面與全站導覽。');
    }));
    $('reset').addEventListener('click', () => run(async token => {
      if (!draft || !global.confirm('將目前頁面與全站導覽的私人草稿還原為「目前已發布版本」？可復原；只有儲存並發布後才會影響訪客。')) return;
      const request = ++publicationRequest;
      message('重新讀取目前已發布版本與草稿版本…');
      const userId = activeUserId;
      const [content, nav, currentPage, currentNav, profile] = await Promise.all([
        read('site_editor_publications', page), read('site_editor_publications', '@navigation'),
        read('site_editor_drafts', page), read('site_editor_drafts', '@navigation'),
        client.from('admin_profiles').select('account_role,approval_status,privacy_consent_at').eq('user_id', userId).maybeSingle()
      ]);
      if (!authorized(token) || request !== publicationRequest || activeUserId !== userId) return;
      if (profile.error) throw profile.error;
      if (!M.administrator(profile.data)) { revoke(); return; }
      if (currentPage.revision !== pageRevision || currentNav.revision !== navRevision) {
        throw new Error('草稿版本衝突，未還原。請重新整理並檢查其他管理員的最新草稿');
      }
      published = content.document || M.empty(); publishedNav = nav.document || M.empty();
      mutate(() => {
        draft = copy(published); navDraft = copy(publishedNav);
        if (!navDraft.navigation) navDraft.navigation = copy(baseline.baselineNavigation);
      }, true);
      navId = null; refresh();
      message('已還原目前已發布的頁面與全站導覽至私人草稿；可復原，尚未儲存／發布。');
    }));
    $('nav-toggle').addEventListener('click', () => {
      if (panel.hidden) {
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        updateNavigationToggle();
        $('page').focus();
      } else if (navOpen) hideNavigation(); else selectNavigation(navGroup);
    });
    $('nav-close').addEventListener('click', hideNavigation);
    for (const group of ['main', 'more']) $('nav-' + group).addEventListener('click', () => selectNavigation(group));
    $('nav-add').addEventListener('click', () => selectNavigation(navGroup, ''));
    navigation?.addEventListener('click', event => {
      if (!admin || !visual) return;
      const anchor = event.target.closest('a');
      if (!anchor) return;
      const group = anchor.parentElement === navRoot('main') ? 'main'
        : anchor.parentElement === navRoot('more') ? 'more' : null;
      if (!group) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (busy) return;
      const anchors = Array.from(navRoot(group).querySelectorAll(':scope > a')).filter(node => !node.hidden);
      const item = navDraft?.navigation[group][anchors.indexOf(anchor)];
      if (item) selectNavigation(group, item.id);
    }, true);
    $('nav-form').addEventListener('submit', event => {
      event.preventDefault();
      if (inline?.flush() === false || navId === null) return;
      let id = navId;
      if (mutate(() => {
        if (!id) id = `nav-${global.crypto.randomUUID()}`;
        const list = navDraft.navigation[navGroup], index = list.findIndex(entry => entry.id === id);
        const item = { ...list[index], id, label: $('nav-label').value, url: $('nav-url').value };
        for (const field of ['icon', 'src', 'alt']) {
          const value = field === 'alt' ? $('nav-' + field).value : $('nav-' + field).value.trim();
          if (index >= 0 || value) item[field] = value;
        }
        if (index < 0) list.push(item); else list[index] = item;
      })) { navId = id; refreshNavigation(); }
    });
    for (const [name, direction] of [['up', -1], ['down', 1]]) {
      $('nav-' + name).addEventListener('click', () => {
        if (inline?.flush() === false) return;
        mutate(() => move(navDraft.navigation[navGroup], navId, direction));
      });
    }
    $('nav-delete').addEventListener('click', () => {
      if (inline?.flush() === false) return;
      if (!global.confirm('從全站導覽草稿刪除此項目？可復原；不會刪除實體頁面。')) return;
      if (mutate(() => {
        navDraft.navigation[navGroup] = navDraft.navigation[navGroup].filter(item => item.id !== navId);
      })) { navId = null; navigationFields(); refreshNavigation(); }
    });
    $('nav').addEventListener('keydown', event => {
      if (event.key === 'Escape') { hideNavigation(); $('nav-toggle').focus(); }
    });
    global.addEventListener('resize', positionNavigation);
    global.addEventListener('scroll', positionNavigation, { passive: true });
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
