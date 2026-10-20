const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { spawn } = require('node:child_process');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ URL });
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/site-editor-model.js'), 'utf8'), context);
const M = context.SiteEditorModel;
const plain = value => JSON.parse(JSON.stringify(value));
const block = extra => ({ id: 'block-one', parent: 'main:abc', title: 'Title', body: 'Body', label: '', url: '', ...extra });
function documentWith(extra) { return { ...plain(M.empty()), ...extra }; }

test('v1 round-trips legacy and new structured formats without adding defaults', () => {
  const legacy = documentWith({ blocks: [block({})] });
  assert.deepEqual(plain(M.normalize(legacy)), legacy);
  for (const type of M.BLOCK_TYPES) {
    const doc = documentWith({ blocks: [block({ type, style: 'h2', language: 'javascript',
      rich: [{ text: 'Hello', bold: true, italic: false, underline: true, highlight: true,
        color: '#0aB1f2', script: 'super', href: '/safe' }] })],
    patches: { text1: { rich: [{ text: 'safe', script: 'sub' }], style: 'blockquote' } } });
    assert.deepEqual(plain(M.normalize(doc)), doc);
  }
  assert.equal(M.safeMediaURL('mailto:user@example.org'), null);
  assert.equal(M.safeMediaURL('#anchor'), null);
  assert.equal(M.safeMediaURL('/image.png'), '/image.png');
  assert.equal(M.safeMediaURL('https://example.org/media'), 'https://example.org/media');
});

test('rich schema rejects executable values, unknown keys, nulls, malformed types and oversized input', () => {
  const invalidRuns = [null, {}, [{ text: 'x', html: '<img>' }], [{ text: 'x', style: 'color:red' }],
    [{ text: 'x', color: 'red' }], [{ text: 'x', color: '#ffffff;background:url(x)' }],
    [{ text: 'x', bold: 'true' }], [{ text: 'x', script: 'sup' }], [{ text: 'x', script: null }],
    [{ text: 'x', href: 'javascript:alert(1)' }], [{ text: 'x', href: 'data:text/html,a' }],
    [{ text: 'a'.repeat(6001) }, { text: 'b'.repeat(6000) }], Array.from({ length: 501 }, () => ({ text: '' })),
    [{ text: null }], [{ text: '\u0000' }]];
  for (const rich of invalidRuns) {
    assert.throws(() => M.normalize(documentWith({ patches: { text: { rich } } })));
    assert.throws(() => M.normalize(documentWith({ blocks: [block({ rich })] })));
  }
  for (const extra of [{ type: 'html' }, { type: null }, { language: 'x'.repeat(41) },
    { style: 'script' }, { style: null }, { type: 'image', url: 'data:image/svg+xml,<svg>' },
    { type: 'audio', url: 'blob:https://example.org/id' }, { type: 'video', url: 'mailto:user@example.org' },
    { type: 'image', url: '//evil.example/x' }, { type: 'table', body: 'x\n'.repeat(100) },
    { type: 'table', body: Array(31).fill('x').join('\t') }]) {
    assert.throws(() => M.normalize(documentWith({ blocks: [block(extra)] })), JSON.stringify(extra));
  }
  assert.throws(() => M.normalize(documentWith({ patches: { text: { style: null } } })));
});

test('renderer has no raw HTML or executable source sinks', () => {
  const rich = fs.readFileSync(path.join(root, 'assets/js/site-editor-rich.js'), 'utf8');
  assert.doesNotMatch(rich, /(?:innerHTML|outerHTML|insertAdjacentHTML|DOMParser|eval\s*\(|new Function|createContextualFragment)/);
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202610200002_site_editor_rich.sql'), 'utf8');
  assert.doesNotMatch(sql, /security definer|create policy|alter table|grant (?:all|insert|update|delete)/i);
  assert.match(sql, /create or replace function public.site_editor_valid_document/);
  assert.match(sql, /revoke all on function public.site_editor_valid_runs\(jsonb\) from public, anon/);
});

test('browser: semantic runs, all block previews, literal hostile source and reversible widget-safe patches', {
  skip: !process.env.CHROMIUM_BIN && 'Set CHROMIUM_BIN to exercise actual DOM previews.',
  timeout: 60000
}, async t => {
  const scripts = ['model', 'rich', 'dom'].map(name => `<script>${fs.readFileSync(path.join(root, `assets/js/site-editor-${name}.js`), 'utf8')}</script>`).join('');
  function checks() {
    const expect = (condition, message) => { if (!condition) throw new Error(message); };
    const M = SiteEditorModel, R = SiteEditorRich;
    const main = document.querySelector('main'), mixed = document.querySelector('#mixed');
    const widget = document.querySelector('#widget'), input = widget.querySelector('input');
    const bold = mixed.querySelector('strong'), originalNodes = Array.from(mixed.childNodes);
    let clicks = 0; widget.querySelector('button').addEventListener('click', () => clicks++);
    const baseline = SiteEditorDOM.capture(main), mixedId = [...baseline.nodes].find(([, item]) => item.element === mixed)[0];
    const textId = [...baseline.texts].find(([, item]) => item.element === mixed && item.original.includes('Mixed'))[0];
    const originalText = baseline.texts.get(textId).node;
    const runs = [{ text: 'safe <img onerror=alert(1)>', bold: true, italic: true, underline: true,
      highlight: true, color: '#123456', script: 'super', href: '/safe' }, { text: 'plain' }];
    const holder = document.createElement('div'); holder.append(R.renderRuns(runs));
    expect(holder.querySelector('a strong') && holder.querySelector('sup') && holder.querySelector('mark'), 'semantic formats');
    expect(!holder.querySelector('img'), 'run text treated as text');
    expect(JSON.stringify(R.readRuns(holder)) === JSON.stringify(M.runs(runs)), 'run DOM roundtrip');
    const dirty = document.createElement('div'), bad = document.createElement('a'), script = document.createElement('script');
    bad.setAttribute('href', 'javascript:alert(1)'); bad.textContent = 'plain'; script.textContent = 'alert(1)';
    dirty.append(bad, script); expect(JSON.stringify(R.readRuns(dirty)) === '[{"text":"plain"}]', 'untrusted DOM sanitized');
    const multiline = document.createElement('div'), line = document.createElement('div');
    multiline.append(document.createTextNode('one')); line.textContent = 'two'; multiline.append(line);
    expect(R.readRuns(multiline).map(run => run.text).join('') === 'one\ntwo', 'contenteditable line boundaries retained');
    const native = document.createElement('span');
    native.style.fontWeight = '700'; native.style.fontStyle = 'italic'; native.style.textDecoration = 'underline';
    native.style.backgroundColor = '#fff59d'; native.style.color = '#123456'; native.style.verticalAlign = 'sub';
    native.textContent = 'native';
    const nativeRun = R.readRuns(native)[0];
    expect(nativeRun.bold && nativeRun.italic && nativeRun.underline && nativeRun.highlight && nativeRun.color === '#123456' &&
      nativeRun.script === 'sub', 'native command CSS serialized to safe schema');
    const font = document.createElement('font'); font.setAttribute('color', '#abc'); font.textContent = 'font';
    expect(R.readRuns(font)[0].color === '#aabbcc', 'native FONT color serialized');
    native.style.backgroundColor = 'transparent'; native.style.fontWeight = 'normal'; native.style.fontStyle = 'normal';
    native.style.textDecoration = 'none';
    const cleared = R.readRuns(native)[0];
    expect(!cleared.highlight && !cleared.bold && !cleared.italic && !cleared.underline, 'native command formatting cleared');
    const editable = document.createElement('div'); editable.contentEditable = 'true'; editable.textContent = 'commands'; document.body.append(editable);
    const selection = getSelection(), range = document.createRange();
    range.selectNodeContents(editable); selection.removeAllRanges(); selection.addRange(range);
    for (const [command, value] of [['bold', null], ['italic', null], ['underline', null], ['hiliteColor', '#fff59d'], ['foreColor', '#123456']]) {
      document.execCommand(command, false, value);
    }
    const commanded = R.readRuns(editable)[0];
    expect(commanded.bold && commanded.italic && commanded.underline && commanded.highlight && commanded.color === '#123456',
      'actual browser editing commands retain all supported styles');
    editable.remove(); selection.removeAllRanges();
    const headingRoot = document.createElement('span'), explicitBold = document.createElement('span');
    R.applyStyle(headingRoot, 'h1'); headingRoot.append(document.createTextNode('heading '));
    explicitBold.style.fontWeight = 'bold'; explicitBold.textContent = 'explicit'; headingRoot.append(explicitBold);
    const headingRuns = R.readRuns(headingRoot);
    expect(!headingRuns[0].bold && headingRuns[1].bold, 'heading presentation is not persisted as inline bold');
    R.applyStyle(headingRoot, 'p');
    expect(JSON.stringify(R.readRuns(headingRoot)) === JSON.stringify(headingRuns), 'heading to paragraph retains only explicit inline bold');
    const doc = M.empty();
    doc.patches[textId] = { rich: runs, style: 'h2' };
    const widgetParentId = [...baseline.nodes].find(([, item]) => item.element.id === 'widgets')[0];
    doc.patches[widgetParentId] = { style: 'blockquote' };
    doc.orders[mixedId] = baseline.parents.get(mixedId).ids.slice().reverse();
    baseline.render(doc);
    const wrapper = mixed.querySelector('[data-site-editor-text]');
    expect(wrapper?.getAttribute('data-site-editor-text') === textId, 'text ID wrapper');
    expect(wrapper.textContent === runs.map(run => run.text).join(''), 'rich is authoritative');
    expect(!mixed.textContent.includes('Mixed'), 'no duplicate original text after ordering');
    expect(mixed.querySelector('strong') !== null && bold.isConnected, 'mixed children preserved');
    expect(document.querySelector('#widget') === widget && widget.querySelector('input') === input, 'widget preserved');
    baseline.render(doc); expect(mixed.querySelectorAll('[data-site-editor-text]').length === 1, 'no wrapper accumulation');
    baseline.restore();
    expect(originalNodes.every((child, index) => mixed.childNodes[index] === child), 'exact original child identities restored');
    expect(originalText.nodeValue === 'Mixed ', 'baseline text remains accessible');
    expect(!document.querySelector('#widgets').hasAttribute('style'), 'original style restored');
    widget.querySelector('button').click(); expect(clicks === 1, 'widget handlers preserved');
    const make = extra => ({ id: 'block', parent: baseline.root, title: 'Title', body: 'Body', url: '', label: '', ...extra });
    for (const type of M.BLOCK_TYPES) {
      const element = R.render(make({ type }));
      expect(element.getAttribute('data-site-editor-block') === 'block', `${type} block tag`);
      expect(element.querySelector('[data-site-editor-field=title]'), `${type} title field`);
      expect(element.querySelector('[data-site-editor-field=body]'), `${type} body field`);
    }
    const list = R.render(make({ type: 'paragraph', style: 'ol', rich: [{ text: 'one\ntwo', bold: true }] }));
    expect(list.querySelectorAll('ol li').length === 2 && list.querySelector('li strong'), 'rich list');
    const table = R.render(make({ type: 'table', body: 'a\tb\nc\t<img onerror=x>' }));
    expect(table.querySelectorAll('tr').length === 2 && table.querySelectorAll('td').length === 4, 'table preview');
    expect(!table.querySelector('img') && table.textContent.includes('<img onerror=x>'), 'table literal source');
    const code = R.render(make({ type: 'code', language: 'javascript', body: '<script>alert(1)</' + 'script>' }));
    expect(code.querySelector('code').getAttribute('data-language') === 'javascript' && !code.querySelector('script'), 'code never executes');
    const math = R.render(make({ type: 'math', body: '\\frac{x_1^2}{\\sqrt{\\alpha}}' }));
    expect(math.querySelector('math mfrac') && math.querySelector('msubsup') && math.querySelector('msqrt'), 'actual MathML preview');
    expect(math.querySelector('[data-site-editor-preview-help=math]'), 'math supported subset is explicit');
    const unsupportedMath = R.render(make({ type: 'math', body: '\\sqrt[3]{x}' }));
    expect(!unsupportedMath.querySelector('math') && unsupportedMath.querySelector('[data-site-editor-preview-error=math]'), 'unsupported indexed roots rejected');
    const music = R.render(make({ type: 'music', body: 'X:1\nT:Scale\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |' }));
    expect(music.querySelectorAll('svg ellipse').length === 8 && music.querySelectorAll('svg line').length >= 15, 'actual ABC score');
    expect(music.querySelector('[data-site-editor-preview-help=music]').textContent.includes('Pitch sketch only'), 'music limitations are explicit');
    const unsupportedMusic = R.render(make({ type: 'music', body: 'X:1\nK:G\nC D E F' }));
    expect(!unsupportedMusic.querySelector('svg') && unsupportedMusic.querySelector('[data-site-editor-preview-error=music]'), 'unsupported key rejected instead of wrong signature');
    const mermaid = R.render(make({ type: 'mermaid', body: 'flowchart TD\nA[Start] -->|yes| B[End]' }));
    expect(mermaid.querySelectorAll('svg rect').length === 2 && mermaid.querySelector('svg path'), 'actual Mermaid flowchart');
    const horizontal = R.render(make({ type: 'mermaid', body: 'flowchart RL\nA(Start) -.-> B{End}' }));
    expect(horizontal.querySelector('svg rect').getAttribute('rx') === '20' && horizontal.querySelector('svg polygon') &&
      horizontal.querySelector('svg path[stroke-dasharray="5 4"]'), 'Mermaid direction shapes and dashed edges retained');
    expect(Number(horizontal.querySelector('svg rect').getAttribute('x')) > Number(horizontal.querySelector('svg polygon').getAttribute('points').split(',')[0]),
      'Mermaid RL places first node on right');
    const undirected = R.render(make({ type: 'mermaid', body: 'flowchart LR\nA --- B' }));
    expect(undirected.querySelectorAll('svg path').length === 1, 'undirected Mermaid edge has no arrow');
    const unsupported = R.render(make({ type: 'mermaid', body: 'flowchart TD\nclick A "javascript:alert(1)"' }));
    expect(!unsupported.querySelector('svg') && unsupported.textContent.includes('Unsupported preview'), 'unsupported diagrams fall back');
    const markdown = R.render(make({ type: 'markdown', body: '# Hello\n- **Bold**\n- [Safe](/safe)\n<script>alert(1)</' + 'script>\n[bad](javascript:alert(1))' }));
    expect(markdown.querySelector('h1') && markdown.querySelector('ul li strong'), 'markdown formatting');
    expect(!markdown.querySelector('script') && !markdown.querySelector('a[href^="javascript"]'), 'markdown source non-executable');
    for (const type of ['image', 'audio', 'video']) {
      const media = R.render(make({ type, url: '/media' })).querySelector(type === 'image' ? 'img' : type);
      expect(media.getAttribute('src') === '/media', 'safe media source');
      if (type !== 'image') expect(media.controls && !media.autoplay, 'media requires user playback');
    }
    doc.blocks = [make({ type: 'math', body: 'x^2' })]; baseline.render(doc);
    expect(main.querySelector('[data-site-editor-block=block] math'), 'DOM uses rich block renderer');
    baseline.restore(); expect(!main.querySelector('[data-site-editor-block]'), 'added block removed on restore');
    const cards = document.querySelector('#cards'), originalCards = Array.from(cards.childNodes);
    const cardsId = [...baseline.nodes].find(([, item]) => item.element === cards)[0];
    const aId = [...baseline.nodes].find(([, item]) => item.element.id === 'card-a')[0];
    const bId = [...baseline.nodes].find(([, item]) => item.element.id === 'card-b')[0];
    const mixedOrder = M.empty();
    mixedOrder.blocks = [make({ id: 'added-a', parent: cardsId }), make({ id: 'added-b', parent: cardsId })];
    mixedOrder.orders[cardsId] = ['added-b', bId, 'added-a', aId];
    baseline.render(mixedOrder);
    expect(Array.from(cards.children).map(child => child.getAttribute('data-site-editor-block') || child.id).join(',') ===
      'added-b,card-b,card-widget,added-a,card-a', 'mixed original and added order keeps protected slot');
    mixedOrder.orders[cardsId] = ['added-b', 'added-a', bId, aId];
    baseline.render(mixedOrder);
    expect(Array.from(cards.children).map(child => child.getAttribute('data-site-editor-block') || child.id).join(',') ===
      'added-b,added-a,card-b,card-widget,card-a', 'consecutive added blocks preserve their ranked same-slot order');
    mixedOrder.orders[cardsId] = [bId, 'added-a', 'added-b', aId];
    baseline.render(mixedOrder);
    expect(Array.from(cards.children).map(child => child.getAttribute('data-site-editor-block') || child.id).join(',') ===
      'card-b,card-widget,added-a,added-b,card-a', 'consecutive blocks persist after moving across protected static slots');
    baseline.restore(); expect(originalCards.every((child, index) => cards.childNodes[index] === child), 'mixed ordering restores original nodes');
    const anchors = M.empty();
    anchors.blocks = [make({ id: 'added-c', parent: cardsId }), make({ id: 'added-a', parent: cardsId, before: 'added-b' }),
      make({ id: 'added-b', parent: cardsId, before: 'added-c' })];
    baseline.render(anchors);
    expect(Array.from(cards.querySelectorAll('[data-site-editor-block]')).map(child => child.getAttribute('data-site-editor-block')).join(',') ===
      'added-a,added-b,added-c', 'forward added-block anchor chains resolved');
    baseline.restore();
    return 'all rich browser assertions passed';
  }
  const html = `<!doctype html><meta charset="utf-8"><main><p id="mixed">Mixed <strong>bold</strong> tail</p><section id="widgets"><h2>Widget</h2><form id="widget"><input value="keep"><button type="button">Click</button></form></section><section id="cards"><article id="card-a">A</article><button id="card-widget">Keep</button><article id="card-b">B</article></section></main>
    ${scripts}<script>try { document.body.setAttribute('data-result', (${checks.toString()})()); } catch (error) { document.body.setAttribute('data-result', 'FAIL: ' + error.stack); }</script>`;
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const profile = path.join(root, '.jekyll-cache', `site-editor-rich-${process.pid}`);
  await fsp.mkdir(profile, { recursive: true });
  t.after(() => fsp.rm(profile, { recursive: true, force: true, maxRetries: 5 }));
  const browser = spawn(process.env.CHROMIUM_BIN, ['--headless', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--no-first-run', '--dump-dom', `--user-data-dir=${profile}`,
    `http://127.0.0.1:${server.address().port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (browser.exitCode === null) browser.kill(); });
  let output = '', errors = '';
  browser.stdout.on('data', data => { output += data; });
  browser.stderr.on('data', data => { errors += data; });
  const code = await new Promise((resolve, reject) => { browser.on('exit', resolve); browser.on('error', reject); });
  assert.equal(code, 0, errors);
  assert.match(output, /data-result="all rich browser assertions passed"/, output.match(/data-result="([^"]*)"/)?.[1] || errors);
});
