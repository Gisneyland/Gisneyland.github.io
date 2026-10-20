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

test('editor denies screeners, unapproved admins and missing privacy consent', () => {
  const approved = { account_role: 'administrator', approval_status: 'approved', privacy_consent_at: '2026-10-20' };
  assert.equal(M.administrator(approved), true);
  for (const invalid of [null, {}, { ...approved, account_role: 'screener' },
    { ...approved, approval_status: 'pending' }, { ...approved, privacy_consent_at: null }]) {
    assert.equal(M.administrator(invalid), false);
  }
});

test('existing public directory and HTML routes are editable without allowing dot-segment or admin aliases', () => {
  for (const route of ['/', '/about/', '/404.html', '/nested/page.html']) assert.equal(M.publicPage(route), true, route);
  for (const route of ['/admin/', '/admin', '/../404.html', '/a/./b/', '/a/../b/', '//example.org/',
    '/a//b/', '/%2e%2e/', 'https://example.org/']) assert.equal(M.publicPage(route), false, route);
});

test('editor URL allowlist rejects executable, encoded control and credential URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', '//host.test', '\\evil.test', 'https:host.test',
    'https://host.test/a\nb', ' https://host.test', 'ftp://host.test', 'java\tscript:alert(1)',
    'https:/example.org/']) {
    assert.equal(M.safeURL(url), null, url);
  }
  for (const url of ['/', '/news/', '#target', '?page=2', 'https://example.org/', 'mailto:team@example.org', 'tel:0800010569']) {
    assert.equal(M.safeURL(url), url);
  }
  const credentials = new URL('https://example.org/');
  credentials.username = 'fixture';
  assert.equal(M.safeURL(credentials.href), null);
});

test('structured model supports existing edits, nested ordering, added blocks and both navigation groups', () => {
  const doc = plain(M.empty());
  doc.patches['main/1/t0:abc'] = { text: '<script>literal text, never HTML</script>' };
  doc.patches['id:card:abc'] = { href: '/news/', deleted: true };
  doc.orders['main/1:abc'] = ['main/1/2:abc', 'main/1/0:abc'];
  doc.blocks = [{ id: 'block-a', parent: 'main:abc', before: 'main/1:abc', title: 'New', body: 'Line 1\nLine 2', url: '/news/', label: 'News' }];
  doc.navigation = { main: [{ id: 'one', label: 'Home', url: '/' }], more: [] };
  assert.deepEqual(plain(M.normalize(doc)), doc);
  assert.equal(M.fingerprint('static text'), M.fingerprint('static text'));
  assert.notEqual(M.fingerprint('static text'), M.fingerprint('changed text'));
});

test('structured model rejects HTML fields, prototype keys, duplicate IDs, invalid URLs and unbounded data', () => {
  const doc = plain(M.empty());
  const bad = [
    { ...doc, html: '<img onerror=alert(1)>' },
    { ...doc, patches: { a: { innerHTML: '<script>' } } },
    { ...doc, patches: JSON.parse('{"__proto__":{"text":"bad"}}') },
    { ...doc, patches: { a: { href: 'javascript:alert(1)' } } },
    { ...doc, patches: { a: { text: 'x'.repeat(12001) } } },
    { ...doc, orders: { a: ['b', 'b'] } },
    { ...doc, navigation: { main: [{ id: 'a', label: 'A', url: '/' }], more: [{ id: 'a', label: 'B', url: '/' }] } },
    { ...doc, blocks: [{ id: 'x', parent: 'main', title: 'A', body: 'B', label: 'L', url: 'data:text/html,x' }] }
  ];
  for (const value of bad) assert.throws(() => M.normalize(value));
});

test('deployment contracts separate public data, RPC-only writes, auth checks and pre-runtime baseline capture', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202610200001_site_editor.sql'), 'utf8');
  assert.match(sql, /site_editor_drafts enable row level security/);
  assert.match(sql, /site_editor_publications enable row level security/);
  assert.match(sql, /for select to anon, authenticated using \(true\)/);
  assert.match(sql, /for select to authenticated\s+using \(public.is_site_editor_administrator\(\)\)/);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete|all).*to (?:anon|authenticated)/i);
  assert.equal((sql.match(/if not public.is_site_editor_administrator\(\)/g) || []).length, 2);
  assert.match(sql, /security definer set search_path = pg_catalog, public/g);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /expected_navigation_revision is distinct from/);
  const layout = fs.readFileSync(path.join(root, '_layouts/default.html'), 'utf8');
  assert.ok(layout.indexOf('site-editor.js') < layout.indexOf('i18n.js'));
  assert.ok(layout.indexOf('site-editor.js') < layout.indexOf("'/assets/js/content.js'"));
  const controller = fs.readFileSync(path.join(root, 'assets/js/site-editor.js'), 'utf8');
  const dom = fs.readFileSync(path.join(root, 'assets/js/site-editor-dom.js'), 'utf8');
  assert.doesNotMatch(controller + dom, /\.(?:innerHTML|outerHTML)\s*=|localStorage|sessionStorage/);
  assert.match(controller, /token === generation/);
  assert.match(controller, /onAuthStateChange/);
});

test('browser: static CRUD/order, nested cards, safe blocks/navigation, private preview, auth races and widget preservation', {
  skip: !process.env.CHROMIUM_BIN && 'Set CHROMIUM_BIN to run browser editor regression.',
  timeout: 60000
}, async t => {
  const editor = fs.readFileSync(path.join(root, '_includes/site-editor.html'), 'utf8')
    .replace(/{%[\s\S]*?%}/g, '').replace(/<option value="{{[\s\S]*?<\/option>/g, '');
  const tools = fs.readFileSync(path.join(root, '_includes/tools.html'), 'utf8')
    .replace(/\{\{[\s\S]*?\}\}/g, '/admin/');
  const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/site-editor.css"></head><body data-site-editor-page="/" data-site-editor-url="/">
    ${tools}
    <main id="main-content">
      <section id="intro"><h1>Original heading</h1><p id="mixed">Mixed <strong>bold</strong> tail</p><a href="/old/">Original link</a><p id="translated" data-i18n="fixture">Original translated text</p></section>
      <section id="cards"><div class="info-grid"><article id="card-a" class="detail-card"><h3>Card A</h3><p>A body</p></article><article id="card-b" class="detail-card"><h3>Card B</h3><p>B body</p></article></div></section>
      <section id="widgets"><h2>Widget heading</h2><form><input id="secret" value=""><button id="widget-button" type="button">Widget</button></form><div data-managed-news><p>Static feed fallback</p></div><div id="activity-calendar"></div></section>
    </main>
    <div class="site-navigation"><div id="navigation-more-menu" hidden><a href="/about/"><i class="material-icons">info</i>About</a><button data-scroll-to-top>Top</button></div><nav class="bottom-nav"><a href="/"><span>Home</span></a><button id="navigation-more-button">More</button></nav></div>
    ${editor}
    <script src="/assets/js/site-editor-model.js"></script><script src="/assets/js/site-editor-rich.js"></script>
    <script src="/assets/js/site-editor-dom.js"></script><script src="/assets/js/site-editor-inline.js"></script>
    <script>window.renderCount=0;window.originalEditorDOM=SiteEditorDOM;window.SiteEditorDOM={capture(...args){const captured=originalEditorDOM.capture(...args);window.fixtureBaseline=captured;const render=captured.render;captured.render=(...values)=>{renderCount++;return render(...values)};return captured}};</script>
    <script src="/assets/js/site-editor.js"></script>
    <script>document.addEventListener('DOMContentLoaded',()=>{ window.originalInput=document.getElementById('secret'); window.originalWidget=document.getElementById('widget-button'); window.clicks=0; originalWidget.addEventListener('click',()=>clicks++); document.querySelector('[data-managed-news]').textContent='Live feed';document.getElementById('translated').replaceChildren(document.createTextNode('Runtime translation')); });</script>
    </body></html>`;
  const server = http.createServer(async (request, response) => {
    if (!request.url.startsWith('/assets/')) { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fixture); return; }
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      assert.match(pathname, /^\/assets\/(?:js\/site-editor[-a-z]*\.js|css\/site-editor\.css)$/);
      response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
      response.end(await fsp.readFile(path.join(root, pathname)));
    } catch { response.writeHead(404).end(); }
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profileDirectory = path.join(root, '.jekyll-cache', `site-editor-browser-${process.pid}`);
  await fsp.mkdir(profileDirectory, { recursive: true });
  t.after(() => fsp.rm(profileDirectory, { recursive: true, force: true, maxRetries: 5 }));
  const browser = spawn(process.env.CHROMIUM_BIN, ['--headless', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profileDirectory}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  t.after(async () => {
    if (browser.exitCode !== null) return;
    const exited = new Promise(resolve => browser.once('exit', resolve)); browser.kill(); await exited;
  });
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Chromium startup timed out:\n${output}`)), 20000);
    browser.stderr.on('data', data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(new URL(match[1]).origin.replace('ws:', 'http:')); }
    });
    browser.once('error', reject);
    browser.once('exit', (code, signal) => {
      clearTimeout(timer); reject(new Error(`Chromium exited before debugger startup (${code || signal}):\n${output}`));
    });
  });
  const targets = await (await fetch(`${endpoint}/json`)).json();
  const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  t.after(() => socket.close());
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const waiter = pending.get(message.id); pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++sequence, { resolve, reject }); socket.send(JSON.stringify({ id: sequence, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, result.exceptionDetails?.exception?.description);
    return result.result.value;
  };
  const wait = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.fail(`Timed out: ${expression}\n${await evaluate(`JSON.stringify({status:document.getElementById('site-editor-status')?.textContent,title:document.querySelector('h1')?.textContent,mode:window.fixtureMode, fixtureError:window.fixtureError})`)}\n${errors.join('\n')}`);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.fixtureMode = new URLSearchParams(location.search).get('mode') || 'admin';
    window.confirm = () => true;
    window.rpcCalls = [];
    window.draftResolvers = [];
    window.profileReads = 0;
    window.fixtureRole = null;
    window.saved = {};
    window.storageUploads = [];
    window.session = fixtureMode === 'public' ? null : {user:{id:'fixture-admin'}};
    window.questionnaireSupabase = {
      auth: { getSession: async()=>({data:{session}}), onAuthStateChange(callback){ window.authChange=callback; return {}; } },
      storage: { from(bucket) { return {
        async upload(name,file,options) {
          storageUploads.push({bucket,name,type:file.type,size:file.size,options});
          return {data:{path:name},error:null};
        },
        getPublicUrl(name) { return {data:{publicUrl:'https://media.example.org/'+name}}; }
      }; } },
      from(table) {
        let key;
        return { select(){return this}, eq(field,value){key=value;return this},
          async maybeSingle(){
            if(table==='admin_profiles'){profileReads++;return {data:{account_role:fixtureRole||(fixtureMode==='screener'?'screener':'administrator'),approval_status:fixtureMode==='pending'?'pending':'approved',privacy_consent_at:fixtureMode==='no-consent'?null:'2026-10-20'}}};
            if(fixtureMode==='missing') return {error:{message:'relation site_editor_drafts does not exist'}};
            if(table==='site_editor_drafts' && fixtureMode==='race') await new Promise(resolve=>{draftResolvers.push(resolve);window.resolveDraft=()=>draftResolvers.splice(0).forEach(fn=>fn())});
            if(table==='site_editor_publications' && fixtureMode==='public' && key==='/'){
              const capture=SiteEditorDOM.capture(document.getElementById('main-content'),null);
              const id=Array.from(capture.texts).find(([,item])=>item.original==='Original heading')[0];
              const doc=SiteEditorModel.empty(); doc.patches[id]={text:'Published anonymous heading'};
              return {data:{document:doc,revision:1}};
            }
            return {data:table==='site_editor_drafts'?saved[key]||null:null};
          }
        };
      },
      async rpc(name,args) {
        rpcCalls.push({name,args});
        if(name==='save_site_editor_drafts'){
          saved[args.target_page]={document:args.page_document,revision:args.expected_page_revision+1};
          saved['@navigation']={document:args.navigation_document,revision:args.expected_navigation_revision+1};
          return {data:{page_revision:args.expected_page_revision+1,navigation_revision:args.expected_navigation_revision+1}};
        }
        return {data:null,error:null};
      }
    };
  ` });
  await send('Page.navigate', { url: origin });
  await wait(`document.getElementById('site-editor-button')?.hidden===false`);
  assert.equal(await evaluate(`renderCount`), 0, 'Empty publications/auth initialization must not render a baseline overlay');
  assert.deepEqual(await evaluate(`(()=>{
    const main=document.getElementById('main-content');
    const capture=SiteEditorDOM.capture(main,document.querySelector('.site-navigation'));
    const before=Array.from(document.querySelector('#intro p').childNodes);
    const observer=new MutationObserver(()=>{});observer.observe(main,{childList:true,subtree:true,characterData:true});
    capture.render(SiteEditorModel.empty(),SiteEditorModel.empty());
    const mutations=observer.takeRecords().length;observer.disconnect();
    let rejected=false;
    try{capture.render(SiteEditorModel.empty(),{...SiteEditorModel.empty(),navigation:{main:[{id:'bad',label:'Bad',url:'javascript:alert(1)'}],more:[]}})}catch{rejected=true}
    return {mutations,rejected,same:before.every((node,index)=>node===document.querySelector('#intro p').childNodes[index]),text:document.querySelector('#intro p').textContent};
  })()`), { mutations: 0, rejected: true, same: true, text: 'Mixed bold tail' });
  await evaluate(`document.getElementById('site-editor-button').click()`);
  await wait(`document.getElementById('site-editor-status').textContent.includes('私人草稿已載入')`);
  assert.equal(await evaluate(`Array.from(document.getElementById('site-editor-text').options).some(o=>o.text.includes('Static feed')||o.text.includes('Widget'))`), true); // Static widget section heading remains editable.
  assert.equal(await evaluate(`Array.from(document.getElementById('site-editor-text').options).some(o=>o.text.includes('Static feed')||o.text==='BUTTON: Widget')`), false);
  await evaluate(`{
    const s=document.getElementById('site-editor-node');s.value=Array.from(s.options).find(o=>o.text.includes('section widgets')).value;s.dispatchEvent(new Event('change'));
  }`);
  assert.equal(await evaluate(`document.getElementById('site-editor-node-up').disabled && document.getElementById('site-editor-node-down').disabled && document.getElementById('site-editor-node-delete').disabled`), true);
  await evaluate(`
    document.getElementById('secret').value='PRIVATE HEALTH ANSWER';
    window.selectOption=(id,match)=>{const s=document.getElementById('site-editor-'+id);s.value=Array.from(s.options).find(o=>o.text.includes(match)).value;s.dispatchEvent(new Event('change'))};
    selectOption('text','Original heading');
    document.getElementById('site-editor-text-value').value='Edited <img src=x onerror=alert(1)>';
    document.getElementById('site-editor-text-apply').click();
    selectOption('text','Original translated text');document.getElementById('site-editor-text-value').value='Edited translated text';document.getElementById('site-editor-text-apply').click();
    selectOption('link','Original link');document.getElementById('site-editor-link-value').value='javascript:alert(1)';document.getElementById('site-editor-link-apply').click();
  `);
  assert.match(await evaluate(`document.getElementById('site-editor-status').textContent`), /連結僅限/);
  await evaluate(`
    document.getElementById('site-editor-link-value').value='/news/';document.getElementById('site-editor-link-apply').click();
    const s=document.getElementById('site-editor-node');s.value=Array.from(s.options).find(o=>o.text.includes('article card-b')).value;s.dispatchEvent(new Event('change'));document.getElementById('site-editor-node-up').click();
    const p=document.getElementById('site-editor-parent');p.value=Array.from(fixtureBaseline.parents).find(([,item])=>item.element===document.querySelector('.info-grid'))[0];p.dispatchEvent(new Event('change'));
    selectOption('before','article card-a');
    document.getElementById('site-editor-block-title').value='Added card';document.getElementById('site-editor-block-body').value='Safe new body';document.getElementById('site-editor-block-apply').click();
    document.getElementById('site-editor-block').value='';document.getElementById('site-editor-block').dispatchEvent(new Event('change'));
    p.value=Array.from(fixtureBaseline.parents).find(([,item])=>item.element===document.querySelector('.info-grid'))[0];p.dispatchEvent(new Event('change'));selectOption('before','article card-b');
    document.getElementById('site-editor-block-title').value='First card';document.getElementById('site-editor-block-body').value='First new body';document.getElementById('site-editor-block-apply').click();
    document.getElementById('site-editor-nav-label').value='New entry';document.getElementById('site-editor-nav-url').value='/contact/';document.getElementById('site-editor-nav-apply').click();
  `);
  const initialProfileReads = await evaluate(`profileReads`);
  await evaluate(`document.getElementById('site-editor-block-body').value='Unapplied field retained';authChange('TOKEN_REFRESHED',session)`);
  await wait(`profileReads>${initialProfileReads}`);
  assert.equal(await evaluate(`!document.getElementById('site-editor').hidden && !document.getElementById('site-editor-button').hidden && document.getElementById('site-editor-block-body').value==='Unapplied field retained' && rpcCalls.length===0`), true);
  await evaluate(`document.getElementById('site-editor-preview').click()`);
  await wait(`document.body.classList.contains('site-editor-preview')`);
  assert.equal(await evaluate(`document.getElementById('site-editor').hidden && !document.getElementById('site-editor-preview-toolbar').hidden`), true);
  const previewProfileReads = await evaluate(`profileReads`);
  await evaluate(`authChange('TOKEN_REFRESHED',session)`);
  await wait(`profileReads>${previewProfileReads}`);
  assert.equal(await evaluate(`document.body.classList.contains('site-editor-preview') && document.getElementById('site-editor').hidden && !document.getElementById('site-editor-preview-toolbar').hidden`), true);
  assert.deepEqual(await evaluate(`({
    title:document.querySelector('h1').textContent,
    cards:Array.from(document.querySelector('.info-grid').children).map(n=>n.querySelector('h3').textContent),
    input:document.getElementById('secret')===originalInput&&originalInput.value,
    widget:document.getElementById('widget-button')===originalWidget,
    feed:document.querySelector('[data-managed-news]').textContent,
    safe:!document.querySelector('main img'),
    translated:document.getElementById('translated').textContent,
    mixed:document.querySelector('#intro p').textContent,
    more:!!document.getElementById('navigation-more-button'),
    top:!!document.querySelector('[data-scroll-to-top]'),
    nav:document.querySelector('.bottom-nav').textContent.includes('New entry')
  })`), { title: 'Edited <img src=x onerror=alert(1)>', cards: ['First card', 'Card B', 'Added card', 'Card A'],
    input: 'PRIVATE HEALTH ANSWER', widget: true, feed: 'Live feed', safe: true, translated: 'Edited translated text', mixed: 'Mixed bold tail', more: true, top: true, nav: true });
  await evaluate(`document.getElementById('site-editor-reopen').click()`);
  assert.equal(await evaluate(`!document.getElementById('site-editor').hidden && document.body.classList.contains('site-editor-preview')`), true);
  await evaluate(`{
    const s=document.getElementById('site-editor-node');s.value=Array.from(s.options).find(o=>o.text.includes('article card-a')).value;s.dispatchEvent(new Event('change'));document.getElementById('site-editor-node-delete').click();
  }`);
  assert.equal(await evaluate(`document.getElementById('card-a').hidden`), true);
  await evaluate(`document.getElementById('site-editor-node-delete').click()`);
  assert.equal(await evaluate(`document.getElementById('card-a').hidden`), false);
  assert.equal(await evaluate(`JSON.stringify(rpcCalls).includes('PRIVATE HEALTH ANSWER')`), false);
  await evaluate(`originalWidget.click();document.getElementById('site-editor-close').click()`);
  assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Original heading');
  assert.equal(await evaluate(`clicks`), 1);
  assert.equal(await evaluate(`document.querySelector('#intro p').textContent`), 'Mixed bold tail');
  assert.equal(await evaluate(`document.getElementById('translated').textContent`), 'Runtime translation');
  assert.equal(await evaluate(`document.querySelector('#navigation-more-menu a .material-icons')?.textContent`), 'info');
  await evaluate(`document.getElementById('site-editor-button').click();document.getElementById('site-editor-preview').click()`);
  await wait(`document.body.classList.contains('site-editor-preview')`);
  await evaluate(`document.getElementById('site-editor-preview-leave').click()`);
  assert.equal(await evaluate(`document.querySelector('h1').textContent==='Original heading' && document.getElementById('site-editor-preview-toolbar').hidden`), true);
  await evaluate(`document.getElementById('site-editor-button').click();document.getElementById('site-editor-preview').click()`);
  await wait(`document.body.classList.contains('site-editor-preview')`);
  await evaluate(`document.getElementById('site-editor-reopen').click()`);
  await evaluate(`document.getElementById('site-editor-publish').click()`);
  await wait(`document.getElementById('site-editor-status').textContent.includes('已發布目前頁面')`);
  assert.equal(await evaluate(`(()=>{authChange('SIGNED_IN',{user:{id:'different-admin'}});return document.getElementById('site-editor-button').hidden && document.getElementById('site-editor-nav-item').options.length===0})()`), true);
  await evaluate(`authChange('SIGNED_OUT',null)`);
  assert.equal(await evaluate(`document.getElementById('site-editor-button').hidden && document.getElementById('site-editor').hidden`), true);
  assert.equal(await evaluate(`document.getElementById('site-editor-nav-item').options.length`), 0);
  assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Edited <img src=x onerror=alert(1)>');
  assert.equal(await evaluate(`originalInput.value`), 'PRIVATE HEALTH ANSWER');
  for (const mode of ['screener', 'pending', 'no-consent']) {
    await send('Page.navigate', { url: `${origin}/?mode=${mode}` });
    await wait(`document.readyState==='complete' && window.originalInput`);
    assert.equal(await evaluate(`document.getElementById('site-editor-button').hidden`), true, mode);
  }
  await send('Page.navigate', { url: `${origin}/?mode=public` });
  await wait(`document.querySelector('h1')?.textContent==='Published anonymous heading'`);
  assert.equal(await evaluate(`document.getElementById('site-editor-button').hidden`), true);
  await send('Page.navigate', { url: `${origin}/?mode=admin` });
  await wait(`window.fixtureMode==='admin' && document.getElementById('site-editor-button')?.hidden===false`);
  await evaluate(`document.getElementById('site-editor-button').click()`);
  await wait(`document.getElementById('site-editor-status').textContent.includes('私人草稿已載入')`);
  await evaluate(`{
    const select=document.getElementById('site-editor-text');select.value=Array.from(select.options).find(o=>o.text.includes('Original heading')).value;select.dispatchEvent(new Event('change'));
    document.getElementById('site-editor-text-value').value='Revoked private draft';document.getElementById('site-editor-text-apply').click();
    document.getElementById('site-editor-block-title').value='PRIVATE BLOCK LABEL';document.getElementById('site-editor-block-body').value='Private body';document.getElementById('site-editor-block-apply').click();
    document.getElementById('site-editor-nav-label').value='PRIVATE NAV LABEL';document.getElementById('site-editor-nav-url').value='/contact/';document.getElementById('site-editor-nav-apply').click();
    document.getElementById('site-editor-preview').click();
  }`);
  await wait(`document.body.classList.contains('site-editor-preview')`);
  await evaluate(`fixtureRole='screener';authChange('TOKEN_REFRESHED',session)`);
  await wait(`document.getElementById('site-editor-button').hidden`);
  assert.equal(await evaluate(`document.querySelector('h1').textContent==='Original heading' && !document.body.classList.contains('site-editor-preview') && document.getElementById('site-editor-preview-toolbar').hidden && document.getElementById('site-editor-text').options.length===0`), true);
  assert.equal(await evaluate(`(()=>{
    const panel=document.getElementById('site-editor');
    return !panel.textContent.includes('PRIVATE BLOCK LABEL') && !panel.textContent.includes('PRIVATE NAV LABEL')
      && ['text','link','node','parent','before','block','nav-item'].every(id=>document.getElementById('site-editor-'+id).options.length===0)
      && Array.from(panel.querySelectorAll('input,textarea')).every(field=>field.value==='')
      && document.getElementById('site-editor-status').textContent==='' && document.getElementById('site-editor-node-info').textContent==='';
  })()`), true, 'Revocation must erase private labels, fields and messages from hidden DOM');
  await send('Page.navigate', { url: `${origin}/?mode=missing` });
  await wait(`window.fixtureMode==='missing' && document.getElementById('site-editor-button')?.hidden===false`);
  await evaluate(`document.getElementById('site-editor-button').click()`);
  await wait(`document.getElementById('site-editor-status').textContent.includes('202610200001_site_editor.sql')`);
  assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Original heading');
  await send('Page.navigate', { url: `${origin}/?mode=race` });
  await wait(`window.fixtureMode==='race' && document.getElementById('site-editor-button')?.hidden===false`);
  await evaluate(`document.getElementById('site-editor-button').click()`);
  await wait(`typeof resolveDraft==='function'`);
  await evaluate(`authChange('SIGNED_OUT',null);resolveDraft()`);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.getElementById('site-editor-button').hidden && document.getElementById('site-editor').hidden && !document.body.classList.contains('site-editor-preview')`), true);
  await t.test('integrated inline editing, formatting, history, insertion, source flush and public uploads', async () => {
    await send('Page.navigate', { url: `${origin}/?mode=inline` });
    await wait(`window.fixtureMode==='inline' && document.getElementById('site-editor-button')?.hidden===false`);
    await evaluate(`document.getElementById('site-editor-button').click()`);
    await wait(`document.body.classList.contains('site-editor-editing') && document.querySelector('h1 [contenteditable]')`);
    assert.equal(await evaluate(`!document.getElementById('site-editor-mode-actions').hidden
      &&document.getElementById('site-editor-button').getAttribute('aria-pressed')==='true'`), true);
    await evaluate(`
      window.originalInlineStrong=document.querySelector('#intro strong');
      window.clickInlineLabel=(label,scope=document)=>{const node=scope.querySelector('[aria-label="'+label+'"]');if(!node)throw Error('Missing '+label);node.click()};
      window.typeInline=(node,text)=>{node.focus();node.textContent=text;node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}))};
      window.addInline=label=>{document.querySelector('#mixed').click();clickInlineLabel('在此元件後新增區塊');clickInlineLabel(label,document.querySelector('[role=menu]'))};
      window.saveInline=()=>document.getElementById('site-editor-mode-save').click();
      document.getElementById('secret').value='PRIVATE INLINE HEALTH ANSWER';
    `);
    assert.equal(await evaluate(`(()=>{
      const before=renderCount;typeInline(document.querySelector('h1 [contenteditable]'),'Inline heading');
      return renderCount===before&&document.querySelector('h1').textContent==='Inline heading';
    })()`), true, 'Typing must not rerender or move the caret');
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('h1 [contenteditable]'),before=renderCount;
      node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      node.textContent='';
      node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward',isComposing:true}));
      saveInline();
      return rpcCalls.length===0&&!document.getElementById('site-editor-mode-save').disabled
        &&node.isConnected&&!document.querySelector('h1').hidden&&renderCount===before;
    })()`), true, 'IME must block saving, rerendering and automatic empty deletion');
    await evaluate(`{
      const node=document.querySelector('h1 [contenteditable]');typeInline(node,'Inline heading');
      node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'Inline heading'}));
    }`);
    await evaluate(`saveInline()`);
    await wait(`rpcCalls.length===1&&!document.getElementById('site-editor-mode-save').disabled`);
    assert.equal(await evaluate(`Object.values(saved['/'].document.patches).some(p=>p.text==='Inline heading')
      &&document.querySelector('#intro strong')===originalInlineStrong
      &&document.getElementById('secret')===originalInput&&originalInput.value==='PRIVATE INLINE HEALTH ANSWER'`), true);
    await evaluate(`document.getElementById('site-editor-undo').click()`);
    assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Original heading');
    await evaluate(`document.getElementById('site-editor-redo').click()`);
    assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Inline heading');
    await evaluate(`{
      const node=document.querySelector('h1 [contenteditable]');typeInline(node,'Inline history');
      node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'z',ctrlKey:true}));
    }`);
    assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Inline heading');
    await evaluate(`document.getElementById('site-editor-redo').click()`);
    assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Inline history');
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#mixed [contenteditable]');node.focus();
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(node);range.collapse(true);
      selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
      const toolbar=document.querySelector('.site-editor-format-toolbar'),visible=!toolbar.hidden&&selection.isCollapsed;
      const style=toolbar.querySelector('select');style.value='blockquote';style.dispatchEvent(new Event('change',{bubbles:true}));
      originalWidget.focus();
      return visible&&document.querySelector('#mixed [data-site-editor-style="blockquote"]')!==null;
    })()`), true, 'Caret-only editing must expose paragraph styles and flush them on blur');
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#mixed [contenteditable]');node.focus();
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(node);
      selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
      const visible=!document.querySelector('.site-editor-format-toolbar').hidden;
      clickInlineLabel('粗體');return visible&&node.querySelector('b,strong')!==null;
    })()`), true);
    await evaluate(`saveInline()`);
    await wait(`rpcCalls.length===2&&!document.getElementById('site-editor-mode-save').disabled`);
    assert.equal(await evaluate(`Object.values(saved['/'].document.patches).some(p=>p.rich?.some(run=>run.bold&&run.text.startsWith('Mixed')))
      &&document.querySelector('#mixed').contains(originalInlineStrong)
      &&!JSON.stringify(rpcCalls).includes('PRIVATE INLINE HEALTH ANSWER')`), true);
    await evaluate(`addInline('文字')`);
    assert.equal(await evaluate(`document.querySelectorAll('[data-site-editor-block]').length`), 1);
    await evaluate(`{
      const node=document.querySelector('[data-site-editor-block] [data-site-editor-field=body]');
      window.inlineParagraphId=node.closest('[data-site-editor-block]').dataset.siteEditorBlock;
      typeInline(node,'Inline inserted');
      node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'ArrowUp',altKey:true}));
      saveInline();
    }`);
    await wait(`rpcCalls.length===3&&!document.getElementById('site-editor-mode-save').disabled`);
    assert.equal(await evaluate(`(()=>{
      const value=saved['/'].document,block=value.blocks.find(item=>item.id===inlineParagraphId);
      const originalId=Array.from(fixtureBaseline.nodes).find(([,item])=>item.element===document.querySelector('#mixed'))[0];
      return block.type==='paragraph'&&block.body==='Inline inserted'
        &&value.orders[block.parent].indexOf(block.id)<value.orders[block.parent].indexOf(originalId);
    })()`), true);
    await evaluate(`addInline('卡片')`);
    assert.equal(await evaluate(`(()=>{
      const node=Array.from(document.querySelectorAll('[data-site-editor-block]')).find(value=>value.dataset.siteEditorBlock!==inlineParagraphId);
      window.emptyCardId=node.dataset.siteEditorBlock;
      const input=node.querySelector('[data-site-editor-field=body]');typeInline(input,'x');input.textContent='';
      input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));
      return !Array.from(document.querySelectorAll('[data-site-editor-block]')).some(value=>value.dataset.siteEditorBlock===emptyCardId);
    })()`), true);
    await evaluate(`document.getElementById('site-editor-undo').click()`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-site-editor-block]')).some(value=>value.dataset.siteEditorBlock===emptyCardId)`), true);
    await evaluate(`document.getElementById('site-editor-redo').click();addInline('表格')`);
    await evaluate(`{
      const input=document.querySelector('[role=dialog] textarea');input.value='Name\\tCount\\nPublic\\t2';
      input.dispatchEvent(new Event('input',{bubbles:true}));saveInline();
    }`);
    await wait(`rpcCalls.length===4&&!document.getElementById('site-editor-mode-save').disabled`);
    assert.equal(await evaluate(`saved['/'].document.blocks.some(block=>block.type==='table'&&block.body==='Name\\tCount\\nPublic\\t2')
      &&document.querySelector('main table')?.textContent.includes('Public')`), true, 'Save must flush an open source editor');
    await evaluate(`addInline('圖片')`);
    assert.equal(await evaluate(`(async()=>{
      const file=document.querySelector('[role=dialog] input[type=file]');
      window.consentPrompts=0;window.confirm=()=>{consentPrompts++;return false};
      const invalid=new DataTransfer();invalid.items.add(new File(['invalid'],'private.txt',{type:'text/plain'}));
      file.files=invalid.files;file.dispatchEvent(new Event('change',{bubbles:true}));
      const oversized=new DataTransfer();oversized.items.add(new File([new Uint8Array(10485761)],'large.png',{type:'image/png'}));
      file.files=oversized.files;file.dispatchEvent(new Event('change',{bubbles:true}));
      const rejected=storageUploads.length===0&&consentPrompts===0;
      const canceled=new DataTransfer();canceled.items.add(new File(['public'],'declined.png',{type:'image/png'}));
      file.files=canceled.files;file.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,20));
      window.confirm=()=>true;
      return rejected&&storageUploads.length===0&&consentPrompts===1
        &&document.querySelector('[role=dialog] input[type=url]').value==='';
    })()`), true, 'Invalid files and declined public-media consent must not reach storage');
    await evaluate(`{
      const file=document.querySelector('[role=dialog] input[type=file]');
      const transfer=new DataTransfer();transfer.items.add(new File(['public'],'public.png',{type:'image/png'}));
      file.files=transfer.files;file.dispatchEvent(new Event('change',{bubbles:true}));
    }`);
    await wait(`document.querySelector('[role=dialog] input[type=url]')?.value.startsWith('https://media.example.org/')`);
    assert.equal(await evaluate(`storageUploads.length===1&&storageUploads[0].bucket==='site-editor-media'
      &&storageUploads[0].name.startsWith('fixture-admin/')&&storageUploads[0].type==='image/png'
      &&storageUploads[0].options.upsert===false`), true);
    await evaluate(`clickInlineLabel('套用媒體網址',document.querySelector('[role=dialog]'))`);
    assert.equal(await evaluate(`!!document.querySelector('main img[src^="https://media.example.org/"]')`), true);
    await evaluate(`(async()=>{
      const node=document.querySelector('main img');
      node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:3,clientX:20,clientY:20}));
      await new Promise(resolve=>setTimeout(resolve,710));
      document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:3}));
    })()`);
    assert.equal(await evaluate(`!!document.querySelector('main img')&&document.activeElement.hasAttribute('data-delete')`), true);
    await evaluate(`clickInlineLabel('刪除元件')`);
    assert.equal(await evaluate(`!document.querySelector('main img')&&storageUploads.length===1`), true);
    await evaluate(`document.getElementById('site-editor-settings').click()`);
    assert.equal(await evaluate(`document.getElementById('site-editor').hidden&&document.body.classList.contains('site-editor-editing')`), true);
    await evaluate(`document.getElementById('site-editor-settings').click();document.getElementById('site-editor-preview').click()`);
    await wait(`document.body.classList.contains('site-editor-preview')`);
    assert.equal(await evaluate(`!document.querySelector('main [contenteditable]')
      &&document.getElementById('site-editor-mode-actions').hidden&&document.querySelector('h1').textContent==='Inline history'`), true);
    await evaluate(`document.getElementById('site-editor-preview-leave').click()`);
    assert.equal(await evaluate(`document.querySelector('h1').textContent==='Original heading'
      &&document.querySelector('#intro strong')===originalInlineStrong&&originalInput.value==='PRIVATE INLINE HEALTH ANSWER'`), true);
    await evaluate(`document.getElementById('site-editor-button').click()`);
    await wait(`document.querySelector('h1 [contenteditable]')`);
    await evaluate(`typeInline(document.querySelector('#mixed [contenteditable]'),'UNSAVED INLINE TEXT');authChange('SIGNED_OUT',null)`);
    assert.equal(await evaluate(`document.getElementById('site-editor-button').hidden
      &&!document.querySelector('main [contenteditable]')&&!document.querySelector('.site-editor-inline-ui')
      &&!document.querySelector('main').textContent.includes('UNSAVED INLINE TEXT')
      &&document.querySelector('#mixed').textContent==='Mixed bold tail'
      &&document.querySelector('#intro strong')===originalInlineStrong
      &&!JSON.stringify(rpcCalls).includes('PRIVATE INLINE HEALTH ANSWER')`), true);
  });
  assert.deepEqual(errors, []);
});
