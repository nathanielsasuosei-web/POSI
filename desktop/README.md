# POSI for Windows (desktop app)

This folder packages the POSI web app as a Windows desktop app with a normal installer, using [Electron](https://www.electronjs.org/). Shop owners: see [Download for Windows](../README.md#download-for-windows).

## Why Electron 22

Electron 22 (Chromium 108) is the **last Electron release that runs on Windows 7, 8 and 8.1** ([Electron's notice](https://www.electronjs.org/blog/windows-7-to-8-1-deprecation-notice)); Electron 23 and later do not start there. Therefore:

- `electron` is pinned to `22.3.27`, the final 22.x release. **Do not upgrade it** unless you are prepared to drop Windows 7, 8 and 8.1.
- `npm run build:desktop` compiles the web app for Chromium 108 (Vite's default target is newer).
- Electron 22 no longer receives security fixes, so the app keeps its exposure small: it loads only its own bundled files from `posi://app` under a strict Content-Security-Policy, opens web links in the default browser, blocks other navigation, pop-up windows, webviews and permission requests, and the page runs sandboxed without Node.js access.
- On **Windows 11 24H2 and later** (build 26100+, also Windows Server 2025), Electron 22's Chromium sandbox crashes the app's page at start. On those Windows builds only, `main.cjs` starts Chromium with `--no-sandbox`; Windows 7 to 11 23H2 keep the sandbox.
- Electron 22's built-in `alert()`/`confirm()` stop text boxes from receiving typing on Windows once they close ([electron#31917](https://github.com/electron/electron/issues/31917)). In the desktop app, `src/platform.js` routes them to the app's own Windows message boxes instead.

## How it works

| File | Purpose |
| --- | --- |
| `main.cjs` | Serves `renderer/` from `posi://app`; window, menu, "Save as" for downloads, message boxes, single instance |
| `preload.cjs` | Gives the page `window.posiDesktop`: version, data folder, `alert` and `confirm` |
| `app-files.cjs` | Maps `posi://app/…` URLs to bundled files (unit tests in `test/`) |
| `smoke-test.cjs` | Self test used by CI; only active when `POSI_SMOKE_TEST` is set |
| `scripts/dist.cjs` | Builds the 64-bit and 32-bit NSIS installers |
| `scripts/smoke.mjs` | Runs the packaged app's self test twice: set up a store, then reopen it |
| `scripts/ci-step.sh` | CI helper that turns a failing command's output into a GitHub annotation |
| `resources/` | App and installer icons (made from `public/posi-icon.svg`) |
| `release-notes.md` | Description of each GitHub release (`{{version}}` is filled in) |
| `renderer/`, `release/` | Build output (git-ignored) |

The web app recognises the desktop app through `src/platform.js`. It then skips the service worker (the files are already on disk), shows "Desktop app · works offline" and says "on this computer" instead of "in this browser".

Shop records live in Chromium's local storage in `%APPDATA%\POSI`, under the origin `posi://app`. **Never change the scheme or host in `app-files.cjs`, or `appId`/`productName` in `package.json`**: existing installations would start with an empty store or install a second copy.

## Build on Windows

```bash
npm ci                    # repository root
npm run build:desktop     # web app → desktop/renderer
cd desktop
npm ci
npm start                 # run without installing
npm test                  # unit tests
npm run dist              # installers in desktop/release/
```

`npm run dist -- x64` or `npm run dist -- ia32` builds a single installer. The installers need Windows to build; the [workflow](../.github/workflows/windows-desktop.yml) does this on GitHub's Windows machines.

## Testing and releases

The **Windows desktop app** workflow runs on every pull request and push to `main`. It:

1. builds both installers on Windows and uploads them as the `POSI-Windows-installers` artifact;
2. on Windows Server 2022 (sandbox on, like Windows 7 to 11 23H2) and Windows Server 2025 (Windows 11 24H2 code base), silently installs each installer, checks the shortcuts, runs the installed app's self test and uninstalls it. The self test creates a store, signs in, uses the message boxes, exports a backup, prints to PDF and reloads, then restarts the app and signs in again. Screenshots are uploaded as `smoke-test-results-*` artifacts.

On `main` it then publishes a GitHub release `v<version>` using `version` from `desktop/package.json`, unless that version is already released. **To publish an update, raise `version` in `desktop/package.json`** (and edit `release-notes.md` if needed), then merge to `main`. A release can also be published from the Actions tab: run the workflow on `main` with **publish** ticked.

The installers are not code-signed, so Windows SmartScreen warns on first run ("More info → Run anyway"). To sign them, buy a Windows code-signing certificate and give electron-builder the `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables in the installer build step.
