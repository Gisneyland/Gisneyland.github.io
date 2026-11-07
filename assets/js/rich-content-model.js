(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.RichContentModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const FORMATS = Object.freeze({ text: '純文字', markdown: 'Markdown', html: 'HTML' });
  const FONTS = Object.freeze({
    sans: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif',
    serif: '"Noto Serif TC","PMingLiU",serif',
    kai: '"DFKai-SB","BiauKai","Kaiti TC",serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
  });
  const FONT_LABELS = Object.freeze({ sans: '黑體', serif: '明體', kai: '楷體', mono: '等寬字' });
  const SIZES = Object.freeze({ small: '0.875rem', normal: '1rem', large: '1.25rem', xlarge: '1.75rem', xxlarge: '2.25rem' });
  const SIZE_LABELS = Object.freeze({ small: '小', normal: '標準', large: '大', xlarge: '特大', xxlarge: '超大' });
  const CALLOUTS = Object.freeze({
    NOTE: { tone: 'info', title: '提示' },
    TIP: { tone: 'success', title: '小撇步' },
    WARNING: { tone: 'warning', title: '注意' },
    IMPORTANT: { tone: 'danger', title: '重要' }
  });
  const CHART_TYPES = Object.freeze({ bar: '長條圖', line: '折線圖', pie: '圓餅圖', doughnut: '環圈圖' });
  const MAX_CHART_LABELS = 30;
  const MAX_CHART_SERIES = 6;

  const compact = value => String(value).toLowerCase().replace(/["'\s]/g, '');
  const FONT_VALUES = new Set(Object.values(FONTS).map(compact));

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function unescapeHtml(value) {
    return String(value ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }

  function inRange(text, units) {
    const match = /^(\d+(?:\.\d+)?)(px|rem|em|%)$/.exec(text);
    if (!match) return false;
    const [min, max] = units[match[2]] || [];
    return min !== undefined && Number(match[1]) >= min && Number(match[1]) <= max;
  }

  // 只保留編輯器提供的版面樣式；任何不在白名單內的屬性或數值一律丟棄。
  function safeStyle(style) {
    const kept = [];
    String(style || '').split(';').forEach(declaration => {
      const index = declaration.indexOf(':');
      if (index < 1) return;
      const property = declaration.slice(0, index).trim().toLowerCase();
      const value = declaration.slice(index + 1).trim().toLowerCase();
      let ok = false;
      if (property === 'font-size') ok = inRange(value, { px: [10, 80], rem: [0.6, 5], em: [0.6, 5], '%': [60, 400] });
      else if (property === 'font-family') ok = FONT_VALUES.has(compact(value));
      else if (property === 'color' || property === 'background-color') {
        ok = /^#[0-9a-f]{3,8}$/.test(value) || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/.test(value);
      } else if (property === 'text-align') ok = ['left', 'center', 'right', 'justify'].includes(value);
      else if (property === 'font-weight') ok = /^(normal|bold|[1-9]00)$/.test(value);
      else if (property === 'font-style') ok = ['normal', 'italic'].includes(value);
      else if (property === 'text-decoration') ok = ['none', 'underline', 'line-through', 'underline line-through'].includes(value);
      else if (property === 'line-height') ok = /^(1(\.\d+)?|2(\.\d+)?|3)$/.test(value);
      if (ok) kept.push(`${property}:${value}`);
    });
    return kept.join(';');
  }

  function parseUrl(value) {
    try { return new URL(String(value || '').trim()); } catch { return null; }
  }

  // 影片連結轉成可嵌入的播放器；只接受 https。
  function embedFor(value) {
    const url = parseUrl(value);
    if (!url || url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    const pick = id => (/^[\w-]{11}$/.test(id || '') ? id : '');
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const path = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
      const id = pick(url.searchParams.get('v') || (path && path[1]));
      if (id) return { kind: 'iframe', provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === 'youtu.be') {
      const id = pick(url.pathname.slice(1));
      if (id) return { kind: 'iframe', provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const match = url.pathname.match(/^\/(?:video\/)?(\d{5,12})/);
      if (match) return { kind: 'iframe', provider: 'Vimeo', src: `https://player.vimeo.com/video/${match[1]}` };
    }
    if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return { kind: 'video', provider: '影片檔', src: url.href };
    return null;
  }

  function siteEmbedUrl(value) {
    const url = parseUrl(value);
    return url && url.protocol === 'https:' ? url.href : '';
  }

  // ---------- Markdown ----------
  const BLOCK_TAGS = /^<\/?(div|figure|figcaption|table|thead|tbody|tr|th|td|iframe|details|summary|video|audio|section|p|h[1-6]|ul|ol|li|pre|blockquote|hr|img)\b/i;

  function inline(text) {
    const stash = [];
    const hold = html => `\u0000${stash.push(html) - 1}\u0000`;
    let out = String(text)
      .replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`))
      .replace(/<\/?[a-zA-Z][^<>]*>/g, tag => hold(tag));
    out = escapeHtml(out)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, title) => `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''}>`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])__(.+?)__(?=$|[\s).,;:!?])/g, '$1<strong>$2</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/\*(?!\s)(.+?)\*/g, '<em>$1</em>')
      .replace(/(^|[\s(])_(?!\s)(.+?)_(?=$|[\s).,;:!?])/g, '$1<em>$2</em>');
    return out.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[Number(index)]);
  }

  function splitRow(line) {
    const trimmed = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
    return trimmed.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
  }

  const isSeparator = line => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-');

  function tableHtml(lines) {
    const head = splitRow(lines[0]);
    const aligns = splitRow(lines[1]).map(cell => (/^:-+:$/.test(cell) ? 'center' : /^-+:$/.test(cell) ? 'right' : /^:-+$/.test(cell) ? 'left' : ''));
    const cell = (tag, text, index) => `<${tag}${aligns[index] ? ` style="text-align:${aligns[index]}"` : ''}>${inline(text)}</${tag}>`;
    const rows = lines.slice(2).map(line => `<tr>${head.map((_, index) => cell('td', splitRow(line)[index] || '', index)).join('')}</tr>`);
    return `<table><thead><tr>${head.map((text, index) => cell('th', text, index)).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }

  function listHtml(items) {
    let index = 0;
    const build = indent => {
      const tag = items[index].ordered ? 'ol' : 'ul';
      let html = '';
      while (index < items.length && items[index].indent === indent) {
        const item = items[index];
        index += 1;
        let content = inline(item.text);
        if (index < items.length && items[index].indent > indent) content += build(items[index].indent);
        html += `<li>${content}</li>`;
      }
      return `<${tag}>${html}</${tag}>`;
    };
    let html = '';
    while (index < items.length) html += build(items[index].indent);
    return html;
  }

  const LIST_LINE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

  function startsBlock(line, next) {
    return /^```/.test(line) || /^#{1,6}\s/.test(line) || /^>/.test(line) || LIST_LINE.test(line)
      || /^\s*([-*_])\1{2,}\s*$/.test(line) || BLOCK_TAGS.test(line.trim())
      || (line.includes('|') && next !== undefined && isSeparator(next));
  }

  function markdownToHtml(source, depth = 0) {
    const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i += 1; continue; }

      const fence = /^```\s*([\w-]*)/.exec(line);
      if (fence) {
        const body = [];
        i += 1;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { body.push(lines[i]); i += 1; }
        i += 1;
        const text = body.join('\n');
        const lang = fence[1].toLowerCase();
        if (lang === 'mermaid') out.push(`<pre class="rc-mermaid">${escapeHtml(text)}</pre>`);
        else if (lang === 'chart') out.push(`<div class="rc-chart" data-chart="${escapeHtml(text)}"></div>`);
        else out.push(`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(text)}</code></pre>`);
        continue;
      }

      if (BLOCK_TAGS.test(line.trim())) {
        const block = [];
        while (i < lines.length && lines[i].trim()) { block.push(lines[i]); i += 1; }
        out.push(block.join('\n'));
        continue;
      }

      const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (heading) { out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); i += 1; continue; }

      if (/^\s*([-*_])\1{2,}\s*$/.test(line) && !LIST_LINE.test(line)) { out.push('<hr>'); i += 1; continue; }

      if (/^>/.test(line)) {
        const quote = [];
        while (i < lines.length && /^>/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, '')); i += 1; }
        const callout = depth < 3 && /^\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*$/i.exec(quote[0]);
        if (callout) {
          const kind = CALLOUTS[callout[1].toUpperCase()];
          out.push(`<div class="rc-callout rc-callout-${kind.tone}"><strong class="rc-callout-title">${kind.title}</strong>${markdownToHtml(quote.slice(1).join('\n'), depth + 1)}</div>`);
        } else {
          out.push(`<blockquote>${depth < 3 ? markdownToHtml(quote.join('\n'), depth + 1) : inline(quote.join(' '))}</blockquote>`);
        }
        continue;
      }

      if (line.includes('|') && i + 1 < lines.length && isSeparator(lines[i + 1])) {
        const rows = [line, lines[i + 1]];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) { rows.push(lines[i]); i += 1; }
        out.push(tableHtml(rows));
        continue;
      }

      if (LIST_LINE.test(line)) {
        const items = [];
        while (i < lines.length && LIST_LINE.test(lines[i])) {
          const match = LIST_LINE.exec(lines[i]);
          items.push({ indent: match[1].replace(/\t/g, '  ').length, ordered: /\d/.test(match[2]), text: match[3] });
          i += 1;
        }
        out.push(listHtml(items));
        continue;
      }

      const paragraph = [];
      while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !startsBlock(lines[i], lines[i + 1]))) {
        paragraph.push(lines[i].replace(/\s{2,}$/, ''));
        i += 1;
      }
      out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    }
    return out.join('\n');
  }

  function toHtml(body, format) {
    if (format === 'markdown') return markdownToHtml(body);
    if (format === 'html') return String(body || '');
    return `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`;
  }

  function toPlainText(body, format) {
    const text = String(body || '');
    if (format !== 'markdown' && format !== 'html') return text;
    return unescapeHtml(text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s*(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
      .replace(/[*_~`|]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n'))
      .trim();
  }

  // ---------- 表格 ----------
  const cleanCell = value => String(value ?? '').replace(/\r?\n/g, ' ').trim();

  function buildMarkdownTable(rows) {
    const width = Math.max(1, ...rows.map(row => row.length));
    const pad = row => Array.from({ length: width }, (_, index) => cleanCell(row[index]).replace(/\|/g, '\\|'));
    const line = row => `| ${pad(row).join(' | ')} |`;
    return [line(rows[0] || []), `| ${Array(width).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
  }

  function buildHtmlTable(rows, header = true) {
    const cells = (row, tag) => row.map(cell => `<${tag}>${escapeHtml(cleanCell(cell))}</${tag}>`).join('');
    const body = (header ? rows.slice(1) : rows).map(row => `<tr>${cells(row, 'td')}</tr>`).join('');
    return `<table>${header && rows.length ? `<thead><tr>${cells(rows[0], 'th')}</tr></thead>` : ''}<tbody>${body}</tbody></table>`;
  }

  function parseMarkdownTable(text) {
    const lines = String(text).split('\n').filter(line => line.trim());
    if (lines.length < 2 || !isSeparator(lines[1])) return null;
    return { rows: [lines[0], ...lines.slice(2)].map(splitRow), header: true };
  }

  function parseHtmlTable(html) {
    const rows = [];
    let header = false;
    String(html).replace(/<tr[\s>][\s\S]*?<\/tr>/gi, row => {
      const cells = [];
      row.replace(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, tag, content) => {
        if (!rows.length && tag.toLowerCase() === 'th') header = true;
        cells.push(unescapeHtml(content.replace(/<[^>]+>/g, '')).trim());
        return '';
      });
      if (cells.length) rows.push(cells);
      return '';
    });
    return rows.length ? { rows, header } : null;
  }

  // 找出游標所在的表格（Markdown 或 HTML），回傳其範圍與格式
  function locateTable(text, caret) {
    const before = text.slice(0, caret);
    const open = before.toLowerCase().lastIndexOf('<table');
    if (open >= 0) {
      const closeTag = text.toLowerCase().indexOf('</table>', open);
      if (closeTag >= 0 && closeTag + 8 >= caret) return { start: open, end: closeTag + 8, kind: 'html' };
    }
    const lines = text.split('\n');
    let offset = 0;
    let row = 0;
    for (; row < lines.length; row += 1) {
      if (caret <= offset + lines[row].length) break;
      offset += lines[row].length + 1;
    }
    if (row >= lines.length || !lines[row].includes('|')) return null;
    let first = row;
    let last = row;
    while (first > 0 && lines[first - 1].includes('|')) first -= 1;
    while (last < lines.length - 1 && lines[last + 1].includes('|')) last += 1;
    if (last - first < 1 || !isSeparator(lines[first + 1])) return null;
    const start = lines.slice(0, first).reduce((sum, line) => sum + line.length + 1, 0);
    const end = start + lines.slice(first, last + 1).join('\n').length;
    return { start, end, kind: 'markdown' };
  }

  // ---------- 圖表（內建 SVG，不載入外部函式庫） ----------
  const PALETTE = ['#2b7a78', '#e07a5f', '#3d5a80', '#f2cc8f', '#81b29a', '#9b5de5'];

  function parseChart(input) {
    let spec = input;
    if (typeof input === 'string') {
      try { spec = JSON.parse(input); } catch { return null; }
    }
    if (!spec || typeof spec !== 'object' || !CHART_TYPES[spec.type]) return null;
    const labels = (Array.isArray(spec.labels) ? spec.labels : []).slice(0, MAX_CHART_LABELS).map(label => String(label).slice(0, 40));
    const datasets = (Array.isArray(spec.datasets) ? spec.datasets : []).slice(0, MAX_CHART_SERIES).map(set => ({
      label: String(set?.label ?? '').slice(0, 40),
      data: labels.map((_, index) => {
        const value = Number(set?.data?.[index]);
        return Number.isFinite(value) ? value : 0;
      })
    }));
    if (!labels.length || !datasets.length) return null;
    return { type: spec.type, title: String(spec.title ?? '').slice(0, 80), labels, datasets };
  }

  const number = value => (Math.round(value * 100) / 100).toString();

  function niceMax(value) {
    if (value <= 0) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 5, 10].find(factor => factor * power >= value);
    return step * power;
  }

  function chartSvg(input) {
    const chart = parseChart(input);
    if (!chart) return '';
    const width = 640;
    const height = 360;
    const label = chart.title || CHART_TYPES[chart.type];
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="rc-chart-svg" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title>`];
    const text = (x, y, content, extra = '') => `<text x="${number(x)}" y="${number(y)}" fill="currentColor" font-size="12" ${extra}>${escapeHtml(content)}</text>`;
    if (chart.title) parts.push(text(width / 2, 22, chart.title, 'text-anchor="middle" font-size="15" font-weight="700"'));
    const top = chart.title ? 40 : 16;

    if (chart.type === 'pie' || chart.type === 'doughnut') {
      const values = chart.datasets[0].data.map(value => Math.max(0, value));
      const total = values.reduce((sum, value) => sum + value, 0);
      const cx = 190;
      const cy = top + (height - top) / 2 - 6;
      const radius = Math.min(130, (height - top) / 2 - 12);
      let angle = -Math.PI / 2;
      values.forEach((value, index) => {
        if (!total || !value) return;
        const sweep = (value / total) * Math.PI * 2;
        const color = PALETTE[index % PALETTE.length];
        if (value === total) parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}"/>`);
        else {
          const end = angle + sweep;
          const arc = `M ${number(cx)} ${number(cy)} L ${number(cx + radius * Math.cos(angle))} ${number(cy + radius * Math.sin(angle))} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${number(cx + radius * Math.cos(end))} ${number(cy + radius * Math.sin(end))} Z`;
          parts.push(`<path d="${arc}" fill="${color}" stroke="Canvas" stroke-width="1"/>`);
        }
        angle += sweep;
      });
      if (chart.type === 'doughnut') parts.push(`<circle cx="${cx}" cy="${cy}" r="${number(radius * 0.55)}" fill="Canvas"/>`);
      chart.labels.forEach((name, index) => {
        const y = top + 14 + index * 20;
        parts.push(`<rect x="370" y="${y - 10}" width="12" height="12" fill="${PALETTE[index % PALETTE.length]}"/>`);
        parts.push(text(390, y, `${name}（${number(values[index])}${total ? `，${number((values[index] / total) * 100)}%` : ''}）`));
      });
      return `${parts.join('')}</svg>`;
    }

    const left = 52;
    const right = width - 16;
    const legendHeight = chart.datasets.length > 1 ? 24 : 0;
    const bottom = height - 40 - legendHeight;
    const plotTop = top + 8;
    const max = niceMax(Math.max(0, ...chart.datasets.flatMap(set => set.data)));
    const min = Math.min(0, ...chart.datasets.flatMap(set => set.data));
    const lower = min < 0 ? -niceMax(-min) : 0;
    const scaleY = value => bottom - ((value - lower) / (max - lower)) * (bottom - plotTop);
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = lower + ((max - lower) * tick) / 4;
      const y = scaleY(value);
      parts.push(`<line x1="${left}" x2="${right}" y1="${number(y)}" y2="${number(y)}" stroke="currentColor" stroke-opacity="0.2"/>`);
      parts.push(text(left - 6, y + 4, number(value), 'text-anchor="end"'));
    }
    const slot = (right - left) / chart.labels.length;
    chart.labels.forEach((name, index) => {
      const x = left + slot * index + slot / 2;
      const short = chart.labels.length > 10 ? name.slice(0, 4) : name.slice(0, 10);
      parts.push(text(x, bottom + 16, short, 'text-anchor="middle"'));
    });
    if (chart.type === 'bar') {
      const group = slot * 0.7;
      const barWidth = group / chart.datasets.length;
      chart.datasets.forEach((set, series) => {
        set.data.forEach((value, index) => {
          const x = left + slot * index + (slot - group) / 2 + barWidth * series;
          const y = scaleY(Math.max(value, 0));
          parts.push(`<rect x="${number(x)}" y="${number(y)}" width="${number(Math.max(barWidth - 2, 1))}" height="${number(Math.abs(scaleY(value) - scaleY(0)))}" fill="${PALETTE[series % PALETTE.length]}"><title>${escapeHtml(`${chart.labels[index]}：${number(value)}`)}</title></rect>`);
        });
      });
    } else {
      chart.datasets.forEach((set, series) => {
        const color = PALETTE[series % PALETTE.length];
        const points = set.data.map((value, index) => [left + slot * index + slot / 2, scaleY(value)]);
        parts.push(`<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${points.map(point => `${number(point[0])},${number(point[1])}`).join(' ')}"/>`);
        points.forEach((point, index) => parts.push(`<circle cx="${number(point[0])}" cy="${number(point[1])}" r="3.5" fill="${color}"><title>${escapeHtml(`${chart.labels[index]}：${number(set.data[index])}`)}</title></circle>`));
      });
    }
    parts.push(`<line x1="${left}" x2="${right}" y1="${number(scaleY(0))}" y2="${number(scaleY(0))}" stroke="currentColor"/>`);
    if (legendHeight) {
      chart.datasets.forEach((set, index) => {
        const x = left + index * 130;
        parts.push(`<rect x="${x}" y="${height - 20}" width="12" height="12" fill="${PALETTE[index % PALETTE.length]}"/>`);
        parts.push(text(x + 18, height - 10, set.label || `系列 ${index + 1}`));
      });
    }
    return `${parts.join('')}</svg>`;
  }

  return {
    FORMATS, FONTS, FONT_LABELS, SIZES, SIZE_LABELS, CALLOUTS, CHART_TYPES, MAX_CHART_LABELS, MAX_CHART_SERIES,
    escapeHtml, unescapeHtml, safeStyle, embedFor, siteEmbedUrl, markdownToHtml, toHtml, toPlainText,
    buildMarkdownTable, buildHtmlTable, parseMarkdownTable, parseHtmlTable, locateTable, parseChart, chartSvg
  };
});
