import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import * as pm from '../src/dashboard/project-manager.mjs';
import { createServer } from '../src/dashboard/server.mjs';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Helper: isolated HOME
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
// E1S4-1 — pm directo: 3 proyectos y activeProjectId=proj-1 → conmuto a proj-2
// ---------------------------------------------------------------------------

test('E1S4-1 — GIVEN 3 proyectos y activeProjectId=proj-1 WHEN conmuto a proj-2 via pm.setActiveProject THEN projects.json actualiza activeProjectId=proj-2 y lastActive ISO-8601 atomico', async () => {
  await withIsolatedHome(async (tmpHome) => {
    const repos = [makeTempProject('e1s4-a-'), makeTempProject('e1s4-b-'), makeTempProject('e1s4-c-')];
    try {
      const p1 = await pm.registerProject(repos[0]);
      const p2 = await pm.registerProject(repos[1]);
      const p3 = await pm.registerProject(repos[2]);

      // GIVEN 3 proyectos y active = proj-1
      let r = await pm.setActiveProject(p1.id);
      assert.equal(r.activeProjectId, p1.id);
      // capture old lastActive of proj-2 before switch
      let before = await pm.getProject(p2.id);
      const oldLastActive = before.lastActive;
      assert.match(oldLastActive, ISO_RE, 'lastActive inicial debe ser ISO-8601');
      // ensure measurable time gap
      await new Promise((res) => setTimeout(res, 15));
      const beforeNow = Date.now();

      // WHEN conmuto a proj-2 via pm
      const afterSet = await pm.setActiveProject(p2.id);
      assert.equal(afterSet.activeProjectId, p2.id);

      // THEN projects.json actualiza activeProjectId y lastActive atomico
      const storePath = pm.getProjectsFilePath();
      assert.ok(fs.existsSync(storePath), 'projects.json debe existir');
      const raw = fs.readFileSync(storePath, 'utf8');
      // JSON valido sin corrupcion
      let data;
      assert.doesNotThrow(() => { data = JSON.parse(raw); }, 'JSON debe ser valido tras escritura atomica');
      assert.equal(data.activeProjectId, p2.id);
      const proj2InFile = data.projects.find((p) => p.id === p2.id);
      assert.ok(proj2InFile, 'proj-2 debe estar en archivo');
      assert.match(proj2InFile.lastActive, ISO_RE, 'lastActive debe ser ISO-8601');
      // now() ISO-8601 dentro de ventana reciente (antes y hasta 5s despues)
      const parsed = Date.parse(proj2InFile.lastActive);
      assert.ok(!isNaN(parsed), 'lastActive parseable');
      assert.ok(parsed >= beforeNow - 1000, 'lastActive >= beforeNow -1s');
      assert.ok(parsed <= Date.now() + 1000, 'lastActive <= now +1s');
      // debe haber cambiado respecto al viejo
      assert.notEqual(proj2InFile.lastActive, oldLastActive, 'lastActive debe actualizarse');
      // otro proyecto no debe cambiar su lastActive salvo proj-2
      const proj1InFile = data.projects.find((p) => p.id === p1.id);
      assert.ok(proj1InFile);
      // p1 lastActive debe ser anterior a p2 nuevo
      assert.ok(Date.parse(proj1InFile.lastActive) <= parsed, 'p1 lastActive <= p2 nuevo');
      // escritura atomica: no debe quedar .tmp. residual
      const files = fs.readdirSync(path.join(tmpHome, '.un-specweaver'));
      assert.equal(files.some((f) => f.includes('.tmp.')), false, 'no debe quedar tmp residual (atomico tmp+rename)');
      // via pm.listProjects tambien refleja
      const listed = await pm.listProjects();
      assert.equal(listed.activeProjectId, p2.id);
      const proj2Listed = listed.projects.find((p) => p.id === p2.id);
      assert.equal(proj2Listed.lastActive, proj2InFile.lastActive);

      // tambien verificar que p3 no fue tocado
      const proj3InFile = data.projects.find((p) => p.id === p3.id);
      assert.ok(proj3InFile);
    } finally {
      cleanupDirs(...repos);
    }
  });
});

// ---------------------------------------------------------------------------
// E1S4-1b — via API PUT /api/projects/:id/active tambien atomico
// ---------------------------------------------------------------------------

test('E1S4-1b — GIVEN 3 proyectos y activeProjectId=proj-1 WHEN PUT /api/projects/:id/active a proj-2 THEN projects.json actualiza atomico y lastActive ISO', async () => {
  await withIsolatedHome(async (tmpHome) => {
    const repos = [makeTempProject('e1s4api-a-'), makeTempProject('e1s4api-b-'), makeTempProject('e1s4api-c-')];
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    let port;
    try {
      const started = await srv.start();
      port = started.port;
      const base = `http://127.0.0.1:${port}`;
      // registrar 3 via API
      const ids = [];
      for (const repo of repos) {
        const { res, json } = await getJson(`${base}/api/projects`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: repo }),
        });
        assert.equal(res.status, 201);
        ids.push(json.project.id);
      }
      const [id1, id2] = ids;
      // GIVEN active = id1
      {
        const { res, json } = await getJson(`${base}/api/projects/${encodeURIComponent(id1)}/active`, { method: 'PUT' });
        assert.equal(res.status, 200);
        assert.equal(json.activeProjectId, id1);
      }
      {
        const { res, json } = await getJson(`${base}/api/projects`);
        assert.equal(json.activeProjectId, id1);
      }
      // capture old lastActive of id2 from file
      const storePath = pm.getProjectsFilePath();
      let beforeData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      const oldLastActive = beforeData.projects.find((p) => p.id === id2).lastActive;
      await new Promise((r) => setTimeout(r, 15));
      const beforeNow = Date.now();

      // WHEN conmuto a id2 via API precisa
      const switchRes = await getJson(`${base}/api/projects/${encodeURIComponent(id2)}/active`, { method: 'PUT' });
      assert.equal(switchRes.res.status, 200);
      assert.equal(switchRes.json.activeProjectId, id2);

      // THEN file atomico
      const raw = fs.readFileSync(storePath, 'utf8');
      const data = JSON.parse(raw);
      assert.equal(data.activeProjectId, id2);
      const proj2 = data.projects.find((p) => p.id === id2);
      assert.match(proj2.lastActive, ISO_RE);
      assert.ok(Date.parse(proj2.lastActive) >= beforeNow - 1000);
      assert.notEqual(proj2.lastActive, oldLastActive);
      // no tmp residual
      const files = fs.readdirSync(path.join(tmpHome, '.un-specweaver'));
      assert.equal(files.some((f) => f.includes('.tmp.')), false);
      // GET refleja
      const { json: listed } = await getJson(`${base}/api/projects`);
      assert.equal(listed.activeProjectId, id2);

      // tambien endpoint alternativo PUT /api/projects/active con body {id}
      await new Promise((r) => setTimeout(r, 10));
      const alt = await getJson(`${base}/api/projects/active`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id1 }),
      });
      assert.equal(alt.res.status, 200);
      assert.equal(alt.json.activeProjectId, id1);
      const raw2 = fs.readFileSync(storePath, 'utf8');
      assert.equal(JSON.parse(raw2).activeProjectId, id1);
      // POST variante tambien debe funcionar
      const postAlt = await getJson(`${base}/api/projects/active`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id2 }),
      });
      assert.equal(postAlt.res.status, 200);
      assert.equal(postAlt.json.activeProjectId, id2);
    } finally {
      try { await srv.close(); } catch {}
      cleanupDirs(...repos);
    }
  });
});

// ---------------------------------------------------------------------------
// E1S4-1c — POST /api/projects/:id/active variante y validacion 404
// ---------------------------------------------------------------------------

test('E1S4-1c — PUT /api/projects/:id/active con id inexistente retorna 404 PROJECT_NOT_FOUND', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    try {
      const base = `http://127.0.0.1:${port}`;
      const fake = crypto.randomUUID();
      const { res, json } = await getJson(`${base}/api/projects/${fake}/active`, { method: 'PUT' });
      assert.equal(res.status, 404);
      const code = json.code || json.error?.code;
      assert.equal(code, 'PROJECT_NOT_FOUND');
      // POST variante idem
      const { res: res2, json: j2 } = await getJson(`${base}/api/projects/${fake}/active`, { method: 'POST' });
      assert.equal(res2.status, 404);
      assert.equal(j2.code || j2.error?.code, 'PROJECT_NOT_FOUND');
      // body endpoint sin id -> 400
      const { res: res3 } = await getJson(`${base}/api/projects/active`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      assert.equal(res3.status, 400);
    } finally {
      await srv.close();
    }
  });
});

// ---------------------------------------------------------------------------
// E1S4-2 — Persiste tras reinicio (simulado por cerrar y reabrir server)
// ---------------------------------------------------------------------------

test('E1S4-2 — GIVEN reinicio servidor WHEN GET /api/projects THEN activeProjectId persiste ultimo valor', async () => {
  await withIsolatedHome(async (tmpHome) => {
    const repos = [makeTempProject('e1s4r-a-'), makeTempProject('e1s4r-b-'), makeTempProject('e1s4r-c-')];
    try {
      // primer servidor: registra 3 y setea active a proj-2
      const srv1 = createServer({ port: 0, host: '127.0.0.1' });
      const { port: port1 } = await srv1.start();
      const base1 = `http://127.0.0.1:${port1}`;
      const ids = [];
      for (const repo of repos) {
        const { json } = await getJson(`${base1}/api/projects`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: repo }),
        });
        ids.push(json.project.id);
      }
      const [, id2] = ids;
      // conmutar a id2
      {
        const { res } = await getJson(`${base1}/api/projects/${encodeURIComponent(id2)}/active`, { method: 'PUT' });
        assert.equal(res.status, 200);
      }
      {
        const { json } = await getJson(`${base1}/api/projects`);
        assert.equal(json.activeProjectId, id2);
      }
      // verificar file persiste antes de cerrar
      const storePath = pm.getProjectsFilePath();
      const rawBefore = fs.readFileSync(storePath, 'utf8');
      assert.equal(JSON.parse(rawBefore).activeProjectId, id2);
      // GIVEN reinicio: cerrar servidor
      await srv1.close();
      // pequeña pausa para liberar
      await new Promise((r) => setTimeout(r, 50));
      // verificar file sigue con mismo valor tras close (sin corrupcion)
      const rawMid = fs.readFileSync(storePath, 'utf8');
      assert.equal(JSON.parse(rawMid).activeProjectId, id2);
      assert.doesNotThrow(() => JSON.parse(rawMid), 'JSON valido tras reinicio simulado');
      // nuevo servidor con mismo HOME
      const srv2 = createServer({ port: 0, host: '127.0.0.1' });
      const { port: port2 } = await srv2.start();
      const base2 = `http://127.0.0.1:${port2}`;
      try {
        // WHEN GET /api/projects tras reinicio
        const { res, json } = await getJson(`${base2}/api/projects`);
        assert.equal(res.status, 200);
        // THEN persiste ultimo valor
        assert.equal(json.activeProjectId, id2);
        // tambien file no fue alterado por el boot
        const rawAfter = fs.readFileSync(storePath, 'utf8');
        assert.equal(JSON.parse(rawAfter).activeProjectId, id2);
        // re-read directo via pm.listProjects tambien
        const viaPM = await pm.listProjects();
        assert.equal(viaPM.activeProjectId, id2);
        // no tmp residual tras reinicio
        const files = fs.readdirSync(path.join(tmpHome, '.un-specweaver'));
        assert.equal(files.some((f) => f.includes('.tmp.')), false);
      } finally {
        await srv2.close();
      }
    } finally {
      cleanupDirs(...repos);
    }
  });
});

// ---------------------------------------------------------------------------
// E1S4-atomico — verificar invariantes atomicos: tmp+rename, lock, ISO, JSON
// ---------------------------------------------------------------------------

test('E1S4-atomico — escritura atomica: tmp+rename, lock en memoria, JSON valido, sin tmp residual tras serie de conmutaciones', async () => {
  await withIsolatedHome(async (tmpHome) => {
    const repos = [makeTempProject('e1s4at-a-'), makeTempProject('e1s4at-b-'), makeTempProject('e1s4at-c-')];
    try {
      const ids = [];
      for (const repo of repos) {
        const p = await pm.registerProject(repo);
        ids.push(p.id);
      }
      // serie de 6 conmutaciones rapidas (lock debe serializar)
      for (let i = 0; i < 6; i++) {
        const target = ids[i % ids.length];
        await pm.setActiveProject(target);
      }
      const storePath = pm.getProjectsFilePath();
      const raw = fs.readFileSync(storePath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(raw));
      const data = JSON.parse(raw);
      // ultimo valor debe ser ids[2] porque 6 iteraciones: 0->a,1->b,2->c,3->a,4->b,5->c
      const lastExpected = ids[5 % ids.length];
      assert.equal(data.activeProjectId, lastExpected);
      // todos lastActive deben ser ISO
      for (const p of data.projects) {
        assert.match(p.lastActive, ISO_RE, `lastActive ${p.name} ISO`);
        assert.ok(!isNaN(Date.parse(p.lastActive)));
      }
      // no tmp residual
      const files = fs.readdirSync(path.join(tmpHome, '.un-specweaver'));
      assert.equal(files.some((f) => f.includes('.tmp.')), false);
      // fuente debe contener writeAtomic y lock
      const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/project-manager.mjs'), 'utf8');
      assert.match(src, /writeAtomic/, 'pm debe usar writeAtomic');
      assert.match(src, /\.tmp\./, 'writeAtomic debe usar .tmp.');
      assert.match(src, /rename/, 'writeAtomic debe hacer rename');
      assert.match(src, /withLock/, 'setActiveProject debe usar withLock');
      // server tambien debe exponer endpoints active
      const srvSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
      assert.match(srvSrc, /\/api\/projects\/.*\/active/, 'server debe exponer /active');
      assert.match(srvSrc, /setActiveProject/, 'server debe delegar a setActiveProject');
    } finally {
      cleanupDirs(...repos);
    }
  });
});

test('E1S4-AD — project-manager y server no usan process.chdir y son ESM', () => {
  for (const rel of ['../src/dashboard/project-manager.mjs', '../src/dashboard/server.mjs']) {
    const p = path.resolve(import.meta.dirname, rel);
    const src = fs.readFileSync(p, 'utf8');
    assert.doesNotMatch(src, /process\.chdir/, `${rel} no debe usar chdir`);
    assert.match(src, /import .*from|export/, `${rel} debe ser ESM`);
    assert.doesNotMatch(src, /require\(/, `${rel} sin require`);
  }
});
