/**
 * Runs the Python service in services/ml: setting it up, starting it, training,
 * measuring and testing it. It finds Python and the service's own environment by
 * itself, so the commands are the same on Windows, macOS and Linux.
 *
 *   pnpm ml:setup      once: makes the environment, installs, trains the model
 *   pnpm ml:dev        starts the service on http://127.0.0.1:8000
 *   pnpm ml:train      trains the arrival-time model again
 *   pnpm ml:evaluate   measures all three models and rewrites services/ml/reports
 *   pnpm ml:test       runs the Python tests
 *   pnpm ml:export     rewrites services/ml/data from the demo seed (needs no Python)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const mlDir = path.join(root, 'services', 'ml');
const venvDir = path.join(mlDir, '.venv');

const OLDEST_PYTHON = [3, 11];
export const ML_PORT = '8000';

/** The Python inside the service's own environment, or null before `pnpm ml:setup`. */
export function venvPython() {
  const python =
    process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'python.exe')
      : path.join(venvDir, 'bin', 'python');
  return existsSync(python) ? python : null;
}

/** What starts the service, for scripts/dev.mjs to run beside the API and the site. */
export const serveArgs = [
  '-m',
  'uvicorn',
  'unun_ml.app:app',
  '--host',
  '127.0.0.1',
  '--port',
  ML_PORT,
];

/** Finds a Python new enough to make the environment with. */
function systemPython() {
  const candidates = [
    ['python3', []],
    ['python', []],
    ['py', ['-3']],
  ];
  for (const [command, prefix] of candidates) {
    const probe = spawnSync(command, [...prefix, '--version'], { encoding: 'utf8' });
    const version = /Python (\d+)\.(\d+)/.exec(`${probe.stdout}${probe.stderr}`);
    if (probe.status !== 0 || !version) continue;

    const [major, minor] = [Number(version[1]), Number(version[2])];
    if (
      major > OLDEST_PYTHON[0] ||
      (major === OLDEST_PYTHON[0] && minor >= OLDEST_PYTHON[1])
    ) {
      return { command, prefix };
    }
  }
  return null;
}

function run(command, args, cwd = mlDir) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function needVenv() {
  const python = venvPython();
  if (!python) {
    console.error('The ML service is not set up yet. Run "pnpm ml:setup" first.');
    process.exit(1);
  }
  return python;
}

function setup() {
  if (!venvPython()) {
    const python = systemPython();
    if (!python) {
      console.error(
        `Python ${OLDEST_PYTHON.join('.')} or newer was not found. Install it from https://www.python.org/downloads/ and run this again.`,
      );
      process.exit(1);
    }
    console.log('Making the Python environment in services/ml/.venv');
    run(python.command, [...python.prefix, '-m', 'venv', venvDir]);
  }

  const python = needVenv();
  console.log('Installing the Python packages. The first time takes a few minutes.');
  run(python, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
  run(python, ['-m', 'pip', 'install', '--quiet', '-r', 'requirements-dev.txt']);

  console.log('Training the arrival-time model.');
  run(python, ['-m', 'unun_ml.train']);
  console.log('Done. "pnpm dev" now starts the ML service with the API and the site.');
}

function exportData() {
  const api = path.join(root, 'apps', 'api');
  const tsx = path.join('node_modules', 'tsx', 'dist', 'cli.mjs');
  if (!existsSync(path.join(api, tsx))) {
    console.error('Dependencies are not installed yet. Run "pnpm install" first.');
    process.exit(1);
  }
  run(process.execPath, [tsx, path.join('src', 'modules', 'ml', 'write-files.ts')], api);
}

const commands = {
  setup,
  export: exportData,
  dev: () => run(needVenv(), serveArgs),
  train: () => run(needVenv(), ['-m', 'unun_ml.train', ...process.argv.slice(3)]),
  evaluate: () => run(needVenv(), ['-m', 'unun_ml.evaluate']),
  test: () => run(needVenv(), ['-m', 'pytest']),
};

// Only when run as a program. scripts/dev.mjs imports this file for its helpers.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = commands[process.argv[2]];
  if (!command) {
    console.error(`Usage: node scripts/ml.mjs <${Object.keys(commands).join('|')}>`);
    process.exit(1);
  }
  command();
}
