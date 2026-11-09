// Runs the packaged app's built-in self test (smoke-test.cjs) twice on the same
// throwaway profile: first to create a store, then to reopen it after a restart.
//
//   node scripts/smoke.mjs <path to POSI.exe> <results folder> [label]
//
// Writes screenshots and summary.json per phase, prints GitHub annotations and
// appends a table to the job summary when running in GitHub Actions.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [exe, resultsArg, label = path.basename(path.dirname(exe || '.'))] = process.argv.slice(2);
if (!exe || !resultsArg) {
  console.error('Usage: node scripts/smoke.mjs <path to POSI.exe> <results folder> [label]');
  process.exit(2);
}
const resultsDir = path.resolve(resultsArg);
const profileDir = path.join(resultsDir, 'profile');
const PHASE_TIMEOUT_MS = 180000;
const inActions = Boolean(process.env.GITHUB_ACTIONS);
const escape = text => String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

function runPhase(phase) {
  const outDir = path.join(resultsDir, phase);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  return new Promise(resolve => {
    const child = spawn(path.resolve(exe), [], {
      env: { ...process.env, POSI_SMOKE_TEST: outDir, POSI_SMOKE_PHASE: phase, POSI_SMOKE_PROFILE: profileDir },
      stdio: 'ignore',
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ phase, outDir, exitCode: null, error: `timed out after ${PHASE_TIMEOUT_MS / 1000}s` });
    }, PHASE_TIMEOUT_MS);
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ phase, outDir, exitCode: null, error: error.message });
    });
    child.on('exit', code => {
      clearTimeout(timer);
      resolve({ phase, outDir, exitCode: code });
    });
  });
}

function readSummary(outDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8'));
  } catch {
    return null;
  }
}

let allPassed = true;
const rows = [];
for (const phase of ['setup', 'reopen']) {
  // Give Windows a moment to release the profile from the previous run.
  if (phase === 'reopen') await new Promise(resolve => setTimeout(resolve, 3000));
  const result = await runPhase(phase);
  const summary = readSummary(result.outDir);
  const passed = Boolean(summary?.ok) && result.exitCode === 0;
  allPassed &&= passed;

  console.log(`\n== ${label} · ${phase}: ${passed ? 'PASSED' : 'FAILED'} (exit code ${result.exitCode ?? 'none'}${result.error ? `, ${result.error}` : ''})`);
  if (summary) console.log(`   POSI ${summary.app} · Electron ${summary.electron} · Chromium ${summary.chrome} · ${summary.arch} · ${summary.os}`);
  for (const item of summary?.checks || []) {
    console.log(`   ${item.ok ? 'ok  ' : 'FAIL'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
    rows.push(`| ${label} | ${phase} | ${item.ok ? '✅' : '❌'} ${item.name} | ${String(item.detail).replace(/\|/g, '\\|')} |`);
    if (inActions && !item.ok) console.log(`::error title=Smoke test ${label} (${phase})::${escape(`${item.name}: ${item.detail}`)}`);
  }
  if (!summary) {
    rows.push(`| ${label} | ${phase} | ❌ No results | ${result.error || `exit code ${result.exitCode}`} |`);
    if (inActions) console.log(`::error title=Smoke test ${label} (${phase})::${escape(`No summary.json was written (${result.error || `exit code ${result.exitCode}`})`)}`);
  }
  if (inActions && passed) {
    console.log(`::notice title=Smoke test ${label} (${phase}) passed::${escape(`${summary.checks.length} checks · Electron ${summary.electron} · Chromium ${summary.chrome} · ${summary.arch} · ${summary.os}`)}`);
  }
  if (!passed) break; // reopening only makes sense after a successful setup
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const table = ['', `### Desktop smoke test · ${label}`, '', '| Build | Phase | Check | Detail |', '| --- | --- | --- | --- |', ...rows, ''].join('\n');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
}
try {
  fs.rmSync(profileDir, { recursive: true, force: true }); // throwaway test profile, no need to upload it
} catch {
  // Windows can hold files for a moment after the app exits; leaving them is harmless.
}
process.exit(allPassed ? 0 : 1);
