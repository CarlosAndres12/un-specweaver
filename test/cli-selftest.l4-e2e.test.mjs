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

// E2E L4 (ola 3): proyecto fresco con HOME aislado y PATH falso (stubs
// `npx`/`brew`/`curl` que solo registran su invocación y salen 0, sin red).
// Flujo: `init --only layer,surface,gitignore` → `bridge` sobre fixtures → `doctor`.
// Sin cambios en prod: solo se invoca el CLI real por spawn, como en L1/L2.
//
// Sonda 3.1 (resuelta): `init --only layer,surface,gitignore` sale 0 con PATH
// falso y nunca invoca los stubs (log ausente); no hizo falta `--only` menor
// ni stub con marcador `ok`. El único subprocess ajeno es `brew tap-info`
// durante el `doctor` (lo ejecuta `plan()` de gentle-config para pintar el
// estado), interceptado por el stub sin red. Desviación resuelta: `doctor`
// sale ≠0 con deriva o bloqueo de plan (fix de prod en src/init.mjs);
// el pin 3.3 aserta el marcador DRIFT en salida y el exit≠0.

const BIN = path.resolve(import.meta.dirname, '../bin/un-specweaver.mjs');
const FIXTURE_ES = path.resolve(import.meta.dirname, '../fixtures/epics.sample.md');
const FIXTURE_EN = path.resolve(import.meta.dirname, '../fixtures/epics.sample.en.md');
const SELF = path.join(import.meta.dirname, 'cli-selftest.l4-e2e.test.mjs');
const STUB_NAMES = ['npx', 'brew', 'curl'];

// Crea un dir de stubs ejecutables que appendean "$0 $@" a `log` y salen 0.
// Puro test: nunca toca prod (`shell` sigue exigiendo `consent`).
export function makeStubDir(names = STUB_NAMES) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'l4-stubs-'));
  const log = path.join(path.dirname(dir), `${path.basename(dir)}.log`);
  for (const name of names) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, `#!/bin/sh\necho "$0 $@" >> ${log}\nexit 0\n`, 'utf8');
    fs.chmodSync(file, 0o755);
  }
  return { dir, log };
}

export function stubInvocations(log) {
  try {
    return fs.readFileSync(log, 'utf8');
  } catch {
    return '';
  }
}

function fakeEnv(stubDir, home) {
  return { ...process.env, PATH: stubDir + path.delimiter + process.env.PATH, HOME: home };
}

function runCli(args, { cwd, env }) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env,
    timeout: 60000,
  });
}

function treeFiles(base) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(base, p)] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(base);
  return out;
}

function runBridge(proj, fixture, env) {
  fs.copyFileSync(fixture, path.join(proj, 'epics.md'));
  return runCli(['bridge', path.join(proj, 'epics.md'), '--out', proj], { cwd: proj, env });
}

// ---------------------------------------------------------------------------
// Tarea 3.1 — sonda: stubs registran invocación; init --only decide el alcance
// ---------------------------------------------------------------------------

test('L4 — makeStubDir crea stubs ejecutables que registran invocación sin red', { timeout: 30000 }, () => {
  const { dir, log } = makeStubDir();
  try {
    for (const name of STUB_NAMES) {
      const st = fs.statSync(path.join(dir, name));
      assert.ok(st.mode & 0o111, `${name} debe ser ejecutable`);
    }
    const r = spawnSync(path.join(dir, 'npx'), ['--yes', 'algo'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(r.status, 0, 'el stub debe salir 0');
    assert.match(stubInvocations(log), /npx --yes algo/, 'el stub debe registrar su invocación en el log');
    assert.ok(!stubInvocations(log).includes('http'), 'el stub no debe tocar la red');
  } finally {
    cleanupDirs(dir);
    try {
      fs.rmSync(log, { force: true });
    } catch {}
  }
});

// ---------------------------------------------------------------------------
// Tarea 3.2 — init --only con PATH falso SHALL salir 0
// ---------------------------------------------------------------------------

test('L4 — init --only layer,surface,gitignore con PATH falso sale 0 sin invocar stubs', { timeout: 120000 }, async () => {
  await withIsolatedHome(async (home) => {
    const proj = makeTempProject('l4-e2e-');
    const { dir: stubDir, log } = makeStubDir();
    try {
      const env = fakeEnv(stubDir, home);
      const r = runCli(
        ['init', proj, '--agents', 'claude-code', '--lang', 'es', '--only', 'layer,surface,gitignore', '--yes'],
        { cwd: proj, env },
      );
      assert.equal(r.status, 0, `init --only debe salir 0 (stderr: ${r.stderr})`);
      assert.ok(
        fs.existsSync(path.join(proj, '.claude', 'commands', 'sw', 'new.md')),
        'la capa debe escribir el comando namespaced de claude-code',
      );
      assert.ok(
        fs.existsSync(path.join(proj, '.un-specweaver', 'config.json')),
        'init debe registrar el estado aunque sea --only',
      );
      assert.equal(stubInvocations(log), '', 'init --only no debe invocar npx/brew/curl (sin red)');
    } finally {
      cleanupDirs(proj, stubDir);
      try {
        fs.rmSync(log, { force: true });
      } catch {}
    }
  });
});

// ---------------------------------------------------------------------------
// Tarea 3.3 — bridge SHALL reproducir determinismo byte a byte (es + en)
// ---------------------------------------------------------------------------

for (const [lang, fixture] of [['es', FIXTURE_ES], ['en', FIXTURE_EN]]) {
  test(`L4 — bridge sobre fixture ${lang} es determinista byte a byte sin red`, { timeout: 120000 }, async () => {
    await withIsolatedHome(async (home) => {
      const { dir: stubDir, log } = makeStubDir();
      const env = fakeEnv(stubDir, home);
      const pa = makeTempProject('l4-a-');
      const pb = makeTempProject('l4-b-');
      try {
        const ra = runBridge(pa, fixture, env);
        assert.equal(ra.status, 0, `bridge ${lang} (a) debe salir 0 (stderr: ${ra.stderr})`);
        const rb = runBridge(pb, fixture, env);
        assert.equal(rb.status, 0, `bridge ${lang} (b) debe salir 0 (stderr: ${rb.stderr})`);
        const ta = treeFiles(path.join(pa, 'openspec'));
        const tb = treeFiles(path.join(pb, 'openspec'));
        assert.deepEqual(Object.keys(ta).sort(), Object.keys(tb).sort(), `bridge ${lang}: ambos proyectos deben emitir los mismos ficheros`);
        assert.ok(Object.keys(ta).length > 0, `bridge ${lang}: debe emitir al menos un change (produjo ${Object.keys(ta).length})`);
        for (const rel of Object.keys(ta)) {
          assert.equal(tb[rel], ta[rel], `bridge ${lang}: ${rel} debe ser byte a byte idéntico`);
        }
        assert.equal(
          fs.readFileSync(path.join(pa, '.un-specweaver', 'trace.json'), 'utf8'),
          fs.readFileSync(path.join(pb, '.un-specweaver', 'trace.json'), 'utf8'),
          `bridge ${lang}: trace.json debe ser determinista`,
        );
      } finally {
        cleanupDirs(pa, pb, stubDir);
        try {
          fs.rmSync(log, { force: true });
        } catch {}
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Tarea 3.3 — doctor SHALL salir 0 en limpio y ≠0 con deriva (resuelto:
// doctor retorna 1 con DRIFT o bloqueo de plan; ver src/init.mjs)
// ---------------------------------------------------------------------------

test('L4 — doctor limpio sale 0 sin DRIFT; tras deriva reporta DRIFT con exit ≠ 0', { timeout: 120000 }, async () => {
  await withIsolatedHome(async (home) => {
    const proj = makeTempProject('l4-e2e-');
    const { dir: stubDir, log } = makeStubDir();
    try {
      const env = fakeEnv(stubDir, home);
      // Estado limpio genuino: _bmad/ y openspec/ preexisten, asi init --only
      // registra las versiones pineadas y ningun paso bloquea planear
      // (blockingPlan 0, sin DRIFT). Puro FS hermetico, sin red.
      fs.mkdirSync(path.join(proj, '_bmad'), { recursive: true });
      fs.mkdirSync(path.join(proj, 'openspec'), { recursive: true });
      const ri = runCli(
        ['init', proj, '--agents', 'claude-code', '--lang', 'es', '--only', 'layer,surface,gitignore', '--yes'],
        { cwd: proj, env },
      );
      assert.equal(ri.status, 0, `precondición: init --only debe salir 0 (stderr: ${ri.stderr})`);
      const clean = runCli(['doctor', proj, '--lang', 'es'], { cwd: proj, env });
      assert.equal(clean.status, 0, 'doctor limpio debe salir 0');
      assert.ok(!clean.stdout.includes('DRIFT'), 'doctor limpio no debe reportar deriva');
      // Deriva hermética sin binarios externos: se adultera la versión
      // registrada en el estado (presente pero recorded !== pinned ⇒ DRIFT).
      const stateFile = path.join(proj, '.un-specweaver', 'config.json');
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      state.vendors.bmad = 'bmad-method@0.0.0-drift';
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', 'utf8');
      const drifted = runCli(['doctor', proj, '--lang', 'es'], { cwd: proj, env });
      assert.match(drifted.stdout, /DRIFT\s+bmad/, 'doctor tras mutar un vendor debe reportar la deriva');
      assert.notEqual(drifted.stdout, clean.stdout, 'la salida con deriva debe diferir de la limpia');
      assert.notEqual(
        drifted.status,
        0,
        'RESUELTO (antes DESVIACIÓN del spec): doctor sale ≠0 con deriva — retorna 1 con DRIFT o bloqueo de plan',
      );
    } finally {
      cleanupDirs(proj, stubDir);
      try {
        fs.rmSync(log, { force: true });
      } catch {}
    }
  });
});

// ---------------------------------------------------------------------------
// Tarea 3.4 — cierre: auditoría de límites del harness
// ---------------------------------------------------------------------------

test('L4 — auditoría: sin helper duplicado ni deps LLM/navegador/red ni suite heredada', { timeout: 30000 }, () => {
  const src = fs.readFileSync(SELF, 'utf8');
  // Patrones construidos por partes: escribirlos literales haría que la
  // auditoría se detectara a sí misma (self-match del propio source).
  const defHelper = new RegExp('function' + ' withIsolatedHome|const' + ' withIsolatedHome');
  assert.ok(!defHelper.test(src), 'la suite debe reutilizar el helper, no definir su propio withIsolatedHome');
  const banned = ['play' + 'wright', 'cy' + 'press', 'selen' + 'ium', 'open' + 'ai', 'anthro' + 'pic', 'pup' + 'peteer'];
  for (const frag of banned) {
    const hit = src.split('\n').some((line) => line.startsWith('import') && line.includes(frag));
    assert.ok(!hit, `la suite no debe importar ${frag} (límite explícito del harness)`);
  }
  const srvFrag = 'serv' + 'er.test.' + 'mjs';
  const hitSrv = src.split('\n').some((line) => line.startsWith('import') && line.includes(srvFrag));
  assert.ok(!hitSrv, 'la suite no debe importar la suite heredada en rojo (queda fuera del cierre)');
  const urlFrag = 'ht' + 'tp://';
  const urlsFrag = 'ht' + 'tps://';
  assert.ok(!src.includes(urlsFrag) && !src.includes(urlFrag), 'la suite no debe contener URLs (sin red real)');
  assert.ok(
    src.includes('withIsolatedHome') && src.includes('makeTempProject') && src.includes('makeStubDir'),
    'la suite debe reutilizar el helper compartido y su sonda de stubs',
  );
});
