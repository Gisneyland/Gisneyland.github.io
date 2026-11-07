(function (global) {
  const M = global.RichContentModel;
  if (!M) return;

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    });
    node.append(...children.flat().filter(child => child !== null && child !== undefined && child !== false));
    return node;
  };
  const button = (label, onclick, props = {}) => el('button', { type: 'button', onclick, ...props }, label);
  const field = (label, control) => el('label', { class: 'rc-dialog-field' }, el('span', { text: label }), control);
  const select = (options, value) => {
    const node = el('select', {}, Object.entries(options).map(([key, text]) => el('option', { value: key, text })));
    if (value !== undefined) node.value = value;
    return node;
  };

  // 小型對話框：回傳 { dialog, body, close }，按「插入」時呼叫 onSubmit，回傳 false 則保持開啟
  function openDialog(title, body, onSubmit, submitLabel = '插入') {
    const dialog = el('dialog', { class: 'rc-dialog' });
    const message = el('p', { class: 'rc-dialog-message', role: 'alert' });
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.append(
      el('h3', { text: title }), body, message,
      el('div', { class: 'rc-dialog-actions' },
        button('取消', close, { class: 'btn btn-secondary' }),
        button(submitLabel, () => {
          const result = onSubmit();
          if (typeof result === 'string') { message.textContent = result; return; }
          close();
        }, { class: 'btn btn-primary' }))
    );
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    document.body.append(dialog);
    dialog.showModal();
    return { dialog, close, message };
  }

  function gridEditor({ rows, header = true, columnLabel, onChange = () => {} }) {
    const table = el('table', { class: 'rc-grid' });
    const state = rows.map(row => row.slice());
    const render = () => {
      const width = Math.max(1, ...state.map(row => row.length));
      state.forEach(row => { while (row.length < width) row.push(''); });
      table.replaceChildren(...state.map((row, r) => el('tr', {},
        ...row.map((value, c) => el('td', {}, el('input', {
          type: 'text', value, 'aria-label': `${columnLabel?.(c, r) || '欄'} ${r + 1}-${c + 1}`,
          class: header && r === 0 ? 'is-header' : '',
          oninput: event => { state[r][c] = event.target.value; onChange(); }
        }))),
        el('td', { class: 'rc-grid-tools' }, button('刪列', () => { if (state.length > 1) { state.splice(r, 1); render(); onChange(); } }, { class: 'btn btn-secondary btn-small' }))
      )), el('tr', { class: 'rc-grid-tools' }, ...state[0].map((_, c) => el('td', {}, button('刪欄', () => {
        if (state[0].length > 1) { state.forEach(row => row.splice(c, 1)); render(); onChange(); }
      }, { class: 'btn btn-secondary btn-small' })))));
    };
    render();
    const controls = el('div', { class: 'rc-grid-actions' },
      button('新增列', () => { state.push(Array(state[0].length).fill('')); render(); onChange(); }, { class: 'btn btn-secondary btn-small' }),
      button('新增欄', () => { state.forEach(row => row.push('')); render(); onChange(); }, { class: 'btn btn-secondary btn-small' }));
    return { node: el('div', { class: 'rc-grid-wrap' }, table, controls), rows: () => state };
  }

  const MERMAID_TEMPLATES = Object.freeze({
    flow: ['流程圖', 'flowchart TD\n  A[開始] --> B{需要協助嗎？}\n  B -->|是| C(預約諮詢)\n  B -->|否| D[結束]\n  C --> D'],
    steps: ['橫向步驟', 'flowchart LR\n  A[報名] --> B[報到]\n  B[報到] --> C[活動]\n  C[活動] --> D[回饋]'],
    tree: ['組織架構', 'graph TD\n  A[理事會] --> B[秘書處]\n  A --> C[志工隊]\n  B --> D[活動組]\n  B --> E[健康組]']
  });

  function init({ textarea, onFormatChange = () => {} }) {
    const wrapper = el('div', { class: 'rc-editor' });
    const formatSelect = select(M.FORMATS, 'text');
    formatSelect.id = 'site-content-body-format';
    const toolbar = el('div', { class: 'rc-toolbar', role: 'toolbar', 'aria-label': '文字樣式工具' });
    const preview = el('div', { class: 'rc-preview rc-content', hidden: true, 'aria-live': 'polite' });
    const hint = el('p', { class: 'rc-editor-hint' });
    let mode = 'edit';

    const format = () => formatSelect.value;
    const notify = () => textarea.dispatchEvent(new Event('input', { bubbles: true }));

    function replaceRange(start, end, text) {
      textarea.focus();
      textarea.setRangeText(text, start, end, 'end');
      notify();
    }

    function insertBlock(text) {
      const { selectionStart: start, selectionEnd: end, value } = textarea;
      const before = start > 0 && !value.slice(0, start).endsWith('\n\n') ? (value.slice(0, start).endsWith('\n') ? '\n' : '\n\n') : '';
      const after = end < value.length && !value.slice(end).startsWith('\n') ? '\n\n' : '\n';
      replaceRange(start, end, `${before}${text}${after}`);
    }

    function wrapSelection(open, close, placeholder = '文字') {
      const { selectionStart: start, selectionEnd: end, value } = textarea;
      const selected = value.slice(start, end) || placeholder;
      replaceRange(start, end, `${open}${selected}${close}`);
      textarea.setSelectionRange(start + open.length, start + open.length + selected.length);
    }

    const span = style => wrapSelection(`<span style="${style}">`, '</span>');
    const tag = (name, placeholder) => wrapSelection(`<${name}>`, `</${name}>`, placeholder);

    function block(name) {
      const html = format() === 'html';
      const { selectionStart: start, selectionEnd: end, value } = textarea;
      const selected = value.slice(start, end) || '在這裡輸入內容';
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const heading = /^(h[2-4])$/.exec(name);
      if (heading) {
        const text = value.slice(lineStart, end > start ? end : value.indexOf('\n', start) < 0 ? value.length : value.indexOf('\n', start)).replace(/^#{1,6}\s+/, '').replace(/<\/?h[1-6]>/gi, '') || '標題';
        const lineEnd = lineStart + (end > start ? end - lineStart : (value.indexOf('\n', start) < 0 ? value.length : value.indexOf('\n', start)) - lineStart);
        replaceRange(lineStart, lineEnd, html ? `<${name}>${text}</${name}>` : `${'#'.repeat(Number(name[1]))} ${text}`);
      } else if (name === 'p') {
        const text = selected.replace(/^#{1,6}\s+/, '').replace(/<\/?(h[1-6]|p)>/gi, '');
        replaceRange(start, end, html ? `<p>${text}</p>` : text);
      } else if (name === 'quote') {
        insertBlock(html ? `<blockquote>${selected}</blockquote>` : selected.split('\n').map(line => `> ${line}`).join('\n'));
      } else if (name.startsWith('callout-')) {
        const key = { 'callout-info': 'NOTE', 'callout-tip': 'TIP', 'callout-warning': 'WARNING', 'callout-danger': 'IMPORTANT' }[name];
        const kind = M.CALLOUTS[key];
        insertBlock(html ? `<div class="rc-callout rc-callout-${kind.tone}"><strong class="rc-callout-title">${kind.title}</strong><p>${selected}</p></div>`
          : `> [!${key}]\n${selected.split('\n').map(line => `> ${line}`).join('\n')}`);
      } else if (name === 'highlight') span('background-color:#fff3a3');
      else if (name === 'lead') {
        insertBlock(html ? `<p style="font-size:1.25rem;line-height:1.8">${selected}</p>` : `<span style="font-size:1.25rem">${selected}</span>`);
      }
    }

    function list(ordered) {
      const { selectionStart: start, selectionEnd: end, value } = textarea;
      const lines = (value.slice(start, end) || '項目一\n項目二').split('\n');
      if (format() === 'html') insertBlock(`<${ordered ? 'ol' : 'ul'}>${lines.map(line => `<li>${line}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      else insertBlock(lines.map((line, index) => `${ordered ? `${index + 1}.` : '-'} ${line}`).join('\n'));
    }

    function linkDialog() {
      const url = el('input', { type: 'url', placeholder: 'https://', required: true });
      const label = el('input', { type: 'text', value: textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) });
      const { selectionStart: start, selectionEnd: end } = textarea;
      openDialog('插入連結', el('div', {}, field('連結網址', url), field('顯示文字', label)), () => {
        const href = global.RichContent?.safeUrl(url.value);
        if (!href) return '請輸入有效的連結（https、mailto 或 tel）。';
        const text = label.value.trim() || href;
        replaceRange(start, end, format() === 'html' ? `<a href="${M.escapeHtml(href)}">${M.escapeHtml(text)}</a>` : `[${text}](${href})`);
        return undefined;
      });
    }

    function tableDialog() {
      const { selectionStart: caret } = textarea;
      const found = M.locateTable(textarea.value, caret);
      const parsed = found && (found.kind === 'html' ? M.parseHtmlTable(textarea.value.slice(found.start, found.end)) : M.parseMarkdownTable(textarea.value.slice(found.start, found.end)));
      const header = el('input', { type: 'checkbox', checked: parsed ? parsed.header : true });
      const grid = gridEditor({ rows: parsed ? parsed.rows : [['標題一', '標題二', '標題三'], ['', '', ''], ['', '', '']], columnLabel: () => '儲存格' });
      openDialog(parsed ? '編輯表格' : '插入表格', el('div', {}, parsed ? el('p', { class: 'rc-editor-hint', text: '已偵測到游標所在的表格，儲存後會取代原表格。' }) : null,
        el('label', { class: 'rc-dialog-check' }, header, ' 第一列為標題'), grid.node), () => {
        const rows = grid.rows();
        const text = (parsed ? found.kind : format()) === 'html' ? M.buildHtmlTable(rows, header.checked) : M.buildMarkdownTable(rows);
        if (parsed) replaceRange(found.start, found.end, text);
        else insertBlock(text);
        return undefined;
      }, parsed ? '更新表格' : '插入');
    }

    function chartDialog() {
      const type = select(M.CHART_TYPES, 'bar');
      const title = el('input', { type: 'text', maxlength: '80', placeholder: '圖表標題（可留空）' });
      const stage = el('div', { class: 'rc-chart rc-dialog-preview' });
      let grid;
      const spec = () => {
        const rows = grid.rows();
        const series = rows[0].slice(1);
        return {
          type: type.value, title: title.value.trim(), labels: rows.slice(1).map(row => row[0]),
          datasets: series.map((label, index) => ({ label, data: rows.slice(1).map(row => Number(row[index + 1]) || 0) }))
        };
      };
      const draw = () => {
        const svg = M.chartSvg(spec());
        stage.replaceChildren();
        if (!svg) { stage.textContent = '請至少輸入一筆資料'; return; }
        stage.append(document.importNode(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement, true));
      };
      grid = gridEditor({ rows: [['項目', '數量'], ['一月', '12'], ['二月', '19'], ['三月', '8']], onChange: draw, columnLabel: c => (c ? '數值' : '項目名稱') });
      type.addEventListener('change', draw); title.addEventListener('input', draw);
      draw();
      openDialog('插入圖表', el('div', {},
        el('p', { class: 'rc-editor-hint', text: '第一列的第二欄起為「系列名稱」，第一欄為各項目名稱；圓餅圖只使用第一個系列。' }),
        el('div', { class: 'rc-dialog-row' }, field('圖表類型', type), field('標題', title)), grid.node, stage), () => {
        const parsed = M.parseChart(spec());
        if (!parsed) return '請至少輸入一筆資料。';
        const json = JSON.stringify(parsed);
        insertBlock(format() === 'html' ? `<div class="rc-chart" data-chart="${M.escapeHtml(json)}"></div>` : `\`\`\`chart\n${json}\n\`\`\``);
        return undefined;
      });
    }

    function mermaidDialog() {
      const template = select(Object.fromEntries(Object.entries(MERMAID_TEMPLATES).map(([key, value]) => [key, value[0]])), 'flow');
      const code = el('textarea', { rows: '8', spellcheck: 'false', class: 'rc-code' });
      code.value = MERMAID_TEMPLATES.flow[1];
      const stage = el('div', { class: 'rc-dialog-preview' });
      const draw = () => {
        stage.replaceChildren();
        try { stage.append(global.SiteEditorRich.diagramPreview(code.value)); } catch (error) { stage.textContent = `無法預覽：${error.message}`; }
      };
      template.addEventListener('change', () => { code.value = MERMAID_TEMPLATES[template.value][1]; draw(); });
      code.addEventListener('input', draw);
      draw();
      openDialog('插入 Mermaid 流程圖', el('div', {},
        el('p', { class: 'rc-editor-hint', text: '目前支援 Mermaid 的流程圖語法（flowchart / graph，方向 TD、TB、LR、RL、BT）。' }),
        field('範本', template), field('Mermaid 語法', code), stage), () => {
        try { global.SiteEditorRich.diagramPreview(code.value); } catch (error) { return `語法錯誤：${error.message}`; }
        insertBlock(format() === 'html' ? `<pre class="rc-mermaid">${M.escapeHtml(code.value)}</pre>` : `\`\`\`mermaid\n${code.value.trim()}\n\`\`\``);
        return undefined;
      });
    }

    function imageDialog() {
      const url = el('input', { type: 'url', placeholder: 'https://example.com/photo.jpg' });
      const alt = el('input', { type: 'text', maxlength: '200', placeholder: '圖片說明（視障讀者會聽到）' });
      const caption = el('input', { type: 'text', maxlength: '300', placeholder: '圖說／來源（可留空）' });
      const query = el('input', { type: 'search', placeholder: '輸入關鍵字，例如：health、community' });
      const results = el('div', { class: 'rc-image-results' });
      const status = el('p', { class: 'rc-editor-hint' });
      const search = async () => {
        const q = query.value.trim();
        if (!q) return;
        status.textContent = '搜尋中…';
        results.replaceChildren();
        try {
          const response = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=12&mature=false`, { headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          status.textContent = data.results?.length ? '點選圖片即可套用（僅顯示 CC0／公有領域）。' : '找不到相符的圖片。';
          (data.results || []).forEach(item => {
            const src = item.url;
            if (!/^https:\/\//.test(src || '')) return;
            results.append(button(el('img', { src: item.thumbnail || src, alt: item.title || '', loading: 'lazy', referrerpolicy: 'no-referrer' }), () => {
              url.value = src;
              alt.value = item.title || q;
              caption.value = `${item.title || '圖片'}${item.creator ? `，${item.creator}` : ''}（${(item.license || 'cc0').toUpperCase()}，來源：${item.source || 'Openverse'}）`;
              results.querySelectorAll('button').forEach(node => node.classList.remove('is-selected'));
              results.querySelector(`button[data-src="${CSS.escape(src)}"]`)?.classList.add('is-selected');
            }, { class: 'rc-image-choice', 'data-src': src }));
          });
        } catch {
          status.textContent = '無法連線到圖庫（需要網路連線），請改貼上圖片網址。';
        }
      };
      query.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
      openDialog('插入圖片', el('div', {},
        el('div', { class: 'rc-dialog-row' }, field('搜尋免費圖庫（Openverse）', query), button('搜尋', search, { class: 'btn btn-secondary' })),
        status, results, field('圖片網址', url), field('替代文字', alt), field('圖說', caption)), () => {
        const src = global.RichContent?.safeUrl(url.value, { media: true });
        if (!src || !/^https?:\/\//.test(src)) return '請輸入 http(s) 圖片網址。';
        const text = alt.value.trim() || caption.value.trim() || '圖片';
        const note = caption.value.trim();
        if (format() === 'html' || note) {
          insertBlock(`<figure><img src="${M.escapeHtml(src)}" alt="${M.escapeHtml(text)}">${note ? `<figcaption>${M.escapeHtml(note)}</figcaption>` : ''}</figure>`);
        } else insertBlock(`![${text}](${src})`);
        return undefined;
      });
    }

    function videoDialog() {
      const url = el('input', { type: 'url', placeholder: 'https://www.youtube.com/watch?v=…' });
      openDialog('插入影片', el('div', {}, el('p', { class: 'rc-editor-hint', text: '支援 YouTube、Vimeo 連結，以及 .mp4／.webm 影片檔網址。' }), field('影片連結', url)), () => {
        const embed = M.embedFor(url.value);
        if (!embed) return '無法辨識這個影片連結。';
        const src = M.escapeHtml(embed.src);
        insertBlock(embed.kind === 'video'
          ? `<div class="rc-video"><video src="${src}" controls></video></div>`
          : `<div class="rc-video"><iframe src="${src}" title="${embed.provider} 影片" allowfullscreen></iframe></div>`);
        return undefined;
      });
    }

    function embedDialog() {
      const url = el('input', { type: 'url', placeholder: 'https://' });
      const title = el('input', { type: 'text', maxlength: '100', placeholder: '嵌入內容標題（輔助工具會朗讀）' });
      const height = el('input', { type: 'number', min: '120', max: '1200', value: '480' });
      openDialog('嵌入其他網站', el('div', {},
        el('p', { class: 'rc-editor-hint', text: '僅支援 https 網址；部分網站（如 Facebook、Google 搜尋）禁止被嵌入，會顯示空白。嵌入框會在隔離沙箱中執行。' }),
        field('網站網址', url), field('標題', title), field('高度（像素）', height)), () => {
        const src = M.siteEmbedUrl(url.value);
        if (!src) return '請輸入 https 開頭的網址。';
        const h = Math.min(1200, Math.max(120, Number(height.value) || 480));
        insertBlock(`<div class="rc-embed"><iframe src="${M.escapeHtml(src)}" title="${M.escapeHtml(title.value.trim() || '嵌入內容')}" height="${h}"></iframe></div>`);
        return undefined;
      });
    }

    const presets = el('select', { 'aria-label': '段落樣式' }, el('option', { value: '', text: '段落樣式…' }), ...[
      ['p', '內文'], ['h2', '大標題'], ['h3', '中標題'], ['h4', '小標題'], ['lead', '導言（放大）'], ['quote', '引言'],
      ['callout-info', '提示框（藍）'], ['callout-tip', '小撇步框（綠）'], ['callout-warning', '注意框（黃）'], ['callout-danger', '重要框（紅）'], ['highlight', '螢光標記']
    ].map(([value, text]) => el('option', { value, text })));
    presets.addEventListener('change', () => { if (presets.value) block(presets.value); presets.value = ''; });
    const fonts = el('select', { 'aria-label': '字型' }, el('option', { value: '', text: '字型…' }), ...Object.entries(M.FONT_LABELS).map(([key, text]) => el('option', { value: key, text })));
    fonts.addEventListener('change', () => { if (fonts.value) span(`font-family:${M.FONTS[fonts.value].replace(/"/g, "'")}`); fonts.value = ''; });
    const sizes = el('select', { 'aria-label': '字級' }, el('option', { value: '', text: '字級…' }), ...Object.entries(M.SIZE_LABELS).map(([key, text]) => el('option', { value: key, text })));
    sizes.addEventListener('change', () => { if (sizes.value) span(`font-size:${M.SIZES[sizes.value]}`); sizes.value = ''; });
    const color = el('input', { type: 'color', value: '#c0392b', 'aria-label': '文字顏色', title: '文字顏色（選色後套用）' });
    color.addEventListener('change', () => span(`color:${color.value}`));

    const tools = [
      ['B', '粗體', () => (format() === 'html' ? tag('strong') : wrapSelection('**', '**'))],
      ['I', '斜體', () => (format() === 'html' ? tag('em') : wrapSelection('*', '*'))],
      ['U', '底線', () => tag('u')],
      ['S', '刪除線', () => (format() === 'html' ? tag('s') : wrapSelection('~~', '~~'))],
      ['置中', '置中對齊', () => span('text-align:center;display:block')],
      ['靠右', '靠右對齊', () => span('text-align:right;display:block')],
      ['• 清單', '項目清單', () => list(false)],
      ['1. 清單', '編號清單', () => list(true)],
      ['連結', '插入連結', linkDialog],
      ['分隔線', '插入分隔線', () => insertBlock(format() === 'html' ? '<hr>' : '---')],
      ['表格', '插入或編輯表格（游標在表格內時為編輯）', tableDialog],
      ['圖表', '插入圖表', chartDialog],
      ['Mermaid', '插入 Mermaid 流程圖', mermaidDialog],
      ['圖片', '插入圖片／免費圖庫', imageDialog],
      ['影片', '插入影片連結', videoDialog],
      ['嵌入網頁', '嵌入其他網站（iframe）', embedDialog]
    ];

    const toolButtons = tools.map(([label, title, run]) => button(label, run, { class: 'rc-tool', title, 'aria-label': title }));
    const tabs = {
      edit: button('編輯', () => setMode('edit'), { class: 'rc-tab is-active', role: 'tab' }),
      preview: button('預覽', () => setMode('preview'), { class: 'rc-tab', role: 'tab' })
    };

    function setMode(next) {
      mode = next;
      Object.entries(tabs).forEach(([key, node]) => { node.classList.toggle('is-active', key === next); node.setAttribute('aria-selected', String(key === next)); });
      preview.hidden = next !== 'preview';
      textarea.hidden = next === 'preview';
      toolbar.querySelectorAll('select, input, button').forEach(node => { node.disabled = next === 'preview' || (format() === 'text' && node !== formatSelect); });
      if (next === 'preview') {
        global.RichContent.render(preview, textarea.value, format());
        if (!textarea.value.trim()) preview.textContent = '（尚無內容可預覽）';
      }
    }

    function refresh() {
      const text = format() === 'text';
      hint.textContent = text
        ? '純文字：不套用任何樣式。切換為 Markdown 或 HTML 即可使用樣式工具（既有內容會原樣保留）。'
        : format() === 'markdown'
          ? 'Markdown：可直接輸入 Markdown 語法，也可用上方工具列插入樣式；需要時可混用 HTML。'
          : 'HTML：支援常用標籤；不安全的內容（script、事件屬性等）顯示時會被自動移除。';
      setMode(mode);
    }

    formatSelect.addEventListener('change', () => { refresh(); onFormatChange(); });
    toolbar.append(field('格式', formatSelect), presets, fonts, sizes, color, ...toolButtons);
    const header = el('div', { class: 'rc-editor-tabs', role: 'tablist' }, tabs.edit, tabs.preview);
    textarea.before(wrapper);
    wrapper.append(header, toolbar, hint, textarea, preview);
    textarea.addEventListener('input', () => { if (mode === 'preview') setMode('preview'); });
    refresh();

    return {
      getFormat: () => format(),
      setFormat: value => { formatSelect.value = M.FORMATS[value] ? value : 'text'; setMode('edit'); refresh(); },
      showEdit: () => setMode('edit')
    };
  }

  global.AdminRichEditor = Object.freeze({ init });
})(window);
