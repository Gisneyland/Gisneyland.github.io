const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

test('inline browser editing preserves nodes, sanitizes input and supports composition, blocks and media', {
  skip: !process.env.CHROMIUM_BIN && 'Set CHROMIUM_BIN to run inline browser tests.',
  timeout: 60000
}, async t => {
  const fixture = `<!doctype html><meta charset="utf-8">
    <style>main{max-width:650px}p,article{min-height:36px;margin:15px}
    [hidden]{display:none!important}.site-editor-inline-ui{background:white}
    .site-editor-component-tools,.site-editor-format-toolbar{padding:4px;border:1px solid gray}
    textarea{width:400px}.site-editor-selected{outline:1px solid blue}</style>
    <main id="main-content"><section id="area">
      <p id="mixed">Lead <strong>bold</strong> tail</p><p id="second">Second paragraph</p>
      <p id="empty">Placeholder</p><a id="link" href="/do-not-follow/">A link</a>
      <form id="widget"><input value="keep"><button type="button">Widget</button></form>
    </section></main>
    <script src="/assets/js/site-editor-model.js"></script>
    <script src="/assets/js/site-editor-rich.js"></script>
    <script src="/assets/js/site-editor-dom.js"></script>
    <script src="/assets/js/site-editor-inline.js"></script>
    <script>
      window.confirm=()=>true;window.prompt=()=> 'javascript:alert(1)';
      window.originalStrong=document.querySelector('strong');window.originalInput=document.querySelector('input');
      window.baseline=SiteEditorDOM.capture(document.querySelector('main'),null);
      window.draft=SiteEditorModel.empty();window.changes=0;window.notices=[];window.uploads=[];
      window.allowed=true;
      window.redraw=()=>{inline.stop();baseline.render(draft);inline.start();};
      window.inline=SiteEditorInline.create({baseline,getDraft:()=>draft,active:()=>allowed,
        notify:value=>notices.push(value),mutate:fn=>{fn();draft=SiteEditorModel.normalize(draft);changes++;redraw()},
        uploadMedia:async file=>{uploads.push({name:file.name,type:file.type});return 'https://cdn.example.org/public.png'}});
      inline.start();
      window.clickLabel=(label,scope=document)=>{const button=scope.querySelector('[aria-label="'+label+'"]');if(!button)throw Error('Missing '+label);button.click();};
      window.inputText=(node,text)=>{node.focus();node.textContent=text;node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}))};
      window.textId=(text)=>Array.from(baseline.texts).find(([,item])=>item.original===text)[0];
      window.nodeId=(id)=>Array.from(baseline.nodes).find(([,item])=>item.element.id===id)[0];
      window.add=(label)=>{document.querySelector('#second').click();clickLabel('在此元件後新增區塊');clickLabel(label,document.querySelector('[role=menu]'));};
    </script>`;
  const server = http.createServer(async (request, response) => {
    if (!request.url.startsWith('/assets/js/')) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fixture); return;
    }
    try {
      const filename = new URL(request.url, 'http://localhost').pathname;
      assert.match(filename, /^\/assets\/js\/site-editor(?:-model|-dom|-rich|-inline)\.js$/);
      response.setHeader('Content-Type', 'application/javascript');
      response.end(await fs.readFile(path.join(root, filename)));
    } catch { response.writeHead(404).end(); }
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = path.join(root, '.jekyll-cache', `inline-browser-${process.pid}`);
  await fs.mkdir(profile, { recursive: true });
  t.after(() => fs.rm(profile, { recursive: true, force: true, maxRetries: 5 }));
  const browser = spawn(process.env.CHROMIUM_BIN, ['--headless', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  t.after(async () => {
    if (browser.exitCode !== null) return;
    const exited = new Promise(resolve => browser.once('exit', resolve)); browser.kill(); await exited;
  });
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chromium startup timed out')), 20000);
    browser.stderr.on('data', data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(new URL(match[1]).origin.replace('ws:', 'http:')); }
    });
    browser.once('error', reject);
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  for (let attempt = 0; attempt < 100 && !await evaluate('Boolean(window.inline)'); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.equal(await evaluate('Boolean(window.inline)'), true, errors.join('\n'));

  await t.test('local text state waits for flush and never replaces mixed markup or widgets', async () => {
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#mixed [data-site-editor-text]');
      inputText(node,'Edited lead ');
      return changes===0 && originalStrong===document.querySelector('strong') && inline.flush()
        && draft.patches[textId('Lead ')].text==='Edited lead '
        && originalStrong===document.querySelector('strong') && originalInput===document.querySelector('#widget input');
    })()`), true);
    assert.equal(await evaluate(`(()=>{
      inline.stop();
      const okay=!document.querySelector('[contenteditable]') && !document.querySelector('.site-editor-inline-ui')
        && document.querySelector('#mixed').lastChild===baseline.texts.get(textId(' tail')).node
        && originalStrong===document.querySelector('strong');
      inline.start(); return okay;
    })()`), true);
  });
  await t.test('IME blocks flush and empty-delete until composition is complete', async () => {
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#empty [contenteditable]');
      node.focus();node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      inputText(node,''); const before=changes;
      node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Backspace',isComposing:true}));
      const guarded=!inline.flush() && changes===before && !draft.patches[nodeId('empty')]?.deleted;
      inputText(node,'漢字');node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'漢字'}));
      inline.flush();return guarded && draft.patches[textId('Placeholder')].text==='漢字';
    })()`), true);
  });
  await t.test('paste takes plaintext only, unsafe links are rejected and editing links never navigates', async () => {
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#mixed [contenteditable]');node.focus();
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(node);
      selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
      const paste=new Event('paste',{bubbles:true,cancelable:true});
      Object.defineProperty(paste,'clipboardData',{value:{getData:type=>type==='text/plain'?'<img onerror=bad()>':'<img src=x onerror=bad()>'}});
      node.dispatchEvent(paste);
      const plain=!node.querySelector('img') && node.textContent.includes('<img onerror=bad()>');
      range.selectNodeContents(node);selection.removeAllRanges();selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));clickLabel('加入連結');
      const rejected=notices.at(-1).includes('不安全');
      const link=document.querySelector('#link');
      const click=new MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(click);
      inline.flush();return plain&&rejected&&click.defaultPrevented&&location.pathname==='/';
    })()`), true);
  });
  await t.test('all block types are offered, new paragraphs edit inline and move among static siblings', async () => {
    assert.deepEqual(await evaluate(`(()=>{
      document.querySelector('#second').click();clickLabel('在此元件後新增區塊');
      return Array.from(document.querySelector('[role=menu]').querySelectorAll('button')).map(node=>node.getAttribute('aria-label'));
    })()`), ['文字', '卡片', '圖片', '音訊', '影片', '表格', '程式碼', '數學', '樂譜', '流程圖', 'Markdown']);
    assert.equal(await evaluate(`(()=>{
      clickLabel('文字',document.querySelector('[role=menu]'));
      const block=draft.blocks.at(-1),node=document.querySelector('[data-site-editor-block="'+block.id+'"] [data-site-editor-field=body]');
      const before=changes;inputText(node,'Added paragraph');
      const lazy=changes===before;inline.flush();
      const current=document.querySelector('[data-site-editor-block="'+block.id+'"] [data-site-editor-field=body]');
      current.focus();current.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'ArrowUp',altKey:true}));
      const ids=draft.orders[block.parent];
      window.paragraphId=block.id;
      return lazy&&draft.blocks.find(item=>item.id===block.id).body==='Added paragraph'
        && ids.indexOf(block.id)<ids.indexOf(nodeId('second'));
    })()`), true);
  });
  await t.test('long-press drag handle reorders added and original siblings in the same parent', async () => {
    assert.equal(await evaluate(`(async()=>{
      const node=document.querySelector('[data-site-editor-block="'+paragraphId+'"]');
      node.click();
      const handle=document.querySelector('[aria-label="長按拖曳排序；或使用向前／向後按鈕"]');
      handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,pointerId:9,clientX:5,clientY:5}));
      await new Promise(resolve=>setTimeout(resolve,720));
      const target=document.querySelector('#empty'),rect=target.getBoundingClientRect();
      document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:9,clientX:rect.left+30,clientY:rect.top+12}));
      document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:9}));
      const block=draft.blocks.find(item=>item.id===paragraphId),order=draft.orders[block.parent];
      return order.indexOf(paragraphId)>order.indexOf(nodeId('empty'))
        && !document.querySelector('.site-editor-dragging');
    })()`), true);
  });
  await t.test('rich formatting is serialized into structured text, never HTML', async () => {
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('[data-site-editor-block="'+paragraphId+'"] [data-site-editor-field=body]');
      node.focus();const selection=getSelection(),range=document.createRange();range.selectNodeContents(node);
      selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
      clickLabel('粗體');
      inline.flush();
      const block=draft.blocks.find(item=>item.id===paragraphId);
      return block.body==='Added paragraph'&&block.rich.some(run=>run.bold&&run.text==='Added paragraph')
        && !JSON.stringify(block).includes('<b>');
    })()`), true);
  });
  await t.test('native line breaks, highlight and color survive flush', async () => {
    assert.deepEqual(await evaluate(`(()=>{
      const node=document.querySelector('[data-site-editor-block="'+paragraphId+'"] [data-site-editor-field=body]');
      node.focus();node.replaceChildren();
      const one=document.createElement('div');one.textContent='First';
      const two=document.createElement('div');two.textContent='Second';node.append(one,two);
      node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertParagraph'}));
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(one);
      selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
      clickLabel('螢光標記');
      const color=document.querySelector('[aria-label="文字顏色"]');color.value='#ff0000';
      color.dispatchEvent(new Event('input',{bubbles:true}));
      inline.flush();
      const block=draft.blocks.find(item=>item.id===paragraphId);
      return {body:block.body,highlight:block.rich.some(run=>run.text==='First'&&run.highlight),
        color:block.rich.some(run=>run.text==='First'&&run.color==='#ff0000')};
    })()`), { body: 'First\nSecond', highlight: true, color: true });
  });
  await t.test('source/table edits preview and flush before save; empty source blocks delete', async () => {
    assert.equal(await evaluate(`(()=>{
      add('表格');const block=draft.blocks.find(item=>item.type==='table');
      const input=document.querySelector('[role=dialog] textarea');input.value='A\\tB\\n1\\t2';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const preview=Boolean(document.querySelector('[role=dialog] table'));
      inline.flush();
      return preview&&draft.blocks.find(item=>item.id===block.id).body==='A\\tB\\n1\\t2';
    })()`), true);
    assert.equal(await evaluate(`(()=>{
      const block=draft.blocks.find(item=>item.type==='table');
      document.querySelector('[data-site-editor-block="'+block.id+'"]').click();
      clickLabel('編輯原始內容／表格');
      const input=document.querySelector('[role=dialog] textarea');input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Backspace'}));
      return !draft.blocks.some(item=>item.id===block.id);
    })()`), true);
  });
  await t.test('safe media URLs, existing library and permission-owned uploads', async () => {
    assert.equal(await evaluate(`(async()=>{
      add('圖片');const pane=document.querySelector('[role=dialog]'),input=pane.querySelector('input[type=url]');
      input.value='javascript:alert(1)';clickLabel('套用媒體網址',pane);
      const rejected=!draft.blocks.some(item=>item.type==='image');
      const transfer=new DataTransfer();transfer.items.add(new File(['data'],'public.png',{type:'image/png'}));
      const file=pane.querySelector('input[type=file]');file.files=transfer.files;file.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,20));
      const uploaded=input.value==='https://cdn.example.org/public.png'&&uploads.length===1;
      clickLabel('套用媒體網址',pane);
      const block=draft.blocks.find(item=>item.type==='image');
      document.querySelector('[data-site-editor-block="'+block.id+'"]').click();clickLabel('更換媒體網址');
      clickLabel('開啟媒體庫網址',document.querySelector('[role=dialog]'));
      const library=document.querySelector('[role=dialog] select');
      return rejected&&uploaded&&block.url==='https://cdn.example.org/public.png'&&!library.hidden
        && Array.from(library.options).some(option=>option.value===block.url);
    })()`), true);
    await evaluate(`clickLabel('關閉',document.querySelector('[role=dialog]'))`);
  });
  await t.test('long press deletes media with confirmation and empty text deletes via keyboard', async () => {
    assert.equal(await evaluate(`(async()=>{
      const block=draft.blocks.find(item=>item.type==='image'),node=document.querySelector('[data-site-editor-block="'+block.id+'"] img');
      node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:8,clientX:20,clientY:20}));
      await new Promise(resolve=>setTimeout(resolve,720));
      document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:8}));
      return !draft.blocks.some(item=>item.id===block.id);
    })()`), true);
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#empty [contenteditable]');
      inputText(node,'');node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Delete'}));
      return draft.patches[nodeId('empty')].deleted===true && document.querySelector('#empty').hidden;
    })()`), true);
  });
  await t.test('inactive lifecycle removes only owned wrappers and never commits after revocation', async () => {
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#second [contenteditable]');inputText(node,'Uncommitted');
      const before=changes;allowed=false;inline.stop();
      return changes===before&&!document.querySelector('[contenteditable]')&&!document.querySelector('.site-editor-inline-ui')
        && originalStrong===document.querySelector('strong')&&originalInput===document.querySelector('#widget input');
    })()`), true);
  });
  assert.deepEqual(errors, []);
});
