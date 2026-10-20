const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
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
  const profileDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gisneyland-browser-'));
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
      result.maybeSingle = async () => ({ data: profile, error: null });
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
