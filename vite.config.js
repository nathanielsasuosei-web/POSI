import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function offlinePrecachePlugin() {
  return {
    name: 'posi-offline-precache',
    apply: 'build',
    async writeBundle(outputOptions, bundle) {
      const bundleAssets = Object.keys(bundle).filter(file => !file.endsWith('.map')).map(file => `/${file}`);
      // Required files: without these the app cannot start offline.
      const required = [...new Set(['/', ...bundleAssets.filter(file => /\.(js|css)$/.test(file))])];
      // Optional files: nice to have offline, but a failure must not block offline mode.
      const optional = [...new Set(['/index.html', '/manifest.webmanifest', '/posi-icon.svg', ...bundleAssets])].filter(file => !required.includes(file));
      const appShell = { required, optional };
      const bundleSignature = Object.entries(bundle).map(([file, output]) => {
        const content = output.type === 'chunk' ? output.code : output.source;
        return [file, typeof content === 'string' ? content : content ? Buffer.from(content).toString('base64') : ''];
      });
      const publicSignature = await Promise.all(['manifest.webmanifest', 'posi-icon.svg'].map(async file => [file, await readFile(resolve('public', file), 'utf8')]));
      const outputDirectory = resolve(outputOptions.dir || 'dist');
      const htmlContent = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
      const serviceWorkerPath = resolve(outputDirectory, 'service-worker.js');
      const serviceWorkerTemplate = await readFile(resolve('public/service-worker.js'), 'utf8');
      const version = createHash('sha256').update(JSON.stringify([appShell, bundleSignature, publicSignature, htmlContent, serviceWorkerTemplate])).digest('hex').slice(0, 10);

      const serviceWorker = serviceWorkerTemplate
        .replaceAll('__POSI_CACHE_VERSION__', version)
        .replace('__POSI_PRECACHE_ASSETS__', JSON.stringify(appShell));
      await writeFile(serviceWorkerPath, serviceWorker);
    },
  };
}

// Windows desktop app (`npm run build:desktop`). It runs on Electron 22, whose
// Chromium 108 engine is the newest that Windows 7, 8 and 8.1 can run, so the
// code is compiled for Chromium 108 instead of Vite's default (Chrome 111+).
const DESKTOP_TARGET = ['chrome108'];
const DESKTOP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function desktopShellPlugin() {
  let outDir;
  return {
    name: 'posi-desktop-shell',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: DESKTOP_CSP }, injectTo: 'head-prepend' }];
    },
    // The installed app ships its own files and needs no service worker.
    async closeBundle() {
      await rm(resolve(outDir, 'service-worker.js'), { force: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const shared = {
    server: { host: '0.0.0.0', allowedHosts: true },
    preview: { host: '0.0.0.0', allowedHosts: true },
  };
  if (mode !== 'desktop') return { ...shared, plugins: [react(), offlinePrecachePlugin()] };
  return {
    ...shared,
    plugins: [react(), desktopShellPlugin()],
    build: {
      outDir: 'desktop/renderer',
      emptyOutDir: true,
      target: DESKTOP_TARGET,
      cssTarget: DESKTOP_TARGET,
      chunkSizeWarningLimit: 1024, // loaded from disk, not over the network
    },
  };
});
