import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';

import * as pm from '../src/dashboard/project-manager.mjs';
import { createServer } from '../src/dashboard/server.mjs';
import * as watcher from '../src/dashboard/watcher.mjs';

function makeTempProject(prefix = 'echo-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function cleanupDirs(...dirs) {
  for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
}
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
function resetWatcher() {
  try { watcher.closeAllWatchers(); } catch {}
  try { watcher._resetForTests({ clearRecentWrites: true }); } catch {
    try { watcher.clearRecentWrites(); } catch {}
  }
}
async function withIsolatedHome(fn) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'unsw-home-'));
  const origHomedir = os.homedir;
  const origHomeEnv = process.env.HOME;
  os.homedir = () => tmpHome;
  process.env.HOME = tmpHome;
  if (pm._resetLockForTests) pm._resetLockForTests();
  try {
    await fn(tmpHome);
  } finally {
    os.homedir = origHomedir;
    if (origHomeEnv === undefined) delete process.env.HOME;
    else process.env.HOME = origHomeEnv;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch {}
  }
}

// SSE collector helper for integration tests
function createSSECollector(port) {
  const events = [];
  let buffer = '';
  let resRef = null;
  const req = http.request({
    hostname: '127.0.0.1',
    port,
    path: '/api/events',
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
  });
  const resPromise = new Promise((resolve, reject) => {
    req.on('response', (res) => {
      resRef = res;
      res.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!raw.trim() || raw.trim().startsWith(':')) continue;
          const lines = raw.split('\n');
          let eventType = null;
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
            else if (line.startsWith(':')) {}
          }
          if (eventType && dataStr) {
            try {
              const data = JSON.parse(dataStr);
              events.push({ event: eventType, data, raw });
            } catch {}
          }
        }
      });
      res.on('error', () => {});
      resolve(res);
    });
    req.on('error', reject);
  });
  req.end();
  return {
    events,
    req,
    resPromise,
    get res() { return resRef; },
    close() {
      try { req.destroy(); } catch {}
      try { resRef?.destroy(); } catch {}
    },
  };
}

// ---------------------------------------------------------------------------
// S2.4-1: Web dentro 500ms → 0 eventos (watcher suprime)
// ---------------------------------------------------------------------------
test('S2.4-1 — GIVEN PUT Web + recentWrites WHEN watcher detecta fs event dentro 500ms THEN suprime FS_CHANGE (0 eventos)', async () => {
  const tmp = makeTempProject('echo-s1-');
  const events = [];
  try {
    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(150);

    const content = '# nuevo ' + Date.now() + ' ' + Math.random();
    const hash = watcher.computeHash(content);
    const abs = path.join(tmp, 'epics.md');
    watcher.registerRecentWrite(abs, hash);

    // Simula escritura Web ya hecha (file content coincide con hash registrado)
    fs.writeFileSync(abs, content);

    await delay(400);

    assert.equal(events.length, 0, `expected 0 eventos suprimidos, got ${JSON.stringify(events)}`);

    // Verify that without suppression, same file would emit (sanity)
    // Clear recentWrites and write different content to ensure watcher still works
    resetWatcher();
    watcher.createWatcher('proj-1b', tmp, (e) => events.push(e));
    await delay(150);
    events.length = 0;
    fs.writeFileSync(abs, content + ' cli-mod');
    await delay(400);
    assert.equal(events.length, 1, `sanity: without recentWrites, should emit 1, got ${JSON.stringify(events)}`);
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

// ---------------------------------------------------------------------------
// S2.4-1b integration: PUT /api/projects/:id/epics registra recentWrites y suprime SSE
// ---------------------------------------------------------------------------
test('S2.4-1b — GIVEN PUT /api/projects/:id/epics (origen Web) WHEN servidor escribe atómicamente y registra recentWrites y watcher detecta dentro 500ms THEN 0 eventos SSE', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const tmp = makeTempProject('echo-s1b-');
    let collector = null;
    try {
      // Register project
      const regRes = await fetch(`http://127.0.0.1:${port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      });
      assert.equal(regRes.status, 201);
      const { project } = await regRes.json();
      const projectId = project.id;

      // Start watcher via server (injected recentWrites)
      const ok = srv.watchProject(projectId, tmp);
      assert.equal(ok, true);
      await delay(150);

      collector = createSSECollector(port);
      await collector.resPromise;
      await delay(100);

      const content = '# nuevo web ' + Date.now();
      const putRes = await fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/epics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      assert.equal(putRes.status, 200);
      const putJson = await putRes.json();
      assert.equal(putJson.ok, true);

      // Verify file written atomically
      const epicsPath = path.join(tmp, 'epics.md');
      assert.ok(fs.existsSync(epicsPath));
      assert.equal(fs.readFileSync(epicsPath, 'utf8'), content);

      // Verify recentWrites registered with correcto hash
      const abs = path.resolve(epicsPath);
      const expectedHash = crypto.createHash('sha1').update(content).digest('hex');
      const entry = srv.recentWrites.get(abs);
      assert.ok(entry, `recentWrites should have entry for ${abs}`);
      assert.equal(entry.hash, expectedHash);
      assert.ok(Date.now() - entry.ts < 500, 'ts should be within window');

      // Wait debounce + within window → debe suprimir, 0 FS_CHANGE hacia este SSE
      await delay(400);
      const filtered = collector.events.filter((e) => e.event === 'FS_CHANGE' && e.data.file === 'epics.md' && e.data.projectId === projectId);
      assert.equal(filtered.length, 0, `expected 0 FS_CHANGE suprimidos, got ${JSON.stringify(collector.events)}`);
    } finally {
      try { collector?.close(); } catch {}
      try { await srv.close(); } catch {}
      resetWatcher();
      cleanupDirs(tmp);
    }
  });
});

// ---------------------------------------------------------------------------
// S2.4-2: CLI sin recentWrites → emite normalmente
// ---------------------------------------------------------------------------
test('S2.4-2 — GIVEN mismo archivo epics.md escrito por CLI/agente (sin recentWrites) WHEN watcher detecta cambio THEN emite FS_CHANGE normalmente sin supresión', async () => {
  const tmp = makeTempProject('echo-s2-');
  const events = [];
  try {
    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(150);

    // No recentWrites registered
    assert.equal(watcher.recentWrites.size, 0);

    const abs = path.join(tmp, 'epics.md');
    fs.writeFileSync(abs, '# cli content ' + Date.now());

    await delay(400);

    assert.equal(events.length, 1, `expected 1 evento CLI, got ${JSON.stringify(events)}`);
    assert.equal(events[0].type, 'FS_CHANGE');
    assert.equal(events[0].projectId, 'proj-1');
    assert.equal(events[0].file, 'epics.md');
    assert.ok(typeof events[0].timestamp === 'number');

    // Also verify hash distinto dentro ventana no suprime (Web registro con hash A, CLI escribe hash B)
    events.length = 0;
    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(150);
    const webContent = '# web hash A ' + Date.now();
    const webHash = watcher.computeHash(webContent);
    const cliContent = '# cli hash B diferente ' + Date.now();
    const abs2 = path.join(tmp, 'epics.md');
    watcher.registerRecentWrite(abs2, webHash);
    // CLI escribe contenido distinto (hash distinto) dentro ventana
    fs.writeFileSync(abs2, cliContent);
    await delay(400);
    assert.equal(events.length, 1, `hash distinto dentro 500ms debe emitir, got ${JSON.stringify(events)}`);
    assert.equal(events[0].file, 'epics.md');
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

// ---------------------------------------------------------------------------
// S2.4-3: ventana expirada >500ms → sí emite (hash distinto o expirado)
// ---------------------------------------------------------------------------
test('S2.4-3 — GIVEN escribo desde Web y pasan >500ms WHEN hay cambio posterior CLI sobre mismo archivo THEN sí emite FS_CHANGE (ventana expirada, hash distinto)', async () => {
  const tmp = makeTempProject('echo-s3-');
  const events = [];
  try {
    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(150);

    const webContent = '# web original ' + Date.now();
    const webHash = watcher.computeHash(webContent);
    const abs = path.join(tmp, 'epics.md');
    // Simula PUT Web que registra recentWrites
    watcher.registerRecentWrite(abs, webHash);
    // Escribir archivo con webContent (sería suprimido si inmediato, pero esperamos >500)
    fs.writeFileSync(abs, webContent);
    // Wait to let first event be suppressed (if we had not waited, first would be suppressed; but we intentionally wait >500 antes de CLI)
    await delay(400);
    // At this point, first write should have been suppressed (0 eventos), clear for next phase
    assert.equal(events.length, 0, 'primer write Web debe ser suprimido');
    events.length = 0;

    // Ahora esperar ventana expirada
    await delay(250); // total >650 desde registro, >500
    // CLI escribe cambio posterior con contenido distinto (hash distinto y ventana expirada)
    const cliContent = '# cli posterior distinto ' + Date.now() + ' ' + Math.random();
    fs.writeFileSync(abs, cliContent);
    await delay(400);
    assert.equal(events.length, 1, `después de >500ms debe emitir, got ${JSON.stringify(events)}`);
    assert.equal(events[0].file, 'epics.md');

    // También probar mismo hash pero ventana expirada → debe emitir
    events.length = 0;
    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(150);
    const sameContent = '# mismo ' + Date.now();
    const sameHash = watcher.computeHash(sameContent);
    const abs2 = path.join(tmp, 'epics.md');
    watcher.registerRecentWrite(abs2, sameHash, Date.now() - 600); // ts hace 600ms atrás (expirado)
    fs.writeFileSync(abs2, sameContent);
    await delay(400);
    assert.equal(events.length, 1, `mismo hash pero ventana expirada debe emitir, got ${JSON.stringify(events)}`);
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

// ---------------------------------------------------------------------------
// S2.4-4: PUT concurrente → último hash gana, supresión solo hash coincidente
// ---------------------------------------------------------------------------
test('S2.4-4 — GIVEN PUT concurrente WHEN ambas escrituras atómicas THEN recentWrites registra último hash y supresión aplica solo al hash coincidente', async () => {
  const tmp = makeTempProject('echo-s4-');
  const events = [];
  try {
    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(150);

    const abs = path.join(tmp, 'epics.md');
    const content1 = '# first ' + Date.now() + ' ' + Math.random();
    const content2 = '# second ' + Date.now() + ' ' + Math.random();
    const hash1 = watcher.computeHash(content1);
    const hash2 = watcher.computeHash(content2);

    // Simula PUT concurrente: dos registros, último gana
    watcher.registerRecentWrite(abs, hash1);
    await delay(5);
    watcher.registerRecentWrite(abs, hash2); // último

    // Verificar que map tiene último hash
    const entry = watcher.recentWrites.get(path.resolve(abs));
    assert.ok(entry);
    assert.equal(entry.hash, hash2, 'recentWrites debe registrar último hash');
    assert.notEqual(entry.hash, hash1);

    // Escribir archivo con contenido2 (hash coincidente con último) → debe suprimir
    fs.writeFileSync(abs, content2);
    await delay(400);
    assert.equal(events.length, 0, `hash coincidente con último debe suprimir, got ${JSON.stringify(events)}`);

    // Escribir con contenido1 (hash antiguo, no coincide con último) → debe emitir aunque dentro ventana
    events.length = 0;
    // Necesitamos re-registrar? No, entry aún es hash2, ventana aún válida (<500 desde segundo registro)
    fs.writeFileSync(abs, content1);
    await delay(400);
    assert.equal(events.length, 1, `hash no coincidente con último debe emitir, got ${JSON.stringify(events)}`);
    assert.equal(events[0].file, 'epics.md');
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

test('S2.4-4b — integración server: PUT concurrente registra último hash', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const tmp = makeTempProject('echo-s4b-');
    try {
      const reg = await fetch(`http://127.0.0.1:${port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      }).then((r) => r.json());
      const projectId = reg.project.id;

      srv.watchProject(projectId, tmp);
      await delay(150);

      const content1 = '# concurrent 1 ' + Date.now();
      const content2 = '# concurrent 2 ' + Date.now();

      // Concurrent PUTs
      const [r1, r2] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/epics`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content1 }),
        }),
        fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/epics`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content2 }),
        }),
      ]);
      assert.equal(r1.status, 200);
      assert.equal(r2.status, 200);

      const epicsPath = path.join(tmp, 'epics.md');
      const abs = path.resolve(epicsPath);
      const entry = srv.recentWrites.get(abs);
      assert.ok(entry, 'recentWrites debe tener entrada después de concurrentes');
      const hash1 = crypto.createHash('sha1').update(content1).digest('hex');
      const hash2 = crypto.createHash('sha1').update(content2).digest('hex');
      // Debe ser uno de los dos, pero el último que ganó (depende de orden de ejecución)
      // Como Promise.all no garantiza orden, verificamos que es uno de ellos y que file contiene el último hash registrado
      const fileContent = fs.readFileSync(epicsPath, 'utf8');
      const fileHash = crypto.createHash('sha1').update(fileContent).digest('hex');
      assert.equal(entry.hash, fileHash, 'recentWrites hash debe coincidir con contenido final en disco');
      assert.ok(entry.hash === hash1 || entry.hash === hash2);

      // Verificar supresión: el watcher debería haber suprimido el evento del último write (comprobar via direct watcher)
      // Creamos watcher adicional con mismo recentWrites map para verificar lógica de supresión
      // Si fileHash coincide con entry.hash y estamos dentro 500ms, debería suprimir; probamos escribiendo mismo contenido de nuevo
      const events = [];
      resetWatcher();
      // Registrar manualmente entry para simular ventana
      watcher.registerRecentWrite(abs, fileHash);
      watcher.createWatcher('proj-verify', tmp, (e) => events.push(e));
      await delay(150);
      fs.writeFileSync(epicsPath, fileContent);
      await delay(400);
      assert.equal(events.length, 0, 're-escritura con mismo hash dentro ventana debe suprimir');
    } finally {
      try { await srv.close(); } catch {}
      resetWatcher();
      cleanupDirs(tmp);
    }
  });
});

test('Watcher — ECHO_WINDOW_MS expuesto y sin process.chdir, ESM', () => {
  assert.equal(watcher.ECHO_WINDOW_MS, 500);
  assert.ok(watcher.recentWrites instanceof Map);
  assert.equal(typeof watcher.registerRecentWrite, 'function');
  assert.equal(typeof watcher.computeHash, 'function');
  assert.equal(typeof watcher.shouldSuppress, 'function');
  const srcW = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/watcher.mjs'), 'utf8');
  assert.doesNotMatch(srcW, /process\.chdir/);
  assert.match(srcW, /ECHO_WINDOW_MS|recentWrites/);
  const srcS = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
  assert.doesNotMatch(srcS, /process\.chdir/);
  assert.match(srcS, /recentWrites/);
  assert.match(srcS, /crypto\.createHash.*sha1/);
});

test('shouldSuppress helper — hash distinto no suprime, expirado no suprime', () => {
  const tmp = makeTempProject('echo-helper-');
  try {
    resetWatcher();
    const abs = path.join(tmp, 'epics.md');
    const content = '# test';
    const hash = watcher.computeHash(content);
    fs.writeFileSync(abs, content);
    watcher.registerRecentWrite(abs, hash);
    // Dentro ventana, mismo hash → suprime
    assert.equal(watcher.shouldSuppress(abs), true);
    // Hash distinto → no suprime
    const otherHash = watcher.computeHash('# other');
    assert.equal(watcher.shouldSuppress(abs, { currentHash: otherHash }), false);
    // Expirado → no suprime
    const oldTs = Date.now() - 600;
    watcher.registerRecentWrite(abs, hash, oldTs);
    assert.equal(watcher.shouldSuppress(abs), false);
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});
