import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
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

export default defineConfig({
  plugins: [react(), offlinePrecachePlugin()],
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
});
