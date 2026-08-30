/**
 * Archify Bridge — mapper y render en memoria (Story 3.1)
 *
 * Invariants:
 * - AD-01: nunca cambiar directorio global, projectPath explicito (sin chdir)
 * - AD-07: markup encapsulado .archify-*
 * - ESM estricto, sin spawn, sin temporales, import() dinamico
 *
 * Exports: compileDiagram(projectPath, state?), mapStateToWorkflow(state), mapStateToLifecycle(state)
 *
 * Esquemas Archify (architecture.md#4.3):
 * - workflow: { nodes: [{id, label, status}], edges: [{from, to}], meta }
 * - lifecycle: { phases: [{name, status, items}], currentPhase }
 *
 * Renderer resolution: workflow preferido, fallback lifecycle
 * - <projectPath>/archify/renderers/workflow/render-workflow.mjs
 * - <repoRoot>/archify/renderers/workflow/render-workflow.mjs
 * - <projectPath>/archify/renderers/lifecycle/render-lifecycle.mjs
 * - <repoRoot>/archify/renderers/lifecycle/render-lifecycle.mjs
 * Si ninguno existe o lanza → placeholder degradado sin 500
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Helpers — normalizacion de estado
// ---------------------------------------------------------------------------

/**
 * Extrae lista plana de epics/stories del estado consolidado.
 * Soporta multiples formas que han existido en state-adapter / tests:
 * - state.epics.all = [{id, title, status}]
 * - state.epics.byStatus = { pendiente: [], en_progreso: [], completada: [] }
 * - state.epics = [] (array directo)
 * - state.epics = { all: [] } sin byStatus
 * - state.changes como fallback
 */
function normalizeEpics(state) {
  if (!state || typeof state !== 'object') return [];

  // 1) array directo
  if (Array.isArray(state.epics)) {
    return state.epics.slice();
  }

  // 2) epics.all
  if (state.epics && Array.isArray(state.epics.all) && state.epics.all.length > 0) {
    return state.epics.all.slice();
  }

  // 3) byStatus
  if (state.epics && state.epics.byStatus && typeof state.epics.byStatus === 'object') {
    const out = [];
    const seen = new Set();
    for (const key of ['completada', 'en_progreso', 'en-progreso', 'pendiente', 'pending', 'doing', 'done']) {
      const arr = state.epics.byStatus[key];
      if (Array.isArray(arr)) {
        for (const e of arr) {
          const id = e.id || e.epicId || e.story || e.title || JSON.stringify(e);
          if (seen.has(id)) continue;
          seen.add(id);
          // Inferir status si no viene explícito
          const inferred = e.status || (key === 'completada' || key === 'done' ? 'completada' : key === 'en_progreso' || key === 'en-progreso' || key === 'doing' ? 'en_progreso' : 'pendiente');
          out.push({ ...e, status: e.status || inferred });
        }
      }
    }
    // Include any extra keys in byStatus not covered above
    for (const [k, arr] of Object.entries(state.epics.byStatus)) {
      if (['completada', 'en_progreso', 'en-progreso', 'pendiente', 'pending', 'doing', 'done'].includes(k)) continue;
      if (Array.isArray(arr)) {
        for (const e of arr) {
          const id = e.id || e.title || JSON.stringify(e);
          if (seen.has(id)) continue;
          seen.add(id);
          out.push({ ...e, status: e.status || 'pendiente' });
        }
      }
    }
    if (out.length > 0) return out;
  }

  // 4) epics as object with all empty but maybe state.changes contains epics?
  // 5) fallback: state.changes or state.stories
  if (Array.isArray(state.changes) && state.changes.length > 0) {
    // changes no son epics pero si no hay epics, crear nodos a partir de changes
    // para no devolver workflow vacío
    return state.changes.map((c, i) => ({
      id: c.id || c.changeId || `change-${i}`,
      title: c.title || c.name || `Change ${i + 1}`,
      status: c.status || 'pendiente',
    }));
  }

  // 6) epics as plain object with numeric keys?
  if (state.epics && typeof state.epics === 'object' && !Array.isArray(state.epics.all)) {
    // If epics itself looks like an epic object? unlikely
  }

  return [];
}

function normalizeSprint(state) {
  if (!state || typeof state !== 'object') return { active: null, planned: [] };
  const s = state.sprint;
  if (!s || typeof s !== 'object') return { active: null, planned: [] };
  // Various shapes: { active, planned }, { activeStory, wave }, { current, next }
  const active = s.active ?? s.activeStory ?? s.current ?? null;
  const planned = Array.isArray(s.planned) ? s.planned : Array.isArray(s.waves) ? s.waves.flat() : [];
  return { active, planned, raw: s };
}

function epicStatusToWorkflow(statusRaw) {
  const s = String(statusRaw || '').toLowerCase().trim();
  if (['completada', 'completed', 'done', 'closed', 'finished'].includes(s)) return 'done';
  if (['en_progreso', 'en-progreso', 'en progreso', 'doing', 'in_progress', 'in-progress', 'active', 'progress'].includes(s)) return 'doing';
  return 'pending';
}

function epicStatusToGroup(statusRaw) {
  const s = String(statusRaw || '').toLowerCase().trim();
  if (['completada', 'completed', 'done', 'closed'].includes(s)) return 'completada';
  if (['en_progreso', 'en-progreso', 'en progreso', 'doing', 'in_progress', 'active'].includes(s)) return 'en_progreso';
  return 'pendiente';
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Mapea estado consolidado → JSON Archify workflow
 * @param {object|null} state
 * @returns {{nodes: Array<{id:string,label:string,status:string}>, edges: Array<{from:string,to:string}>, meta: object}}
 */
export function mapStateToWorkflow(state) {
  const epics = normalizeEpics(state);
  const { active } = normalizeSprint(state);

  const nodes = epics.map((e, idx) => {
    const raw = e.status || e.state || e.phase || '';
    // Prefer explicit status, else infer from position? but use mapping
    const status = epicStatusToWorkflow(raw);
    return {
      id: String(e.id || e.epicId || e.story || `epic-${idx + 1}`),
      label: String(e.title || e.name || e.label || `Epic ${idx + 1}`),
      status,
    };
  });

  // Si no hay epics, generar al menos placeholder node para que el esquema sea valido?
  // Mejor dejar nodes vacío si realmente no hay datos — el render debe manejarlo.
  // Pero para tests de vacío, debe seguir siendo valido (nodes puede ser [])
  // No inventar nodos si no hay input.

  const edges = [];
  if (nodes.length > 1) {
    // Construir edges: si hay sprint activo, vincular segun orden; si no, secuencial neutral
    // Intentar usar active para dar sentido a currentPhase, pero edges siempre secuenciales para esquema valido
    // Si active indica un epic, podríamos ordenar edges alrededor de el, pero secuencial simple cumple contrato.
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
    }
  }

  return {
    nodes,
    edges,
    meta: {
      totalEpics: nodes.length,
      sprintActive: !!active,
      activeId: active ? String(active.id || active.story || active.storyId || active.epicId || '') : null,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Mapea estado consolidado → JSON Archify lifecycle
 * @param {object|null} state
 * @returns {{phases: Array<{name:string,status:string,items:Array<string>}>, currentPhase: string, meta: object}}
 */
export function mapStateToLifecycle(state) {
  const epics = normalizeEpics(state);
  const { active } = normalizeSprint(state);

  const groups = { pendiente: [], en_progreso: [], completada: [] };
  for (const e of epics) {
    const g = epicStatusToGroup(e.status || e.state || '');
    groups[g].push(e);
  }

  const phases = [
    { name: 'backlog', status: groups.pendiente.length ? 'pending' : 'empty', items: groups.pendiente.map((e) => String(e.title || e.name || e.id)) },
    { name: 'doing', status: groups.en_progreso.length ? 'active' : 'empty', items: groups.en_progreso.map((e) => String(e.title || e.name || e.id)) },
    { name: 'done', status: groups.completada.length ? 'done' : 'empty', items: groups.completada.map((e) => String(e.title || e.name || e.id)) },
  ];

  let currentPhase = 'backlog';
  if (active) {
    const activeId = String(active.id || active.story || active.storyId || active.epicId || '').trim();
    const activeEpic = activeId ? epics.find((e) => String(e.id || '') === activeId) : null;
    if (activeEpic) {
      const g = epicStatusToGroup(activeEpic.status);
      if (g === 'en_progreso') currentPhase = 'doing';
      else if (g === 'completada') currentPhase = 'done';
      else currentPhase = 'backlog';
    } else {
      // No se pudo resolver por id: usar heuristica por distribucion
      if (groups.en_progreso.length > 0) currentPhase = 'doing';
      else if (groups.pendiente.length === 0 && groups.completada.length > 0) currentPhase = 'done';
      else currentPhase = 'backlog';
    }
  } else {
    if (groups.en_progreso.length > 0) currentPhase = 'doing';
    else if (groups.pendiente.length === 0 && groups.completada.length > 0) currentPhase = 'done';
    else currentPhase = 'backlog';
  }

  return {
    phases,
    currentPhase,
    meta: {
      totalEpics: epics.length,
      sprintActive: !!active,
    },
  };
}

// ---------------------------------------------------------------------------
// Placeholder degradado
// ---------------------------------------------------------------------------

function buildPlaceholder(state) {
  const epics = normalizeEpics(state);
  const { active } = normalizeSprint(state);
  const count = epics.length;
  const hasActive = !!active;
  const sprintText = hasActive ? '1 sprint activo' : '0 sprints activos';
  // También soportar conteo de planned sprints si hay varios
  const sprintCountText = hasActive ? sprintText : `${Array.isArray(state?.sprint?.planned) ? state.sprint.planned.length : 0} sprints`;
  // Texto estable requerido por scenario 3: debe contener ej "3 épicas, 1 sprint activo"
  // Generamos ambos: con y sin conteo dinámico
  const primary = `${count} épicas, ${hasActive ? '1 sprint activo' : sprintText}`;
  // Encapsulado .archify-*
  return `<div class="archify-placeholder"><p>${primary}</p><span>${count} épicas</span><span>${hasActive ? '1 sprint activo' : sprintCountText}</span></div>`;
}

// ---------------------------------------------------------------------------
// Renderer discovery & dynamic import
// ---------------------------------------------------------------------------

function buildCandidates(projectPath) {
  const roots = [];
  if (typeof projectPath === 'string' && projectPath.trim() !== '') {
    try {
      roots.push(path.resolve(projectPath));
    } catch {}
  }
  // Repo root always as fallback (donde estaría archify/ si existe)
  roots.push(REPO_ROOT);
  // Dedup
  const uniqRoots = [...new Set(roots)];

  const ordered = [];
  // Preferencia: todos los workflow primero, luego lifecycle
  for (const r of uniqRoots) {
    ordered.push({ type: 'workflow', file: path.join(r, 'archify/renderers/workflow/render-workflow.mjs') });
  }
  for (const r of uniqRoots) {
    ordered.push({ type: 'lifecycle', file: path.join(r, 'archify/renderers/lifecycle/render-lifecycle.mjs') });
  }
  return ordered;
}

async function tryImportRenderer(filePath) {
  const url = pathToFileURL(filePath).href;
  // Import dinámico en memoria — sin spawn, sin temporales
  const mod = await import(url);
  // Resolver función de render soportando varias firmas
  let fn = null;
  if (typeof mod.default === 'function') fn = mod.default;
  else if (typeof mod.renderWorkflow === 'function') fn = mod.renderWorkflow;
  else if (typeof mod.renderLifecycle === 'function') fn = mod.renderLifecycle;
  else if (typeof mod.render === 'function') fn = mod.render;
  else {
    // Buscar cualquier export función
    for (const v of Object.values(mod)) {
      if (typeof v === 'function') {
        fn = v;
        break;
      }
      if (v && typeof v.render === 'function') {
        fn = v.render;
        break;
      }
    }
  }
  if (typeof fn !== 'function') {
    throw new Error(`Renderer ${filePath} no exporta función de render`);
  }
  return fn;
}

async function loadConsolidatedState(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    return { epics: { all: [], byStatus: { pendiente: [], en_progreso: [], completada: [] } }, sprint: { active: null, planned: [] }, project: { path: '' } };
  }
  // Intentar cargar vía state-adapter dinámico si existe, sin chdir
  const adapterFile = path.join(__dirname, 'state-adapter.mjs');
  if (fs.existsSync(adapterFile)) {
    try {
      const mod = await import(pathToFileURL(adapterFile).href);
      // Preferir getConsolidatedState si recibe projectPath? pero el adapter espera id, no path
      // Por eso intentamos getEpicsState / getSprintState que sí aceptan projectPath
      if (typeof mod.getEpicsState === 'function') {
        const epics = await mod.getEpicsState(projectPath);
        const sprint = typeof mod.getSprintState === 'function' ? await mod.getSprintState(projectPath) : { active: null, planned: [] };
        const git = typeof mod.getGitState === 'function' ? await mod.getGitState(projectPath) : { branch: 'main', dirty: false, ahead: 0 };
        const doctor = typeof mod.getDoctorState === 'function' ? await mod.getDoctorState(projectPath) : { ok: true, checks: [] };
        const project = { path: path.resolve(projectPath), name: path.basename(path.resolve(projectPath)) };
        return { project, epics, sprint, git, doctor };
      }
      if (typeof mod.getConsolidatedState === 'function') {
        // Intentar pasar projectPath aunque espere id — si falla, capturamos
        try {
          const state = await mod.getConsolidatedState(projectPath);
          if (state && state.epics) return state;
        } catch {}
      }
    } catch {}
  }
  // Fallback vacío — no crashear
  return {
    project: { path: path.resolve(projectPath), name: path.basename(path.resolve(projectPath)) },
    epics: { all: [], byStatus: { pendiente: [], en_progreso: [], completada: [] } },
    sprint: { active: null, planned: [] },
    git: { branch: 'main', dirty: false, ahead: 0 },
    doctor: { ok: true, checks: [] },
  };
}

// ---------------------------------------------------------------------------
// Public API — compileDiagram
// ---------------------------------------------------------------------------

/**
 * Compila estado consolidado a markup Archify en memoria.
 * @param {string} projectPath - ruta absoluta del proyecto (no usa chdir)
 * @param {object} [state] - estado consolidado opcional; si es null se intenta cargar
 * @returns {Promise<{markup:string, type:"workflow"|"lifecycle", degraded:boolean, json?:object}>}
 */
export async function compileDiagram(projectPath, state) {
  let effectiveState = state;
  // Si no se proporciona estado, intentar cargarlo (sin crashear)
  if (effectiveState == null) {
    try {
      effectiveState = await loadConsolidatedState(projectPath);
    } catch {
      effectiveState = { epics: { all: [], byStatus: { pendiente: [], en_progreso: [], completada: [] } }, sprint: { active: null, planned: [] } };
    }
  }
  // Asegurar objeto
  if (typeof effectiveState !== 'object' || effectiveState === null) {
    effectiveState = { epics: { all: [], byStatus: { pendiente: [], en_progreso: [], completada: [] } }, sprint: { active: null, planned: [] } };
  }

  const workflowJson = mapStateToWorkflow(effectiveState);
  const lifecycleJson = mapStateToLifecycle(effectiveState);

  const candidates = buildCandidates(projectPath);

  for (const cand of candidates) {
    if (!fs.existsSync(cand.file)) continue;
    try {
      const fn = await tryImportRenderer(cand.file);
      const input = cand.type === 'workflow' ? workflowJson : lifecycleJson;
      const out = await fn(input);
      let markup = null;
      if (typeof out === 'string') markup = out;
      else if (out && typeof out.markup === 'string') markup = out.markup;
      else if (out && typeof out.html === 'string') markup = out.html;
      else if (out && typeof out.svg === 'string') markup = out.svg;
      if (typeof markup === 'string' && markup.trim().length > 0) {
        return { markup, type: cand.type, degraded: false, json: input };
      }
      // Si renderer retornó string vacío, continuar a siguiente candidato / degradado
    } catch {
      // Renderer lanzó o import falló → probar siguiente o caer a degradado
      continue;
    }
  }

  // Degradado — sin 500
  return {
    markup: buildPlaceholder(effectiveState),
    type: 'workflow',
    degraded: true,
    json: workflowJson,
  };
}

// Re-export helper for testing / introspection
export function _buildCandidatesForTests(projectPath) {
  return buildCandidates(projectPath);
}
export function _buildPlaceholderForTests(state) {
  return buildPlaceholder(state);
}
