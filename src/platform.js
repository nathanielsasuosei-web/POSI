// Set by the Windows desktop app (desktop/preload.cjs); null in a web browser.
// Shape: { isDesktop: true, version, platform, dataFolder, alert(), confirm() }
const bridge = typeof window !== 'undefined' ? window.posiDesktop : undefined;

export const desktopApp = bridge && bridge.isDesktop ? bridge : null;

// In the desktop app, alert() and confirm() open the app's own Windows message
// boxes. The built-in ones leave text boxes unable to receive typing after they
// close on Windows (an Electron 22 bug), which would stall the checkout screen.
if (desktopApp && typeof desktopApp.alert === 'function' && typeof desktopApp.confirm === 'function') {
  const text = value => (value === undefined ? '' : String(value));
  window.alert = message => desktopApp.alert(text(message));
  window.confirm = message => desktopApp.confirm(text(message));
}
