import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as pm from '../src/dashboard/project-manager.mjs';
import { createServer } from '../src/dashboard/server.mjs';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

// ------------------------------------------------------------
// Story 1.2 — Scenario 1: GIVEN ruta absoluta vacía WHEN POST /api/projects/init THEN 201 + .spec + register with cwd
// ------------------------------------------------------------
test('S1.2-1 — GIVEN ruta absoluta vacía WHEN POST /api/projects/init THEN ejecuta init con {cwd} crea .spec registra y retorna 201', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const tmp = makeTempProject('init-empty-');
    try {
      // GIVEN vacía absoluta existente
      assert.ok(fs.existsSync(tmp));
      assert.ok(path.isAbsolute(tmp));
      assert.equal(fs.readdirSync(tmp).length, 0, 'should be empty');

      // WHEN POST /api/projects/init
      const { res, json } = await getJson(`${base}/api/projects/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      });

      // THEN 201 {project}
      assert.equal(res.status, 201, `expected 201 got ${res.status} body ${JSON.stringify(json)}`);
      assert.ok(json.project, 'should return project');
      assert.match(json.project.id, UUID_V4_RE);
      assert.equal(json.project.path, fs.realpathSync(path.resolve(tmp)));
      assert.ok(json.project.createdAt);
      assert.ok(json.project.lastActive);
      assert.match(json.project.createdAt, ISO8601_RE);
      assert.match(json.project.lastActive, ISO8601_RE);

      // crea .spec (o specDir)
      const specDir = json.project.specDir;
      assert.ok(specDir === '.spec' || specDir === '.openspec' || specDir === 'specs' || specDir === '.spec', `specDir should be .spec, got ${specDir}`);
      // Verify .spec directory exists on filesystem
      const expectedSpecPath = path.join(fs.realpathSync(path.resolve(tmp)), '.spec');
      assert.ok(fs.existsSync(expectedSpecPath), '.spec should exist on fs');
      assert.ok(fs.statSync(expectedSpecPath).isDirectory());

      // registra: GET /api/projects should contain it
      const list = await getJson(`${base}/api/projects`);
      assert.equal(list.res.status, 200);
      const found = list.json.projects.find((p) => p.id === json.project.id);
      assert.ok(found, 'project should appear in list');
      assert.equal(found.specDir, '.spec');
      assert.equal(found.exists, true);
      assert.equal(found.specExists, true);

      // Validate initProject uses explicit cwd/dir (no chdir)
      const pmSrc = fs.readFileSync(path.join(import.meta.dirname, '../src/dashboard/project-manager.mjs'), 'utf8');
      assert.match(pmSrc, /initProject/);
      assert.doesNotMatch(pmSrc, /process\.chdir/);
      // Check that init is called with cwd/dir explicit
      assert.match(pmSrc, /cwd:\s*canonical|dir:\s*canonical/);

      const serverSrc = fs.readFileSync(path.join(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
      assert.doesNotMatch(serverSrc, /process\.chdir/);
    } finally {
      cleanupDirs(tmp);
      await srv.close();
    }
  });
});

test('S1.2-1b — GIVEN ruta con .spec existente WHEN POST /api/projects/init THEN adopt (no sobrescribe) y registra', async () => {
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('init-adopt-');
    try {
      // Create .spec beforehand
      fs.mkdirSync(path.join(tmp, '.spec'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.spec', 'existing.md'), 'existing');

      // Direct project-manager initProject adopt
      const proj = await pm.initProject(tmp);
      assert.match(proj.id, UUID_V4_RE);
      assert.equal(proj.specDir, '.spec');
      // Ensure adopt did not delete existing file
      assert.ok(fs.existsSync(path.join(tmp, '.spec', 'existing.md')));

      // Cleanup for second part: try server adopt
    } finally {
      cleanupDirs(tmp);
    }

    // Also test via server with pre-existing spec
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const tmp2 = makeTempProject('init-adopt-srv-');
    try {
      fs.mkdirSync(path.join(tmp2, '.openspec'), { recursive: true });
      const { res, json } = await getJson(`${base}/api/projects/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp2 }),
      });
      assert.equal(res.status, 201);
      assert.equal(json.project.specDir, '.openspec');
      assert.ok(fs.existsSync(path.join(tmp2, '.openspec')));
    } finally {
      cleanupDirs(tmp2);
      await srv.close();
    }
  });
});

test('S1.2-1c — initProject usa {cwd: projectPath} o {dir: projectPath} sin chdir (verificacion estática)', () => {
  const pmSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/project-manager.mjs'), 'utf8');
  assert.match(pmSrc, /fileURLToPath|import/);
  assert.doesNotMatch(pmSrc, /process\.chdir/);
  // Must contain explicit cwd/dir passing to init
  assert.match(pmSrc, /init\s*\(\s*\{[^}]*\b(dir|cwd)\b[^}]*canonical[^}]*\}/);
});

// ------------------------------------------------------------
// Story 1.2 — Scenario 2: GIVEN POST /api/projects/init con path no absoluto o inexistente WHEN valida THEN 400 INVALID_PATH y no invoca init
// ------------------------------------------------------------
test('S1.2-2 — GIVEN POST /api/projects/init path no absoluto o inexistente WHEN valida THEN 400 INVALID_PATH y no invoca init', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    try {
      // 1) relativo
      {
        const { res, json } = await getJson(`${base}/api/projects/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'relativo/repo' }),
        });
        assert.equal(res.status, 400);
        const code = json.code || json.error?.code;
        assert.equal(code, 'INVALID_PATH');
        assert.doesNotMatch(JSON.stringify(json), /\n\s+at\s+/);
      }
      // 2) inexistente absoluto
      {
        const noExist = path.join(os.tmpdir(), `noexist-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const { res, json } = await getJson(`${base}/api/projects/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: noExist }),
        });
        assert.equal(res.status, 400);
        const code = json.code || json.error?.code;
        assert.equal(code, 'INVALID_PATH');
        // No debe haber creado .spec en path inexistente
        assert.equal(fs.existsSync(noExist), false);
      }
      // 3) path es archivo no directorio
      {
        const tmpFile = path.join(os.tmpdir(), `unsw-file-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        fs.writeFileSync(tmpFile, 'hello');
        try {
          const { res, json } = await getJson(`${base}/api/projects/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: tmpFile }),
          });
          assert.equal(res.status, 400);
          const code = json.code || json.error?.code;
          assert.equal(code, 'INVALID_PATH');
        } finally {
          try { fs.unlinkSync(tmpFile); } catch {}
        }
      }
      // 4) missing path
      {
        const { res, json } = await getJson(`${base}/api/projects/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.equal(res.status, 400);
        const code = json.code || json.error?.code;
        assert.equal(code, 'INVALID_PATH');
      }
      // 5) no debe haber invocado init ni creado proyecto: list should be empty
      {
        const list = await getJson(`${base}/api/projects`);
        assert.equal(list.res.status, 200);
        // No projects should have been created from invalid attempts
        // We haven't created any valid ones in this subtest, so should be 0
        assert.equal(list.json.projects.length, 0);
      }

      // Also test directly via pm.initProject that it throws and does not create .spec
      const tmpValidParent = os.tmpdir();
      const fakeInvalid = path.join(tmpValidParent, `fake-nonexist-${Date.now()}`);
      let threw = false;
      try {
        await pm.initProject(fakeInvalid);
      } catch (e) {
        threw = true;
        assert.equal(e.code, 'INVALID_PATH');
        assert.equal(e.status, 400);
      }
      assert.ok(threw, 'should throw INVALID_PATH');
      assert.equal(fs.existsSync(fakeInvalid), false, 'should not have created directory');

      // Relative should also throw without creating
      try {
        await pm.initProject('relative/path');
        assert.fail('should have thrown');
      } catch (e) {
        assert.equal(e.code, 'INVALID_PATH');
      }
    } finally {
      await srv.close();
    }
  });
});

test('S1.2-2b — server.mjs POST /api/projects/init no expone stack en 400', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    try {
      const { json, text } = await getJson(`${base}/api/projects/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'relativo' }),
      });
      assert.doesNotMatch(text, /at\s+.*project-manager|stack/i);
      assert.ok(json.error || json.code);
    } finally {
      await srv.close();
    }
  });
});

// ------------------------------------------------------------
// Story 1.2 — Scenario 3: GIVEN inicialización exitosa WHEN GET /api/projects THEN aparece con specDir y createdAt/lastActive ISO-8601
// ------------------------------------------------------------
test('S1.2-3 — GIVEN inicialización exitosa WHEN GET /api/projects THEN proyecto con specDir correcto y timestamps ISO-8601', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const tmp = makeTempProject('init-iso-');
    try {
      const { res, json } = await getJson(`${base}/api/projects/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      });
      assert.equal(res.status, 201);
      const created = json.project;

      // Verify timestamps ISO-8601
      assert.ok(created.createdAt);
      assert.ok(created.lastActive);
      assert.match(created.createdAt, ISO8601_RE, 'createdAt ISO-8601');
      assert.match(created.lastActive, ISO8601_RE, 'lastActive ISO-8601');
      assert.ok(!isNaN(Date.parse(created.createdAt)));
      assert.ok(!isNaN(Date.parse(created.lastActive)));

      // WHEN GET /api/projects
      const list = await getJson(`${base}/api/projects`);
      assert.equal(list.res.status, 200);
      const found = list.json.projects.find((p) => p.id === created.id);
      assert.ok(found, 'should be in list');

      // THEN specDir correcto
      assert.equal(found.specDir, '.spec');
      assert.equal(found.specExists, true);
      assert.equal(found.exists, true);

      // timestamps in list also ISO-8601
      assert.match(found.createdAt, ISO8601_RE);
      assert.match(found.lastActive, ISO8601_RE);
      assert.ok(!isNaN(Date.parse(found.createdAt)));

      // Also verify GET /api/projects/:id returns enriched? Check via list enrichment
      // Directly via pm.listProjects also
      const pmList = await pm.listProjects();
      const pmFound = pmList.projects.find((p) => p.id === created.id);
      assert.ok(pmFound);
      assert.equal(pmFound.specDir, '.spec');
      assert.match(pmFound.createdAt, ISO8601_RE);
    } finally {
      cleanupDirs(tmp);
      await srv.close();
    }
  });
});

test('S1.2-3b — initProject registra con specDir y timestamps ISO-8601 (unitario)', async () => {
  await withIsolatedHome(async () => {
    const tmp = makeTempProject('init-unit-iso-');
    try {
      const proj = await pm.initProject(tmp);
      assert.match(proj.id, UUID_V4_RE);
      assert.equal(proj.specDir, '.spec');
      assert.match(proj.createdAt, ISO8601_RE);
      assert.match(proj.lastActive, ISO8601_RE);

      const list = await pm.listProjects();
      const found = list.projects.find((p) => p.id === proj.id);
      assert.ok(found);
      assert.equal(found.specDir, '.spec');
      assert.match(found.createdAt, ISO8601_RE);
      assert.match(found.lastActive, ISO8601_RE);

      // Verify .spec exists
      assert.ok(fs.existsSync(path.join(tmp, '.spec')));
    } finally {
      cleanupDirs(tmp);
    }
  });
});

test('AD-01 — initProject y server no usan process.chdir', () => {
  const pmSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/project-manager.mjs'), 'utf8');
  const srvSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
  assert.doesNotMatch(pmSrc, /process\.chdir/);
  assert.doesNotMatch(srvSrc, /process\.chdir/);
  // project-manager must export initProject
  assert.match(pmSrc, /export async function initProject/);
});

test('AD-02/AD-08 — initProject valida absoluta+existe y delega con cwd explícito', () => {
  const pmSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/project-manager.mjs'), 'utf8');
  // Validación absoluta
  assert.match(pmSrc, /canonicalPath/);
  assert.match(pmSrc, /path\.isAbsolute|isAbsolute/);
  // Delegación con cwd/dir explícito sin chdir
  assert.match(pmSrc, /dir:\s*canonical/);
  assert.match(pmSrc, /cwd:\s*canonical/);
});
