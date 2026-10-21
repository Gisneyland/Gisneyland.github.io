const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

test('site initialization and permission-gated admin interactions', {
  skip: !process.env.CHROMIUM_BIN && 'Set CHROMIUM_BIN and build Jekyll first to run browser regressions.',
  timeout: 60000
}, async t => {
  const site = path.resolve(__dirname, '../_site');
  await fs.access(path.join(site, 'index.html'));
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const filename = path.resolve(site, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!filename.startsWith(`${site}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const content = await fs.readFile(filename);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profileDirectory = path.resolve(__dirname, '../.jekyll-cache', `site-interactions-browser-${process.pid}`);
  await fs.mkdir(profileDirectory, { recursive: true });
  t.after(() => fs.rm(profileDirectory, { recursive: true, force: true, maxRetries: 5 }));
  const browser = spawn(process.env.CHROMIUM_BIN, [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--remote-debugging-port=0', `--user-data-dir=${profileDirectory}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  t.after(async () => {
    if (browser.exitCode !== null) return;
    const exited = new Promise(resolve => browser.once('exit', resolve));
    browser.kill();
    await exited;
  });
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chromium startup timed out')), 20000);
    let output = '';
    browser.stderr.on('data', data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(new URL(match[1]).origin.replace('ws:', 'http:')); }
    });
    browser.once('error', error => { clearTimeout(timer); reject(error); });
    browser.once('exit', code => { clearTimeout(timer); reject(new Error(`Chromium exited: ${code}`)); });
  });
  const targets = await (await fetch(`${endpoint}/json`)).json();
  const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  t.after(() => socket.close());
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callback.reject(new Error(message.error.message));
      else callback.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++sequence, { resolve, reject });
    socket.send(JSON.stringify({ id: sequence, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, result.exceptionDetails?.exception?.description);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail(`Timed out waiting for ${expression}`);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const mode = new URLSearchParams(location.search).get('fixture');
    const profile = {
      user_id: 'fixture-user', nickname: 'Test', approval_status: mode === 'pending' ? 'pending' : 'approved',
      account_role: mode === 'reader' ? 'screener' : 'administrator', permissions: ['questionnaire.read'],
      privacy_consent_at: '2026-10-01', screener_number: 'TEST'
    };
    const user = {
      id: profile.user_id, email: 'test@example.test',
      user_metadata: JSON.parse(sessionStorage.getItem('fixture-metadata-' + mode) || '{}')
    };
    function query(table) {
      const result = {};
      for (const method of ['select', 'eq', 'order', 'range', 'limit', 'is', 'not']) result[method] = () => result;
      result.maybeSingle = async () => ({ data: table.startsWith('site_editor_') ? null : profile, error: null });
      result.then = resolve => resolve({ data: table === 'admin_profiles' ? [profile] : [], error: null });
      return result;
    }
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: mode === 'anonymous' ? null : { user } }, error: null }),
        onAuthStateChange() {},
        updateUser: async ({ data }) => {
          user.user_metadata = { ...user.user_metadata, ...data };
          sessionStorage.setItem('fixture-metadata-' + mode, JSON.stringify(user.user_metadata));
          return { data: { user }, error: null };
        }
      },
      from: query,
      functions: { invoke: async () => ({ error: new Error('Offline fixture') }) }
    }) };
    window.fetch = async () => { throw new Error('External requests disabled in regression tests'); };
  ` });
  const open = async (route, fixture) => {
    errors.length = 0;
    await send('Page.navigate', { url: `${origin}${route}?fixture=${fixture}` });
    await waitFor('document.readyState === "complete"');
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const hidden = id => evaluate(`document.getElementById(${JSON.stringify(id)}).hidden`);

  await t.test('admin favicon and compact icon navigation work before and after login', async () => {
    await open('/admin/', 'anonymous');
    await waitFor('!document.getElementById("admin-login").hidden');
    const favicon = await evaluate('document.querySelector(\'link[rel="icon"]\').getAttribute("href")');
    assert.equal(favicon, '/assets/images/favicon.ico');
    const iconResponse = await fetch(`${origin}${favicon}`);
    assert.equal(iconResponse.ok, true);
    assert.deepEqual(Array.from(new Uint8Array(await iconResponse.arrayBuffer()).slice(0, 4)), [0, 0, 1, 0]);
    assert.equal(await hidden('open-questionnaire-button'), true);
    assert.equal(await hidden('sign-out-button'), true);
    assert.equal(await evaluate('document.getElementById("admin-home-button").title'), '回到首頁');
    await click('#admin-home-button');
    await waitFor('location.pathname === "/"');

    await open('/admin/', 'administrator');
    await waitFor('!document.getElementById("open-questionnaire-button").hidden');
    for (const id of ['admin-home-button', 'open-questionnaire-button', 'sign-out-button']) {
      const state = await evaluate(`(() => {
        const button = document.getElementById(${JSON.stringify(id)});
        const style = getComputedStyle(button);
        const bounds = button.getBoundingClientRect();
        return {
          title: button.title, label: button.getAttribute('aria-label'),
          decoration: style.textDecorationLine, width: bounds.width, height: bounds.height,
          text: [...button.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim()
        };
      })()`);
      assert.ok(state.title);
      assert.equal(state.title, state.label);
      assert.equal(state.decoration, 'none');
      assert.ok(state.width <= 40 && state.height <= 40);
      assert.equal(state.text, '');
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".admin-header-actions")).display'), 'flex');
    assert.ok(await evaluate('document.getElementById("open-questionnaire-button").getBoundingClientRect().width <= 40'));
    await send('Emulation.clearDeviceMetricsOverride');
    assert.deepEqual(errors, []);
  });

  await t.test('public navigation, theme, language and staff login buttons respond', async () => {
    await open('/', 'anonymous');
    await waitFor('document.querySelector(".staff-session-tool").dataset.state === "signed-out"');
    await click('#navigation-more-button');
    assert.equal(await hidden('navigation-more-menu'), false);
    await click('#navigation-more-button');
    assert.equal(await hidden('navigation-more-menu'), true);
    const previousTheme = await evaluate('document.documentElement.dataset.theme');
    await click('#theme-toggle-button');
    assert.notEqual(await evaluate('document.documentElement.dataset.theme'), previousTheme);
    await click('#language-button');
    assert.equal(await hidden('language-menu'), false);
    await click('.language-option[data-language="en"]');
    assert.equal(await evaluate('document.documentElement.lang'), 'en');
    await click('#staff-session-button');
    assert.equal(await hidden('staff-session-menu'), false);
    assert.equal(await hidden('staff-login-form'), false);
    await click('[data-staff-login-mode="otp"]');
    assert.equal(await hidden('staff-login-password-field'), true);
    assert.deepEqual(errors, []);
  });

  await t.test('admin theme reads shared preference, follows OS auto and styles dark panels and buttons', async () => {
    await open('/', 'anonymous');
    await evaluate(`localStorage.setItem('site-mode','dark')`);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await open('/admin/', 'anonymous');
    await waitFor('!document.getElementById("admin-login").hidden');
    assert.equal(await evaluate(`document.documentElement.dataset.mode==='dark'
      &&document.documentElement.dataset.theme==='dark'&&localStorage.getItem('site-mode')==='dark'`), true);
    assert.deepEqual(await evaluate(`(() => {
      const panel=getComputedStyle(document.getElementById('admin-login'));
      const button=getComputedStyle(document.querySelector('#login-form button[type=submit]'));
      return {background:getComputedStyle(document.body).backgroundColor,panel:panel.backgroundColor,
        button:button.backgroundColor,buttonText:button.color};
    })()`), { background:'rgb(23, 32, 43)',panel:'rgb(32, 44, 58)',button:'rgb(132, 209, 197)',buttonText:'rgb(23, 32, 43)' });
    await click('#admin-theme-auto');
    assert.equal(await evaluate(`localStorage.getItem('site-mode')==='auto'
      &&document.documentElement.dataset.mode==='auto'&&document.documentElement.dataset.theme==='light'`), true);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await waitFor('document.documentElement.dataset.theme === "dark"');
    await click('#theme-toggle-button');
    assert.equal(await evaluate(`localStorage.getItem('site-mode')==='light'
      &&document.documentElement.dataset.mode==='light'&&document.documentElement.dataset.theme==='light'`), true);
    await evaluate(`localStorage.setItem('site-mode','dark');window.dispatchEvent(new StorageEvent('storage',{key:'site-mode',newValue:'dark'}))`);
    assert.equal(await evaluate(`document.documentElement.dataset.theme==='dark'&&document.documentElement.dataset.mode==='dark'`), true);
    await evaluate(`localStorage.removeItem('site-mode')`);
    await send('Emulation.setEmulatedMedia', { features: [] });
    assert.deepEqual(errors, []);
  });

  await t.test('news occupies the main service slot and services moves into more on mobile', async () => {
    await open('/', 'anonymous');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".bottom-nav > a")].map(link => new URL(link.href).pathname)'), [
      '/', '/news/', '/activity/', '/services/'
    ]);
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await click('#navigation-more-button');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".desktop-services-link")).display'), 'none');
    assert.equal(await evaluate('new URL(document.querySelector(".navigation-more-mobile-link").href).pathname'), '/services/');
    assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".navigation-more-mobile-link")).display'), 'none');
    await send('Emulation.clearDeviceMetricsOverride');
    assert.deepEqual(errors, []);
  });

  await t.test('visual navigation editing stays open with production navbar interactions', async () => {
    await open('/', 'administrator');
    await waitFor('document.getElementById("site-editor-button").hidden === false');
    await click('#site-editor-button');
    await waitFor('document.body.classList.contains("site-editor-editing")');
    assert.equal(await evaluate(`!document.getElementById('site-editor-settings')
      &&!document.getElementById('site-editor-text')&&!document.getElementById('site-editor-node')
      &&document.querySelector('.site-navigation').contains(document.getElementById('site-editor-nav'))`), true);
    await click('#site-editor-nav-toggle');
    await click('#site-editor-nav-more');
    await click('#site-editor-nav-add');
    assert.equal(await hidden('navigation-more-menu'), false);
    assert.ok(await evaluate(`document.getElementById('site-editor-nav').getBoundingClientRect().top>=7`));
    await evaluate(`document.getElementById('site-editor-nav-label').value='Visual more link';
      document.getElementById('site-editor-nav-url').value='/contact/'`);
    await click('#site-editor-nav-apply');
    assert.equal(await hidden('navigation-more-menu'), false);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('#navigation-more-menu > a')).some(a=>a.textContent==='Visual more link')`), true);
    await click('#navigation-more-menu > a');
    assert.equal(await evaluate(`location.pathname==='/'&&!document.getElementById('site-editor-nav-form').hidden
      &&!document.getElementById('navigation-more-menu').hidden`), true);
    await click('#site-editor-nav-close');
    assert.equal(await hidden('site-editor-nav'), true);
    assert.equal(await hidden('navigation-more-menu'), true);
    await click('#site-editor-close');
    assert.equal(await evaluate(`!document.body.classList.contains('site-editor-editing')
      &&document.getElementById('site-editor').hidden&&document.getElementById('site-editor-nav-toggle').hidden`), true);
    assert.deepEqual(errors, []);
  });

  await t.test('visual button variants override legacy styles and icons and logos have bounded sizing', async () => {
    await open('/', 'anonymous');
    const styles = await evaluate(`(() => {
      const container=document.createElement('div');container.className='site-editor-content-block';
      document.getElementById('main-content').append(container);
      const values={};
      for(const variant of ['primary','secondary','outline','text']){
        const node=document.createElement('a');node.className='btn site-editor-button site-editor-variant-'+variant;
        node.href='/';node.textContent=variant;container.append(node);
        const style=getComputedStyle(node);values[variant]={background:style.backgroundColor,color:style.color,
          display:style.display,minHeight:style.minHeight,border:style.borderTopColor};
      }
      const icon=document.createElement('span');icon.className='material-icons site-editor-icon';icon.textContent='star';container.append(icon);
      const logo=document.createElement('img');logo.className='site-editor-logo';container.append(logo);
      values.iconSize=getComputedStyle(icon).fontSize;values.logoHeight=getComputedStyle(logo).maxHeight;
      container.remove();return values;
    })()`);
    for (const variant of ['primary', 'secondary', 'outline', 'text']) {
      assert.equal(styles[variant].display, 'inline-flex');
      assert.equal(styles[variant].minHeight, '44px');
    }
    assert.notEqual(styles.primary.background, styles.secondary.background);
    assert.notEqual(styles.primary.color, styles.secondary.color);
    assert.equal(styles.outline.background, 'rgba(0, 0, 0, 0)');
    assert.equal(styles.outline.border, styles.outline.color);
    assert.equal(styles.text.background, 'rgba(0, 0, 0, 0)');
    assert.equal(styles.text.border, 'rgba(0, 0, 0, 0)');
    assert.ok(parseFloat(styles.iconSize) >= 30);
    assert.equal(styles.logoHeight, '120px');
    assert.deepEqual(errors, []);
  });

  await t.test('editor command bar, navigation and property controls inherit public light and dark themes', async () => {
    await open('/', 'administrator');
    await waitFor('document.getElementById("site-editor-button").hidden === false');
    await click('#site-editor-button');
    await waitFor('document.body.classList.contains("site-editor-editing")');
    await click('#site-editor-nav-toggle');
    for (const mode of ['light', 'dark']) {
      const result = await evaluate(`(() => {
        document.documentElement.dataset.theme=${JSON.stringify(mode)};
        const reference=document.createElement('div');
        reference.style.cssText='background:var(--surface);color:var(--text);border:1px solid var(--border)';
        document.body.append(reference);
        const expectedStyle=getComputedStyle(reference);
        const expected={background:expectedStyle.backgroundColor,color:expectedStyle.color,border:expectedStyle.borderTopColor};
        reference.style.background='var(--surface-muted)';
        const muted=getComputedStyle(reference).backgroundColor;
        const pane=document.createElement('div');pane.className='site-editor-inline-ui';
        const input=document.createElement('input'),textarea=document.createElement('textarea');
        const select=document.createElement('select'),button=document.createElement('button');
        pane.append(input,textarea,select,button);document.body.append(pane);
        const controls=[document.getElementById('site-editor'),document.getElementById('site-editor-nav'),
          document.getElementById('site-editor-page'),document.getElementById('site-editor-nav-label'),
          document.getElementById('site-editor-nav-icon'),document.getElementById('site-editor-nav-src'),
          document.getElementById('site-editor-nav-alt'),
          document.getElementById('site-editor-reopen'),pane,input,textarea].map(node=>{const style=getComputedStyle(node);return {background:style.backgroundColor,color:style.color,border:style.borderTopColor}});
        const mutedControls=[select,button,document.getElementById('site-editor-save'),
          document.getElementById('site-editor-status')].map(node=>{const style=getComputedStyle(node);return {background:style.backgroundColor,color:style.color}});
        reference.remove();pane.remove();return {expected,muted,controls,mutedControls};
      })()`);
      for (const actual of result.controls) assert.deepEqual(actual, result.expected, mode);
      for (const actual of result.mutedControls) {
        assert.equal(actual.background, result.muted, mode);
        assert.equal(actual.color, result.expected.color, mode);
      }
    }
    await click('#site-editor-close');
    assert.deepEqual(errors, []);
  });

  await t.test('questionnaire restores bound screener, interpretation, referral and photo controls', async () => {
    await open('/hiva/', 'administrator');
    await waitFor('document.getElementById("screener").dataset.bindingReady === "true"');
    assert.equal(await evaluate('document.getElementById("screener").value'), 'TEST');
    assert.equal(await evaluate('document.getElementById("screening_place").value'), '');
    await click('input[name="screening_interpretation[]"][value="hiv_positive"]');
    assert.equal(await hidden('hiv-positive-referral'), false);
    assert.equal(await evaluate('document.querySelector(".screening-photo-field[data-photo-kind=hiv]").hidden'), false);
    const contacts = await evaluate('document.getElementById("hiv-contact-list").children.length');
    await click('#hiv-contact-add');
    assert.equal(await evaluate('document.getElementById("hiv-contact-list").children.length'), contacts + 1);
    await click('input[name="screening_interpretation[]"][value="hiv_negative"]');
    assert.equal(await hidden('hiv-positive-referral'), true);
    assert.equal(await evaluate('document.querySelector("input[value=hiv_positive]").checked'), false);
    assert.deepEqual(errors, []);
  });

  await t.test('questionnaire compresses a large noisy image using the actual browser JPEG encoder', async () => {
    await open('/hiva/', 'administrator');
    const result = await evaluate(`(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1800;
      const context = canvas.getContext('2d');
      const image = context.createImageData(canvas.width, canvas.height);
      let seed = 12345;
      for (let i = 0; i < image.data.length; i += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          image.data[i + channel] = seed >>> 24;
        }
        image.data[i + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      const original = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const compressed = await compressScreeningPhoto(original);
      const decoded = await createImageBitmap(compressed);
      const result = {
        originalBytes: original.size, bytes: compressed.size, type: compressed.type,
        width: decoded.width, height: decoded.height
      };
      decoded.close();
      return result;
    })()`);
    assert.ok(result.originalBytes > 2_500_000);
    assert.ok(result.bytes > 0 && result.bytes <= 500_000);
    assert.equal(result.type, 'image/jpeg');
    assert.ok(result.width <= 1280);
    assert.equal(result.width / result.height, 4 / 3);
    assert.deepEqual(errors, []);
  });

  await t.test('administrator sees content, staff management and editable screening rules', async () => {
    await open('/admin/', 'administrator');
    await waitFor('!document.getElementById("admin-tab-content").hidden');
    assert.deepEqual(errors, []);
    assert.equal(await hidden('staff-management'), false);
    await click('#admin-tab-settings');
    await click('#add-screening-plan-rule');
    assert.equal(await evaluate('document.getElementById("screening-plan-rules").children.length'), 2);
    assert.equal(await evaluate('document.querySelector(".screening-plan-rule-number")'), null);
    await click('.screening-plan-rule-collapse');
    assert.match(await evaluate('document.querySelector(".screening-plan-rule-summary").textContent'), /每週/);
    await click('#admin-tab-content');
    await click('#new-site-content-button');
    assert.equal(await evaluate('document.getElementById("site-content-editor").open'), true);
    await click('#close-site-content-editor');
    assert.equal(await evaluate('document.getElementById("site-content-editor").open'), false);
    assert.deepEqual(errors, []);
  });

  await t.test('screener can delete the last rule, save an empty schedule and add rules again after reload', async () => {
    await open('/admin/', 'reader');
    await waitFor('!document.getElementById("admin-dashboard").hidden');
    await click('#admin-tab-settings');
    assert.equal(await evaluate('document.querySelectorAll(".screening-plan-rule").length'), 1);
    await click('.screening-plan-rule-remove');
    assert.equal(await evaluate('document.querySelectorAll(".screening-plan-rule").length'), 0);
    await click('#save-screening-plan');
    await waitFor('document.getElementById("screening-plan-status").textContent.includes("沒有固定篩檢排程")');
    assert.deepEqual(await evaluate('JSON.parse(sessionStorage.getItem("fixture-metadata-reader")).screening_preferences'), {
      version: 2, rules: []
    });
    await open('/admin/', 'reader');
    await waitFor('!document.getElementById("admin-dashboard").hidden');
    await click('#admin-tab-settings');
    assert.equal(await evaluate('document.querySelectorAll(".screening-plan-rule").length'), 0);
    assert.match(await evaluate('document.getElementById("screening-plan-next").textContent'), /尚未設定有效排程/);
    await click('#add-screening-plan-rule');
    assert.equal(await evaluate('document.querySelectorAll(".screening-plan-rule").length'), 1);
    assert.deepEqual(errors, []);
  });

  await t.test('screening and event searches use fallback results and save selected coordinates', async () => {
    await open('/admin/', 'administrator');
    await waitFor('!document.getElementById("admin-tab-content").hidden');
    await evaluate(`(() => {
      const originalFetch = window.fetch;
      window.placeSearchCalls = [];
      window.fetch = async (url, options) => {
        const parsed = new URL(url);
        if (!['photon.komoot.io', 'nominatim.openstreetmap.org'].includes(parsed.hostname)) return originalFetch(url, options);
        window.placeSearchCalls.push(url);
        if (parsed.hostname === 'photon.komoot.io') return { ok: false };
        return { ok: true, json: async () => [{ lat: '24.8', lon: '120.97', name: '測試地點', display_name: '測試地點，新竹市' }] };
      };
    })()`);
    await click('#admin-tab-settings');
    await evaluate(`(() => {
      const input = document.querySelector('.screening-plan-rule-place');
      input.value = '測試地點';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    })()`);
    await waitFor('document.querySelector(".screening-plan-place-option")?.textContent === "測試地點，新竹市"');
    await click('.screening-plan-place-option');
    await click('.screening-plan-rule-weekly input[value="1"]');
    await click('#save-screening-plan');
    await waitFor('document.getElementById("screening-plan-status").textContent.includes("已儲存 1 筆")');
    assert.deepEqual(await evaluate('JSON.parse(sessionStorage.getItem("fixture-metadata-administrator")).screening_preferences.rules[0].place.coordinates'), [120.97, 24.8]);
    await click('#admin-tab-content');
    await click('#new-site-content-button');
    await evaluate(`(() => {
      const type = document.getElementById('site-content-type');
      type.value = 'event';
      type.dispatchEvent(new Event('change'));
      document.getElementById('site-content-location').value = '測試地點';
    })()`);
    await click('#event-location-search');
    await waitFor('!document.getElementById("event-location-results").hidden');
    await evaluate(`(() => {
      const select = document.getElementById('event-location-results');
      select.value = '0';
      select.dispatchEvent(new Event('change'));
    })()`);
    assert.equal(await evaluate('document.getElementById("site-content-location").value'), '測試地點，新竹市');
    assert.equal(await evaluate('document.getElementById("event-location-latitude").value'), '24.800000');
    assert.equal(await evaluate('document.getElementById("event-location-longitude").value'), '120.970000');
    assert.equal(await evaluate('window.placeSearchCalls.length'), 4);
    assert.deepEqual(errors, []);
  });

  await t.test('scheduling information stays hidden until opened and closes through every dismissal control', async () => {
    await open('/admin/', 'administrator');
    await waitFor('!document.getElementById("admin-tab-content").hidden');
    await click('#admin-tab-settings');
    const dialogState = () => evaluate(`(() => {
      const dialog = document.getElementById('screening-plan-info-dialog');
      return { open: dialog.open, display: getComputedStyle(dialog).display, visible: dialog.getClientRects().length > 0 };
    })()`);
    const closedState = { open: false, display: 'none', visible: false };
    assert.deepEqual(await dialogState(), closedState);
    for (const selector of [
      '#screening-plan-info-dialog .dialog-header [data-close-screening-plan-info]',
      '#screening-plan-info-dialog > [data-close-screening-plan-info]'
    ]) {
      await click('#screening-plan-info-button');
      assert.deepEqual(await dialogState(), { open: true, display: 'grid', visible: true });
      await click(selector);
      assert.deepEqual(await dialogState(), closedState);
    }
    await click('#screening-plan-info-button');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor('!document.getElementById("screening-plan-info-dialog").open');
    assert.deepEqual(await dialogState(), closedState);
    await click('#screening-plan-info-button');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1, y: 1, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1, y: 1, button: 'left', clickCount: 1 });
    assert.deepEqual(await dialogState(), closedState);
    assert.deepEqual(errors, []);
  });

  await t.test('restricted and pending staff do not gain management access', async () => {
    await open('/admin/', 'reader');
    await waitFor('!document.getElementById("admin-dashboard").hidden');
    assert.equal(await hidden('admin-tab-content'), true);
    assert.equal(await hidden('staff-management'), true);
    assert.equal(await hidden('admin-tab-questionnaire'), false);
    assert.deepEqual(errors, []);
    await open('/admin/', 'pending');
    await waitFor('!document.getElementById("staff-access-gate").hidden');
    for (const id of ['admin-tab-questionnaire', 'admin-tab-content', 'admin-tab-settings', 'staff-management']) {
      assert.equal(await hidden(id), true);
    }
    assert.deepEqual(errors, []);
  });
});
