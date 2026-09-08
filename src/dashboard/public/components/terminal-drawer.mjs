/**
 * Terminal Drawer — Story 4.2
 *
 * Colapsable, atajos Ctrl+` / Cmd+J, Esc cierra, ? ayuda.
 * Botones: Sincronizar (sync), Diagnóstico (doctor), Planificar Sprint (sprint), Construir (build)
 * POST /api/projects/:id/commands + GET /commands/:execId/stream SSE streaming
 * Historial aislado por projectId Map<projectId, string[]> (internal stores {chunk,stream})
 * Auto-scroll, formato terminal con <pre> + spans
 *
 * Exports requeridos:
 * - createTerminalDrawer(container, options)
 * - formatChunk(chunk, stream)
 * - appendOutput(outputEl, chunk, stream)
 * - clear(projectId?)
 * - getHistory(projectId)
 * - setHistory(projectId, arr)
 *
 * ESM estricto, vanilla ESM, sin dependencias globales.
 */

const HISTORIA_STORAGE_KEY = 'terminal-drawer-historia-v1';
const historialGlobal = new Map(); // projectId -> Array<{chunk,stream}>

/* -------------------- persistencia localStorage opcional -------------------- */
function cargarDesdeStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(HISTORIA_STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) {
          // v puede ser string[] o {chunk,stream}[]
          const normalized = v.map((e) => {
            if (typeof e === 'string') return { chunk: e, stream: 'stdout' };
            if (e && typeof e.chunk === 'string') return { chunk: e.chunk, stream: e.stream || 'stdout' };
            return { chunk: String(e), stream: 'stdout' };
          });
          historialGlobal.set(k, normalized);
        }
      }
    }
  } catch {}
}

function guardarEnStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const obj = {};
    for (const [k, v] of historialGlobal.entries()) {
      // Guardar como string[] para compatibilidad spec, pero preservamos stream si es stderr?
      // Guardamos objetos para preservar stream; setHistory maneja ambos.
      obj[k] = v.map((e) => ({ chunk: e.chunk, stream: e.stream }));
    }
    localStorage.setItem(HISTORIA_STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

// Cargar al importar
try { cargarDesdeStorage(); } catch {}

/* -------------------- helpers de formato -------------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatChunk(chunk, stream = 'stdout') {
  const raw = String(chunk ?? '');
  const esc = escapeHtml(raw);
  const cls = stream === 'stderr' ? 'terminal-stderr' : stream === 'stdout' ? 'terminal-stdout' : 'terminal-system';
  // span con clase para diferenciar stdout/stderr
  return `<span class="${cls}">${esc}</span>`;
}

export function appendOutput(outputEl, chunk, stream = 'stdout') {
  if (!outputEl) return;
  const raw = String(chunk ?? '');
  // Si tenemos DOM real, crear span con textContent (auto-escape)
  const hasDoc = typeof document !== 'undefined' && typeof document.createElement === 'function';
  if (hasDoc && typeof outputEl.appendChild === 'function') {
    try {
      const span = document.createElement('span');
      span.className = stream === 'stderr' ? 'terminal-stderr' : stream === 'stdout' ? 'terminal-stdout' : 'terminal-system';
      span.textContent = raw;
      // Si outputEl es <pre>, añadir directo; si no, igual
      outputEl.appendChild(span);
      // Si chunk no termina en newline y es pre, el span igual se ve; añadir salto si hace falta? No, respetar raw.
      // auto-scroll
      try {
        outputEl.scrollTop = outputEl.scrollHeight;
      } catch {}
      return;
    } catch {
      // fallback a innerHTML
    }
  }
  // Fallback para mocks sin document o sin appendChild real
  try {
    const html = formatChunk(raw, stream);
    if (typeof outputEl.innerHTML === 'string') {
      outputEl.innerHTML += html;
    } else if (typeof outputEl.textContent === 'string') {
      outputEl.textContent += raw;
    }
    // intentar auto-scroll incluso en mock (si tienen scrollTop/scrollHeight)
    try {
      if ('scrollTop' in outputEl && 'scrollHeight' in outputEl) {
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    } catch {}
  } catch {}
}

export function clear(projectId) {
  if (typeof projectId === 'string' && projectId) {
    historialGlobal.delete(String(projectId));
    guardarEnStorage();
  } else if (projectId === undefined || projectId === null) {
    // clear all
    historialGlobal.clear();
    guardarEnStorage();
  } else {
    // por si pasan elemento? ignorar
    historialGlobal.clear();
    guardarEnStorage();
  }
}

export function getHistory(projectId) {
  if (!projectId) return [];
  const arr = historialGlobal.get(String(projectId));
  if (!arr) return [];
  // Devolver copia como string[] según spec (raw chunks) para compatibilidad,
  // pero si el caller espera objetos, puede acceder via getHistoryRaw
  // Para maximizar compatibilidad, devolvemos string[] de chunks.
  // Sin embargo, si almacenamos objetos, extraemos chunk.
  return arr.map((e) => e.chunk);
}

// Helper no requerido por spec pero útil para tests que quieran stream info
export function getHistoryRaw(projectId) {
  if (!projectId) return [];
  const arr = historialGlobal.get(String(projectId));
  return arr ? arr.slice() : [];
}

export function setHistory(projectId, arr) {
  if (!projectId) return;
  const pid = String(projectId);
  if (!Array.isArray(arr)) {
    historialGlobal.set(pid, []);
    guardarEnStorage();
    return;
  }
  const normalized = arr.map((e) => {
    if (typeof e === 'string') return { chunk: e, stream: 'stdout' };
    if (e && typeof e.chunk === 'string') return { chunk: e.chunk, stream: e.stream || 'stdout' };
    return { chunk: String(e), stream: 'stdout' };
  });
  historialGlobal.set(pid, normalized);
  guardarEnStorage();
}

/* -------------------- internal helpers -------------------- */
function pushHistory(projectId, chunk, stream) {
  if (!projectId) return;
  const pid = String(projectId);
  const arr = historialGlobal.get(pid) || [];
  arr.push({ chunk: String(chunk), stream: stream || 'stdout' });
  historialGlobal.set(pid, arr);
  guardarEnStorage();
}

function isInputFocused(target) {
  const el = target || (typeof document !== 'undefined' ? document.activeElement : null);
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
  return false;
}

function ensureDrawerStructure(container) {
  if (!container) return null;
  // Si ya existe terminal-output, asumimos estructura creada
  let outputEl = null;
  if (typeof container.querySelector === 'function') {
    outputEl = container.querySelector('.terminal-output');
    if (outputEl) return { outputEl };
  }
  // Crear estructura básica si falta
  const hasDoc = typeof document !== 'undefined' && typeof document.createElement === 'function';
  if (!hasDoc) return { outputEl: null };

  // Limpiar si container está vacío y crear
  // No borrar si ya tiene contenido tipo drawer?
  // Crear header
  const header = document.createElement('div');
  header.className = 'drawer-header';

  const titulo = document.createElement('h3');
  titulo.textContent = 'Terminal';
  header.appendChild(titulo);

  const acciones = document.createElement('div');
  acciones.className = 'drawer-acciones';

  const btnDefs = [
    { command: 'pi', label: '🤖 pi', title: 'Iniciar agente Pi en este proyecto (pi)' },
    { command: 'opencode', label: '⚡ opencode', title: 'Iniciar OpenCode (opencode)' },
    { command: 'build', label: '🔨 build', title: 'Construir / Validar (build)' },
    { command: 'sprint', label: '📊 sprint', title: 'Planificar Sprint (sprint)' },
    { command: 'sync', label: '🔄 sync', title: 'Sincronizar (sync)' },
    { command: 'doctor', label: '🩺 doctor', title: 'Diagnóstico (doctor)' },
  ];
  for (const d of btnDefs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.command = d.command;
    b.textContent = d.label;
    b.title = d.title;
    b.setAttribute('aria-label', d.label);
    acciones.appendChild(b);
  }
  // Boton limpiar
  const btnClear = document.createElement('button');
  btnClear.type = 'button';
  btnClear.dataset.action = 'clear';
  btnClear.textContent = 'Limpiar';
  btnClear.title = 'Limpiar historial';
  acciones.appendChild(btnClear);

  header.appendChild(acciones);

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.dataset.action = 'close';
  btnClose.className = 'drawer-cerrar';
  btnClose.textContent = '×';
  btnClose.setAttribute('aria-label', 'Cerrar terminal');
  btnClose.title = 'Cerrar (Esc)';
  header.appendChild(btnClose);

  const output = document.createElement('div');
  output.className = 'terminal-output';
  const pre = document.createElement('pre');
  pre.className = 'terminal-pre';
  pre.setAttribute('aria-live', 'polite');
  pre.style.margin = '0';
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.wordBreak = 'break-word';
  output.appendChild(pre);

  const inputBar = document.createElement('form');
  inputBar.className = 'drawer-input-bar';
  inputBar.innerHTML = `
    <span class="drawer-prompt" aria-hidden="true">$</span>
    <input type="text" class="drawer-cmd-input" placeholder="Escribe comando (pi, opencode, /sw:build, doctor...) o responde..." autocomplete="off" />
    <button type="submit" class="drawer-cmd-send" title="Enviar comando o input">↵</button>
  `;

  const ayuda = document.createElement('div');
  ayuda.id = 'drawer-ayuda';
  ayuda.className = 'drawer-ayuda oculto';
  ayuda.setAttribute('role', 'dialog');
  ayuda.setAttribute('aria-label', 'Ayuda de atajos');
  ayuda.innerHTML = `
    <div class="ayuda-contenido">
      <p><strong>Atajos de teclado</strong></p>
      <ul>
        <li><kbd>Ctrl</kbd> + <kbd>\`</kbd> o <kbd>Cmd</kbd> + <kbd>J</kbd> — Abrir/cerrar terminal</li>
        <li><kbd>Esc</kbd> — Cerrar terminal</li>
        <li><kbd>?</kbd> — Mostrar esta ayuda</li>
      </ul>
      <button type="button" data-action="cerrar-ayuda">Cerrar ayuda</button>
    </div>
  `;

  // Si container tiene solo texto o vacío, construir
  // Si container.querySelector no encontró output, asumimos que falta estructura
  // Limpiar contenido previo? Solo si no parece drawer ya
  const hasDrawerClass = container.classList && container.classList.contains('drawer');
  if (!hasDrawerClass || !outputEl) {
    const isEmpty = !container.innerHTML || container.innerHTML.trim() === '' || container.children.length === 0;
    if (isEmpty) {
      container.innerHTML = '';
      container.appendChild(header);
      container.appendChild(output);
      container.appendChild(inputBar);
      container.appendChild(ayuda);
    } else {
      if (!container.querySelector('.drawer-header')) container.appendChild(header);
      if (!container.querySelector('.terminal-output')) container.appendChild(output);
      if (!container.querySelector('.drawer-input-bar')) container.appendChild(inputBar);
      if (!container.querySelector('#drawer-ayuda')) container.appendChild(ayuda);
      const existingPre = container.querySelector('.terminal-pre') || container.querySelector('.terminal-output');
      if (existingPre) {
        outputEl = existingPre;
      } else {
        outputEl = pre;
      }
      return { outputEl: container.querySelector('.terminal-pre') || pre };
    }
    outputEl = pre;
  }

  return { outputEl };
}

/* -------------------- streaming & input -------------------- */
function getApiUrl(urlPath) {
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    return `http://127.0.0.1:3100${urlPath}`;
  }
  return urlPath;
}

let activeExecutionId = null;
let activeXterm = null;
let activeFitAddon = null;
const sesionesMap = new Map(); // execId -> { id, command, args, startedAt, status, pid }

export function actualizarToolbarSesiones(selectedId) {
  if (typeof document === 'undefined') return;
  const selectEl = document.getElementById('select-sesiones-terminal');
  const badgeEstado = document.getElementById('terminal-badge-estado');
  const fabBadge = document.getElementById('badge-fab-activo');

  if (selectEl) {
    selectEl.innerHTML = '';
    if (sesionesMap.size === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(Sin sesión activa)';
      selectEl.appendChild(opt);
    } else {
      for (const [id, s] of sesionesMap.entries()) {
        const opt = document.createElement('option');
        opt.value = id;
        const isSel = id === (selectedId || activeExecutionId);
        opt.textContent = `${s.command}${s.args && s.args.length ? ' ' + s.args.join(' ') : ''} (${s.startedAt}) ${isSel ? '● Activa' : ''}`;
        if (isSel) opt.selected = true;
        selectEl.appendChild(opt);
      }
    }
  }

  if (badgeEstado) {
    if (activeExecutionId) {
      const s = sesionesMap.get(activeExecutionId);
      badgeEstado.textContent = `Ejecutando: ${s?.command || 'proceso'}`;
      badgeEstado.className = 'terminal-badge-tag activo';
    } else {
      badgeEstado.textContent = 'Inactivo';
      badgeEstado.className = 'terminal-badge-tag inactivo';
    }
  }

  if (fabBadge) {
    if (activeExecutionId) fabBadge.classList.remove('oculto');
    else fabBadge.classList.add('oculto');
  }
}

export async function initXterm(containerEl) {
  if (activeXterm) return activeXterm;
  const wrap = containerEl ? (containerEl.querySelector('#xterm-container') || containerEl.querySelector('.xterm-canvas-contenedor')) : null;
  if (!wrap || typeof window === 'undefined') return null;
  try {
    const { Terminal } = await import('../vendor/xterm/xterm.mjs');
    const { FitAddon } = await import('../vendor/xterm/addon-fit.mjs');
    activeXterm = new Terminal({
      theme: {
        background: '#0c1017',
        foreground: '#f8fafc',
        cursor: '#38bdf8',
        cursorAccent: '#0c1017',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#1e293b',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#fbbf24',
        blue: '#38bdf8',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#f8fafc',
      },
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.25,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      convertEol: true,
    });
    activeFitAddon = new FitAddon();
    activeXterm.loadAddon(activeFitAddon);
    activeXterm.open(wrap);
    try { activeFitAddon.fit(); } catch {}

    activeXterm.onData((data) => {
      if (activeExecutionId) {
        const s = sesionesMap.get(activeExecutionId);
        const pid = s?.pid || (typeof window !== 'undefined' && window.__lastActiveProjectId) || '';
        if (pid) {
          enviarInputFetch(pid, activeExecutionId, data, null);
        }
      }
    });

    window.addEventListener('resize', () => {
      try { activeFitAddon?.fit(); } catch {}
    });

    return activeXterm;
  } catch (err) {
    console.warn('[terminal-drawer] xterm no cargado, usando fallback:', err);
    return null;
  }
}

async function enviarInputFetch(projectId, executionId, input, fetchFn) {
  const pid = String(projectId);
  const execId = String(executionId);
  const urlPost = getApiUrl(`/api/projects/${encodeURIComponent(pid)}/commands/${encodeURIComponent(execId)}/input`);
  const fetcher = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) return;
  try {
    await fetcher(urlPost, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
  } catch {}
}

async function ejecutarComandoFetch(projectId, command, outputEl, fetchFn, args = []) {
  const pid = String(projectId);
  const cmd = String(command);
  // POST /api/projects/:id/commands
  const urlPost = getApiUrl(`/api/projects/${encodeURIComponent(pid)}/commands`);
  const fetcher = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) throw new Error('fetch no disponible');
  const res = await fetcher(urlPost, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd, args: Array.isArray(args) ? args : [] }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`POST commands fallo ${res.status}: ${txt}`);
  }
  const data = await res.json().catch(() => ({}));
  const executionId = data.executionId || data.id || data.execId;
  if (!executionId) throw new Error('Sin executionId en respuesta POST');

  activeExecutionId = executionId;
  const sessionRecord = {
    id: executionId,
    command: cmd,
    args: Array.isArray(args) ? args : [],
    pid,
    startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    status: 'running',
  };
  sesionesMap.set(executionId, sessionRecord);
  actualizarToolbarSesiones(executionId);

  // Mostrar comando en historial
  const promptLine = `$ ${cmd}${args && args.length > 0 ? ' ' + args.join(' ') : ''}\n`;
  pushHistory(pid, promptLine, 'system');
  appendOutput(outputEl, promptLine, 'system');
  if (activeXterm) {
    activeXterm.write(`\r\n\x1b[1;36m$ ${cmd}${args && args.length > 0 ? ' ' + args.join(' ') : ''}\x1b[0m\r\n`);
  }

  // Suscribir a stream
  try {
    await suscribirStream(pid, executionId, outputEl, fetcher, cmd);
  } finally {
    if (activeExecutionId === executionId) {
      activeExecutionId = null;
    }
    if (sessionRecord) sessionRecord.status = 'closed';
    actualizarToolbarSesiones();
  }
  return executionId;
}

async function suscribirStream(projectId, executionId, outputEl, fetchFn, command = '') {
  const pid = String(projectId);
  const execId = String(executionId);
  const url = getApiUrl(`/api/projects/${encodeURIComponent(pid)}/commands/${encodeURIComponent(execId)}/stream`);
  const fetcher = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);

  // Preferir EventSource si disponible y no es mock fetch-only env
  const ES = (typeof window !== 'undefined' && window.EventSource) || (typeof globalThis !== 'undefined' && globalThis.EventSource) || null;
  // Permitir que tests inyecten EventSource via globalThis
  const useEventSource = ES && typeof ES === 'function' && !String(ES).includes('mock');

  // Intentar EventSource primero si existe
  if (useEventSource) {
    try {
      return await new Promise((resolve, reject) => {
        const es = new ES(url);
        let finished = false;
        const cleanup = () => {
          try { es.close(); } catch {}
        };
        es.addEventListener('COMMAND_OUTPUT', (event) => {
          try {
            const d = JSON.parse(event.data);
            const chunk = d.chunk || '';
            const stream = d.stream || 'stdout';
            pushHistory(pid, chunk, stream);
            appendOutput(outputEl, chunk, stream);
            if (activeXterm) {
              activeXterm.write(chunk.replace(/\r?\n/g, '\r\n'));
            }
          } catch {}
        });
        es.addEventListener('COMMAND_CLOSE', (event) => {
          try {
            const d = JSON.parse(event.data || '{}');
            if (typeof d.exitCode !== 'undefined') {
              const line = `\n[proceso terminado con código ${d.exitCode}]\n`;
              pushHistory(pid, line, 'system');
              appendOutput(outputEl, line, 'system');
              if (activeXterm) {
                activeXterm.write(`\r\n\x1b[1;32m[proceso terminado con código ${d.exitCode}]\x1b[0m\r\n`);
              }
            }
          } catch {}
          finished = true;
          cleanup();
          resolve();
        });
        es.onerror = () => {
          if (!finished) {
            // No rechazar de inmediato, esperar un poco
            setTimeout(() => {
              if (!finished) {
                cleanup();
                // Fallback a fetch streaming si EventSource falló
                suscribirStreamFetch(pid, execId, outputEl, fetcher).then(resolve).catch(reject);
              }
            }, 500);
          }
        };
        // Timeout de seguridad: solo para comandos no interactivos (pi/opencode no tienen timeout)
        const isInteractive = ['pi', 'opencode', 'sh', 'bash', 'shell'].includes(String(command).toLowerCase());
        if (!isInteractive) {
          setTimeout(() => {
            if (!finished) {
              cleanup();
              resolve();
            }
          }, 30000);
        }
      });
    } catch {
      // fallback
    }
  }
  // Fallback fetch streaming
  return suscribirStreamFetch(pid, execId, outputEl, fetcher);
}

async function suscribirStreamFetch(projectId, executionId, outputEl, fetchFn) {
  const pid = String(projectId);
  const execId = String(executionId);
  const url = `/api/projects/${encodeURIComponent(pid)}/commands/${encodeURIComponent(execId)}/stream`;
  const fetcher = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) return;

  const res = await fetcher(url, {
    headers: { Accept: 'text/event-stream' },
  });
  if (!res.ok || !res.body) {
    // Si es JSON error (404), lanzar?
    return;
  }

  // Si res.body es ReadableStream (browser fetch) o Node stream
  // Intentar leer como texto SSE
  try {
    // Browser: res.body.getReader
    if (res.body.getReader) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = raw.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
            else if (line.startsWith(':')) { /* keepalive */ }
          }
          if (event === 'COMMAND_OUTPUT' && data) {
            try {
              const parsed = JSON.parse(data);
              const chunk = parsed.chunk || '';
              const stream = parsed.stream || 'stdout';
              pushHistory(pid, chunk, stream);
              appendOutput(outputEl, chunk, stream);
              if (activeXterm) {
                activeXterm.write(chunk.replace(/\r?\n/g, '\r\n'));
              }
            } catch {}
          } else if (event === 'COMMAND_CLOSE') {
            try {
              const parsed = JSON.parse(data || '{}');
              if (typeof parsed.exitCode !== 'undefined') {
                const line = `\n[proceso terminado con código ${parsed.exitCode}]\n`;
                pushHistory(pid, line, 'system');
                appendOutput(outputEl, line, 'system');
                if (activeXterm) {
                  activeXterm.write(`\r\n\x1b[1;32m[proceso terminado con código ${parsed.exitCode}]\x1b[0m\r\n`);
                }
              }
            } catch {}
            try { await reader.cancel(); } catch {}
            return;
          }
        }
      }
    } else if (typeof res.text === 'function') {
      // Fallback simple: leer todo como texto (para tests mock que retornan texto)
      const txt = await res.text();
      // Parse SSE texto completo
      const blocks = txt.split('\n\n');
      for (const block of blocks) {
        const lines = block.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (event === 'COMMAND_OUTPUT' && data) {
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.chunk || '';
            const stream = parsed.stream || 'stdout';
            pushHistory(pid, chunk, stream);
            appendOutput(outputEl, chunk, stream);
            if (activeXterm) {
              activeXterm.write(chunk.replace(/\r?\n/g, '\r\n'));
            }
          } catch {}
        } else if (event === 'COMMAND_CLOSE' && data) {
          try {
            const parsed = JSON.parse(data);
            const line = `\n[proceso terminado con código ${parsed.exitCode}]\n`;
            pushHistory(pid, line, 'system');
            appendOutput(outputEl, line, 'system');
            if (activeXterm) {
              activeXterm.write(`\r\n\x1b[1;32m[proceso terminado con código ${parsed.exitCode}]\x1b[0m\r\n`);
            }
          } catch {}
        }
      }
    }
  } catch {}
}

/* -------------------- drawer factory -------------------- */
export function createTerminalDrawer(container, options = {}) {
  const hasDoc = typeof document !== 'undefined';
  let drawerEl = container;
  // Permitir pasar selector string
  if (typeof container === 'string' && hasDoc) {
    drawerEl = document.getElementById(container) || document.querySelector(container);
  }
  if (!drawerEl && hasDoc) {
    // Crear contenedor si no existe (para tests)
    drawerEl = document.createElement('div');
    drawerEl.id = 'terminal-drawer';
  }
  if (!drawerEl) {
    // Ambiente sin DOM (tests node puros): crear mock minimal
    drawerEl = {
      classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); }, toggle(c, f){ if(f===undefined){ if(this._s.has(c)) this._s.delete(c); else this._s.add(c);} else if(f) this._s.add(c); else this._s.delete(c);} },
      dataset: {},
      style: {},
      innerHTML: '',
      children: [],
      querySelector(){ return null; },
      appendChild(){},
      addEventListener(){},
      removeEventListener(){},
    };
  }

  // Asegurar clases base
  if (drawerEl.classList) {
    if (!drawerEl.classList.contains('drawer')) drawerEl.classList.add('drawer');
    // colapsable según spec
    if (!drawerEl.classList.contains('colapsable') && !drawerEl.classList.contains('drawer')) {
      // keep drawer
    }
    // No añadir abierto inicialmente
  }
  if (!drawerEl.id) drawerEl.id = 'terminal-drawer';
  if (drawerEl.classList && !drawerEl.classList.contains('drawer')) drawerEl.classList.add('drawer');

  const fetchFn = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  const getProjectId = typeof options.getProjectId === 'function' ? options.getProjectId : () => options.projectId || null;
  let currentProjectId = options.projectId || getProjectId() || null;
  const usePiAgent = !!options.usePiAgent;

  // Asegurar estructura interna
  let outputEl = null;
  let preEl = null;
  let ayudaEl = null;

  if (hasDoc && typeof drawerEl.querySelector === 'function') {
    // Intentar asegurar estructura
    const ensured = ensureDrawerStructure(drawerEl);
    if (ensured) {
      // outputEl es el <pre> si existe, si no el .terminal-output
      const maybePre = drawerEl.querySelector('.terminal-pre');
      const maybeOutput = drawerEl.querySelector('.terminal-output');
      preEl = maybePre || maybeOutput;
      outputEl = maybeOutput || drawerEl.querySelector('.terminal-output') || preEl;
      ayudaEl = drawerEl.querySelector('#drawer-ayuda') || drawerEl.querySelector('.drawer-ayuda');
    }
    // Fallback si ensure no creó por tener contenido previo
    if (!outputEl) {
      outputEl = drawerEl.querySelector('.terminal-output') || drawerEl.querySelector('.terminal-pre') || drawerEl.querySelector('pre');
    }
    if (!preEl) {
      preEl = drawerEl.querySelector('.terminal-pre') || outputEl;
    }
    if (!ayudaEl) {
      ayudaEl = drawerEl.querySelector('#drawer-ayuda');
    }
    // Si aún no hay outputEl, crear uno
    if (!outputEl && hasDoc) {
      outputEl = document.createElement('div');
      outputEl.className = 'terminal-output';
      const pre = document.createElement('pre');
      pre.className = 'terminal-pre';
      pre.style.margin = '0';
      pre.style.whiteSpace = 'pre-wrap';
      outputEl.appendChild(pre);
      drawerEl.appendChild(outputEl);
      preEl = pre;
    }
    // outputEl para append debe ser el pre (donde van spans)
    // Si outputEl es div contenedor, preEl es inner pre
    const appendTarget = preEl || outputEl;
    outputEl = appendTarget;
  } else {
    // Mock sin DOM
    outputEl = {
      innerHTML: '',
      textContent: '',
      scrollTop: 0,
      scrollHeight: 100,
      appendChild(child) {
        // simular appendChild añadiendo text
        if (child && child.textContent) this.innerHTML += `<span>${escapeHtml(child.textContent)}</span>`;
        this.scrollTop = this.scrollHeight;
      },
      querySelector(){ return null; },
    };
    preEl = outputEl;
  }

  // Si preEl distinto de outputEl, usar preEl para escritura
  const targetEl = preEl || outputEl;

  function estaAbierto() {
    if (!drawerEl.classList) return false;
    return drawerEl.classList.contains('abierto') || drawerEl.classList.contains('open') || drawerEl.classList.contains('visible');
  }

  function abrir() {
    if (drawerEl.classList) {
      drawerEl.classList.add('abierto');
      drawerEl.classList.remove('colapsado');
      drawerEl.setAttribute && drawerEl.setAttribute('aria-hidden', 'false');
    }
    drawerEl.dataset && (drawerEl.dataset.open = 'true');
    initXterm(drawerEl).then(() => {
      try {
        activeFitAddon?.fit();
        activeXterm?.focus();
      } catch {}
    });
  }

  function cerrar() {
    if (drawerEl.classList) {
      drawerEl.classList.remove('abierto');
      drawerEl.classList.remove('open');
      drawerEl.classList.remove('visible');
      drawerEl.setAttribute && drawerEl.setAttribute('aria-hidden', 'true');
    }
    if (drawerEl.dataset) drawerEl.dataset.open = 'false';
    // también ocultar ayuda si está visible
    ocultarAyuda();
  }

  function alternar() {
    if (estaAbierto()) cerrar();
    else abrir();
  }

  function mostrarAyuda() {
    const el = ayudaEl || (hasDoc ? drawerEl.querySelector('#drawer-ayuda') : null);
    if (el) {
      el.classList.remove('oculto');
      el.classList.add('visible');
      el.style && (el.style.display = 'block');
    } else if (hasDoc) {
      // crear ayuda si falta
      const div = document.createElement('div');
      div.id = 'drawer-ayuda';
      div.className = 'drawer-ayuda visible';
      div.innerHTML = `
        <p><strong>Atajos</strong></p>
        <ul>
          <li><kbd>Ctrl</kbd> + <kbd>\`</kbd> o <kbd>Cmd</kbd> + <kbd>J</kbd> — Abrir/cerrar</li>
          <li><kbd>Esc</kbd> — Cerrar</li>
          <li><kbd>?</kbd> — Ayuda</li>
        </ul>
      `;
      drawerEl.appendChild(div);
      ayudaEl = div;
    }
  }

  function ocultarAyuda() {
    const el = ayudaEl || (hasDoc ? drawerEl.querySelector('#drawer-ayuda') : null);
    if (el) {
      el.classList.add('oculto');
      el.classList.remove('visible');
      if (el.style) el.style.display = 'none';
    }
  }

  function ayudaVisible() {
    const el = ayudaEl || (hasDoc ? drawerEl.querySelector('#drawer-ayuda') : null);
    if (!el) return false;
    if (el.classList) return !el.classList.contains('oculto') && el.classList.contains('visible');
    return el.style && el.style.display !== 'none';
  }

  function renderHistorialFor(projectId) {
    const pid = String(projectId);
    const arr = historialGlobal.get(pid) || [];
    // Limpiar target
    if (targetEl) {
      if (typeof targetEl.innerHTML === 'string') targetEl.innerHTML = '';
      if (targetEl.textContent !== undefined && targetEl.children) {
        // Si es mock con children
        targetEl.children = [];
      }
      // Si es DOM pre, limpiar children
      if (hasDoc && targetEl.innerHTML !== undefined) {
        targetEl.innerHTML = '';
        // también limpiar appendChild historial: remover hijos
        while (targetEl.firstChild) targetEl.removeChild(targetEl.firstChild);
      }
      for (const entry of arr) {
        appendOutput(targetEl, entry.chunk, entry.stream);
      }
      // auto-scroll al final
      try { targetEl.scrollTop = targetEl.scrollHeight; } catch {}
    }
  }

  function setProject(projectId) {
    const pid = projectId ? String(projectId) : null;
    currentProjectId = pid;
    if (pid) renderHistorialFor(pid);
    else if (targetEl && targetEl.innerHTML !== undefined) targetEl.innerHTML = '';
  }

  // Alias para compatibilidad español
  const cambiarProyecto = setProject;
  const mostrar = abrir;
  const ocultar = cerrar;

  async function ejecutar(command, explicitProjectId, args = []) {
    const pid = explicitProjectId ? String(explicitProjectId) : (String(getProjectId() || currentProjectId || ''));
    if (!pid) throw new Error('projectId requerido para ejecutar comando');
    // Asegurar que currentProjectId actualizado
    currentProjectId = pid;
    // Si drawer cerrado, abrir automáticamente para que el usuario vea la ejecución
    if (!estaAbierto()) {
      try { abrir(); } catch {}
    }
    // Ejecutar via fetch
    const fetcher = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    return ejecutarComandoFetch(pid, command, targetEl, fetcher, args);
  }

  // Handler de botones
  function onBotonClick(e) {
    const btn = e.target && e.target.closest ? e.target.closest('button') : e.target;
    if (!btn) return;
    const cmd = btn.dataset && btn.dataset.command;
    const action = btn.dataset && btn.dataset.action;
    if (cmd) {
      e.preventDefault();
      const pid = String(getProjectId() || currentProjectId || '');
      if (!pid) {
        appendOutput(targetEl, '\n[error] No hay proyecto activo\n', 'stderr');
        return;
      }
      let execCmd = cmd;
      let execArgs = [];
      const swCommands = ['doctor', 'sprint', 'sync', 'build', 'ticket', 'adopt', 'bug', 'change', 'new'];
      if (usePiAgent && swCommands.includes(cmd)) {
        execCmd = 'pi';
        execArgs = [`/sw:${cmd}`];
      }
      ejecutar(execCmd, pid, execArgs).catch((err) => {
        appendOutput(targetEl, `\n[error] ${err.message}\n`, 'stderr');
      });
    } else if (action === 'maximize') {
      e.preventDefault();
      drawerEl.classList.toggle('maximizado');
      try { activeFitAddon?.fit(); } catch {}
    } else if (action === 'clear') {
      e.preventDefault();
      const pid = String(getProjectId() || currentProjectId || '');
      if (pid) {
        clear(pid);
        if (targetEl) {
          targetEl.innerHTML = '';
          while (targetEl.firstChild) targetEl.removeChild(targetEl.firstChild);
          if (Array.isArray(targetEl._children)) targetEl._children = [];
        }
      } else {
        clear();
        if (targetEl) targetEl.innerHTML = '';
      }
      if (activeXterm) {
        try { activeXterm.clear(); } catch {}
      }
    } else if (action === 'close') {
      e.preventDefault();
      cerrar();
    } else if (action === 'cerrar-ayuda') {
      e.preventDefault();
      ocultarAyuda();
    }
  }

  // Input bar handler
  const cmdHistory = [];
  let historyIdx = -1;

  function onSubmitInput(e) {
    if (e && e.preventDefault) e.preventDefault();
    const inputEl = drawerEl ? drawerEl.querySelector('.drawer-cmd-input') : null;
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    const pid = String(getProjectId() || currentProjectId || '');
    if (!pid) {
      appendOutput(targetEl, '\n[error] No hay proyecto activo\n', 'stderr');
      return;
    }
    if (activeExecutionId) {
      appendOutput(targetEl, text + '\n', 'stdout');
      const fetcher = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
      enviarInputFetch(pid, activeExecutionId, text + '\n', fetcher);
    } else {
      cmdHistory.push(text);
      historyIdx = cmdHistory.length;
      let cleanText = text;
      if (cleanText.startsWith('/sw:')) cleanText = cleanText.slice(4);
      else if (cleanText.startsWith('/')) cleanText = cleanText.slice(1);
      const parts = cleanText.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      const swCommands = ['doctor', 'sprint', 'sync', 'build', 'ticket', 'adopt', 'bug', 'change', 'new'];
      if (usePiAgent && (swCommands.includes(cmd) || text.startsWith('/sw:') || text.startsWith('/sw-'))) {
        const piMsg = text.startsWith('/') ? text : `/sw:${text}`;
        ejecutar('pi', pid, [piMsg]).catch((err) => {
          appendOutput(targetEl, `\n[error] ${err.message}\n`, 'stderr');
        });
      } else {
        ejecutar(cmd, pid, args).catch((err) => {
          appendOutput(targetEl, `\n[error] ${err.message}\n`, 'stderr');
        });
      }
    }
  }

  function onInputKeyDown(e) {
    const inputEl = e.target;
    if (!inputEl) return;
    if (e.key === 'ArrowUp') {
      if (historyIdx > 0) {
        historyIdx--;
        inputEl.value = cmdHistory[historyIdx] || '';
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIdx < cmdHistory.length - 1) {
        historyIdx++;
        inputEl.value = cmdHistory[historyIdx] || '';
      } else {
        historyIdx = cmdHistory.length;
        inputEl.value = '';
      }
    }
  }

  // Key handler global
  function onKeyDown(e) {
    // No interferir si foco está en input/textarea/contenteditable
    if (isInputFocused(e.target || (typeof document !== 'undefined' ? document.activeElement : null))) {
      return;
    }
    const key = e.key || '';
    const code = e.code || '';
    const ctrl = !!e.ctrlKey;
    const meta = !!e.metaKey;

    // Ctrl+` o Ctrl+~ (Backquote) -> toggle drawer
    const isBackquote = code === 'Backquote' || key === '`' || key === '~' || key === 'Dead' && code === 'Backquote';
    if (ctrl && isBackquote) {
      e.preventDefault();
      alternar();
      return;
    }
    if (ctrl && (key === '`' || key === '~')) {
      e.preventDefault();
      alternar();
      return;
    }
    // Cmd+J (meta+j)
    if (meta && (key.toLowerCase() === 'j')) {
      e.preventDefault();
      alternar();
      return;
    }
    // Esc cierra drawer si está abierto
    if (key === 'Escape' || key === 'Esc') {
      if (estaAbierto()) {
        e.preventDefault();
        cerrar();
        return;
      }
      if (ayudaVisible()) {
        e.preventDefault();
        ocultarAyuda();
        return;
      }
    }
    // ? muestra ayuda (sin ctrl/meta)
    if ((key === '?' || (key === '/' && e.shiftKey) || code === 'Slash' && e.shiftKey) && !ctrl && !meta) {
      e.preventDefault();
      mostrarAyuda();
      return;
    }
  }

  // Wiring
  let conectado = false;
  function conectarEventos() {
    if (conectado) return;
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('keydown', onKeyDown);
    }
    if (drawerEl && drawerEl.addEventListener) {
      drawerEl.addEventListener('click', onBotonClick);
      const formEl = drawerEl.querySelector('.drawer-input-bar');
      if (formEl) formEl.addEventListener('submit', onSubmitInput);
      const cmdInp = drawerEl.querySelector('.drawer-cmd-input');
      if (cmdInp) cmdInp.addEventListener('keydown', onInputKeyDown);
    }
    conectado = true;
  }
  function desconectarEventos() {
    if (!conectado) return;
    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('keydown', onKeyDown);
    }
    if (drawerEl && drawerEl.removeEventListener) {
      drawerEl.removeEventListener('click', onBotonClick);
      const formEl = drawerEl.querySelector('.drawer-input-bar');
      if (formEl) formEl.removeEventListener('submit', onSubmitInput);
      const cmdInp = drawerEl.querySelector('.drawer-cmd-input');
      if (cmdInp) cmdInp.removeEventListener('keydown', onInputKeyDown);
    }
    conectado = false;
  }

  // Intentar conectar inmediatamente si hay document
  try { conectarEventos(); } catch {}

  // Render inicial para proyecto actual si hay historial
  try {
    const pidInit = String(getProjectId() || currentProjectId || '');
    if (pidInit) renderHistorialFor(pidInit);
  } catch {}

  // Exponer API
  const api = {
    // elementos
    container: drawerEl,
    drawer: drawerEl,
    output: targetEl,
    outputEl: targetEl,
    preEl,
    ayudaEl,
    // estado
    estaAbierto,
    isOpen: estaAbierto,
    abrir,
    cerrar,
    alternar,
    toggle: alternar,
    mostrar,
    ocultar,
    mostrarAyuda,
    ocultarAyuda,
    ayudaVisible,
    // historial
    getHistory,
    setHistory,
    clear,
    getHistoryRaw,
    // alias historial por proyecto en instancia
    getHistoryFor: getHistory,
    setHistoryFor: setHistory,
    // proyecto
    setProject,
    cambiarProyecto,
    getProjectId: () => String(getProjectId() || currentProjectId || ''),
    // ejecución
    ejecutar,
    run: ejecutar,
    execute: ejecutar,
    formatChunk,
    appendOutput: (chunk, stream) => appendOutput(targetEl, chunk, stream),
    // raw append con target
    appendOutputRaw: appendOutput,
    renderHistorialFor,
    // control
    destruir: desconectarEventos,
    destroy: desconectarEventos,
    conectarEventos,
    desconectarEventos,
    // para tests: handler expuesto
    _onKeyDown: onKeyDown,
    _onBotonClick: onBotonClick,
    _historial: historialGlobal,
    _target: targetEl,
  };

  // También exponer helpers estáticos en instancia
  api.formatChunk = formatChunk;
  api.clear = clear;

  return api;
}

// Aliases inglés para compatibilidad
export const createDrawer = createTerminalDrawer;

// Para compatibilidad con tests que esperan default export
export default {
  createTerminalDrawer,
  createDrawer,
  formatChunk,
  appendOutput,
  clear,
  getHistory,
  setHistory,
  getHistoryRaw,
};
