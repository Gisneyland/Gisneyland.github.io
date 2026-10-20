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
      <article id="static-card-a"><h3>Static card A</h3><p>Card A body</p></article>
      <article id="static-card-b"><h3>Static card B</h3><p>Card B body</p></article>
      <p id="empty">Placeholder</p><a id="link" href="/do-not-follow/">A link</a>
      <form id="widget"><input value="keep"><button type="button">Widget</button></form>
      <div id="static-div-card" class="detail-card"><h3></h3><p>Only body</p></div>
    </section><section id="other"><p id="foreign">Different parent</p></section>
      <div id="visuals"><span id="static-icon" class="material-icons" aria-hidden="true">home</span>
        <picture><source srcset="/original-wide.png"><img id="static-logo" src="/original.png" srcset="/original-2x.png 2x" alt="Original"></picture>
        <a id="static-button" class="btn" href="/original"><span class="material-icons">call</span>Contact</a>
        <button type="button" id="functional">Runtime action</button>
        <button type="button" id="static-native" data-site-editor-static="true">Static</button>
        <a id="functional-link" href="#widget" aria-controls="widget">Toggle widget</a>
      </div>
    <section id="empty-layout"><p id="layout-copy">Layout text</p></section></main>
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
        notify:value=>notices.push(value),mutate:fn=>{if(window.rejectMutations)return false;fn();draft=SiteEditorModel.normalize(draft);changes++;redraw();return true},
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
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  for (let attempt = 0; attempt < 100 && !await evaluate('Boolean(window.inline)'); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.equal(await evaluate('Boolean(window.inline)'), true, errors.join('\n'));
  assert.equal(await evaluate(`!document.querySelector('.site-editor-inline-root').classList.contains('site-editor-inline-ui')
    &&Number(document.querySelector('.site-editor-format-toolbar').style.zIndex)>=10060`), true);

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
  await t.test('rejected mutations preserve dirty text and prevent structural changes until retry', async () => {
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#second [contenteditable]');inputText(node,'Retry pending text');
      const before=changes;window.rejectMutations=true;
      const rejected=inline.flush()===false&&changes===before&&node.isConnected&&node.textContent==='Retry pending text';
      window.rejectMutations=false;const retried=inline.flush();
      const persisted=draft.patches[textId('Second paragraph')].text==='Retry pending text';
      const count=draft.blocks.length;window.rejectMutations=true;add('文字');
      const blocked=draft.blocks.length===count;window.rejectMutations=false;
      return rejected&&retried&&persisted&&blocked;
    })()`), true);
  });
  await t.test('caret focus exposes formatting and paragraph styles persist on blur', async () => {
    assert.deepEqual(await evaluate(`(()=>{
      const node=document.querySelector('#second [contenteditable]');node.focus();
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(node);range.collapse(false);
      selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
      const toolbar=document.querySelector('.site-editor-format-toolbar');
      const visible=selection.isCollapsed&&!toolbar.hidden&&Number.isFinite(parseFloat(toolbar.style.top));
      const style=toolbar.querySelector('select');style.value='blockquote';style.dispatchEvent(new Event('change',{bubbles:true}));
      document.querySelector('#widget button').focus();
      return {visible,style:draft.patches[textId('Second paragraph')].style,
        text:draft.patches[textId('Second paragraph')].text};
    })()`), { visible: true, style: 'blockquote', text: 'Retry pending text' });
  });
  await t.test('formatting at a collapsed caret applies to subsequent input', async () => {
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#second [contenteditable]');node.focus();
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(node);range.collapse(false);
      selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
      clickLabel('粗體');document.execCommand('insertText',false,' formatted');
      document.querySelector('#widget button').focus();
      return draft.patches[textId('Second paragraph')].rich.some(run=>run.bold&&run.text.includes('formatted'));
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
    })()`), ['文字', '卡片', '圖片', '音訊', '影片', '按鈕', '圖示／符號', '標誌圖片', '表格', '程式碼', '數學', '樂譜', '流程圖', 'Markdown']);
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
    assert.equal(await evaluate(`(async()=>{
      document.querySelector('[data-site-editor-block="'+paragraphId+'"]').click();
      const handle=document.querySelector('[aria-label="長按拖曳排序；或使用向前／向後按鈕"]'),before=changes;
      handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,pointerId:10,clientX:5,clientY:5}));
      await new Promise(resolve=>setTimeout(resolve,720));
      const rect=document.querySelector('#foreign').getBoundingClientRect();
      document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:10,clientX:rect.right-15,clientY:rect.top+12}));
      document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:10}));
      return changes===before&&!document.querySelector('.site-editor-dragging');
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
  await t.test('consecutive added blocks reorder across static cards without moving protected slots', async () => {
    assert.equal(await evaluate(`(()=>{
      const first=draft.blocks.find(item=>item.id===paragraphId),parent=baseline.parents.get(first.parent);
      const form=document.querySelector('#widget');
      const originalSlot=parent.childNodes.filter(node=>node.nodeType===1).indexOf(form);
      function appendAfter(id,text){
        document.querySelector('[data-site-editor-block="'+id+'"]').click();
        clickLabel('在此元件後新增區塊');clickLabel('文字',document.querySelector('[role=menu]'));
        const block=draft.blocks.at(-1);
        inputText(document.querySelector('[data-site-editor-block="'+block.id+'"] [data-site-editor-field=body]'),text);
        inline.flush();return block.id;
      }
      const second=appendAfter(paragraphId,'Consecutive two');
      const third=appendAfter(second,'Consecutive three');
      function moveAdded(key){
        const node=document.querySelector('[data-site-editor-block="'+second+'"] [data-site-editor-field=body]');
        node.focus();node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key,altKey:true}));
      }
      moveAdded('ArrowDown');moveAdded('ArrowDown');
      for(let index=0;index<7;index++)moveAdded('ArrowUp');
      const expected=draft.orders[first.parent].slice();
      redraw();
      const actual=Array.from(parent.element.children).map(node=>node.dataset.siteEditorBlock
        ||Array.from(baseline.nodes).find(([,entry])=>entry.element===node)?.[0]).filter(Boolean);
      const originalChildren=Array.from(parent.element.children).filter(node=>!node.hasAttribute('data-site-editor-block'));
      const positions=actual.indexOf(second)<actual.indexOf(paragraphId)
        &&actual.indexOf(third)>actual.indexOf(paragraphId)
        &&actual.indexOf(second)<actual.indexOf(nodeId('static-card-a'))
        &&actual.indexOf(second)<actual.indexOf(nodeId('static-card-b'));
      return JSON.stringify(actual)===JSON.stringify(expected)&&positions
        &&originalChildren.indexOf(form)===originalSlot
        &&form.querySelector('input')===originalInput
        &&form.querySelector('button').textContent==='Widget';
    })()`), true);
  });
  await t.test('empty original article/card containers delete as a unit, but structural sections remain', async () => {
    assert.equal(await evaluate(`(()=>{
      function erase(selector){
        const input=document.querySelector(selector+' [contenteditable]');input.focus();input.textContent='';
        input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));
      }
      erase('#static-card-a p');
      const retained=!document.querySelector('#static-card-a').hidden;
      erase('#static-card-a h3');
      erase('#static-div-card p');
      erase('#layout-copy');
      return retained&&document.querySelector('#static-card-a').hidden
        &&document.querySelector('#static-div-card').hidden
        &&!document.querySelector('#static-card-b').hidden&&!document.querySelector('#area').hidden
        &&document.querySelector('#layout-copy').hidden&&!document.querySelector('#empty-layout').hidden
        &&document.querySelector('#widget input')===originalInput;
    })()`), true);
  });
  await t.test('source/table edits preview and flush before save; empty source blocks delete', async () => {
    assert.equal(await evaluate(`(()=>{
      add('表格');const block=draft.blocks.find(item=>item.type==='table');
      const input=document.querySelector('[role=dialog] textarea');input.value='A\\tB\\n1\\t2';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const preview=Boolean(document.querySelector('[role=dialog] table'));
      window.rejectMutations=true;
      const rejected=inline.flush()===false&&document.querySelector('[role=dialog] textarea')===input
        &&draft.blocks.find(item=>item.id===block.id).body!=='A\\tB\\n1\\t2';
      window.rejectMutations=false;
      inline.flush();
      return preview&&rejected&&draft.blocks.find(item=>item.id===block.id).body==='A\\tB\\n1\\t2';
    })()`), true);
    assert.equal(await evaluate(`(()=>{
      const block=draft.blocks.find(item=>item.type==='table');
      document.querySelector('[data-site-editor-block="'+block.id+'"]').click();
      clickLabel('編輯原始內容／表格');
      const input=document.querySelector('[role=dialog] textarea');input.value='';
      input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentForward'}));
      return !draft.blocks.some(item=>item.id===block.id);
    })()`), true);
  });
  await t.test('safe media URLs, existing library and permission-owned uploads', async () => {
    assert.equal(await evaluate(`(async()=>{
      inputText(document.querySelector('#second [contenteditable]'),'Second edited before media');
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
      return rejected&&uploaded&&block.url==='https://cdn.example.org/public.png'&&block.parent===nodeId('area')&&!library.hidden
        && Array.from(library.options).some(option=>option.value===block.url);
    })()`), true);
    await evaluate(`clickLabel('關閉',document.querySelector('[role=dialog]'))`);
  });
  await t.test('long press reveals media deletion; deleting the final text character removes its block', async () => {
    assert.equal(await evaluate(`(async()=>{
      const block=draft.blocks.find(item=>item.type==='image'),node=document.querySelector('[data-site-editor-block="'+block.id+'"] img');
      node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:8,clientX:20,clientY:20}));
      await new Promise(resolve=>setTimeout(resolve,720));
      document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:8}));
      const offered=draft.blocks.some(item=>item.id===block.id)&&document.activeElement.hasAttribute('data-delete');
      clickLabel('刪除元件');return offered&&!draft.blocks.some(item=>item.id===block.id);
    })()`), true);
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#empty [contenteditable]');
      node.focus();node.textContent='';
      node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));
      return draft.patches[nodeId('empty')].deleted===true && document.querySelector('#empty').hidden;
    })()`), true);
    assert.equal(await evaluate(`(()=>{
      add('卡片');const block=draft.blocks.find(item=>item.type==='card');
      const node=document.querySelector('[data-site-editor-block="'+block.id+'"] [contenteditable]');
      node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Backspace'}));
      return !draft.blocks.some(item=>item.id===block.id);
    })()`), true);
  });
  await t.test('static icon, responsive logo and styled button properties are reversible without replacing nodes or handlers', async () => {
    assert.equal(await evaluate(`(()=>{
      window.staticIcon=document.querySelector('#static-icon');window.iconText=staticIcon.firstChild;
      window.staticLogo=document.querySelector('#static-logo');window.staticButton=document.querySelector('#static-button');
      window.staticClicks=0;staticButton.addEventListener('click',()=>staticClicks++);
      const edit=(node,values)=>{
        node.click();clickLabel('編輯元件屬性');
        const pane=document.querySelector('[role=dialog]');
        for(const [name,value] of Object.entries(values))pane.querySelector('[aria-label="'+name+'"]').value=value;
        clickLabel('套用元件屬性',pane);
      };
      edit(staticIcon,{'Material 圖示名稱':'favorite'});
      const iconOkay=staticIcon.textContent==='favorite'&&!staticIcon.querySelector('[contenteditable]');
      edit(staticLogo,{'圖片網址':'https://cdn.example.org/logo.png','替代文字':'Safe logo'});
      const imageOkay=staticLogo.src==='https://cdn.example.org/logo.png'&&staticLogo.alt==='Safe logo'
        &&!staticLogo.hasAttribute('srcset')&&!staticLogo.parentElement.querySelector('source').hasAttribute('srcset');
      edit(staticButton,{'連結網址':'/updated','按鈕樣式':'outline'});
      const buttonOkay=staticButton.getAttribute('href')==='/updated'&&staticButton.classList.contains('site-editor-variant-outline')
        &&staticButton.querySelector('.material-icons').textContent==='call';
      inline.stop();baseline.restore();
      const restored=staticIcon.firstChild===iconText&&staticIcon.textContent==='home'&&staticLogo.alt==='Original'
        &&staticLogo.getAttribute('srcset')==='/original-2x.png 2x'
        &&staticLogo.parentElement.querySelector('source').getAttribute('srcset')==='/original-wide.png'
        &&staticButton.getAttribute('class')==='btn'&&staticButton.getAttribute('href')==='/original';
      redraw();
      return iconOkay&&imageOkay&&buttonOkay&&restored&&document.querySelector('#static-logo')===staticLogo
        &&document.querySelector('#static-button')===staticButton&&staticClicks===1;
    })()`), true);
  });
  await t.test('visual property validation rejects executable payloads and functional buttons stay protected', async () => {
    assert.equal(await evaluate(`(()=>{
      const protectedIDs=[...baseline.nodes.values()].map(value=>value.element.id);
      const safe=!protectedIDs.includes('functional')&&!protectedIDs.includes('functional-link')
        &&!baseline.nodes.get(nodeId('visuals')).deletable
        &&protectedIDs.includes('static-native');
      document.querySelector('#static-icon').click();clickLabel('編輯元件屬性');
      const pane=document.querySelector('[role=dialog]');pane.querySelector('[aria-label="Material 圖示名稱"]').value='<svg onload=alert(1)>';
      const count=changes;clickLabel('套用元件屬性',pane);
      const rejected=changes===count&&pane.isConnected&&!document.querySelector('#static-icon svg');
      clickLabel('關閉',pane);
      return safe&&rejected;
    })()`), true);
  });
  await t.test('buttons, icons and logos support insertion, properties, ordering and deletion', async () => {
    assert.equal(await evaluate(`(()=>{
      for(const [label,kind] of [['按鈕','button'],['圖示／符號','icon'],['標誌圖片','logo']]){
        add(label);
        let pane=document.querySelector('[role=dialog]');
        if(kind==='logo'){
          pane.querySelector('[aria-label="公開媒體網址"]').value='/logo-new.png';clickLabel('套用媒體網址',pane);
        }else{
          pane.querySelector('[aria-label="'+(kind==='button'?'按鈕文字':'圖示說明')+'"]').value='Accessible visual';
          const glyph=pane.querySelector('[aria-label="'+(kind==='button'?'Material 圖示名稱（可留空）':'Material 圖示名稱')+'"]');
          glyph.value='favorite';
          if(kind==='button'){pane.querySelector('[aria-label="連結網址"]').value='/action';pane.querySelector('[aria-label="按鈕樣式"]').value='secondary';}
          clickLabel('套用元件屬性',pane);
        }
        const block=draft.blocks.find(value=>value.type===kind);
        if(!block)return false;
        const node=document.querySelector('[data-site-editor-block="'+block.id+'"]');
        const okay=kind==='button'?node.querySelector('a.site-editor-variant-secondary[href="/action"]')
          :kind==='icon'?node.querySelector('.site-editor-icon[aria-label="Accessible visual"]')
          :node.querySelector('img.site-editor-logo[src="/logo-new.png"]');
        if(!okay)return false;
        node.click();clickLabel('向前移動（Alt + ↑）');
        if(!draft.orders[block.parent].includes(block.id))return false;
        clickLabel('刪除元件');
        if(draft.blocks.some(value=>value.id===block.id))return false;
      }
      return true;
    })()`), true);
  });
  await t.test('existing static visual deletion hides original nodes and restores without touching functional controls', async () => {
    assert.equal(await evaluate(`(()=>{
      const targets=['static-icon','static-logo','static-button','static-native'];
      const originals=targets.map(id=>document.getElementById(id));
      const runtime=document.getElementById('functional');let actions=0;runtime.addEventListener('click',()=>actions++);
      for(const node of originals){node.click();clickLabel('刪除元件');if(!node.hidden||!draft.patches[nodeId(node.id)]?.deleted)return false;}
      runtime.click();
      inline.stop();baseline.restore();
      const okay=originals.every(node=>!node.hidden&&document.getElementById(node.id)===node)&&actions===1;
      redraw();return okay&&!runtime.hidden&&!runtime.closest('[hidden]');
    })()`), true);
  });
  await t.test('stop is teardown only and never implicitly flushes dirty text', async () => {
    assert.equal(await evaluate(`(()=>{
      inputText(document.querySelector('#foreign [contenteditable]'),'Transient only');
      const before=changes;inline.stop();
      const clean=changes===before&&document.querySelector('#foreign').textContent==='Different parent'
        &&!document.querySelector('.site-editor-inline-ui');
      inline.start();return clean;
    })()`), true);
  });
  await t.test('inactive lifecycle removes only owned wrappers and never commits after revocation', async () => {
    assert.equal(await evaluate(`(()=>{
      const node=document.querySelector('#foreign [contenteditable]');inputText(node,'Uncommitted');
      const isolated=baseline.texts.get(textId('Different parent')).node.nodeValue==='Different parent';
      const before=changes;allowed=false;inline.stop();
      return changes===before&&!document.querySelector('[contenteditable]')&&!document.querySelector('.site-editor-inline-ui')
        && isolated&&document.querySelector('#foreign').textContent==='Different parent'
        && originalStrong===document.querySelector('strong')&&originalInput===document.querySelector('#widget input');
    })()`), true);
  });
  assert.deepEqual(errors, []);
});
