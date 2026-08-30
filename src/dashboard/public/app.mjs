/**
 * Bootstrap SPA — estado en memoria, fetch state/diagram, Quick Switcher y SSE.
 * ESM estricto, Vanilla sin bundler, 100% español técnico.
 */

import { crearQuickSwitcher, filtrarProyectos } from './components/quick-switcher.mjs';
import { renderTablero } from './components/tablero-control.mjs';
import { renderArchify } from './components/visor-archify.mjs';
import { createTerminalDrawer } from './components/terminal-drawer.mjs';

// ---------------------------------------------------------------------------
// Estado en memoria
// ---------------------------------------------------------------------------
const estado = {
  proyectos: [],
  proyectoActivoId: null,
  estadoActual: null,
  diagramaMarkup: '',
  sseConectado: false,
};

let quickSwitcher = null;
let terminalDrawer = null;
let sse = null;
let intentoReconexion = 0;
let temporizadorReconexion = null;

// Elementos DOM
let pulsoEl = null;
let textoConexionEl = null;

// ---------------------------------------------------------------------------
// Helpers de persistencia
// ---------------------------------------------------------------------------
function guardarActivoLocal(id) {
  try {
    localStorage.setItem('activeProjectId', id);
  } catch {}
  try {
    sessionStorage.setItem('activeProjectId', id);
  } catch {}
}

function cargarActivoLocal() {
  try {
    const v = localStorage.getItem('activeProjectId');
    if (v) return v;
  } catch {}
  try {
    const v2 = sessionStorage.getItem('activeProjectId');
    if (v2) return v2;
  } catch {}
  return null;
}

async function persistirActivoServidor(id) {
  const rutas = [
    `/api/projects/${encodeURIComponent(id)}/active`,
    `/api/projects/active`,
  ];
  for (const ruta of rutas) {
    try {
      const res = await fetch(ruta, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) return true;
      // Probar POST si PUT falla con 405
      if (res.status === 405 || res.status === 404) {
        const res2 = await fetch(ruta, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (res2.ok) return true;
      }
    } catch {
      // ignorar y probar siguiente ruta
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
async function cargarProyectos() {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error(`Error al cargar proyectos: ${res.status}`);
  const data = await res.json();
  return data;
}

async function cargarEstado(proyectoId) {
  const res = await fetch(`/api/projects/${encodeURIComponent(proyectoId)}/state`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Proyecto no encontrado');
    throw new Error(`Error al cargar estado: ${res.status}`);
  }
  return res.json();
}

async function cargarDiagrama(proyectoId) {
  const res = await fetch(`/api/projects/${encodeURIComponent(proyectoId)}/diagram`);
  if (!res.ok) throw new Error(`Error al cargar diagrama: ${res.status}`);
  // Puede ser text/html o image/svg+xml
  return res.text();
}

// ---------------------------------------------------------------------------
// Pulso de conexión
// ---------------------------------------------------------------------------
function actualizarPulso(conectado) {
  if (!pulsoEl) pulsoEl = document.getElementById('pulso-estado');
  if (!textoConexionEl) textoConexionEl = document.getElementById('texto-conexion');
  if (!pulsoEl || !textoConexionEl) return;
  if (conectado) {
    pulsoEl.className = 'pulso pulse-green';
    pulsoEl.setAttribute('aria-label', 'Conectado');
    pulsoEl.title = 'Conectado';
    textoConexionEl.textContent = 'Conectado';
    estado.sseConectado = true;
  } else {
    pulsoEl.className = 'pulso pulse-gris';
    pulsoEl.setAttribute('aria-label', 'Desconectado');
    pulsoEl.title = 'Desconectado';
    textoConexionEl.textContent = 'Desconectado';
    estado.sseConectado = false;
  }
}

function actualizarPulsoRojo() {
  if (!pulsoEl) pulsoEl = document.getElementById('pulso-estado');
  if (!textoConexionEl) textoConexionEl = document.getElementById('texto-conexion');
  if (!pulsoEl) return;
  pulsoEl.className = 'pulso pulse-rojo';
  pulsoEl.setAttribute('aria-label', 'Desconectado');
  pulsoEl.title = 'Desconectado — reconectando';
  if (textoConexionEl) textoConexionEl.textContent = 'Desconectado';
  estado.sseConectado = false;
}

// ---------------------------------------------------------------------------
// Cambio de proyecto <100ms sin recarga
// ---------------------------------------------------------------------------
async function cambiarProyecto(proyecto) {
  const id = typeof proyecto === 'string' ? proyecto : proyecto?.id;
  if (!id) return 0;
  const inicio = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

  // Actualización síncrona inmediata (<100ms) sin esperar fetch
  estado.proyectoActivoId = id;
  guardarActivoLocal(id);
  // Sincronizar terminal drawer: preservar historial por projectId, no cruzar
  try {
    if (terminalDrawer) {
      if (typeof terminalDrawer.setProject === 'function') terminalDrawer.setProject(id);
      else if (typeof terminalDrawer.cambiarProyecto === 'function') terminalDrawer.cambiarProyecto(id);
    }
  } catch {}
  // Actualizar UI de proyecto activo inmediatamente
  const nombreEl = document.getElementById('proyecto-activo-nombre');
  if (nombreEl) {
    const nombre = typeof proyecto === 'object' && proyecto.name ? proyecto.name : id;
    nombreEl.textContent = nombre;
  }
  // Persistir en servidor en segundo plano (no bloquea medición)
  persistirActivoServidor(id).catch(() => {});

  // Actualizar Quick Switcher si existe
  // No cerramos aquí: el Quick Switcher ya se cerró al seleccionar

  // Fetch concurrente de estado y diagrama
  try {
    const [estadoData, diagrama] = await Promise.all([
      cargarEstado(id).catch(() => null),
      cargarDiagrama(id).catch(() => ''),
    ]);
    estado.estadoActual = estadoData;
    // Actualizacion reactiva sin parpadeo: visor diff + preserva scroll + transicion
    // Si el markup no cambio, renderArchify evita tocar DOM (sin flicker)
    const diagElPre = document.getElementById('diagrama-contenido');
    if (diagElPre && diagrama && typeof renderArchify === 'function') {
      try {
        // Intentar actualizar visor directamente para <300ms sin esperar tablero completo
        renderArchify(diagElPre, diagrama, { preserveScroll: true, transitionMs: 120 });
      } catch {}
    }
    estado.diagramaMarkup = diagrama;
    const contenedor = document.getElementById('tablero-control');
    renderTablero(contenedor, estadoData, diagrama);
  } catch (err) {
    // Mostrar error en tablero sin recargar
    const contenedor = document.getElementById('tablero-control');
    if (contenedor) {
      const detalle = document.getElementById('sprint-detalle');
      if (detalle) detalle.textContent = `Error al cargar proyecto: ${err.message}`;
    }
  }

  const fin = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const duracion = fin - inicio;
  // La parte síncrona (hasta guardarActivoLocal y actualizar nombre) ya fue <100ms
  // Si la duración total supera 100ms por fetch, no es fallo: el conmutado síncrono sí fue <100ms
  // Solo advertimos si la parte síncrona hipotética excede, pero aquí medimos total para traza
  if (typeof console !== 'undefined' && duracion > 500) {
    // No es crítico, solo informativo
  }
  return duracion;
}

// ---------------------------------------------------------------------------
// SSE — pulso verde y reconexión con backoff 1s→5s
// ---------------------------------------------------------------------------
function conectarSSE() {
  desconectarSSE();

  // Preferir EventSource nativo
  if (typeof window.EventSource !== 'undefined') {
    try {
      const es = new EventSource('/api/events');
      sse = es;

      es.onopen = () => {
        intentoReconexion = 0;
        if (temporizadorReconexion) {
          clearTimeout(temporizadorReconexion);
          temporizadorReconexion = null;
        }
        actualizarPulso(true);
      };

      es.onerror = () => {
        actualizarPulsoRojo();
        try { es.close(); } catch {}
        sse = null;
        programarReconexion();
      };

      const handleFSChange = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.projectId || data.projectId === estado.proyectoActivoId) {
            if (estado.proyectoActivoId) {
              // Visor reactivo sin parpadeos: re-fetchea GET /diagram en <300ms, preserva scroll, transicion/diff
              const activo = estado.proyectoActivoId;
              const inicio = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
              // Lanzar fetch de diagrama inmediato (no esperar a cambiarProyecto) para garantizar <300ms
              cargarDiagrama(activo).then((markup) => {
                const fin = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
                void fin; void inicio;
                // Diff: solo actualizar si cambio (evita parpadeo)
                if (markup !== estado.diagramaMarkup) {
                  const el = document.getElementById('diagrama-contenido');
                  if (el && typeof renderArchify === 'function') {
                    try { renderArchify(el, markup, { preserveScroll: true, transitionMs: 120 }); } catch {}
                  }
                  estado.diagramaMarkup = markup;
                  // Tambien refrescar estado completo en segundo plano sin bloquear visor
                  cargarEstado(activo).then((st) => {
                    estado.estadoActual = st;
                    const cont = document.getElementById('tablero-control');
                    // renderTablero usara visor internamente pero el markup ya fue aplicado sin flicker
                    try { renderTablero(cont, st, markup); } catch {}
                  }).catch(() => {});
                } else {
                  // markup igual -> no flicker, solo refrescar estado si hace falta
                  cargarEstado(activo).then((st) => {
                    estado.estadoActual = st;
                    const cont = document.getElementById('tablero-control');
                    try { renderTablero(cont, st, markup); } catch {}
                  }).catch(() => {});
                }
              }).catch(() => {
                // fallback a flujo completo si diagrama falla
                cambiarProyecto(activo);
              });
              // Tambien asegurar flujo completo tradicional como respaldo (si fetch rapido falla, cambiarProyecto ya maneja ambos)
            }
          }
        } catch {
          if (estado.proyectoActivoId) {
            const activo = estado.proyectoActivoId;
            cargarDiagrama(activo).then((m) => {
              const el = document.getElementById('diagrama-contenido');
              if (el && typeof renderArchify === 'function') { try { renderArchify(el, m, { preserveScroll: true }); } catch {} }
              estado.diagramaMarkup = m;
            }).catch(() => cambiarProyecto(activo));
            cambiarProyecto(activo);
          }
        }
      };

      es.addEventListener('FS_CHANGE', handleFSChange);
      es.addEventListener('PROJECT_SYNC', handleFSChange);
      // Fallback: mensaje generico — usar mismo flujo reactivo
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'FS_CHANGE' || data.type === 'PROJECT_SYNC') {
            if (!data.projectId || data.projectId === estado.proyectoActivoId) {
              if (estado.proyectoActivoId) {
                const activo = estado.proyectoActivoId;
                cargarDiagrama(activo).then((markup) => {
                  const el = document.getElementById('diagrama-contenido');
                  if (el && typeof renderArchify === 'function') { try { renderArchify(el, markup, { preserveScroll: true, transitionMs: 120 }); } catch {} }
                  estado.diagramaMarkup = markup;
                }).catch(() => {});
                // no bloquear
                cambiarProyecto(activo);
              }
            }
          }
        } catch {}
      };

      // Marcar conectado optimistamente si no hay error en 500ms
      setTimeout(() => {
        if (sse === es && es.readyState === 1) actualizarPulso(true);
      }, 500);

      return;
    } catch {
      // Fallback a fetch streaming
    }
  }

  // Fallback: fetch streaming manual (si EventSource no disponible)
  conectarSSEFetch();
}

async function conectarSSEFetch() {
  try {
    const res = await fetch('/api/events', {
      headers: { Accept: 'text/event-stream' },
    });
    if (!res.ok || !res.body) {
      actualizarPulso(false);
      programarReconexion();
      return;
    }
    actualizarPulso(true);
    intentoReconexion = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    sse = { close() { try { reader.cancel(); } catch {} } };
    // Lectura en bucle
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        actualizarPulso(false);
        programarReconexion();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // Parse SSE: separar por \n\n
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lineas = raw.split('\n');
        let evento = 'message';
        let datos = '';
        for (const linea of lineas) {
          if (linea.startsWith('event:')) evento = linea.slice(6).trim();
          else if (linea.startsWith('data:')) datos += linea.slice(5).trim();
          else if (linea.startsWith(':')) { /* comentario keepalive */ }
        }
        if (evento === 'FS_CHANGE' || evento === 'PROJECT_SYNC') {
          try {
            const data = JSON.parse(datos);
            if (!data.projectId || data.projectId === estado.proyectoActivoId) {
              if (estado.proyectoActivoId) {
                const activo = estado.proyectoActivoId;
                cargarDiagrama(activo).then((markup) => {
                  const el = document.getElementById('diagrama-contenido');
                  if (el && typeof renderArchify === 'function') { try { renderArchify(el, markup, { preserveScroll: true, transitionMs: 120 }); } catch {} }
                  estado.diagramaMarkup = markup;
                }).catch(() => {});
                cambiarProyecto(activo);
              }
            }
          } catch {
            if (estado.proyectoActivoId) {
              const activo = estado.proyectoActivoId;
              cargarDiagrama(activo).then((m) => {
                const el = document.getElementById('diagrama-contenido');
                if (el && typeof renderArchify === 'function') { try { renderArchify(el, m, { preserveScroll: true }); } catch {} }
              }).catch(() => {});
              cambiarProyecto(activo);
            }
          }
        }
      }
    }
  } catch {
    actualizarPulso(false);
    programarReconexion();
  }
}

function programarReconexion() {
  if (temporizadorReconexion) return;
  intentoReconexion += 1;
  // Backoff 1s → 5s (lineal incremental, tope 5s)
  const demora = Math.min(1000 * intentoReconexion, 5000);
  actualizarPulsoRojo();
  temporizadorReconexion = setTimeout(() => {
    temporizadorReconexion = null;
    conectarSSE();
  }, demora);
}

function desconectarSSE() {
  if (temporizadorReconexion) {
    clearTimeout(temporizadorReconexion);
    temporizadorReconexion = null;
  }
  if (sse) {
    try {
      if (typeof sse.close === 'function') sse.close();
    } catch {}
    sse = null;
  }
}

// ---------------------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------------------
async function inicializar() {
  pulsoEl = document.getElementById('pulso-estado');
  textoConexionEl = document.getElementById('texto-conexion');
  actualizarPulso(false);

  // Botón cambiar proyecto abre Quick Switcher
  const boton = document.getElementById('boton-cambiar-proyecto');
  if (boton) {
    boton.addEventListener('click', () => {
      if (quickSwitcher) quickSwitcher.mostrar();
    });
  }

  // Cargar proyectos
  let datosProyectos;
  try {
    datosProyectos = await cargarProyectos();
  } catch (err) {
    const nombreEl = document.getElementById('proyecto-activo-nombre');
    if (nombreEl) nombreEl.textContent = 'Error al cargar proyectos';
    actualizarPulso(false);
    return;
  }

  estado.proyectos = Array.isArray(datosProyectos.projects) ? datosProyectos.projects : [];
  // Determinar activo: servidor activeProjectId > localStorage > primer proyecto
  const activoServidor = datosProyectos.activeProjectId || null;
  const activoLocal = cargarActivoLocal();
  let activoId = activoServidor || activoLocal || (estado.proyectos[0] ? estado.proyectos[0].id : null);
  // Validar que activoId exista en lista
  if (activoId && !estado.proyectos.some((p) => p.id === activoId)) {
    activoId = estado.proyectos[0] ? estado.proyectos[0].id : null;
  }
  estado.proyectoActivoId = activoId;

  if (activoId) {
    guardarActivoLocal(activoId);
    const activo = estado.proyectos.find((p) => p.id === activoId);
    const nombreEl = document.getElementById('proyecto-activo-nombre');
    if (nombreEl) nombreEl.textContent = activo ? activo.name : activoId;
  } else {
    const nombreEl = document.getElementById('proyecto-activo-nombre');
    if (nombreEl) nombreEl.textContent = 'Sin proyectos';
    const sprintDetalle = document.getElementById('sprint-detalle');
    if (sprintDetalle) sprintDetalle.textContent = 'Sin proyectos registrados';
  }

  // Inicializar Quick Switcher
  quickSwitcher = crearQuickSwitcher({
    proyectos: estado.proyectos,
    getProyectos: () => estado.proyectos,
    onSelect: (proyecto) => cambiarProyecto(proyecto),
  });

  // Inicializar Terminal Drawer — Story 4.2 (colapsable, atajos Ctrl+` / Cmd+J, historial aislado)
  try {
    const drawerEl = document.getElementById('terminal-drawer');
    terminalDrawer = createTerminalDrawer(drawerEl || '#terminal-drawer', {
      getProjectId: () => estado.proyectoActivoId,
      projectId: estado.proyectoActivoId,
    });
    // Sincronizar proyecto inicial si existe
    if (estado.proyectoActivoId && terminalDrawer && typeof terminalDrawer.setProject === 'function') {
      try { terminalDrawer.setProject(estado.proyectoActivoId); } catch {}
    }
  } catch {}

  // Cargar estado/diagrama del activo si existe
  if (estado.proyectoActivoId) {
    await cambiarProyecto(estado.proyectoActivoId);
  } else {
    // Render vacío
    const contenedor = document.getElementById('tablero-control');
    renderTablero(contenedor, null, '');
  }

  // Conectar SSE
  conectarSSE();

  // Escuchar cambios de proyectos (refetch periódico opcional)
  window.addEventListener('beforeunload', () => {
    desconectarSSE();
  });

  // Exponer para depuración y tests manuales
  window.__dashboardEstado = estado;
  window.__dashboardCambiarProyecto = cambiarProyecto;
  window.__dashboardConectarSSE = conectarSSE;
  window.__dashboardFiltrar = filtrarProyectos;
  window.__terminalDrawer = terminalDrawer;
}

// Auto-init cuando DOM listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}

// ---------------------------------------------------------------------------
// Exports para tests (no afectan runtime browser si no se importan)
// ---------------------------------------------------------------------------
export {
  estado,
  cargarProyectos,
  cargarEstado,
  cargarDiagrama,
  cambiarProyecto,
  actualizarPulso,
  conectarSSE,
  desconectarSSE,
  programarReconexion,
  filtrarProyectos,
  guardarActivoLocal,
  cargarActivoLocal,
  terminalDrawer,
};
