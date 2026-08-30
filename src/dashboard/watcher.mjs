/**
 * Watcher filtrado con debounce 150 ms — Story 2.3
 *
 * Invariants:
 * - AD-03 Filtrado estricto: allowlist epics.md, epics.*.md, .spec/**, .openspec/**, specs/**; denylist .git/**, node_modules/**, dist/**, build/**, .turbo/**, .cache/**
 * - AD-04 Debounce 150 ms por projectId:file con Map key→timeout (coalesce rafagas)
 * - Multi-watcher: Map projectId → watcher instance, independencia total
 * - ESM estricto, Node >=20.11, sin cambio de directorio global, sin dependencias pesadas (fs.watch nativo)
 *
 * Exports:
 * - createWatcher(projectId, projectPath, onEvent, options?)
 * - closeWatcher(projectId)
 * - closeAllWatchers()
 * - getWatcher(projectId)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEBOUNCE_MS = 150;
export const ECHO_WINDOW_MS = 500;
export const recentWrites = new Map(); // absPath -> { hash, ts }

// Internal registries — module-level isolation per projectId
const _watchers = new Map(); // projectId -> record
const _debounceMaps = new Map(); // projectId -> Map<key, timeout>

// ---------------------------------------------------------------------------
// Allowlist / Denylist
// ---------------------------------------------------------------------------

function toPosix(p) {
  return String(p).split(path.sep).join('/').replace(/\\/g, '/');
}

function isDenied(relativePosix) {
  const p = relativePosix.replace(/^\.\//, '');
  if (p === '.git' || p.startsWith('.git/')) return true;
  if (p === 'node_modules' || p.startsWith('node_modules/')) return true;
  if (p === 'dist' || p.startsWith('dist/')) return true;
  if (p === 'build' || p.startsWith('build/')) return true;
  if (p === '.turbo' || p.startsWith('.turbo/')) return true;
  if (p === '.cache' || p.startsWith('.cache/')) return true;
  return false;
}

function isAllowed(relativePosix) {
  const p = relativePosix.replace(/^\.\//, '');
  if (!p) return false;

  // epics.md exact at root
  if (p === 'epics.md') return true;
  // epics.*.md at root — e.g. epics.foo.md, epics.123.md; not nested
  if (/^epics\.[^/]+\.md$/.test(p)) return true;

  // .spec/**, .openspec/**, specs/**
  if (p === '.spec' || p.startsWith('.spec/')) return true;
  if (p === '.openspec' || p.startsWith('.openspec/')) return true;
  if (p === 'specs' || p.startsWith('specs/')) return true;

  return false;
}

// Exported for testing / introspection (not required but useful)
export function _isDeniedForTests(p) {
  return isDenied(toPosix(p));
}
export function _isAllowedForTests(p) {
  return isAllowed(toPosix(p));
}

// ---------------------------------------------------------------------------
// Echo suppression — Story 2.4 (AD-05 Ventana de supresión de eco 500 ms)
// ---------------------------------------------------------------------------

export function computeHash(content) {
  return crypto.createHash('sha1').update(String(content)).digest('hex');
}

export function registerRecentWrite(absPath, hash, ts = Date.now()) {
  const key = path.resolve(absPath);
  recentWrites.set(key, { hash, ts });
  const t = setTimeout(() => {
    const e = recentWrites.get(key);
    if (e && e.ts === ts) recentWrites.delete(key);
  }, ECHO_WINDOW_MS + 50);
  if (typeof t.unref === 'function') t.unref();
  return { key, hash, ts };
}

export function clearRecentWrites() {
  recentWrites.clear();
}

export function shouldSuppress(absPath, opts = {}) {
  const map = opts.map || opts.recentWrites || recentWrites;
  const key = path.resolve(absPath);
  const entry = map.get(key);
  if (!entry) return false;
  const now = opts.now ?? Date.now();
  if (now - entry.ts >= ECHO_WINDOW_MS) {
    try { map.delete(key); } catch {}
    return false;
  }
  let currentHash = opts.currentHash ?? opts.hash;
  if (currentHash == null) {
    try {
      const content = fs.readFileSync(key, 'utf8');
      currentHash = crypto.createHash('sha1').update(content).digest('hex');
    } catch {
      return false;
    }
  }
  return currentHash === entry.hash;
}

// ---------------------------------------------------------------------------
// Debounce scheduler
// ---------------------------------------------------------------------------

function scheduleEvent(record, relativePosix) {
  const posix = toPosix(relativePosix).replace(/^\.\//, '');
  // Strict filter: denylist first, then allowlist
  if (isDenied(posix)) return;
  if (!isAllowed(posix)) return;

  const key = `${record.projectId}:${posix}`;
  const map = record.debounceMap;
  const existing = map.get(key);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    map.delete(key);
    if (record.closed) return;
    // Filter out directory events: if path is a directory, suppress (e.g. .spec, .spec/changes)
    try {
      const abs = path.join(record.projectPath, posix);
      const st = fs.statSync(abs);
      if (st.isDirectory()) return;
    } catch {
      // if stat fails (deleted/renamed), still emit — could be valid file event
    }
    // AD-05 Ventana de supresión de eco 500 ms (Web→FS sin loop) — Story 2.4
    // Suprime emisión si el archivo fue escrito vía Web hace <500ms y el hash coincide
    // Consulta tanto el map inyectado (por proyecto) como el global singleton
    try {
      const absPath = path.join(record.projectPath, posix);
      const canonical = path.resolve(absPath);
      const candidates = [];
      if (record.recentWrites) candidates.push(record.recentWrites);
      if (recentWrites) candidates.push(recentWrites);
      // Deduplicate same reference
      const seen = new Set();
      let suppressed = false;
      for (const m of candidates) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        const entry = m.get(canonical);
        if (!entry) continue;
        const now = Date.now();
        if (now - entry.ts >= ECHO_WINDOW_MS) {
          try { m.delete(canonical); } catch {}
          continue;
        }
        let currentHash = null;
        try {
          const content = fs.readFileSync(canonical, 'utf8');
          currentHash = crypto.createHash('sha1').update(content).digest('hex');
        } catch {
          continue;
        }
        if (currentHash === entry.hash) {
          suppressed = true;
          break;
        }
      }
      if (suppressed) return;
    } catch {
      // on suppression check failure, fall through to emit
    }
    const event = {
      type: 'FS_CHANGE',
      projectId: record.projectId,
      file: posix,
      timestamp: Date.now(),
    };
    try {
      record.onEvent(event);
    } catch {
      // swallow onEvent errors — do not crash watcher
    }
  }, record.debounceMs);

  // Do not keep process alive just because of debounce timer? Keep alive is okay for tests,
  // but allow exit if only this timer remains. Use unref so node can exit.
  if (typeof timeout.unref === 'function') timeout.unref();
  map.set(key, timeout);
}

// ---------------------------------------------------------------------------
// FS watcher factory with recursive fallback
// ---------------------------------------------------------------------------

function createFsWatcher(root, handler) {
  // Prefer recursive:true (Node >=20.11 supports it on Linux)
  try {
    const w = fs.watch(root, { recursive: true }, handler);
    // Attach error handler to avoid unhandled 'error'
    w.on('error', () => {});
    return w;
  } catch (err) {
    // Fallback: try without recursive — will still catch root-level files.
    // To improve coverage for nested allowlist dirs, also watch each existing
    // allowlist subdirectory individually if they exist.
    try {
      const w = fs.watch(root, handler);
      w.on('error', () => {});
      // Additionally watch allowlist subdirs that already exist
      const extraWatchers = [];
      for (const sub of ['.spec', '.openspec', 'specs']) {
        const subPath = path.join(root, sub);
        try {
          if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
            try {
              const sw = fs.watch(subPath, { recursive: true }, handler);
              sw.on('error', () => {});
              extraWatchers.push(sw);
            } catch {
              try {
                const sw2 = fs.watch(subPath, handler);
                sw2.on('error', () => {});
                extraWatchers.push(sw2);
              } catch {}
            }
          }
        } catch {}
      }
      // Patch close to also close extra watchers
      const origClose = w.close.bind(w);
      w.close = () => {
        try { origClose(); } catch {}
        for (const ew of extraWatchers) {
          try { ew.close(); } catch {}
        }
      };
      // Preserve extra watchers for close
      w._extraWatchers = extraWatchers;
      return w;
    } catch (e2) {
      throw e2;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a filtered, debounced watcher for a project.
 * @param {string} projectId - stable id (e.g. uuid or 'proj-1')
 * @param {string} projectPath - absolute path to project root
 * @param {(event:{type:string,projectId:string,file:string,timestamp:number})=>void} onEvent
 * @param {{debounceMs?:number, debounce?:number}} [options]
 * @returns {{projectId:string, projectPath:string, watcher:import('node:fs').FSWatcher, close:()=>boolean}}
 */
export function createWatcher(projectId, projectPath, onEvent, options = {}) {
  if (typeof projectId !== 'string' || !projectId.trim()) {
    throw new Error('projectId is required and must be a non-empty string');
  }
  if (typeof projectPath !== 'string' || !projectPath.trim()) {
    throw new Error('projectPath is required and must be a non-empty string');
  }
  if (typeof onEvent !== 'function') {
    throw new Error('onEvent is required and must be a function');
  }
  if (!path.isAbsolute(path.resolve(projectPath))) {
    // path.resolve will make it absolute, but we want to ensure input is absolute (AD-08)
    if (!path.isAbsolute(projectPath)) {
      throw new Error(`projectPath must be absolute: ${projectPath}`);
    }
  }
  const resolved = path.resolve(projectPath);

  // Validate that path exists and is directory (to fail fast in tests)
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) throw new Error(`projectPath is not a directory: ${resolved}`);
  } catch (err) {
    // If path does not exist, throw to surface misconfiguration early
    // For tests that use tmpdir, this won't trigger
    throw err;
  }

  // If already exists, close previous to ensure clean state (idempotent re-create)
  if (_watchers.has(projectId)) {
    try { closeWatcher(projectId); } catch {}
  }

  const debounceMs = options.debounceMs ?? options.debounce ?? DEBOUNCE_MS;
  const injectedRecentWrites = options.recentWrites || options.recentWritesMap || null;
  if (injectedRecentWrites != null && !(injectedRecentWrites instanceof Map)) {
    throw new Error('options.recentWrites must be a Map if provided');
  }

  const debounceMap = new Map();
  const record = {
    projectId,
    projectPath: resolved,
    watcher: null,
    onEvent,
    debounceMap,
    debounceMs,
    recentWrites: injectedRecentWrites,
    closed: false,
    close: () => closeWatcher(projectId),
  };

  const handler = (eventType, filename) => {
    if (record.closed) return;
    if (!filename) return;
    // filename is relative to watched root when recursive:true
    let rel = String(filename);
    // Normalize to posix and remove leading ./ or /
    rel = rel.split(path.sep).join('/').replace(/\\/g, '/');
    rel = rel.replace(/^\.\//, '').replace(/^\/+/, '');
    if (!rel) return;
    scheduleEvent(record, rel);
  };

  const fsWatcher = createFsWatcher(resolved, handler);
  record.watcher = fsWatcher;
  _watchers.set(projectId, record);
  _debounceMaps.set(projectId, debounceMap);

  return record;
}

/**
 * Close watcher for a project. Clears debounce timers, closes fs handle.
 * @param {string} projectId
 * @returns {boolean} true if closed, false if not found
 */
export function closeWatcher(projectId) {
  const rec = _watchers.get(projectId);
  if (!rec) return false;
  rec.closed = true;
  // Clear debounce timers
  for (const t of rec.debounceMap.values()) {
    try { clearTimeout(t); } catch {}
  }
  rec.debounceMap.clear();
  _debounceMaps.delete(projectId);
  _watchers.delete(projectId);
  try {
    if (rec.watcher) {
      rec.watcher.close();
      // Also close any extra watchers from fallback
      if (rec.watcher._extraWatchers) {
        for (const ew of rec.watcher._extraWatchers) {
          try { ew.close(); } catch {}
        }
      }
    }
  } catch {}
  return true;
}

/**
 * Close all watchers. Useful for server shutdown or test teardown.
 */
export function closeAllWatchers() {
  for (const id of Array.from(_watchers.keys())) {
    try { closeWatcher(id); } catch {}
  }
}

/**
 * Get watcher record for a project.
 * @param {string} projectId
 * @returns {object|null}
 */
export function getWatcher(projectId) {
  return _watchers.get(projectId) || null;
}

/**
 * For tests: reset all state (same as closeAllWatchers but also ensures no leak)
 */
export function _resetForTests({ clearRecentWrites: clearRW = true } = {}) {
  closeAllWatchers();
  if (clearRW) {
    try { recentWrites.clear(); } catch {}
  }
}

// No global directory change anywhere — AD-01
// Verified: debe retornar 0 resultados al buscar cambio de directorio global
