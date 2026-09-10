import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  withIsolatedHome,
  makeTempProject,
  cleanupDirs,
} from './helpers/isolated-home.mjs';

const BIN = path.resolve(import.meta.dirname, '../bin/un-specweaver.mjs');
const FIXTURE = path.resolve(import.meta.dirname, '../fixtures/epics.sample.md');
const BOGUS_FLAG = '--bogus-flag-xyz-123';

// 15 comandos con ayuda global: init, update, adopt, new, doctor, context,
// vendors, dashboard, ui, sprint, sync, build, change, bug, ticket.
// `bridge` reenvia sus argumentos verbatim a bridge/cli.mjs y no soporta
// --help (sale 2); su contrato L1 se verifica en el test dedicado de abajo.
const HELP_COMMANDS = [
  'init',
  'update',
  'adopt',
  'new',
  'doctor',
  'context',
  'vendors',
  'dashboard',
  'ui',
  'sprint',
  'sync',
  'build',
  'change',
  'bug',
  'ticket',
];

// Todos los nombres despachables, incluido bridge (dashboard/ui es un comando
// logico con dos formas de invocacion).
const ALL_COMMANDS = [...HELP_COMMANDS.slice(0, 5), 'bridge', ...HELP_COMMANDS.slice(5)];

function runCli(args, { cwd, home }) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
    timeout: 15000,
  });
}

function snapshot(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .map((e) => e.name)
    .sort();
}

// ---------------------------------------------------------------------------
// Aislamiento del helper compartido (Requirement: aislamiento hernetico)
// ---------------------------------------------------------------------------

test('helper — withIsolatedHome restaura os.homedir y HOME al finalizar', async () => {
  const beforeHomedir = os.homedir();
  const beforeHomeEnv = process.env.HOME;
  let seenInside = null;
  await withIsolatedHome(async (tmpHome) => {
    seenInside = tmpHome;
    assert.ok(fs.existsSync(tmpHome), 'el HOME temporal debe existir durante fn');
    assert.equal(os.homedir(), tmpHome, 'os.homedir() debe apuntar al temporal dentro de fn');
    assert.equal(process.env.HOME, tmpHome, 'HOME debe apuntar al temporal dentro de fn');
  });
  assert.ok(seenInside, 'fn debe haberse ejecutado');
  assert.equal(os.homedir(), beforeHomedir, 'os.homedir() debe restaurarse tras fn');
  assert.equal(process.env.HOME, beforeHomeEnv, 'HOME debe restaurarse tras fn');
  assert.ok(!fs.existsSync(seenInside), 'el HOME temporal debe limpiarse tras fn');
});

test('helper — dos suites consecutivas no observan artefactos entre si', async () => {
  let firstHome = null;
  await withIsolatedHome(async (tmpHome) => {
    firstHome = tmpHome;
    fs.writeFileSync(path.join(tmpHome, 'marcador.txt'), 'primera suite', 'utf8');
  });
  await withIsolatedHome(async (tmpHome) => {
    assert.notEqual(tmpHome, firstHome, 'cada suite debe recibir un HOME distinto');
    assert.ok(!fs.existsSync(path.join(tmpHome, 'marcador.txt')), 'la segunda suite no debe ver archivos de la primera');
  });
});

test('helper — resets se invocan antes y despues de fn', async () => {
  const calls = [];
  await withIsolatedHome(
    async () => {
      calls.push('fn');
    },
    { resets: [() => calls.push('reset')] },
  );
  assert.deepEqual(calls, ['reset', 'fn', 'reset'], 'resets debe correr antes y despues de fn');
});

test('helper — makeTempProject crea y cleanupDirs elimina', async () => {
  await withIsolatedHome(async () => {
    const proj = makeTempProject('l1l2-');
    assert.ok(fs.existsSync(proj), 'el proyecto temporal debe existir tras crearlo');
    fs.writeFileSync(path.join(proj, 'hola.txt'), 'x', 'utf8');
    cleanupDirs(proj);
    assert.ok(!fs.existsSync(proj), 'cleanupDirs debe eliminar el proyecto temporal');
  });
});

// ---------------------------------------------------------------------------
// L1 (humo) + L2 (contrato --help) por comando
// ---------------------------------------------------------------------------

for (const cmd of HELP_COMMANDS) {
  test(`L1/L2 — ${cmd} --help sale 0 y describe su uso (proyecto fresco, HOME aislado)`, { timeout: 20000 }, async () => {
    await withIsolatedHome(async (home) => {
      const proj = makeTempProject('l1l2-');
      try {
        const before = snapshot(proj);
        const r = runCli([cmd, '--help'], { cwd: proj, home });
        assert.equal(r.status, 0, `${cmd} --help debe salir 0 (stderr: ${r.stderr})`);
        assert.match(r.stdout, /un-specweaver/, `${cmd} --help debe describir su uso`);
        assert.deepEqual(snapshot(proj), before, `${cmd} --help no debe escribir en el proyecto`);
      } finally {
        cleanupDirs(proj);
      }
    });
  });
}

test('L1 — bridge sin epics en proyecto fresco sale 2 con mensaje de uso (no soporta --help)', { timeout: 20000 }, async () => {
  await withIsolatedHome(async (home) => {
    const proj = makeTempProject('l1l2-');
    try {
      const r = runCli(['bridge'], { cwd: proj, home });
      assert.equal(r.status, 2, 'bridge sin epics debe salir 2');
      const combined = `${r.stdout || ''}\n${r.stderr || ''}`;
      assert.match(combined, /epics\.md|Uso:/i, 'bridge debe explicar que falta epics.md y mostrar su uso');
      const rHelp = runCli(['bridge', '--help'], { cwd: proj, home });
      assert.equal(rHelp.status, 2, 'bridge --help sale 2: reenvia verbatim y bridge/cli.mjs no define --help');
    } finally {
      cleanupDirs(proj);
    }
  });
});

// ---------------------------------------------------------------------------
// L2 (contrato): flag desconocido -> exit 2 en todos los comandos
// ---------------------------------------------------------------------------

for (const cmd of ALL_COMMANDS) {
  test(`L2 — ${cmd} ${BOGUS_FLAG} sale 2 (contrato de flags)`, { timeout: 20000 }, async () => {
    await withIsolatedHome(async (home) => {
      const proj = makeTempProject('l1l2-');
      try {
        const r = runCli([cmd, BOGUS_FLAG], { cwd: proj, home });
        assert.equal(r.status, 2, `${cmd} con flag desconocido debe salir 2`);
        const combined = `${r.stdout || ''}\n${r.stderr || ''}`;
        assert.match(combined, /desconocida/i, `${cmd} debe reportar la opcion desconocida`);
      } finally {
        cleanupDirs(proj);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// L2 (contrato): --dry-run no escribe en disco
// ---------------------------------------------------------------------------

test('L2 — init --dry-run sale 0 sin escribir en el proyecto fresco', { timeout: 30000 }, async () => {
  await withIsolatedHome(async (home) => {
    const proj = makeTempProject('l1l2-');
    try {
      const r = runCli(['init', '--dry-run', proj], { cwd: proj, home });
      assert.equal(r.status, 0, `init --dry-run debe salir 0 (stderr: ${r.stderr})`);
      assert.deepEqual(snapshot(proj), [], 'init --dry-run no debe escribir nada en el proyecto');
    } finally {
      cleanupDirs(proj);
    }
  });
});

test('L2 — bridge <fixture> --dry-run sale 0 sin escribir openspec/', { timeout: 30000 }, async () => {
  await withIsolatedHome(async (home) => {
    const proj = makeTempProject('l1l2-');
    try {
      fs.copyFileSync(FIXTURE, path.join(proj, 'epics.md'));
      const before = snapshot(proj);
      assert.ok(before.includes('epics.md'), 'el fixture debe estar copiado antes del dry-run');
      const r = runCli(['bridge', path.join(proj, 'epics.md'), '--out', proj, '--dry-run'], {
        cwd: proj,
        home,
      });
      assert.equal(r.status, 0, `bridge --dry-run debe salir 0 (stderr: ${r.stderr})`);
      assert.match(r.stdout, /\[dry\]/, 'bridge --dry-run debe reportar la accion simulada');
      assert.deepEqual(snapshot(proj), before, 'bridge --dry-run no debe crear openspec/ ni .un-specweaver/');
    } finally {
      cleanupDirs(proj);
    }
  });
});
