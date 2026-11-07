(function (global) {
  const Model = global.RichContentModel;
  if (!Model) return;

  const REMOVE = new Set(['SCRIPT', 'STYLE', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META', 'BASE', 'FRAME', 'FRAMESET', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH']);
  const ALLOWED = {
    P: [], BR: [], HR: [], DIV: [], SPAN: [], STRONG: [], B: [], EM: [], I: [], U: [], S: [], DEL: [], MARK: [], SMALL: [], SUB: [], SUP: [], CODE: [], PRE: [], KBD: [],
    H1: [], H2: [], H3: [], H4: [], H5: [], H6: [], UL: [], OL: ['start'], LI: [], BLOCKQUOTE: [], FIGURE: [], FIGCAPTION: [], DETAILS: ['open'], SUMMARY: [],
    TABLE: [], THEAD: [], TBODY: [], TFOOT: [], TR: [], TH: ['colspan', 'rowspan', 'scope'], TD: ['colspan', 'rowspan'], CAPTION: [],
    A: ['href', 'title'], IMG: ['src', 'alt', 'title', 'width', 'height'], VIDEO: ['src', 'controls', 'poster', 'width', 'height'], IFRAME: ['src', 'title', 'width', 'height', 'allowfullscreen']
  };

  function safeUrl(value, { media = false } = {}) {
    const text = String(value || '').replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
    if (!text || text.startsWith('//')) return '';
    if (text.startsWith('#') || !/^[a-z][a-z0-9+.-]*:/i.test(text)) return text.includes(':') ? '' : text;
    try {
      const url = new URL(text);
      const allowed = media ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:', 'tel:'];
      return allowed.includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function clean(node, target, doc) {
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) { target.append(doc.createTextNode(child.nodeValue)); return; }
      if (child.nodeType !== 1) return;
      const tag = child.tagName;
      if (REMOVE.has(tag.toUpperCase())) return;
      const allowed = ALLOWED[tag];
      if (!allowed) { clean(child, target, doc); return; }

      const chart = tag === 'DIV' && child.classList.contains('rc-chart') && child.hasAttribute('data-chart');
      const diagram = tag === 'PRE' && child.classList.contains('rc-mermaid');
      const copy = doc.createElement(tag.toLowerCase());
      allowed.forEach(name => {
        if (!child.hasAttribute(name)) return;
        let value = child.getAttribute(name);
        if (name === 'href') value = safeUrl(value);
        else if (name === 'src' || name === 'poster') value = safeUrl(value, { media: true });
        if (value || (name !== 'href' && name !== 'src' && name !== 'poster')) copy.setAttribute(name, value);
      });
      const classes = [...child.classList].filter(name => /^rc-[\w-]+$/.test(name));
      if (classes.length) copy.className = classes.join(' ');
      const style = Model.safeStyle(child.getAttribute('style'));
      if (style) copy.setAttribute('style', style);
      if (chart) copy.setAttribute('data-chart', child.getAttribute('data-chart').slice(0, 8000));

      if (tag === 'A') {
        if (!copy.hasAttribute('href')) { clean(child, target, doc); return; }
        if (!copy.getAttribute('href').startsWith('#')) { copy.target = '_blank'; copy.rel = 'noopener noreferrer'; }
      } else if (tag === 'IMG') {
        if (!copy.hasAttribute('src')) return;
        copy.loading = 'lazy';
        copy.referrerPolicy = 'no-referrer';
      } else if (tag === 'VIDEO') {
        if (!copy.hasAttribute('src')) return;
        copy.setAttribute('controls', '');
        copy.preload = 'metadata';
      } else if (tag === 'IFRAME') {
        const src = Model.siteEmbedUrl(child.getAttribute('src'));
        if (!src || new URL(src).origin === global.location?.origin) return;
        copy.src = src;
        copy.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
        copy.setAttribute('loading', 'lazy');
        copy.setAttribute('referrerpolicy', 'no-referrer');
        copy.setAttribute('allowfullscreen', '');
        copy.classList.add('rc-embed-frame');
        if (!copy.title) copy.title = '嵌入內容';
      }
      if (!chart) clean(child, copy, doc);
      else copy.textContent = '';
      if (diagram) copy.textContent = child.textContent;
      target.append(copy);
    });
  }

  function hydrate(container) {
    container.querySelectorAll('.rc-chart[data-chart]').forEach(box => {
      const svg = Model.chartSvg(box.getAttribute('data-chart'));
      box.removeAttribute('data-chart');
      if (!svg) { box.textContent = '圖表資料格式不正確'; box.classList.add('rc-error'); return; }
      const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
      if (parsed.nodeName.toLowerCase() === 'svg') box.append(document.importNode(parsed, true));
    });
    container.querySelectorAll('pre.rc-mermaid').forEach(pre => {
      const holder = document.createElement('div');
      holder.className = 'rc-mermaid-view';
      try {
        if (!global.SiteEditorRich?.diagramPreview) throw new Error('no renderer');
        holder.append(global.SiteEditorRich.diagramPreview(pre.textContent));
        pre.replaceWith(holder);
      } catch (error) {
        pre.classList.add('rc-error');
        pre.dataset.error = error.message;
      }
    });
  }

  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}`, 'text/html');
    const fragment = document.createDocumentFragment();
    const holder = document.createElement('div');
    clean(doc.body, holder, document);
    fragment.append(...holder.childNodes);
    return fragment;
  }

  function render(container, body, format = 'text') {
    container.replaceChildren();
    container.classList.add('rc-content');
    if (format !== 'markdown' && format !== 'html') {
      container.classList.add('rc-plain');
      container.textContent = String(body || '');
      return container;
    }
    container.classList.remove('rc-plain');
    container.append(sanitize(Model.toHtml(body, format)));
    hydrate(container);
    return container;
  }

  global.RichContent = Object.freeze({ render, sanitize, safeUrl });
})(window);
