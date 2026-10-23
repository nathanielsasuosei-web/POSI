import React, { useCallback, useEffect, useState } from 'react';

const CACHE_PREFIX = 'posi-app-shell-';
const SW_URL = '/service-worker.js';

// Status values: 'off' (dev / unsupported), 'installing', 'ready', 'failed'
export function useOfflineSupport() {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext;
  const [status, setStatus] = useState(import.meta.env.PROD && supported ? 'installing' : 'off');
  const [missing, setMissing] = useState([]);

  const watchWorker = useCallback(worker => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') setStatus('ready');
      // A worker that turns redundant before activating failed to install.
      if (worker.state === 'redundant' && !navigator.serviceWorker.controller) setStatus('failed');
    });
  }, []);

  const register = useCallback(async () => {
    if (!import.meta.env.PROD || !supported) return;
    setStatus('installing');
    setMissing([]);
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, { updateViaCache: 'none' });
      watchWorker(registration.installing || registration.waiting);
      registration.addEventListener('updatefound', () => watchWorker(registration.installing));
      if (registration.active) {
        registration.active.postMessage({ type: 'POSI_OFFLINE_STATUS' });
        registration.update().catch(() => {});
      }
    } catch {
      setStatus('failed');
    }
  }, [supported, watchWorker]);

  useEffect(() => {
    if (!supported) return undefined;
    if (!import.meta.env.PROD) {
      // The dev server never uses offline mode. Remove any worker left behind by an
      // earlier production build on this address so it cannot serve stale files.
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister())).catch(() => {});
      caches?.keys().then(keys => keys.filter(key => key.startsWith(CACHE_PREFIX)).forEach(key => caches.delete(key))).catch(() => {});
      return undefined;
    }
    const onMessage = event => {
      const { type, missing: files } = event.data || {};
      if (type === 'POSI_OFFLINE_READY') setStatus('ready');
      // Worker is running but its saved files are gone (e.g. browser cleared storage).
      if (type === 'POSI_OFFLINE_PENDING') setStatus('failed');
      if (type === 'POSI_OFFLINE_FAILED') { setStatus('failed'); setMissing(files || []); }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    // Register after the page has loaded so it does not slow the first paint.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      window.removeEventListener('load', register);
    };
  }, [supported, register]);

  // Retry automatically when the connection comes back.
  useEffect(() => {
    if (status !== 'failed') return undefined;
    window.addEventListener('online', register);
    return () => window.removeEventListener('online', register);
  }, [status, register]);

  return { status, missing, retry: register };
}

// Clears only the offline app files. Sales, stock and other shop records in
// local storage are NOT touched.
export async function resetOfflineCache() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(reg => reg.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX)).map(key => caches.delete(key)));
  } finally {
    window.location.reload();
  }
}

export function OfflineBanner({ status, missing, retry }) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (status === 'failed') setDismissed(false); }, [status]);
  if (status !== 'failed' || dismissed) return null;
  const online = navigator.onLine;
  return (
    <div className="offline-banner" role="alert">
      <div className="offline-banner-copy">
        <b>Offline support did not load</b>
        <span>
          {online
            ? 'Some app files could not be saved for offline use. The POS still works while you are online.'
            : 'You are offline, so the app files could not be saved. It will retry when you are back online.'}
        </span>
        <small>Your sales, stock and other records are safe — they are stored separately and are not affected.</small>
        {missing.length > 0 && <small className="offline-banner-files">Missing: {missing.join(', ')}</small>}
      </div>
      <div className="offline-banner-actions">
        <button className="btn small primary" disabled={!online} onClick={retry}>Try again</button>
        <button className="btn small" disabled={busy} onClick={() => { setBusy(true); resetOfflineCache(); }}>Reset offline files</button>
        <button className="btn small ghost" onClick={() => setDismissed(true)}>Dismiss</button>
      </div>
    </div>
  );
}

export function OfflineChip({ status, online }) {
  if (!online) return <span className="chip offline"><i /> Offline{status === 'ready' ? ' · saved here' : ''}</span>;
  if (status === 'ready') return <span className="chip online" title="This device can open the POS without internet"><i /> Online · offline ready</span>;
  if (status === 'installing') return <span className="chip online" title="Saving app files for offline use"><i /> Online · preparing offline</span>;
  if (status === 'failed') return <span className="chip offline" title="Offline mode is not available on this device yet"><i /> Online · offline unavailable</span>;
  return <span className="chip online"><i /> Online</span>;
}
