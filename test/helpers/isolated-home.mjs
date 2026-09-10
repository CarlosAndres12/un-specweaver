import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Helper compartido de HOME aislado para las suites cli-selftest (L1-L4).
// Unifica las variantes locales de withIsolatedHome repartidas por las suites
// existentes: solo difieren en que locks resetean, de ahi el hook `resets`.
// Solo las suites nuevas lo usan; la migracion de las 12 existentes queda fuera.

export async function withIsolatedHome(fn, { resets = [] } = {}) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'unsw-home-'));
  const origHomedir = os.homedir;
  const origHomeEnv = process.env.HOME;
  os.homedir = () => tmpHome;
  process.env.HOME = tmpHome;
  for (const reset of resets) {
    try {
      reset();
    } catch {}
  }
  try {
    await fn(tmpHome);
  } finally {
    os.homedir = origHomedir;
    if (origHomeEnv === undefined) delete process.env.HOME;
    else process.env.HOME = origHomeEnv;
    try {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    } catch {}
    for (const reset of resets) {
      try {
        reset();
      } catch {}
    }
  }
}

export function makeTempProject(prefix = 'proj-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanupDirs(...dirs) {
  for (const d of dirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {}
  }
}
