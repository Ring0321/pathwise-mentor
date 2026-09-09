import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] ?? process.env.PORT ?? 5190);
const host = process.argv.includes('--host=0.0.0.0') ? '0.0.0.0' : '127.0.0.1';
const url = `http://127.0.0.1:${port}/`;
const logDir = path.join(appRoot, 'logs');
const logPath = path.join(logDir, `preview-${port}.log`);
const errPath = path.join(logDir, `preview-${port}.err.log`);
const viteBin = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');

fs.mkdirSync(logDir, { recursive: true });

function normalizeWindowsPathEnv(env) {
  if (process.platform !== 'win32') {
    return env;
  }

  const result = { ...env };
  const pathKeys = Object.keys(result).filter((key) => key.toLowerCase() === 'path');
  if (pathKeys.length <= 1) {
    return result;
  }

  const mergedPath = pathKeys
    .map((key) => result[key])
    .filter(Boolean)
    .join(path.delimiter);

  for (const key of pathKeys) {
    delete result[key];
  }
  result.Path = mergedPath;
  return result;
}

function waitForHttp(targetUrl, timeoutMs = 15000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(targetUrl, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });

      req.on('error', (error) => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(error);
          return;
        }
        setTimeout(probe, 500);
      });

      req.setTimeout(1500, () => {
        req.destroy(new Error('preview probe timed out'));
      });
    };

    probe();
  });
}

const out = fs.openSync(logPath, 'w');
const err = fs.openSync(errPath, 'w');
const env = normalizeWindowsPathEnv(process.env);

try {
  const statusCode = await waitForHttp(url, 1000);
  console.log(
    JSON.stringify(
      {
        status: 'ok',
        pid: null,
        reused: true,
        url,
        code: statusCode,
        logPath,
        errPath,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch {
  // No existing preview is reachable; start a fresh Vite process below.
}

if (!fs.existsSync(viteBin)) {
  console.log(
    JSON.stringify(
      {
        status: 'error',
        url,
        message: `Missing Vite executable: ${viteBin}`,
        logPath,
        errPath,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const child = spawn(process.execPath, [viteBin, 'preview', '--host', host, '--port', String(port)], {
  cwd: appRoot,
  detached: true,
  env,
  stdio: ['ignore', out, err],
  windowsHide: true,
});

child.unref();

try {
  const statusCode = await waitForHttp(url);
  console.log(
    JSON.stringify(
      {
        status: 'ok',
        pid: child.pid,
        url,
        code: statusCode,
        logPath,
        errPath,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.log(
    JSON.stringify(
      {
        status: 'error',
        pid: child.pid,
        url,
        message: error instanceof Error ? error.message : String(error),
        logPath,
        errPath,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
