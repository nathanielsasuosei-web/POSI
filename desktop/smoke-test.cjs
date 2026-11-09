'use strict';

// Self test for the packaged app, used by CI (see scripts/smoke.mjs). It only
// runs when POSI_SMOKE_TEST=<results folder> is set, always uses a throwaway
// profile, and never touches real shop records.
//
//   POSI_SMOKE_PHASE=setup   create a store, sign in, export a backup, print to PDF
//   POSI_SMOKE_PHASE=reopen  restart on the same profile: the store must still be there
//
// Results: summary.json plus screenshots in the results folder.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { session } = require('electron');

const OUTPUT_DIR = path.resolve(process.env.POSI_SMOKE_TEST || 'smoke-results');
const PHASE = process.env.POSI_SMOKE_PHASE === 'reopen' ? 'reopen' : 'setup';
const TIMEOUT_MS = 120000;
const STORE = { shopName: 'Smoke Test Pharmacy', address: 'Osu, Accra', phone: '0300000000', name: 'Smoke Owner', username: 'smoke', password: 'smoke-test-1' };

const checks = [];
const problems = [];
let finished = false;
let onDownload = null;
const messageBoxes = [];

function prepare(app) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const profile = process.env.POSI_SMOKE_PROFILE
    ? path.resolve(process.env.POSI_SMOKE_PROFILE)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'posi-smoke-'));
  fs.mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
  app.disableHardwareAcceleration(); // CI machines have no GPU
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail === undefined ? '' : String(detail) });
  if (!ok) throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
}

// Message boxes are answered automatically ("OK") and recorded for the checks.
function answerMessageBox(kind, message) {
  messageBoxes.push({ kind, message });
  return true;
}

function handleDownload(item) {
  const target = path.join(OUTPUT_DIR, item.getFilename());
  item.setSavePath(target);
  item.once('done', (_event, state) => {
    if (onDownload) onDownload({ state, target });
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const loaded = contents => new Promise(resolve => contents.once('did-finish-load', resolve));

function pageTools(contents) {
  const js = code => contents.executeJavaScript(code, true);
  const quote = value => JSON.stringify(value);
  return {
    js,
    async waitFor(selector, timeout = 20000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        try {
          if (await js(`Boolean(document.querySelector(${quote(selector)}))`)) return;
        } catch (error) {
          // The page is still loading or navigating; try again.
        }
        await sleep(150);
      }
      throw new Error(`Timed out waiting for ${selector}`);
    },
    setValue(selector, value) {
      // React listens for "input" events; set the value the way typing would.
      return js(`(() => {
        const el = document.querySelector(${quote(selector)});
        if (!el) throw new Error('Missing ' + ${quote(selector)});
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${quote(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
    },
    click(selector) {
      return js(`(() => {
        const el = document.querySelector(${quote(selector)});
        if (!el) throw new Error('Missing ' + ${quote(selector)});
        el.click();
      })()`);
    },
    clickText(selector, text) {
      return js(`(() => {
        const el = Array.from(document.querySelectorAll(${quote(selector)})).find(node => node.textContent.includes(${quote(text)}));
        if (!el) throw new Error('No ' + ${quote(selector)} + ' containing ' + ${quote(text)});
        el.click();
      })()`);
    },
    text(selector) {
      return js(`(document.querySelector(${quote(selector)}) || {}).textContent || ''`);
    },
    async screenshot(name) {
      const image = await contents.capturePage();
      fs.writeFileSync(path.join(OUTPUT_DIR, name), image.toPNG());
    },
  };
}

async function signIn(page) {
  await page.setValue('#login-username', STORE.username);
  await page.setValue('#login-password', STORE.password);
  await page.click('.login-card button.btn.primary');
  await page.waitFor('.app-shell');
}

async function setupPhase(app, contents, page) {
  await page.waitFor('.setup-page');
  const env = await page.js(`({
    desktop: Boolean(window.posiDesktop && window.posiDesktop.isDesktop),
    version: window.posiDesktop ? window.posiDesktop.version : '',
    origin: location.origin,
    secure: window.isSecureContext,
    webCrypto: Boolean(window.crypto && window.crypto.subtle),
    engine: (navigator.userAgent.match(/Chrome\\/[\\d.]+/) || [''])[0],
    styled: getComputedStyle(document.querySelector('.setup-page')).display === 'grid',
    noNode: typeof require === 'undefined' && typeof process === 'undefined',
  })`);
  const sandbox = app.commandLine.hasSwitch('no-sandbox') ? 'sandbox off (Windows 24H2+ workaround)' : 'sandbox on';
  check('App window opens on the setup screen', true, `${env.engine} · ${env.origin} · ${sandbox}`);
  check('Desktop bridge is available', env.desktop && env.version, `POSI ${env.version}`);
  check('Secure origin with Web Crypto', env.secure && env.webCrypto && env.origin === 'posi://app', env.origin);
  check('Styles are applied', env.styled);
  check('Page has no Node.js access', env.noNode);
  await page.screenshot('1-setup.png');

  const fields = { shopName: STORE.shopName, address: STORE.address, phone: STORE.phone, name: STORE.name, username: STORE.username, password: STORE.password, confirm: STORE.password };
  for (const [key, value] of Object.entries(fields)) await page.setValue(`#setup-${key}`, value);
  await page.click('.setup-card button[type=submit]');
  await page.waitFor('#login-username');
  check('Store setup is saved', true);

  await signIn(page);
  check('Owner can sign in', true);
  await sleep(500);
  const chip = (await page.text('.top-actions .chip')).trim();
  check('Status shows the desktop app', chip.includes('Desktop app'), chip);
  await page.screenshot('2-dashboard.png');

  const answered = await page.js(`(() => { const ok = window.confirm('Smoke test question'); window.alert('Smoke test notice'); return ok; })()`);
  const kinds = messageBoxes.map(box => box.kind).join(', ');
  check('alert() and confirm() use desktop message boxes', answered === true && kinds === 'confirm, alert', kinds || 'none received');

  await page.clickText('.nav-item', 'Settings');
  await page.waitFor('.settings-nav');
  await page.clickText('.settings-nav button', 'Data & security');
  await sleep(400);
  const settingsText = await page.text('.settings-content');
  check('Settings explain where desktop records are kept', settingsText.includes('this computer'), '');
  await page.screenshot('3-settings.png');

  const download = new Promise((resolve, reject) => {
    onDownload = resolve;
    setTimeout(() => reject(new Error('No backup download within 20 seconds')), 20000);
  });
  await page.clickText('.settings-action-row button', 'Export JSON');
  const { state, target } = await download;
  const backup = JSON.parse(fs.readFileSync(target, 'utf8'));
  check('Backup export downloads a complete file', state === 'completed' && backup.app === 'POSI' && backup.data.settings.shopName === STORE.shopName, path.basename(target));

  const pdf = await contents.printToPDF({ printBackground: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, '4-print-test.pdf'), pdf);
  check('Printing pipeline works', pdf.length > 500 && pdf.slice(0, 4).toString() === '%PDF', `${pdf.length} bytes`);

  session.defaultSession.flushStorageData();
  const reloaded = loaded(contents);
  contents.reload();
  await reloaded;
  await page.waitFor('.app-shell, #login-username');
  const stored = await page.js(`Boolean(localStorage.getItem('posi-live-v1-setup'))`);
  check('Records survive a reload', stored);
}

async function reopenPhase(page) {
  await page.waitFor('#login-username, .setup-page');
  const onSetup = await page.js(`Boolean(document.querySelector('.setup-page'))`);
  check('Store is still there after restarting the app', !onSetup, onSetup ? 'setup screen was shown again' : 'sign-in screen shown');
  await signIn(page);
  const shopName = (await page.text('.shop-copy b')).trim();
  check('Saved store details load after restart', shopName === STORE.shopName, shopName);
  await sleep(300);
  await page.screenshot('5-after-restart.png');
}

function finish(app, error) {
  if (finished) return;
  finished = true;
  if (error) {
    const message = error.message || String(error);
    if (!checks.some(item => !item.ok)) checks.push({ name: 'Smoke test', ok: false, detail: message });
  }
  const ok = !error && checks.length > 0 && checks.every(item => item.ok) && problems.length === 0;
  const summary = {
    ok,
    phase: PHASE,
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    arch: process.arch,
    os: `${os.type()} ${os.release()}`,
    sandbox: !app.commandLine.hasSwitch('no-sandbox'),
    checks,
    problems,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  try { session.defaultSession.flushStorageData(); } catch (flushError) { /* quitting */ }
  setTimeout(() => app.exit(ok ? 0 : 1), 1500);
}

function run(app, win) {
  const contents = win.webContents;
  contents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 3) problems.push(`Console error: ${message} (${sourceId}:${line})`);
  });
  contents.on('did-fail-load', (_event, code, description, url) => {
    if (code !== -3) problems.push(`Failed to load ${url}: ${code} ${description}`); // -3: navigation replaced by a newer one
  });
  contents.on('render-process-gone', (_event, details) => {
    problems.push(`Renderer stopped: ${details.reason}`);
    finish(app, new Error(`Renderer stopped: ${details.reason}`));
  });
  const timer = setTimeout(() => finish(app, new Error(`Timed out after ${TIMEOUT_MS / 1000} seconds`)), TIMEOUT_MS);

  const page = pageTools(contents);
  const ready = contents.isLoading() ? loaded(contents) : Promise.resolve();
  ready
    .then(() => (PHASE === 'reopen' ? reopenPhase(page) : setupPhase(app, contents, page)))
    .then(() => {
      if (problems.length) checks.push({ name: 'No console or loading errors', ok: false, detail: problems.join(' | ') });
      else checks.push({ name: 'No console or loading errors', ok: true, detail: '' });
      finish(app);
    })
    .catch(error => finish(app, error))
    .finally(() => clearTimeout(timer));
}

module.exports = { prepare, run, handleDownload, answerMessageBox };
