'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { isAppUrl, isSafeExternalUrl, mimeTypeFor, resolveAppRequest } = require('../app-files.cjs');

const root = path.resolve(__dirname, 'fixture-renderer');
const inRoot = (...parts) => path.join(root, ...parts);

test('serves the app shell for the root and for extension-less paths', () => {
  for (const url of ['posi://app/', 'posi://app', 'posi://app/settings', 'posi://app/?from=menu', 'posi://APP/']) {
    const hit = resolveAppRequest(root, url);
    assert.ok(hit, url);
    assert.equal(hit.filePath, inRoot('index.html'), url);
    assert.equal(hit.mimeType, 'text/html');
    assert.equal(hit.charset, 'utf-8');
  }
});

test('serves built assets with explicit MIME types', () => {
  assert.deepEqual(resolveAppRequest(root, 'posi://app/assets/index-AbC123.js'), {
    filePath: inRoot('assets', 'index-AbC123.js'), mimeType: 'text/javascript', charset: 'utf-8',
  });
  assert.equal(resolveAppRequest(root, 'posi://app/assets/index.css').mimeType, 'text/css');
  assert.equal(resolveAppRequest(root, 'posi://app/posi-icon.svg').mimeType, 'image/svg+xml');
  assert.equal(resolveAppRequest(root, 'posi://app/my%20file.png').filePath, inRoot('my file.png'));
  assert.deepEqual(mimeTypeFor('x.WOFF2'), { mimeType: 'font/woff2' });
  assert.deepEqual(mimeTypeFor('archive.bin'), { mimeType: 'application/octet-stream' });
});

test('refuses other origins and schemes', () => {
  for (const url of ['https://app/index.html', 'file:///C:/Windows/win.ini', 'posi://evil/index.html', 'not a url']) {
    assert.equal(resolveAppRequest(root, url), null, url);
  }
});

test('never resolves outside the app folder', () => {
  const attempts = [
    'posi://app/%2e%2e/%2e%2e/secret.txt',
    'posi://app/assets/%2E%2E/%2E%2E/package.json',
    'posi://app/..%2fpackage.json',
    'posi://app/..%5c..%5cpackage.json',
    'posi://app/assets%5c..%5c..%5cmain.cjs',
    'posi://app/index.html%00.png',
    'posi://app/%E0%A4%A',
    'posi://app/C:/Windows/win.ini',
    'posi://app/C%3A%5CWindows%5Cwin.ini',
    'posi://app//server/share/file.txt',
  ];
  for (const url of attempts) {
    const hit = resolveAppRequest(root, url);
    if (hit) {
      const rel = path.relative(root, hit.filePath);
      assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel), `${url} escaped to ${hit.filePath}`);
    }
  }
  assert.equal(resolveAppRequest(root, 'posi://app/..%5c..%5cpackage.json'), null);
  assert.equal(resolveAppRequest(root, 'posi://app/index.html%00.png'), null);
});

test('recognises app URLs', () => {
  assert.equal(isAppUrl('posi://app/'), true);
  assert.equal(isAppUrl('posi://app/assets/x.js'), true);
  assert.equal(isAppUrl('posi://other/'), false);
  assert.equal(isAppUrl('https://app/'), false);
  assert.equal(isAppUrl(''), false);
});

test('only lets web, mail and phone links open outside the app', () => {
  for (const url of ['https://example.com', 'http://example.com/x', 'mailto:shop@example.com', 'tel:+233300000000']) {
    assert.equal(isSafeExternalUrl(url), true, url);
  }
  for (const url of ['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'ms-settings:', 'smb://server/share', 'posi://app/', '']) {
    assert.equal(isSafeExternalUrl(url), false, url);
  }
});
