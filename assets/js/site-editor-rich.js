(function (global) {
  'use strict';
  const M = global.SiteEditorModel;
  const SVG = 'http://www.w3.org/2000/svg', MATH = 'http://www.w3.org/1998/Math/MathML';
  const PREVIEW_HELP = Object.freeze({
    math: 'LaTeX 子集：分數 \\frac、根號 \\sqrt、上下標、希臘字母與常用運算。矩陣、巨集及其他指令不支援 / Supported subset only.',
    music: 'ABC 音高草圖（非完整樂譜）：單聲部 C 大調／A 小調音符、臨時記號、休止及小節線；長度以原始倍數標註，不排版節奏、拍號、速度、反覆或裝飾音 / Pitch sketch only.',
    mermaid: 'Mermaid 子集：flowchart/graph TD、TB、LR、RL、BT；方框、圓角框、菱形，單條 -->、---、-.->、==> 連線及 |標籤|。採簡化線性配置；不支援指令、互動或 HTML / Simplified layout.',
    markdown: 'Markdown 子集：標題、清單、引文、粗斜體、程式碼及安全連結。HTML 保持純文字 / HTML is literal text.'
  });
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
    function hexColor(color) {
      if (!color) return null;
      if (/^#[0-9a-f]{6}$/i.test(color)) return color;
      if (/^#[0-9a-f]{3}$/i.test(color)) return '#' + Array.from(color.slice(1)).map(value => value + value).join('');
      const rgb = color.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*1(?:\.0*)?)?\s*\)$/);
      if (rgb && rgb.slice(1).every(value => Number(value) <= 255)) {
        return '#' + rgb.slice(1).map(value => Number(value).toString(16).padStart(2, '0')).join('');
      }
      return null;
    }
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
      const style = current.style;
      const color = hexColor(style?.color || (tag === 'FONT' ? current.getAttribute('color') : ''));
      if (color) flags.color = color;
      if (style) {
        const presentationRoot = current === element && current.hasAttribute('data-site-editor-style');
        if (style.fontWeight && !presentationRoot) flags.bold = /^(bold|bolder)$/.test(style.fontWeight) || Number(style.fontWeight) >= 600;
        if (style.fontStyle) flags.italic = /^(italic|oblique)/.test(style.fontStyle);
        const decoration = style.textDecorationLine || style.textDecoration;
        if (decoration) flags.underline = decoration.includes('underline');
        if (style.backgroundColor) {
          flags.highlight = style.backgroundColor !== 'transparent' && !/^rgba\([^)]*,\s*0(?:\.0*)?\s*\)$/.test(style.backgroundColor);
        }
        if (['sub', 'super'].includes(style.verticalAlign)) flags.script = style.verticalAlign;
        else if (style.verticalAlign === 'baseline') delete flags.script;
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
      if (!character || /^[}^_$&%#~]$/.test(character)) throw new Error('Incomplete or unsupported formula');
      if (character === '{') return sequence(depth + 1, true);
      if (character === '\\') {
        const command = input.slice(index).match(/^[a-zA-Z]+/)?.[0];
        if (!command) throw new Error('Unsupported LaTeX escape');
        index += command.length;
        if (command === 'frac') {
          const fraction = namespaced(MATH, 'mfrac'); fraction.append(atom(depth + 1), atom(depth + 1)); return fraction;
        }
        if (command === 'sqrt') {
          if (/^\s*\[/.test(input.slice(index))) throw new Error('Indexed roots are not supported');
          const root = namespaced(MATH, 'msqrt'); root.append(atom(depth + 1)); return root;
        }
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
  // Pitch sketch, not a full engraving engine. Unsupported notation is rejected.
  function musicPreview(text) {
    const lines = text.split('\n'), headers = {}, tune = [];
    for (const line of lines) {
      const header = line.match(/^([A-Z]):\s*(.*)$/);
      if (header) {
        if (header[1] === 'V' || (header[1] === 'K' && headers.K)) throw new Error('Multiple ABC voices or key changes are not supported');
        headers[header[1]] = header[2];
      } else tune.push(line.replace(/%.*/, ''));
    }
    if (headers.K && !/^(C(?:maj)?|Am(?:in)?)\s*$/.test(headers.K)) throw new Error('Pitch preview supports only C major or A minor');
    const music = tune.join(' ');
    const pattern = /(?:[_^=]{0,2}[A-Ga-g][,']*|z|x)\d*(?:\/\d*)?|[|:]+/g;
    const tokens = music.match(pattern) || [];
    if (!tokens.length || tokens.length > 256 || music.replace(pattern, '').trim()) throw new Error('Unsupported ABC score');
    const width = 760, rows = Math.ceil(tokens.length / 24), score = svg(width, rows * 130 + 40, headers.T || 'ABC music');
    score.append(namespaced(SVG, 'text', { x: 12, y: 22, 'font-size': 18, fill: 'currentColor' },
      `${headers.T || 'ABC'} — K:${headers.K || 'C'} L:${headers.L || '1/8'} (pitch sketch)`));
    for (let row = 0; row < rows; row++) {
      const top = row * 130 + 55;
      for (let line = 0; line < 5; line++) score.append(namespaced(SVG, 'line', { x1: 15, y1: top + line * 10, x2: 745, y2: top + line * 10, stroke: 'currentColor' }));
      score.append(namespaced(SVG, 'text', { x: 16, y: top + 35, 'font-size': 40, fill: 'currentColor' }, '𝄞'));
      tokens.slice(row * 24, row * 24 + 24).forEach((token, slot) => {
        const x = 65 + slot * 28;
        if (/^[|:]+$/.test(token)) {
          if (!/^\|{1,2}$/.test(token)) throw new Error('ABC repeats are not supported');
          for (let bar = 0; bar < token.length; bar++) {
            score.append(namespaced(SVG, 'line', { x1: x + bar * 3, y1: top, x2: x + bar * 3, y2: top + 40, stroke: 'currentColor' }));
          }
          return;
        }
        if (/^[zx]/.test(token)) {
          score.append(namespaced(SVG, 'text', { x, y: top + 25, fill: 'currentColor' }, token)); return;
        }
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
        score.append(namespaced(SVG, 'text', { x: x - 4, y: top + 75, 'font-size': 10, fill: 'currentColor' }, match[4] || '1'));
      });
    }
    return score;
  }
  // Mermaid flowchart subset only. Directives, HTML labels, click handlers and source code are never interpreted.
  function diagramPreview(text) {
    const lines = text.split(/[;\n]/).map(line => line.trim()).filter(line => line && !line.startsWith('%%'));
    const header = (lines.shift() || '').match(/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)$/);
    if (!header) throw new Error('Use Mermaid flowchart TD, TB, LR, RL or BT');
    const direction = header[2], horizontal = ['LR', 'RL'].includes(direction), reversed = ['RL', 'BT'].includes(direction);
    const nodes = new Map(), edges = [];
    const token = '([a-zA-Z][\\w-]*)(?:\\[([^\\]]*)\\]|\\(([^)]*)\\)|\\{([^}]*)\\})?';
    function remember(match, offset) {
      const id = match[offset], label = match[offset + 1] ?? match[offset + 2] ?? match[offset + 3];
      if (!nodes.has(id) || label !== undefined) nodes.set(id, {
        label: (label ?? id).replace(/^"(.*)"$/, '$1'),
        shape: match[offset + 3] !== undefined ? 'diamond' : match[offset + 2] !== undefined ? 'rounded' : 'square'
      });
      return id;
    }
    for (const line of lines) {
      const edge = line.match(new RegExp(`^${token}\\s*(-->|---|-\\.->|==>)(?:\\|([^|]*)\\|)?\\s*${token}$`));
      if (edge) { edges.push([remember(edge, 1), remember(edge, 7), edge[6] || '', edge[5]]); }
      else {
        const single = line.match(new RegExp(`^${token}$`));
        if (!single) throw new Error('Unsupported Mermaid syntax');
        remember(single, 1);
      }
      if (nodes.size > 60 || edges.length > 100) throw new Error('Diagram too large');
    }
    if (!nodes.size) throw new Error('Empty diagram');
    const width = horizontal ? nodes.size * 240 + 30 : 760, height = horizontal ? 260 : nodes.size * 100 + 30;
    const result = svg(width, height, `Mermaid flowchart ${direction}`), positions = new Map();
    Array.from(nodes).forEach(([id], index) => {
      const slot = reversed ? nodes.size - index - 1 : index;
      positions.set(id, horizontal ? { x: 25 + slot * 240, y: 100 } : { x: 180, y: 25 + slot * 100 });
    });
    edges.forEach(([from, to, label, operator], index) => {
      const start = positions.get(from), end = positions.get(to), forward = horizontal ? end.x > start.x : end.y > start.y;
      let x1, y1, x2, y2, path, arrow;
      if (horizontal) {
        x1 = start.x + (forward ? 170 : 0); y1 = start.y + 25;
        x2 = end.x + (forward ? 0 : 170); y2 = end.y + 25;
        const lane = 35 + (index % 5) * 10, outside = forward ? 12 : -12;
        path = `M ${x1} ${y1} H ${x1 + outside} V ${lane} H ${x2 - outside} V ${y2} H ${x2}`;
        arrow = `M ${x2 - (forward ? 7 : -7)} ${y2 - 5} L ${x2} ${y2} L ${x2 - (forward ? 7 : -7)} ${y2 + 5}`;
      } else {
        x1 = start.x + 200; y1 = start.y + (forward ? 50 : 0);
        x2 = end.x + 200; y2 = end.y + (forward ? 0 : 50);
        const lane = 80 + (index % 5) * 12, outside = forward ? 12 : -12;
        path = `M ${x1} ${y1} V ${y1 + outside} H ${lane} V ${y2 - outside} H ${x2} V ${y2}`;
        arrow = `M ${x2 - 5} ${y2 - (forward ? 7 : -7)} L ${x2} ${y2} L ${x2 + 5} ${y2 - (forward ? 7 : -7)}`;
      }
      result.append(namespaced(SVG, 'path', { d: path, fill: 'none', stroke: 'currentColor',
        'stroke-width': operator === '==>' ? 3 : 1, 'stroke-dasharray': operator === '-.->' ? '5 4' : 'none' }));
      if (operator !== '---') result.append(namespaced(SVG, 'path', { d: arrow, fill: 'none', stroke: 'currentColor' }));
      if (label) result.append(namespaced(SVG, 'text', { x: horizontal ? (x1 + x2) / 2 : 20, y: horizontal ? 25 : (y1 + y2) / 2, fill: 'currentColor' }, label));
    });
    for (const [id, item] of nodes) {
      const { x, y } = positions.get(id), boxWidth = horizontal ? 170 : 400;
      if (item.shape === 'diamond') {
        result.append(namespaced(SVG, 'polygon', { points: `${x + boxWidth / 2},${y} ${x + boxWidth},${y + 25} ${x + boxWidth / 2},${y + 50} ${x},${y + 25}`,
          fill: 'Canvas', stroke: 'currentColor' }));
      } else result.append(namespaced(SVG, 'rect', { x, y, width: boxWidth, height: 50, rx: item.shape === 'rounded' ? 20 : 0, fill: 'Canvas', stroke: 'currentColor' }));
      result.append(namespaced(SVG, 'text', { x: x + boxWidth / 2, y: y + 30, 'text-anchor': 'middle', fill: 'currentColor' }, item.label));
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
    if (['image', 'audio', 'video', 'logo'].includes(type)) {
      if (block.url) {
        const media = node(['image', 'logo'].includes(type) ? 'img' : type); media.src = block.url;
        if (['image', 'logo'].includes(type)) { media.alt = block.alt ?? block.title; media.loading = 'lazy'; }
        else { media.controls = true; media.preload = 'metadata'; }
        if (type === 'logo') media.className = 'site-editor-logo';
        article.append(media);
      }
      article.append(bodyText(block));
    } else if (type === 'button' || type === 'icon') {
      const visual = node(type === 'button' ? (block.url ? 'a' : 'button') : 'span');
      if (type === 'button') {
        visual.className = `site-editor-button site-editor-variant-${block.variant || 'primary'}`;
        if (block.url) visual.href = block.url;
        else { visual.type = 'button'; visual.setAttribute('data-site-editor-static', 'true'); }
        if (block.icon) {
          const glyph = node('span', block.icon); glyph.className = 'material-icons'; glyph.setAttribute('aria-hidden', 'true'); visual.append(glyph);
        }
        const label = node('span', block.label || block.body || '按鈕'); visual.append(label);
      } else {
        visual.className = 'material-icons site-editor-icon'; visual.textContent = block.icon || 'star';
        if (block.label || block.title) { visual.setAttribute('role', 'img'); visual.setAttribute('aria-label', block.label || block.title); }
        else visual.setAttribute('aria-hidden', 'true');
      }
      article.append(visual, bodyText(block));
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
      const help = node('p', PREVIEW_HELP[type]); help.setAttribute('data-site-editor-preview-help', type);
      preview.append(help);
      try {
        preview.append(({ math: mathPreview, music: musicPreview, mermaid: diagramPreview, markdown: markdownPreview })[type](block.body));
      } catch (error) {
        const message = node('p', `無法預覽此語法；原始碼仍完整保留 / Unsupported preview syntax; source preserved. ${error.message}`);
        message.setAttribute('data-site-editor-preview-error', type); preview.append(message);
      }
      article.append(preview, source(block));
    } else article.append(bodyText(block));
    if (block.url && !['image', 'audio', 'video', 'logo', 'button', 'icon'].includes(type)) {
      const link = node('a', block.label || '了解更多'); link.href = block.url; article.append(link);
    }
    return article;
  }
  global.SiteEditorRich = Object.freeze({ render, renderRuns, readRuns, applyStyle });
})(globalThis);
