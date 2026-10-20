(function (global) {
  'use strict';
  const SOURCE_TYPES = new Set(['table', 'code', 'math', 'music', 'mermaid', 'markdown']);
  const MEDIA_TYPES = new Set(['image', 'audio', 'video']);
  const STYLES = ['p', 'h1', 'h2', 'h3', 'blockquote', 'ul', 'ol'];
  const TYPES = [
    ['paragraph', 'notes', '文字'], ['card', 'view_agenda', '卡片'],
    ['image', 'image', '圖片'], ['audio', 'audiotrack', '音訊'], ['video', 'videocam', '影片'],
    ['table', 'table_chart', '表格'], ['code', 'code', '程式碼'], ['math', 'functions', '數學'],
    ['music', 'music_note', '樂譜'], ['mermaid', 'account_tree', '流程圖'], ['markdown', 'description', 'Markdown']
  ];
  function create({ baseline, getDraft, mutate, active, notify = () => {}, uploadMedia }) {
    const doc = global.document;
    const root = baseline.nodes.get(baseline.root)?.element || baseline.root?.element || baseline.root;
    let running = false, flushing = false, composing = false, selected = null, range = null;
    let ui, toolbar, tools, menu, dialog, hold, drag, sourceDraft, suppressClick = false;
    const records = new Map(), cleanups = [], listeners = [];
    const enabled = () => running && active();
    const rich = () => global.SiteEditorRich;
    function listen(element, name, handler, options) {
      element.addEventListener(name, handler, options);
      listeners.push(() => element.removeEventListener(name, handler, options));
    }
    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function button(parent, icon, label, action) {
      const node = element('button');
      node.type = 'button'; node.title = label; node.setAttribute('aria-label', label);
      const glyph = element('span', 'material-icons', icon); glyph.setAttribute('aria-hidden', 'true');
      node.append(glyph); node.addEventListener('click', () => { if (enabled()) action(); });
      parent.append(node); return node;
    }
    function position(node, rect, below = false) {
      if (!node || !rect) return;
      const width = Math.min(node.offsetWidth || 320, Math.max(0, global.innerWidth - 16));
      node.style.maxWidth = 'calc(100vw - 16px)';
      node.style.left = `${Math.max(8, Math.min(rect.left, global.innerWidth - width - 8))}px`;
      node.style.top = `${Math.max(8, Math.min(below ? rect.bottom + 8 : rect.top - (node.offsetHeight || 44) - 8,
        global.innerHeight - (node.offsetHeight || 44) - 8))}px`;
    }
    function floating(node) {
      node.style.position = 'fixed'; node.style.zIndex = '10020'; node.hidden = true;
      return node;
    }
    function isVisible(node) {
      return node?.isConnected && !node.closest('[hidden],[data-site-editor-deleted]');
    }
    function component(target) {
      if (!target || !root?.contains(target)) return null;
      const added = target.closest('[data-site-editor-block]');
      if (added && root.contains(added)) {
        const block = getDraft().blocks.find(item => item.id === added.dataset.siteEditorBlock);
        if (block) return { id: block.id, element: added, parent: block.parent, added: true, movable: true, deletable: true };
      }
      let current = target.nodeType === 1 ? target : target.parentElement;
      while (current && root.contains(current)) {
        for (const [id, item] of baseline.nodes) {
          if (item.element === current && /^(MAIN|SECTION|DIV|ARTICLE|P|H[1-6]|BLOCKQUOTE|UL|OL|LI|FIGURE|IMG|AUDIO|VIDEO|PRE|TABLE)$/.test(current.tagName)) {
            return { ...item, id, added: false };
          }
        }
        current = current.parentElement;
      }
      return null;
    }
    function selectedNow() {
      if (!selected) return null;
      if (!selected.added) {
        const item = baseline.nodes.get(selected.id);
        return item && isVisible(item.element) ? { ...item, id: selected.id, added: false } : null;
      }
      const node = Array.from(root.querySelectorAll('[data-site-editor-block]'))
        .find(item => item.dataset.siteEditorBlock === selected.id);
      return node ? component(node) : null;
    }
    function select(item) {
      selected?.element.classList.remove('site-editor-selected');
      selected = item;
      if (!item) { if (tools) tools.hidden = true; return; }
      item.element.classList.add('site-editor-selected');
      tools.hidden = false; position(tools, item.element.getBoundingClientRect(), true);
      for (const node of tools.querySelectorAll('[data-move]')) node.disabled = !item.movable || !item.parent;
      tools.querySelector('[data-delete]').disabled = !item.deletable || !item.parent;
      const block = item.added && getDraft().blocks.find(value => value.id === item.id);
      tools.querySelector('[data-source]').hidden = !block || !SOURCE_TYPES.has(block.type);
      tools.querySelector('[data-media]').hidden = !block || !MEDIA_TYPES.has(block.type);
    }
    function recordFor(node) {
      if (!node) return null;
      const target = node.nodeType === 1 ? node : node.parentElement;
      return Array.from(records.values()).find(record => record.element === target || record.element.contains(target)) || null;
    }
    function snapshot(record) {
      const text = record.element.innerText === undefined ? record.element.textContent : record.element.innerText;
      const value = { text: text.replace(/\r\n?/g, '\n') };
      if (record.field !== 'title' && rich()?.readRuns) {
        value.rich = rich().readRuns(record.element);
        value.text = value.rich.map(run => run.text).join('');
      }
      if (record.style) value.style = record.style;
      return value;
    }
    function flush() {
      if (flushing) return true;
      if (composing) { notify('請先完成輸入法選字，再儲存。'); return false; }
      const changes = [];
      for (const record of records.values()) {
        if (!record.dirty) continue;
        let value;
        try { value = snapshot(record); }
        catch (error) { notify(error.message || '文字格式無法儲存。'); return false; }
        if (value.text.length > (record.field === 'title' ? 300 : 12000)) {
          notify('文字過長，請縮短後再儲存。'); return false;
        }
        changes.push({ record, value });
      }
      const source = sourceDraft?.dirty ? { ...sourceDraft } : null;
      if (source?.body.length > 12000) { notify('內容過長。'); return false; }
      if (!changes.length && !source) return true;
      if (!active()) return false;
      flushing = true;
      try {
        for (const { record } of changes) record.dirty = false;
        if (source) sourceDraft.dirty = false;
        mutate(() => {
          const draft = getDraft();
          if (source) {
            const block = draft.blocks.find(item => item.id === source.id);
            if (block) {
              block.body = source.body;
              if (block.type === 'code') block.language = source.language;
            }
          }
          for (const { record, value } of changes) {
            if (record.block) {
              const block = draft.blocks.find(item => item.id === record.block);
              if (!block) continue;
              block[record.field] = value.text;
              if (record.field === 'body') {
                if (value.rich) block.rich = value.rich;
                if (value.style) block.style = value.style;
              }
            } else {
              draft.patches[record.id] = { ...draft.patches[record.id], ...value };
            }
          }
        });
      } finally { flushing = false; }
      return true;
    }
    function commit(action) {
      if (!enabled() || !flush()) return false;
      mutate(() => action(getDraft()));
      return true;
    }
    function editable(node, key, details, ownedNode) {
      if (records.has(key) || node.closest('[hidden],[data-site-editor-deleted]')) return;
      const attrs = ['contenteditable', 'role', 'aria-label', 'aria-multiline', 'tabindex', 'spellcheck'];
      const previous = attrs.map(name => [name, node.getAttribute(name)]);
      const hadClass = node.classList.contains('site-editor-editable');
      node.classList.add('site-editor-editable');
      node.setAttribute('contenteditable', 'true'); node.setAttribute('role', 'textbox');
      node.setAttribute('aria-label', details.field === 'title' ? '編輯標題' : '編輯文字');
      node.setAttribute('aria-multiline', 'true'); node.setAttribute('tabindex', '0');
      node.setAttribute('spellcheck', 'true');
      records.set(key, { ...details, id: key, element: node, dirty: false });
      cleanups.push(() => {
        if (ownedNode) {
          if (node.parentNode) { ownedNode.nodeValue = node.textContent; node.replaceWith(ownedNode); }
        } else {
          for (const [name, value] of previous) {
            if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
          }
          if (!hadClass) node.classList.remove('site-editor-editable');
        }
      });
    }
    function wrap() {
      const rendered = new Map(Array.from(root.querySelectorAll('[data-site-editor-text]'))
        .map(node => [node.dataset.siteEditorText, node]));
      for (const [id, text] of baseline.texts) {
        if (rendered.has(id)) {
          editable(rendered.get(id), id, { style: getDraft().patches[id]?.style });
        } else if (text.node.parentNode === text.element && root.contains(text.element)
          && !text.element.closest('[contenteditable],.material-icons,[aria-hidden="true"]')
          && !text.element.closest('script,style,form,button,input,textarea,select,[data-site-editor-protected]')) {
          const wrapper = element('span'); wrapper.dataset.siteEditorText = id;
          text.node.replaceWith(wrapper); wrapper.append(text.node);
          editable(wrapper, id, { style: getDraft().patches[id]?.style }, text.node);
        }
      }
      for (const node of root.querySelectorAll('[data-site-editor-block]')) {
        const block = getDraft().blocks.find(item => item.id === node.dataset.siteEditorBlock);
        if (!block) continue;
        for (const field of node.querySelectorAll('[data-site-editor-field]')) {
          const name = field.dataset.siteEditorField;
          if (!['body', 'title'].includes(name) || (name === 'body' && SOURCE_TYPES.has(block.type))) continue;
          editable(field, `${block.id}:${name}`, { block: block.id, field: name, style: block.style });
        }
        const oldTab = node.getAttribute('tabindex'); node.setAttribute('tabindex', '0');
        cleanups.push(() => { if (oldTab === null) node.removeAttribute('tabindex'); else node.setAttribute('tabindex', oldTab); });
      }
      for (const item of baseline.nodes.values()) {
        if (!/^(IMG|VIDEO|AUDIO|TABLE|PRE)$/.test(item.element.tagName)) continue;
        const node = item.element, oldTab = node.getAttribute('tabindex'); node.setAttribute('tabindex', '0');
        cleanups.push(() => { if (oldTab === null) node.removeAttribute('tabindex'); else node.setAttribute('tabindex', oldTab); });
      }
    }
    function siblingIds(parentId) {
      const parent = baseline.parents.get(parentId);
      if (!parent) return [];
      const ids = [];
      for (const child of parent.element.children) {
        const blockId = child.dataset.siteEditorBlock;
        if (blockId && getDraft().blocks.some(block => block.id === blockId && block.parent === parentId)) ids.push(blockId);
        else for (const id of parent.ids) {
          if (baseline.nodes.get(id)?.element === child) { ids.push(id); break; }
        }
      }
      return ids;
    }
    function orderDraft(draft, parentId, ids) {
      draft.orders[parentId] = ids;
      // Keep explicit anchors as well, so added blocks remain placed with older renderers.
      for (let index = 0; index < ids.length; index += 1) {
        const block = draft.blocks.find(item => item.id === ids[index]);
        if (block) block.before = ids[index + 1] || '';
      }
    }
    function move(direction, targetId) {
      const item = selectedNow();
      if (!item?.movable || !item.parent) return;
      const ids = siblingIds(item.parent), from = ids.indexOf(item.id);
      const to = targetId ? ids.indexOf(targetId) : from + direction;
      if (from < 0 || to < 0 || to >= ids.length || from === to) return;
      ids.splice(from, 1); ids.splice(to, 0, item.id);
      commit(draft => orderDraft(draft, item.parent, ids));
      reselect(item.id, true); notify('已調整同一容器內的順序。');
    }
    function reselect(id, focus = false) {
      let node = baseline.nodes.get(id)?.element;
      if (!node) node = Array.from(root.querySelectorAll('[data-site-editor-block]')).find(value => value.dataset.siteEditorBlock === id);
      if (node) {
        select(component(node));
        if (focus) (node.querySelector('[contenteditable="true"]') || node).focus({ preventScroll: true });
      }
    }
    function removeSelected(confirmMedia = false) {
      const item = selectedNow();
      if (!item?.deletable || !item.parent || composing) return;
      if (confirmMedia && !global.confirm('刪除此媒體？此動作只修改草稿，不會刪除儲存空間檔案。')) return;
      const ids = siblingIds(item.parent).filter(id => id !== item.id);
      if (!commit(draft => {
        if (item.added) draft.blocks = draft.blocks.filter(block => block.id !== item.id);
        else draft.patches[item.id] = { ...draft.patches[item.id], deleted: true };
        orderDraft(draft, item.parent, ids);
      })) return;
      select(null); if (ids.length) reselect(ids[0], true);
    }
    function insert(type, url = '') {
      const item = selectedNow();
      let parent = item?.parent || baseline.root;
      if (!/^(MAIN|DIV|SECTION|ARTICLE)$/.test(baseline.parents.get(parent)?.element.tagName || '')) {
        let ancestor = baseline.nodes.get(parent);
        while (ancestor && !/^(MAIN|DIV|SECTION|ARTICLE)$/.test(ancestor.element.tagName)) {
          parent = ancestor.parent; ancestor = baseline.nodes.get(parent);
        }
      }
      if (!baseline.parents.has(parent)) { notify('此位置不能新增區塊。'); return; }
      const id = `block-${global.crypto.randomUUID()}`, ids = siblingIds(parent);
      const index = item && ids.includes(item.id) ? ids.indexOf(item.id) + 1 : ids.length;
      ids.splice(index, 0, id);
      const body = type === 'table' ? '欄位 1\t欄位 2\n內容\t內容' : '';
      const block = { id, parent, before: ids[index + 1] || '', type, title: '', body, url, label: '' };
      if (!commit(draft => { draft.blocks.push(block); orderDraft(draft, parent, ids); })) return;
      menu.hidden = true; reselect(id, true);
      if (SOURCE_TYPES.has(type)) sourceEditor();
    }
    function savedSelection() {
      const selection = global.getSelection();
      if (selection?.rangeCount && recordFor(selection.anchorNode) === recordFor(selection.focusNode)
        && recordFor(selection.anchorNode)) range = selection.getRangeAt(0).cloneRange();
    }
    function restoreSelection() {
      if (!range || !range.commonAncestorContainer.isConnected) return null;
      const record = recordFor(range.commonAncestorContainer);
      if (!record) return null;
      record.element.focus({ preventScroll: true });
      const selection = global.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      return record;
    }
    function format(command, value) {
      const record = restoreSelection();
      if (!record || composing || record.field === 'title') return;
      if (command === 'createLink') {
        const url = global.prompt('連結網址（https、站內路徑、mailto 或 tel）', 'https://');
        if (!url) return;
        value = global.SiteEditorModel.safeURL(url);
        if (!value) { notify('網址不安全或格式錯誤。'); return; }
        restoreSelection();
      }
      doc.execCommand(command, false, value);
      record.dirty = true; savedSelection(); updateSelection();
    }
    function updateSelection() {
      if (!enabled() || composing) return;
      const selection = global.getSelection(), record = recordFor(selection?.anchorNode);
      if (!selection || selection.isCollapsed || !record || record !== recordFor(selection.focusNode)
        || record.field === 'title') { toolbar.hidden = true; return; }
      savedSelection(); toolbar.hidden = false;
      position(toolbar, selection.getRangeAt(0).getBoundingClientRect());
    }
    function closeDialog() {
      dialog?.remove(); dialog = null; sourceDraft = null; composing = false;
      if (selected) reselect(selected.id, true);
    }
    function makeDialog(title) {
      dialog?.remove();
      dialog = floating(element('section', 'site-editor-inline-ui site-editor-insert-menu'));
      dialog.hidden = false; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-label', title);
      dialog.style.maxHeight = '80vh'; dialog.style.overflow = 'auto';
      dialog.append(element('h3', '', title)); ui.append(dialog);
      dialog.addEventListener('compositionstart', () => { composing = true; });
      dialog.addEventListener('compositionend', () => { composing = false; });
      button(dialog, 'close', '關閉', closeDialog);
      position(dialog, selectedNow()?.element.getBoundingClientRect() || { left: 16, top: 70, bottom: 70 }, true);
      return dialog;
    }
    function sourceEditor() {
      if (!flush()) return;
      const item = selectedNow(), block = item?.added && getDraft().blocks.find(value => value.id === item.id);
      if (!block || !SOURCE_TYPES.has(block.type)) return;
      const pane = makeDialog(block.type === 'table' ? '編輯表格（Tab 分欄、換行分列）' : '編輯原始碼');
      const label = element('label', '', '原始內容');
      const input = element('textarea'); input.value = block.body; input.maxLength = 12000;
      input.setAttribute('aria-label', '原始內容'); input.rows = 9; label.append(input); pane.append(label);
      const language = element('input'); language.value = block.language || ''; language.maxLength = 40;
      language.setAttribute('aria-label', '程式語言'); language.placeholder = '程式語言';
      if (block.type === 'code') pane.append(language);
      const preview = element('div'); preview.setAttribute('aria-label', '預覽'); pane.append(preview);
      sourceDraft = { id: block.id, body: block.body, language: block.language || '', dirty: false };
      function renderPreview() {
        if (sourceDraft) {
          sourceDraft.body = input.value; sourceDraft.language = language.value;
          sourceDraft.dirty = input.value !== block.body || language.value !== (block.language || '');
        }
        preview.replaceChildren();
        if (rich()?.render) {
          try { preview.append(rich().render({ ...block, body: input.value, language: language.value })); }
          catch { preview.textContent = input.value; }
        } else preview.textContent = input.value;
      }
      input.addEventListener('input', renderPreview); language.addEventListener('input', renderPreview);
      input.addEventListener('keydown', event => {
        if (['Backspace', 'Delete'].includes(event.key) && !event.isComposing && !composing
          && !input.value && !block.title) {
          event.preventDefault(); removeSelected(); closeDialog(); return;
        }
        if (event.key !== 'Tab' || block.type !== 'table') return;
        event.preventDefault(); input.setRangeText('\t', input.selectionStart, input.selectionEnd, 'end'); renderPreview();
      });
      button(pane, 'check', '套用原始內容', () => {
        if (!flush()) return;
        closeDialog(); reselect(block.id, true);
      });
      renderPreview(); input.focus();
    }
    function mediaEditor(type) {
      if (!flush()) return;
      const item = selectedNow();
      const existing = !type && item?.added && getDraft().blocks.find(value => value.id === item.id);
      const kind = type || existing?.type;
      if (!MEDIA_TYPES.has(kind)) return;
      const pane = makeDialog('媒體網址／媒體庫');
      const label = element('label', '', '公開媒體網址');
      const input = element('input'); input.type = 'url'; input.value = existing?.url || '';
      input.setAttribute('aria-label', '公開媒體網址'); label.append(input); pane.append(label);
      const library = element('select'); library.hidden = true; library.setAttribute('aria-label', '現有公開媒體網址');
      library.append(new global.Option('選擇網站現有媒體', ''));
      const urls = new Set();
      for (const node of doc.querySelectorAll('img[src],audio[src],video[src],source[src]')) {
        if (global.SiteEditorModel.safeURL(node.getAttribute('src'))) urls.add(node.getAttribute('src'));
      }
      for (const block of getDraft().blocks) if (MEDIA_TYPES.has(block.type) && block.url) urls.add(block.url);
      for (const url of urls) library.append(new global.Option(url, url));
      library.addEventListener('change', () => { if (library.value) input.value = library.value; });
      pane.append(library);
      button(pane, 'photo_library', '開啟媒體庫網址', () => { library.hidden = false; library.focus(); });
      const file = element('input'); file.type = 'file'; file.hidden = true;
      file.accept = kind === 'image' ? 'image/png,image/jpeg,image/webp,image/gif'
        : kind === 'audio' ? 'audio/mpeg,audio/ogg,audio/wav' : 'video/mp4,video/webm';
      file.setAttribute('aria-label', '選擇本機媒體'); pane.append(file);
      const upload = button(pane, 'upload_file', uploadMedia ? '上傳本機媒體（上傳後即公開）'
        : '本機上傳未開放，請使用公開網址', () => file.click());
      upload.disabled = typeof uploadMedia !== 'function';
      file.addEventListener('change', async () => {
        const asset = file.files?.[0]; if (!asset || !enabled() || !uploadMedia) return;
        const allowed = file.accept.split(',');
        if (!allowed.includes(asset.type) || !asset.size || asset.size > 10485760) {
          notify('請選擇格式相符且 10 MB 以內的媒體。'); return;
        }
        upload.disabled = true;
        try {
          const url = await uploadMedia(asset);
          if (!enabled() || dialog !== pane || !url) return;
          if (!global.SiteEditorModel.safeURL(url) || !/^https?:\/\//i.test(url)) throw new Error('媒體網址不安全。');
          input.value = url; notify('媒體已公開上傳；請套用網址至草稿。');
        } catch (error) { if (enabled()) notify(error.message || '上傳失敗，請改用公開網址。'); }
        finally { if (upload.isConnected) upload.disabled = false; file.value = ''; }
      });
      pane.append(element('p', '', uploadMedia
        ? '檔案上傳後即公開，請勿使用私人或健康資料。10 MB 以內；公開網址亦可直接貼上。'
        : '未開放網站媒體上傳；問卷照片屬私人資料。請貼上已授權的公開媒體網址。'));
      button(pane, 'check', '套用媒體網址', () => {
        const url = global.SiteEditorModel.safeURL(input.value.trim());
        if (!url || !/^(https?:\/\/|\/(?!\/))/i.test(url)) { notify('媒體須使用 https、http 或站內公開網址。'); return; }
        if (existing) commit(draft => {
          const target = draft.blocks.find(value => value.id === existing.id); if (target) target.url = url;
        });
        else insert(kind, url);
        closeDialog();
      });
      input.focus();
    }
    function buildUI() {
      ui = element('div', 'site-editor-inline-ui');
      toolbar = floating(element('div', 'site-editor-inline-ui site-editor-format-toolbar'));
      toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', '選取文字格式');
      for (const [command, icon, label, value] of [
        ['bold', 'format_bold', '粗體'], ['italic', 'format_italic', '斜體'],
        ['underline', 'format_underlined', '底線'], ['hiliteColor', 'format_color_fill', '螢光標記', '#fff59d'],
        ['subscript', 'subscript', '下標'], ['superscript', 'superscript', '上標'],
        ['createLink', 'link', '加入連結'], ['unlink', 'link_off', '移除連結'],
        ['removeFormat', 'format_clear', '清除格式']
      ]) button(toolbar, icon, label, () => format(command, value));
      const color = element('input'); color.type = 'color'; color.value = '#1f2937';
      color.title = '文字顏色'; color.setAttribute('aria-label', '文字顏色');
      color.addEventListener('input', () => format('foreColor', color.value)); toolbar.append(color);
      const style = element('select'); style.setAttribute('aria-label', '段落樣式');
      const labels = ['內文', '標題 1', '標題 2', '標題 3', '引文', '項目清單', '編號清單'];
      STYLES.forEach((value, index) => style.append(new global.Option(labels[index], value)));
      style.addEventListener('change', () => {
        const record = restoreSelection(); if (!record || composing) return;
        record.style = style.value; record.dirty = true; notify('段落樣式將於離開文字時套用。');
      });
      toolbar.append(style);
      toolbar.addEventListener('pointerdown', event => { if (event.target.closest('button')) event.preventDefault(); });
      tools = floating(element('div', 'site-editor-inline-ui site-editor-component-tools'));
      tools.setAttribute('role', 'toolbar'); tools.setAttribute('aria-label', '選取元件工具');
      const add = button(tools, 'add', '在此元件後新增區塊', () => {
        menu.hidden = !menu.hidden; add.setAttribute('aria-expanded', String(!menu.hidden));
        if (!menu.hidden) { position(menu, tools.getBoundingClientRect(), true); menu.querySelector('button').focus(); }
      });
      add.setAttribute('aria-haspopup', 'menu'); add.setAttribute('aria-expanded', 'false');
      button(tools, 'arrow_upward', '向前移動（Alt + ↑）', () => move(-1)).dataset.move = 'up';
      button(tools, 'arrow_downward', '向後移動（Alt + ↓）', () => move(1)).dataset.move = 'down';
      button(tools, 'edit_note', '編輯原始內容／表格', sourceEditor).dataset.source = '';
      button(tools, 'photo_library', '更換媒體網址', () => mediaEditor()).dataset.media = '';
      button(tools, 'delete_outline', '刪除元件', () => {
        if (global.confirm('刪除此元件？尚未儲存或發布。')) removeSelected();
      }).dataset.delete = '';
      menu = floating(element('div', 'site-editor-inline-ui site-editor-insert-menu'));
      menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '新增區塊');
      for (const [type, icon, label] of TYPES) {
        const node = button(menu, icon, label, () => {
          menu.hidden = true;
          if (MEDIA_TYPES.has(type)) mediaEditor(type); else insert(type);
        });
        node.setAttribute('role', 'menuitem');
      }
      ui.append(toolbar, tools, menu); doc.body.append(ui);
    }
    function plainInsert(text) {
      if (doc.execCommand('insertText', false, text)) return;
      const selection = global.getSelection();
      if (!selection?.rangeCount) return;
      const current = selection.getRangeAt(0); current.deleteContents();
      const node = doc.createTextNode(text); current.insertNode(node);
      current.setStartAfter(node); current.collapse(true); selection.removeAllRanges(); selection.addRange(current);
    }
    function cancelHold() {
      if (hold) global.clearTimeout(hold.timer);
      hold = null;
    }
    function pointerDown(event) {
      if (!enabled() || event.button !== 0 || event.target.closest('.site-editor-inline-ui')) return;
      const item = component(event.target);
      if (!item) return;
      select(item); cancelHold();
      const start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      const mediaTarget = Boolean(event.target.closest('img,audio,video'));
      hold = { ...start, timer: global.setTimeout(() => {
        hold = null;
        if (!enabled() || composing) return;
        const media = mediaTarget || /^(IMG|AUDIO|VIDEO)$/.test(item.element.tagName)
          || item.element.querySelector('img,audio,video') && !item.element.querySelector('[contenteditable="true"]');
        if (media) { suppressClick = true; removeSelected(true); return; }
        if (!item.movable || !item.parent) return;
        drag = { ...start, item }; item.element.classList.add('site-editor-dragging');
        suppressClick = true; notify('拖曳至同一容器內的元件；也可使用 Alt + ↑／↓。');
      }, 650) };
    }
    function pointerMove(event) {
      if (hold && (Math.abs(event.clientX - hold.x) > 10 || Math.abs(event.clientY - hold.y) > 10)) cancelHold();
      if (!drag) return;
      event.preventDefault();
      drag.target = component(doc.elementFromPoint(event.clientX, event.clientY));
    }
    function endDrag(cancelled) {
      cancelHold();
      if (!drag) return;
      const previous = drag; drag = null;
      previous.item.element.classList.remove('site-editor-dragging');
      if (!cancelled && previous.target?.parent === previous.item.parent && previous.target.id !== previous.item.id) {
        select(previous.item); move(0, previous.target.id);
      }
    }
    function keydown(event) {
      if (!enabled() || event.isComposing || composing || event.keyCode === 229) return;
      if (event.key === 'Escape') {
        cancelHold(); endDrag(true); toolbar.hidden = true; menu.hidden = true;
        if (dialog) closeDialog(); return;
      }
      const ownUI = event.target.closest?.('.site-editor-inline-ui');
      if (ownUI) {
        if (event.target.closest('[role="menu"]') && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = Array.from(menu.querySelectorAll('button')), index = buttons.indexOf(doc.activeElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next].focus();
        }
        return;
      }
      if (!root.contains(event.target)) return;
      select(component(event.target));
      if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); move(event.key === 'ArrowUp' ? -1 : 1); return;
      }
      if (event.altKey && (event.key === '+' || event.key === '=')) {
        event.preventDefault(); menu.hidden = false; position(menu, tools.getBoundingClientRect(), true); menu.querySelector('button').focus(); return;
      }
      if (!['Backspace', 'Delete'].includes(event.key)) return;
      const item = selectedNow();
      if (!item?.deletable || !item.parent) return;
      // Empty text may contain browser-created <br> placeholders, but never erase media or nested widgets.
      const empty = !item.element.textContent.replace(/[\s\u200b]/g, '')
        && !item.element.querySelector('img,audio,video,iframe,canvas,svg,input,button,select,textarea,[data-site-editor-protected]');
      if (empty) { event.preventDefault(); removeSelected(); }
    }
    function start() {
      if (running || !active() || !root?.querySelectorAll) return;
      running = true; wrap(); buildUI();
      listen(root, 'click', event => {
        if (!enabled()) return;
        if (event.target.closest('a')) event.preventDefault();
        if (suppressClick) { event.preventDefault(); suppressClick = false; return; }
        select(component(event.target));
      }, true);
      listen(root, 'focusin', event => { if (enabled()) select(component(event.target)); });
      listen(root, 'input', event => { const record = recordFor(event.target); if (enabled() && record) record.dirty = true; });
      listen(root, 'compositionstart', () => { composing = true; cancelHold(); toolbar.hidden = true; });
      listen(root, 'compositionend', event => {
        composing = false; const record = recordFor(event.target); if (record) record.dirty = true;
      });
      listen(root, 'focusout', event => {
        if (composing || ui?.contains(event.relatedTarget) || recordFor(event.target) === recordFor(event.relatedTarget)) return;
        if (recordFor(event.target)) flush();
      });
      listen(root, 'paste', event => {
        const record = recordFor(event.target); if (!enabled() || !record) return;
        event.preventDefault(); plainInsert((event.clipboardData?.getData('text/plain') || '').slice(0, 12000)); record.dirty = true;
      });
      listen(root, 'drop', event => { if (enabled()) event.preventDefault(); });
      listen(root, 'dragstart', event => { if (enabled()) event.preventDefault(); });
      listen(root, 'beforeinput', event => {
        if (!enabled()) return;
        if (event.inputType === 'insertFromDrop' || event.inputType === 'insertHTML') event.preventDefault();
      });
      listen(doc, 'selectionchange', updateSelection);
      listen(doc, 'keydown', keydown);
      listen(root, 'pointerdown', pointerDown);
      listen(doc, 'pointermove', pointerMove, { passive: false });
      listen(doc, 'pointerup', () => endDrag(false));
      listen(doc, 'pointercancel', () => endDrag(true));
      const reposition = () => {
        cancelHold();
        if (selected) { const item = selectedNow(); if (item) position(tools, item.element.getBoundingClientRect(), true); }
        updateSelection();
      };
      listen(global, 'scroll', reposition, true); listen(global, 'resize', reposition);
    }
    function stop() {
      if (!running) return;
      flush();
      running = false; composing = false; cancelHold(); endDrag(true);
      listeners.splice(0).forEach(remove => remove());
      selected?.element.classList.remove('site-editor-selected'); selected = null;
      cleanups.splice(0).reverse().forEach(cleanup => cleanup());
      records.clear(); ui?.remove(); ui = null; dialog = null; sourceDraft = null; range = null;
    }
    function refresh() {
      if (!running) return;
      // The controller must stop before replacing DOM; do not disrupt a live caret on a plain refresh.
      wrap();
      const item = selectedNow(); if (item) select(item);
    }
    return Object.freeze({ start, stop, refresh, flush });
  }
  global.SiteEditorInline = Object.freeze({ create });
})(globalThis);
