#!/usr/bin/env node
// Runs the API and the Vite dev server together without extra dependencies.
// Usage: npm run dev:all
import { spawn } from 'node:child_process';

const children = [];

const run = (name, command, args, cwd, color) => {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  children.push(child);

  const prefix = `\u001b[${color}m[${name}]\u001b[0m `;
  const pipe = stream => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', chunk => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) console.log(prefix + line);
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', code => {
    console.log(`${prefix}exited with code ${code}`);
    stopAll(code ?? 0);
  });

  return child;
};

const stopAll = code => {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 200);
};

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

run('api', 'npm', ['--prefix', 'backend', 'run', 'dev'], process.cwd(), '36');
run('web', 'npm', ['run', 'dev'], process.cwd(), '35');
