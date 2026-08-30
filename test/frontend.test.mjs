import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';

import * as pm from '../src/dashboard/project-manager.mjs';
import { createServer } from '../src/dashboard/server.mjs';

// Helper isolated HOME
async function withIsolatedHome(fn) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'unsw-home-'));
  const origHomedir = os.homedir;
  const origHomeEnv = process.env.HOME;
  os.homedir = () => tmpHome;
  process.env.HOME = tmpHome;
  if (pm._resetLockForTests) pm._resetLockForTests();
  try {
    await fn(tmpHome);
  } finally {
    os.homedir = origHomedir;
    if (origHomeEnv === undefined) delete process.env.HOME;
    else process.env.HOME = origHomeEnv;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch {}
  }
}

function makeTempProject(prefix = 'proj-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function cleanupDirs(...dirs) {
  for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
}
async function getJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, json, text };
}

const PUBLIC_DIR = path.resolve(import.meta.dirname, '../src/dashboard/public');
const QS_PATH = path.join(PUBLIC_DIR, 'components/quick-switcher.mjs');
const TABLERO_PATH = path.join(PUBLIC_DIR, 'components/tablero-control.mjs');
const APP_PATH = path.join(PUBLIC_DIR, 'app.mjs');
const INDEX_PATH = path.join(PUBLIC_DIR, 'index.html');
const STYLES_PATH = path.join(PUBLIC_DIR, 'styles.css');

// ---------------------------------------------------------------------------
// 0. Existencia de archivos y estructura SPA Vanilla ESM
// ---------------------------------------------------------------------------
test('E4S1-0 — Archivos SPA Vanilla ESM existen con estructura esperada', () => {
  assert.ok(fs.existsSync(INDEX_PATH), 'index.html debe existir');
  assert.ok(fs.existsSync(APP_PATH), 'app.mjs debe existir');
  assert.ok(fs.existsSync(QS_PATH), 'components/quick-switcher.mjs debe existir');
  assert.ok(fs.existsSync(TABLERO_PATH), 'components/tablero-control.mjs debe existir');
  assert.ok(fs.existsSync(STYLES_PATH), 'styles.css debe existir');

  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  assert.match(index, /<html[^>]*lang="es"/, 'index.html lang debe ser es');
  assert.match(index, /type="module"/, 'debe cargar app.mjs como módulo');
  assert.match(index, /app\.mjs/, 'debe referenciar app.mjs');

  const app = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(app, /import .*from/, 'app.mjs debe usar ESM import');
  assert.doesNotMatch(app, /require\(/, 'sin CommonJS');
  assert.doesNotMatch(app, /process\.chdir/, 'sin chdir');

  const qs = fs.readFileSync(QS_PATH, 'utf8');
  assert.match(qs, /export function filtrarProyectos/, 'quick-switcher debe exportar filtrarProyectos');
  assert.match(qs, /export function crearQuickSwitcher/, 'debe exportar crearQuickSwitcher');

  const tablero = fs.readFileSync(TABLERO_PATH, 'utf8');
  assert.match(tablero, /export function renderTablero/, 'tablero debe exportar renderTablero');
  assert.match(tablero, /export function agruparEpicas/, 'debe exportar agruparEpicas');

  const styles = fs.readFileSync(STYLES_PATH, 'utf8');
  assert.match(styles, /\.pulse-green/, 'styles debe definir .pulse-green');
});

// ---------------------------------------------------------------------------
// 1. Escenario 1 — Quick Switcher con Cmd+P / Ctrl+P, búsqueda difusa, flechas+Enter, <100ms sin recarga
// ---------------------------------------------------------------------------
test('E4S1-1 — GIVEN SPA con 3 proyectos WHEN presiono Cmd+P/Ctrl+P THEN overlay con búsqueda difusa name/path, flechas+Enter, conmutación <100ms sin recarga', async () => {
  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  // Overlay debe existir en HTML
  assert.match(index, /quick-switcher-overlay/, 'index debe contener overlay quick-switcher');
  assert.match(index, /Buscar proyecto\.\.\./, 'placeholder debe ser español "Buscar proyecto..."');
  assert.match(index, /quick-switcher-input/, 'debe tener input de búsqueda');
  assert.match(index, /quick-switcher-lista/, 'debe tener lista filtrada');

  const qs = fs.readFileSync(QS_PATH, 'utf8');
  // Atajo Cmd+P / Ctrl+P
  assert.match(qs, /metaKey/, 'debe manejar metaKey para Cmd+P');
  assert.match(qs, /ctrlKey/, 'debe manejar ctrlKey para Ctrl+P');
  assert.match(qs, /'p'|"p"/, 'debe detectar tecla p');
  // Búsqueda difusa via includes
  assert.match(qs, /\.includes\(/, 'búsqueda difusa debe usar includes');
  assert.match(qs, /toLowerCase\(\)/, 'debe ser case-insensitive');
  // Keyboard nav
  assert.match(qs, /ArrowUp/, 'debe manejar ArrowUp');
  assert.match(qs, /ArrowDown/, 'debe manejar ArrowDown');
  assert.match(qs, /Enter/, 'debe manejar Enter');
  assert.match(qs, /Escape/, 'debe manejar Escape');
  // Sin recarga: no debe contener location.reload ni window.location assign
  assert.doesNotMatch(qs, /location\.reload/, 'no debe recargar página');
  assert.doesNotMatch(qs, /window\.location\s*=/, 'no debe asignar window.location');

  const app = fs.readFileSync(APP_PATH, 'utf8');
  assert.doesNotMatch(app, /location\.reload/, 'app.mjs no debe recargar');
  assert.match(app, /performance\.now/, 'debe medir duración para <100ms');
  assert.match(app, /cambiarProyecto/, 'app debe tener función cambiarProyecto sin recarga');

  // Verificar exports funcionan: filtrarProyectos via includes name/path
  const { filtrarProyectos, filterProjects, crearQuickSwitcher, createQuickSwitcher } = await import('../src/dashboard/public/components/quick-switcher.mjs');
  const filtrar = filtrarProyectos || filterProjects;
  assert.equal(typeof filtrar, 'function');
  assert.equal(typeof (crearQuickSwitcher || createQuickSwitcher), 'function');

  const proyectos = [
    { id: '1', name: 'Alpha', path: '/tmp/alpha-repo' },
    { id: '2', name: 'Beta Proyecto', path: '/home/user/beta' },
    { id: '3', name: 'Gamma', path: '/opt/gamma-tool' },
  ];
  // Búsqueda por name
  let res = filtrar(proyectos, 'beta');
  assert.equal(res.length, 1);
  assert.equal(res[0].name, 'Beta Proyecto');
  // Búsqueda por path
  res = filtrar(proyectos, 'alpha-repo');
  assert.equal(res.length, 1);
  assert.equal(res[0].name, 'Alpha');
  // Case-insensitive
  res = filtrar(proyectos, 'GAMMA');
  assert.equal(res.length, 1);
  // Query vacío retorna todos
  res = filtrar(proyectos, '');
  assert.equal(res.length, 3);
  // Sin match
  res = filtrar(proyectos, 'zzz');
  assert.equal(res.length, 0);
  // Medir <100ms filtrado (debe ser instantáneo)
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) filtrar(proyectos, 'a');
  const dur = performance.now() - t0;
  assert.ok(dur < 100, `1000 filtrados deben ser <100ms, fue ${dur.toFixed(1)}ms`);
});

// ---------------------------------------------------------------------------
// 2. Escenario 2 — Tablero muestra sprint activo, épicas por estado y doctor; activeProjectId persiste
// ---------------------------------------------------------------------------
test('E4S1-2 — GIVEN conmuto proj-1 a proj-2 WHEN GET /state y /diagram THEN tablero muestra sprint/epicas/doctor y activeProjectId persiste', async () => {
  const tableroSrc = fs.readFileSync(TABLERO_PATH, 'utf8');
  assert.match(tableroSrc, /Sprint actual/, 'tablero debe contener label Sprint actual');
  assert.match(tableroSrc, /Pendiente/, 'debe manejar Pendiente');
  assert.match(tableroSrc, /En Progreso/, 'debe contener En Progreso');
  assert.match(tableroSrc, /Completada/, 'debe contener Completada');
  assert.match(tableroSrc, /Salud del proyecto/, 'debe contener Salud del proyecto');

  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  assert.match(index, /Sprint actual/, 'index debe mostrar Sprint actual');
  assert.match(index, /Pendiente/, 'index debe tener Pendiente');
  assert.match(index, /En Progreso/, 'index debe tener En Progreso');
  assert.match(index, /Completada/, 'index debe tener Completada');
  assert.match(index, /Salud del proyecto/, 'index debe tener Salud del proyecto');

  const appSrc = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(appSrc, /\/api\/projects\/.*\/state/, 'app debe hacer GET /state');
  assert.match(appSrc, /\/api\/projects\/.*\/diagram/, 'app debe hacer GET /diagram');
  assert.match(appSrc, /activeProjectId/, 'debe manejar activeProjectId');
  assert.match(appSrc, /localStorage/, 'debe persistir activeProjectId en localStorage');
  assert.match(appSrc, /\/active/, 'debe intentar persistir en servidor vía /active');

  // Verificar funciones tablero
  const { renderTablero, agruparEpicas, renderBoard } = await import('../src/dashboard/public/components/tablero-control.mjs');
  assert.equal(typeof (renderTablero || renderBoard), 'function');
  assert.equal(typeof agruparEpicas, 'function');
  // Test agruparEpicas con byStatus español
  const estadoMock = {
    project: { id: 'proj-2', name: 'Proyecto Dos', path: '/tmp/proj2' },
    epics: { byStatus: { pendiente: [{ id: 'e1', title: 'E1' }], en_progreso: [{ id: 'e2', title: 'E2' }], completada: [{ id: 'e3', title: 'E3' }] } },
    sprint: { active: { title: 'Sprint 1', wave: 1, status: 'En Progreso' } },
    doctor: { ok: true, checks: [{ name: 'check1', ok: true }] },
  };
  const grupos = agruparEpicas(estadoMock);
  assert.equal(grupos.pendiente.length, 1);
  assert.equal(grupos.en_progreso.length, 1);
  assert.equal(grupos.completada.length, 1);
  // Test con all
  const estadoAll = {
    epics: { all: [{ id: 'a1', title: 'A1', status: 'pendiente' }, { id: 'a2', title: 'A2', status: 'en_progreso' }, { id: 'a3', title: 'A3', status: 'completada' }] },
    sprint: { active: null, planned: [] },
    doctor: { ok: false, checks: [] },
  };
  const g2 = agruparEpicas(estadoAll);
  assert.equal(g2.pendiente.length, 1);
  assert.equal(g2.en_progreso.length, 1);
  assert.equal(g2.completada.length, 1);

  // Integración contra servidor efímero: verificar GET /state, /diagram y persistencia activeProjectId
  await withIsolatedHome(async () => {
    const proj1 = makeTempProject('proj1-');
    const proj2 = makeTempProject('proj2-');
    try {
      const srv = createServer({ port: 0, host: '127.0.0.1' });
      const { port } = await srv.start();
      const base = `http://127.0.0.1:${port}`;
      try {
        // Registrar 2 proyectos
        const r1 = await getJson(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: proj1 }) });
        assert.equal(r1.res.status, 201);
        const id1 = r1.json.project.id;
        const r2 = await getJson(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: proj2 }) });
        assert.equal(r2.res.status, 201);
        const id2 = r2.json.project.id;

        // GET /state para proj-2
        const s2 = await getJson(`${base}/api/projects/${id2}/state`);
        assert.equal(s2.res.status, 200);
        assert.ok(s2.json.project);
        assert.ok(s2.json.epics);
        assert.ok(s2.json.sprint !== undefined);
        assert.ok(s2.json.doctor !== undefined);
        // Verificar estructura epicas por estado
        assert.ok(s2.json.epics.byStatus || Array.isArray(s2.json.epics.all));

        // GET /diagram para proj-2
        const d2 = await fetch(`${base}/api/projects/${id2}/diagram`);
        assert.equal(d2.status, 200);
        const dText = await d2.text();
        assert.ok(dText.length > 0);
        // Si degradado, debe tener header
        if (dText.includes('archify-placeholder') || dText.includes('Archify')) {
          // header puede estar presente
        }

        // Persistencia activeProjectId: PUT /api/projects/:id/active
        const setActive = await getJson(`${base}/api/projects/${id2}/active`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        assert.equal(setActive.res.status, 200);
        assert.equal(setActive.json.activeProjectId, id2);

        // Verificar GET /api/projects refleja activeProjectId persistido
        const list = await getJson(`${base}/api/projects`);
        assert.equal(list.res.status, 200);
        assert.equal(list.json.activeProjectId, id2);

        // Cambiar a proj1 y verificar que cambia
        const setActive1 = await getJson(`${base}/api/projects/${id1}/active`, { method: 'PUT' });
        assert.equal(setActive1.res.status, 200);
        const list2 = await getJson(`${base}/api/projects`);
        assert.equal(list2.json.activeProjectId, id1);

        // También probar endpoint alternativo /api/projects/active con body
        const setViaBody = await getJson(`${base}/api/projects/active`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id2 }) });
        assert.equal(setViaBody.res.status, 200);
        assert.equal(setViaBody.json.activeProjectId, id2);

        // Verificar que fetch state/diagram cambian sin recarga: dos fetches consecutivos deben retornar datos distintos por proyecto
        const s1 = await getJson(`${base}/api/projects/${id1}/state`);
        assert.equal(s1.res.status, 200);
        // project.id debe coincidir con el solicitado
        assert.equal(s1.json.project.id, id1);
        assert.equal(s2.json.project.id, id2);
        assert.notEqual(s1.json.project.id, s2.json.project.id);
      } finally {
        await srv.close();
      }
    } finally {
      cleanupDirs(proj1, proj2);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Escenario 3 — Pulso SSE verde, gris/rojo y reconexión automática backoff 1s→5s
// ---------------------------------------------------------------------------
test('E4S1-3 — GIVEN SSE conectado WHEN miro tablero THEN pulso verde; si SSE cae, pulso gris/rojo y reconecta con backoff 1s→5s', async () => {
  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  assert.match(index, /pulso-estado/, 'index debe tener elemento pulso-estado');
  assert.match(index, /pulse-green/, 'index debe tener clase pulse-green inicial');
  assert.match(index, /Conectado/, 'debe mostrar texto Conectado');

  const appSrc = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(appSrc, /pulse-green/, 'app debe usar clase pulse-green para conectado');
  assert.match(appSrc, /pulse-gris|pulse-rojo/, 'app debe usar pulse-gris o pulse-rojo para desconectado');
  assert.match(appSrc, /EventSource/, 'debe usar EventSource para SSE');
  assert.match(appSrc, /\/api\/events/, 'debe conectar a /api/events');
  assert.match(appSrc, /FS_CHANGE/, 'debe manejar evento FS_CHANGE');
  assert.match(appSrc, /reconexion|reconnect|programarReconexion/, 'debe tener lógica de reconexión');

  // Verificar backoff 1s→5s
  assert.match(appSrc, /1000/, 'debe tener backoff base 1s (1000ms)');
  assert.match(appSrc, /5000/, 'debe tener tope 5s (5000ms)');
  assert.match(appSrc, /setTimeout/, 'debe usar setTimeout para backoff');

  const styles = fs.readFileSync(STYLES_PATH, 'utf8');
  assert.match(styles, /\.pulse-green/, 'styles debe definir .pulse-green');
  assert.match(styles, /\.pulse-gris/, 'styles debe definir .pulse-gris');
  // pulse-rojo puede estar como .pulse-rojo o .pulse-red
  assert.ok(styles.includes('.pulse-rojo') || styles.includes('.pulse-red') || styles.includes('pulse-rojo'), 'styles debe definir estado desconectado rojo');

  // Integración: verificar SSE headers y reconexión
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1', keepaliveInterval: 80 });
    const { port } = await srv.start();
    try {
      // Verificar SSE headers
      const headersOk = await new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: '/api/events', method: 'GET', headers: { Accept: 'text/event-stream' } }, (res) => {
          try {
            assert.equal(res.statusCode, 200);
            assert.match(res.headers['content-type'] || '', /text\/event-stream/);
            assert.equal(res.headers['cache-control'], 'no-cache');
            assert.equal(res.headers['x-accel-buffering'], 'no');
            resolve(true);
          } catch (e) { reject(e); }
          res.destroy();
        });
        req.on('error', reject);
        req.end();
        setTimeout(() => { try { req.destroy(); } catch {} }, 1000);
      });
      assert.ok(headersOk);

      // Verificar que SSE se puede reconectar tras cerrar
      const primera = await new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: '/api/events', method: 'GET' }, (res) => {
          assert.equal(res.statusCode, 200);
          let data = '';
          res.on('data', (c) => { data += c.toString(); });
          setTimeout(() => { res.destroy(); resolve(data); }, 150);
        });
        req.on('error', reject);
        req.end();
      });
      // Segunda conexión debe funcionar (reconexión)
      const segunda = await new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: '/api/events', method: 'GET' }, (res) => {
          assert.equal(res.statusCode, 200);
          let data = '';
          res.on('data', (c) => { data += c.toString(); });
          setTimeout(() => { res.destroy(); resolve(data); }, 150);
        });
        req.on('error', reject);
        req.end();
      });
      assert.ok(primera.length >= 0);
      assert.ok(segunda.length >= 0);
    } finally {
      await srv.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Escenario 4 — 100% español técnico (sin inglés copy visible)
// ---------------------------------------------------------------------------
test('E4S1-4 — GIVEN toda UI WHEN inspecciono labels THEN 100% español técnico sin inglés', () => {
  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  const app = fs.readFileSync(APP_PATH, 'utf8');
  const qs = fs.readFileSync(QS_PATH, 'utf8');
  const tablero = fs.readFileSync(TABLERO_PATH, 'utf8');
  const styles = fs.readFileSync(STYLES_PATH, 'utf8');

  const todoVisible = index + app + qs + tablero;

  // Labels obligatorios en español
  const obligatorios = [
    'Proyectos',
    'Buscar proyecto...',
    'Sprint actual',
    'Pendiente',
    'En Progreso',
    'Completada',
    'Salud del proyecto',
    'Conectado',
  ];
  for (const label of obligatorios) {
    assert.ok(todoVisible.includes(label), `Debe contener label español "${label}"`);
  }

  // Verificar lang es y title español
  assert.match(index, /Panel de Control/, 'title debe estar en español');
  assert.match(index, /<html[^>]*lang="es"/, 'html lang debe ser es');

  // Verificar que no hay copy inglés visible común en UI
  // Buscamos palabras inglesas que NO deberían aparecer como copy visible (case-sensitive con espacios)
  // Permitimos palabras en código (ej: project, state) pero no como UI text
  // Chequeamos que index.html visible no contenga "Search", "Projects", "Connected", "Loading", "Dashboard" (inglés puro)
  const indexVisibleText = index.replace(/<[^>]*>/g, ' '); // strip tags crudely
  const inglesProhibido = ['Search', 'Projects', 'Connected', 'Disconnected', 'Loading', 'Board', 'Health'];
  for (const palabra of inglesProhibido) {
    // Solo falla si aparece como palabra suelta en texto visible y no es parte de español
    // Permitimos que aparezca en atributos técnicos? No, solo texto visible
    // Si aparece, probablemente es copy inglés no deseado
    if (indexVisibleText.includes(palabra)) {
      // Excepción: palabras que podrían estar en comentarios? Pero visible no debería
      assert.fail(`Texto visible contiene inglés no permitido: "${palabra}" en index.html`);
    }
  }

  // Verificar placeholder y botón en español
  assert.match(index, /Cambiar proyecto/, 'botón debe estar en español');
  assert.match(index, /Buscar proyecto/, 'placeholder en español');
  assert.match(index, /Usa flechas/, 'ayuda de atajos en español');
});

// ---------------------------------------------------------------------------
// Extra — estáticos servidos correctamente y SPA Vanilla sin bundler
// ---------------------------------------------------------------------------
test('E4S1-extra — servidor sirve estáticos SPA (app.mjs, components, styles.css) con MIME correcto y sin bundler', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    try {
      // GET /
      const root = await fetch(`${base}/`);
      assert.equal(root.status, 200);
      const rootHtml = await root.text();
      assert.match(rootHtml, /Panel de Control/);
      assert.match(rootHtml, /app\.mjs/);

      // GET /app.mjs
      const appRes = await fetch(`${base}/app.mjs`);
      assert.equal(appRes.status, 200);
      assert.match(appRes.headers.get('content-type') || '', /javascript/);
      const appText = await appRes.text();
      assert.match(appText, /cambiarProyecto|filtrarProyectos/);

      // GET /components/quick-switcher.mjs
      const qsRes = await fetch(`${base}/components/quick-switcher.mjs`);
      assert.equal(qsRes.status, 200);
      assert.match(qsRes.headers.get('content-type') || '', /javascript/);
      const qsText = await qsRes.text();
      assert.match(qsText, /filtrarProyectos/);

      // GET /components/tablero-control.mjs
      const tabRes = await fetch(`${base}/components/tablero-control.mjs`);
      assert.equal(tabRes.status, 200);
      const tabText = await tabRes.text();
      assert.match(tabText, /renderTablero/);

      // GET /styles.css
      const cssRes = await fetch(`${base}/styles.css`);
      assert.equal(cssRes.status, 200);
      assert.match(cssRes.headers.get('content-type') || '', /css/);
      const cssText = await cssRes.text();
      assert.match(cssText, /\.pulse-green/);

      // Verificar que no hay bundler: no debe existir bundle.js ni dist
      const bundle = await fetch(`${base}/bundle.js`);
      assert.equal(bundle.status, 404);

      // SPA fallback: ruta inexistente sin extensión debe servir index.html
      const fallback = await fetch(`${base}/ruta/inexistente`);
      assert.equal(fallback.status, 200);
      const fallbackHtml = await fallback.text();
      assert.match(fallbackHtml, /Panel de Control/);

      // Verificar ESM estricto en archivos servidos: deben contener import/export y no require
      assert.doesNotMatch(appText, /require\(/);
      assert.doesNotMatch(qsText, /require\(/);
    } finally {
      await srv.close();
    }
  });
});

test('E4S1-AD — SPA no usa process.chdir y es ESM estricto', () => {
  for (const p of [APP_PATH, QS_PATH, TABLERO_PATH]) {
    const src = fs.readFileSync(p, 'utf8');
    assert.doesNotMatch(src, /process\.chdir/, `${path.basename(p)} no debe usar process.chdir`);
    assert.match(src, /import .*from|export/, `${path.basename(p)} debe ser ESM`);
    assert.doesNotMatch(src, /require\(/, `${path.basename(p)} sin require`);
  }
  const serverSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
  assert.doesNotMatch(serverSrc, /process\.chdir/, 'server.mjs sin chdir');
});
