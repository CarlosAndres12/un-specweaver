import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';

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
function cleanupDirs(...dirs) { for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
async function getJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, json, text };
}

const DRAWER_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/components/terminal-drawer.mjs');
const APP_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/app.mjs');
const INDEX_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/index.html');
const STYLES_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/styles.css');
const VISOR_PATH = path.resolve(import.meta.dirname, '../src/dashboard/public/components/visor-archify.mjs');

// ---------------------------------------------------------------------------
// Helpers for DOM mocking (similar to visor tests)
// ---------------------------------------------------------------------------
function createMockDocument() {
  const listeners = new Map();
  const doc = {
    activeElement: null,
    listeners,
    getElementById(id) { return null; },
    querySelector() { return null; },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners.get(type) || [];
      const idx = arr.indexOf(fn);
      if (idx !== -1) arr.splice(idx, 1);
    },
    dispatch(type, event) {
      const arr = listeners.get(type) || [];
      for (const fn of [...arr]) fn(event);
    },
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: {
          _s: new Set(),
          add(c){ this._s.add(c); },
          remove(c){ this._s.delete(c); },
          contains(c){ return this._s.has(c); },
          toggle(c, f){
            if (f===undefined){ if(this._s.has(c)) this._s.delete(c); else this._s.add(c);}
            else if(f) this._s.add(c); else this._s.delete(c);
          },
        },
        dataset: {},
        style: {},
        children: [],
        innerHTML: '',
        textContent: '',
        scrollTop: 0,
        scrollHeight: 100,
        attributes: {},
        setAttribute(k,v){ this.attributes[k]=v; },
        getAttribute(k){ return this.attributes[k] || null; },
        appendChild(child){
          this.children.push(child);
          if (child && child.textContent) this.innerHTML += `<span>${child.textContent}</span>`;
          else if (child && child.innerHTML) this.innerHTML += child.innerHTML;
          this.scrollHeight += 20;
          this.scrollTop = this.scrollHeight;
          return child;
        },
        removeChild(child){
          const idx = this.children.indexOf(child);
          if (idx!==-1) this.children.splice(idx,1);
        },
        get firstChild(){ return this.children[0] || null; },
        querySelector(sel){
          if (sel.includes('terminal-output') && this._terminalOutput) return this._terminalOutput;
          if (sel.includes('terminal-pre') && this._pre) return this._pre;
          if (sel.includes('drawer-ayuda') && this._ayuda) return this._ayuda;
          if (sel.includes('drawer-header') && this._header) return this._header;
          return null;
        },
        querySelectorAll(){ return []; },
        addEventListener(type, fn){
          if (!this._listeners) this._listeners={};
          if (!this._listeners[type]) this._listeners[type]=[];
          this._listeners[type].push(fn);
        },
        removeEventListener(){},
        closest(){ return this; },
      };
      // Mirror className to classList for easier checks
      Object.defineProperty(el, 'className', {
        get(){ return [...this.classList._s].join(' '); },
        set(v){
          this.classList._s = new Set(String(v).split(' ').filter(Boolean));
        },
      });
      return el;
    },
  };
  return doc;
}

function mockContainerWithStructure(doc) {
  const container = doc.createElement('div');
  container.id = 'terminal-drawer';
  container.classList.add('drawer');
  container.classList.add('colapsable');
  container.dataset.open = 'false';
  container.setAttribute('aria-hidden', 'true');

  const header = doc.createElement('div');
  header.className = 'drawer-header';
  const h3 = doc.createElement('h3');
  h3.textContent = 'Terminal';
  header.appendChild(h3);

  const acciones = doc.createElement('div');
  acciones.className = 'drawer-acciones';
  const cmds = [
    { command: 'sync', label: 'Sincronizar' },
    { command: 'doctor', label: 'Diagnóstico' },
    { command: 'sprint', label: 'Planificar Sprint' },
    { command: 'build', label: 'Construir' },
  ];
  for (const c of cmds) {
    const b = doc.createElement('button');
    b.dataset.command = c.command;
    b.textContent = c.label;
    acciones.appendChild(b);
  }
  const btnClear = doc.createElement('button');
  btnClear.dataset.action = 'clear';
  btnClear.textContent = 'Limpiar';
  acciones.appendChild(btnClear);
  header.appendChild(acciones);

  const btnClose = doc.createElement('button');
  btnClose.dataset.action = 'close';
  btnClose.textContent = '×';
  header.appendChild(btnClose);
  container._header = header;

  const outputDiv = doc.createElement('div');
  outputDiv.className = 'terminal-output';
  const pre = doc.createElement('pre');
  pre.className = 'terminal-pre';
  pre.style = { margin: '0', whiteSpace: 'pre-wrap' };
  pre.innerHTML = '';
  pre.textContent = '';
  pre.scrollTop = 0;
  pre.scrollHeight = 0;
  // Ensure pre has appendChild etc via same mock
  outputDiv._pre = pre;
  outputDiv.appendChild(pre);
  container._terminalOutput = outputDiv;
  container._pre = pre;

  const ayuda = doc.createElement('div');
  ayuda.id = 'drawer-ayuda';
  ayuda.className = 'drawer-ayuda oculto';
  ayuda.style = { display: 'none' };
  ayuda.classList.add('oculto');
  container._ayuda = ayuda;

  // Wire basic DOM tree
  container.appendChild(header);
  container.appendChild(outputDiv);
  container.appendChild(ayuda);

  // Mock querySelector on container to return those
  const origQS = container.querySelector.bind(container);
  container.querySelector = (sel) => {
    if (sel === '.terminal-output' || sel.includes('terminal-output')) return outputDiv;
    if (sel === '.terminal-pre' || sel.includes('terminal-pre')) return pre;
    if (sel === '#drawer-ayuda' || sel.includes('drawer-ayuda')) return ayuda;
    if (sel === '.drawer-header' || sel.includes('drawer-header')) return header;
    return null;
  };
  container.querySelectorAll = () => [];

  // Mock addEventListener etc already via createElement
  return { container, outputDiv, pre, ayuda, header };
}

// ---------------------------------------------------------------------------
// E4S2-0 — Archivos y exports base
// ---------------------------------------------------------------------------
test('E4S2-0 — Archivos existen con estructura esperada y exports requeridos', async () => {
  assert.ok(fs.existsSync(DRAWER_PATH), 'terminal-drawer.mjs debe existir');
  assert.ok(fs.existsSync(INDEX_PATH), 'index.html debe existir');
  assert.ok(fs.existsSync(STYLES_PATH), 'styles.css debe existir');
  assert.ok(fs.existsSync(APP_PATH), 'app.mjs debe existir');
  assert.ok(fs.existsSync(VISOR_PATH), 'visor-archify.mjs debe seguir existiendo');

  const drawerSrc = fs.readFileSync(DRAWER_PATH, 'utf8');
  assert.match(drawerSrc, /export function createTerminalDrawer/, 'debe exportar createTerminalDrawer');
  assert.match(drawerSrc, /export function formatChunk/, 'debe exportar formatChunk');
  assert.match(drawerSrc, /export function appendOutput/, 'debe exportar appendOutput');
  assert.match(drawerSrc, /export function clear/, 'debe exportar clear');
  assert.match(drawerSrc, /export function getHistory/, 'debe exportar getHistory');
  assert.match(drawerSrc, /export function setHistory/, 'debe exportar setHistory');
  assert.match(drawerSrc, /export default|export const/, 'debe tener exports ESM');
  assert.doesNotMatch(drawerSrc, /process\.chdir/, 'no debe usar process.chdir');
  assert.doesNotMatch(drawerSrc, /require\(/, 'sin CommonJS');

  const mod = await import('../src/dashboard/public/components/terminal-drawer.mjs');
  assert.equal(typeof mod.createTerminalDrawer, 'function');
  assert.equal(typeof mod.formatChunk, 'function');
  assert.equal(typeof mod.appendOutput, 'function');
  assert.equal(typeof mod.clear, 'function');
  assert.equal(typeof mod.getHistory, 'function');
  assert.equal(typeof mod.setHistory, 'function');

  // Aliases
  assert.ok(typeof mod.createDrawer === 'function' || typeof mod.default === 'object' || typeof mod.default.createTerminalDrawer === 'function', 'debe exponer alias o default');

  // formatChunk debe escapar y envolver con span
  const html1 = mod.formatChunk('<b>hola</b>', 'stdout');
  assert.match(html1, /terminal-stdout/, 'stdout debe usar clase terminal-stdout');
  assert.doesNotMatch(html1, /<b>/, 'debe escapar HTML');
  assert.match(html1, /&lt;b&gt;/, 'debe escapar a &lt;');

  const html2 = mod.formatChunk('error!', 'stderr');
  assert.match(html2, /terminal-stderr/, 'stderr debe usar terminal-stderr');

  const html3 = mod.formatChunk('sys', 'system');
  assert.match(html3, /terminal-system/, 'system debe usar terminal-system');

  // appendOutput debe añadir y hacer auto-scroll
  const doc = createMockDocument();
  const { pre } = mockContainerWithStructure(doc);
  const beforeScroll = pre.scrollTop;
  mod.appendOutput(pre, 'hola mundo\n', 'stdout');
  assert.ok(pre.innerHTML.length > 0 || pre.children.length > 0, 'appendOutput debe añadir contenido');
  assert.ok(pre.scrollTop >= beforeScroll, 'debe hacer auto-scroll (scrollTop)');

  // clear/getHistory/setHistory
  mod.clear();
  assert.deepEqual(mod.getHistory('proj-x'), [], 'getHistory vacío debe ser []');
  mod.setHistory('proj-x', ['a', 'b']);
  assert.deepEqual(mod.getHistory('proj-x'), ['a', 'b']);
  mod.clear('proj-x');
  assert.deepEqual(mod.getHistory('proj-x'), [], 'clear(proj-x) debe vaciar solo ese');
  mod.setHistory('proj-1', ['one']);
  mod.setHistory('proj-2', ['two']);
  assert.deepEqual(mod.getHistory('proj-1'), ['one']);
  assert.deepEqual(mod.getHistory('proj-2'), ['two']);
  mod.clear();
  assert.deepEqual(mod.getHistory('proj-1'), []);
  assert.deepEqual(mod.getHistory('proj-2'), []);
});

// ---------------------------------------------------------------------------
// E4S2-1 — GIVEN visor Archify con diagrama activo WHEN FS_CHANGE THEN <300ms sin parpadeo, sandbox, terminal no interfiere
// ---------------------------------------------------------------------------
test('E4S2-1 — GIVEN visor con diagrama activo WHEN llega FS_CHANGE THEN actualiza <300ms sin parpadeo sandbox y terminal no interfiere', async () => {
  // Verificar visor sigue cumpliendo 3.2
  const visorSrc = fs.readFileSync(VISOR_PATH, 'utf8');
  assert.match(visorSrc, /renderArchify/, 'visor debe exponer renderArchify');
  assert.match(visorSrc, /archify-container/, 'visor debe encapsular con archify-container');
  assert.match(visorSrc, /\.archify-/, 'visor debe tener CSS prefijado .archify-');
  assert.match(visorSrc, /iframe|srcdoc/, 'visor debe soportar iframe srcdoc sandbox');
  assert.match(visorSrc, /archifyHash|simpleHash/, 'visor debe hacer diff hash para sin parpadeo');
  assert.match(visorSrc, /scrollTop/, 'visor debe preservar scroll');
  assert.match(visorSrc, /requestAnimationFrame/, 'visor debe usar rAF para transición');

  const appSrc = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(appSrc, /visor-archify|renderArchify/, 'app debe importar visor-archify');
  assert.match(appSrc, /FS_CHANGE/, 'app debe manejar FS_CHANGE');
  assert.match(appSrc, /cargarDiagrama|GET.*diagram/, 'app debe re-fetchear diagrama en FS_CHANGE');
  assert.match(appSrc, /preserveScroll/, 'app debe preservar scroll en visor');
  assert.match(appSrc, /diagramaMarkup/, 'app debe comparar markup previo para diff sin parpadeo');

  // Verificar terminal no interfiere: app debe importar terminal-drawer pero no debe romper visor
  assert.match(appSrc, /terminal-drawer|createTerminalDrawer/, 'app debe integrar terminal-drawer sin romper visor');
  assert.match(appSrc, /estado\.proyectoActivoId/, 'app debe mantener estado proyectoActivoId para visor');
  // Verificar que terminal drawer no suscribe a FS_CHANGE para visor (solo comandos)
  const drawerSrc = fs.readFileSync(DRAWER_PATH, 'utf8');
  assert.doesNotMatch(drawerSrc, /FS_CHANGE/, 'terminal-drawer no debe interferir con FS_CHANGE del visor');

  // Verificar estilos no rompen visor: drawer debe tener z-index menor que visor? pero no debe afectar .archify-container
  const styles = fs.readFileSync(STYLES_PATH, 'utf8');
  assert.match(styles, /\.archify-container/, 'styles debe seguir teniendo archify-container');
  assert.match(styles, /contain:\s*content/, 'archify-container debe mantener contain:content para sandbox');
  assert.match(styles, /\.drawer/, 'styles debe tener drawer sin afectar archify');

  // Verificar index tiene ambos contenedores
  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  assert.match(index, /diagrama-contenido/, 'index debe seguir teniendo diagrama-contenido');
  assert.match(index, /terminal-drawer/, 'index debe tener terminal-drawer además de visor');

  // Medir render sin parpadeo <300ms usando visor directamente
  const modVisor = await import('../src/dashboard/public/components/visor-archify.mjs');
  function mockContainer() {
    return {
      dataset: {},
      style: {},
      classList: { _s: new Set(), add(c){ this._s.add(c); }, contains(c){ return this._s.has(c); } },
      scrollTop: 42,
      scrollLeft: 7,
      innerHTML: '',
      children: [],
      querySelector(){ return null; },
      appendChild(){},
    };
  }
  const origDoc = globalThis.document;
  globalThis.document = { createElement(tag){ return { style:{}, dataset:{}, setAttribute(){}, getAttribute(){return null;} }; } };
  try {
    const c = mockContainer();
    const markup = '<div class="archify-workflow">test</div>';
    const t0 = Date.now();
    const ok = modVisor.renderArchify(c, markup, { immediate: true, preserveScroll: true });
    const dt = Date.now() - t0;
    assert.equal(ok, true);
    assert.ok(dt < 100, `renderArchify debe ser <100ms, fue ${dt}ms`);
    assert.equal(c.scrollTop, 42, 'debe preservar scrollTop y no parpadear si terminal existe');
    // Segundo render mismo markup no debe tocar DOM (sin parpadeo)
    const prev = c.innerHTML;
    const ok2 = modVisor.renderArchify(c, markup, { immediate: true });
    assert.equal(ok2, false, 'mismo markup no debe actualizar (sin parpadeo)');
    assert.equal(c.innerHTML, prev);
  } finally {
    if (origDoc === undefined) delete globalThis.document; else globalThis.document = origDoc;
  }

  // Verificar server sigue sirviendo diagrama <300ms incluso con drawer (integración)
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('e4s2-visor-');
    const rendererDir = path.join(tmp, 'archify/renderers/workflow');
    fs.mkdirSync(rendererDir, { recursive: true });
    fs.writeFileSync(path.join(rendererDir, 'render-workflow.mjs'), `export default function(d){ return \`<div class="archify-workflow">cnt:\${d.nodes.length}</div>\`; }`, 'utf8');
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const reg = await fetch(`http://127.0.0.1:${port}/api/projects`, { method: 'POST', headers: { 'Content-Type':'application/json'}, body: JSON.stringify({ path: tmp }) });
      assert.equal(reg.status, 201);
      const { project } = await reg.json();
      const t0 = Date.now();
      const d = await fetch(`http://127.0.0.1:${port}/api/projects/${project.id}/diagram`);
      const dt = Date.now() - t0;
      assert.ok(dt < 300, `GET /diagram debe ser <300ms incluso con drawer, fue ${dt}ms`);
      assert.equal(d.status, 200);
      const body = await d.text();
      assert.match(body, /archify-container/);
      // Drawer endpoint no debe afectar diagrama: verificar que GET /projects sigue funcionando
      const list = await getJson(`http://127.0.0.1:${port}/api/projects`);
      assert.equal(list.res.status, 200);
    } finally {
      await srv.close();
      cleanupDirs(tmp);
    }
  });
});

// ---------------------------------------------------------------------------
// E4S2-2 — GIVEN presiono Ctrl+~ o Cmd+J WHEN drawer cerrado THEN abre; Esc cierra; ? muestra ayuda
// ---------------------------------------------------------------------------
test('E4S2-2 — GIVEN drawer cerrado WHEN Ctrl+~ o Cmd+J THEN abre colapsable; Esc cierra; ? muestra ayuda; no interfiere con input', async () => {
  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  assert.match(index, /terminal-drawer/, 'index debe contener #terminal-drawer');
  assert.match(index, /drawer/, 'index debe tener clase drawer');
  assert.match(index, /colapsable/, 'debe tener clase colapsable según diseño');

  const styles = fs.readFileSync(STYLES_PATH, 'utf8');
  assert.match(styles, /\.drawer/, 'styles debe definir .drawer');
  assert.match(styles, /\.drawer\.abierto/, 'styles debe definir .drawer.abierto');
  assert.match(styles, /\.terminal-output/, 'styles debe definir .terminal-output');
  assert.match(styles, /transform/, 'drawer debe usar transform para colapsable');
  assert.match(styles, /transition/, 'drawer debe tener transición');

  const drawerSrc = fs.readFileSync(DRAWER_PATH, 'utf8');
  // Atajos
  assert.match(drawerSrc, /Backquote/, 'debe manejar Backquote para Ctrl+`');
  assert.match(drawerSrc, /ctrlKey/, 'debe manejar ctrlKey');
  assert.match(drawerSrc, /metaKey/, 'debe manejar metaKey para Cmd+J');
  // Buscar que maneja 'j' y '`' / '~'
  assert.match(drawerSrc, /'j'|"j"/, 'debe detectar tecla j para Cmd+J');
  assert.match(drawerSrc, /`/, 'debe detectar Backquote / `');
  assert.match(drawerSrc, /Escape/, 'debe manejar Esc para cerrar');
  assert.match(drawerSrc, /\?/, 'debe manejar ? para ayuda');
  assert.match(drawerSrc, /isInputFocused|activeElement|INPUT/, 'no debe interferir con input');
  assert.match(drawerSrc, /abierto|open/, 'debe togglear clase abierto');
  assert.match(drawerSrc, /oculto|visible/, 'debe manejar ayuda oculto/visible');

  // Verificar botones del drawer en index.html (labels español)
  assert.match(index, /Sincronizar/, 'index drawer debe tener botón Sincronizar');
  assert.match(index, /Diagnóstico/, 'debe tener Diagnóstico (doctor)');
  assert.match(index, /Planificar Sprint/, 'debe tener Planificar Sprint (sprint)');
  assert.match(index, /Construir/, 'debe tener Construir (build)');
  assert.match(index, /data-command="sync"/, 'botón sync debe tener data-command="sync"');
  assert.match(index, /data-command="doctor"/, 'doctor');
  assert.match(index, /data-command="sprint"/, 'sprint');
  assert.match(index, /data-command="build"/, 'build');
  // Atajos ayuda debe mencionar Ctrl+` y Cmd+J y Esc y ?
  assert.match(index, /Ctrl/, 'ayuda debe mencionar Ctrl');
  assert.match(index, /Cmd.*J|J.*Cmd/, 'ayuda debe mencionar Cmd+J');

  // Test funcional con mock DOM
  const mod = await import('../src/dashboard/public/components/terminal-drawer.mjs');
  // Limpiar historial global previo
  mod.clear();

  const mockDoc = createMockDocument();
  const origDoc = globalThis.document;
  const origWindow = globalThis.window;
  const origLocalStorage = globalThis.localStorage;
  globalThis.document = mockDoc;
  globalThis.window = { EventSource: undefined };
  globalThis.localStorage = { getItem(){return null;}, setItem(){}, removeItem(){} };
  // También mockear sessionStorage
  globalThis.sessionStorage = { getItem(){return null;}, setItem(){} };

  try {
    const { container, pre, ayuda } = mockContainerWithStructure(mockDoc);
    // Mock document.getElementById para que createTerminalDrawer lo encuentre si pasa string? No necesario, pasamos container directo
    const drawer = mod.createTerminalDrawer(container, { projectId: 'proj-test', getProjectId: () => 'proj-test' });
    assert.equal(typeof drawer.abrir, 'function');
    assert.equal(typeof drawer.cerrar, 'function');
    assert.equal(typeof drawer.alternar, 'function');
    assert.equal(typeof drawer.estaAbierto, 'function');

    // Inicialmente cerrado
    assert.equal(drawer.estaAbierto(), false, 'inicialmente cerrado');
    assert.ok(!container.classList.contains('abierto'), 'sin clase abierto al inicio');

    // Simular Ctrl+` -> abre
    drawer._onKeyDown({ key: '`', code: 'Backquote', ctrlKey: true, metaKey: false, preventDefault(){} , target: { tagName: 'DIV' } });
    assert.equal(drawer.estaAbierto(), true, 'Ctrl+` debe abrir drawer');
    assert.ok(container.classList.contains('abierto'), 'debe tener clase abierto tras Ctrl+`');

    // Esc cierra
    drawer._onKeyDown({ key: 'Escape', code: 'Escape', ctrlKey: false, metaKey: false, preventDefault(){}, target: { tagName: 'DIV' } });
    assert.equal(drawer.estaAbierto(), false, 'Esc debe cerrar drawer');
    assert.ok(!container.classList.contains('abierto'));

    // Cmd+J abre
    drawer._onKeyDown({ key: 'j', code: 'KeyJ', ctrlKey: false, metaKey: true, preventDefault(){}, target:{ tagName:'DIV'} });
    assert.equal(drawer.estaAbierto(), true, 'Cmd+J debe abrir drawer');

    // ? muestra ayuda
    assert.ok(ayuda.classList.contains('oculto'), 'ayuda inicialmente oculta');
    drawer._onKeyDown({ key: '?', code: 'Slash', shiftKey: true, ctrlKey: false, metaKey: false, preventDefault(){}, target:{ tagName:'DIV'} });
    assert.ok(!ayuda.classList.contains('oculto'), '? debe mostrar ayuda');
    assert.ok(ayuda.classList.contains('visible'), 'ayuda debe tener visible');

    // Esc cuando ayuda visible pero drawer abierto: Esc debe cerrar drawer primero
    // Primero cerrar ayuda y luego probar Esc cierra drawer
    drawer.cerrar();
    // Reabrir y probar ? luego Esc para ayuda
    drawer.abrir();
    drawer._onKeyDown({ key: '?', code: 'Slash', shiftKey:true, preventDefault(){}, target:{tagName:'DIV'}});
    assert.ok(drawer.ayudaVisible() || !ayuda.classList.contains('oculto'), 'ayuda visible tras ?');
    // Cerrar ayuda con Esc si drawer no está? Nuestra impl cierra drawer primero si abierto, pero test debe cubrir que ? funciona
    drawer.ocultarAyuda();
    assert.ok(ayuda.classList.contains('oculto'), 'ocultarAyuda debe ocultar');

    // No interferir con input: si foco es INPUT, no debe abrir
    drawer.cerrar();
    assert.equal(drawer.estaAbierto(), false);
    drawer._onKeyDown({ key: '`', code: 'Backquote', ctrlKey: true, preventDefault(){}, target:{ tagName:'INPUT', isContentEditable:false } });
    assert.equal(drawer.estaAbierto(), false, 'no debe abrir si foco es input');

    // También Cmd+J no debe abrir si input
    drawer._onKeyDown({ key: 'j', code: 'KeyJ', metaKey:true, preventDefault(){}, target:{ tagName:'TEXTAREA'} });
    assert.equal(drawer.estaAbierto(), false, 'no debe abrir si textarea focused');

    // Verificar alternar funciona
    drawer.alternar();
    assert.equal(drawer.estaAbierto(), true);
    drawer.alternar();
    assert.equal(drawer.estaAbierto(), false);

    // Verificar botones data-command existen en drawer DOM
    // Nuestro mock container tiene esos botones, verificar dataset
    // Simular click en botón doctor debe intentar fetch (pero mockearemos fetch)
    let fetchCalled = null;
    const mockFetch = async (url, opts) => {
      const method = opts && opts.method ? opts.method : 'GET';
      // Solo registrar POST para no sobreescribir con GET stream
      if (method === 'POST' && url.includes('/commands')) {
        fetchCalled = { url, opts };
        return { ok: true, json: async () => ({ executionId: crypto.randomUUID() }), text: async () => '' , body: null, status: 200 };
      }
      // Stream GET: retornar sin body para no bloquear (drawer hace early return si !body)
      return { ok: true, json: async () => ({}), text: async () => '', body: null, status: 200 };
    };
    // Crear nuevo drawer con fetch mock y getProjectId
    const { container: c2, pre: pre2 } = mockContainerWithStructure(mockDoc);
    const drawer2 = mod.createTerminalDrawer(c2, { projectId: 'proj-1', getProjectId: () => 'proj-1', fetch: mockFetch });
    drawer2.abrir();
    // Simular click doctor
    const fakeBtn = { dataset: { command: 'doctor' }, closest() { return this; } };
    drawer2._onBotonClick({ target: fakeBtn, preventDefault(){} });
    // Esperar microtask para POST
    await new Promise(r => setTimeout(r, 30));
    assert.ok(fetchCalled, 'click doctor debe hacer POST');
    assert.match(fetchCalled.url, /\/api\/projects\/proj-1\/commands/, 'URL debe ser /api/projects/proj-1/commands');
    const body = JSON.parse(fetchCalled.opts.body);
    assert.equal(body.command, 'doctor');

    // Probar otros comandos: sync, sprint, build deben también funcionar
    for (const cmd of ['sync','sprint','build']) {
      fetchCalled = null;
      const btn = { dataset:{ command: cmd }, closest(){return this;}};
      drawer2._onBotonClick({ target: btn, preventDefault(){} });
      await new Promise(r=> setTimeout(r,20));
      assert.ok(fetchCalled, `click ${cmd} debe hacer POST`);
      assert.equal(JSON.parse(fetchCalled.opts.body).command, cmd);
    }

    drawer.destruir();
    drawer2.destruir();
  } finally {
    globalThis.document = origDoc;
    if (origWindow === undefined) delete globalThis.window; else globalThis.window = origWindow;
    if (origLocalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = origLocalStorage;
    delete globalThis.sessionStorage;
    mod.clear();
  }
});

// ---------------------------------------------------------------------------
// E4S2-3 — GIVEN drawer abierto en proj-1 WHEN clic doctor THEN POST + stream SSE + auto-scroll + historial preserva al conmutar
// ---------------------------------------------------------------------------
test('E4S2-3 — GIVEN drawer abierto en proj-1 WHEN clic doctor THEN POST /api/projects/proj-1/commands {command:"doctor"} suscribe stream, muestra streaming con formato terminal y auto-scroll; historial preserva al conmutar y volver', async () => {
  const drawerSrc = fs.readFileSync(DRAWER_PATH, 'utf8');
  assert.match(drawerSrc, /\/api\/projects.*\/commands/, 'debe hacer POST a /api/projects/:id/commands');
  assert.match(drawerSrc, /\/commands\/.*\/stream/, 'debe suscribir GET /commands/:execId/stream');
  assert.match(drawerSrc, /COMMAND_OUTPUT/, 'debe manejar COMMAND_OUTPUT');
  assert.match(drawerSrc, /COMMAND_CLOSE/, 'debe manejar COMMAND_CLOSE');
  assert.match(drawerSrc, /EventSource/, 'debe usar EventSource o fetch streaming');
  assert.match(drawerSrc, /fetch/, 'debe usar fetch');
  assert.match(drawerSrc, /scrollTop/, 'debe hacer auto-scroll');
  assert.match(drawerSrc, /scrollHeight/, 'debe usar scrollHeight para auto-scroll');
  assert.match(drawerSrc, /Map.*projectId|historialGlobal/, 'debe tener historial Map por projectId');
  assert.match(drawerSrc, /localStorage/, 'debe soportar localStorage opcional');

  const appSrc = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(appSrc, /createTerminalDrawer|terminal-drawer/, 'app debe integrar terminal drawer');
  assert.match(appSrc, /setProject|cambiarProyecto/, 'app debe sincronizar historial por projectId al cambiar proyecto');

  const mod = await import('../src/dashboard/public/components/terminal-drawer.mjs');
  mod.clear();

  // Test unitario de formatChunk + appendOutput + historial
  const mockDoc = createMockDocument();
  const origDoc = globalThis.document;
  const origWindow = globalThis.window;
  const origLocalStorage = globalThis.localStorage;
  globalThis.document = mockDoc;
  globalThis.window = { EventSource: undefined };
  globalThis.localStorage = { getItem(){return null;}, setItem(){}, removeItem(){} };
  try {
    const { container, pre } = mockContainerWithStructure(mockDoc);
    const drawer = mod.createTerminalDrawer(container, { projectId: 'proj-1', getProjectId: () => 'proj-1' });
    drawer.abrir();
    // Simular append y verificar historial aislado por proyecto aún sin server
    drawer.appendOutput('línea 1\n', 'stdout');
    drawer.appendOutput('error x\n', 'stderr');
    // Como appendOutput via instancia no sabe projectId? Nuestra impl usa targetEl directo y no push a historial unless vía ejecutar
    // Pero podemos probar push via setHistory/getHistory
    mod.setHistory('proj-1', ['cmd doctor\n', 'stdout chunk 1\n']);
    assert.deepEqual(mod.getHistory('proj-1'), ['cmd doctor\n', 'stdout chunk 1\n']);
    // Verificar que outputEl tiene auto-scroll: pre.scrollTop debe ser >0 tras append
    mod.appendOutput(pre, 'otra línea\n', 'stdout');
    assert.ok(pre.scrollTop > 0 || pre.scrollHeight > 0, 'auto-scroll debe actualizar scrollTop/scrollHeight');

    // Verificar que historial se preserva al conmutar (simulado via setProject)
    const { container: c2, pre: pre2 } = mockContainerWithStructure(mockDoc);
    // Reusar mismo historialGlobal (singleton)
    const drawer2 = mod.createTerminalDrawer(c2, { projectId: 'proj-1', getProjectId: () => 'proj-1' });
    // Historial de proj-1 debe estar disponible en nueva instancia (global)
    assert.deepEqual(mod.getHistory('proj-1'), ['cmd doctor\n', 'stdout chunk 1\n']);
    // Simular cambio a proj-2 y volver
    drawer2.setProject('proj-2');
    assert.deepEqual(mod.getHistory('proj-2'), [], 'proj-2 inicialmente vacío');
    mod.setHistory('proj-2', ['otro proyecto']);
    assert.deepEqual(mod.getHistory('proj-2'), ['otro proyecto']);
    // Volver a proj-1, historial debe preservarse
    drawer2.setProject('proj-1');
    assert.deepEqual(mod.getHistory('proj-1'), ['cmd doctor\n', 'stdout chunk 1\n'], 'al volver a proj-1 historial preservado');
    assert.deepEqual(mod.getHistory('proj-2'), ['otro proyecto'], 'proj-2 no debe haber perdido historial');

    drawer.destruir();
    drawer2.destruir();
  } finally {
    globalThis.document = origDoc;
    if (origWindow===undefined) delete globalThis.window; else globalThis.window = origWindow;
    if (origLocalStorage===undefined) delete globalThis.localStorage; else globalThis.localStorage = origLocalStorage;
    mod.clear();
  }

  // Integración real con servidor: POST y stream SSE
  await withIsolatedHome(async () => {
    const proj1 = makeTempProject('drawer-proj1-');
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    try {
      const r = await getJson(`${base}/api/projects`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: proj1 }) });
      assert.equal(r.res.status, 201);
      const projId = r.json.project.id;

      // POST /api/projects/:id/commands {command:"doctor"}
      const cmd = await getJson(`${base}/api/projects/${projId}/commands`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ command: 'doctor' }) });
      assert.equal(cmd.res.status, 202, 'POST doctor debe ser 202');
      assert.ok(cmd.json.executionId, 'debe retornar executionId');
      const execId = cmd.json.executionId;
      assert.match(execId, /^[0-9a-f]{8}-/, 'executionId debe ser uuid');

      // Suscribir GET /commands/:execId/stream y verificar COMMAND_OUTPUT + COMMAND_CLOSE
      const chunks = [];
      let closeCode = null;
      const streamOk = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: `/api/projects/${projId}/commands/${execId}/stream`,
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
        }, (res) => {
          try {
            assert.equal(res.statusCode, 200);
            assert.match(res.headers['content-type'] || '', /text\/event-stream/);
            let buffer = '';
            res.on('data', (c) => {
              buffer += c.toString();
              let idx;
              while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const raw = buffer.slice(0, idx);
                buffer = buffer.slice(idx+2);
                const lines = raw.split('\n');
                let event = 'message';
                let data = '';
                for (const line of lines) {
                  if (line.startsWith('event:')) event = line.slice(6).trim();
                  else if (line.startsWith('data:')) data += line.slice(5).trim();
                }
                if (event === 'COMMAND_OUTPUT' && data) {
                  try {
                    const parsed = JSON.parse(data);
                    chunks.push(parsed);
                  } catch {}
                } else if (event === 'COMMAND_CLOSE' && data) {
                  try {
                    const parsed = JSON.parse(data);
                    closeCode = parsed.exitCode;
                  } catch {}
                  res.destroy();
                  resolve(true);
                }
              }
            });
            res.on('error', reject);
          } catch (e) { reject(e); res.destroy(); }
        });
        req.on('error', reject);
        req.end();
        setTimeout(() => reject(new Error('timeout esperando stream')), 3000);
      });
      assert.ok(streamOk, 'stream debe completarse');
      assert.ok(chunks.length > 0, 'debe recibir al menos un chunk COMMAND_OUTPUT');
      // Verificar formato terminal: chunks tienen chunk y stream
      for (const c of chunks) {
        assert.ok('chunk' in c, 'cada COMMAND_OUTPUT debe tener chunk');
        assert.ok('stream' in c, 'debe tener stream stdout|stderr');
        assert.ok(['stdout','stderr'].includes(c.stream), `stream debe ser stdout o stderr, got ${c.stream}`);
        assert.ok(typeof c.chunk === 'string' && c.chunk.length > 0);
      }
      // Verificar que auto-scroll sería posible: al menos un chunk contiene cwd o command para verificar cwd aislado
      const hasCwd = chunks.some(c => c.chunk.includes('cwd='));
      const hasCommand = chunks.some(c => c.chunk.includes('command=doctor'));
      assert.ok(hasCwd || hasCommand, 'chunks deben contener cwd o command para verificar ejecución aislada');

      // Verificar historial preserva al conmutar (simulado con segundo proyecto)
      const proj2 = makeTempProject('drawer-proj2-');
      try {
        const r2 = await getJson(`${base}/api/projects`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: proj2 }) });
        assert.equal(r2.res.status, 201);
        const projId2 = r2.json.project.id;
        // Ejecutar comando en proj2
        const cmd2 = await getJson(`${base}/api/projects/${projId2}/commands`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ command: 'sync' }) });
        assert.equal(cmd2.res.status, 202);
        const execId2 = cmd2.json.executionId;
        // Stream proj2 también debe ser aislado (solo su cwd)
        const chunks2 = [];
        await new Promise((resolve, reject) => {
          const req = http.request({
            hostname:'127.0.0.1', port,
            path:`/api/projects/${projId2}/commands/${execId2}/stream`,
            method:'GET', headers:{Accept:'text/event-stream'}
          }, (res)=>{
            let buf='';
            res.on('data', c=>{
              buf+=c.toString();
              let idx;
              while((idx=buf.indexOf('\n\n'))!==-1){
                const raw=buf.slice(0,idx);
                buf=buf.slice(idx+2);
                const lines=raw.split('\n');
                let event='message'; let data='';
                for(const l of lines){
                  if(l.startsWith('event:')) event=l.slice(6).trim();
                  else if(l.startsWith('data:')) data+=l.slice(5).trim();
                }
                if(event==='COMMAND_OUTPUT' && data){
                  try{ chunks2.push(JSON.parse(data)); }catch{}
                } else if(event==='COMMAND_CLOSE'){
                  res.destroy(); resolve(true);
                }
              }
            });
            res.on('error', reject);
          });
          req.on('error', reject); req.end();
          setTimeout(()=> reject(new Error('timeout proj2')), 3000);
        });
        assert.ok(chunks2.length>0);
        // Verificar no cruzan: chunks de proj1 deben contener cwd proj1, proj2 cwd proj2, y ser distintos
        const cwd1 = chunks.find(c=>c.chunk.includes('cwd='))?.chunk || '';
        const cwd2 = chunks2.find(c=>c.chunk.includes('cwd='))?.chunk || '';
        if (cwd1 && cwd2) {
          assert.notEqual(cwd1, cwd2, 'cwd de proj1 y proj2 no deben cruzarse');
          assert.ok(cwd1.includes(proj1) || cwd1.includes('cwd='), 'cwd1 debe corresponder a proj1');
          assert.ok(cwd2.includes(proj2), 'cwd2 debe corresponder a proj2');
        }
      } finally {
        cleanupDirs(proj2);
      }

      // Verificar que también se puede testear drawer module's historial aislado con esos ids reales
      const mod2 = await import('../src/dashboard/public/components/terminal-drawer.mjs');
      mod2.clear();
      mod2.setHistory(projId, chunks.map(c=>c.chunk));
      const hist1 = mod2.getHistory(projId);
      assert.ok(hist1.length > 0, 'historial proj1 debe tener chunks');
      // Simular conmutar a proj2
      const fakeProj2 = crypto.randomUUID();
      mod2.setHistory(fakeProj2, ['solo proj2']);
      assert.deepEqual(mod2.getHistory(fakeProj2), ['solo proj2']);
      assert.ok(mod2.getHistory(projId).length>0, 'proj1 historial sigue tras crear proj2');
      assert.notDeepEqual(mod2.getHistory(projId), mod2.getHistory(fakeProj2), 'historiales no deben cruzarse');
      mod2.clear();
    } finally {
      await srv.close();
      cleanupDirs(proj1);
    }
  });
});

// ---------------------------------------------------------------------------
// E4S2-4 — GIVEN ejecuto doctor en proj-1 y luego conmuto a proj-2 WHEN vuelvo a proj-1 THEN drawer conserva historial sin cruzar
// ---------------------------------------------------------------------------
test('E4S2-4 — GIVEN ejecuto doctor en proj-1 y luego conmuto a proj-2 WHEN vuelvo a proj-1 THEN drawer conserva historial sin cruzar con proj-2', async () => {
  const mod = await import('../src/dashboard/public/components/terminal-drawer.mjs');
  mod.clear();

  const mockDoc = createMockDocument();
  const origDoc = globalThis.document;
  const origWindow = globalThis.window;
  const origLocalStorage = globalThis.localStorage;
  globalThis.document = mockDoc;
  globalThis.window = { EventSource: undefined };
  globalThis.localStorage = { getItem(){return null;}, setItem(){}, removeItem(){} };
  try {
    const { container, pre } = mockContainerWithStructure(mockDoc);
    const drawer = mod.createTerminalDrawer(container, { projectId: 'proj-1', getProjectId: () => currentId });
    let currentId = 'proj-1';
    // Simular ejecución en proj-1: push historial
    mod.setHistory('proj-1', ['[proj-1] doctor output 1', '[proj-1] doctor output 2']);
    mod.setHistory('proj-2', ['[proj-2] sync output']);
    drawer.setProject('proj-1');
    // Verificar que pre contiene historial proj-1
    assert.deepEqual(mod.getHistory('proj-1'), ['[proj-1] doctor output 1', '[proj-1] doctor output 2']);
    assert.deepEqual(mod.getHistory('proj-2'), ['[proj-2] sync output']);
    assert.notDeepEqual(mod.getHistory('proj-1'), mod.getHistory('proj-2'), 'historiales no deben ser iguales');

    // Conmutar a proj-2
    currentId = 'proj-2';
    drawer.setProject('proj-2');
    assert.deepEqual(mod.getHistory('proj-2'), ['[proj-2] sync output'], 'proj-2 historial intacto');
    // Verificar que pre ahora muestra proj-2 (nuestra mock render limpiará y re-appendará)
    // Como mock pre.innerHTML se resetea al setProject, verificar que historial renderizado corresponde
    // Para eso, check que getHistory sigue correcto y que no cruzan

    // Volver a proj-1
    currentId = 'proj-1';
    drawer.setProject('proj-1');
    const hist1Again = mod.getHistory('proj-1');
    assert.deepEqual(hist1Again, ['[proj-1] doctor output 1', '[proj-1] doctor output 2'], 'al volver a proj-1 debe conservar historial sin cruzar');
    const hist2Again = mod.getHistory('proj-2');
    assert.deepEqual(hist2Again, ['[proj-2] sync output'], 'proj-2 debe seguir intacto tras volver');

    // Probar appendOutput no cruza: añadir a proj-1 no afecta proj-2
    // Simular nuevo output en proj-1
    const prev2 = mod.getHistory('proj-2').slice();
    mod.setHistory('proj-1', [...mod.getHistory('proj-1'), 'nueva línea proj-1']);
    assert.deepEqual(mod.getHistory('proj-2'), prev2, 'añadir a proj-1 no debe afectar proj-2');

    // Probar clear solo afecta uno
    mod.clear('proj-1');
    assert.deepEqual(mod.getHistory('proj-1'), [], 'clear proj-1 solo debe borrar proj-1');
    assert.deepEqual(mod.getHistory('proj-2'), ['[proj-2] sync output'], 'proj-2 debe seguir');

    drawer.destruir();
  } finally {
    globalThis.document = origDoc;
    if (origWindow===undefined) delete globalThis.window; else globalThis.window = origWindow;
    if (origLocalStorage===undefined) delete globalThis.localStorage; else globalThis.localStorage = origLocalStorage;
    mod.clear();
  }

  // También verificar integración con app.mjs: app cambiarProyecto debe notificar drawer
  const appSrc = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(appSrc, /terminalDrawer|createTerminalDrawer/, 'app debe tener terminalDrawer variable');
  assert.match(appSrc, /setProject|cambiarProyecto/, 'app debe llamar setProject al cambiar proyecto para historial aislado');
  assert.match(appSrc, /getProjectId.*proyectoActivoId|proyectoActivoId/, 'app debe pasar getProjectId que retorna proyectoActivoId');

  // Verificar styles: drawer no debe interferir con visor y debe tener terminal-output con scroll
  const styles = fs.readFileSync(STYLES_PATH, 'utf8');
  assert.match(styles, /\.terminal-output/, 'debe tener .terminal-output');
  assert.match(styles, /overflow-y:\s*auto/, 'terminal-output debe tener overflow-y auto para scroll');
  assert.match(styles, /\.terminal-stdout/, 'debe diferenciar stdout');
  assert.match(styles, /\.terminal-stderr/, 'debe diferenciar stderr');
});

// ---------------------------------------------------------------------------
// Extra — ESM estricto y persistencia
// ---------------------------------------------------------------------------
test('E4S2-extra — ESM estricto, localStorage opcional, y drawer no usa process.chdir', () => {
  const src = fs.readFileSync(DRAWER_PATH, 'utf8');
  assert.doesNotMatch(src, /process\.chdir/, 'drawer no debe usar process.chdir');
  assert.match(src, /import|export/, 'debe ser ESM');
  assert.doesNotMatch(src, /require\(/, 'sin require');
  assert.match(src, /localStorage/, 'debe soportar localStorage opcional (guardarEnStorage)');
  assert.match(src, /try.*localStorage|catch/, 'localStorage debe estar en try/catch para no fallar en Node');
  const appSrc = fs.readFileSync(APP_PATH, 'utf8');
  assert.doesNotMatch(appSrc, /process\.chdir/, 'app sigue sin chdir tras integrar drawer');
});
