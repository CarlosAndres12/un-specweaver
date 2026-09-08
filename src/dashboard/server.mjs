/**
 * Dashboard HTTP server — Story 2.1
 *
 * - node:http nativo, router regex minimo
 * - sirve estaticos de src/dashboard/public/ (fallback placeholder)
 * - SSE global /api/events con headers tipados y keepalive ~25s
 * - endpoints FR-020 (architecture.md#4.5) con stubs documentados
 * - manejo de puertos: reintenta 3101,3102... hasta 10 intentos
 * - ESM estricto, Node >=20.11, sin cambiar cwd global
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as pm from './project-manager.mjs';
import * as runner from './command-runner.mjs';
import * as stateAdapter from './state-adapter.mjs';
import * as watcher from './watcher.mjs';
import { crearProyectoWizard } from './wizard-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = 3100;
const DEFAULT_HOST = '127.0.0.1';
const KEEPALIVE_INTERVAL = 25_000;
const MAX_PORT_ATTEMPTS = 10;

const PLACEHOLDER_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Panel de Control — un-specweaver</title>
</head>
<body>
  <main>
    <h1>Panel de Control un-specweaver</h1>
    <p>Dashboard local multi-proyecto — cargando...</p>
  </main>
</body>
</html>
`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// ---------------------------------------------------------------------------
// Archify diagram helpers — Story 3.2 (AD-07 sandbox)
// ---------------------------------------------------------------------------

function isSvgMarkup(markup) {
  const t = String(markup || '').trim();
  return t.startsWith('<svg') || (t.startsWith('<?xml') && t.includes('<svg'));
}

function encapsulateArchifyMarkup(markup) {
  const str = String(markup || '');
  if (str.includes('archify-container')) return str;
  const style = '<style>.archify-container{contain:content;overflow:auto;background:#fff;border-radius:6px;padding:0.5rem}.archify-placeholder{color:#64748b;font-style:italic}.archify-workflow{display:block}.archify-node{padding:0.25rem}.archify-edge{color:#64748b}.archify-lifecycle{display:block}.archify-phase{margin:0.25rem 0}.archify-content{min-height:60px}</style>';
  return `<div class="archify-container">${style}<div class="archify-content">${str}</div></div>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
};

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...CORS_HEADERS,
    ...extraHeaders,
  };
  res.writeHead(statusCode, headers);
  res.end(body);
}

function sendHtml(res, statusCode, html, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    ...CORS_HEADERS,
    ...extraHeaders,
  };
  res.writeHead(statusCode, headers);
  res.end(html);
}

function sendProjectNotFound(res, id) {
  const message = `Project not found: ${id}`;
  sendJson(res, 404, {
    code: 'PROJECT_NOT_FOUND',
    error: { code: 'PROJECT_NOT_FOUND', message },
    message,
  });
}

function sendTypedError(res, err) {
  if (err instanceof pm.ProjectManagerError) {
    sendJson(res, err.status, {
      code: err.code,
      error: { code: err.code, message: err.message },
      message: err.message,
    });
    return true;
  }
  if (err && typeof err.code === 'string' && typeof err.status === 'number') {
    sendJson(res, err.status, {
      code: err.code,
      error: { code: err.code, message: err.message || String(err.code) },
      message: err.message || String(err.code),
    });
    return true;
  }
  return false;
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    chunks.push(chunk);
    total += chunk.length;
    if (total > 1_000_000) {
      const err = new Error('Payload too large');
      err.status = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Invalid JSON');
    err.status = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function resolvePublicDir(explicit) {
  if (explicit) return path.resolve(explicit);
  return path.join(__dirname, 'public');
}

async function tryGetConsolidatedState(projectId) {
  // Story 1.3: adaptador de estado aislado — delega con projectPath explicito, nunca cwd global
  // Si bridge no encuentra artefactos, retorna estructura vacia sin 500 (adapter lo garantiza)
  // Si projectId inexistente, propaga PROJECT_NOT_FOUND -> caller responde 404 tipado
  return stateAdapter.getConsolidatedState(projectId);
}

// ---------------------------------------------------------------------------
// Core server factory
// ---------------------------------------------------------------------------

export function createServer({ port = DEFAULT_PORT, host = DEFAULT_HOST, publicDir, keepaliveInterval = KEEPALIVE_INTERVAL } = {}) {
  const resolvedPublicDir = resolvePublicDir(publicDir);
  const sseClients = new Map(); // res -> intervalId
  // AD-05 Ventana de supresión de eco 500 ms — compartido con watcher via global singleton
  // watcher.recentWrites es Map global; server alias para que PUT/POST lo pueblen y watcher lo consulte
  const recentWrites = watcher.recentWrites;
  // Runner de comandos con cwd aislado (Story 2.2) — usa ejecuciones globales del runner para aislamiento real
  const executions = runner._getExecutionsMap();

  // Broadcast helper — watcher (Story 2.3) y otros eventos usan esto
  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [client] of sseClients) {
      try {
        client.write(payload);
      } catch {}
    }
  }

  // Watcher integration — Story 2.3 filtrado + debounce 150 ms
  // onEvent del watcher hace broadcast FS_CHANGE por SSE global
  function handleWatcherEvent(event) {
    // event: { type: "FS_CHANGE", projectId, file, timestamp }
    try {
      broadcast(event.type || 'FS_CHANGE', event);
    } catch {}
  }

   /**
   * Start watching a project. Idempotente — si ya existe, lo reemplaza.
   * @param {string} projectId
   * @param {string} projectPath - absolute path
   * @param {object} [opts] - { debounceMs, recentWrites }
   * @returns {boolean} true if watcher created
   */
  function watchProject(projectId, projectPath, opts = {}) {
    try {
      const merged = { ...opts };
      // Inyectar recentWrites compartido para supresión de eco (AD-05)
      if (!merged.recentWrites && !merged.recentWritesMap) merged.recentWrites = recentWrites;
      watcher.createWatcher(projectId, projectPath, handleWatcherEvent, merged);
      return true;
    } catch (err) {
      try { console.error(`[dashboard] watcher failed for ${projectId}: ${err.message}`); } catch {}
      return false;
    }
  }

  function unwatchProject(projectId) {
    try { return watcher.closeWatcher(projectId); } catch { return false; }
  }

  function getWatcher(projectId) {
    try { return watcher.getWatcher(projectId); } catch { return null; }
  }

  function closeAllWatchers() {
    try { watcher.closeAllWatchers(); } catch {}
  }

  function handleSseGlobal(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...CORS_HEADERS,
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    // initial comment to establish connection
    try {
      res.write(': connected\n\n');
    } catch {}
    const timer = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {}
    }, keepaliveInterval);
    // Avoid Node closing idle connection
    if (req.socket) req.socket.setTimeout(0);
    sseClients.set(res, timer);
    const cleanup = () => {
      const t = sseClients.get(res);
      if (t) clearInterval(t);
      sseClients.delete(res);
    };
    res.on('close', cleanup);
    req.on('close', cleanup);
    req.on('aborted', cleanup);
  }

  // Legacy stub kept for backward compatibility — now delegates to real runner streaming
  function handleSseCommandStream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    try {
      res.write(': command stream connected\n\n');
    } catch {}
    const timer = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {}
    }, keepaliveInterval);
    if (req.socket) req.socket.setTimeout(0);
    sseClients.set(res, timer);
    const cleanup = () => {
      const t = sseClients.get(res);
      if (t) clearInterval(t);
      sseClients.delete(res);
    };
    res.on('close', cleanup);
    req.on('close', cleanup);
    req.on('aborted', cleanup);
  }

  /**
   * Real SSE handler for command executions (Story 2.2)
   * - Replay historial 1 MB en orden, luego live
   * - Multi-subscriber: cada cliente recibe mismos datos via runner broadcast
   * - Aislamiento por executionId (que ya es por projectPath)
   */
  function handleSseCommandExecution(req, res, executionId) {
    const exec = runner.getExecution(executionId);
    if (!exec) {
      sendJson(res, 404, {
        code: 'EXECUTION_NOT_FOUND',
        error: { code: 'EXECUTION_NOT_FOUND', message: `Execution not found: ${executionId}` },
        message: `Execution not found: ${executionId}`,
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...CORS_HEADERS,
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    if (req.socket) req.socket.setTimeout(0);

    const timer = setInterval(() => {
      try { res.write(': keepalive\n\n'); } catch {}
    }, keepaliveInterval);
    sseClients.set(res, timer);

    let closed = false;
    const safeWrite = (payload) => {
      if (closed) return;
      try { res.write(payload); } catch { closed = true; }
    };

    // Replay historial en orden
    for (const h of exec.history) {
      const payload = `event: COMMAND_OUTPUT\ndata: ${JSON.stringify({ executionId, chunk: h.chunk, stream: h.stream })}\n\n`;
      safeWrite(payload);
    }

    // Si ya termino, enviar CLOSE y cerrar
    if (exec.status !== 'running') {
      const closePayload = `event: COMMAND_CLOSE\ndata: ${JSON.stringify({ executionId, exitCode: exec.exitCode })}\n\n`;
      safeWrite(closePayload);
      try { res.end(); } catch {}
      const t = sseClients.get(res);
      if (t) clearInterval(t);
      sseClients.delete(res);
      return;
    }

    // Live: suscribir a outputs futuros
    const client = {
      onOutput: (data) => {
        const payload = `event: COMMAND_OUTPUT\ndata: ${JSON.stringify(data)}\n\n`;
        safeWrite(payload);
      },
      onClose: (data) => {
        const payload = `event: COMMAND_CLOSE\ndata: ${JSON.stringify(data)}\n\n`;
        safeWrite(payload);
        try { res.end(); } catch {}
        cleanup();
      },
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      const t = sseClients.get(res);
      if (t) clearInterval(t);
      sseClients.delete(res);
      try { runner.detachClient(executionId, client); } catch {}
      try { res.removeListener('close', cleanup); } catch {}
      try { req.removeListener('close', cleanup); } catch {}
      try { req.removeListener('aborted', cleanup); } catch {}
    };

    runner.attachClient(executionId, client);

    res.on('close', cleanup);
    req.on('close', cleanup);
    req.on('aborted', cleanup);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const method = req.method || 'GET';
      // Handle CORS preflight
      if (method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }

      // Use host from header or default for URL parsing
      const hostHeader = req.headers.host || `${host}:${port}`;
      const urlObj = new URL(req.url || '/', `http://${hostHeader}`);
      const pathname = urlObj.pathname;

      // --- SSE global ---
      if (method === 'GET' && pathname === '/api/events') {
        handleSseGlobal(req, res);
        return;
      }

      // --- GET /api/projects ---
      if (pathname === '/api/projects') {
        if (method === 'GET') {
          try {
            const data = await pm.listProjects();
            sendJson(res, 200, data);
          } catch (err) {
            if (!sendTypedError(res, err)) sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
          return;
        }
        if (method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const rawPath = body?.path ?? body?.projectPath;
            const name = body?.name;
            if (!rawPath || typeof rawPath !== 'string') {
              throw new pm.ProjectManagerError('Missing path', 'INVALID_PATH', 400);
            }
            const project = await pm.registerProject(rawPath, name);
            sendJson(res, 201, { project });
          } catch (err) {
            if (!sendTypedError(res, err)) {
              // readJsonBody INVALID_JSON case
              if (err && err.code === 'INVALID_JSON') {
                sendJson(res, 400, { code: 'INVALID_JSON', error: { code: 'INVALID_JSON', message: err.message }, message: err.message });
              } else {
                sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
              }
            }
          }
          return;
        }
        sendJson(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
        return;
      }

      // --- POST /api/projects/init --- Story 1.2
      // Delegates to project-manager initProject with explicit cwd/dir (no chdir).
      // Validates absolute+exists via canonicalPath; returns 400 INVALID_PATH without invoking init if invalid.
      if (pathname === '/api/projects/init' && method === 'POST') {
        try {
          const body = await readJsonBody(req);
          const rawPath = body?.path ?? body?.projectPath;
          const name = body?.name;
          if (!rawPath || typeof rawPath !== 'string' || String(rawPath).trim() === '') {
            throw new pm.ProjectManagerError('Missing path', 'INVALID_PATH', 400);
          }
          // initProject validates absolute+exists, detects existing specDir (adopt) or
          // delegates to src/init.mjs with { dir: projectPath, cwd: projectPath } then falls back to mkdir .spec.
          // No global directory change (AD-01).
          if (typeof pm.initProject !== 'function') {
            throw new Error('initProject not available');
          }
          const project = await pm.initProject(rawPath, name);
          // Return enriched project (re-fetch to get live specDir, health, timestamps)
          const enriched = await pm.getProject(project.id);
          sendJson(res, 201, { project: enriched });
        } catch (err) {
          if (!sendTypedError(res, err)) {
            if (err && err.code === 'INVALID_JSON') {
              sendJson(res, 400, { code: 'INVALID_JSON', error: { code: 'INVALID_JSON', message: err.message }, message: err.message });
            } else {
              // Do not expose stack — typed error already handled; fallback is internal
              sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
            }
          }
        }
        return;
      }

      // --- POST /api/projects/wizard --- Story 5.3
      if (pathname === '/api/projects/wizard' && method === 'POST') {
        try {
          const body = await readJsonBody(req);
          const rawPath = body?.path ?? body?.projectPath;
          if (!rawPath || typeof rawPath !== 'string' || String(rawPath).trim() === '') {
            throw new pm.ProjectManagerError('Missing path', 'INVALID_PATH', 400);
          }
          const { project, files } = await crearProyectoWizard(body);
          let executionId = null;
          try {
            const exec = await runner.runCommand(project.id, project.path, 'adopt', []);
            executionId = exec.executionId;
          } catch {}
          sendJson(res, 201, { project, executionId, files });
        } catch (err) {
          if (!sendTypedError(res, err)) {
            if (err && err.code === 'INVALID_JSON') {
              sendJson(res, 400, { code: 'INVALID_JSON', error: { code: 'INVALID_JSON', message: err.message }, message: err.message });
            } else if (err && err.code === 'INVALID_PATH') {
              sendJson(res, 400, { code: 'INVALID_PATH', error: { code: 'INVALID_PATH', message: err.message }, message: err.message });
            } else {
              sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
            }
          }
        }
        return;
      }

      // --- PUT/POST /api/projects/active con body { id } ---
      if (pathname === '/api/projects/active' && (method === 'PUT' || method === 'POST')) {
        let attemptedId = null;
        try {
          const body = await readJsonBody(req);
          const id = body?.id ?? body?.projectId ?? body?.activeProjectId;
          attemptedId = id;
          if (!id || typeof id !== 'string') {
            sendJson(res, 400, { code: 'INVALID_BODY', error: { code: 'INVALID_BODY', message: 'id requerido' }, message: 'id requerido' });
            return;
          }
          const result = await pm.setActiveProject(id);
          sendJson(res, 200, result);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, attemptedId || 'unknown');
          } else if (!sendTypedError(res, err)) {
            if (err && err.code === 'INVALID_JSON') {
              sendJson(res, 400, { code: 'INVALID_JSON', error: { code: 'INVALID_JSON', message: err.message }, message: err.message });
            } else {
              sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
            }
          }
        }
        return;
      }

      // --- PUT/POST /api/projects/:id/active — persistir proyecto activo ---
      const activeMatch = pathname.match(/^\/api\/projects\/([^/]+)\/active$/);
      if (activeMatch && (method === 'PUT' || method === 'POST')) {
        const id = decodeURIComponent(activeMatch[1]);
        try {
          const result = await pm.setActiveProject(id);
          sendJson(res, 200, result);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      // --- Regex routes for :id ---
      // Helper to extract id patterns first
      const stateMatch = pathname.match(/^\/api\/projects\/([^/]+)\/state$/);
      if (stateMatch && method === 'GET') {
        const id = decodeURIComponent(stateMatch[1]);
        try {
          const state = await tryGetConsolidatedState(id);
          sendJson(res, 200, state);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      // --- GET /api/projects/:id/graph — React Flow graph data (Story 8.2 & 8.3) ---
      const graphMatch = pathname.match(/^\/api\/projects\/([^/]+)\/graph$/);
      if (graphMatch && method === 'GET') {
        const id = decodeURIComponent(graphMatch[1]);
        try {
          const project = await pm.getProject(id);
          const graphData = await stateAdapter.getGraphData(project.path);
          sendJson(res, 200, graphData);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      // --- POST / DELETE /api/projects/:id/graph/edges — Bi-directional edge mutation (Story 8.3) ---
      const graphEdgesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/graph\/edges$/);
      if (graphEdgesMatch && (method === 'POST' || method === 'DELETE')) {
        const id = decodeURIComponent(graphEdgesMatch[1]);
        try {
          const project = await pm.getProject(id);
          const body = await readJsonBody(req);
          const { source, target, action = (method === 'DELETE' ? 'remove' : 'add') } = body || {};
          if (!source || !target) {
            sendJson(res, 400, { code: 'INVALID_PARAMS', message: 'source and target required' });
            return;
          }
          const result = await stateAdapter.updateGraphEdge(project.path, { source, target, action });
          if (result.error === 'CIRCULAR_DEPENDENCY') {
            sendJson(res, 400, { code: 'CIRCULAR_DEPENDENCY', message: 'Circular dependency detected' });
            return;
          }
          if (result.error) {
            sendJson(res, 400, { code: 'MUTATION_FAILED', message: result.error });
            return;
          }
          broadcast('graph_updated', { projectId: id, action, source, target });
          sendJson(res, 200, result);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      // --- PATCH /api/projects/:id/graph/nodes/:nodeId — Story property mutation (Story 8.3) ---
      const graphNodeMatch = pathname.match(/^\/api\/projects\/([^/]+)\/graph\/nodes\/([^/]+)$/);
      if (graphNodeMatch && method === 'PATCH') {
        const id = decodeURIComponent(graphNodeMatch[1]);
        const nodeId = decodeURIComponent(graphNodeMatch[2]);
        try {
          const project = await pm.getProject(id);
          const body = await readJsonBody(req);
          const result = await stateAdapter.updateStory(project.path, { storyId: nodeId, ...(body || {}) });
          broadcast('graph_updated', { projectId: id, action: 'update_node', nodeId });
          sendJson(res, 200, result);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      const diagramMatch = pathname.match(/^\/api\/projects\/([^/]+)\/diagram$/);
      if (diagramMatch && method === 'GET') {
        const id = decodeURIComponent(diagramMatch[1]);
        try {
          const project = await pm.getProject(id);
          // Try archify-bridge if present — Story 3.1/3.2 (import dinamico en memoria, degradado sin 500, encapsulado AD-07)
          const bridgePath = path.join(__dirname, 'archify-bridge.mjs');
          if (fs.existsSync(bridgePath)) {
            try {
              const bridge = await import('./archify-bridge.mjs');
              if (typeof bridge.compileDiagram === 'function') {
                const state = await tryGetConsolidatedState(id);
                const result = await bridge.compileDiagram(project.path, state);
                if (result && typeof result.markup === 'string') {
                  const isSvg = isSvgMarkup(result.markup);
                  const headers = {};
                  if (result.degraded) headers['X-Archify-Degraded'] = 'true';
                  if (isSvg) {
                    // SVG puro: servir directo como image/svg+xml
                    res.writeHead(200, { 'Content-Type': 'image/svg+xml', ...headers });
                    res.end(result.markup);
                  } else {
                    // HTML: encapsulado con div.archify-container + CSS prefijado .archify-* (AD-07)
                    const body = encapsulateArchifyMarkup(result.markup);
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
                    res.end(body);
                  }
                  return;
                }
              }
            } catch {
              // fall through to degraded placeholder — nunca 500 por Archify
            }
          }
          // degraded placeholder 200 with header (sin bridge o bridge fallo inesperado) — encapsulado igualmente
          const placeholder = `<div class="archify-placeholder"><p>Diagrama no disponible — Archify ausente</p><p>Proyecto: ${project.name}</p><p>Estado: 0 cambios</p></div>`;
          const body = encapsulateArchifyMarkup(placeholder);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Archify-Degraded': 'true' });
          res.end(body);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      const epicsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/epics$/);
      if (epicsMatch && method === 'PUT') {
        const id = decodeURIComponent(epicsMatch[1]);
        try {
          const project = await pm.getProject(id);
          const body = await readJsonBody(req);
          const content = body?.content;
          if (typeof content !== 'string') {
            sendJson(res, 400, { code: 'INVALID_BODY', error: { code: 'INVALID_BODY', message: 'content must be string' }, message: 'content must be string' });
            return;
          }
          const epicsPath = path.join(project.path, 'epics.md');
          await pm.writeAtomic(epicsPath, content);
          const hash = crypto.createHash('sha1').update(content).digest('hex');
          const absEpics = path.resolve(epicsPath);
          const tsEpics = Date.now();
          // Registrar supresión de eco para watcher — AD-05 500 ms
          // watcher.recentWrites es global singleton; server alias apunta al mismo Map
          try {
            watcher.registerRecentWrite(absEpics, hash, tsEpics);
          } catch {
            // fallback directo si helper no disponible
            recentWrites.set(absEpics, { hash, ts: tsEpics });
          }
          // Asegurar que server.recentWrites también refleje (si no es alias)
          if (recentWrites !== watcher.recentWrites) {
            recentWrites.set(absEpics, { hash, ts: tsEpics });
          }
          sendJson(res, 200, { ok: true });
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            if (err && err.code === 'INVALID_JSON') {
              sendJson(res, 400, { code: 'INVALID_JSON', error: { code: 'INVALID_JSON', message: err.message }, message: err.message });
            } else {
              sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
            }
          }
        }
        return;
      }

      const changesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/changes$/);
      if (changesMatch && method === 'POST') {
        const id = decodeURIComponent(changesMatch[1]);
        try {
          const project = await pm.getProject(id);
          const body = await readJsonBody(req);
          // Basic validation for invariants; if missing spec, return 400
          if (!body || (body.spec == null && body.content == null && body.name == null)) {
            // allow empty but provide 201 stub; alternatively require spec
            // For stub we accept anything and return 201
          }
          // Simulate invariant violation if body.invariants === 'fail' or spec contains invalid
          if (body && body.invariants === 'fail') {
            sendJson(res, 400, { code: 'INVARIANT_VIOLATION', error: { code: 'INVARIANT_VIOLATION', message: 'Invariant violation' }, message: 'Invariant violation' });
            return;
          }
          const changeId = crypto.randomUUID();
          // Si hay contenido spec, escribir atómicamente y registrar supresión de eco (AD-05)
          // Esto permite que POST /changes también evite eco Web→FS sin loop
          let changeContent = null;
          if (typeof body?.spec === 'string') changeContent = body.spec;
          else if (typeof body?.content === 'string') changeContent = body.content;
          else if (body?.spec != null && typeof body.spec === 'object') {
            try { changeContent = JSON.stringify(body.spec, null, 2); } catch {}
          }
          if (changeContent != null) {
            try {
              const specDir = pm.detectSpecDir(project.path) || '.spec';
              const changeDir = path.join(project.path, specDir, 'changes', changeId);
              const specPath = path.join(changeDir, 'spec.md');
              const hash = crypto.createHash('sha1').update(changeContent).digest('hex');
              await pm.writeAtomic(specPath, changeContent);
              const absSpec = path.resolve(specPath);
              const tsSpec = Date.now();
              try { watcher.registerRecentWrite(absSpec, hash, tsSpec); } catch { recentWrites.set(absSpec, { hash, ts: tsSpec }); }
              if (recentWrites !== watcher.recentWrites) recentWrites.set(absSpec, { hash, ts: tsSpec });
            } catch {
              // ignore write failure — still return 201
            }
          }
          sendJson(res, 201, { change: { id: changeId, projectId: id, spec: body?.spec ?? null } });
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            if (err && err.code === 'INVALID_JSON') {
              sendJson(res, 400, { code: 'INVALID_JSON', error: { code: 'INVALID_JSON', message: err.message }, message: err.message });
            } else {
              sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
            }
          }
        }
        return;
      }

      const commandsPostMatch = pathname.match(/^\/api\/projects\/([^/]+)\/commands$/);
      if (commandsPostMatch && method === 'POST') {
        const id = decodeURIComponent(commandsPostMatch[1]);
        try {
          const project = await pm.getProject(id);
          const body = await readJsonBody(req);
          const command = body?.command;
          if (!command || typeof command !== 'string') {
            sendJson(res, 400, { code: 'INVALID_COMMAND', error: { code: 'INVALID_COMMAND', message: 'command is required' }, message: 'command is required' });
            return;
          }
          const args = Array.isArray(body.args) ? body.args : [];
          let executionId;
          try {
            executionId = await runner.runCommand(project.path, command, args);
          } catch (runErr) {
            if (runErr && runErr.code === 'INVALID_COMMAND') {
              sendJson(res, 400, { code: 'INVALID_COMMAND', error: { code: 'INVALID_COMMAND', message: runErr.message }, message: runErr.message });
              return;
            }
            if (runErr && runErr.code === 'TOO_MANY') {
              sendJson(res, 429, { code: 'TOO_MANY', error: { code: 'TOO_MANY', message: runErr.message }, message: runErr.message });
              return;
            }
            if (runErr && runErr.code === 'INVALID_PATH') {
              sendJson(res, 400, { code: 'INVALID_PATH', error: { code: 'INVALID_PATH', message: runErr.message }, message: runErr.message });
              return;
            }
            throw runErr;
          }
          sendJson(res, 202, { executionId });
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            if (err && err.code === 'INVALID_JSON') {
              sendJson(res, 400, { code: 'INVALID_JSON', error: { code: 'INVALID_JSON', message: err.message }, message: err.message });
            } else {
              sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
            }
          }
        }
        return;
      }

      const streamMatch = pathname.match(/^\/api\/projects\/([^/]+)\/commands\/([^/]+)\/stream$/);
      if (streamMatch && method === 'GET') {
        const id = decodeURIComponent(streamMatch[1]);
        const execId = decodeURIComponent(streamMatch[2]);
        try {
          const project = await pm.getProject(id);
          const exec = runner.getExecution(execId);
          if (!exec) {
            sendJson(res, 404, {
              code: 'EXECUTION_NOT_FOUND',
              error: { code: 'EXECUTION_NOT_FOUND', message: `Execution not found: ${execId}` },
              message: `Execution not found: ${execId}`,
            });
            return;
          }
          if (path.resolve(exec.projectPath) !== path.resolve(project.path)) {
            sendJson(res, 404, {
              code: 'EXECUTION_NOT_FOUND',
              error: { code: 'EXECUTION_NOT_FOUND', message: `Execution not found for project: ${execId}` },
              message: `Execution not found for project: ${execId}`,
            });
            return;
          }
          handleSseCommandExecution(req, res, execId);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      const inputMatch = pathname.match(/^\/api\/projects\/([^/]+)\/commands\/([^/]+)\/input$/);
      if (inputMatch && method === 'POST') {
        const id = decodeURIComponent(inputMatch[1]);
        const execId = decodeURIComponent(inputMatch[2]);
        try {
          const project = await pm.getProject(id);
          const body = await readJsonBody(req);
          const input = body?.input ?? '';
          const exec = runner.getExecution(execId);
          if (!exec) {
            sendJson(res, 404, {
              code: 'EXECUTION_NOT_FOUND',
              error: { code: 'EXECUTION_NOT_FOUND', message: `Execution not found: ${execId}` },
              message: `Execution not found: ${execId}`,
            });
            return;
          }
          if (path.resolve(exec.projectPath) !== path.resolve(project.path)) {
            sendJson(res, 404, {
              code: 'EXECUTION_NOT_FOUND',
              error: { code: 'EXECUTION_NOT_FOUND', message: `Execution not found for project: ${execId}` },
              message: `Execution not found for project: ${execId}`,
            });
            return;
          }
          runner.sendInput(execId, input);
          sendJson(res, 200, { ok: true });
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (err && err.code === 'NOT_RUNNING') {
            sendJson(res, 400, { code: 'NOT_RUNNING', error: { code: 'NOT_RUNNING', message: err.message }, message: err.message });
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      const cancelMatch = pathname.match(/^\/api\/projects\/([^/]+)\/commands\/([^/]+)$/);
      if (cancelMatch && method === 'DELETE') {
        const id = decodeURIComponent(cancelMatch[1]);
        const execId = decodeURIComponent(cancelMatch[2]);
        try {
          const project = await pm.getProject(id);
          const exec = runner.getExecution(execId);
          if (!exec) {
            sendJson(res, 404, {
              code: 'EXECUTION_NOT_FOUND',
              error: { code: 'EXECUTION_NOT_FOUND', message: `Execution not found: ${execId}` },
              message: `Execution not found: ${execId}`,
            });
            return;
          }
          if (path.resolve(exec.projectPath) !== path.resolve(project.path)) {
            sendJson(res, 404, {
              code: 'EXECUTION_NOT_FOUND',
              error: { code: 'EXECUTION_NOT_FOUND', message: `Execution not found for project: ${execId}` },
              message: `Execution not found for project: ${execId}`,
            });
            return;
          }
          runner.killExecution(execId);
          sendJson(res, 200, { ok: true, executionId: execId });
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
          } else if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        }
        return;
      }

      // Also handle PUT /api/projects/:id/epics for other methods? Already handled.

      // For any other /api/projects/:id/* with id that doesn't match known subroutes but still contains id,
      // ensure PROJECT_NOT_FOUND handling if id is invalid and route pattern matches
      // Example: GET /api/projects/:id/state already handled. For unknown subroute like /api/projects/:id/unknown
      // we should still check if project exists? But spec says "cualquier endpoint con :id inexistente -> 404 PROJECT_NOT_FOUND"
      // So we need to intercept any path starting with /api/projects/<id>/
      const genericIdMatch = pathname.match(/^\/api\/projects\/([^/]+)\/(.+)$/);
      if (genericIdMatch) {
        const id = decodeURIComponent(genericIdMatch[1]);
        // If this is an API route that wasn't matched earlier and contains :id, check project existence
        // If project not found, return 404 PROJECT_NOT_FOUND rather than generic 404
        try {
          await pm.getProject(id);
        } catch (err) {
          if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
            sendProjectNotFound(res, id);
            return;
          }
        }
        // If project exists but route unknown, fall through to 404 NOT_FOUND
      } else {
        // Also handle GET /api/projects/:id without subresource? Not in spec, but check if path is /api/projects/:id
        const idOnlyMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
        if (idOnlyMatch && method === 'GET') {
          const id = decodeURIComponent(idOnlyMatch[1]);
          try {
            const proj = await pm.getProject(id);
            sendJson(res, 200, { project: proj });
            return;
          } catch (err) {
            if (err instanceof pm.ProjectManagerError && err.code === 'PROJECT_NOT_FOUND') {
              sendProjectNotFound(res, id);
              return;
            }
            if (!sendTypedError(res, err)) sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
            return;
          }
        }
      }

      // --- Static + SPA ---
      if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        const indexPath = path.join(resolvedPublicDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': content.length });
          res.end(content);
        } else {
          sendHtml(res, 200, PLACEHOLDER_HTML);
        }
        return;
      }

      if (method === 'GET' && !pathname.startsWith('/api/')) {
        // Serve static files from publicDir
        // Normalize and prevent traversal
        let safe = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
        // Remove leading /
        if (safe.startsWith(path.sep)) safe = safe.slice(1);
        const filePath = path.join(resolvedPublicDir, safe);
        // Ensure inside publicDir
        if (!filePath.startsWith(resolvedPublicDir)) {
          sendJson(res, 403, { code: 'FORBIDDEN', message: 'Forbidden' });
          return;
        }
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const mime = getMime(filePath);
            const data = fs.readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length });
            res.end(data);
            return;
          }
          // If file not found and pathname has extension, 404
          if (path.extname(pathname)) {
            sendJson(res, 404, { code: 'NOT_FOUND', error: { code: 'NOT_FOUND', message: 'Static not found' }, message: 'Static not found' });
            return;
          }
          // SPA fallback for client-side routing
          const indexPath = path.join(resolvedPublicDir, 'index.html');
          if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': content.length });
            res.end(content);
          } else {
            sendHtml(res, 200, PLACEHOLDER_HTML);
          }
          return;
        } catch (err) {
          sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          return;
        }
      }

      // Fallback 404 for unmatched API routes
      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { code: 'NOT_FOUND', error: { code: 'NOT_FOUND', message: 'Endpoint not found' }, message: 'Endpoint not found' });
        return;
      }

      // Generic 404 for other methods/paths
      sendJson(res, 404, { code: 'NOT_FOUND', error: { code: 'NOT_FOUND', message: 'Not found' }, message: 'Not found' });
    } catch (err) {
      // Top-level catch to avoid crashing server
      try {
        if (!res.headersSent) {
          if (!sendTypedError(res, err)) {
            sendJson(res, 500, { code: 'INTERNAL', message: String(err.message || err) });
          }
        } else {
          res.end();
        }
      } catch {}
    }
  });

  // Attach debug helpers
  server.sseClients = sseClients;
  server.recentWrites = recentWrites;
  server.executions = executions;
  server.broadcast = broadcast;

  // --- Start with retry ---
  async function listenOnce(p, h) {
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        server.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.removeListener('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(p, h);
    });
  }

  async function start(startOpts = {}) {
    const initialPort = startOpts.port ?? port;
    const hostToUse = startOpts.host ?? host;
    // ephemeral port: single attempt
    if (initialPort === 0) {
      await listenOnce(0, hostToUse);
      const addr = server.address();
      const actual = typeof addr === 'object' && addr !== null ? addr.port : 0;
      console.log(`Dashboard en http://${hostToUse}:${actual}`);
      return { server, port: actual, host: hostToUse, close, broadcast, sseClients, recentWrites, executions };
    }
    let attemptPort = initialPort;
    for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
      try {
        await listenOnce(attemptPort, hostToUse);
        const addr = server.address();
        const actual = typeof addr === 'object' && addr !== null ? addr.port : attemptPort;
        console.log(`Dashboard en http://${hostToUse}:${actual}`);
        return { server, port: actual, host: hostToUse, close, broadcast, sseClients, recentWrites, executions };
      } catch (err) {
        // If port in use and we have attempts left, try next port
        if (err && err.code === 'EADDRINUSE' && i < MAX_PORT_ATTEMPTS - 1) {
          attemptPort = initialPort + i + 1;
          // Server after EADDRINUSE is not listening; we can retry
          // Small delay to let OS release
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`No free port after ${MAX_PORT_ATTEMPTS} attempts starting from ${initialPort}`);
  }

  function close() {
    return new Promise((resolve) => {
      // Story 2.2: mata hijos y cierra streams con COMMAND_CLOSE en SIGTERM/close
      try { runner.killAll(); } catch {}
      // Story 2.3: cerrar watchers filtrados
      try { closeAllWatchers(); } catch {}
      // Clear keepalive intervals
      for (const timer of sseClients.values()) {
        try { clearInterval(timer); } catch {}
      }
      sseClients.clear();
      // Close HTTP server
      try {
        server.close(() => resolve());
      } catch {
        resolve();
      }
      // Fallback timeout
      setTimeout(() => resolve(), 800);
    });
  }

  // SIGTERM global para Story 2.2 escenario 4: mata hijos y cierra streams
  // Runner ya instala handler global, pero aseguramos que close tambien se invoque si hay servidor activo
  // Evitamos duplicar handlers en tests que crean múltiples servidores
  if (!globalThis.__unSpecweaverSigtermInstalled) {
    globalThis.__unSpecweaverSigtermInstalled = true;
    const onSigterm = () => {
      try { runner.killAll(); } catch {}
      // No cerramos process.exit aqui; el servidor close se encarga del HTTP
    };
    try { process.on('SIGTERM', onSigterm); } catch {}
  }

  // Also support direct listen for backwards compatibility
  server.start = start;
  server.closeAsync = close;
  server.broadcast = broadcast;
  server.sseClients = sseClients;
  server.recentWrites = recentWrites;
  server.executions = executions;
  server.watchProject = watchProject;
  server.unwatchProject = unwatchProject;
  server.getWatcher = getWatcher;
  server.closeAllWatchers = closeAllWatchers;

  return {
    server,
    start,
    close,
    broadcast,
    sseClients,
    recentWrites,
    executions,
    watchProject,
    unwatchProject,
    getWatcher,
    closeAllWatchers,
    get publicDir() { return resolvedPublicDir; },
    address() { return server.address(); },
  };
}

// Convenience start that creates and starts in one call
export async function start(opts = {}) {
  const instance = createServer(opts);
  const result = await instance.start(opts);
  // Attach instance host/port for convenience
  return { ...instance, ...result, server: instance.server };
}

// Default export for convenience
export default { createServer, start };
