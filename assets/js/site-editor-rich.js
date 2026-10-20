(function (global) {
  'use strict';
  const M = global.SiteEditorModel;
  const SVG = 'http://www.w3.org/2000/svg', MATH = 'http://www.w3.org/1998/Math/MathML';
  function node(tag, text) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function namespaced(namespace, tag, attributes = {}, text) {
    const element = document.createElementNS(namespace, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function applyStyle(element, style) {
    if (!M.STYLES.includes(style)) throw new Error('Unsupported text style');
    element.setAttribute('data-site-editor-style', style);
    element.style.whiteSpace = 'pre-wrap';
    element.style.display = ['ul', 'ol'].includes(style) ? 'list-item' : 'block';
    element.style.fontSize = ({ h1: '2em', h2: '1.5em', h3: '1.17em' })[style] || '1em';
    element.style.fontWeight = /^h[123]$/.test(style) ? 'bold' : 'normal';
    element.style.borderInlineStart = style === 'blockquote' ? '3px solid currentColor' : '';
    element.style.paddingInlineStart = ['blockquote', 'ul', 'ol'].includes(style) ? '1em' : '';
    // Existing elements are styled in place: their protected descendants are never replaced.
    element.style.listStyleType = style === 'ul' ? 'disc' : style === 'ol' ? 'decimal' : '';
  }
  function renderRuns(runs) {
    const fragment = document.createDocumentFragment();
    for (const run of M.runs(runs)) {
      let content = document.createTextNode(run.text);
      for (const [enabled, tag] of [[run.bold, 'strong'], [run.italic, 'em'], [run.underline, 'u'],
        [run.highlight, 'mark'], [run.script === 'sub', 'sub'], [run.script === 'super', 'sup']]) {
        if (enabled) { const wrapper = node(tag); wrapper.append(content); content = wrapper; }
      }
      if (run.color) {
        const wrapper = node('span'); wrapper.style.color = run.color; wrapper.append(content); content = wrapper;
      }
      if (run.href) {
        const wrapper = node('a'); wrapper.href = run.href; wrapper.append(content); content = wrapper;
      }
      fragment.append(content);
    }
    return fragment;
  }
  function readRuns(element) {
    const result = [];
    let total = 0;
    function append(text, flags) {
      if (!text) return;
      total += text.length;
      if (total > 12000) throw new Error('Rich text is too long');
      const previous = result[result.length - 1];
      if (previous && JSON.stringify({ ...previous, text: '' }) === JSON.stringify({ text: '', ...flags })) previous.text += text;
      else result.push({ text, ...flags });
      if (result.length > 500) throw new Error('Too many rich text runs');
    }
    function visit(current, inherited, depth) {
      if (depth > 40) throw new Error('Rich text nesting is too deep');
      if (current.nodeType === 3) { append(current.nodeValue, inherited); return; }
      if (current.nodeType !== 1 && current.nodeType !== 11) return;
      if (current.nodeType === 1 && current.matches('script,style,iframe,object,svg,math,[data-site-editor-protected]')) return;
      const flags = { ...inherited }, tag = current.tagName;
      for (const [tags, flag] of [[['STRONG', 'B'], 'bold'], [['EM', 'I'], 'italic'], [['U'], 'underline'], [['MARK'], 'highlight']]) {
        if (tags.includes(tag)) flags[flag] = true;
      }
      if (tag === 'SUB' || tag === 'SUP') flags.script = tag === 'SUB' ? 'sub' : 'super';
      const href = current.getAttribute?.('href');
      if (tag === 'A' && M.safeURL(href)) flags.href = href;
      const color = current.style?.color;
      if (color) {
        const rgb = color.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
        if (/^#[0-9a-f]{6}$/i.test(color)) flags.color = color;
        else if (rgb && rgb.slice(1).every(value => Number(value) <= 255)) {
          flags.color = '#' + rgb.slice(1).map(value => Number(value).toString(16).padStart(2, '0')).join('');
        }
      }
      if (tag === 'BR') append('\n', flags);
      else {
        let previousBlock = false;
        for (const child of current.childNodes) {
          const block = child.nodeType === 1 && /^(DIV|P|H[1-6]|BLOCKQUOTE|LI|UL|OL)$/.test(child.tagName);
          if ((block || previousBlock) && result.length && !result[result.length - 1].text.endsWith('\n')) append('\n', flags);
          visit(child, flags, depth + 1);
          previousBlock = block;
        }
      }
    }
    visit(element, {}, 0);
    return M.runs(result);
  }
  function bodyText(block) {
    const style = block.style || 'p', element = node(style);
    if (style === 'ul' || style === 'ol') {
      const runs = block.rich || [{ text: block.body }];
      let item = node('li'); element.append(item);
      for (const run of runs) {
        run.text.split('\n').forEach((part, index) => {
          if (index) { item = node('li'); element.append(item); }
          item.append(renderRuns([{ ...run, text: part }]));
        });
      }
    } else {
      element.style.whiteSpace = 'pre-wrap';
      element.append(renderRuns(block.rich || [{ text: block.body }]));
    }
    element.setAttribute('data-site-editor-field', 'body');
    return element;
  }
  function source(block) {
    const details = node('details'), summary = node('summary', '原始碼 / Source');
    const pre = node('pre'), code = node('code', block.body);
    code.setAttribute('data-site-editor-field', 'body');
    if (block.language) code.setAttribute('data-language', block.language);
    pre.append(code); details.append(summary, pre);
    return details;
  }
  // Small, non-executable LaTeX grammar. Unknown commands fall back to the visible source.
  function mathPreview(sourceText) {
    let input = sourceText.trim().replace(/^\$\$?|\$\$?$/g, ''), index = 0, count = 0;
    const symbols = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ', mu: 'μ',
      pi: 'π', sigma: 'σ', phi: 'φ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω',
      times: '×', cdot: '·', div: '÷', pm: '±', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠',
      neq: '≠', infty: '∞', sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇', to: '→',
      in: '∈', notin: '∉', approx: '≈', ldots: '…', sin: 'sin', cos: 'cos', tan: 'tan', log: 'log', ln: 'ln' };
    function atom(depth) {
      if (++count > 3000 || depth > 30) throw new Error('Formula too complex');
      while (/\s/.test(input[index] || '') && index < input.length) index++;
      const character = input[index++];
      if (!character || character === '}') throw new Error('Incomplete formula');
      if (character === '{') return sequence(depth + 1, true);
      if (character === '\\') {
        const command = input.slice(index).match(/^[a-zA-Z]+/)?.[0];
        if (!command) throw new Error('Unsupported LaTeX escape');
        index += command.length;
        if (command === 'frac') {
          const fraction = namespaced(MATH, 'mfrac'); fraction.append(atom(depth + 1), atom(depth + 1)); return fraction;
        }
        if (command === 'sqrt') { const root = namespaced(MATH, 'msqrt'); root.append(atom(depth + 1)); return root; }
        if (command === 'text' || command === 'mathrm') {
          while (input[index] === ' ') index++;
          const match = input.slice(index).match(/^\{([^{}]*)\}/);
          if (!match) throw new Error('Unsupported text group');
          index += match[0].length; return namespaced(MATH, 'mtext', {}, match[1]);
        }
        if (command === 'left' || command === 'right') return atom(depth + 1);
        if (!Object.hasOwn(symbols, command)) throw new Error('Unsupported LaTeX command');
        return namespaced(MATH, ['sin', 'cos', 'tan', 'log', 'ln'].includes(command) ? 'mi' : 'mo', {}, symbols[command]);
      }
      return namespaced(MATH, /\d/.test(character) ? 'mn' : /[a-zA-Z]/.test(character) ? 'mi' : 'mo', {}, character);
    }
    function sequence(depth, grouped) {
      const row = namespaced(MATH, 'mrow');
      while (index < input.length) {
        if (/\s/.test(input[index])) { index++; continue; }
        if (input[index] === '}') {
          if (!grouped) throw new Error('Unexpected formula group');
          index++; return row;
        }
        let base = atom(depth), sub = null, sup = null;
        while (/\s/.test(input[index] || '') && index < input.length) index++;
        while (input[index] === '^' || input[index] === '_') {
          const script = input[index++];
          if (script === '_') { if (sub) throw new Error('Repeated subscript'); sub = atom(depth + 1); }
          else { if (sup) throw new Error('Repeated superscript'); sup = atom(depth + 1); }
          while (/\s/.test(input[index] || '') && index < input.length) index++;
        }
        if (sub || sup) {
          const scripted = namespaced(MATH, sub && sup ? 'msubsup' : sub ? 'msub' : 'msup');
          scripted.append(base); if (sub) scripted.append(sub); if (sup) scripted.append(sup); base = scripted;
        }
        row.append(base);
      }
      if (grouped) throw new Error('Unclosed formula group');
      return row;
    }
    const math = namespaced(MATH, 'math', { display: 'block', 'aria-label': sourceText });
    math.append(sequence(0, false)); return math;
  }
  function svg(width, height, label) {
    return namespaced(SVG, 'svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': label });
  }
  // Safe ABC staff preview: monophonic notes/rests, durations, accidentals and bar lines.
  function musicPreview(text) {
    const lines = text.split('\n'), headers = {}, tune = [];
    for (const line of lines) {
      const header = line.match(/^([A-Z]):\s*(.*)$/);
      if (header) headers[header[1]] = header[2]; else tune.push(line.replace(/%.*/, ''));
    }
    const music = tune.join(' ').replace(/"[^"]*"|![^!]*!|\{[^}]*\}/g, '');
    const pattern = /(?:[_^=]{0,2}[A-Ga-g][,']*|z|x)\d*(?:\/\d*)?|[|:]+/g;
    const tokens = music.match(pattern) || [];
    if (!tokens.length || tokens.length > 256 || music.replace(pattern, '').trim()) throw new Error('Unsupported ABC score');
    const width = 760, rows = Math.ceil(tokens.length / 24), score = svg(width, rows * 130 + 40, headers.T || 'ABC music');
    score.append(namespaced(SVG, 'text', { x: 12, y: 22, 'font-size': 18, fill: 'currentColor' }, headers.T || 'ABC'));
    for (let row = 0; row < rows; row++) {
      const top = row * 130 + 55;
      for (let line = 0; line < 5; line++) score.append(namespaced(SVG, 'line', { x1: 15, y1: top + line * 10, x2: 745, y2: top + line * 10, stroke: 'currentColor' }));
      score.append(namespaced(SVG, 'text', { x: 16, y: top + 35, 'font-size': 40, fill: 'currentColor' }, '𝄞'));
      tokens.slice(row * 24, row * 24 + 24).forEach((token, slot) => {
        const x = 65 + slot * 28;
        if (/^[|:]+$/.test(token)) {
          score.append(namespaced(SVG, 'line', { x1: x, y1: top, x2: x, y2: top + 40, stroke: 'currentColor' })); return;
        }
        if (/^[zx]/.test(token)) { score.append(namespaced(SVG, 'text', { x, y: top + 25, fill: 'currentColor' }, '𝄽')); return; }
        const match = token.match(/^([_^=]*)([A-Ga-g])([,']*)(.*)$/);
        if (match[3].length > 3) throw new Error('ABC pitch outside preview range');
        const degree = 'CDEFGAB'.indexOf(match[2].toUpperCase()) + (match[2] === match[2].toLowerCase() ? 7 : 0)
          + Array.from(match[3]).reduce((sum, mark) => sum + (mark === "'" ? 7 : -7), 0);
        const y = top + 50 - degree * 5;
        for (let ledger = top + 50; ledger <= y; ledger += 10) score.append(namespaced(SVG, 'line', { x1: x - 8, y1: ledger, x2: x + 8, y2: ledger, stroke: 'currentColor' }));
        for (let ledger = top - 10; ledger >= y; ledger -= 10) score.append(namespaced(SVG, 'line', { x1: x - 8, y1: ledger, x2: x + 8, y2: ledger, stroke: 'currentColor' }));
        score.append(namespaced(SVG, 'ellipse', { cx: x, cy: y, rx: 5, ry: 3.5, fill: 'currentColor' }));
        score.append(namespaced(SVG, 'line', { x1: x + 5, y1: y, x2: x + 5, y2: y - 27, stroke: 'currentColor' }));
        if (match[1]) score.append(namespaced(SVG, 'text', { x: x - 15, y: y + 4, fill: 'currentColor' }, match[1].replace(/\^/g, '♯').replace(/_/g, '♭').replace(/=/g, '♮')));
        if (match[4]) score.append(namespaced(SVG, 'text', { x: x - 4, y: top + 75, 'font-size': 10, fill: 'currentColor' }, match[4]));
      });
    }
    return score;
  }
  // Mermaid flowchart subset only. Directives, HTML labels, click handlers and source code are never interpreted.
  function diagramPreview(text) {
    const lines = text.split(/[;\n]/).map(line => line.trim()).filter(line => line && !line.startsWith('%%'));
    if (!/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)$/.test(lines.shift() || '')) throw new Error('Use Mermaid flowchart TD or LR');
    const nodes = new Map(), edges = [];
    const token = '([a-zA-Z][\\w-]*)(?:\\[([^\\]]*)\\]|\\(([^)]*)\\)|\\{([^}]*)\\})?';
    function remember(match, offset) {
      const id = match[offset], label = match[offset + 1] ?? match[offset + 2] ?? match[offset + 3];
      if (!nodes.has(id) || label !== undefined) nodes.set(id, label ?? id);
      return id;
    }
    for (const line of lines) {
      const edge = line.match(new RegExp(`^${token}\\s*(-->|---|-.->|==>)(?:\\|([^|]*)\\|)?\\s*${token}$`));
      if (edge) { edges.push([remember(edge, 1), remember(edge, 7), edge[6] || '']); }
      else {
        const single = line.match(new RegExp(`^${token}$`));
        if (!single) throw new Error('Unsupported Mermaid syntax');
        remember(single, 1);
      }
      if (nodes.size > 60 || edges.length > 100) throw new Error('Diagram too large');
    }
    if (!nodes.size) throw new Error('Empty diagram');
    const result = svg(760, nodes.size * 90 + 20, 'Mermaid flowchart'), positions = new Map();
    Array.from(nodes).forEach(([id], index) => positions.set(id, 25 + index * 90));
    for (const [from, to, label] of edges) {
      const y1 = positions.get(from) + 40, y2 = positions.get(to);
      result.append(namespaced(SVG, 'line', { x1: 380, y1, x2: 380, y2, stroke: 'currentColor' }));
      result.append(namespaced(SVG, 'path', { d: `M 375 ${y2 - 7} L 380 ${y2} L 385 ${y2 - 7}`, fill: 'none', stroke: 'currentColor' }));
      if (label) result.append(namespaced(SVG, 'text', { x: 390, y: (y1 + y2) / 2, fill: 'currentColor' }, label));
    }
    for (const [id, label] of nodes) {
      const y = positions.get(id);
      result.append(namespaced(SVG, 'rect', { x: 180, y, width: 400, height: 40, rx: 6, fill: 'Canvas', stroke: 'currentColor' }));
      result.append(namespaced(SVG, 'text', { x: 380, y: y + 26, 'text-anchor': 'middle', fill: 'currentColor' }, label));
    }
    return result;
  }
  function markdownInline(text, parent) {
    const pattern = /(\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\))/g;
    let position = 0, match;
    while ((match = pattern.exec(text))) {
      parent.append(document.createTextNode(text.slice(position, match.index)));
      if (match[2] || match[3]) parent.append(node('strong', match[2] || match[3]));
      else if (match[4] || match[5]) parent.append(node('em', match[4] || match[5]));
      else if (match[6]) parent.append(node('code', match[6]));
      else if (M.safeURL(match[8])) { const link = node('a', match[7]); link.href = match[8]; parent.append(link); }
      else parent.append(document.createTextNode(match[0]));
      position = pattern.lastIndex;
    }
    parent.append(document.createTextNode(text.slice(position)));
  }
  function markdownPreview(text) {
    const preview = node('div');
    let list = null, fence = null;
    for (const line of text.split('\n')) {
      if (/^```/.test(line)) {
        list = null;
        if (fence) fence = null;
        else { const pre = node('pre'); fence = node('code'); pre.append(fence); preview.append(pre); }
        continue;
      }
      if (fence) { fence.append(document.createTextNode(line + '\n')); continue; }
      const heading = line.match(/^(#{1,6})\s+(.*)$/), item = line.match(/^\s*(?:([-*+])|\d+\.)\s+(.*)$/);
      let element;
      if (item) {
        const kind = item[1] ? 'ul' : 'ol';
        if (!list || list.tagName.toLowerCase() !== kind) { list = node(kind); preview.append(list); }
        element = node('li'); list.append(element); markdownInline(item[2], element);
      } else {
        list = null;
        if (!line.trim()) continue;
        element = node(heading ? `h${heading[1].length}` : /^>\s?/.test(line) ? 'blockquote' : 'p');
        markdownInline(heading ? heading[2] : line.replace(/^>\s?/, ''), element); preview.append(element);
      }
    }
    return preview;
  }
  function render(value) {
    const block = M.normalize({ ...M.empty(), blocks: [value] }).blocks[0];
    const article = node('article');
    article.setAttribute('data-site-editor-block', block.id);
    article.setAttribute('data-site-editor-type', block.type || 'card');
    const heading = node('h3', block.title); heading.setAttribute('data-site-editor-field', 'title'); article.append(heading);
    const type = block.type || 'card';
    if (['image', 'audio', 'video'].includes(type)) {
      if (block.url) {
        const media = node(type === 'image' ? 'img' : type); media.src = block.url;
        if (type === 'image') { media.alt = block.title; media.loading = 'lazy'; }
        else { media.controls = true; media.preload = 'metadata'; }
        article.append(media);
      }
      article.append(bodyText(block));
    } else if (type === 'table') {
      const table = node('table'), body = node('tbody');
      for (const line of block.body.split('\n')) {
        const row = node('tr'); for (const cell of line.split('\t')) row.append(node('td', cell)); body.append(row);
      }
      table.append(body); article.append(table, source(block));
    } else if (type === 'code') {
      const pre = node('pre'), code = node('code', block.body);
      code.setAttribute('data-site-editor-field', 'body');
      if (block.language) code.setAttribute('data-language', block.language);
      pre.append(code); article.append(pre);
    } else if (['math', 'music', 'mermaid', 'markdown'].includes(type)) {
      const preview = node('div'); preview.setAttribute('data-site-editor-preview', type);
      preview.setAttribute('data-site-editor-protected', '');
      try {
        preview.append(({ math: mathPreview, music: musicPreview, mermaid: diagramPreview, markdown: markdownPreview })[type](block.body));
      } catch {
        preview.append(node('p', '無法預覽此語法；原始碼仍完整保留 / Unsupported preview syntax; source preserved.'));
      }
      article.append(preview, source(block));
    } else article.append(bodyText(block));
    if (block.url && !['image', 'audio', 'video'].includes(type)) {
      const link = node('a', block.label || '了解更多'); link.href = block.url; article.append(link);
    }
    return article;
  }
  global.SiteEditorRich = Object.freeze({ render, renderRuns, readRuns, applyStyle });
})(globalThis);
