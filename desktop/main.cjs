'use strict';

// POSI desktop shell. Built on Electron 22 (Chromium 108) because it is the last
// Electron release that runs on Windows 7, 8 and 8.1 — see desktop/README.md.
// Electron 22 runs Node 16 and cannot load ES modules here, so this file is CommonJS.

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session, shell } = require('electron');
const { APP_HOST, APP_SCHEME, isAppUrl, isSafeExternalUrl, resolveAppRequest } = require('./app-files.cjs');

const APP_ID = 'com.posi.pharmacy'; // must match "appId" in package.json
const APP_URL = `${APP_SCHEME}://${APP_HOST}/`;
const RENDERER_DIR = path.join(__dirname, 'renderer');
// Shop records live in Chromium's local storage. It is written in batches, so
// push pending writes to disk often: power cuts should lose seconds, not minutes.
const STORAGE_FLUSH_MS = 3000;

// CI-only self test, enabled with POSI_SMOKE_TEST=<results folder>.
const smokeTest = process.env.POSI_SMOKE_TEST ? require('./smoke-test.cjs') : null;

// posi://app is a standard, secure origin: local storage, Web Crypto (password
// hashing) and module scripts behave exactly as on the HTTPS website.
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

if (smokeTest) smokeTest.prepare(app);

let mainWindow = null;

function serveAppFiles() {
  protocol.registerBufferProtocol(APP_SCHEME, (request, respond) => {
    const target = resolveAppRequest(RENDERER_DIR, request.url);
    const notFound = () => respond({ statusCode: 404, mimeType: 'text/plain', charset: 'utf-8', data: Buffer.from('Not found') });
    if (!target) return notFound();
    fs.readFile(target.filePath, (error, data) => {
      if (error) return notFound();
      respond({
        statusCode: 200,
        mimeType: target.mimeType,
        charset: target.charset,
        data,
        headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' },
      });
    });
  });
}

function openExternal(url) {
  if (isSafeExternalUrl(url)) shell.openExternal(url).catch(() => {});
}

// Every page and window stays inside the app. Ordinary links open in the
// default browser; dropped files and other schemes are ignored.
function lockDownWebContents() {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (isAppUrl(url)) return;
      event.preventDefault();
      openExternal(url);
    });
    contents.on('will-attach-webview', event => event.preventDefault());
  });

  // POSI needs no camera, microphone, location or notification access.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

// The page's alert() and confirm() are routed here (see preload.cjs and
// src/platform.js). Electron 22 has a Windows bug where, after its built-in
// alert()/confirm() closes, typing no longer reaches text boxes until the user
// switches to another window and back (electron/electron#31917, fixed only in
// 2026 Electron releases that no longer run on Windows 7/8). A message box
// opened by the app itself does not leave the page in that state.
function handleMessageBoxes() {
  ipcMain.on('posi:message-box', (event, request) => {
    const confirm = Boolean(request) && request.kind === 'confirm';
    const message = request && typeof request.message === 'string' ? request.message : '';
    const reply = value => {
      event.returnValue = value; // the page stays paused until this is set
    };
    const win = BrowserWindow.fromWebContents(event.sender);
    const fromApp = isAppUrl(event.senderFrame ? event.senderFrame.url : event.sender.getURL());
    if (!win || !fromApp) return reply(false);
    if (smokeTest) return reply(smokeTest.answerMessageBox(confirm ? 'confirm' : 'alert', message));
    dialog
      .showMessageBox(win, {
        type: 'none',
        title: 'POSI',
        message,
        buttons: confirm ? ['OK', 'Cancel'] : ['OK'],
        defaultId: 0,
        cancelId: confirm ? 1 : 0,
        noLink: true,
      })
      .then(result => reply(confirm ? result.response === 0 : true))
      .catch(() => reply(false));
  });
}

function defaultSavePath(filename) {
  try {
    return path.join(app.getPath('documents'), filename);
  } catch (error) {
    return filename; // Documents folder unavailable (e.g. redirected to a missing drive)
  }
}

function handleDownloads() {
  // Backups and CSV reports open a "Save as" dialog that starts in Documents.
  session.defaultSession.on('will-download', (_event, item) => {
    if (smokeTest) return smokeTest.handleDownload(item);
    item.setSaveDialogOptions({ title: 'Save from POSI', defaultPath: defaultSavePath(item.getFilename()) });
  });
}

function flushStorage() {
  try {
    session.defaultSession.flushStorageData();
  } catch (error) {
    // The session may already be gone while quitting.
  }
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About POSI',
    message: `POSI ${app.getVersion()}`,
    detail: [
      'Pharmacy operations suite for Windows 7, 8, 8.1, 10 and 11.',
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · ${process.arch === 'ia32' ? '32-bit' : '64-bit'}`,
      '',
      'Shop records are stored on this computer in:',
      app.getPath('userData'),
      '',
      'Export a backup regularly from Settings → Data & security.',
    ].join('\n'),
    buttons: ['OK'],
  }).catch(() => {});
}

function buildMenu() {
  const template = [
    { label: '&File', submenu: [{ role: 'quit', label: 'E&xit POSI' }] },
    {
      label: '&View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: '&Help',
      submenu: [
        { label: 'Open data folder', click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { label: 'About POSI', click: showAbout },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'POSI — Pharmacy Operations',
    backgroundColor: '#f4f7f5',
    autoHideMenuBar: true, // press Alt to show File / View / Help
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false, // drug names are not in the dictionary
      additionalArguments: [`--posi-version=${app.getVersion()}`, `--posi-data-folder=${app.getPath('userData')}`],
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    if (smokeTest || details.reason === 'clean-exit' || win.isDestroyed()) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      title: 'POSI',
      message: 'POSI stopped unexpectedly.',
      detail: 'Records that were already saved are safe. Reload POSI to continue.',
      buttons: ['Reload', 'Exit'],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice === 0) win.reload();
    else app.quit();
  });

  win.on('close', flushStorage);
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.loadURL(APP_URL);
  return win;
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function start() {
  serveAppFiles();
  lockDownWebContents();
  handleMessageBoxes();
  handleDownloads();
  buildMenu();
  mainWindow = createMainWindow();
  setInterval(flushStorage, STORAGE_FLUSH_MS).unref();
  if (smokeTest) smokeTest.run(app, mainWindow);
}

// Two copies would fight over the same shop records, so the second launch just
// brings the open window to the front.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID); // taskbar pinning and grouping on Windows
  app.on('second-instance', focusMainWindow);
  app.on('before-quit', flushStorage);
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('POSI could not start', String((error && error.stack) || error));
    app.exit(1);
  });
}
