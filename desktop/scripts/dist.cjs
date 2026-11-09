'use strict';

// Builds the Windows installers with friendly names:
//   POSI-Setup-<version>-64-bit.exe  — for 64-bit Windows
//   POSI-Setup-<version>-32-bit.exe  — for 32-bit Windows (also runs on 64-bit)
//
//   npm run dist            both installers
//   npm run dist -- x64     64-bit only
//   npm run dist -- ia32    32-bit only
//
// Run `npm run build:desktop` in the repository root first.

const fs = require('fs');
const path = require('path');
const { Arch, Platform, build } = require('electron-builder');

const ARCHES = {
  x64: { arch: Arch.x64, label: '64-bit' },
  ia32: { arch: Arch.ia32, label: '32-bit' },
};

async function main() {
  const projectDir = path.resolve(__dirname, '..');
  if (!fs.existsSync(path.join(projectDir, 'renderer', 'index.html'))) {
    throw new Error('desktop/renderer is missing. Run "npm run build:desktop" in the repository root first.');
  }
  const requested = process.argv.slice(2);
  for (const name of requested.length ? requested : Object.keys(ARCHES)) {
    const target = ARCHES[name];
    if (!target) throw new Error(`Unknown architecture "${name}". Use x64 or ia32.`);
    console.log(`\nBuilding the ${target.label} Windows installer...`);
    await build({
      projectDir,
      targets: Platform.WINDOWS.createTarget('nsis', target.arch),
      publish: 'never',
      // Merged over the "build" section of package.json.
      config: { nsis: { artifactName: `POSI-Setup-\${version}-${target.label}.\${ext}` } },
    });
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
