(function (global) {
  'use strict';
  const M = global.SiteEditorModel;
  // Capture original nodes before i18n, calendars, feeds or questionnaire initialization.
  // No innerHTML snapshots: interactive nodes and their event handlers always stay alive.
  const PROTECTED = 'script,style,form,input,textarea,select,button,iframe,canvas,svg,'
    + '[contenteditable], [data-managed-news], [aria-live], [role="status"],'
    + '#activity-calendar,#activity-event-details,.calendar-info-popover,.questionnaire-progress,.questionnaire-section-nav,'
    + '[data-site-editor-protected]';
  function capture(main, navigation) {
    const nodes = new Map(), texts = new Map(), links = new Map(), parents = new Map();
    const attributes = new Map(), added = [], navAdded = [], touched = new Set(), touchedTexts = new Set(), reordered = new Set();
    const replacedTextParents = new Map(), navEntries = new Map();
    const textWrappers = new Map();
    let navChanged = false;
    const baselineNavigation = { main: [], more: [] }, navRoots = {};
    const navOriginal = {};
    function remember(element) {
      if (!attributes.has(element)) attributes.set(element, {
        hidden: element.hidden, href: element.getAttribute('href'),
        i18n: element.getAttribute('data-i18n'), translate: element.getAttribute('translate'),
        style: element.getAttribute('style'), format: element.getAttribute('data-site-editor-style')
      });
    }
    function walk(element, path) {
      if (element.matches(PROTECTED)) return;
      const id = element.id ? `id:${element.id}` : path;
      const stable = `${id}:${M.fingerprint(`${element.tagName}.${element.className}:${element.textContent}:${element.getAttribute('href') || ''}`)}`;
      const containsWidget = Boolean(element.querySelector(PROTECTED));
      nodes.set(stable, { element, parent: null, deletable: !containsWidget, movable: !containsWidget,
        label: `${element.tagName.toLowerCase()} ${element.id || String(element.className).split(' ')[0] || ''}` });
      remember(element);
      const children = Array.from(element.children);
      parents.set(stable, { element, children, childNodes: Array.from(element.childNodes), ids: [] });
      let textIndex = 0;
      for (const child of element.childNodes) {
        if (child.nodeType === 3) {
          const original = child.nodeValue;
          if (original.trim() && !element.closest('[aria-hidden="true"],.material-icons,.notranslate')) {
            const textId = `${stable}/t${textIndex}:${M.fingerprint(original)}`;
            texts.set(textId, { node: child, original, label: original.trim().slice(0, 85), element });
          }
          textIndex += 1;
        }
      }
      if (element.tagName === 'A' && M.safeURL(element.getAttribute('href'))) {
        links.set(stable, { element, original: element.getAttribute('href'), label: element.textContent.trim().slice(0, 85) });
      }
      children.forEach((child, index) => {
        const childId = walk(child, `${path}/${index}`);
        if (childId) {
          nodes.get(childId).parent = stable;
          if (nodes.get(childId).movable) parents.get(stable).ids.push(childId);
        }
      });
      return stable;
    }
    const root = main ? walk(main, 'main') : null;
    if (navigation) {
      navRoots.main = navigation.querySelector('.bottom-nav');
      navRoots.more = navigation.querySelector('#navigation-more-menu');
      for (const group of ['main', 'more']) {
        navOriginal[group] = Array.from(navRoots[group]?.childNodes || []);
        navOriginal[group].filter(node => node.tagName === 'A').forEach((node, index) => {
          const label = Array.from(node.childNodes).filter(child => child.nodeType === 3
            || (child.nodeType === 1 && !child.matches('.material-icons,[aria-hidden="true"]')))
            .map(child => child.textContent).join('').trim();
          baselineNavigation[group].push({ id: `${group}-${index}`, label,
            url: node.getAttribute('href') });
          navEntries.set(`${group}-${index}`, { element: node, children: Array.from(node.childNodes),
            href: node.getAttribute('href'), hidden: node.hidden, current: node.getAttribute('aria-current'), label });
        });
      }
    }
    function restore() {
      added.splice(0).forEach(node => node.remove());
      navAdded.splice(0).forEach(node => node.remove());
      for (const [id, wrapper] of textWrappers) wrapper.replaceWith(texts.get(id).node);
      textWrappers.clear();
      for (const id of reordered) {
        const { element, childNodes } = parents.get(id);
        childNodes.forEach(child => element.append(child));
      }
      reordered.clear();
      for (const id of touchedTexts) {
        const { node, original } = texts.get(id); node.nodeValue = original;
      }
      touchedTexts.clear();
      for (const [element, childNodes] of replacedTextParents) element.replaceChildren(...childNodes);
      replacedTextParents.clear();
      for (const element of touched) {
        const attrs = attributes.get(element);
        element.hidden = attrs.hidden;
        element.removeAttribute('data-site-editor-deleted');
        for (const [name, value] of [['href', attrs.href], ['data-i18n', attrs.i18n], ['translate', attrs.translate],
          ['style', attrs.style], ['data-site-editor-style', attrs.format]]) {
          // Flush pending CSSOM serialization before removing an originally absent style.
          if (name === 'style') element.getAttribute(name);
          if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
        }
      }
      touched.clear();
      if (navChanged) for (const group of ['main', 'more']) {
        navOriginal[group]?.forEach(node => {
          if (node.tagName === 'A') {
            const entry = Array.from(navEntries.values()).find(item => item.element === node);
            node.hidden = entry.hidden; node.removeAttribute('data-site-editor-deleted');
            node.replaceChildren(...entry.children); node.setAttribute('href', entry.href);
            if (entry.current === null) node.removeAttribute('aria-current'); else node.setAttribute('aria-current', entry.current);
          }
          navRoots[group].append(node);
        });
      }
      navChanged = false;
    }
    function render(documentValue, navValue) {
      const doc = M.normalize(documentValue);
      const navDocument = M.normalize(navValue || M.empty());
      restore();
      for (const [id, patch] of Object.entries(doc.patches)) {
        const target = texts.get(id);
        if (target && ('text' in patch || 'rich' in patch || 'style' in patch)) {
          if (target.node.parentNode !== target.element) {
            const originalParent = Array.from(parents.values()).find(item => item.element === target.element);
            if (!originalParent || target.element.querySelector(PROTECTED)) continue;
            replacedTextParents.set(target.element, Array.from(target.element.childNodes));
            target.element.replaceChildren(...originalParent.childNodes);
          }
          touchedTexts.add(id);
          const wrapper = document.createElement('span');
          wrapper.setAttribute('data-site-editor-text', id);
          if ('rich' in patch && global.SiteEditorRich) wrapper.append(global.SiteEditorRich.renderRuns(patch.rich));
          else wrapper.textContent = 'rich' in patch ? patch.rich.map(run => run.text).join('') : ('text' in patch ? patch.text : target.original);
          if (patch.style && global.SiteEditorRich) global.SiteEditorRich.applyStyle(wrapper, patch.style);
          target.node.replaceWith(wrapper);
          textWrappers.set(id, wrapper);
          // Original-language overrides should not be overwritten by runtime dictionaries.
          let ancestor = target.element;
          while (ancestor && main.contains(ancestor)) {
            if (ancestor.hasAttribute('data-i18n')) {
              remember(ancestor); touched.add(ancestor); ancestor.removeAttribute('data-i18n');
            }
            ancestor = ancestor.parentElement;
          }
        }
        if (links.has(id) && patch.href) {
          const element = links.get(id).element; touched.add(element); element.setAttribute('href', patch.href);
        }
        if (nodes.has(id) && patch.style && global.SiteEditorRich) {
          const element = nodes.get(id).element; touched.add(element);
          global.SiteEditorRich.applyStyle(element, patch.style);
        }
        if (nodes.has(id) && nodes.get(id).deletable && patch.deleted) {
          const element = nodes.get(id).element; touched.add(element); element.hidden = true;
          element.setAttribute('data-site-editor-deleted', '');
        }
      }
      const wrappedNodes = new Map(Array.from(textWrappers, ([id, wrapper]) => [texts.get(id).node, wrapper]));
      for (const [parentId, order] of Object.entries(doc.orders)) {
        const parent = parents.get(parentId);
        if (!parent) continue;
        reordered.add(parentId);
        // Replace only the editable slots; protected siblings retain their slots.
        const ranked = order.filter(id => parent.ids.includes(id));
        const all = [...ranked, ...parent.ids.filter(id => !ranked.includes(id))].map(id => nodes.get(id).element);
        let slot = 0;
        parent.childNodes.forEach(child => parent.element.append(parent.ids.some(id => nodes.get(id).element === child) ? all[slot++] : wrappedNodes.get(child) || child));
      }
      for (const block of doc.blocks) {
        const parent = parents.get(block.parent);
        if (!parent || !['MAIN', 'DIV', 'SECTION', 'ARTICLE'].includes(parent.element.tagName)) continue;
        const article = global.SiteEditorRich ? global.SiteEditorRich.render(block) : document.createElement('article');
        article.setAttribute('data-site-editor-block', block.id);
        article.className = 'detail-card site-editor-content-block';
        if (!global.SiteEditorRich) {
          const heading = document.createElement('h3'); heading.textContent = block.title;
          const body = document.createElement('p'); body.textContent = block.body;
          heading.setAttribute('data-site-editor-field', 'title');
          body.setAttribute('data-site-editor-field', 'body');
          article.append(heading, body);
          if (block.url) {
            const link = document.createElement('a'); link.textContent = block.label || '了解更多';
            link.href = block.url; article.append(link);
          }
        }
        const before = nodes.get(block.before);
        if (before?.movable && before.parent === block.parent && before.element.parentElement === parent.element) {
          parent.element.insertBefore(article, before.element);
        } else {
          parent.element.append(article);
        }
        added.push(article);
      }
      const nav = navDocument.navigation;
      if (nav) for (const group of ['main', 'more']) {
        navChanged = true;
        const container = navRoots[group];
        if (!container) continue;
        navOriginal[group].filter(node => node.tagName === 'A').forEach(node => {
          node.hidden = true; node.setAttribute('data-site-editor-deleted', '');
        });
        const before = navOriginal[group].find(node => node.tagName === 'BUTTON') || null;
        for (const item of nav[group]) {
          const entry = navEntries.get(item.id);
          const anchor = entry ? entry.element : document.createElement('a');
          if (!entry || entry.label !== item.label) {
            const icon = entry?.children.filter(node => node.nodeType === 1 && node.matches('.material-icons,[aria-hidden="true"]')) || [];
            const label = document.createElement('span'); label.textContent = item.label;
            anchor.replaceChildren(...icon, label);
          }
          anchor.href = item.url; anchor.hidden = false; anchor.removeAttribute('data-site-editor-deleted');
          anchor.removeAttribute('aria-current');
          if (new URL(item.url, location.href).pathname === location.pathname) anchor.setAttribute('aria-current', 'page');
          container.insertBefore(anchor, before);
          if (!entry) navAdded.push(anchor);
        }
      }
    }
    return { nodes, texts, links, parents, root, baselineNavigation, render, restore, PROTECTED };
  }
  global.SiteEditorDOM = Object.freeze({ capture, PROTECTED });
})(globalThis);
