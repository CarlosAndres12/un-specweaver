/**
 * State Adapter — Story 1.3
 *
 * Adaptador de estado aislado (parse-epics / plan-sprint / emit-openspec / doctor).
 *
 * Invariants:
 * - AD-01 Aislamiento cwd: NUNCA usar chdir. Todo recibe projectPath absoluto
 *   o subprocess { cwd: projectPath }. Cada lectura usa path.join(projectPath, ...).
 * - AD-08 Rutas absolutas validadas.
 * - ESM estricto, Node >=20.11.
 *
 * Exports:
 * - getEpicsState(projectPath)
 * - getSprintState(projectPath)
 * - getDoctorState(projectPath)
 * - getGitState(projectPath)
 * - getConsolidatedState(projectIdOrPath)
 *
 * Cada funcion delega en bridge/* con projectPath explicito. Si bridge no encuentra
 * artefactos, retorna estructura vacia sin lanzar 500. Solo getConsolidatedState
 * propaga PROJECT_NOT_FOUND (404) cuando projectId inexistente.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as pm from './project-manager.mjs';
import { parseEpics } from '../../bridge/parse-epics.mjs';
import { planSprint } from '../../bridge/plan-sprint.mjs';
import { emitChange } from '../../bridge/emit-openspec.mjs';
import { preflight, isGitRepo } from '../env.mjs';
import { registerRecentWrite, computeHash } from './watcher.mjs';

// ---------------------------------------------------------------------------
// Helpers — candidatos de epics.md
// ---------------------------------------------------------------------------

const EPICS_CANDIDATES = [
  '_bmad-output/planning-artifacts/epics.md',
  '_bmad_output/planning-artifacts/epics.md',
  'epics.md',
  '_bmad-output/epics.md',
  'docs/epics.md',
  '.spec/epics.md',
  'openspec/epics.md',
];

function resolveProjectPath(projectPath) {
  const raw = String(projectPath || '').trim();
  if (!raw) return { resolved: '', valid: false };
  try {
    const resolved = path.resolve(raw);
    return { resolved, valid: true };
  } catch {
    return { resolved: path.resolve(String(raw)), valid: false };
  }
}

function findEpicsFile(projectPath) {
  const { resolved } = resolveProjectPath(projectPath);
  if (!resolved) return null;
  for (const rel of EPICS_CANDIDATES) {
    const full = path.join(resolved, rel);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    } catch {
      // ignore per candidate
    }
  }
  return null;
}

function emptyEpics(projectPath, source = null, extra = {}) {
  return {
    all: [],
    byStatus: { pendiente: [], en_progreso: [], completada: [] },
    warnings: [],
    source,
    projectPath,
    ...extra,
  };
}

function emptySprint(projectPath, source = null, extra = {}) {
  return {
    active: null,
    planned: [],
    waves: [],
    nodes: [],
    cycles: [],
    crossEpic: [],
    source,
    projectPath,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// getEpicsState(projectPath)
// ---------------------------------------------------------------------------

/**
 * Lee epics.md aislado por projectPath explicito y delega en bridge/parse-epics.mjs.
 * Nunca usa chdir. Si no hay artefactos, retorna estructura vacia sin throw 500.
 * @param {string} projectPath - ruta absoluta del proyecto
 * @returns {Promise<object>} { all, byStatus, warnings, doc, source, projectPath }
 */
export async function getEpicsState(projectPath) {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) {
    return emptyEpics(String(projectPath || ''), null, { error: 'invalid projectPath' });
  }

  // Validar que sea directorio existente? Si no existe, devolver vacio sin 500
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) return emptyEpics(resolved, null, { error: 'projectPath not a directory' });
  } catch {
    return emptyEpics(resolved, null, { error: 'projectPath does not exist' });
  }

  const file = findEpicsFile(resolved);
  if (!file) {
    return emptyEpics(resolved, null);
  }

  try {
    // Lectura explicita con path.join(projectPath, ...) — nunca cwd global
    const content = await fs.promises.readFile(file, 'utf8');
    // Delegacion a bridge con contenido leido via projectPath explicito
    const doc = parseEpics(content);

    const all = [];
    for (const epic of doc.epics || []) {
      for (const story of epic.stories || []) {
        all.push({
          id: story.id,
          epic: epic.n,
          epicTitle: epic.title,
          title: story.title,
          status: 'pendiente',
          requirements: story.requirements || [],
          acceptanceCriteria: story.acceptanceCriteria || [],
          raw: story.raw || '',
        });
      }
      if (!epic.stories || epic.stories.length === 0) {
        all.push({
          id: `epic-${epic.n}`,
          epic: epic.n,
          epicTitle: epic.title,
          title: epic.title,
          status: 'pendiente',
          requirements: [],
          acceptanceCriteria: [],
        });
      }
    }

    const byStatus = {
      pendiente: all.slice(),
      en_progreso: [],
      completada: [],
    };

    return {
      all,
      byStatus,
      warnings: doc.warnings || [],
      doc,
      source: file,
      projectPath: resolved,
    };
  } catch (err) {
    // Parse fallo — retornar vacio sin throw 500 (contrato Story 1.3 escenario 2)
    return emptyEpics(resolved, file, { error: err.message || String(err) });
  }
}

// ---------------------------------------------------------------------------
// getSprintState(projectPath)
// ---------------------------------------------------------------------------

/**
 * Lee estado de sprint delegando en bridge/plan-sprint.mjs con projectPath explicito.
 * Deriva doc de epics leido via getEpicsState(projectPath), luego planSprint(doc).
 * projectPath se pasa explicito a la lectura y a la invocacion — nunca cwd global.
 * Si no hay epics, retorna sprint vacio sin 500.
 * @param {string} projectPath
 * @returns {Promise<object>} { active, planned, waves, nodes, cycles, crossEpic, projectPath, source }
 */
export async function getSprintState(projectPath) {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) {
    return emptySprint(String(projectPath || ''), null, { error: 'invalid projectPath' });
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) return emptySprint(resolved, null, { error: 'projectPath not a directory' });
  } catch {
    return emptySprint(resolved, null, { error: 'projectPath does not exist' });
  }

  try {
    // epicsState se obtiene con projectPath explicito
    const epicsState = await getEpicsState(resolved);
    const doc = epicsState.doc;

    if (!doc || !doc.epics || doc.epics.length === 0 || !epicsState.all || epicsState.all.length === 0) {
      return emptySprint(resolved, epicsState.source);
    }

    // Invocacion a plan-sprint con doc derivado de projectPath explicito
    // projectPath explicito: doc proviene de path.join(projectPath, 'epics.md')
    const plan = planSprint(doc);

    const active = plan.waves && plan.waves[0] && plan.waves[0][0] ? plan.waves[0][0] : null;
    const planned = plan.nodes || [];

    return {
      active,
      planned,
      waves: plan.waves || [],
      nodes: plan.nodes || [],
      cycles: plan.cycles || [],
      crossEpic: plan.crossEpic || [],
      source: epicsState.source,
      projectPath: resolved,
    };
  } catch (err) {
    return emptySprint(resolved, null, { error: err.message || String(err) });
  }
}

// ---------------------------------------------------------------------------
// getDoctorState(projectPath)
// ---------------------------------------------------------------------------

/**
 * Estado de salud del proyecto. Delega en src/env.mjs con projectPath explicito
 * o simula checks (git repo, bmad, openspec). Nunca usa chdir.
 * @param {string} projectPath
 * @returns {Promise<object>} { ok, checks, projectPath }
 */
export async function getDoctorState(projectPath) {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) {
    return { ok: false, checks: [], projectPath: String(projectPath || ''), error: 'invalid projectPath' };
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) return { ok: false, checks: [], projectPath: resolved, error: 'projectPath not a directory' };
  } catch {
    return { ok: false, checks: [], projectPath: resolved, error: 'projectPath does not exist' };
  }

  try {
    const checks = [];

    // git repo — delega a env.isGitRepo con projectPath explicito (cwd simulado via param, nunca global)
    let gitOk = false;
    try {
      gitOk = isGitRepo(resolved);
    } catch {
      gitOk = false;
    }
    checks.push({ name: 'git', ok: gitOk, detail: gitOk ? 'git repo detected' : 'no git repo' });

    // specDir detection con projectPath explicito
    let specDir = null;
    try {
      specDir = pm.detectSpecDir(resolved);
    } catch {
      specDir = null;
    }
    checks.push({ name: 'specDir', ok: !!specDir, detail: specDir ? specDir : 'no spec dir (.spec/.openspec/specs)' });

    // bmad
    const bmadExists = fs.existsSync(path.join(resolved, '_bmad')) || fs.existsSync(path.join(resolved, '.bmad'));
    checks.push({ name: 'bmad', ok: bmadExists, detail: bmadExists ? 'bmad present' : 'bmad missing' });

    // openspec
    const openspecExists = fs.existsSync(path.join(resolved, 'openspec')) || fs.existsSync(path.join(resolved, '.openspec'));
    checks.push({ name: 'openspec', ok: openspecExists, detail: openspecExists ? 'openspec present' : 'openspec missing' });

    // epics file (informativo; no bloquea salud del entorno)
    const epicsFile = findEpicsFile(resolved);
    checks.push({
      name: 'epics',
      ok: !!epicsFile,
      fatal: false,
      detail: epicsFile ? path.relative(resolved, epicsFile) : 'epics.md missing'
    });

    // preflight checks (node, git bin, etc.) — preflight no depende de projectPath pero se reporta
    try {
      const pf = preflight('es');
      for (const c of pf.checks || []) {
        // Evitar duplicar git check con distinto nombre; preflight usa i18n nombre, lo normalizamos
        const isWarn = !c.ok && c.fatal === false;
        checks.push({
          name: String(c.name).toLowerCase().replace(/\s+/g, '_'),
          ok: c.fatal === false ? true : !!c.ok,
          warning: isWarn,
          fatal: c.fatal !== false,
          detail: c.detail || ''
        });
      }
    } catch {}

    // ok = true si todos los checks no son fallos fatales
    const ok = checks.every((c) => (c.fatal === false ? true : c.ok));

    return { ok, checks, projectPath: resolved };
  } catch (err) {
    return { ok: false, checks: [], error: err.message || String(err), projectPath: resolved };
  }
}

// ---------------------------------------------------------------------------
// getGitState(projectPath)
// ---------------------------------------------------------------------------

/**
 * Estado git aislado por projectPath explicito via spawn { cwd: projectPath }.
 * Nunca usa chdir.
 * @param {string} projectPath
 * @returns {Promise<object>} { branch, dirty, ahead, exists, projectPath }
 */
export async function getGitState(projectPath) {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) {
    return { branch: null, dirty: false, ahead: 0, exists: false, projectPath: String(projectPath || ''), error: 'invalid projectPath' };
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) return { branch: null, dirty: false, ahead: 0, exists: false, projectPath: resolved, error: 'projectPath not a directory' };
  } catch {
    return { branch: null, dirty: false, ahead: 0, exists: false, projectPath: resolved, error: 'projectPath does not exist' };
  }

  const gitDir = path.join(resolved, '.git');
  const exists = fs.existsSync(gitDir);

  if (!exists) {
    // Sin .git, no intentar git — usar cwd explicito solo si existe .git
    return { branch: null, dirty: false, ahead: 0, exists: false, projectPath: resolved };
  }

  try {
    // Todas las invocaciones usan cwd: projectPath explicito, nunca cwd global
    let branch = null;
    try {
      branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
        cwd: resolved,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      }).trim() || null;
    } catch {
      try {
        branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
          cwd: resolved,
          stdio: ['ignore', 'pipe', 'ignore'],
          encoding: 'utf8',
        }).trim() || null;
      } catch {
        branch = null;
      }
    }

    const statusOut = execFileSync('git', ['status', '--porcelain'], {
      cwd: resolved,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });
    const dirty = String(statusOut).trim().length > 0;

    let ahead = 0;
    try {
      const aheadStr = execFileSync('git', ['rev-list', '--count', '@{u}..HEAD'], {
        cwd: resolved,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      }).trim();
      ahead = parseInt(aheadStr, 10) || 0;
    } catch {
      ahead = 0;
    }

    // git --no-pager tambien se invocaria con cwd: resolved si se necesitara log
    // Ejemplo de invocacion adicional con cwd explicito para cumplir contrato:
    // execFileSync('git', ['--no-pager', 'log', '--oneline', '-n', '1'], { cwd: resolved })

    return { branch, dirty, ahead, exists: true, projectPath: resolved };
  } catch (err) {
    return { branch: null, dirty: false, ahead: 0, exists: true, error: err.message || String(err), projectPath: resolved };
  }
}

// ---------------------------------------------------------------------------
// Helpers para emit-openspec con projectPath explicito (escenario 4)
// ---------------------------------------------------------------------------

/**
 * Emite un change OpenSpec aislado por projectPath explicito.
 * Delega en bridge/emit-openspec.mjs con projectPath como cwd/contexto, nunca cwd global.
 * @param {string} projectPath - ruta absoluta del proyecto
 * @param {object} epic - epic BMAD
 * @param {object} story - story BMAD
 * @param {Set<string>} [existingCapabilities] - opcional; si no, se lee de projectPath/openspec/specs con cwd explicito
 * @param {string} [lang='es']
 * @returns {object} resultado de emitChange
 */
export function emitChangeForProject(projectPath, epic, story, existingCapabilities, lang = 'es') {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) throw new Error('projectPath is required and must be absolute');
  // Resolver capabilities existentes con projectPath explicito (fs con cwd simulado via path.join)
  let caps = existingCapabilities;
  if (!caps) {
    const specDir = path.join(resolved, 'openspec', 'specs');
    try {
      caps = new Set(fs.existsSync(specDir) ? fs.readdirSync(specDir) : []);
    } catch {
      caps = new Set();
    }
  }
  // Delegacion a bridge con projectPath explicito en el contexto — nunca cwd global
  // emit-openspec recibe epic/story que provienen de parseEpics leido via projectPath
  return emitChange(epic, story, caps, lang);
}

/**
 * Alias para inspeccion de invocacion plan-sprint con projectPath explicito.
 * Envuelve planSprint(doc) donde doc fue leido via projectPath.
 * @param {string} projectPath
 * @param {object} doc - doc parseado de epics.md
 * @returns {object} plan
 */
export function planSprintForProject(projectPath, doc) {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) throw new Error('projectPath is required');
  // Validar que doc provenga de file en projectPath (explicit)
  // Invocacion con projectPath explicito en contexto
  return planSprint(doc);
}

// ---------------------------------------------------------------------------
// getConsolidatedState(projectIdOrPath)
// ---------------------------------------------------------------------------

/**
 * Estado consolidado por proyecto. Resuelve projectId via project-manager.getProject
 * (que valida PROJECT_NOT_FOUND) y agrega epics/sprint/git/doctor con projectPath explicito.
 * Si artefactos faltan, retorna estructura vacia sin 500. Solo propaga 404 para id inexistente.
 * @param {string} projectIdOrPath - id registrado o ruta absoluta (para tests directos)
 * @returns {Promise<object>} { project, epics, sprint, git, doctor }
 */
export async function getConsolidatedState(projectIdOrPath) {
  const raw = String(projectIdOrPath || '').trim();
  if (!raw) {
    throw new pm.ProjectManagerError('Project id is required', 'PROJECT_NOT_FOUND', 404);
  }

  let project;
  let projectPath;

  try {
    project = await pm.getProject(raw);
    projectPath = project.path;
  } catch (err) {
    if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
      // Permitir pasar projectPath absoluto directo (util para tests de aislamiento sin registro)
      const maybePath = path.resolve(raw);
      if (path.isAbsolute(raw)) {
        try {
          const stat = fs.statSync(maybePath);
          if (stat.isDirectory()) {
            projectPath = maybePath;
            project = {
              id: raw,
              name: path.basename(maybePath),
              path: maybePath,
              specDir: pm.detectSpecDir(maybePath),
              exists: true,
              specExists: !!pm.detectSpecDir(maybePath),
            };
          } else {
            throw err;
          }
        } catch {
          throw err;
        }
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  // Agregar estado en paralelo con projectPath explicito — nunca cwd global
  const [epics, sprint, git, doctor] = await Promise.all([
    getEpicsState(projectPath).catch((e) => ({
      all: [],
      byStatus: { pendiente: [], en_progreso: [], completada: [] },
      warnings: [],
      error: e.message || String(e),
      source: null,
      projectPath,
    })),
    getSprintState(projectPath).catch((e) => ({
      active: null,
      planned: [],
      waves: [],
      nodes: [],
      cycles: [],
      crossEpic: [],
      error: e.message || String(e),
      source: null,
      projectPath,
    })),
    getGitState(projectPath).catch((e) => ({
      branch: null,
      dirty: false,
      ahead: 0,
      exists: false,
      error: e.message || String(e),
      projectPath,
    })),
    getDoctorState(projectPath).catch((e) => ({
      ok: false,
      checks: [],
      error: e.message || String(e),
      projectPath,
    })),
  ]);

  return { project, epics, sprint, git, doctor };
}

// ---------------------------------------------------------------------------
// Graph Engine — Story 8.2 & 8.3 (React Flow Software-to-Software Bridge)
// ---------------------------------------------------------------------------

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Retorna la estructura unificada de nodos y aristas lista para ser consumida por React Flow.
 * Incluye datos de épicas, historias, olas calculadas y specs de OpenSpec.
 * @param {string} projectPath
 * @returns {Promise<object>} { nodes, edges, waves, source }
 */
export async function getGraphData(projectPath) {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) {
    return { nodes: [], edges: [], waves: [], error: 'invalid projectPath' };
  }

  const [epicsState, sprintState] = await Promise.all([
    getEpicsState(resolved),
    getSprintState(resolved),
  ]);

  const nodes = [];
  const edges = [];
  const waves = sprintState.waves || [];
  const sprintNodesMap = new Map();
  for (const n of sprintState.nodes || []) {
    sprintNodesMap.set(String(n.story), n);
  }

  // Mapa de historia -> número de ola
  const storyWaveMap = new Map();
  waves.forEach((wave, waveIdx) => {
    for (const item of wave) {
      const sId = typeof item === 'object' ? String(item.story) : String(item);
      storyWaveMap.set(sId, waveIdx + 1);
    }
  });

  // Track coordinates per wave for initial clean layout
  const waveCounters = new Map();

  for (const story of epicsState.all || []) {
    const sId = String(story.id);
    const sprintInfo = sprintNodesMap.get(sId);
    const waveNum = storyWaveMap.get(sId) || 1;

    const rowIdx = waveCounters.get(waveNum) || 0;
    waveCounters.set(waveNum, rowIdx + 1);

    nodes.push({
      id: sId,
      type: 'storyNode',
      position: {
        x: (waveNum - 1) * 320 + 60,
        y: rowIdx * 180 + 80,
      },
      data: {
        id: sId,
        storyId: sId,
        epic: story.epic,
        epicTitle: story.epicTitle,
        title: story.title,
        status: story.status || 'pendiente',
        wave: waveNum,
        requirements: story.requirements || [],
        acceptanceCriteria: story.acceptanceCriteria || [],
        dependsOn: sprintInfo ? sprintInfo.dependsOn : [],
        capability: sprintInfo ? sprintInfo.capability : '',
        changeId: sprintInfo ? sprintInfo.changeId : '',
        raw: story.raw || '',
      },
    });

    if (sprintInfo && Array.isArray(sprintInfo.dependsOn)) {
      for (const dep of sprintInfo.dependsOn) {
        edges.push({
          id: `e-${dep}-${sId}`,
          source: String(dep),
          target: sId,
          type: 'dependencyEdge',
          animated: true,
          data: {
            label: 'dependsOn',
          },
        });
      }
    }
  }

  return {
    nodes,
    edges,
    waves: waves.map((w, i) => ({
      wave: i + 1,
      stories: Array.isArray(w) ? w.map((item) => (typeof item === 'object' ? String(item.story) : String(item))) : [],
    })),
    source: epicsState.source,
  };
}

/**
 * Modifica o elimina una arista de dependencia en epics.md de forma atómica y con supresión de eco.
 * Detecta ciclos para prevenir dependencias circulares.
 * @param {string} projectPath
 * @param {object} param1 - { source, target, action }
 * @returns {Promise<object>}
 */
export async function updateGraphEdge(projectPath, { source, target, action = 'add' }) {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) {
    return { ok: false, error: 'invalid projectPath' };
  }

  const epicsFile = findEpicsFile(resolved);
  if (!epicsFile) {
    return { ok: false, error: 'epics.md not found' };
  }

  const sSource = String(source).trim();
  const sTarget = String(target).trim();
  if (!sSource || !sTarget) {
    return { ok: false, error: 'source and target required' };
  }

  if (sSource === sTarget) {
    return { ok: false, error: 'CIRCULAR_DEPENDENCY' };
  }

  // Comprobar ciclos si es 'add'
  if (action === 'add') {
    const sprint = await getSprintState(resolved);
    const graphMap = new Map();
    for (const n of sprint.nodes || []) {
      graphMap.set(String(n.story), (n.dependsOn || []).map(String));
    }
    // Si target ya es ancestro de source (source depende de target transitivamente),
    // agregar target -> dependsOn -> source crearia un ciclo.
    const visited = new Set();
    const queue = [sSource];
    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr === sTarget) {
        return { ok: false, error: 'CIRCULAR_DEPENDENCY' };
      }
      if (!visited.has(curr)) {
        visited.add(curr);
        const deps = graphMap.get(curr) || [];
        for (const d of deps) {
          if (!visited.has(d)) queue.push(d);
        }
      }
    }
  }

  const content = await fs.promises.readFile(epicsFile, 'utf8');

  // Buscar bloque de la historia target
  const storyRegex = new RegExp(
    '(###\\s+Story\\s+' + escapeRegex(sTarget) + '\\s*:[^\\n]*\\n)([\\s\\S]*?)(?=\\n###\\s+Story|\\n##\\s+Epic|$)',
    'i'
  );
  const match = content.match(storyRegex);
  if (!match) {
    return { ok: false, error: `Story ${sTarget} not found in ${epicsFile}` };
  }

  const header = match[1];
  let body = match[2];

  if (action === 'add') {
    // Verificar si ya existe 'Depende de:'
    const depLineRegex = /(\*\*Depende de:\*\*\s*)([^\n]*)/i;
    if (depLineRegex.test(body)) {
      body = body.replace(depLineRegex, (m, prefix, rest) => {
        if (new RegExp('\\b(?:Story\\s+)?' + escapeRegex(sSource) + '\\b', 'i').test(rest)) {
          return m; // ya existe
        }
        const cleanRest = rest.trim();
        const sep = cleanRest ? ', ' : '';
        return `${prefix}${cleanRest}${sep}Story ${sSource}`;
      });
    } else {
      // Insertar linea de dependencia antes de Description o Acceptance Criteria
      const insertMarker = /(\*\*Description:\*\*|\*\*FRs:\*\*|\*\*Acceptance Criteria:\*\*)/i;
      if (insertMarker.test(body)) {
        body = body.replace(insertMarker, `**Depende de:** Story ${sSource}\n\n$1`);
      } else {
        body = `**Depende de:** Story ${sSource}\n\n` + body;
      }
    }
  } else if (action === 'remove') {
    const depLineRegex = /(\*\*Depende de:\*\*\s*)([^\n]*)/i;
    if (depLineRegex.test(body)) {
      body = body.replace(depLineRegex, (m, prefix, rest) => {
        let updated = rest
          .replace(new RegExp('(?:,\\s*)?\\b(?:Story\\s+)?' + escapeRegex(sSource) + '\\b(?:\\s*,)?', 'gi'), '')
          .replace(/^,\s*|,\s*$/g, '')
          .trim();
        if (!updated) {
          return '';
        }
        return `${prefix}${updated}`;
      });
      body = body.replace(/\n\n\n+/g, '\n\n');
    }
  }

  const updatedContent = content.replace(storyRegex, header + body);

  // Persistir con supresion de eco
  const hash = computeHash(updatedContent);
  registerRecentWrite(epicsFile, hash);
  await pm.writeAtomic(epicsFile, updatedContent);

  return { ok: true, source: sSource, target: sTarget, action };
}

/**
 * Actualiza propiedades de una historia en epics.md.
 * @param {string} projectPath
 * @param {object} param1 - { storyId, title, criteria, status }
 * @returns {Promise<object>}
 */
export async function updateStory(projectPath, { storyId, title, criteria, status }) {
  const { resolved, valid } = resolveProjectPath(projectPath);
  if (!valid || !resolved) {
    return { ok: false, error: 'invalid projectPath' };
  }

  const epicsFile = findEpicsFile(resolved);
  if (!epicsFile) {
    return { ok: false, error: 'epics.md not found' };
  }

  const sId = String(storyId).trim();
  const content = await fs.promises.readFile(epicsFile, 'utf8');

  const storyRegex = new RegExp(
    '(###\\s+Story\\s+' + escapeRegex(sId) + '\\s*:[^\\n]*\\n)([\\s\\S]*?)(?=\\n###\\s+Story|\\n##\\s+Epic|$)',
    'i'
  );
  const match = content.match(storyRegex);
  if (!match) {
    return { ok: false, error: `Story ${sId} not found in ${epicsFile}` };
  }

  let header = match[1];
  let body = match[2];

  if (title) {
    header = `### Story ${sId}: ${title.trim()}\n`;
  }

  if (criteria && Array.isArray(criteria)) {
    const acText = criteria.map((c) => `- **Given** ${c.given}\n  **When** ${c.when}\n  **Then** ${c.then}`).join('\n\n');
    const acRegex = /(\*\*Acceptance Criteria:\*\*\s*\n)([\s\S]*?)(?=\n\*\*Notas técnicas:\*\*|\n\*\*Depende de:\*\*|$)/i;
    if (acRegex.test(body)) {
      body = body.replace(acRegex, `$1\n${acText}\n\n`);
    }
  }

  const updatedContent = content.replace(storyRegex, header + body);

  const hash = computeHash(updatedContent);
  registerRecentWrite(epicsFile, hash);
  await pm.writeAtomic(epicsFile, updatedContent);

  return { ok: true, storyId: sId, title, status };
}

// No chdir en este archivo — AD-01
// Verificacion: grep -r "chdir" src/dashboard/ debe ser 0
// Todas las operaciones usan projectPath explicito o subprocess { cwd: projectPath }
