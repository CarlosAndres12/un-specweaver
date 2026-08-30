/**
 * Tablero de control — render de sprint, épicas por estado y salud del proyecto.
 * ESM estricto, 100% español técnico.
 *
 * Se espera estado consolidado de GET /api/projects/:id/state:
 * {
 *   project: { id, name, path },
 *   epics: { all: [], byStatus: { pendiente: [], en_progreso: [], completada: [] } },
 *   sprint: { active, planned },
 *   doctor: { ok, checks },
 *   git: { branch, dirty }
 * }
 */

import { renderArchify } from './visor-archify.mjs';

/**
 * Normaliza épicas a grupos por estado español.
 * Soporta byStatus con claves en español y all.
 * @param {object|null} estado
 * @returns {{pendiente: Array, en_progreso: Array, completada: Array, todas: Array}}
 */
export function agruparEpicas(estado) {
  const grupos = { pendiente: [], en_progreso: [], completada: [], todas: [] };
  if (!estado || typeof estado !== 'object') return grupos;

  const epics = estado.epics;
  if (!epics) return grupos;

  // Caso 1: epics.all es array principal
  if (Array.isArray(epics.all) && epics.all.length > 0) {
    for (const e of epics.all) {
      const g = clasificarEstado(e.status || e.state || e.estado || '');
      grupos[g].push(e);
      grupos.todas.push(e);
    }
    // Si también hay byStatus, priorizamos all ya procesado pero aseguramos que no duplicamos conteos
    // Para evitar doble conteo, retornamos directamente
    // Pero si byStatus tiene más, no los ignoramos si all estaba vacío — ya manejado
    return grupos;
  }

  // Caso 2: epics.byStatus
  if (epics.byStatus && typeof epics.byStatus === 'object') {
    const mapeo = {
      pendiente: ['pendiente', 'pending', 'todo'],
      en_progreso: ['en_progreso', 'en-progreso', 'en progreso', 'doing', 'in_progress', 'active'],
      completada: ['completada', 'completed', 'done', 'finished', 'closed'],
    };
    const visitadas = new Set();
    for (const [grupoEsp, claves] of Object.entries(mapeo)) {
      for (const clave of claves) {
        const arr = epics.byStatus[clave];
        if (Array.isArray(arr)) {
          for (const e of arr) {
            const id = e.id || e.title || e.name || JSON.stringify(e);
            if (visitadas.has(id)) continue;
            visitadas.add(id);
            // Asegurar status coherente para render
            const statusOriginal = e.status || e.state || '';
            const grupoReal = clasificarEstado(statusOriginal || grupoEsp);
            // Si el statusOriginal es vacío, usar grupoEsp inferido
            const destino = statusOriginal ? grupoReal : grupoEsp;
            grupos[destino].push({ ...e, _grupo: destino });
            grupos.todas.push(e);
          }
        }
      }
    }
    // Claves no mapeadas directamente: tratar como pendiente
    for (const [clave, arr] of Object.entries(epics.byStatus)) {
      const yaMapeada = Object.values(mapeo).flat().includes(clave);
      if (yaMapeada) continue;
      if (Array.isArray(arr)) {
        for (const e of arr) {
          const id = e.id || e.title || JSON.stringify(e);
          if (visitadas.has(id)) continue;
          visitadas.add(id);
          grupos.pendiente.push(e);
          grupos.todas.push(e);
        }
      }
    }
    return grupos;
  }

  // Caso 3: epics como array directo
  if (Array.isArray(epics)) {
    for (const e of epics) {
      const g = clasificarEstado(e.status || '');
      grupos[g].push(e);
      grupos.todas.push(e);
    }
    return grupos;
  }

  return grupos;
}

function clasificarEstado(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (['completada', 'completed', 'done', 'finished', 'closed'].includes(s)) return 'completada';
  if (['en_progreso', 'en-progreso', 'en progreso', 'doing', 'in_progress', 'in-progress', 'active', 'progress'].includes(s)) return 'en_progreso';
  return 'pendiente';
}

/**
 * Renderiza tablero de control en contenedor dado.
 * @param {HTMLElement} contenedor - elemento raíz #tablero-control o document
 * @param {object|null} estado - estado consolidado
 * @param {string} diagramaMarkup - markup HTML/SVG del diagrama
 */
export function renderTablero(contenedor, estado, diagramaMarkup = '') {
  const root = contenedor || (typeof document !== 'undefined' ? document : null);
  if (!root) return;

  const q = (sel) => {
    // Intentar dentro de contenedor, fallback a document
    if (root.querySelector) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    if (typeof document !== 'undefined') return document.querySelector(sel);
    return null;
  };

  // --- Proyecto activo ---
  const nombreActivoEl = q('#proyecto-activo-nombre');
  if (nombreActivoEl && estado && estado.project) {
    nombreActivoEl.textContent = estado.project.name || estado.project.id || '—';
  }

  // --- Sprint actual ---
  const sprintDetalle = q('#sprint-detalle');
  if (sprintDetalle) {
    const sprint = estado?.sprint || {};
    const activo = sprint.active ?? sprint.activo ?? null;
    if (activo) {
      const titulo = activo.title || activo.name || activo.id || 'Sprint activo';
      const wave = activo.wave ? ` — Ola ${activo.wave}` : '';
      const estadoSprint = activo.status || activo.estado || 'En Progreso';
      sprintDetalle.textContent = `${titulo}${wave} · ${estadoSprint}`;
      sprintDetalle.title = JSON.stringify(activo, null, 2);
    } else if (Array.isArray(sprint.planned) && sprint.planned.length > 0) {
      sprintDetalle.textContent = `Sin sprint activo — ${sprint.planned.length} planificados`;
    } else {
      sprintDetalle.textContent = 'Sin sprint activo';
    }
  }

  // --- Épicas por estado ---
  const grupos = agruparEpicas(estado);

  const badgePendiente = q('#badge-pendiente');
  const badgeEnProgreso = q('#badge-en-progreso');
  const badgeCompletada = q('#badge-completada');
  if (badgePendiente) badgePendiente.textContent = String(grupos.pendiente.length);
  if (badgeEnProgreso) badgeEnProgreso.textContent = String(grupos.en_progreso.length);
  if (badgeCompletada) badgeCompletada.textContent = String(grupos.completada.length);

  const listaPendiente = q('#lista-pendiente');
  const listaEnProgreso = q('#lista-en-progreso');
  const listaCompletada = q('#lista-completada');

  function poblarLista(ul, items) {
    if (!ul) return;
    ul.innerHTML = '';
    if (items.length === 0) {
      const li = document.createElement('li');
      li.textContent = '—';
      li.style.color = '#94a3b8';
      ul.appendChild(li);
      return;
    }
    for (const e of items) {
      const li = document.createElement('li');
      li.textContent = e.title || e.name || e.id || 'Épica sin título';
      if (e.status) li.title = `Estado: ${e.status}`;
      ul.appendChild(li);
    }
  }

  poblarLista(listaPendiente, grupos.pendiente);
  poblarLista(listaEnProgreso, grupos.en_progreso);
  poblarLista(listaCompletada, grupos.completada);

  // --- Salud del proyecto ---
  const saludDetalle = q('#salud-detalle');
  if (saludDetalle) {
    const doctor = estado?.doctor;
    if (!doctor) {
      saludDetalle.textContent = 'Salud del proyecto: desconocida';
    } else if (doctor.ok === true || doctor.ok === 'true') {
      saludDetalle.textContent = 'Salud del proyecto: Saludable';
      saludDetalle.style.color = '#16a34a';
      if (Array.isArray(doctor.checks) && doctor.checks.length > 0) {
        const listaChecks = doctor.checks.map((c) => c.name || c.id || JSON.stringify(c)).join(', ');
        saludDetalle.title = listaChecks;
      }
    } else if (doctor.ok === false) {
      saludDetalle.textContent = 'Salud del proyecto: Con incidencias';
      saludDetalle.style.color = '#dc2626';
      if (Array.isArray(doctor.checks)) {
        const fallos = doctor.checks.filter((c) => c.ok === false || c.status === 'fail');
        if (fallos.length > 0) saludDetalle.title = fallos.map((c) => c.name || c.message || c.id).join(', ');
      }
    } else {
      saludDetalle.textContent = `Salud del proyecto: ${doctor.ok ? 'Saludable' : 'Revisar'}`;
    }
  }

  // --- Diagrama — via visor reactivo sin parpadeo (Story 3.2) ---
  const diagramaContenido = q('#diagrama-contenido');
  if (diagramaContenido) {
    if (typeof diagramaMarkup === 'string' && diagramaMarkup.trim().length > 0) {
      // Delegar a visor: diff/hash, preserva scroll, transicion opacity, CSS scoping / iframe srcdoc
      try {
        const updated = renderArchify(diagramaContenido, diagramaMarkup, { preserveScroll: true, transitionMs: 120 });
        // Si renderArchify decide no actualizar por diff igual, no tocar nada (sin parpadeo)
        if (!updated && !diagramaContenido.innerHTML) {
          // fallback inicial si contenedor vacio
          diagramaContenido.innerHTML = diagramaMarkup;
        }
      } catch {
        // fallback sin visor
        diagramaContenido.innerHTML = diagramaMarkup;
      }
    } else {
      // Placeholder encapsulado coherente con servidor (evitar contenido vacio)
      try {
        renderArchify(diagramaContenido, '<div class="archify-placeholder"><p>Diagrama no disponible</p></div>', { preserveScroll: true, immediate: true });
      } catch {
        diagramaContenido.innerHTML = '<div class="archify-container"><div class="archify-placeholder"><p>Diagrama no disponible</p></div></div>';
      }
    }
  }
}

// Alias en inglés para tests
export const renderBoard = renderTablero;

export default {
  agruparEpicas,
  renderTablero,
  renderBoard,
};
