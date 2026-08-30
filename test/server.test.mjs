import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';

import * as pm from '../src/dashboard/project-manager.mjs';
import { createServer, start as startServer } from '../src/dashboard/server.mjs';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Helper: isolated HOME like dashboard.test.mjs
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

function makeTempProject(prefix = 'proj-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function cleanupDirs(...dirs) {
  for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
}

async function getJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, json, text };
}

// ---------------------------------------------------------------------------
// S2.1-1: puerto ocupado reintenta y sirve SPA
// ---------------------------------------------------------------------------
test('S2.1-1 — GIVEN port ocupado WHEN boot THEN reintenta siguiente libre, sirve GET / con SPA y log Dashboard en http://127.0.0.1:<port>', async () => {
  await withIsolatedHome(async () => {
    // Occupy a random port
    const dummy = http.createServer((_, res) => { res.end('dummy'); });
    await new Promise((resolve, reject) => {
      dummy.listen(0, '127.0.0.1', resolve);
      dummy.on('error', reject);
    });
    const occupiedPort = dummy.address().port;
    assert.ok(occupiedPort > 0, 'dummy should occupy a port');

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    let srv = null;
    try {
      srv = createServer({ port: occupiedPort, host: '127.0.0.1' });
      const result = await srv.start();
      // Should have retried to next port
      assert.equal(result.port, occupiedPort + 1, 'should retry to occupiedPort+1');
      assert.ok(result.port > 0);
      // Log must contain Dashboard en http://127.0.0.1:<port>
      const expectedLog = `Dashboard en http://127.0.0.1:${result.port}`;
      assert.ok(logs.some(l => l.includes(expectedLog)), `logs ${JSON.stringify(logs)} should contain "${expectedLog}"`);
      // GET / should serve SPA with placeholder h1
      const response = await fetch(`http://127.0.0.1:${result.port}/`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Panel de Control un-specweaver/, 'SPA should contain h1');
      assert.match(html, /<h1[^>]*>.*Panel de Control un-specweaver.*<\/h1>/s);
      // Also check content-type is html
      const ct = response.headers.get('content-type') || '';
      assert.match(ct, /text\/html/);
      await srv.close();
    } finally {
      console.log = origLog;
      await new Promise(r => dummy.close(r));
    }
  });
});

// ---------------------------------------------------------------------------
// S2.1-2: SSE headers + keepalive
// ---------------------------------------------------------------------------
test('S2.1-2 — GIVEN servidor en puerto libre WHEN GET /api/events (SSE) THEN 200 text/event-stream, headers correctos y ping : keepalive cada ~25s', async () => {
  await withIsolatedHome(async () => {
    // Use short keepalive for test speed (90ms) but verify headers match spec
    const srv = createServer({ port: 0, host: '127.0.0.1', keepaliveInterval: 90 });
    const { port } = await srv.start();
    assert.ok(port > 0);

    // Use http.request to inspect SSE stream
    const headersPromise = new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/events',
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      }, (res) => {
        try {
          assert.equal(res.statusCode, 200, 'SSE should be 200');
          const ct = res.headers['content-type'] || '';
          assert.match(ct, /text\/event-stream/, 'Content-Type should be text/event-stream');
          assert.equal(res.headers['cache-control'], 'no-cache');
          // Connection may be normalized to keep-alive
          const conn = (res.headers['connection'] || '').toLowerCase();
          assert.match(conn, /keep-alive/);
          assert.equal(res.headers['x-accel-buffering'], 'no');
          resolve(res);
        } catch (e) {
          reject(e);
          res.destroy();
        }
      });
      req.on('error', reject);
      req.end();
      // Ensure we don't leak request on failure
      setTimeout(() => {
        try { req.destroy(); } catch {}
      }, 2000);
    });

    const res = await headersPromise;
    // Now wait for keepalive ping
    let buffer = '';
    const keepalivePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for : keepalive ping (expected within 500ms with 90ms interval)')), 800);
      res.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        if (buffer.includes(': keepalive')) {
          clearTimeout(timer);
          resolve(buffer);
        }
      });
      res.on('error', reject);
    });

    try {
      const data = await keepalivePromise;
      assert.match(data, /: keepalive/);
      // Also check initial comment or connected ping was present
      assert.ok(data.includes(':') , 'should contain SSE comment');
    } finally {
      try { res.destroy(); } catch {}
      await srv.close();
    }
  });
});

// Also verify default keepalive is ~25s by inspecting source constant (optional sanity)
test('S2.1-2b — server.mjs mantiene keepalive ~25s por defecto (código)', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
  // debe existir 25_000 o 25000
  assert.match(src, /25_?000/);
  assert.match(src, /keepalive/i);
});

// ---------------------------------------------------------------------------
// S2.1-3: 404 PROJECT_NOT_FOUND tipado
// ---------------------------------------------------------------------------
test('S2.1-3 — GIVEN endpoint con :id inexistente WHEN GET/PUT etc THEN 404 PROJECT_NOT_FOUND tipado', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const fakeId = crypto.randomUUID();

    try {
      // GET /api/projects/:id/state
      {
        const { res, json } = await getJson(`${base}/api/projects/${fakeId}/state`);
        assert.equal(res.status, 404);
        assert.ok(json, 'should be json');
        const code = json.code || json.error?.code;
        assert.equal(code, 'PROJECT_NOT_FOUND');
      }
      // PUT /api/projects/:id/epics
      {
        const { res, json } = await getJson(`${base}/api/projects/${fakeId}/epics`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# test' }),
        });
        assert.equal(res.status, 404);
        const code = json.code || json.error?.code;
        assert.equal(code, 'PROJECT_NOT_FOUND');
      }
      // POST /api/projects/:id/changes
      {
        const { res, json } = await getJson(`${base}/api/projects/${fakeId}/changes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spec: 'dummy' }),
        });
        assert.equal(res.status, 404);
        const code = json.code || json.error?.code;
        assert.equal(code, 'PROJECT_NOT_FOUND');
      }
      // POST /api/projects/:id/commands
      {
        const { res, json } = await getJson(`${base}/api/projects/${fakeId}/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'doctor' }),
        });
        assert.equal(res.status, 404);
        const code = json.code || json.error?.code;
        assert.equal(code, 'PROJECT_NOT_FOUND');
      }
      // GET /api/projects/:id/diagram
      {
        const r = await fetch(`${base}/api/projects/${fakeId}/diagram`);
        assert.equal(r.status, 404);
        const j = await r.json();
        const code = j.code || j.error?.code;
        assert.equal(code, 'PROJECT_NOT_FOUND');
      }
      // GET /api/projects/:id/commands/:execId/stream
      {
        const execId = crypto.randomUUID();
        const r = await fetch(`${base}/api/projects/${fakeId}/commands/${execId}/stream`);
        // This is SSE endpoint, but when project not found it should still return 404 JSON not SSE
        assert.equal(r.status, 404);
        const j = await r.json();
        const code = j.code || j.error?.code;
        assert.equal(code, 'PROJECT_NOT_FOUND');
      }
      // Ensure valid project does NOT return 404 (sanity: register one and check 200)
      const tmp = makeTempProject('proj-valid-');
      try {
        const reg = await getJson(`${base}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: tmp }),
        });
        assert.equal(reg.res.status, 201);
        const validId = reg.json.project.id;
        const ok = await getJson(`${base}/api/projects/${validId}/state`);
        assert.equal(ok.res.status, 200);
        assert.ok(ok.json.project || ok.json.epics, 'state should contain project/epics');
      } finally {
        cleanupDirs(tmp);
      }
    } finally {
      await srv.close();
    }
  });
});

// ---------------------------------------------------------------------------
// S2.1-4: router completo con stubs documentados
// ---------------------------------------------------------------------------
test('S2.1-4 — GIVEN todos endpoints FR-020 WHEN invocar según contrato THEN cada uno responde forma documentada architecture.md#4.5', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const tmpA = makeTempProject('proj-a-');
    const tmpB = makeTempProject('proj-b-');
    try {
      // POST /api/projects
      const postA = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmpA }),
      });
      assert.equal(postA.res.status, 201, 'POST /api/projects should be 201');
      assert.ok(postA.json.project);
      assert.match(postA.json.project.id, UUID_V4_RE);
      const idA = postA.json.project.id;

      const postB = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmpB, name: 'Proyecto B' }),
      });
      assert.equal(postB.res.status, 201);
      assert.equal(postB.json.project.name, 'Proyecto B');
      const idB = postB.json.project.id;

      // POST duplicate should be 409
      const dup = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmpA }),
      });
      assert.equal(dup.res.status, 409);
      assert.equal(dup.json.code || dup.json.error?.code, 'DUPLICATE');

      // POST invalid path should be 400 INVALID_PATH
      const bad = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'relativo/path' }),
      });
      assert.equal(bad.res.status, 400);
      assert.equal(bad.json.code || bad.json.error?.code, 'INVALID_PATH');

      // GET /api/projects
      const list = await getJson(`${base}/api/projects`);
      assert.equal(list.res.status, 200);
      assert.ok(Array.isArray(list.json.projects));
      assert.equal(list.json.projects.length, 2);
      assert.ok('activeProjectId' in list.json);

      // POST /api/projects/init
      const tmpC = makeTempProject('proj-init-');
      let idC = null;
      try {
        const initRes = await getJson(`${base}/api/projects/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: tmpC }),
        });
        assert.equal(initRes.res.status, 201, 'POST /api/projects/init should be 201');
        assert.ok(initRes.json.project);
        idC = initRes.json.project.id;
        // verify .spec was created
        const specExists = fs.existsSync(path.join(tmpC, '.spec'));
        assert.ok(specExists || initRes.json.project.specDir === '.spec' || initRes.json.project.specDir === null, 'init should create .spec or return specDir');
      } finally {
        // keep tmpC for further checks if needed, will cleanup later
        if (idC) {
          // verify init project appears in list
          const afterInit = await getJson(`${base}/api/projects`);
          assert.ok(afterInit.json.projects.find(p => p.id === idC));
        }
      }

      // GET /api/projects/:id/state
      const state = await getJson(`${base}/api/projects/${idA}/state`);
      assert.equal(state.res.status, 200);
      // Should contain project, epics, sprint, git, doctor per architecture
      assert.ok(state.json.project, 'state should have project');
      assert.ok(state.json.epics, 'state should have epics');
      assert.ok(state.json.sprint !== undefined, 'state should have sprint');
      assert.ok(state.json.git !== undefined, 'state should have git');
      assert.ok(state.json.doctor !== undefined, 'state should have doctor');
      assert.ok(state.json.epics.byStatus || state.json.epics.all !== undefined);

      // GET /api/projects/:id/diagram (stub allowed 200 placeholder or 501)
      const diagramRes = await fetch(`${base}/api/projects/${idA}/diagram`);
      assert.ok([200, 501].includes(diagramRes.status), `diagram should be 200 or 501, got ${diagramRes.status}`);
      if (diagramRes.status === 200) {
        const ct = diagramRes.headers.get('content-type') || '';
        assert.match(ct, /text\/html|image\/svg\+xml/);
        const body = await diagramRes.text();
        assert.ok(body.length > 0);
        // If degraded, header should be present
        const degraded = diagramRes.headers.get('x-archify-degraded');
        // Not strictly required, but if body contains placeholder, header should be true
        if (body.includes('Archify ausente') || body.includes('archify-placeholder')) {
          assert.equal(degraded, 'true');
        }
      }

      // PUT /api/projects/:id/epics
      const putEpics = await getJson(`${base}/api/projects/${idA}/epics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Epicas actualizadas\n\n- story 1' }),
      });
      assert.equal(putEpics.res.status, 200, 'PUT /epics should be 200');
      assert.equal(putEpics.json.ok, true);
      // Verify file was written
      const epicsPath = path.join(tmpA, 'epics.md');
      assert.ok(fs.existsSync(epicsPath));
      assert.match(fs.readFileSync(epicsPath, 'utf8'), /Epicas actualizadas/);
      // Invalid body should be 400
      const badPut = await getJson(`${base}/api/projects/${idA}/epics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 123 }),
      });
      assert.equal(badPut.res.status, 400);

      // POST /api/projects/:id/changes
      const changes = await getJson(`${base}/api/projects/${idA}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: '# spec content', invariants: 'ok' }),
      });
      assert.equal(changes.res.status, 201, 'POST /changes should be 201');
      assert.ok(changes.json.change);
      assert.match(changes.json.change.id, UUID_V4_RE);
      // Simulate invariant violation
      const badChange = await getJson(`${base}/api/projects/${idA}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: 'x', invariants: 'fail' }),
      });
      assert.equal(badChange.res.status, 400);
      assert.equal(badChange.json.code || badChange.json.error?.code, 'INVARIANT_VIOLATION');

      // POST /api/projects/:id/commands
      const cmd = await getJson(`${base}/api/projects/${idA}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'doctor', args: [] }),
      });
      assert.equal(cmd.res.status, 202, 'POST /commands should be 202');
      assert.ok(cmd.json.executionId);
      assert.match(cmd.json.executionId, UUID_V4_RE);
      const execId = cmd.json.executionId;

      // POST commands with invalid body should be 400
      const badCmd = await getJson(`${base}/api/projects/${idA}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(badCmd.res.status, 400);

      // GET /api/projects/:id/commands/:execId/stream (SSE)
      // This is SSE, so use http.request
      const streamHeaders = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: `/api/projects/${idA}/commands/${execId}/stream`,
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
        }, (res) => {
          try {
            assert.equal(res.statusCode, 200);
            const ct = res.headers['content-type'] || '';
            assert.match(ct, /text\/event-stream/);
            assert.equal(res.headers['cache-control'], 'no-cache');
            assert.equal(res.headers['x-accel-buffering'], 'no');
            resolve(res);
          } catch (e) {
            reject(e);
            res.destroy();
          }
        });
        req.on('error', reject);
        req.end();
        setTimeout(() => { try { req.destroy(); } catch {} }, 1000);
      });
      // Cleanup stream
      try { streamHeaders.destroy(); } catch {}

      // Also test that second project commands are isolated (different project)
      const cmdB = await getJson(`${base}/api/projects/${idB}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'sync' }),
      });
      assert.equal(cmdB.res.status, 202);
      assert.notEqual(cmdB.json.executionId, execId);

      // GET /api/events still works after other calls (re-check)
      const eventsRes = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/api/events',
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
        }, (res) => {
          try {
            assert.equal(res.statusCode, 200);
            resolve(res);
          } catch (e) { reject(e); res.destroy(); }
        });
        req.on('error', reject);
        req.end();
      });
      try { eventsRes.destroy(); } catch {}

      // Static GET / serves SPA
      const spa = await fetch(`${base}/`);
      assert.equal(spa.status, 200);
      const spaHtml = await spa.text();
      assert.match(spaHtml, /Panel de Control un-specweaver/);

      // Also GET /index.html
      const spa2 = await fetch(`${base}/index.html`);
      assert.equal(spa2.status, 200);
      const spa2Html = await spa2.text();
      assert.match(spa2Html, /Panel de Control un-specweaver/);

      cleanupDirs(tmpC);
    } finally {
      cleanupDirs(tmpA, tmpB);
      await srv.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Additional checks: ESM strict, no process.chdir, exports
// ---------------------------------------------------------------------------
test('AD-01 — server.mjs no usa process.chdir y es ESM', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
  assert.doesNotMatch(src, /process\.chdir/);
  assert.match(src, /import .*from/);
  assert.doesNotMatch(src, /require\(/);
});

test('server.mjs exporta createServer y start para tests', async () => {
  assert.equal(typeof createServer, 'function');
  assert.equal(typeof startServer, 'function');
  const srv = createServer({ port: 0 });
  assert.ok(srv.server);
  assert.equal(typeof srv.start, 'function');
  assert.equal(typeof srv.close, 'function');
  // no need to start, just check shape
  await srv.close().catch(() => {});
});

test('GET / inexistente con api debe retornar 404 tipado', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/no-existe`);
      assert.equal(r.status, 404);
      const j = await r.json();
      assert.ok(j.code);
    } finally {
      await srv.close();
    }
  });
});
