/**
 * Project Manager — registro y listado de proyectos con persistencia atómica.
 *
 * Invariants respected:
 * - AD-02 Escritura atomica tmp+rename (writeAtomic)
 * - AD-08 Rutas absolutas validadas (path.isAbsolute + realpath + stat)
 * - AD-01 Aislamiento cwd: NUNCA usar chdir global, siempre path.resolve / realpath
 *
 * Storage: ~/.un-specweaver/projects.json via os.homedir()
 * Concurrency: lock en memoria (promise chain) + rename atómico.
 * Corruption recovery: backup .bak.<timestamp> y reset a {projects:[], activeProjectId:null}
 *
 * ESM strict, Node >=20.11, deps: node:fs, node:path, node:os, node:crypto
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const STORE_SUBDIR = '.un-specweaver';
const STORE_FILE = 'projects.json';

// ---------------------------------------------------------------------------
// Store paths — computed per call so tests can mock os.homedir() / HOME
// ---------------------------------------------------------------------------

export function getStoreDir() {
  return path.join(os.homedir(), STORE_SUBDIR);
}

export function getProjectsFilePath() {
  return path.join(getStoreDir(), STORE_FILE);
}

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export class ProjectManagerError extends Error {
  /**
   * @param {string} message
   * @param {string} code - DUPLICATE | INVALID_PATH | PROJECT_NOT_FOUND
   * @param {number} status - 400 | 404 | 409
   */
  constructor(message, code, status) {
    super(message);
    this.name = 'ProjectManagerError';
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// In-memory lock (promise chain)
// ---------------------------------------------------------------------------

let _writeLock = Promise.resolve();

/**
 * Serialize async fn through the in-memory lock.
 * @param {() => Promise<any>} fn
 */
export function withLock(fn) {
  const run = () => fn();
  const p = _writeLock.then(run, run);
  // keep chain alive even if p rejects
  _writeLock = p.catch(() => {});
  return p;
}

/** For tests: reset lock to idle. */
export function _resetLockForTests() {
  _writeLock = Promise.resolve();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureStoreDir() {
  fs.mkdirSync(getStoreDir(), { recursive: true });
}

/**
 * Detect spec directory inside projectPath.
 * Priority: .spec > .openspec > specs > null
 * @param {string} projectPath - absolute canonical path
 * @returns {string|null}
 */
export function detectSpecDir(projectPath) {
  try {
    const abs = path.resolve(projectPath);
    const candidates = ['.spec', '.openspec', 'specs'];
    for (const c of candidates) {
      const full = path.join(abs, c);
      try {
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return c;
      } catch {
        // ignore per candidate
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Canonicalize and validate a project path.
 * - Must be absolute (path.isAbsolute)
 * - Must exist and be a directory
 * - Returns realpath if possible, otherwise resolved absolute
 * @param {string} inputPath
 * @returns {string} canonical absolute path
 * @throws {ProjectManagerError} INVALID_PATH
 */
export function canonicalPath(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    throw new ProjectManagerError('Path must be a non-empty string', 'INVALID_PATH', 400);
  }
  const trimmed = inputPath.trim();
  if (!path.isAbsolute(trimmed)) {
    throw new ProjectManagerError(`Path must be absolute: ${trimmed}`, 'INVALID_PATH', 400);
  }
  const resolved = path.resolve(trimmed);
  // existence + directory check
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new ProjectManagerError(`Path is not a directory: ${resolved}`, 'INVALID_PATH', 400);
    }
  } catch (err) {
    if (err instanceof ProjectManagerError) throw err;
    throw new ProjectManagerError(`Path does not exist: ${resolved}`, 'INVALID_PATH', 400);
  }
  // symlink resolution
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function deriveName(canonical, explicitName) {
  if (typeof explicitName === 'string' && explicitName.trim() !== '') {
    return explicitName.trim();
  }
  return path.basename(canonical);
}

/**
 * Load store from disk.
 * - If file not exists -> default
 * - If empty file -> default
 * - If corrupt -> backup to .bak.<timestamp> and return default
 * @returns {{projects: Array, activeProjectId: string|null}}
 */
function loadStoreSync() {
  const filePath = getProjectsFilePath();
  if (!fs.existsSync(filePath)) {
    return { projects: [], activeProjectId: null };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return { projects: [], activeProjectId: null };
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.projects)) {
      throw new Error('Invalid store structure: projects must be array');
    }
    if (!('activeProjectId' in data)) data.activeProjectId = null;
    // normalize each project minimal validation (do not throw, just keep)
    return data;
  } catch (err) {
    // backup corrupt file (best effort)
    try {
      const bak = `${filePath}.bak.${Date.now()}`;
      fs.renameSync(filePath, bak);
    } catch {
      // if rename fails, try to unlink or ignore
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
    return { projects: [], activeProjectId: null };
  }
}

/**
 * Atomic write: tmp file + rename.
 * Ensures directory exists. Creates tmp in same dir.
 * @param {string} filePath - destination
 * @param {string|object} content - string or JSON-serializable
 */
export async function writeAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const tmp = `${filePath}.tmp.${crypto.randomUUID()}`;
  // Use promise API for async callers; fallback to sync rename atomicity still holds
  await fs.promises.writeFile(tmp, data, 'utf8');
  // Ensure tmp is flushed; rename is atomic on same filesystem
  await fs.promises.rename(tmp, filePath);
}

/**
 * Sync variant for internal use when already inside lock and caller is async.
 * Exposed for completeness but async variant is preferred.
 */
export function writeAtomicSync(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const tmp = `${filePath}.tmp.${crypto.randomUUID()}`;
  fs.writeFileSync(tmp, data, 'utf8');
  fs.renameSync(tmp, filePath);
}

async function saveStore(data) {
  ensureStoreDir();
  const content = JSON.stringify(data, null, 2);
  await writeAtomic(getProjectsFilePath(), content);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a project path.
 * - Validates absolute & exists
 * - Canonicalizes (realpath)
 * - Checks duplicate (409)
 * - Generates id UUID v4, derives name, detects specDir, timestamps
 * - Persists atomically via tmp+rename under memory lock
 * @param {string} inputPath - absolute path to repo/project
 * @param {string} [name] - optional display name
 * @returns {Promise<object>} created project
 * @throws {ProjectManagerError} INVALID_PATH (400) | DUPLICATE (409)
 */
export async function registerProject(inputPath, name) {
  const canonical = canonicalPath(inputPath);
  const derivedName = deriveName(canonical, name);

  return withLock(async () => {
    // Fresh load inside lock to avoid race
    const store = loadStoreSync();

    const duplicate = store.projects.find((p) => p.path === canonical);
    if (duplicate) {
      throw new ProjectManagerError(`Project already registered: ${canonical}`, 'DUPLICATE', 409);
    }

    const specDir = detectSpecDir(canonical);
    const now = new Date().toISOString();
    const project = {
      id: crypto.randomUUID(),
      name: derivedName,
      path: canonical,
      specDir,
      lastActive: now,
      createdAt: now,
    };

    store.projects.push(project);
    // Do not auto-set activeProjectId on register; keep existing value (null if first)
    await saveStore(store);
    return project;
  });
}

/**
 * Initialize a new project (init) or adopt an existing one.
 * - Validates absolute + exists (via canonicalPath) — throws INVALID_PATH 400.
 * - Detects existing specDir (.spec > .openspec > specs); if present, adopts (no mkdir/init).
 * - If no specDir, delegates to src/init.mjs init({ dir: projectPath, cwd: projectPath }) with explicit cwd (no chdir),
 *   then falls back to mkdir .spec if delegation fails or specDir still missing.
 * - Persists via registerProject (handles duplicate 409, lock, timestamps).
 * @param {string} inputPath - absolute path to repo/project
 * @param {string} [name] - optional display name
 * @returns {Promise<object>} created project
 * @throws {ProjectManagerError} INVALID_PATH (400) | DUPLICATE (409)
 */
export async function initProject(inputPath, name) {
  const canonical = canonicalPath(inputPath);

  // Early duplicate check (outside lock) to avoid unnecessary init side effects on duplicate
  {
    const store = loadStoreSync();
    if (store.projects.find((p) => p.path === canonical)) {
      throw new ProjectManagerError(`Project already registered: ${canonical}`, 'DUPLICATE', 409);
    }
  }

  const existingSpec = detectSpecDir(canonical);
  if (!existingSpec) {
    let delegatedOk = false;
    try {
      const initFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'init.mjs');
      if (fs.existsSync(initFile)) {
        const mod = await import('../init.mjs');
        if (typeof mod.init === 'function') {
          const originalIsTTY = process.stdin.isTTY;
          try {
            try {
              // Force non-interactive to avoid prompts blocking dashboard
              process.stdin.isTTY = false;
            } catch {}
            // Explicit cwd/dir — never use global directory change (AD-01)
            const result = await mod.init({ dir: canonical, cwd: canonical, yes: true, lang: 'es' });
            if (result === 0) delegatedOk = true;
          } catch {
            // delegation failed — fallback below
          } finally {
            try {
              process.stdin.isTTY = originalIsTTY;
            } catch {}
          }
        }
      }
    } catch {
      // import or init not available — fallback to mkdir
    }
    // Fallback: ensure .spec exists if delegation did not create a specDir
    try {
      const after = detectSpecDir(canonical);
      if (!after) {
        const specPath = path.join(canonical, '.spec');
        fs.mkdirSync(specPath, { recursive: true });
      }
    } catch {
      // mkdir failure will surface as project registration still proceeds; specDir will be null
    }
    // Silence unused warning for delegatedOk beyond fallback check
    void delegatedOk;
  }

  // Persist via registerProject (handles lock, duplicate race, timestamps, specDir detection)
  return registerProject(canonical, name);
}

/**
 * List projects enriched with live health.
 * Re-detects specDir and checks existence per project.
 * @returns {Promise<{projects: Array, activeProjectId: string|null}>}
 */
export async function listProjects() {
  // Reads are not locked; they race only if a write is in progress, but
  // loadStoreSync handles reading while locked writes will eventually be consistent.
  // For strict consistency we could also go through lock; not required for v1.
  const store = loadStoreSync();
  const enriched = store.projects.map((p) => {
    let exists = false;
    try {
      exists = fs.existsSync(p.path) && fs.statSync(p.path).isDirectory();
    } catch {
      exists = false;
    }
    const detected = exists ? detectSpecDir(p.path) : null;
    const specExists = detected !== null;
    // specDir: prefer live detection, fallback to persisted
    const specDir = detected ?? p.specDir ?? null;
    return { ...p, specDir, exists, specExists };
  });
  return { projects: enriched, activeProjectId: store.activeProjectId ?? null };
}

/**
 * Get a single project by id, enriched with health.
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {ProjectManagerError} PROJECT_NOT_FOUND (404)
 */
export async function getProject(id) {
  const store = loadStoreSync();
  const p = store.projects.find((x) => x.id === id);
  if (!p) {
    throw new ProjectManagerError(`Project not found: ${id}`, 'PROJECT_NOT_FOUND', 404);
  }
  let exists = false;
  try {
    exists = fs.existsSync(p.path) && fs.statSync(p.path).isDirectory();
  } catch {
    exists = false;
  }
  const detected = exists ? detectSpecDir(p.path) : null;
  const specExists = detected !== null;
  const specDir = detected ?? p.specDir ?? null;
  return { ...p, specDir, exists, specExists };
}

/**
 * Set active project. Persists atomically.
 * @param {string} id
 * @returns {Promise<{projects: Array, activeProjectId: string}>}
 * @throws {ProjectManagerError} PROJECT_NOT_FOUND
 */
export async function setActiveProject(id) {
  return withLock(async () => {
    const store = loadStoreSync();
    const proj = store.projects.find((p) => p.id === id);
    if (!proj) {
      throw new ProjectManagerError(`Project not found: ${id}`, 'PROJECT_NOT_FOUND', 404);
    }
    store.activeProjectId = id;
    proj.lastActive = new Date().toISOString();
    await saveStore(store);
    return { projects: store.projects, activeProjectId: id };
  });
}

/**
 * Touch lastActive for a project.
 * @param {string} id
 * @returns {Promise<object>} updated project
 * @throws {ProjectManagerError} PROJECT_NOT_FOUND
 */
export async function touchLastActive(id) {
  return withLock(async () => {
    const store = loadStoreSync();
    const proj = store.projects.find((p) => p.id === id);
    if (!proj) {
      throw new ProjectManagerError(`Project not found: ${id}`, 'PROJECT_NOT_FOUND', 404);
    }
    proj.lastActive = new Date().toISOString();
    await saveStore(store);
    return proj;
  });
}

// Note: No chdir anywhere - aislamiento por path absoluto (AD-01).
// If ~/.un-specweaver/projects.json is corrupt, we backup and reset (see loadStoreSync).
