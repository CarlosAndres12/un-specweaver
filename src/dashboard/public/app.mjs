/**
 * Bootstrap SPA — un-specweaver Dashboard
 * Páginas dedicadas (nuevo-proyecto, doctor, sprint, sync, build, change, bug, ticket, adopt),
 * Wizard Multi-Paso de Creación de Proyectos (Product Brief + PRD con Requisitos Numerados),
 * Diagramas Globales y por Elemento con consistencia de Tema Claro / Oscuro,
 * Pi Shell con streaming contextual y soporte multi-proyecto.
 * ESM estricto, Vanilla sin bundler, 100% español técnico.
 */

import { crearQuickSwitcher, filtrarProyectos } from './components/quick-switcher.mjs';
import { renderTablero } from './components/tablero-control.mjs';
import { renderArchify } from './components/visor-archify.mjs';
import { createTerminalDrawer } from './components/terminal-drawer.mjs';
import {
  renderFlujoDatosSvg,
  renderSecuenciaEcoSvg,
  renderGrafoOlasSvg,
  renderCicloVidaArchifySvg,
  renderDiagramaEpicaSvg,
  renderDoctorGlobalSvg,
  renderDoctorElementSvg,
  renderSprintGlobalSvg,
  renderSprintElementSvg,
  renderSyncGlobalSvg,
  renderSyncElementSvg,
  renderBuildGlobalSvg,
  renderBuildElementSvg,
  renderChangeGlobalSvg,
  renderChangeElementSvg,
  renderBugGlobalSvg,
  renderBugElementSvg,
  renderTicketGlobalSvg,
  renderTicketElementSvg,
  renderAdoptGlobalSvg,
  renderAdoptElementSvg,
  renderNuevoProyectoGlobalSvg,
  renderNuevoProyectoElementSvg,
} from './components/diagramas-ingenieria.mjs';

// ---------------------------------------------------------------------------
// URL Resolver (soporte para http://127.0.0.1 y entornos locales/webviews)
// ---------------------------------------------------------------------------
export function getApiUrl(urlPath) {
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    return `http://127.0.0.1:3100${urlPath}`;
  }
  return urlPath;
}

// ---------------------------------------------------------------------------
// Estado en memoria
// ---------------------------------------------------------------------------
const estado = {
  proyectos: [],
  proyectoActivoId: null,
  estadoActual: null,
  diagramaMarkup: '',
  tipoDiagramaSeleccionado: 'flujo-datos',
  epicaDiagramaSeleccionada: '1',
  vistaActiva: 'tablero',
  sseConectado: false,
  tema: 'claro',
  elementoSeleccionado: {
    doctor: 'node',
    sprint: '1',
    sync: 'epics_parser',
    build: 'strict_validation',
    change: 'Modo de Navegación por Páginas Dedicadas',
    bug: 'Corrección de Ejecución en Terminal Drawer',
    ticket: 'feature_vs_bug',
    adopt: 'vendor_pinning',
  },
  wizard: {
    paso: 1,
    tabPreview: 'brief',
    fr: [
      { id: 'FR-001', title: 'Inicialización de Arquitectura Base', desc: 'El sistema DEBE configurar el entorno y dependencias iniciales.', priority: 'Must' },
      { id: 'FR-002', title: 'Flujo Central de Operaciones', desc: 'El sistema DEBE ejecutar las tareas y contratos principales.', priority: 'Must' },
    ],
    nfr: [
      { id: 'NFR-001', title: 'Rendimiento y Baja Latencia', desc: 'Las operaciones críticas DEBEN responder en <300ms.', priority: 'Must' },
      { id: 'NFR-002', title: 'Aislamiento y Seguridad', desc: 'Cada componente DEBE ejecutarse con aislamiento estricto (AD-01).', priority: 'Must' },
    ],
  },
  bugs: [
    {
      id: 'bug-1',
      titulo: 'Corrección de Ejecución en Terminal Drawer',
      descripcion: 'El terminal requería integración directa con los binarios de un-specweaver en lugar de stubs simulados.',
      estado: 'resuelto',
      fecha: '2026-08-30',
    },
  ],
  cambios: [
    {
      id: 'chg-1',
      titulo: 'Modo de Navegación por Páginas Dedicadas',
      descripcion: 'Soporte para páginas dedicadas por funcionalidad (doctor, sprint, sync, build, change, bug, ticket, adopt).',
      estado: 'en_progreso',
      fecha: '2026-08-30',
    },
  ],
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
  try { localStorage.setItem('activeProjectId', id); } catch {}
  try { sessionStorage.setItem('activeProjectId', id); } catch {}
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
    getApiUrl(`/api/projects/${encodeURIComponent(id)}/active`),
    getApiUrl(`/api/projects/active`),
  ];
  for (const ruta of rutas) {
    try {
      const res = await fetch(ruta, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) return true;
      if (res.status === 405 || res.status === 404) {
        const res2 = await fetch(ruta, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (res2.ok) return true;
      }
    } catch {}
  }
  return false;
}

// ---------------------------------------------------------------------------
// Gestión de Tema Claro / Oscuro (Claro por defecto)
// ---------------------------------------------------------------------------
function inicializarTema() {
  let temaGuardado = 'claro';
  try {
    temaGuardado = localStorage.getItem('dashboard_theme') || 'claro';
  } catch {}
  aplicarTema(temaGuardado);

  const btnTema = document.getElementById('boton-toggle-tema');
  if (btnTema) {
    btnTema.addEventListener('click', () => {
      const nuevoTema = estado.tema === 'claro' ? 'oscuro' : 'claro';
      aplicarTema(nuevoTema);
    });
  }
}

function aplicarTema(tema) {
  estado.tema = tema;
  try { localStorage.setItem('dashboard_theme', tema); } catch {}
  
  if (tema === 'oscuro') {
    document.body.classList.remove('tema-claro');
    document.body.classList.add('tema-oscuro');
    const icono = document.getElementById('icono-tema');
    const texto = document.getElementById('texto-tema');
    if (icono) icono.textContent = '☀️';
    if (texto) texto.textContent = 'Claro';
  } else {
    document.body.classList.remove('tema-oscuro');
    document.body.classList.add('tema-claro');
    const icono = document.getElementById('icono-tema');
    const texto = document.getElementById('texto-tema');
    if (icono) icono.textContent = '🌙';
    if (texto) texto.textContent = 'Oscuro';
  }

  // Re-renderizar todos los diagramas para actualizar colores y fondos con el tema
  renderTodosLosDiagramas();
}

// ---------------------------------------------------------------------------
// Navegación por Páginas / Vistas Dedicadas
// ---------------------------------------------------------------------------
function cambiarVista(vistaId) {
  estado.vistaActiva = vistaId;

  // Actualizar botones de navegación
  const navBtns = document.querySelectorAll('.nav-vista-btn');
  navBtns.forEach((btn) => {
    if (btn.getAttribute('data-vista') === vistaId) {
      btn.classList.add('activa');
    } else {
      btn.classList.remove('activa');
    }
  });

  // Actualizar contenedores de vista
  const contenedores = document.querySelectorAll('.contenedor-vista');
  contenedores.forEach((cont) => {
    if (cont.id === `vista-${vistaId}`) {
      cont.classList.add('activa');
    } else {
      cont.classList.remove('activa');
    }
  });

  // Re-render contextual
  renderDiagramasDeVista(vistaId);
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
async function cargarProyectos() {
  const res = await fetch(getApiUrl('/api/projects'));
  if (!res.ok) throw new Error(`Error al cargar proyectos: ${res.status}`);
  return res.json();
}

async function cargarEstado(proyectoId) {
  const res = await fetch(getApiUrl(`/api/projects/${encodeURIComponent(proyectoId)}/state`));
  if (!res.ok) {
    if (res.status === 404) throw new Error('Proyecto no encontrado');
    throw new Error(`Error al cargar estado: ${res.status}`);
  }
  return res.json();
}

async function cargarDiagrama(proyectoId) {
  const res = await fetch(getApiUrl(`/api/projects/${encodeURIComponent(proyectoId)}/diagram`));
  if (!res.ok) throw new Error(`Error al cargar diagrama: ${res.status}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Pi Shell / Ejecutor Contextual de Comandos en Streaming
// ---------------------------------------------------------------------------
async function ejecutarEnShell(command, args = [], targetPreId = 'shell-doctor-output', promptContext = null) {
  const pid = estado.proyectoActivoId;
  if (!pid) return;

  // Auto-open terminal drawer immediately so user NEVER has to scroll down (Zero-scroll UX)
  if (terminalDrawer && typeof terminalDrawer.abrir === 'function') {
    try { terminalDrawer.abrir(); } catch {}
  }

  const swCommands = ['doctor', 'sprint', 'sync', 'build', 'ticket', 'adopt', 'bug', 'change', 'new', 'update'];
  if (swCommands.includes(command) && terminalDrawer && typeof terminalDrawer.ejecutar === 'function') {
    let piMessage = `/sw:${command}`;
    if (args && args.length > 0) {
      piMessage += ' ' + args.join(' ');
    }
    if (promptContext && (command === 'bug' || command === 'change')) {
      piMessage = `${promptContext}\n${piMessage}`;
    }
    const preEl = document.getElementById(targetPreId);
    if (preEl) {
      preEl.textContent += `\n[Pi Agent]: Abriendo sesión interactiva con "${piMessage}"...\n`;
      preEl.scrollTop = preEl.scrollHeight;
    }
    return terminalDrawer.ejecutar('pi', pid, [piMessage]);
  }

  const preEl = document.getElementById(targetPreId);
  if (!preEl) return;

  if (promptContext) {
    preEl.textContent += `\n[Pi-Shell AI Context]: ${promptContext}\n$ /sw:${command} ${args.join(' ')}\n`;
  } else {
    preEl.textContent += `\n$ /sw:${command} ${args.join(' ')}\n`;
  }
  preEl.scrollTop = preEl.scrollHeight;

  try {
    const res = await fetch(getApiUrl(`/api/projects/${encodeURIComponent(pid)}/commands`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args }),
    });

    if (!res.ok) {
      preEl.textContent += `Error al iniciar comando: HTTP ${res.status}\n`;
      return;
    }

    const { executionId } = await res.json();
    if (!executionId) return;

    if (typeof EventSource !== 'undefined') {
      const streamUrl = getApiUrl(`/api/projects/${encodeURIComponent(pid)}/commands/${encodeURIComponent(executionId)}/stream`);
      const cmdEs = new EventSource(streamUrl);

      cmdEs.addEventListener('COMMAND_OUTPUT', (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload.chunk) {
            preEl.textContent += payload.chunk;
            preEl.scrollTop = preEl.scrollHeight;
          }
        } catch {}
      });

      cmdEs.addEventListener('COMMAND_CLOSE', (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          preEl.textContent += `\n[proceso terminado con código ${payload.exitCode ?? 0}]\n`;
          preEl.scrollTop = preEl.scrollHeight;
        } catch {}
        cmdEs.close();

        if (command === 'doctor' || command === 'sync' || command === 'sprint' || command === 'adopt' || command === 'update') {
          cambiarProyecto(pid);
        }
      });

      cmdEs.onerror = () => {
        cmdEs.close();
      };
    }
  } catch (err) {
    preEl.textContent += `Excepción al ejecutar comando: ${err.message}\n`;
    if (err.message && err.message.includes('Failed to fetch')) {
      preEl.textContent += `[info] No se pudo conectar con el servidor en ${getApiUrl('/api')}. Asegúrate de que ./start.sh esté ejecutándose.\n`;
    }
  }
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
// Renderizado del Hub de Diagramas de Arquitectura
// ---------------------------------------------------------------------------
function renderDiagramaSeleccionado() {
  const contenedor = document.getElementById('diagrama-contenido');
  if (!contenedor) return;

  const subselector = document.getElementById('subselector-epicas');
  const tipo = estado.tipoDiagramaSeleccionado || 'flujo-datos';
  const tema = estado.tema || 'claro';

  if (tipo === 'epica-detalle') {
    if (subselector) subselector.classList.remove('oculto');
  } else {
    if (subselector) subselector.classList.add('oculto');
  }

  let markup = '';

  if (tipo === 'flujo-datos') {
    markup = renderFlujoDatosSvg(tema);
  } else if (tipo === 'grafo-olas') {
    markup = renderGrafoOlasSvg(estado.estadoActual, tema);
  } else if (tipo === 'secuencia-eco') {
    markup = renderSecuenciaEcoSvg(tema);
  } else if (tipo === 'ciclo-vida') {
    if (estado.diagramaMarkup && !estado.diagramaMarkup.includes('archify-placeholder')) {
      markup = estado.diagramaMarkup;
    } else {
      markup = renderCicloVidaArchifySvg(estado.estadoActual, tema);
    }
  } else if (tipo === 'epica-detalle') {
    const epicaVal = estado.epicaDiagramaSeleccionada || '1';
    markup = renderDiagramaEpicaSvg(epicaVal, estado.estadoActual, tema);
  }

  if (markup) {
    try {
      renderArchify(contenedor, markup, { preserveScroll: true, transitionMs: 120 });
    } catch {
      contenedor.innerHTML = markup;
    }
  }
}

/**
 * Renderiza los diagramas globales y por elemento para todas las vistas.
 */
function renderTodosLosDiagramas() {
  const tema = estado.tema || 'claro';
  const st = estado.estadoActual;

  // 1. Tablero
  renderDiagramaSeleccionado();

  // 2. Nuevo Proyecto (Wizard)
  const gNw = document.getElementById('diagrama-global-nuevo-proyecto');
  if (gNw) gNw.innerHTML = renderNuevoProyectoGlobalSvg(tema);
  const eNw = document.getElementById('diagrama-elemento-nuevo-proyecto');
  if (eNw) eNw.innerHTML = renderNuevoProyectoElementSvg(estado.wizard.paso, tema);

  // 3. Doctor
  const gDoc = document.getElementById('diagrama-global-doctor');
  if (gDoc) gDoc.innerHTML = renderDoctorGlobalSvg(st, tema);
  const eDoc = document.getElementById('diagrama-elemento-doctor');
  if (eDoc) eDoc.innerHTML = renderDoctorElementSvg(estado.elementoSeleccionado.doctor || 'node', tema);

  // 4. Sprint
  const gSpr = document.getElementById('diagrama-global-sprint');
  if (gSpr) gSpr.innerHTML = renderSprintGlobalSvg(st, tema);
  const eSpr = document.getElementById('diagrama-elemento-sprint');
  if (eSpr) eSpr.innerHTML = renderSprintElementSvg(estado.elementoSeleccionado.sprint || '1', {}, tema);

  // 5. Sync
  const gSync = document.getElementById('diagrama-global-sync');
  if (gSync) gSync.innerHTML = renderSyncGlobalSvg(st, tema);
  const eSync = document.getElementById('diagrama-elemento-sync');
  if (eSync) eSync.innerHTML = renderSyncElementSvg('epics.md ➔ Given/When/Then change specs', tema);

  // 6. Build
  const gBld = document.getElementById('diagrama-global-build');
  if (gBld) gBld.innerHTML = renderBuildGlobalSvg(st, tema);
  const eBld = document.getElementById('diagrama-elemento-build');
  if (eBld) eBld.innerHTML = renderBuildElementSvg('OpenSpec validate --strict & test suites', tema);

  // 7. Change
  const gChg = document.getElementById('diagrama-global-change');
  if (gChg) gChg.innerHTML = renderChangeGlobalSvg(st, tema);
  const eChg = document.getElementById('diagrama-elemento-change');
  if (eChg) eChg.innerHTML = renderChangeElementSvg(estado.elementoSeleccionado.change || 'Requerimiento activo', tema);

  // 8. Bug
  const gBug = document.getElementById('diagrama-global-bug');
  if (gBug) gBug.innerHTML = renderBugGlobalSvg(st, tema);
  const eBug = document.getElementById('diagrama-elemento-bug');
  if (eBug) eBug.innerHTML = renderBugElementSvg(estado.elementoSeleccionado.bug || 'Defecto activo', tema);

  // 9. Ticket
  const gTkt = document.getElementById('diagrama-global-ticket');
  if (gTkt) gTkt.innerHTML = renderTicketGlobalSvg(st, tema);
  const eTkt = document.getElementById('diagrama-elemento-ticket');
  if (eTkt) eTkt.innerHTML = renderTicketElementSvg('Issue Triage ➔ /sw:bug vs /sw:change', tema);

  // 10. Adopt
  const gAdp = document.getElementById('diagrama-global-adopt');
  if (gAdp) gAdp.innerHTML = renderAdoptGlobalSvg(st, tema);
  const eAdp = document.getElementById('diagrama-elemento-adopt');
  if (eAdp) eAdp.innerHTML = renderAdoptElementSvg('Adopción No Destructiva e Inyección de Vendors', tema);
}

function renderDiagramasDeVista(vistaId) {
  const tema = estado.tema || 'claro';
  const st = estado.estadoActual;

  if (vistaId === 'tablero') {
    renderDiagramaSeleccionado();
  } else if (vistaId === 'nuevo-proyecto') {
    const gNw = document.getElementById('diagrama-global-nuevo-proyecto');
    if (gNw) gNw.innerHTML = renderNuevoProyectoGlobalSvg(tema);
    const eNw = document.getElementById('diagrama-elemento-nuevo-proyecto');
    if (eNw) eNw.innerHTML = renderNuevoProyectoElementSvg(estado.wizard.paso, tema);
  } else if (vistaId === 'doctor') {
    const gDoc = document.getElementById('diagrama-global-doctor');
    if (gDoc) gDoc.innerHTML = renderDoctorGlobalSvg(st, tema);
    const eDoc = document.getElementById('diagrama-elemento-doctor');
    if (eDoc) eDoc.innerHTML = renderDoctorElementSvg(estado.elementoSeleccionado.doctor || 'node', tema);
  } else if (vistaId === 'sprint') {
    const gSpr = document.getElementById('diagrama-global-sprint');
    if (gSpr) gSpr.innerHTML = renderSprintGlobalSvg(st, tema);
    const eSpr = document.getElementById('diagrama-elemento-sprint');
    if (eSpr) eSpr.innerHTML = renderSprintElementSvg(estado.elementoSeleccionado.sprint || '1', {}, tema);
    renderOlasSprintDetalle();
  } else if (vistaId === 'sync') {
    const gSync = document.getElementById('diagrama-global-sync');
    if (gSync) gSync.innerHTML = renderSyncGlobalSvg(st, tema);
    const eSync = document.getElementById('diagrama-elemento-sync');
    if (eSync) eSync.innerHTML = renderSyncElementSvg('epics.md ➔ Given/When/Then change specs', tema);
  } else if (vistaId === 'build') {
    const gBld = document.getElementById('diagrama-global-build');
    if (gBld) gBld.innerHTML = renderBuildGlobalSvg(st, tema);
    const eBld = document.getElementById('diagrama-elemento-build');
    if (eBld) eBld.innerHTML = renderBuildElementSvg('OpenSpec validate --strict & test suites', tema);
  } else if (vistaId === 'change') {
    const gChg = document.getElementById('diagrama-global-change');
    if (gChg) gChg.innerHTML = renderChangeGlobalSvg(st, tema);
    const eChg = document.getElementById('diagrama-elemento-change');
    if (eChg) eChg.innerHTML = renderChangeElementSvg(estado.elementoSeleccionado.change || 'Requerimiento activo', tema);
    renderListaCambios();
  } else if (vistaId === 'bug') {
    const gBug = document.getElementById('diagrama-global-bug');
    if (gBug) gBug.innerHTML = renderBugGlobalSvg(st, tema);
    const eBug = document.getElementById('diagrama-elemento-bug');
    if (eBug) eBug.innerHTML = renderBugElementSvg(estado.elementoSeleccionado.bug || 'Defecto activo', tema);
    renderListaBugs();
  } else if (vistaId === 'ticket') {
    const gTkt = document.getElementById('diagrama-global-ticket');
    if (gTkt) gTkt.innerHTML = renderTicketGlobalSvg(st, tema);
    const eTkt = document.getElementById('diagrama-elemento-ticket');
    if (eTkt) eTkt.innerHTML = renderTicketElementSvg('Issue Triage ➔ /sw:bug vs /sw:change', tema);
  } else if (vistaId === 'adopt') {
    const gAdp = document.getElementById('diagrama-global-adopt');
    if (gAdp) gAdp.innerHTML = renderAdoptGlobalSvg(st, tema);
    const eAdp = document.getElementById('diagrama-elemento-adopt');
    if (eAdp) eAdp.innerHTML = renderAdoptElementSvg('Adopción No Destructiva e Inyección de Vendors', tema);
  }
}

// ---------------------------------------------------------------------------
// Wizard Multi-Paso: Lógica y Renderizado Dinámico
// ---------------------------------------------------------------------------
function renderWizardFRItems() {
  const cont = document.getElementById('contenedor-fr-items');
  if (!cont) return;

  cont.innerHTML = estado.wizard.fr.map((fr, idx) => `
    <div class="item-fila-requisito" data-idx="${idx}">
      <span class="tag-requisito-id">${fr.id}</span>
      <input type="text" class="input-fr-titulo" value="${fr.title || ''}" placeholder="Título del requisito..." />
      <input type="text" class="input-fr-desc" value="${fr.desc || ''}" placeholder="Descripción normativa (El sistema DEBE...)" />
      <select class="select-fr-prio select-epica-estilo" style="padding:0.25rem 0.5rem; font-size:0.8rem;">
        <option value="Must" ${fr.priority === 'Must' ? 'selected' : ''}>Must</option>
        <option value="Should" ${fr.priority === 'Should' ? 'selected' : ''}>Should</option>
      </select>
      <button class="btn-eliminar-requisito btn-eliminar-fr" type="button" data-idx="${idx}" title="Eliminar requisito">✕</button>
    </div>
  `).join('');

  // Event listeners para inputs y deletes
  cont.querySelectorAll('.input-fr-titulo').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.closest('.item-fila-requisito').getAttribute('data-idx'));
      if (estado.wizard.fr[idx]) estado.wizard.fr[idx].title = e.target.value;
    });
  });
  cont.querySelectorAll('.input-fr-desc').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.closest('.item-fila-requisito').getAttribute('data-idx'));
      if (estado.wizard.fr[idx]) estado.wizard.fr[idx].desc = e.target.value;
    });
  });
  cont.querySelectorAll('.select-fr-prio').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const idx = Number(e.target.closest('.item-fila-requisito').getAttribute('data-idx'));
      if (estado.wizard.fr[idx]) estado.wizard.fr[idx].priority = e.target.value;
    });
  });
  cont.querySelectorAll('.btn-eliminar-fr').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = Number(btn.getAttribute('data-idx'));
      estado.wizard.fr.splice(idx, 1);
      // Renumerar
      estado.wizard.fr.forEach((f, i) => { f.id = `FR-${String(i + 1).padStart(3, '0')}`; });
      renderWizardFRItems();
    });
  });
}

function renderWizardNFRItems() {
  const cont = document.getElementById('contenedor-nfr-items');
  if (!cont) return;

  cont.innerHTML = estado.wizard.nfr.map((nfr, idx) => `
    <div class="item-fila-requisito" data-idx="${idx}">
      <span class="tag-requisito-id" style="color:var(--accent-purple);">${nfr.id}</span>
      <input type="text" class="input-nfr-titulo" value="${nfr.title || ''}" placeholder="Título del NFR..." />
      <input type="text" class="input-nfr-desc" value="${nfr.desc || ''}" placeholder="Criterio de rendimiento o seguridad..." />
      <select class="select-nfr-prio select-epica-estilo" style="padding:0.25rem 0.5rem; font-size:0.8rem;">
        <option value="Must" ${nfr.priority === 'Must' ? 'selected' : ''}>Must</option>
        <option value="Should" ${nfr.priority === 'Should' ? 'selected' : ''}>Should</option>
      </select>
      <button class="btn-eliminar-requisito btn-eliminar-nfr" type="button" data-idx="${idx}" title="Eliminar requisito">✕</button>
    </div>
  `).join('');

  cont.querySelectorAll('.input-nfr-titulo').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.closest('.item-fila-requisito').getAttribute('data-idx'));
      if (estado.wizard.nfr[idx]) estado.wizard.nfr[idx].title = e.target.value;
    });
  });
  cont.querySelectorAll('.input-nfr-desc').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.closest('.item-fila-requisito').getAttribute('data-idx'));
      if (estado.wizard.nfr[idx]) estado.wizard.nfr[idx].desc = e.target.value;
    });
  });
  cont.querySelectorAll('.select-nfr-prio').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const idx = Number(e.target.closest('.item-fila-requisito').getAttribute('data-idx'));
      if (estado.wizard.nfr[idx]) estado.wizard.nfr[idx].priority = e.target.value;
    });
  });
  cont.querySelectorAll('.btn-eliminar-nfr').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = Number(btn.getAttribute('data-idx'));
      estado.wizard.nfr.splice(idx, 1);
      estado.wizard.nfr.forEach((f, i) => { f.id = `NFR-${String(i + 1).padStart(3, '0')}`; });
      renderWizardNFRItems();
    });
  });
}

function irAPasoWizard(pasoDestino) {
  if (pasoDestino < 1 || pasoDestino > 5) return;

  // Validaciones al avanzar
  if (pasoDestino > estado.wizard.paso) {
    if (estado.wizard.paso === 1) {
      const nom = document.getElementById('wizard-input-nombre')?.value?.trim();
      const pth = document.getElementById('wizard-input-path')?.value?.trim();
      if (!nom || !pth) {
        alert('Por favor completa el Nombre del Proyecto y la Ruta Absoluta.');
        return;
      }
    } else if (estado.wizard.paso === 2) {
      const prob = document.getElementById('wizard-brief-problema')?.value?.trim();
      const aud = document.getElementById('wizard-brief-audiencia')?.value?.trim();
      const val = document.getElementById('wizard-brief-valor')?.value?.trim();
      if (!prob || !aud || !val) {
        alert('Por favor completa los campos obligatorios del Product Brief.');
        return;
      }
    }
  }

  estado.wizard.paso = pasoDestino;

  // Actualizar Stepper UI
  document.querySelectorAll('.stepper-item').forEach((item) => {
    const s = Number(item.getAttribute('data-step'));
    item.classList.remove('activo', 'completado');
    if (s === pasoDestino) item.classList.add('activo');
    else if (s < pasoDestino) item.classList.add('completado');
  });

  // Actualizar Contenedor del Paso
  document.querySelectorAll('.wizard-paso-contenido').forEach((pCont) => {
    pCont.classList.remove('activo');
  });
  const pasoActivoEl = document.getElementById(`wizard-paso-${pasoDestino}`);
  if (pasoActivoEl) pasoActivoEl.classList.add('activo');

  // Actualizar Botones de Navegación
  const btnAnt = document.getElementById('btn-wizard-anterior');
  const btnSig = document.getElementById('btn-wizard-siguiente');
  const btnCrear = document.getElementById('btn-wizard-crear');

  if (btnAnt) btnAnt.disabled = pasoDestino === 1;
  if (btnSig) {
    if (pasoDestino === 5) btnSig.classList.add('oculto');
    else btnSig.classList.remove('oculto');
  }
  if (btnCrear) {
    if (pasoDestino === 5) btnCrear.classList.remove('oculto');
    else btnCrear.classList.add('oculto');
  }

  // Si llega a paso 5, compilar vista previa
  if (pasoDestino === 5) {
    compilarPreviewWizard();
  }

  // Actualizar diagrama de elemento
  const eNw = document.getElementById('diagrama-elemento-nuevo-proyecto');
  if (eNw) eNw.innerHTML = renderNuevoProyectoElementSvg(pasoDestino, estado.tema || 'claro');
}

function compilarPreviewWizard() {
  const nombre = document.getElementById('wizard-input-nombre')?.value?.trim() || 'Nuevo Proyecto';
  const problema = document.getElementById('wizard-brief-problema')?.value?.trim() || 'Problema sin definir';
  const audiencia = document.getElementById('wizard-brief-audiencia')?.value?.trim() || 'Usuarios generales';
  const valor = document.getElementById('wizard-brief-valor')?.value?.trim() || 'Solución innovadora';
  const kpis = document.getElementById('wizard-brief-kpis')?.value?.trim() || 'Métricas estándar';
  const outOfScope = document.getElementById('wizard-brief-scope')?.value?.trim() || 'Sin exclusiones definidas';
  const estilo = document.getElementById('wizard-arch-estilo')?.value || 'Clean Architecture';
  const stack = document.getElementById('wizard-arch-stack')?.value || 'Node.js, ESM';

  const previewPre = document.getElementById('preview-markdown-contenido');
  if (!previewPre) return;

  if (estado.wizard.tabPreview === 'brief') {
    previewPre.textContent = `# Product Brief — ${nombre}\n\n## 1. Problema y Oportunidad\n${problema}\n\n## 2. Público Objetivo\n${audiencia}\n\n## 3. Propuesta de Valor\n${valor}\n\n## 4. KPIs de Éxito\n${kpis}\n\n## 5. Límites de Alcance (Out-of-Scope)\n${outOfScope}\n`;
  } else {
    let frLines = estado.wizard.fr.map((f) => `| **${f.id}** | ${f.title} | ${f.desc} | ${f.priority} |`).join('\n');
    let nfrLines = estado.wizard.nfr.map((n) => `| **${n.id}** | ${n.title} | ${n.desc} | ${n.priority} |`).join('\n');

    previewPre.textContent = `# PRD — ${nombre}\n\n## 1. Decisiones Arquitectónicas\n- Estilo: ${estilo}\n- Stack: ${stack}\n\n## 2. Requisitos Funcionales Numerados\n| ID | Requisito Funcional | Descripción Normativa | Prioridad |\n|---|---|---|---|\n${frLines}\n\n## 3. Requisitos No Funcionales Numerados\n| ID | Requisito No Funcional | Criterio de Aceptación | Prioridad |\n|---|---|---|---|\n${nfrLines}\n`;
  }
}

async function ejecutarCreacionProyectoWizard() {
  const nombre = document.getElementById('wizard-input-nombre')?.value?.trim() || 'Nuevo Proyecto';
  const rutaAbsoluta = document.getElementById('wizard-input-path')?.value?.trim() || '';
  const lang = document.getElementById('wizard-select-idioma')?.value || 'es';
  const engramScope = document.getElementById('wizard-select-engram')?.value || 'project';
  const problema = document.getElementById('wizard-brief-problema')?.value?.trim() || '';
  const audiencia = document.getElementById('wizard-brief-audiencia')?.value?.trim() || '';
  const valor = document.getElementById('wizard-brief-valor')?.value?.trim() || '';
  const kpisRaw = document.getElementById('wizard-brief-kpis')?.value?.trim() || '';
  const scopeRaw = document.getElementById('wizard-brief-scope')?.value?.trim() || '';
  const estilo = document.getElementById('wizard-arch-estilo')?.value || 'Clean Architecture';
  const graphify = document.getElementById('wizard-arch-graphify')?.value || 'auto';
  const stack = document.getElementById('wizard-arch-stack')?.value || 'Node.js, ESM';

  const shellOutput = document.getElementById('shell-nuevo-proyecto-output');
  if (shellOutput) {
    shellOutput.textContent = `[Iniciando creación de proyecto...]\nNombre: ${nombre}\nRuta: ${rutaAbsoluta}\n`;
  }

  const payload = {
    name: nombre,
    path: rutaAbsoluta,
    lang,
    brief: {
      problem: problema,
      audience: audiencia,
      valueProp: valor,
      kpis: kpisRaw ? kpisRaw.split('\n').map((k) => ({ metric: k, target: 'Cumplido' })) : [],
      outOfScope: scopeRaw ? scopeRaw.split('\n') : [],
    },
    requirements: {
      fr: estado.wizard.fr,
      nfr: estado.wizard.nfr,
    },
    architecture: {
      style: estilo,
      stack,
      engramScope,
      graphify,
    },
  };

  try {
    const res = await fetch(getApiUrl('/api/projects/wizard'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (shellOutput) shellOutput.textContent += `\n[Error al crear proyecto]: ${errData.message || res.statusText}\n`;
      alert(`Error al crear proyecto: ${errData.message || res.statusText}`);
      return;
    }

    const { project, executionId } = await res.json();
    if (shellOutput) {
      shellOutput.textContent += `\n✓ Proyecto '${project.name}' creado exitosamente en ${project.path}\n`;
      shellOutput.textContent += `✓ Artefactos BMad generados (product-brief.md, prd.md)\n`;
      shellOutput.textContent += `✓ Configuración .un-specweaver/config.json escrita\n`;
      shellOutput.textContent += `\nConmutando a la vista del nuevo proyecto...\n`;
    }

    // Actualizar inventario de proyectos y conmutar en <100ms
    const datosProyectos = await cargarProyectos();
    estado.proyectos = datosProyectos.projects || [];
    if (quickSwitcher) quickSwitcher.actualizarProyectos(estado.proyectos);

    await cambiarProyecto(project);

    // Cambiar a vista tablero
    setTimeout(() => {
      cambiarVista('tablero');
    }, 500);

  } catch (err) {
    if (shellOutput) shellOutput.textContent += `\n[Excepción]: ${err.message}\n`;
    alert(`Error: ${err.message}`);
  }
}

function renderOlasSprintDetalle() {
  const contenedor = document.getElementById('sprint-olas-detalle');
  if (!contenedor) return;

  const waves = estado.estadoActual?.sprint?.waves || [
    [{ id: '1.1', title: 'Aislamiento de CWD', status: 'done' }, { id: '1.2', title: 'Project Registry', status: 'done' }],
    [{ id: '2.1', title: 'Servidor Reactivo', status: 'done' }, { id: '2.2', title: 'Supresión de Eco', status: 'done' }],
    [{ id: '3.1', title: 'Compilador Archify', status: 'done' }, { id: '3.2', title: 'Visor y Sandbox', status: 'done' }],
    [{ id: '4.1', title: 'Frontend SPA Vanilla', status: 'in_progress' }, { id: '4.2', title: 'CLI & Tests', status: 'in_progress' }],
  ];

  let html = '';
  waves.forEach((wave, idx) => {
    html += `
      <div class="tarjeta-subseccion ola-tarjeta" data-wave="${idx + 1}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
          <h3 style="margin:0;">🌊 Ola ${idx + 1} (${wave.length} Historias)</h3>
          <button class="boton-primario btn-activar-ola" type="button" data-wave="${idx + 1}">
            Activar
          </button>
        </div>
        <ul class="lista-chequeos">
          ${wave.map((st) => `
            <li class="item-chequeo ok" style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
              <span><strong>Story ${st.id || ''}:</strong> ${st.title || 'Historia'}</span>
              <button class="btn-secundario btn-activar-historia" type="button" data-story="${st.id || ''}" data-title="${st.title || ''}" style="padding:0.25rem 0.65rem; font-size:0.75rem; border-radius:6px; cursor:pointer;">
                Activar
              </button>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  });

  contenedor.innerHTML = html;

  // Interacción de clic por ola para actualizar diagrama de elemento
  const olasTarjetas = contenedor.querySelectorAll('.ola-tarjeta');
  olasTarjetas.forEach((tarjeta) => {
    tarjeta.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const w = tarjeta.getAttribute('data-wave') || '1';
      estado.elementoSeleccionado.sprint = w;
      const eSpr = document.getElementById('diagrama-elemento-sprint');
      if (eSpr) eSpr.innerHTML = renderSprintElementSvg(w, {}, estado.tema || 'claro');
    });
  });

  // Botones Activar Ola
  const btnsActivarOla = contenedor.querySelectorAll('.btn-activar-ola');
  btnsActivarOla.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const w = btn.getAttribute('data-wave') || '1';
      estado.elementoSeleccionado.sprint = w;
      const eSpr = document.getElementById('diagrama-elemento-sprint');
      if (eSpr) eSpr.innerHTML = renderSprintElementSvg(w, {}, estado.tema || 'claro');
      ejecutarEnShell('sprint', ['--wave=' + w], 'shell-sprint-output', `Activando Ola ${w}`);
    });
  });

  // Botones Activar Historia
  const btnsActivarHistoria = contenedor.querySelectorAll('.btn-activar-historia');
  btnsActivarHistoria.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = btn.getAttribute('data-story') || '';
      const stitle = btn.getAttribute('data-title') || 'Historia';
      ejecutarEnShell('build', ['--story=' + sid], 'shell-sprint-output', `Activando desarrollo de Story ${sid}: ${stitle}`);
    });
  });
}

function renderListaBugs() {
  const cont = document.getElementById('lista-bugs-items');
  if (!cont) return;

  cont.innerHTML = estado.bugs.map((b) => `
    <div class="tarjeta-item-accion bug-tarjeta" data-title="${b.titulo}" style="cursor:pointer;">
      <div class="item-cabecera">
        <span class="badge-tag badge-rojo">${b.estado === 'resuelto' ? 'RESUELTO' : 'BUG ACTIVO'}</span>
        <h4>${b.titulo}</h4>
      </div>
      <p class="item-descripcion">${b.descripcion}</p>
      <div class="item-acciones-fila">
        <button class="btn-secundario btn-shell-contexto" type="button" data-cmd="bug" data-target="shell-bug-output" data-ctx="Defecto: ${b.titulo}">
          💻 Abrir Shell con Contexto
        </button>
        <button class="boton-alerta btn-ejecutar-ia" type="button" data-cmd="bug" data-target="shell-bug-output" data-prompt="Resolver automáticamente el defecto: ${b.titulo}. Contexto: ${b.descripcion}">
          🛠️ Resolver Defecto con IA
        </button>
      </div>
    </div>
  `).join('');

  // Interacción de clic para actualizar diagrama de elemento de bug
  const bugCards = cont.querySelectorAll('.bug-tarjeta');
  bugCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const tit = card.getAttribute('data-title') || 'Defecto';
      estado.elementoSeleccionado.bug = tit;
      const eBug = document.getElementById('diagrama-elemento-bug');
      if (eBug) eBug.innerHTML = renderBugElementSvg(tit, estado.tema || 'claro');
    });
  });

  wireItemActionButtons(cont);
}

function renderListaCambios() {
  const cont = document.getElementById('lista-cambios-items');
  if (!cont) return;

  cont.innerHTML = estado.cambios.map((c) => `
    <div class="tarjeta-item-accion cambio-tarjeta" data-title="${c.titulo}" style="cursor:pointer;">
      <div class="item-cabecera">
        <span class="badge-tag badge-cyan">CHANGE</span>
        <h4>${c.titulo}</h4>
      </div>
      <p class="item-descripcion">${c.descripcion}</p>
      <div class="item-acciones-fila">
        <button class="btn-secundario btn-shell-contexto" type="button" data-cmd="change" data-target="shell-change-output" data-ctx="Cambio: ${c.titulo}">
          💻 Abrir Shell con Contexto
        </button>
        <button class="boton-primario btn-ejecutar-ia" type="button" data-cmd="change" data-target="shell-change-output" data-prompt="Implementar requerimiento de cambio: ${c.titulo}. Especificaciones: ${c.descripcion}">
          🚀 Implementar con IA
        </button>
      </div>
    </div>
  `).join('');

  const chgCards = cont.querySelectorAll('.cambio-tarjeta');
  chgCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const tit = card.getAttribute('data-title') || 'Cambio';
      estado.elementoSeleccionado.change = tit;
      const eChg = document.getElementById('diagrama-elemento-change');
      if (eChg) eChg.innerHTML = renderChangeElementSvg(tit, estado.tema || 'claro');
    });
  });

  wireItemActionButtons(cont);
}

function wireItemActionButtons(container) {
  const btnsContexto = container.querySelectorAll('.btn-shell-contexto');
  btnsContexto.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd') || 'bug';
      const target = btn.getAttribute('data-target') || 'shell-bug-output';
      const ctx = btn.getAttribute('data-ctx') || '';
      ejecutarEnShell(cmd, [], target, `Contexto cargado: ${ctx}`);
    });
  });

  const btnsIa = container.querySelectorAll('.btn-ejecutar-ia');
  btnsIa.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd') || 'bug';
      const target = btn.getAttribute('data-target') || 'shell-bug-output';
      const prompt = btn.getAttribute('data-prompt') || '';
      ejecutarEnShell(cmd, [], target, prompt);
    });
  });
}

function actualizarMetricasVisuales(st) {
  if (!st) return;

  // KPI Historias
  const kpiHistorias = document.getElementById('kpi-historias');
  if (kpiHistorias) {
    const waves = st.sprint?.waves || [];
    const totalStories = waves.flat().length || 14;
    kpiHistorias.textContent = String(totalStories);
  }

  // KPI Épicas
  const kpiEpicas = document.getElementById('kpi-epicas');
  if (kpiEpicas) {
    const totalEpicas = st.epics?.all?.length || 15;
    kpiEpicas.textContent = String(totalEpicas);
  }

  // KPI Salud
  const kpiSalud = document.getElementById('kpi-salud');
  if (kpiSalud) {
    const checks = st.doctor?.checks || [];
    if (checks.length > 0) {
      const okChecks = checks.filter((c) => c.ok !== false).length;
      const pct = Math.round((okChecks / checks.length) * 100);
      kpiSalud.textContent = `${pct}%`;
      kpiSalud.style.color = pct > 80 ? 'var(--accent-green)' : 'var(--accent-amber)';
    }
  }

  // Chips Doctor
  const chipsCont = document.getElementById('doctor-checks-chips');
  if (chipsCont && Array.isArray(st.doctor?.checks)) {
    chipsCont.innerHTML = '';
    for (const c of st.doctor.checks) {
      const chip = document.createElement('span');
      const isWarn = c.warning === true;
      const isOk = c.ok !== false;
      chip.className = `chip-check ${isWarn ? 'warn' : isOk ? 'ok' : 'fail'}`;
      chip.textContent = `${isWarn ? '⚠' : isOk ? '✓' : '✗'} ${c.name || 'check'}`;
      if (c.detail) chip.title = c.detail;
      chipsCont.appendChild(chip);
    }
  }
}

// ---------------------------------------------------------------------------
// Cambio de proyecto <100ms sin recarga
// ---------------------------------------------------------------------------
async function cambiarProyecto(proyecto) {
  const id = typeof proyecto === 'string' ? proyecto : proyecto?.id;
  if (!id) return 0;
  const inicio = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

  estado.proyectoActivoId = id;
  guardarActivoLocal(id);

  try {
    if (terminalDrawer) {
      if (typeof terminalDrawer.setProject === 'function') terminalDrawer.setProject(id);
      else if (typeof terminalDrawer.cambiarProyecto === 'function') terminalDrawer.cambiarProyecto(id);
    }
  } catch {}

  const nombreEl = document.getElementById('proyecto-activo-nombre');
  if (nombreEl) {
    const nombre = typeof proyecto === 'object' && proyecto.name ? proyecto.name : id;
    nombreEl.textContent = nombre;
  }

  persistirActivoServidor(id).catch(() => {});

  try {
    const [estadoData, diagrama] = await Promise.all([
      cargarEstado(id).catch(() => null),
      cargarDiagrama(id).catch(() => ''),
    ]);
    estado.estadoActual = estadoData;
    estado.diagramaMarkup = diagrama;

    const contenedor = document.getElementById('tablero-control');
    renderTablero(contenedor, estadoData, diagrama);

    renderTodosLosDiagramas();
    renderListaBugs();
    renderListaCambios();
    actualizarMetricasVisuales(estadoData);
  } catch (err) {
    const contenedor = document.getElementById('tablero-control');
    if (contenedor) {
      const detalle = document.getElementById('sprint-detalle');
      if (detalle) detalle.textContent = `Error al cargar proyecto: ${err.message}`;
    }
  }

  const fin = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  return fin - inicio;
}

// ---------------------------------------------------------------------------
// SSE — pulso verde y reconexión con backoff 1s→5s
// ---------------------------------------------------------------------------
function conectarSSE() {
  desconectarSSE();

  if (typeof window.EventSource !== 'undefined') {
    try {
      const es = new EventSource(getApiUrl('/api/events'));
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
              const activo = estado.proyectoActivoId;
              cargarDiagrama(activo).then((markup) => {
                estado.diagramaMarkup = markup;
                cargarEstado(activo).then((st) => {
                  estado.estadoActual = st;
                  const cont = document.getElementById('tablero-control');
                  try { renderTablero(cont, st, markup); } catch {}
                  actualizarMetricasVisuales(st);
                  renderTodosLosDiagramas();
                }).catch(() => {});
              }).catch(() => {
                cambiarProyecto(activo);
              });
            }
          }
        } catch {
          if (estado.proyectoActivoId) {
            cambiarProyecto(estado.proyectoActivoId);
          }
        }
      };

      es.addEventListener('FS_CHANGE', handleFSChange);
      es.addEventListener('PROJECT_SYNC', handleFSChange);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'FS_CHANGE' || data.type === 'PROJECT_SYNC') {
            if (!data.projectId || data.projectId === estado.proyectoActivoId) {
              if (estado.proyectoActivoId) {
                cambiarProyecto(estado.proyectoActivoId);
              }
            }
          }
        } catch {}
      };

      setTimeout(() => {
        if (sse === es && es.readyState === 1) actualizarPulso(true);
      }, 500);

      return;
    } catch {}
  }

  conectarSSEFetch();
}

async function conectarSSEFetch() {
  try {
    const res = await fetch(getApiUrl('/api/events'), {
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        actualizarPulso(false);
        programarReconexion();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
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
        }
        if (evento === 'FS_CHANGE' || evento === 'PROJECT_SYNC') {
          if (estado.proyectoActivoId) {
            cambiarProyecto(estado.proyectoActivoId);
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

  // Conectar SSE inmediatamente para reflejar conexion viva
  conectarSSE();

  // Inicializar Tema (Claro por defecto)
  inicializarTema();

  // Navegación de Vistas por Proyecto
  const navBtns = document.querySelectorAll('.nav-vista-btn');
  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const vista = btn.getAttribute('data-vista');
      if (vista) cambiarVista(vista);
    });
  });

  // Configurar pestañas del Hub de Diagramas
  const botonesPestanas = document.querySelectorAll('.pestana-btn');
  botonesPestanas.forEach((btn) => {
    btn.addEventListener('click', () => {
      botonesPestanas.forEach((b) => b.classList.remove('activa'));
      btn.classList.add('activa');
      const tipo = btn.getAttribute('data-diagram') || 'flujo-datos';
      estado.tipoDiagramaSeleccionado = tipo;
      renderDiagramaSeleccionado();
    });
  });

  // Selector específico de épica
  const selectEpica = document.getElementById('select-epica-diagrama');
  if (selectEpica) {
    selectEpica.addEventListener('change', (e) => {
      estado.epicaDiagramaSeleccionada = e.target.value;
      renderDiagramaSeleccionado();
    });
  }

  // Configurar Wizard de Nuevo Proyecto
  renderWizardFRItems();
  renderWizardNFRItems();

  const btnAddFR = document.getElementById('btn-agregar-fr');
  if (btnAddFR) {
    btnAddFR.addEventListener('click', () => {
      const nextNum = estado.wizard.fr.length + 1;
      estado.wizard.fr.push({
        id: `FR-${String(nextNum).padStart(3, '0')}`,
        title: '',
        desc: 'El sistema DEBE ',
        priority: 'Must',
      });
      renderWizardFRItems();
    });
  }

  const btnAddNFR = document.getElementById('btn-agregar-nfr');
  if (btnAddNFR) {
    btnAddNFR.addEventListener('click', () => {
      const nextNum = estado.wizard.nfr.length + 1;
      estado.wizard.nfr.push({
        id: `NFR-${String(nextNum).padStart(3, '0')}`,
        title: '',
        desc: '',
        priority: 'Must',
      });
      renderWizardNFRItems();
    });
  }

  const btnWizAnt = document.getElementById('btn-wizard-anterior');
  if (btnWizAnt) {
    btnWizAnt.addEventListener('click', () => irAPasoWizard(estado.wizard.paso - 1));
  }
  const btnWizSig = document.getElementById('btn-wizard-siguiente');
  if (btnWizSig) {
    btnWizSig.addEventListener('click', () => irAPasoWizard(estado.wizard.paso + 1));
  }

  const stepperItems = document.querySelectorAll('.stepper-item');
  stepperItems.forEach((stItem) => {
    stItem.addEventListener('click', () => {
      const p = Number(stItem.getAttribute('data-step'));
      irAPasoWizard(p);
    });
  });

  const tabPrevBrief = document.getElementById('tab-preview-brief');
  const tabPrevPRD = document.getElementById('tab-preview-prd');
  if (tabPrevBrief && tabPrevPRD) {
    tabPrevBrief.addEventListener('click', () => {
      tabPrevBrief.classList.add('activa');
      tabPrevPRD.classList.remove('activa');
      estado.wizard.tabPreview = 'brief';
      compilarPreviewWizard();
    });
    tabPrevPRD.addEventListener('click', () => {
      tabPrevPRD.classList.add('activa');
      tabPrevBrief.classList.remove('activa');
      estado.wizard.tabPreview = 'prd';
      compilarPreviewWizard();
    });
  }

  const btnWizCrear = document.getElementById('btn-wizard-crear');
  if (btnWizCrear) {
    btnWizCrear.addEventListener('click', ejecutarCreacionProyectoWizard);
  }

  // Clic en chequeos de Doctor para inspeccionar elemento
  const checksDoctor = document.querySelectorAll('.item-chequeo[data-check]');
  checksDoctor.forEach((item) => {
    item.addEventListener('click', () => {
      const chk = item.getAttribute('data-check') || 'node';
      estado.elementoSeleccionado.doctor = chk;
      const eDoc = document.getElementById('diagrama-elemento-doctor');
      if (eDoc) eDoc.innerHTML = renderDoctorElementSvg(chk, estado.tema || 'claro');
    });
  });

  // Botón cambiar proyecto abre Quick Switcher
  const boton = document.getElementById('boton-cambiar-proyecto');
  if (boton) {
    boton.addEventListener('click', () => {
      if (quickSwitcher) quickSwitcher.mostrar();
    });
  }

  // Botón Auto-Reparar Salud (En Dashboard)
  const btnRepararSalud = document.getElementById('btn-reparar-salud');
  if (btnRepararSalud) {
    btnRepararSalud.addEventListener('click', () => {
      cambiarVista('doctor');
      ejecutarEnShell('doctor', ['--fix'], 'shell-doctor-output', 'Reparando salud del proyecto...');
    });
  }

  // Botones Página Doctor
  const btnEjecutarDoctor = document.getElementById('btn-ejecutar-doctor');
  if (btnEjecutarDoctor) {
    btnEjecutarDoctor.addEventListener('click', () => {
      ejecutarEnShell('doctor', [], 'shell-doctor-output');
    });
  }
  const btnRepararTodo = document.getElementById('btn-reparar-todo');
  if (btnRepararTodo) {
    btnRepararTodo.addEventListener('click', () => {
      ejecutarEnShell('doctor', ['--fix'], 'shell-doctor-output', 'Reparando salud del proyecto...');
    });
  }

  // Botones Página Sprint
  const btnCalcularSprint = document.getElementById('btn-calcular-sprint');
  if (btnCalcularSprint) {
    btnCalcularSprint.addEventListener('click', () => {
      ejecutarEnShell('sprint', [], 'shell-sprint-output');
    });
  }

  // Botones Página Sync
  const btnEjecutarSync = document.getElementById('btn-ejecutar-sync');
  if (btnEjecutarSync) {
    btnEjecutarSync.addEventListener('click', () => {
      ejecutarEnShell('sync', [], 'shell-sync-output');
    });
  }

  // Botones Página Build
  const btnEjecutarBuild = document.getElementById('btn-ejecutar-build');
  if (btnEjecutarBuild) {
    btnEjecutarBuild.addEventListener('click', () => {
      ejecutarEnShell('build', [], 'shell-build-output');
    });
  }

  // Botones Página Tickets
  const btnClasificarTicket = document.getElementById('btn-clasificar-ticket');
  if (btnClasificarTicket) {
    btnClasificarTicket.addEventListener('click', () => {
      ejecutarEnShell('ticket', [], 'shell-ticket-output');
    });
  }

  // Botones Página Adopt
  const btnEjecutarAdopt = document.getElementById('btn-ejecutar-adopt');
  if (btnEjecutarAdopt) {
    btnEjecutarAdopt.addEventListener('click', () => {
      ejecutarEnShell('adopt', [], 'shell-adopt-output');
    });
  }

  // Botones Limpiar Shell
  const btnsLimpiar = document.querySelectorAll('.btn-limpiar-shell');
  btnsLimpiar.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) el.textContent = '';
      }
    });
  });

  // Modal Nuevo Bug
  const btnNuevoBug = document.getElementById('btn-nuevo-bug');
  const modalBug = document.getElementById('modal-nuevo-bug');
  const btnCerrarBug = document.getElementById('btn-cerrar-modal-bug');
  const btnCancelarBug = document.getElementById('btn-cancelar-bug');
  const formBug = document.getElementById('form-nuevo-bug');

  if (btnNuevoBug && modalBug) {
    btnNuevoBug.addEventListener('click', () => modalBug.classList.remove('oculto'));
  }
  if (btnCerrarBug && modalBug) {
    btnCerrarBug.addEventListener('click', () => modalBug.classList.add('oculto'));
  }
  if (btnCancelarBug && modalBug) {
    btnCancelarBug.addEventListener('click', () => modalBug.classList.add('oculto'));
  }
  if (formBug && modalBug) {
    formBug.addEventListener('submit', (e) => {
      e.preventDefault();
      const tit = document.getElementById('input-bug-titulo')?.value || 'Defecto';
      const desc = document.getElementById('input-bug-desc')?.value || '';
      const nuevoBug = {
        id: `bug-${Date.now()}`,
        titulo: tit,
        descripcion: desc,
        estado: 'activo',
        fecha: new Date().toISOString().slice(0, 10),
      };
      estado.bugs.unshift(nuevoBug);
      estado.elementoSeleccionado.bug = tit;
      renderListaBugs();
      renderTodosLosDiagramas();
      modalBug.classList.add('oculto');
      formBug.reset();
      ejecutarEnShell('bug', [], 'shell-bug-output', `Resolver automáticamente el defecto: ${tit}. Contexto: ${desc}`);
    });
  }

  // Modal Nuevo Cambio
  const btnNuevoCambio = document.getElementById('btn-nuevo-cambio');
  const modalCambio = document.getElementById('modal-nuevo-cambio');
  const btnCerrarCambio = document.getElementById('btn-cerrar-modal-cambio');
  const btnCancelarCambio = document.getElementById('btn-cancelar-cambio');
  const formCambio = document.getElementById('form-nuevo-cambio');

  if (btnNuevoCambio && modalCambio) {
    btnNuevoCambio.addEventListener('click', () => modalCambio.classList.remove('oculto'));
  }
  if (btnCerrarCambio && modalCambio) {
    btnCerrarCambio.addEventListener('click', () => modalCambio.classList.add('oculto'));
  }
  if (btnCancelarCambio && modalCambio) {
    btnCancelarCambio.addEventListener('click', () => modalCambio.classList.add('oculto'));
  }
  if (formCambio && modalCambio) {
    formCambio.addEventListener('submit', (e) => {
      e.preventDefault();
      const tit = document.getElementById('input-cambio-titulo')?.value || 'Cambio';
      const desc = document.getElementById('input-cambio-desc')?.value || '';
      const nuevoCambio = {
        id: `chg-${Date.now()}`,
        titulo: tit,
        descripcion: desc,
        estado: 'propuesto',
        fecha: new Date().toISOString().slice(0, 10),
      };
      estado.cambios.unshift(nuevoCambio);
      estado.elementoSeleccionado.change = tit;
      renderListaCambios();
      renderTodosLosDiagramas();
      modalCambio.classList.add('oculto');
      formCambio.reset();
      ejecutarEnShell('change', [], 'shell-change-output', `Proponer e implementar cambio con OpenSpec: ${tit}. Especificaciones: ${desc}`);
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
  const activoServidor = datosProyectos.activeProjectId || null;
  const activoLocal = cargarActivoLocal();
  let activoId = activoServidor || activoLocal || (estado.proyectos[0] ? estado.proyectos[0].id : null);
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

  // Inicializar Terminal Drawer (compatibilidad con tests)
  try {
    const drawerEl = document.getElementById('terminal-drawer');
    terminalDrawer = createTerminalDrawer(drawerEl || '#terminal-drawer', {
      getProjectId: () => estado.proyectoActivoId,
      projectId: estado.proyectoActivoId,
      usePiAgent: true,
    });
    if (estado.proyectoActivoId && terminalDrawer && typeof terminalDrawer.setProject === 'function') {
      try { terminalDrawer.setProject(estado.proyectoActivoId); } catch {}
    }

    // Botón flotante FAB y botón de cabecera para abrir/cerrar terminal
    const btnFab = document.getElementById('btn-terminal-fab');
    if (btnFab) {
      btnFab.addEventListener('click', () => {
        if (terminalDrawer && typeof terminalDrawer.alternar === 'function') {
          terminalDrawer.alternar();
        }
      });
    }
    const btnToggleTerm = document.getElementById('boton-toggle-terminal');
    if (btnToggleTerm) {
      btnToggleTerm.addEventListener('click', () => {
        if (terminalDrawer && typeof terminalDrawer.alternar === 'function') {
          terminalDrawer.alternar();
        }
      });
    }

    // Botones rápidos de la barra de sesiones (Story 6.3)
    const btnNuevaPi = document.getElementById('btn-sesion-nueva-pi');
    if (btnNuevaPi) {
      btnNuevaPi.addEventListener('click', () => {
        if (terminalDrawer && typeof terminalDrawer.ejecutar === 'function') {
          terminalDrawer.abrir();
          terminalDrawer.ejecutar('pi', estado.proyectoActivoId, []);
        }
      });
    }
    const btnContinuarPi = document.getElementById('btn-sesion-continuar-pi');
    if (btnContinuarPi) {
      btnContinuarPi.addEventListener('click', () => {
        if (terminalDrawer && typeof terminalDrawer.ejecutar === 'function') {
          terminalDrawer.abrir();
          terminalDrawer.ejecutar('pi', estado.proyectoActivoId, ['-c']);
        }
      });
    }
    const btnReanudarPi = document.getElementById('btn-sesion-reanudar-pi');
    if (btnReanudarPi) {
      btnReanudarPi.addEventListener('click', () => {
        if (terminalDrawer && typeof terminalDrawer.ejecutar === 'function') {
          terminalDrawer.abrir();
          terminalDrawer.ejecutar('pi', estado.proyectoActivoId, ['-r']);
        }
      });
    }
  } catch {}

  // Cargar estado/diagrama del activo si existe
  if (estado.proyectoActivoId) {
    await cambiarProyecto(estado.proyectoActivoId);
  } else {
    const contenedor = document.getElementById('tablero-control');
    renderTablero(contenedor, null, '');
    renderTodosLosDiagramas();
    renderListaBugs();
    renderListaCambios();
  }

  window.addEventListener('beforeunload', () => {
    desconectarSSE();
  });

  window.__dashboardEstado = estado;
  window.__dashboardCambiarProyecto = cambiarProyecto;
  window.__dashboardCambiarVista = cambiarVista;
  window.__dashboardConectarSSE = conectarSSE;
  window.__dashboardFiltrar = filtrarProyectos;
  window.__dashboardEjecutar = (cmd, args) => {
    if (terminalDrawer && typeof terminalDrawer.ejecutar === 'function') {
      terminalDrawer.abrir();
      return terminalDrawer.ejecutar(cmd, estado.proyectoActivoId, args);
    }
    return ejecutarEnShell(cmd, args, 'shell-doctor-output');
  };
  window.__terminalDrawer = terminalDrawer;
  window.__wizardIrAPaso = irAPasoWizard;
  window.__wizardCrearProyecto = ejecutarCreacionProyectoWizard;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}

export {
  estado,
  cargarProyectos,
  cargarEstado,
  cargarDiagrama,
  cambiarProyecto,
  cambiarVista,
  ejecutarEnShell,
  actualizarPulso,
  conectarSSE,
  desconectarSSE,
  programarReconexion,
  filtrarProyectos,
  guardarActivoLocal,
  cargarActivoLocal,
  terminalDrawer,
  renderDiagramaSeleccionado,
  renderTodosLosDiagramas,
  irAPasoWizard,
  compilarPreviewWizard,
  ejecutarCreacionProyectoWizard,
};
