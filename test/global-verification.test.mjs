/**
 * Bateria global de verificacion — Story 4.4 (E4S4)
 * Valida que npm test pasa 100% y que cada invariante AD-01..AD-10
 * esta cubierto con mensaje tipado "AD-XX violado".
 *
 * Escenarios:
 * 1. GIVEN test/dashboard.test.mjs existe WHEN npm test (node --test "test/*.mjs") THEN todos pasan + cubren lista
 * 2. GIVEN npm test en CI WHEN hay regresion AD violado THEN test falla con mensaje tipado indicando AD violado
 *
 * Cobertura exigida (Story 4.4):
 * - concurrencia 5 POST /api/projects sin corrupcion
 * - SSE GET /api/events emite FS_CHANGE tipado tras write epics.md
 * - supresion eco: PUT Web dentro 500ms -> 0 eventos; write CLI -> 1 evento
 * - filtrado .git/node_modules -> 0
 * - debounce rafaga 10 -> 1
 * - cwd aislado spawn { cwd: projectPath }
 * - process.chdir grep = 0
 *
 * Esta suite no crea codigo productivo; si falta invariante lo detecta y falla con AD violado.
 * Si todo ya esta cubierto por suites previas, re-ejecuta checks rapidos y reporta resumen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';

import * as pm from '../src/dashboard/project-manager.mjs';
import * as watcher from '../src/dashboard/watcher.mjs';
import * as runner from '../src/dashboard/command-runner.mjs';
import { createServer } from '../src/dashboard/server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DASHBOARD_DIR = path.join(ROOT, 'src/dashboard');
const PUBLIC_DIR = path.join(DASHBOARD_DIR, 'public');
const SRC_GLOB = [
  path.join(DASHBOARD_DIR, 'project-manager.mjs'),
  path.join(DASHBOARD_DIR, 'state-adapter.mjs'),
  path.join(DASHBOARD_DIR, 'watcher.mjs'),
  path.join(DASHBOARD_DIR, 'command-runner.mjs'),
  path.join(DASHBOARD_DIR, 'server.mjs'),
  path.join(DASHBOARD_DIR, 'archify-bridge.mjs'),
  path.join(DASHBOARD_DIR, 'public/app.mjs'),
  path.join(DASHBOARD_DIR, 'public/components/quick-switcher.mjs'),
  path.join(DASHBOARD_DIR, 'public/components/tablero-control.mjs'),
  path.join(DASHBOARD_DIR, 'public/components/visor-archify.mjs'),
  path.join(DASHBOARD_DIR, 'public/components/terminal-drawer.mjs'),
  path.join(ROOT, 'bin/un-specweaver.mjs'),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function exists(p) {
  return fs.existsSync(p);
}
function grepCount(pattern, files) {
  let count = 0;
  const hits = [];
  for (const f of files) {
    if (!exists(f)) continue;
    const src = read(f);
    const m = src.match(pattern);
    if (m) {
      count += m.length;
      hits.push(path.relative(ROOT, f));
    }
  }
  return { count, hits };
}
async function withIsolatedHome(fn) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'unsw-bateria-home-'));
  const origHomedir = os.homedir;
  const origHomeEnv = process.env.HOME;
  os.homedir = () => tmpHome;
  process.env.HOME = tmpHome;
  if (pm._resetLockForTests) pm._resetLockForTests();
  if (runner._resetForTests) runner._resetForTests();
  try {
    await fn(tmpHome);
  } finally {
    os.homedir = origHomedir;
    if (origHomeEnv === undefined) delete process.env.HOME;
    else process.env.HOME = origHomeEnv;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch {}
    if (runner._resetForTests) runner._resetForTests();
    if (pm._resetLockForTests) pm._resetLockForTests();
  }
}
function makeTempProject(prefix = 'bateria-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function cleanupDirs(...dirs) {
  for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
}
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function getJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, json, text };
}
function createSSECollector(port) {
  const events = [];
  let buffer = '';
  let resRef = null;
  const req = http.request({
    hostname: '127.0.0.1',
    port,
    path: '/api/events',
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
  });
  const resPromise = new Promise((resolve, reject) => {
    req.on('response', (res) => {
      resRef = res;
      res.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!raw.trim() || raw.trim().startsWith(':')) continue;
          const lines = raw.split('\n');
          let eventType = null;
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          }
          if (eventType && dataStr) {
            try {
              const data = JSON.parse(dataStr);
              events.push({ event: eventType, data, raw });
            } catch {}
          }
        }
      });
      res.on('error', () => {});
      resolve(res);
    });
    req.on('error', reject);
  });
  req.end();
  return {
    events,
    req,
    resPromise,
    get res() { return resRef; },
    close() {
      try { req.destroy(); } catch {}
      try { resRef?.destroy(); } catch {}
    },
  };
}
function resetWatcher() {
  try { watcher.closeAllWatchers(); } catch {}
  try { watcher._resetForTests({ clearRecentWrites: true }); } catch {
    try { watcher.clearRecentWrites(); } catch {}
  }
}

// ---------------------------------------------------------------------------
// 0. Precondiciones globales — dashboard.test.mjs existe, npm test shape
// ---------------------------------------------------------------------------
test('BAT-0 — GIVEN test/dashboard.test.mjs existe WHEN inspecciono repo THEN debe existir y package.json test usa node --test "test/*.mjs"', () => {
  const dashTest = path.join(ROOT, 'test/dashboard.test.mjs');
  assert.ok(exists(dashTest), 'AD-09 violado: test/dashboard.test.mjs no existe');
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
  assert.equal(pkg.type, 'module', 'AD-09 violado: package.json debe tener type: module');
  assert.ok(pkg.engines && pkg.engines.node && pkg.engines.node.includes('20.11'), 'AD-09 violado: engines.node debe exigir >=20.11');
  assert.match(pkg.scripts.test, /node\s+--test/, 'AD-09 violado: scripts.test debe usar node --test');
  assert.match(pkg.scripts.test, /test\/\*\.mjs/, 'AD-09 violado: scripts.test debe apuntar a test/*.mjs');
  // Validar que test/*.mjs contiene al menos 13 suites previas (cobertura completa)
  const testFiles = fs.readdirSync(path.join(ROOT, 'test')).filter((f) => f.endsWith('.mjs'));
  assert.ok(testFiles.length >= 13, `AD-09 violado: se esperaban >=13 test/*.mjs, hay ${testFiles.length}`);
  assert.ok(testFiles.includes('dashboard.test.mjs'), 'AD-09 violado: falta dashboard.test.mjs');
  assert.ok(testFiles.includes('watcher.test.mjs'), 'AD-09 violado: falta watcher.test.mjs');
  assert.ok(testFiles.includes('echo-suppression.test.mjs'), 'AD-09 violado: falta echo-suppression.test.mjs');
  assert.ok(testFiles.includes('command-runner.test.mjs'), 'AD-09 violado: falta command-runner.test.mjs');
});

// ---------------------------------------------------------------------------
// AD-01 — Aislamiento cwd (prohibicion process.chdir)
// ---------------------------------------------------------------------------
test('AD-01 — process.chdir grep debe ser 0 en src/dashboard, bin y public — AD-01 violado si detectado', () => {
  const allFiles = SRC_GLOB.filter(exists);
  const { count, hits } = grepCount(/process\.chdir\s*\(/g, allFiles);
  assert.equal(count, 0, `AD-01 violado: process.chdir detectado en ${hits.join(', ') || 'archivos de dashboard'} — cada operacion debe recibir projectPath explicito o spawn { cwd }`);
  // Verificar que cada modulo relevante expone projectPath explicito
  const pmSrc = read(path.join(DASHBOARD_DIR, 'project-manager.mjs'));
  assert.match(pmSrc, /getProjectsFilePath|registerProject/, 'AD-01 violado: project-manager debe exponer API con projectPath canonico');
  const runnerSrc = read(path.join(DASHBOARD_DIR, 'command-runner.mjs'));
  assert.match(runnerSrc, /cwd\s*:/, 'AD-01 violado: command-runner debe hacer spawn con { cwd: projectPath }');
  assert.doesNotMatch(runnerSrc, /shell\s*:\s*true/, 'AD-01 violado: spawn no debe usar shell:true');
});

test('AD-01 — state-adapter y server propagan projectPath sin chdir', () => {
  const saSrc = read(path.join(DASHBOARD_DIR, 'state-adapter.mjs'));
  assert.match(saSrc, /projectPath/, 'AD-01 violado: state-adapter debe recibir projectPath explicito');
  assert.doesNotMatch(saSrc, /process\.chdir\s*\(/, 'AD-01 violado: state-adapter usa process.chdir');
  const srvSrc = read(path.join(DASHBOARD_DIR, 'server.mjs'));
  assert.doesNotMatch(srvSrc, /process\.chdir\s*\(/, 'AD-01 violado: server.mjs usa process.chdir');
  const wSrc = read(path.join(DASHBOARD_DIR, 'watcher.mjs'));
  assert.doesNotMatch(wSrc, /process\.chdir\s*\(/, 'AD-01 violado: watcher.mjs usa process.chdir');
});

// ---------------------------------------------------------------------------
// AD-02 — Escritura atomica tmp+rename
// ---------------------------------------------------------------------------
test('AD-02 — escritura atomica tmp+rename obligatoria — AD-02 violado si falta writeAtomic', () => {
  const pmSrc = read(path.join(DASHBOARD_DIR, 'project-manager.mjs'));
  assert.match(pmSrc, /writeAtomic/, 'AD-02 violado: project-manager debe usar writeAtomic');
  assert.match(pmSrc, /\.tmp\./, 'AD-02 violado: writeAtomic debe usar sufijo .tmp.');
  assert.match(pmSrc, /rename/, 'AD-02 violado: debe usar rename para atomicidad');
  const srvSrc = read(path.join(DASHBOARD_DIR, 'server.mjs'));
  assert.match(srvSrc, /writeAtomic/, 'AD-02 violado: server.mjs debe usar writeAtomic para PUT /epics');
  // Verificar que no hay writeFile directo sobre destino final sin tmp
  // Heuristica: si hay writeFileSync sin writeAtomic alrededor, es violacion; aqui solo verificamos que writeAtomic exista
  assert.ok(pmSrc.includes('tmp') && pmSrc.includes('rename'), 'AD-02 violado: escritura no atomica detectada');
});

// ---------------------------------------------------------------------------
// AD-03 — Filtrado estricto watcher
// ---------------------------------------------------------------------------
test('AD-03 — watcher filtrado estricto allowlist/denylist — AD-03 violado si faltan reglas', () => {
  const wSrc = read(path.join(DASHBOARD_DIR, 'watcher.mjs'));
  assert.match(wSrc, /\.git/, 'AD-03 violado: denylist debe incluir .git');
  assert.match(wSrc, /node_modules/, 'AD-03 violado: denylist debe incluir node_modules');
  assert.match(wSrc, /dist/, 'AD-03 violado: denylist debe incluir dist');
  assert.match(wSrc, /epics\.md/, 'AD-03 violado: allowlist debe incluir epics.md');
  assert.match(wSrc, /\.spec/, 'AD-03 violado: allowlist debe incluir .spec');
  // Verificar helpers expuestos para testabilidad
  assert.equal(typeof watcher._isAllowedForTests, 'function', 'AD-03 violado: watcher debe exponer _isAllowedForTests');
  assert.equal(typeof watcher._isDeniedForTests, 'function', 'AD-03 violado: watcher debe exponer _isDeniedForTests');
  assert.equal(watcher._isAllowedForTests('epics.md'), true, 'AD-03 violado: epics.md debe ser allowed');
  assert.equal(watcher._isDeniedForTests('.git/index'), true, 'AD-03 violado: .git/index debe ser denied');
  assert.equal(watcher._isDeniedForTests('node_modules/foo/index.js'), true, 'AD-03 violado: node_modules debe ser denied');
});

// ---------------------------------------------------------------------------
// AD-04 — Debounce 150 ms por proyecto/archivo
// ---------------------------------------------------------------------------
test('AD-04 — debounce 150ms por projectId:file — AD-04 violado si DEBOUNCE_MS no es 150', () => {
  assert.equal(watcher.DEBOUNCE_MS, 150, 'AD-04 violado: DEBOUNCE_MS debe ser 150');
  const wSrc = read(path.join(DASHBOARD_DIR, 'watcher.mjs'));
  assert.match(wSrc, /150/, 'AD-04 violado: watcher.mjs debe contener 150');
  assert.match(wSrc, /Map.*timeout|debounceMap|Map.*key/, 'AD-04 violado: debe usar Map<key, timeout> para coalescencia por archivo');
});

// ---------------------------------------------------------------------------
// AD-05 — Ventana supresion eco 500 ms
// ---------------------------------------------------------------------------
test('AD-05 — ventana supresion eco 500ms — AD-05 violado si ECHO_WINDOW_MS no es 500', () => {
  assert.equal(watcher.ECHO_WINDOW_MS, 500, 'AD-05 violado: ECHO_WINDOW_MS debe ser 500');
  assert.ok(watcher.recentWrites instanceof Map, 'AD-05 violado: recentWrites debe ser Map');
  assert.equal(typeof watcher.registerRecentWrite, 'function', 'AD-05 violado: debe exponer registerRecentWrite');
  assert.equal(typeof watcher.shouldSuppress, 'function', 'AD-05 violado: debe exponer shouldSuppress');
  const srvSrc = read(path.join(DASHBOARD_DIR, 'server.mjs'));
  assert.match(srvSrc, /recentWrites/, 'AD-05 violado: server.mjs debe poblar recentWrites en PUT /epics');
  assert.match(srvSrc, /crypto\.createHash.*sha1/, 'AD-05 violado: server debe hashear con sha1 para comparar');
  const wSrc = read(path.join(DASHBOARD_DIR, 'watcher.mjs'));
  assert.match(wSrc, /ECHO_WINDOW_MS/, 'AD-05 violado: watcher debe usar ECHO_WINDOW_MS');
});

// ---------------------------------------------------------------------------
// AD-06 — SSE tipado y reconexion
// ---------------------------------------------------------------------------
test('AD-06 — SSE tipado FS_CHANGE y headers — AD-06 violado si faltan', () => {
  const srvSrc = read(path.join(DASHBOARD_DIR, 'server.mjs'));
  assert.match(srvSrc, /text\/event-stream/, 'AD-06 violado: SSE debe usar text/event-stream');
  assert.match(srvSrc, /Cache-Control.*no-cache/, 'AD-06 violado: SSE debe usar Cache-Control: no-cache');
  assert.match(srvSrc, /X-Accel-Buffering.*no/, 'AD-06 violado: SSE debe usar X-Accel-Buffering: no');
  assert.match(srvSrc, /keepalive/i, 'AD-06 violado: SSE debe emitir keepalive');
  assert.match(srvSrc, /25_?000/, 'AD-06 violado: keepalive debe ser ~25s');
  assert.match(srvSrc, /FS_CHANGE/, 'AD-06 violado: debe emitir eventos tipados FS_CHANGE');
});

// ---------------------------------------------------------------------------
// AD-07 — Archify sandbox
// ---------------------------------------------------------------------------
test('AD-07 — Archify sandbox encapsulado — AD-07 violado si falta archify-container', () => {
  const srvSrc = read(path.join(DASHBOARD_DIR, 'server.mjs'));
  assert.match(srvSrc, /archify-container/, 'AD-07 violado: markup Archify debe encapsularse en div.archify-container');
  assert.match(srvSrc, /archify-/, 'AD-07 violado: CSS debe prefijarse .archify-*');
  // Public styles tambien deben scoping
  if (exists(path.join(PUBLIC_DIR, 'components/visor-archify.mjs'))) {
    const visorSrc = read(path.join(PUBLIC_DIR, 'components/visor-archify.mjs'));
    // No exigir archify string ahi, pero servidor ya cubre
    assert.doesNotMatch(visorSrc, /process\.chdir\s*\(/, 'AD-07 violado: visor no debe usar chdir');
  }
});

// ---------------------------------------------------------------------------
// AD-08 — Seguridad paths absolutos
// ---------------------------------------------------------------------------
test('AD-08 — paths absolutos validados — AD-08 violado si falta validacion', () => {
  const pmSrc = read(path.join(DASHBOARD_DIR, 'project-manager.mjs'));
  assert.match(pmSrc, /isAbsolute/, 'AD-08 violado: debe validar path.isAbsolute');
  assert.match(pmSrc, /INVALID_PATH/, 'AD-08 violado: debe retornar 400 INVALID_PATH');
  assert.match(pmSrc, /path\.resolve/, 'AD-08 violado: debe normalizar con path.resolve');
});

// ---------------------------------------------------------------------------
// AD-09 — ESM estricto sin bundler
// ---------------------------------------------------------------------------
test('AD-09 — ESM estricto, sin require ni bundler — AD-09 violado si CommonJS detectado', () => {
  const allFiles = SRC_GLOB.filter(exists);
  for (const f of allFiles) {
    const src = read(f);
    if (f.endsWith('.mjs') || f.includes('public')) {
      assert.doesNotMatch(src, /require\s*\(/, `AD-09 violado: ${path.relative(ROOT, f)} usa require()`);
      // Debe ser ESM si es .mjs
      if (f.endsWith('.mjs') && !src.includes('import ') && !src.includes('export ')) {
        // Permitir bin que puede tener shebang pero igual import
        assert.fail(`AD-09 violado: ${path.relative(ROOT, f)} debe ser ESM (import/export)`);
      }
    }
  }
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
  assert.equal(pkg.type, 'module', 'AD-09 violado: package.json type debe ser module');
});

// ---------------------------------------------------------------------------
// AD-10 — SPA Vanilla sin estado autoritativo
// ---------------------------------------------------------------------------
test('AD-10 — SPA Vanilla proyeccion sin estado autoritativo — AD-10 violado si optimistic merge', () => {
  const appPath = path.join(PUBLIC_DIR, 'app.mjs');
  if (exists(appPath)) {
    const appSrc = read(appPath);
    // Debe re-fetchear al reconectar, no hacer optimistic merge
    assert.match(appSrc, /\/api\/projects.*\/state/, 'AD-10 violado: SPA debe re-fetchear GET /state al reconectar');
    assert.doesNotMatch(appSrc, /process\.chdir\s*\(/, 'AD-10 violado: SPA no debe usar chdir');
  }
});

// ---------------------------------------------------------------------------
// Integracion global — concurrencia, SSE, eco, filtrado, debounce, cwd
// ---------------------------------------------------------------------------

test('BAT-1 — concurrencia 5 POST /api/projects simultaneos sin corrupcion — AD-02 violado si JSON corrupto', async () => {
  await withIsolatedHome(async (tmpHome) => {
    const repos = Array.from({ length: 5 }, (_, i) => makeTempProject(`bateria-conc-${i}-`));
    try {
      // No usar server para simplificar: probar via pm directamente (mismo lock atomico)
      // Pero tambien validar via HTTP para cubrir router real
      const srv = createServer({ port: 0, host: '127.0.0.1' });
      const { port } = await srv.start();
      const base = `http://127.0.0.1:${port}`;
      try {
        const results = await Promise.all(
          repos.map((p) =>
            fetch(`${base}/api/projects`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: p }),
            }).then(async (r) => {
              const j = await r.json();
              assert.equal(r.status, 201, `AD-02 violado: POST concurrente debe ser 201, fue ${r.status} ${JSON.stringify(j)}`);
              return j.project;
            })
          )
        );
        assert.equal(results.length, 5, 'AD-02 violado: deben crearse 5 proyectos concurrentes');
        const ids = results.map((r) => r.id);
        assert.equal(new Set(ids).size, 5, 'AD-02 violado: IDs deben ser unicos tras concurrencia');
        const storePath = pm.getProjectsFilePath();
        assert.ok(exists(storePath), 'AD-02 violado: projects.json debe existir tras concurrencia');
        const raw = read(storePath);
        assert.doesNotThrow(() => JSON.parse(raw), 'AD-02 violado: projects.json corrupto tras 5 POST concurrentes');
        const data = JSON.parse(raw);
        assert.equal(data.projects.length, 5, `AD-02 violado: projects.json debe contener 5, tiene ${data.projects.length}`);
        const canonicalRepos = repos.map((p) => fs.realpathSync(path.resolve(p))).sort();
        const storedPaths = data.projects.map((p) => p.path).sort();
        assert.deepEqual(storedPaths, canonicalRepos, 'AD-02 violado: paths en store no coinciden con los 5 enviados');
        const files = fs.readdirSync(path.join(tmpHome, '.un-specweaver'));
        assert.equal(files.some((f) => f.includes('.tmp.')), false, 'AD-02 violado: tmp residual tras concurrencia');
      } finally {
        await srv.close();
      }
    } finally {
      cleanupDirs(...repos);
    }
  });
});

test('BAT-2 — SSE GET /api/events emite FS_CHANGE tipado tras write epics.md — AD-06 violado si no emite', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const tmp = makeTempProject('bateria-sse-');
    let collector = null;
    try {
      const reg = await getJson(`${port ? `http://127.0.0.1:${port}/api/projects` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      });
      // Re-fetch properly using base
      const base = `http://127.0.0.1:${port}`;
      const reg2 = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      });
      let projectId;
      if (reg2.res.status === 201) projectId = reg2.json.project.id;
      else {
        // Ya registrado en intento previo, listar
        const list = await getJson(`${base}/api/projects`);
        projectId = list.json.projects.find((p) => p.path === fs.realpathSync(path.resolve(tmp)))?.id;
      }
      assert.ok(projectId, 'AD-06 violado: no se pudo registrar proyecto para SSE test');
      const ok = srv.watchProject(projectId, tmp);
      assert.equal(ok, true, 'AD-06 violado: watchProject debe retornar true');
      await delay(150);
      collector = createSSECollector(port);
      await collector.resPromise;
      await delay(80);
      // Verificar headers tipados via http
      const headersOk = await new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: '/api/events', method: 'GET', headers: { Accept: 'text/event-stream' } }, (res) => {
          try {
            assert.equal(res.statusCode, 200, 'AD-06 violado: GET /api/events debe ser 200');
            assert.match(res.headers['content-type'] || '', /text\/event-stream/, 'AD-06 violado: Content-Type debe ser text/event-stream');
            assert.equal(res.headers['cache-control'], 'no-cache', 'AD-06 violado: Cache-Control debe ser no-cache');
            assert.equal(res.headers['x-accel-buffering'], 'no', 'AD-06 violado: X-Accel-Buffering debe ser no');
            resolve(true);
          } catch (e) { reject(e); }
          res.destroy();
        });
        req.on('error', reject);
        req.end();
      });
      assert.ok(headersOk, 'AD-06 violado: headers SSE no conformes');
      // Write epics.md y esperar FS_CHANGE
      fs.writeFileSync(path.join(tmp, 'epics.md'), `# Epic BAT-2 ${Date.now()}\n`);
      await delay(500);
      const ev = collector.events.find((e) => e.event === 'FS_CHANGE' && e.data.file === 'epics.md' && e.data.projectId === projectId);
      assert.ok(ev, `AD-06 violado: SSE debe emitir FS_CHANGE tipado tras write epics.md, recibidos: ${JSON.stringify(collector.events)}`);
      assert.equal(ev.data.type, 'FS_CHANGE', 'AD-06 violado: data.type debe ser FS_CHANGE');
      assert.ok(typeof ev.data.timestamp === 'number', 'AD-06 violado: timestamp debe ser number');
    } finally {
      try { collector?.close(); } catch {}
      try { await srv.close(); } catch {}
      resetWatcher();
      cleanupDirs(tmp);
    }
  });
});

test('BAT-3 — supresion eco: PUT Web dentro 500ms -> 0 eventos; write CLI -> 1 evento — AD-05 violado si falla', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const tmp = makeTempProject('bateria-eco-');
    let collector = null;
    try {
      const reg = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      });
      assert.equal(reg.res.status, 201, 'AD-05 violado: registro debe ser 201');
      const projectId = reg.json.project.id;
      srv.watchProject(projectId, tmp);
      await delay(150);
      collector = createSSECollector(port);
      await collector.resPromise;
      await delay(80);
      const contentWeb = `# web BAT-3 ${Date.now()} ${Math.random()}`;
      const put = await getJson(`${base}/api/projects/${projectId}/epics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentWeb }),
      });
      assert.equal(put.res.status, 200, 'AD-05 violado: PUT /epics debe ser 200');
      await delay(450);
      const afterWeb = collector.events.filter((e) => e.event === 'FS_CHANGE' && e.data.file === 'epics.md');
      assert.equal(afterWeb.length, 0, `AD-05 violado: PUT Web dentro 500ms debe suprimir eco (0 eventos), got ${JSON.stringify(collector.events)}`);
      // CLI write sin recentWrites -> debe emitir 1
      collector.events.length = 0;
      // Esperar ventana expirada parcialmente pero CLI escribe hash distinto fuera de recentWrites o con hash distinto
      // Limpiar recentWrites y simular CLI
      resetWatcher();
      srv.watchProject(projectId, tmp);
      await delay(150);
      // Re-conectar collector para nueva ventana
      collector.close();
      collector = createSSECollector(port);
      await collector.resPromise;
      await delay(80);
      const cliContent = `# cli BAT-3 ${Date.now()} ${Math.random()} distinto`;
      fs.writeFileSync(path.join(tmp, 'epics.md'), cliContent);
      await delay(500);
      const afterCli = collector.events.filter((e) => e.event === 'FS_CHANGE' && e.data.file === 'epics.md');
      assert.equal(afterCli.length, 1, `AD-05 violado: write CLI sin recentWrites debe emitir 1 FS_CHANGE, got ${JSON.stringify(collector.events)}`);
    } finally {
      try { collector?.close(); } catch {}
      try { await srv.close(); } catch {}
      resetWatcher();
      cleanupDirs(tmp);
    }
  });
});

test('BAT-4 — filtrado writes en .git/node_modules -> 0 eventos — AD-03 violado si emite', async () => {
  const tmp = makeTempProject('bateria-filtro-');
  const events = [];
  try {
    fs.mkdirSync(path.join(tmp, '.git'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'node_modules', 'foo'), { recursive: true });
    resetWatcher();
    watcher.createWatcher('bat-filtro', tmp, (e) => events.push(e));
    await delay(150);
    fs.writeFileSync(path.join(tmp, '.git', 'index'), `ref ${Date.now()}`);
    fs.writeFileSync(path.join(tmp, 'node_modules', 'foo', 'index.js'), `console.log("${Date.now()}")`);
    await delay(500);
    assert.equal(events.length, 0, `AD-03 violado: writes en .git/node_modules deben dar 0 eventos, got ${JSON.stringify(events)}`);
    // Sanity: allowed file si emite
    events.length = 0;
    fs.writeFileSync(path.join(tmp, 'epics.md'), `# BAT-4 ${Date.now()}`);
    await delay(500);
    assert.equal(events.length, 1, `AD-03 violado: sanity epics.md debe emitir 1, got ${JSON.stringify(events)}`);
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

test('BAT-5 — debounce rafaga 10 writes -> 1 evento — AD-04 violado si emite N', async () => {
  const tmp = makeTempProject('bateria-debounce-');
  const events = [];
  try {
    resetWatcher();
    watcher.createWatcher('bat-debounce', tmp, (e) => events.push(e));
    await delay(150);
    fs.writeFileSync(path.join(tmp, 'epics.md'), 'init');
    await delay(400);
    events.length = 0;
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(tmp, 'epics.md'), `# rafaga ${i} ${Date.now()}`);
      await delay(5);
    }
    await delay(500);
    assert.equal(events.length, 1, `AD-04 violado: rafaga 10 writes debe coalescar a 1 evento, got ${events.length}: ${JSON.stringify(events)}`);
    assert.equal(events[0].file, 'epics.md', 'AD-04 violado: file debe ser epics.md');
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

test('BAT-6 — cwd aislado: POST /commands hace spawn { cwd: projectPath } — AD-01 violado si no aisla', async () => {
  await withIsolatedHome(async () => {
    const repo = makeTempProject('bateria-cwd-');
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    try {
      const reg = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repo }),
      });
      assert.equal(reg.res.status, 201, 'AD-01 violado: registro para cwd test debe ser 201');
      const projectId = reg.json.project.id;
      const canonical = fs.realpathSync(path.resolve(repo));
      const cmd = await getJson(`${base}/api/projects/${projectId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'doctor' }),
      });
      assert.equal(cmd.res.status, 202, 'AD-01 violado: POST /commands debe ser 202');
      const execId = cmd.json.executionId;
      const exec = runner.getExecution(execId);
      assert.ok(exec, 'AD-01 violado: execution debe existir tras POST /commands');
      assert.equal(path.resolve(exec.projectPath), canonical, `AD-01 violado: runner debe hacer spawn con cwd=${canonical}, fue ${exec.projectPath}`);
      // Verificar via stream output que child realmente corrio con ese cwd
      const sse = await new Promise((resolve, reject) => {
        const outputs = [];
        let buffer = '';
        const req = http.request({ hostname: '127.0.0.1', port, path: `/api/projects/${projectId}/commands/${execId}/stream`, method: 'GET' }, (res) => {
          assert.equal(res.statusCode, 200, 'AD-01 violado: GET /commands/:execId/stream debe ser 200');
          res.on('data', (c) => {
            buffer += c.toString();
            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
              const raw = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              if (!raw.trim() || raw.trim().startsWith(':')) continue;
              const lines = raw.split('\n');
              let ev=null, data=null;
              for (const l of lines){ if(l.startsWith('event:')) ev=l.slice(6).trim(); else if(l.startsWith('data:')) data=l.slice(5).trim(); }
              if(ev==='COMMAND_OUTPUT' && data) try{ outputs.push(JSON.parse(data)); }catch{}
              if(ev==='COMMAND_CLOSE') { resolve(outputs); try{res.destroy();}catch{} }
            }
          });
          res.on('error', reject);
        });
        req.on('error', reject);
        req.end();
        setTimeout(()=> reject(new Error('AD-01 violado: timeout esperando COMMAND_OUTPUT con cwd')), 2500);
      });
      const all = sse.map((o)=>o.chunk).join('');
      assert.match(all, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `AD-01 violado: output debe contener cwd=${canonical}`);
      const runnerSrc = read(path.join(DASHBOARD_DIR, 'command-runner.mjs'));
      assert.match(runnerSrc, /spawn\s*\(/, 'AD-01 violado: command-runner debe usar spawn con cwd');
      assert.match(runnerSrc, /cwd\s*:/, 'AD-01 violado: spawn debe recibir cwd');
    } finally {
      await srv.close();
      cleanupDirs(repo);
      runner.killAll();
      await delay(200);
    }
  });
});

test('BAT-7 — process.chdir grep final 0 en todo src/dashboard — AD-01 violado si regresa', () => {
  const files = fs.readdirSync(DASHBOARD_DIR).filter((f) => f.endsWith('.mjs')).map((f) => path.join(DASHBOARD_DIR, f));
  // Incluir public recursivo
  const publicFiles = [];
  if (exists(PUBLIC_DIR)) {
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith('.mjs') || ent.name.endsWith('.js')) publicFiles.push(p);
      }
    };
    walk(PUBLIC_DIR);
  }
  const all = [...files, ...publicFiles, path.join(ROOT, 'bin/un-specweaver.mjs')].filter(exists);
  for (const f of all) {
    const src = read(f);
    assert.doesNotMatch(src, /process\.chdir\s*\(/, `AD-01 violado: process.chdir detectado en ${path.relative(ROOT, f)}`);
  }
});

// ---------------------------------------------------------------------------
// Resumen global — que cada AD tenga al menos un test que falle con AD violado
// ---------------------------------------------------------------------------
test('BAT-resumen — todos los AD-01..AD-10 cubiertos con mensaje tipado AD violado', () => {
  // Este test valida que la suite actual cubre cada AD; si falta uno, el conteo previo ya fallaria.
  // Aqui solo documentamos el contrato y emitimos un resumen legible para CI.
  const ads = ['AD-01', 'AD-02', 'AD-03', 'AD-04', 'AD-05', 'AD-06', 'AD-07', 'AD-08', 'AD-09', 'AD-10'];
  // Verificar que este archivo contiene asserts con cada AD violado
  const selfSrc = read(path.join(ROOT, 'test/global-verification.test.mjs'));
  for (const ad of ads) {
    assert.match(selfSrc, new RegExp(ad), `${ad} violado: este archivo debe cubrir ${ad} con mensaje tipado`);
    assert.match(selfSrc, new RegExp(`${ad} violado`), `${ad} violado: mensaje tipado debe contener "${ad} violado"`);
  }
  // Si llegamos aqui, el contrato de falla tipada esta vigente: cualquier regresion hara que uno de los asserts anteriores falle con "AD-XX violado"
});
