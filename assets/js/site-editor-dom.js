(function (global) {
  'use strict';
  const M = global.SiteEditorModel;
  const ICONS = '.material-icons,.material-icons-outlined,.material-symbols-outlined,.material-symbols-rounded,.material-symbols-sharp';
  // Capture original nodes before i18n, calendars, feeds or questionnaire initialization.
  // No innerHTML snapshots: interactive nodes and their event handlers always stay alive.
  const PROTECTED = 'script,style,form,input,textarea,select,button:not([data-site-editor-static="true"]),iframe,canvas,svg,'
    + '[contenteditable], [data-managed-news], [aria-live], [role="status"],'
    + '[onclick],[onkeydown],[role="button"]:not([data-site-editor-static="true"]),[aria-controls],[aria-expanded],'
    + '#activity-calendar,#activity-event-details,.calendar-info-popover,.questionnaire-progress,.questionnaire-section-nav,'
    + '[data-site-editor-protected]';
  function capture(main, navigation) {
    const nodes = new Map(), texts = new Map(), links = new Map(), parents = new Map(), components = new Map();
    const attributes = new Map(), added = [], navAdded = [], touched = new Set(), touchedTexts = new Set(), reordered = new Set();
    const replacedTextParents = new Map(), navEntries = new Map();
    const textWrappers = new Map();
    let navChanged = false;
    const baselineNavigation = { main: [], more: [] }, navRoots = {};
    const navOriginal = {};
    function navText(node) {
      if (node.nodeType === 3) return node.nodeValue;
      if (node.nodeType !== 1 || node.matches(`${ICONS},img,[aria-hidden="true"]`)) return '';
      return Array.from(node.childNodes).map(navText).join('');
    }
    function remember(element) {
      if (!attributes.has(element)) attributes.set(element, {
        hidden: element.hidden, href: element.getAttribute('href'),
        i18n: element.getAttribute('data-i18n'), translate: element.getAttribute('translate'),
        style: element.getAttribute('style'), format: element.getAttribute('data-site-editor-style'),
        src: element.getAttribute('src'), alt: element.getAttribute('alt'), srcset: element.getAttribute('srcset'),
        variant: element.getAttribute('data-site-editor-variant'), className: element.getAttribute('class')
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
      const isIcon = element.matches(ICONS)
        && !element.children.length;
      if (element.tagName === 'IMG') components.set(stable, { element, type: 'image' });
      else if (isIcon) components.set(stable, { element, type: 'icon', original: Array.from(element.childNodes) });
      else if (element.matches('a[href],button[data-site-editor-static="true"]')) components.set(stable, { element, type: 'button' });
      const children = Array.from(element.children);
      parents.set(stable, { element, children, childNodes: Array.from(element.childNodes), ids: [] });
      let textIndex = 0;
      for (const child of element.childNodes) {
        if (child.nodeType === 3) {
          const original = child.nodeValue;
          if (original.trim() && !isIcon && !element.closest('[aria-hidden="true"],.material-icons,.material-icons-outlined,.material-symbols-outlined,.material-symbols-rounded,.material-symbols-sharp,.notranslate')) {
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
        navOriginal[group].filter(node => node.tagName === 'A' && !node.matches(PROTECTED) && !node.querySelector(PROTECTED)).forEach((node, index) => {
          const label = navText(node).trim();
          const icon = node.querySelector(ICONS), image = node.querySelector('img');
          const item = { id: `${group}-${index}`, label, url: node.getAttribute('href') };
          if (icon && /^[a-z][a-z0-9_]{0,63}$/.test(icon.textContent.trim())) item.icon = icon.textContent.trim();
          if (image && M.safeMediaURL(image.getAttribute('src'))) {
            item.src = image.getAttribute('src'); item.alt = image.getAttribute('alt') || '';
          }
          baselineNavigation[group].push(item);
          if (icon) remember(icon);
          if (image) remember(image);
          navEntries.set(`${group}-${index}`, { element: node, children: Array.from(node.childNodes),
            href: node.getAttribute('href'), hidden: node.hidden, current: node.getAttribute('aria-current'), label,
            icon, image, iconChildren: icon ? Array.from(icon.childNodes) : [],
            visualParents: [icon, image].filter(Boolean).map(visual => ({ node: visual, parent: visual.parentNode, next: visual.nextSibling })) });
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
          ['style', attrs.style], ['data-site-editor-style', attrs.format], ['src', attrs.src], ['alt', attrs.alt],
          ['srcset', attrs.srcset], ['data-site-editor-variant', attrs.variant], ['class', attrs.className]]) {
          // Flush pending CSSOM serialization before removing an originally absent style.
          if (name === 'style') element.getAttribute(name);
          if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
        }
        for (const item of components.values()) if (item.type === 'icon' && touched.has(item.element)) item.element.replaceChildren(...item.original);
      }
      touched.clear();
      if (navChanged) for (const group of ['main', 'more']) {
        navOriginal[group]?.forEach(node => {
          if (node.tagName === 'A') {
            const entry = Array.from(navEntries.values()).find(item => item.element === node);
            if (!entry) { navRoots[group].append(node); return; }
            node.hidden = entry.hidden; node.removeAttribute('data-site-editor-deleted');
            node.replaceChildren(...entry.children); node.setAttribute('href', entry.href);
            for (const visual of entry.visualParents) {
              visual.parent.insertBefore(visual.node, visual.next?.parentNode === visual.parent ? visual.next : null);
            }
            if (entry.icon) entry.icon.replaceChildren(...entry.iconChildren);
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
        const visual = components.get(id);
        if (visual) {
          const element = visual.element;
          if (visual.type === 'image' && ('src' in patch || 'alt' in patch)) {
            touched.add(element);
            if ('src' in patch) {
              element.setAttribute('src', patch.src); element.removeAttribute('srcset');
              if (element.parentElement?.tagName === 'PICTURE') for (const source of element.parentElement.querySelectorAll('source[srcset]')) {
                remember(source); touched.add(source); source.removeAttribute('srcset');
              }
            }
            if ('alt' in patch) element.setAttribute('alt', patch.alt);
          }
          if (visual.type === 'icon' && 'icon' in patch) {
            touched.add(element); element.textContent = patch.icon;
          }
          if (visual.type === 'button' && patch.variant) {
            touched.add(element); element.setAttribute('data-site-editor-variant', patch.variant);
            M.VARIANTS.forEach(value => element.classList.remove(`site-editor-variant-${value}`));
            element.classList.add('site-editor-button', `site-editor-variant-${patch.variant}`);
          }
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
      const newBlocks = new Map();
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
        newBlocks.set(block.id, { block, article, parent });
      }
      // Added-block anchors may point forward in the document. Resolve their
      // dependency first; cycles are ignored rather than moving original nodes.
      const placed = new Set(), placing = new Set();
      function placeAdded(id) {
        if (placed.has(id)) return true;
        if (placing.has(id)) return false;
        const entry = newBlocks.get(id), before = newBlocks.get(entry.block.before);
        if (!before || before.block.parent !== entry.block.parent) { placed.add(id); return true; }
        placing.add(id);
        const valid = placeAdded(before.block.id);
        placing.delete(id); placed.add(id);
        if (valid) entry.parent.element.insertBefore(entry.article, before.article);
        return valid;
      }
      newBlocks.forEach((entry, id) => placeAdded(id));
      for (const [parentId, order] of Object.entries(doc.orders)) {
        const parent = parents.get(parentId);
        if (!parent || !order.some(id => newBlocks.get(id)?.block.parent === parentId)) continue;
        const blockIds = Array.from(newBlocks).filter(([, entry]) => entry.block.parent === parentId).map(([id]) => id);
        const ranked = order.filter(id => parent.ids.includes(id) || blockIds.includes(id));
        const all = [...ranked, ...parent.ids.filter(id => !ranked.includes(id)), ...blockIds.filter(id => !ranked.includes(id))];
        // Original editable slots have already been ranked above. Only insert
        // new articles around those slots; protected siblings are never moved.
        all.forEach((id, index) => {
          const entry = newBlocks.get(id);
          if (!entry || entry.block.parent !== parentId) return;
          const nextOriginal = all.slice(index + 1).find(next => parent.ids.includes(next));
          const anchor = nextOriginal ? nodes.get(nextOriginal).element : null;
          parent.element.insertBefore(entry.article, anchor);
        });
      }
      const nav = navDocument.navigation;
      if (nav) for (const group of ['main', 'more']) {
        navChanged = true;
        const container = navRoots[group];
        if (!container) continue;
        navOriginal[group].filter(node => node.tagName === 'A'
          && Array.from(navEntries.values()).some(entry => entry.element === node)).forEach(node => {
          node.hidden = true; node.setAttribute('data-site-editor-deleted', '');
        });
        const before = navOriginal[group].find(node => node.tagName === 'BUTTON') || null;
        for (const item of nav[group]) {
          const entry = navEntries.get(item.id);
          const anchor = entry ? entry.element : document.createElement('a');
          if (!entry || entry.label !== item.label) {
            const icon = entry?.children.filter(node => node.nodeType === 1 && node.matches(`${ICONS},img,[aria-hidden="true"]`)) || [];
            for (const visual of [entry?.icon, entry?.image]) if (visual && !icon.some(node => node === visual || node.contains(visual))) icon.push(visual);
            const label = document.createElement('span'); label.textContent = item.label;
            anchor.replaceChildren(...icon, label);
          }
          anchor.href = item.url; anchor.hidden = false; anchor.removeAttribute('data-site-editor-deleted');
          if ('icon' in item) {
            let icon = entry?.icon || anchor.querySelector(ICONS);
            if (!icon && item.icon) {
              icon = document.createElement('span'); icon.className = 'material-icons';
              icon.setAttribute('aria-hidden', 'true'); anchor.prepend(icon);
            }
            if (icon) {
              if (entry?.icon === icon) touched.add(icon);
              icon.hidden = !item.icon;
              if (item.icon) icon.textContent = item.icon;
            }
          }
          if ('src' in item || 'alt' in item) {
            let image = entry?.image || anchor.querySelector('img');
            if (!image && item.src) { image = document.createElement('img'); anchor.prepend(image); }
            if (image) {
              if (entry?.image === image) touched.add(image);
              if ('src' in item) {
                image.hidden = !item.src;
                if (item.src) {
                  image.setAttribute('src', item.src); image.removeAttribute('srcset');
                  if (image.parentElement?.tagName === 'PICTURE') for (const source of image.parentElement.querySelectorAll('source[srcset]')) {
                    remember(source); touched.add(source); source.removeAttribute('srcset');
                  }
                }
              }
              if ('alt' in item) image.setAttribute('alt', item.alt);
            }
          }
          anchor.removeAttribute('aria-current');
          if (new URL(item.url, location.href).pathname === location.pathname) anchor.setAttribute('aria-current', 'page');
          container.insertBefore(anchor, before);
          if (!entry) navAdded.push(anchor);
        }
      }
    }
    return { nodes, texts, links, parents, components, root, baselineNavigation, render, restore, PROTECTED };
  }
  global.SiteEditorDOM = Object.freeze({ capture, PROTECTED });
})(globalThis);
