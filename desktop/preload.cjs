'use strict';

// Runs in a sandboxed, context-isolated preload: only `electron` and a limited
// `process` object are available. The page gets a tiny description of the
// desktop app and two message-box helpers — no Node.js or file system access.

const { contextBridge, ipcRenderer } = require('electron');

function argument(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find(value => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

// Blocks like the built-in alert()/confirm() until the user answers. See
// showMessageBox() in main.cjs for why the built-in versions are replaced.
function messageBox(kind, message) {
  try {
    return ipcRenderer.sendSync('posi:message-box', { kind, message: typeof message === 'string' ? message : String(message) });
  } catch (error) {
    return false;
  }
}

contextBridge.exposeInMainWorld('posiDesktop', {
  isDesktop: true,
  version: argument('posi-version'),
  platform: process.platform,
  dataFolder: argument('posi-data-folder'),
  alert: message => {
    messageBox('alert', message);
  },
  confirm: message => messageBox('confirm', message) === true,
});
