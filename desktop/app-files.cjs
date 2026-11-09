'use strict';

// Maps posi://app/... requests to files in the bundled web app. Kept free of
// Electron APIs so it can be unit tested with plain Node (see test/).
// Runs inside Electron 22, i.e. Node 16 — keep the syntax and APIs compatible.

const path = require('path');

// The app is served from posi://app. NEVER change these two values: the shop
// records in local storage belong to this exact origin, so a new scheme or host
// would make every installed copy start over with an empty store.
const APP_SCHEME = 'posi';
const APP_HOST = 'app';

const TEXT = 'utf-8';
const MIME_TYPES = {
  '.html': ['text/html', TEXT],
  '.js': ['text/javascript', TEXT],
  '.mjs': ['text/javascript', TEXT],
  '.css': ['text/css', TEXT],
  '.json': ['application/json', TEXT],
  '.map': ['application/json', TEXT],
  '.webmanifest': ['application/manifest+json', TEXT],
  '.txt': ['text/plain', TEXT],
  '.svg': ['image/svg+xml', TEXT],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.ico': ['image/x-icon'],
  '.woff': ['font/woff'],
  '.woff2': ['font/woff2'],
  '.ttf': ['font/ttf'],
  '.otf': ['font/otf'],
};

// Explicit types instead of the OS registry: some Windows PCs map .js to
// text/plain, which would stop the app's module scripts from loading.
function mimeTypeFor(filePath) {
  const [mimeType, charset] = MIME_TYPES[path.extname(filePath).toLowerCase()] || ['application/octet-stream'];
  return charset ? { mimeType, charset } : { mimeType };
}

function isAppUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${APP_SCHEME}:` && parsed.host.toLowerCase() === APP_HOST;
  } catch (error) {
    return false;
  }
}

// Returns { filePath, mimeType, charset? } or null when the request must be refused.
function resolveAppRequest(rootDir, url) {
  if (!isAppUrl(url)) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch (error) {
    return null; // malformed percent-encoding
  }
  // Never let encoded separators or NUL bytes reach the file system.
  if (pathname.includes('\0') || pathname.includes('\\')) return null;

  // The app has a single page; anything without a file extension is the app shell.
  const relative = path.posix.normalize(pathname).replace(/^\/+/, '');
  const target = relative === '' || path.posix.extname(relative) === '' ? 'index.html' : relative;

  const root = path.resolve(rootDir);
  const filePath = path.resolve(root, ...target.split('/'));
  const fromRoot = path.relative(root, filePath);
  if (fromRoot === '' || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;

  return Object.assign({ filePath }, mimeTypeFor(filePath));
}

// Only ordinary web, mail and phone links may leave the app — never file:// or
// other schemes that could launch programs on this computer.
function isSafeExternalUrl(url) {
  try {
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(new URL(url).protocol);
  } catch (error) {
    return false;
  }
}

module.exports = { APP_SCHEME, APP_HOST, isAppUrl, isSafeExternalUrl, mimeTypeFor, resolveAppRequest };
