import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import * as pm from '../src/dashboard/project-manager.mjs';
import { createServer } from '../src/dashboard/server.mjs';

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
function cleanupDirs(...dirs) { for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

const VISOR_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/components/visor-archify.mjs');
const APP_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/app.mjs');
const TABLERO_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/components/tablero-control.mjs');
const SERVER_PATH = path.resolve(import.meta.dirname, '../src/dashboard/server.mjs');
const STYLES_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/styles.css');

// ---------------------------------------------------------------------------
// 2.1 — GIVEN GET /diagram WHEN estado existe THEN 200 con Content-Type y encapsulado
// ---------------------------------------------------------------------------

test('S3.2-2.1a — GIVEN GET /api/projects/:id/diagram WHEN estado existe THEN 200 text/html encapsulado div.archify-container con CSS prefijado .archify-*', async () => {
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('visor-21a-');
    const rendererDir = path.join(tmp, 'archify/renderers/workflow');
    fs.mkdirSync(rendererDir, { recursive: true });
    const rendererPath = path.join(rendererDir, 'render-workflow.mjs');
    fs.writeFileSync(rendererPath, `export default function renderWorkflow(data){ const nodes=(data.nodes||[]).map(n=>\`<div class="archify-node">\${n.label}</div>\`).join(''); return \`<div class="archify-workflow">\${nodes}<span>ok:\${data.meta.totalEpics}</span></div>\`; }`, 'utf8');

    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const reg = await fetch(`http://127.0.0.1:${port}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: tmp }) });
      assert.equal(reg.status, 201);
      const { project } = await reg.json();
      const id = project.id;

      const diag = await fetch(`http://127.0.0.1:${port}/api/projects/${id}/diagram`);
      assert.equal(diag.status, 200, 'debe ser 200');
      const ct = diag.headers.get('content-type') || '';
      assert.match(ct, /text\/html/, `Content-Type debe ser text/html, got ${ct}`);
      const degraded = diag.headers.get('x-archify-degraded');
      assert.equal(degraded, null, 'con renderer no debe ser degraded');

      const body = await diag.text();
      assert.ok(body.length > 0, 'body no vacio');
      // Encapsulado
      assert.match(body, /archify-container/, 'debe contener div.archify-container');
      assert.match(body, /archify-workflow/, 'debe contener markup del renderer');
      // CSS prefijado .archify-*
      assert.match(body, /\.archify-/, 'debe contener CSS con prefijo .archify-*');
      assert.match(body, /<style>/, 'debe contener style encapsulado');
      // No debe leakear estilos globales: verificar que style contiene .archify-container y .archify-placeholder etc
      assert.match(body, /\.archify-container/, 'style debe definir .archify-container');
      assert.match(body, /\.archify-placeholder|\.archify-workflow/, 'style debe definir al menos .archify-placeholder o .archify-workflow');

      // Verificar que no contiene svg como Content-Type (es html)
      assert.doesNotMatch(ct, /svg/);

      // 404 para proyecto inexistente
      const fake = crypto.randomUUID();
      const notFound = await fetch(`http://127.0.0.1:${port}/api/projects/${fake}/diagram`);
      assert.equal(notFound.status, 404);
      const nfJson = await notFound.json();
      const code = nfJson.code || nfJson.error?.code;
      assert.equal(code, 'PROJECT_NOT_FOUND');
    } finally {
      await srv.close();
      cleanupDirs(tmp);
    }
  });
});

test('S3.2-2.1b — GIVEN renderer retorna SVG puro WHEN GET /diagram THEN 200 image/svg+xml (o text/html si SVG fallback) con markup SVG', async () => {
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('visor-21b-');
    const rendererDir = path.join(tmp, 'archify/renderers/workflow');
    fs.mkdirSync(rendererDir, { recursive: true });
    const rendererPath = path.join(rendererDir, 'render-workflow.mjs');
    // Renderer que retorna SVG puro
    fs.writeFileSync(rendererPath, `export default function(){ return \`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/><text x="10" y="20">hola</text></svg>\`; }`, 'utf8');

    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const reg = await fetch(`http://127.0.0.1:${port}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: tmp }) });
      assert.equal(reg.status, 201);
      const { project } = await reg.json();

      const diag = await fetch(`http://127.0.0.1:${port}/api/projects/${project.id}/diagram`);
      assert.equal(diag.status, 200);
      const ct = diag.headers.get('content-type') || '';
      // SVG debe ser image/svg+xml
      assert.match(ct, /image\/svg\+xml/, `CT para SVG puro debe ser image/svg+xml, got ${ct}`);
      const body = await diag.text();
      assert.match(body.trim(), /^<svg/, 'body debe empezar con <svg');
      assert.match(body, /<svg/, 'debe contener svg');
      // No debe estar encapsulado con div si es svg puro (o si lo esta, aun pasa pero ideal directo)
      // Verificar que no tiene archify-container si es svg puro servido directo
      // Permitimos que este o no, pero al menos body es svg
      const degraded = diag.headers.get('x-archify-degraded');
      assert.equal(degraded, null);
    } finally {
      await srv.close();
      cleanupDirs(tmp);
    }
  });
});

test('S3.2-2.1c — server encapsula html con archify-container incluso cuando markup ya es html fragment', async () => {
  // Verificacion estatica de server.mjs
  const src = fs.readFileSync(SERVER_PATH, 'utf8');
  assert.match(src, /encapsulateArchifyMarkup|archify-container/, 'server debe encapsular con archify-container');
  assert.match(src, /isSvgMarkup/, 'server debe detectar SVG');
  assert.match(src, /image\/svg\+xml/, 'server debe retornar image/svg+xml para SVG');
  assert.match(src, /text\/html/, 'server debe retornar text/html para HTML');
  assert.match(src, /\.archify-/, 'server debe generar CSS prefijado .archify-*');
  assert.match(src, /X-Archify-Degraded/, 'server debe manejar header degraded');
});

// ---------------------------------------------------------------------------
// 2.2 — GIVEN SPA suscrita a /api/events y recibe FS_CHANGE WHEN <300ms THEN re-fetchea y actualiza sin parpadeo preservando scroll
// ---------------------------------------------------------------------------

test('S3.2-2.2a — visor-archify.mjs existe y expone API para render sin parpadeo preservando scroll', async () => {
  assert.ok(fs.existsSync(VISOR_PATH), 'visor-archify.mjs debe existir');
  const src = fs.readFileSync(VISOR_PATH, 'utf8');
  // Exports
  assert.match(src, /export function renderArchify/, 'debe exportar renderArchify');
  assert.match(src, /export function wrapArchifyMarkup|export function isSvgMarkup/, 'debe exportar helpers');
  assert.match(src, /export function createArchifyVisor/, 'debe exportar createArchifyVisor');
  // AD-07: encapsulado con .archify-container y CSS prefijado
  assert.match(src, /archify-container/, 'debe contener archify-container');
  assert.match(src, /\.archify-/, 'debe contener CSS prefijado .archify-');
  assert.match(src, /<style>/, 'debe generar <style> encapsulado');
  // Sin parpadeo: diff/hash, preserve scroll, transicion/rAF
  assert.match(src, /archifyHash|simpleHash|hash/, 'debe comparar hash previo vs nuevo (diff)');
  assert.match(src, /scrollTop/, 'debe preservar scrollTop');
  assert.match(src, /scrollLeft/, 'debe preservar scrollLeft o scrollTop');
  assert.match(src, /requestAnimationFrame/, 'debe usar requestAnimationFrame para transicion sin parpadeo');
  assert.match(src, /transition|opacity/, 'debe usar transition u opacity');
  assert.match(src, /preserveScroll/, 'debe soportar preserveScroll');
  // Soporte iframe srcdoc
  assert.match(src, /iframe|srcdoc/, 'debe soportar iframe srcdoc como alternativa');
  // ESM
  assert.match(src, /import|export/, 'debe ser ESM');
  assert.doesNotMatch(src, /process\.chdir/, 'no debe usar process.chdir');
  assert.doesNotMatch(src, /require\(/, 'no require');
});

test('S3.2-2.2b — renderArchify sin parpadeo: diff evita DOM si markup igual y preserva scrollTop', async () => {
  const mod = await import('../src/dashboard/public/components/visor-archify.mjs');
  assert.equal(typeof mod.renderArchify, 'function');
  assert.equal(typeof mod.wrapArchifyMarkup, 'function');
  assert.equal(typeof mod.isSvgMarkup, 'function');

  // Helpers
  assert.equal(mod.isSvgMarkup('<svg width="10"></svg>'), true, 'isSvg debe detectar svg');
  assert.equal(mod.isSvgMarkup('<div>hola</div>'), false);
  assert.match(mod.wrapArchifyMarkup('<div>hola</div>'), /archify-container/, 'wrap debe envolver');
  assert.match(mod.wrapArchifyMarkup('<div>hola</div>'), /\.archify-/);
  // Ya encapsulado no duplica
  const already = '<div class="archify-container"><style>.archify-*</style><div>inner</div></div>';
  assert.equal(mod.wrapArchifyMarkup(already), already, 'si ya contiene archify-container no re-envuelve');

  // Mock DOM minimal
  function mockContainer() {
    const el = {
      dataset: {},
      style: {},
      classList: { _cls: new Set(), add(c){ this._cls.add(c); }, contains(c){ return this._cls.has(c); } },
      scrollTop: 42,
      scrollLeft: 7,
      innerHTML: '',
      children: [],
      querySelector(sel) {
        if (sel.includes('iframe')) return el._iframe || null;
        return null;
      },
      appendChild(child) { el.children.push(child); el._iframe = child; },
    };
    return el;
  }
  // Mock document global for fallback
  const origDoc = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        dataset: {},
        setAttribute(k, v){ this[k]=v; },
        getAttribute(k){ return this[k] || null; },
      };
    },
  };
  try {
    // Primera llamada con markup html
    const c1 = mockContainer();
    const markup1 = '<div class="archify-workflow">v1</div>';
    const r1 = mod.renderArchify(c1, markup1, { immediate: true, preserveScroll: true });
    assert.equal(r1, true, 'primera llamada debe actualizar');
    // Debe haber preservado scroll? despues de update, scrollTop restaurado a 42
    assert.equal(c1.scrollTop, 42, 'debe preservar scrollTop 42');
    assert.equal(c1.scrollLeft, 7);
    assert.match(c1.innerHTML, /archify-container/, 'debe estar encapsulado');
    assert.match(c1.innerHTML, /archify-workflow/, 'debe contener markup');
    assert.ok(c1.dataset.archifyHash, 'debe setear hash');
    const hash1 = c1.dataset.archifyHash;
    assert.equal(c1.classList.contains('archify-transition'), true, 'debe añadir clase transition');

    // Segunda llamada con MISMO markup -> diff detecta igual, no toca DOM (sin parpadeo)
    const prevHTML = c1.innerHTML;
    c1.scrollTop = 99; // cambiar scroll para ver si preserva
    const r2 = mod.renderArchify(c1, markup1, { immediate: true, preserveScroll: true });
    assert.equal(r2, false, 'segunda llamada con mismo markup debe retornar false (sin parpadeo)');
    assert.equal(c1.innerHTML, prevHTML, 'innerHTML no debe cambiar si markup igual');
    // scroll debe preservarse (99 no 42, porque no hubo cambio pero debe mantener 99)
    // En nuestro impl, si diff igual retornamos false antes de tocar scroll, dejamos 99 intacto
    assert.equal(c1.scrollTop, 99, 'scrollTop preservado cuando no hay cambio');

    // Tercera llamada con markup distinto -> debe actualizar
    const markup2 = '<div class="archify-workflow">v2 distinto</div>';
    c1.scrollTop = 55;
    const r3 = mod.renderArchify(c1, markup2, { immediate: true });
    assert.equal(r3, true, 'tercera con markup distinto debe actualizar');
    assert.notEqual(c1.dataset.archifyHash, hash1, 'hash debe cambiar');
    assert.match(c1.innerHTML, /v2 distinto/);
    assert.equal(c1.scrollTop, 55, 'debe preservar scrollTop en update con cambio');

    // SVG: debe inyectar directo sin encapsular con div si es svg? wrap no debe aplicarse si isSvg true
    const c2 = mockContainer();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    mod.renderArchify(c2, svg, { immediate: true });
    assert.match(c2.innerHTML, /<svg/, 'svg debe inyectarse directo');
    assert.doesNotMatch(c2.innerHTML, /archify-content/, 'svg puro no debe envolver con archify-content si es svg (puede variar pero no debe forzar wrapper)');
  } finally {
    if (origDoc === undefined) delete globalThis.document;
    else globalThis.document = origDoc;
  }
});

test('S3.2-2.2c — visor re-fetchea en <300ms: app.mjs integra renderArchify preservando scroll y diff en handler FS_CHANGE', () => {
  const appSrc = fs.readFileSync(APP_PATH, 'utf8');
  // Debe importar visor
  assert.match(appSrc, /visor-archify|renderArchify/, 'app.mjs debe importar visor-archify');
  // Debe manejar FS_CHANGE
  assert.match(appSrc, /FS_CHANGE/, 'debe escuchar FS_CHANGE');
  // Debe hacer fetch a /diagram
  assert.match(appSrc, /\/api\/projects\/.*\/diagram|cargarDiagrama/, 'debe fetchear GET /diagram');
  // Debe usar visor con preserveScroll y transicion
  assert.match(appSrc, /renderArchify/, 'debe llamar renderArchify en SSE handler');
  assert.match(appSrc, /preserveScroll/, 'debe preservar scroll');
  // Debe comparar markup previo vs nuevo (diff para sin parpadeo)
  assert.match(appSrc, /diagramaMarkup|estado\.diagramaMarkup/, 'debe comparar markup previo');
  // Debe tener logica de no flicker: verificar que no hace innerHTML directo sin diff
  // Al menos debe contener logica de transicion/diff
  const hasTransition = appSrc.includes('transitionMs') || appSrc.includes('renderArchify');
  assert.ok(hasTransition, 'debe usar transicion via visor');

  // Tablero tambien debe delegar a visor
  const tableroSrc = fs.readFileSync(TABLERO_PATH, 'utf8');
  assert.match(tableroSrc, /visor-archify|renderArchify/, 'tablero-control debe usar visor-archify');
  assert.match(tableroSrc, /archify-transition|preserveScroll|renderArchify/, 'tablero debe delegar a visor con preservacion');
});

test('S3.2-2.2d — integracion E2E: SSE FS_CHANGE dispara re-fetch <300ms y visor actualiza sin parpadeo (mocked timing)', async () => {
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('visor-e2e-');
    // Renderer html para poder medir encapsulado
    const rendererDir = path.join(tmp, 'archify/renderers/workflow');
    fs.mkdirSync(rendererDir, { recursive: true });
    fs.writeFileSync(path.join(rendererDir, 'render-workflow.mjs'), `export default function(d){ return \`<div class="archify-workflow">cnt:\${d.nodes.length}</div>\`; }`, 'utf8');

    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const reg = await fetch(`http://127.0.0.1:${port}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: tmp }) });
      assert.equal(reg.status, 201);
      const { project } = await reg.json();

      // Medir fetch de diagrama <300ms
      const t0 = Date.now();
      const d1 = await fetch(`http://127.0.0.1:${port}/api/projects/${project.id}/diagram`);
      const dt = Date.now() - t0;
      assert.ok(dt < 300, `GET /diagram debe ser <300ms, fue ${dt}ms`);
      assert.equal(d1.status, 200);
      const body1 = await d1.text();
      assert.match(body1, /archify-container/);

      // Simular segundo fetch inmediato (como haria SPA al recibir FS_CHANGE) y verificar diff sin parpadeo
      const mod = await import('../src/dashboard/public/components/visor-archify.mjs');
      function mockContainer() {
        return {
          dataset: {},
          style: {},
          classList: { _s: new Set(), add(c){ this._s.add(c); }, contains(c){ return this._s.has(c); } },
          scrollTop: 123,
          scrollLeft: 0,
          innerHTML: '',
          querySelector(){ return null; },
          appendChild(){},
        };
      }
      const origDoc = globalThis.document;
      globalThis.document = { createElement(tag){ return { style:{}, dataset:{}, setAttribute(){}, getAttribute(){return null;} }; } };
      try {
        const c = mockContainer();
        // primer render
        const t1 = Date.now();
        mod.renderArchify(c, body1, { immediate: true, preserveScroll: true });
        const after1 = Date.now() - t1;
        assert.ok(after1 < 50, 'render inicial debe ser rapido');
        assert.equal(c.scrollTop, 123);

        // segundo fetch con mismo contenido -> no parpadeo (diff)
        const body2 = body1; // mismo
        const t2 = Date.now();
        const updated = mod.renderArchify(c, body2, { immediate: true });
        const after2 = Date.now() - t2;
        assert.equal(updated, false, 'mismo markup no debe actualizar');
        assert.ok(after2 < 30, 'diff debe ser <30ms');
      } finally {
        if (origDoc === undefined) delete globalThis.document; else globalThis.document = origDoc;
      }
    } finally {
      await srv.close();
      cleanupDirs(tmp);
    }
  });
});

test('S3.2-2.2e — CSS contiene .archify-container y .archify-transition para sandbox sin leak', () => {
  assert.ok(fs.existsSync(STYLES_PATH), 'styles.css debe existir');
  const css = fs.readFileSync(STYLES_PATH, 'utf8');
  assert.match(css, /\.archify-container/, 'css debe definir .archify-container');
  assert.match(css, /\.archify-transition/, 'css debe definir .archify-transition');
  assert.match(css, /\.archify-placeholder/, 'css debe definir .archify-placeholder');
  // Verificar que no contiene selectores globales peligrosos sin prefijo para diagrama
  // Al menos todos los .archify-* deben estar prefijados
  const archifyRules = css.match(/\.archify-[a-z-]+/g) || [];
  assert.ok(archifyRules.length >= 3, `debe tener >=3 reglas .archify-*, got ${archifyRules.length}`);
  // Verificar que .archify-container tiene contain:content para aislar
  assert.match(css, /contain:\s*content/, 'archify-container debe usar contain:content');
});

// ---------------------------------------------------------------------------
// 2.3 — GIVEN Archify degradado WHEN GET /diagram THEN 200 con placeholder y header X-Archify-Degraded: true
// ---------------------------------------------------------------------------

test('S3.2-2.3a — GIVEN Archify degradado WHEN GET /api/projects/:id/diagram THEN 200 con placeholder textual y header X-Archify-Degraded: true', async () => {
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('visor-deg-');
    // SIN archify -> degradado
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const reg = await fetch(`http://127.0.0.1:${port}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: tmp }) });
      assert.equal(reg.status, 201);
      const { project } = await reg.json();

      const diag = await fetch(`http://127.0.0.1:${port}/api/projects/${project.id}/diagram`);
      assert.equal(diag.status, 200, 'degradado debe ser 200 no 500');
      assert.equal(diag.headers.get('x-archify-degraded'), 'true', 'debe tener header X-Archify-Degraded: true');
      const ct = diag.headers.get('content-type') || '';
      assert.match(ct, /text\/html/, 'degradado debe ser text/html');
      const body = await diag.text();
      assert.match(body, /archify-placeholder/, 'debe contener placeholder con clase archify-placeholder');
      assert.match(body, /archify-container/, 'incluso degradado debe estar encapsulado con archify-container');
      assert.match(body, /Diagrama no disponible|Archify ausente|archify-placeholder/, 'debe contener texto placeholder');
      assert.doesNotMatch(body, /500|Internal/, 'no debe ser 500');
    } finally {
      await srv.close();
      cleanupDirs(tmp);
    }
  });
});

test('S3.2-2.3b — degradado cuando renderer lanza: sigue 200 con header true sin 500', async () => {
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('visor-deg2-');
    const rendererDir = path.join(tmp, 'archify/renderers/workflow');
    fs.mkdirSync(rendererDir, { recursive: true });
    fs.writeFileSync(path.join(rendererDir, 'render-workflow.mjs'), `export default function(){ throw new Error('boom'); }`, 'utf8');

    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const reg = await fetch(`http://127.0.0.1:${port}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: tmp }) });
      assert.equal(reg.status, 201);
      const { project } = await reg.json();

      const diag = await fetch(`http://127.0.0.1:${port}/api/projects/${project.id}/diagram`);
      assert.equal(diag.status, 200);
      assert.equal(diag.headers.get('x-archify-degraded'), 'true');
      const body = await diag.text();
      assert.match(body, /archify-placeholder/);
      assert.match(body, /archify-container/);
    } finally {
      await srv.close();
      cleanupDirs(tmp);
    }
  });
});

test('S3.2-2.3c — header degraded ausente cuando NO degradado', async () => {
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('visor-nodeg-');
    const dir = path.join(tmp, 'archify/renderers/workflow');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'render-workflow.mjs'), `export default function(d){ return \`<div class="archify-workflow">ok</div>\`; }`, 'utf8');

    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const reg = await fetch(`http://127.0.0.1:${port}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: tmp }) });
      const { project } = await reg.json();
      const diag = await fetch(`http://127.0.0.1:${port}/api/projects/${project.id}/diagram`);
      assert.equal(diag.status, 200);
      assert.equal(diag.headers.get('x-archify-degraded'), null, 'no degradado => header debe ser null');
      const body = await diag.text();
      assert.match(body, /archify-container/);
      assert.match(body, /archify-workflow/);
    } finally {
      await srv.close();
      cleanupDirs(tmp);
    }
  });
});

test('S3.2 — AD-01 y ESM: visor, server y tablero no usan process.chdir', () => {
  for (const p of [VISOR_PATH, SERVER_PATH, APP_PATH, TABLERO_PATH]) {
    const src = fs.readFileSync(p, 'utf8');
    assert.doesNotMatch(src, /process\.chdir/, `${path.basename(p)} no debe usar process.chdir`);
    assert.match(src, /import|export/, `${path.basename(p)} debe ser ESM`);
    assert.doesNotMatch(src, /require\s*\(/, `${path.basename(p)} sin require`);
  }
});
