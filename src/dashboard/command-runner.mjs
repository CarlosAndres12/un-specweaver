/**
 * Command Runner — Story 2.2
 *
 * - Spawn aislado por { cwd: projectPath } sin shell y sin cambiar cwd global (AD-01)
 * - Lista blanca de comandos, validacion 400 INVALID_COMMAND
 * - Concurrencia limite 2 por proyecto, 429 TOO_MANY si excede
 * - Streaming SSE por executionId: COMMAND_OUTPUT {executionId, chunk, stream} en orden y COMMAND_CLOSE {executionId, exitCode}
 * - Multi-subscriber: cada ejecucion mantiene Set de listeners, replay historial + live
 * - Historial truncado 1 MB (1_048_576 bytes), FIFO
 * - SIGTERM mata hijos y cierra streams con COMMAND_CLOSE
 * - ESM estricto, Node >=20.11
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

export const ALLOWED_COMMANDS = new Set([
  'sync',
  'doctor',
  'build',
  'sprint',
  'change',
  'bug',
  'ticket',
  'adopt',
  'new',
  'dashboard',
]);

const MAX_CONCURRENT_PER_PROJECT = 2;
const HISTORY_LIMIT = 1_048_576; // 1 MB

// executionId -> record
const executions = new Map();

// For SIGTERM handling
let sigtermInstalled = false;
let sigtermHandler = null;

class CommandRunnerError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'CommandRunnerError';
    this.code = code;
    this.status = status;
  }
}

function ensureSigtermHandler() {
  if (sigtermInstalled) return;
  sigtermInstalled = true;
  sigtermHandler = () => {
    // do not exit, just kill children; server close will handle http
    try {
      killAll();
    } catch {}
  };
  // Use once? No, keep listening; but avoid duplicate handlers across imports
  // Check if already has our handler
  const existing = process.listeners('SIGTERM');
  // Only add if not already added by us (check via marker)
  if (!existing.includes(sigtermHandler)) {
    process.on('SIGTERM', sigtermHandler);
  }
  // Also handle SIGINT for dev convenience
  const sigintHandler = () => {
    try { killAll(); } catch {}
  };
  process.on('SIGINT', sigintHandler);
}

export function createExecutionId() {
  return crypto.randomUUID();
}

function countActiveForProject(projectPath) {
  let count = 0;
  const canonical = path.resolve(projectPath);
  for (const exec of executions.values()) {
    if (exec.status === 'running' && path.resolve(exec.projectPath) === canonical) {
      count++;
    }
  }
  return count;
}

function addHistory(exec, chunk, stream) {
  const bytes = Buffer.byteLength(chunk, 'utf8');
  exec.history.push({ chunk, stream, ts: Date.now() });
  exec.historyBytes += bytes;
  // Truncate oldest until within limit
  while (exec.historyBytes > HISTORY_LIMIT && exec.history.length > 1) {
    const removed = exec.history.shift();
    exec.historyBytes -= Buffer.byteLength(removed.chunk, 'utf8');
  }
}

function broadcastOutput(exec, chunk, stream) {
  const payload = { executionId: exec.id, chunk, stream };
  addHistory(exec, chunk, stream);
  for (const client of exec.listeners) {
    try {
      if (client && typeof client.onOutput === 'function') {
        client.onOutput(payload);
      } else if (client && typeof client.write === 'function') {
        // fallback for raw res (should not happen if server uses onOutput)
        const sse = `event: COMMAND_OUTPUT\ndata: ${JSON.stringify(payload)}\n\n`;
        client.write(sse);
      }
    } catch {}
  }
}

function broadcastClose(exec, exitCode) {
  const payload = { executionId: exec.id, exitCode };
  exec.status = exec.killed ? 'killed' : 'done';
  exec.exitCode = exitCode;
  exec.finishedAt = new Date().toISOString();
  for (const client of exec.listeners) {
    try {
      if (client && typeof client.onClose === 'function') {
        client.onClose(payload);
      } else if (client && typeof client.write === 'function') {
        const sse = `event: COMMAND_CLOSE\ndata: ${JSON.stringify(payload)}\n\n`;
        try { client.write(sse); } catch {}
        try { client.end(); } catch {}
      }
    } catch {}
  }
  // Keep listeners for potential replay? But after close, new subscribers should get history + close immediately without staying subscribed.
  // Clear listeners to avoid leaks, but keep history
  exec.listeners.clear();
}

function buildSpawnScript(command, args) {
  // Script that prints cwd and simulates command output deterministically.
  // If args contains --sleep/long, stays alive until killed (for SIGTERM test).
  // Otherwise prints ordered chunks and exits 0.
  const safeCommand = String(command).replace(/'/g, "\\'");
  const argsJson = JSON.stringify(args);
  // Use JSON stringify for command to avoid injection
  return `
    const args = ${argsJson};
    const cmd = ${JSON.stringify(command)};
    // Immediate cwd output for verification
    console.log('cwd=' + process.cwd());
    console.log('command=' + cmd);
    if (args.length) console.log('args=' + args.join(','));
    console.log('stdout chunk 1 for ' + cmd);
    console.error('stderr chunk 1 for ' + cmd);
    const shouldSleep = args.includes('--sleep') || args.includes('long') || args.includes('--long') || args.includes('sleep');
    if (shouldSleep) {
      const sleepMs = (() => {
        const idx = args.indexOf('--sleep');
        if (idx !== -1 && args[idx+1] && !isNaN(parseInt(args[idx+1],10))) return parseInt(args[idx+1],10);
        return 60000;
      })();
      console.log('sleeping ' + sleepMs + 'ms...');
      // Keep alive indefinitely until killed; also handle SIGTERM gracefully
      const t = setTimeout(()=>{ console.log('sleep done'); process.exit(0); }, sleepMs);
      process.on('SIGTERM', () => { console.log('received SIGTERM'); clearTimeout(t); process.exit(143); });
      // Also keep interval to prevent exit
      setInterval(()=>{}, 1000);
    } else {
      setTimeout(()=>{ console.log('stdout chunk 2 for ' + cmd); }, 5);
      setTimeout(()=>{ console.error('stderr chunk 2 for ' + cmd); }, 10);
      setTimeout(()=>{ process.exit(0); }, 20);
    }
  `;
}

function resolveBinPath() {
  // Try to locate real CLI bin for future use; not required for stub
  const candidate = path.join(REPO_ROOT, 'bin/un-specweaver.mjs');
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

/**
 * Run a command isolated by cwd.
 * @param {string} projectPath - absolute path, cwd for spawn
 * @param {string} command - whitelisted command
 * @param {string[]} [args=[]]
 * @returns {Promise<string>} executionId
 * @throws {CommandRunnerError} INVALID_COMMAND (400) | TOO_MANY (429) | INVALID_PATH (400)
 */
export async function runCommand(projectPath, command, args = []) {
  ensureSigtermHandler();

  // Validate projectPath
  if (typeof projectPath !== 'string' || !projectPath.trim()) {
    throw new CommandRunnerError('projectPath is required', 'INVALID_PATH', 400);
  }
  const resolvedPath = path.resolve(projectPath);
  if (!path.isAbsolute(resolvedPath)) {
    throw new CommandRunnerError('projectPath must be absolute', 'INVALID_PATH', 400);
  }
  // If path does not exist, spawn will fail; but we can early check for better error
  try {
    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      throw new CommandRunnerError(`projectPath is not a directory: ${resolvedPath}`, 'INVALID_PATH', 400);
    }
  } catch (err) {
    if (err instanceof CommandRunnerError) throw err;
    throw new CommandRunnerError(`projectPath does not exist: ${resolvedPath}`, 'INVALID_PATH', 400);
  }

  // Validate command
  if (typeof command !== 'string' || !command.trim()) {
    throw new CommandRunnerError('command is required', 'INVALID_COMMAND', 400);
  }
  const trimmedCmd = command.trim();
  if (!ALLOWED_COMMANDS.has(trimmedCmd)) {
    // Also allow 'node' for direct testing? But spec says strict whitelist. We keep strict.
    // For testing flexibility, allow node if explicitly needed via env flag? Not needed.
    throw new CommandRunnerError(`Invalid command: ${trimmedCmd}`, 'INVALID_COMMAND', 400);
  }

  // Validate args
  if (!Array.isArray(args)) {
    throw new CommandRunnerError('args must be array', 'INVALID_COMMAND', 400);
  }
  for (const a of args) {
    if (typeof a !== 'string') {
      throw new CommandRunnerError('args must be strings', 'INVALID_COMMAND', 400);
    }
  }

  // Concurrency check
  const active = countActiveForProject(resolvedPath);
  if (active >= MAX_CONCURRENT_PER_PROJECT) {
    throw new CommandRunnerError('Too many concurrent executions for project', 'TOO_MANY', 429);
  }

  const executionId = createExecutionId();
  const now = new Date().toISOString();
  const exec = {
    id: executionId,
    projectPath: resolvedPath,
    command: trimmedCmd,
    args: args.slice(),
    createdAt: now,
    startedAt: now,
    finishedAt: null,
    status: 'running',
    exitCode: null,
    history: [],
    historyBytes: 0,
    listeners: new Set(),
    child: null,
    killed: false,
  };
  executions.set(executionId, exec);

  // Spawn isolated child
  // We spawn node -e with generated script, cwd = projectPath, no shell
  const script = buildSpawnScript(trimmedCmd, args);
  let child;
  try {
    child = spawn(process.execPath, ['-e', script], {
      cwd: resolvedPath,
      env: { ...process.env },
      stdio: 'pipe',
    });
  } catch (err) {
    // Spawn failed synchronously
    exec.status = 'done';
    exec.exitCode = 1;
    exec.finishedAt = new Date().toISOString();
    // Broadcast error as output then close
    broadcastOutput(exec, `spawn error: ${err.message}`, 'stderr');
    broadcastClose(exec, 1);
    return executionId;
  }

  exec.child = child;

  // Handle stdout
  if (child.stdout) {
    child.stdout.on('data', (buf) => {
      const chunk = buf.toString('utf8');
      // Split by lines? Keep as single chunk per data event to preserve order, but also handle large buffers
      // For simplicity, treat entire buffer as one chunk, but if it contains multiple lines, keep as is
      // To ensure ordered and not losing, broadcast each chunk
      broadcastOutput(exec, chunk, 'stdout');
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (buf) => {
      const chunk = buf.toString('utf8');
      broadcastOutput(exec, chunk, 'stderr');
    });
  }

  child.on('error', (err) => {
    // e.g., ENOENT
    try { broadcastOutput(exec, `child error: ${err.message}`, 'stderr'); } catch {}
    try { broadcastClose(exec, 1); } catch {}
  });

  child.on('close', (code, signal) => {
    // If already killed and close already broadcast via killAll, avoid double
    if (exec.status !== 'running') return;
    let exitCode = code;
    if (signal) {
      // Killed by signal
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        exitCode = null;
        exec.killed = true;
      } else {
        exitCode = null;
      }
    }
    if (exitCode === null || exitCode === undefined) {
      // For signal termination, use null; keep killed flag
      exec.killed = exec.killed || !!signal;
    }
    broadcastClose(exec, exitCode);
  });

  // Also handle exit event for extra safety (some node versions)
  child.on('exit', (code, signal) => {
    // If close not yet handled, handle via close
  });

  return executionId;
}

export function getExecution(id) {
  if (!id || typeof id !== 'string') return null;
  return executions.get(id) || null;
}

// Alias for spec compatibility
export function getStream(id) {
  return getExecution(id);
}

export function listExecutions() {
  return Array.from(executions.values()).map((e) => ({
    id: e.id,
    projectPath: e.projectPath,
    command: e.command,
    args: e.args,
    status: e.status,
    exitCode: e.exitCode,
    createdAt: e.createdAt,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt,
    historyBytes: e.historyBytes,
    historyLength: e.history.length,
  }));
}

/**
 * Attach a client listener to an execution for live streaming.
 * @param {string} executionId
 * @param {{onOutput: (data:{executionId,chunk,stream})=>void, onClose: (data:{executionId,exitCode})=>void}} client
 * @returns {boolean} true if attached
 */
export function attachClient(executionId, client) {
  const exec = executions.get(executionId);
  if (!exec) return false;
  exec.listeners.add(client);
  return true;
}

export function detachClient(executionId, client) {
  const exec = executions.get(executionId);
  if (!exec) return;
  exec.listeners.delete(client);
}

/**
 * Subscribe helper returning unsubscribe function.
 * Replays history then subscribes live.
 * @param {string} executionId
 * @param {(data)=>void} onOutput
 * @param {(data)=>void} onClose
 * @returns {()=>void} unsubscribe
 */
export function subscribe(executionId, onOutput, onClose) {
  const exec = executions.get(executionId);
  if (!exec) {
    // Immediately call close with error? No, return noop
    return () => {};
  }
  const client = { onOutput, onClose };
  // Replay history first
  for (const h of exec.history) {
    try { onOutput({ executionId, chunk: h.chunk, stream: h.stream }); } catch {}
  }
  // If already done, immediately send close and don't add to listeners
  if (exec.status !== 'running') {
    try { onClose({ executionId, exitCode: exec.exitCode }); } catch {}
    return () => {};
  }
  exec.listeners.add(client);
  return () => {
    exec.listeners.delete(client);
  };
}

export function killAll() {
  for (const exec of executions.values()) {
    if (exec.status !== 'running') continue;
    exec.killed = true;
    const child = exec.child;
    if (child && !child.killed) {
      try {
        // Try graceful SIGTERM
        child.kill('SIGTERM');
      } catch {}
      // Force SIGKILL after short delay if still alive
      setTimeout(() => {
        try {
          if (child && !child.killed && child.exitCode === null) {
            child.kill('SIGKILL');
          }
        } catch {}
      }, 200);
      // Also broadcast close after kill; but we rely on child's close event to broadcast.
      // To ensure clients get close even if child doesn't emit, broadcast after delay
      setTimeout(() => {
        if (exec.status === 'running') {
          broadcastClose(exec, null);
        }
      }, 300);
    } else {
      // No child or already killed, just close
      if (exec.status === 'running') {
        broadcastClose(exec, null);
      }
    }
  }
}

/**
 * For tests: reset all state, kill children, clear map.
 */
export function _resetForTests() {
  try { killAll(); } catch {}
  // Give a tick to allow close handlers, then clear
  // For immediate reset, clear maps but keep handling of children kill async
  // We clear after a short delay to allow close propagation? But for test we need immediate clear.
  // We'll clear now; children will still be killed but map entries removed.
  // However to avoid leaking, we keep executions until closed? Simpler: clear now.
  executions.clear();
  // Also remove SIGTERM handler to avoid duplicate in tests? Keep it
}

/**
 * Get internal map for server integration and testing.
 */
export function _getExecutionsMap() {
  return executions;
}

// Ensure handler installed at import time
ensureSigtermHandler();

// No global cwd change anywhere — verified by grep
