const CACHE_PREFIX = 'posi-app-shell-';
const CACHE_NAME = `${CACHE_PREFIX}__POSI_CACHE_VERSION__`;
// { required: [...], optional: [...] } — injected at build time by vite.config.js
const PRECACHE = __POSI_PRECACHE_ASSETS__;

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(client => client.postMessage(message));
}

// Many hosts answer requests for missing files with the HTML page (status 200)
// instead of a 404. Never accept HTML for a file that should be a script, style,
// image or manifest — caching it would break the app until the cache is cleared.
function isUsable(url, response) {
  if (!response.ok) return false;
  const path = new URL(url, self.location.origin).pathname;
  const isPage = path === '/' || path.endsWith('.html');
  const type = response.headers.get('content-type') || '';
  return isPage || !type.includes('text/html');
}

// Fetch straight from the network (bypassing the HTTP cache) so a stale copy
// of a file can never end up in the offline cache. Retries once.
async function fetchFresh(url) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
      if (isUsable(url, response)) return response;
      lastError = new Error(`${url} returned ${response.status} ${response.headers.get('content-type') || ''}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  const missing = [];
  const store = async (url, required) => {
    try {
      await cache.put(url, await fetchFresh(url));
    } catch {
      if (required) missing.push(url);
    }
  };
  await Promise.all([
    ...PRECACHE.required.map(url => store(url, true)),
    ...PRECACHE.optional.map(url => store(url, false)),
  ]);
  if (missing.length) {
    await caches.delete(CACHE_NAME);
    await notifyClients({ type: 'POSI_OFFLINE_FAILED', missing });
    // Failing the install keeps any previous working version in control.
    throw new Error(`Offline install failed, missing: ${missing.join(', ')}`);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    await notifyClients({ type: 'POSI_OFFLINE_READY' });
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'POSI_OFFLINE_STATUS') {
    caches.has(CACHE_NAME).then(ready => event.source?.postMessage({ type: ready ? 'POSI_OFFLINE_READY' : 'POSI_OFFLINE_PENDING' }));
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: network first so updates arrive, cached app shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && !response.redirected) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/')) || (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Built assets have content hashes in their names, so cache first is safe.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: url.pathname.startsWith('/assets/') });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.type === 'basic' && isUsable(request.url, response)) await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
