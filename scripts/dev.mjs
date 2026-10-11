/**
 * Starts the API and the web app together for development, and stops both when either
 * one stops. It runs the programs directly, so it works the same on Windows, macOS and
 * Linux, whether or not pnpm is on the PATH.
 *
 * The Python service in services/ml is started too, once "pnpm ml:setup" has been run.
 * It is an extra: the site works without it, and if it stops the rest keeps going.
 *
 *   pnpm dev
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ML_PORT, mlDir, serveArgs, venvPython } from './ml.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

const programs = [
  {
    name: 'api',
    cwd: path.join(root, 'apps', 'api'),
    command: process.execPath,
    args: [
      path.join('node_modules', 'tsx', 'dist', 'cli.mjs'),
      'watch',
      '--clear-screen=false',
      'src/server.ts',
    ],
    needed: true,
  },
  {
    name: 'web',
    cwd: path.join(root, 'apps', 'web'),
    command: process.execPath,
    args: [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev'],
    needed: true,
  },
];

for (const program of programs) {
  if (!existsSync(path.join(program.cwd, program.args[0]))) {
    console.error('Dependencies are not installed yet. Run "pnpm install" first.');
    process.exit(1);
  }
}

const python = venvPython();
if (python) {
  programs.push({
    name: 'ml',
    cwd: mlDir,
    command: python,
    args: serveArgs,
    needed: false,
  });
}

/** Writes a program's output one line at a time, with its name in front. */
function relay(stream, name, target) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) target.write(`[${name}] ${line}\n`);
  });
  stream.on('end', () => {
    if (pending) target.write(`[${name}] ${pending}\n`);
  });
}

let stopping = false;

const children = programs.map((program) => {
  const child = spawn(program.command, program.args, {
    cwd: program.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  relay(child.stdout, program.name, process.stdout);
  relay(child.stderr, program.name, process.stderr);

  child.on('exit', (code) => {
    if (stopping) return;
    if (!program.needed) {
      console.error(
        `[${program.name}] stopped with code ${code ?? 0}. The site carries on without it.`,
      );
      return;
    }
    console.error(
      `[${program.name}] stopped with code ${code ?? 0}. Stopping the other program.`,
    );
    stop(code ?? 1);
  });

  return child;
});

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = exitCode;
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log(
  'Starting the API on http://localhost:4000 and the site on http://localhost:3000',
);
console.log(
  python
    ? `Starting the ML service on http://127.0.0.1:${ML_PORT}`
    : 'The ML service is not set up, so arrival times use the plain rule and search matches letters as typed. Run "pnpm ml:setup" to add it.',
);
