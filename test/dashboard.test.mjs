import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// project-manager under test
import * as pm from '../src/dashboard/project-manager.mjs';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Helper: run callback with isolated HOME/tmp homedir.
// Patches os.homedir() so pm's getStoreDir() points to temp.
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
    try {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    } catch {}
  }
}

function makeTempProject(prefix = 'proj-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupDirs(...dirs) {
  for (const d of dirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// 1. POST 201 — crea dir, uuid, name, tmp+rename, path canónico
// ---------------------------------------------------------------------------

test('S1.1 — GIVEN projects.json no existe WHEN POST /api/projects {path} THEN 201 con id UUID, name basename, path canónico y persistencia atómica', async () => {
  await withIsolatedHome(async (tmpHome) => {
    const repoA = makeTempProject('repo-a-');
    try {
      // GIVEN no existe store
      const storePath = pm.getProjectsFilePath();
      assert.equal(fs.existsSync(storePath), false);
      assert.equal(fs.existsSync(path.join(tmpHome, '.un-specweaver')), false);

      // WHEN register
      const project = await pm.registerProject(repoA);

      // THEN dir creado
      assert.equal(fs.existsSync(path.join(tmpHome, '.un-specweaver')), true);
      assert.equal(fs.existsSync(storePath), true);

      // id UUID v4
      assert.match(project.id, UUID_V4_RE);
      // name derivado de basename
      assert.equal(project.name, path.basename(repoA));
      // path canónico absoluto
      const expectedCanonical = fs.realpathSync(path.resolve(repoA));
      assert.equal(project.path, expectedCanonical);
      assert.ok(path.isAbsolute(project.path));
      // timestamps ISO-8601
      assert.ok(!isNaN(Date.parse(project.createdAt)));
      assert.ok(!isNaN(Date.parse(project.lastActive)));
      // persistido atomico: archivo JSON válido, contiene 1 proyecto
      const raw = fs.readFileSync(storePath, 'utf8');
      const data = JSON.parse(raw);
      assert.equal(data.projects.length, 1);
      assert.equal(data.projects[0].id, project.id);
      assert.equal(data.projects[0].path, expectedCanonical);
      // tmp+rename: no debe quedar .tmp file residual
      const storeDirFiles = fs.readdirSync(path.join(tmpHome, '.un-specweaver'));
      assert.equal(storeDirFiles.some((f) => f.includes('.tmp.')), false, 'no tmp residual');
      // JSON válido
      assert.doesNotThrow(() => JSON.parse(fs.readFileSync(storePath, 'utf8')));
    } finally {
      cleanupDirs(repoA);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. 409 DUPLICATE tipado, no duplica (trailing slash / symlink)
// ---------------------------------------------------------------------------

test('S1.2 — GIVEN proyecto registrado WHEN POST mismo path con trailing slash o symlink THEN 409 DUPLICATE sin duplicar', async () => {
  await withIsolatedHome(async () => {
    const repoA = makeTempProject('repo-dup-');
    try {
      const first = await pm.registerProject(repoA);
      assert.match(first.id, UUID_V4_RE);

      // WHEN con trailing slash
      const withSlash = repoA.endsWith(path.sep) ? repoA : repoA + path.sep;
      await assert.rejects(() => pm.registerProject(withSlash), (err) => {
        assert.equal(err.code, 'DUPLICATE');
        assert.equal(err.status, 409);
        assert.match(err.message, /already registered/i);
        // no stack exposure check: message no debe contener "at "
        assert.doesNotMatch(err.message, /\n\s+at\s+/);
        return true;
      });

      // WHEN con symlink (si el FS lo permite)
      const linkPath = path.join(os.tmpdir(), `unsw-link-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      let symlinkCreated = false;
      try {
        fs.symlinkSync(repoA, linkPath);
        symlinkCreated = true;
        await assert.rejects(() => pm.registerProject(linkPath), (err) => {
          assert.equal(err.code, 'DUPLICATE');
          assert.equal(err.status, 409);
          return true;
        });
      } catch (e) {
        // si symlink falla (Windows o permisos), no fallar test — ya probamos trailing slash
        if (symlinkCreated) throw e;
      } finally {
        try { fs.unlinkSync(linkPath); } catch {}
      }

      // THEN no duplica: solo 1 proyecto
      const { projects } = await pm.listProjects();
      assert.equal(projects.length, 1);
      assert.equal(projects[0].path, fs.realpathSync(path.resolve(repoA)));

      // también verificar store file sigue con 1
      const storePath = pm.getProjectsFilePath();
      const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      assert.equal(data.projects.length, 1);
    } finally {
      cleanupDirs(repoA);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. 400 INVALID_PATH — relativo o inexistente, sin crear entrada ni stack
// ---------------------------------------------------------------------------

test('S1.3 — GIVEN POST con path relativo o inexistente WHEN valida THEN 400 INVALID_PATH sin crear entrada ni exponer stack', async () => {
  await withIsolatedHome(async () => {
    const storePath = pm.getProjectsFilePath();

    // relativo
    await assert.rejects(() => pm.registerProject('relativo/repo'), (err) => {
      assert.equal(err.code, 'INVALID_PATH');
      assert.equal(err.status, 400);
      // no expone stack
      assert.doesNotMatch(err.message, /\n\s+at\s+/);
      assert.doesNotMatch(err.stack || '', /INVALID_PATH.*\n.*at.*project-manager/);
      // mensaje no debe contener traza cruda
      return true;
    });

    // inexistente absoluto
    const noExist = path.join(os.tmpdir(), `noexiste-${Date.now()}-${crypto.randomUUID()}`);
    await assert.rejects(() => pm.registerProject(noExist), (err) => {
      assert.equal(err.code, 'INVALID_PATH');
      assert.equal(err.status, 400);
      return true;
    });

    // path es archivo no directorio
    const tmpFile = path.join(os.tmpdir(), `unsw-file-${Date.now()}`);
    fs.writeFileSync(tmpFile, 'hello');
    try {
      await assert.rejects(() => pm.registerProject(tmpFile), (err) => {
        assert.equal(err.code, 'INVALID_PATH');
        assert.equal(err.status, 400);
        return true;
      });
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    // THEN sin crear entrada
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      if (raw.trim()) {
        const data = JSON.parse(raw);
        assert.equal(data.projects.length, 0);
      }
    } else {
      // si no existe, también es válido (no se creó)
      assert.equal(fs.existsSync(storePath), false);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. GET 200 con specDir detectado y salud exists/specExists
// ---------------------------------------------------------------------------

test('S1.4 — GIVEN 2 proyectos (.spec vs .openspec) WHEN GET /api/projects THEN 200 {projects, activeProjectId} con specDir y salud', async () => {
  await withIsolatedHome(async () => {
    const repoSpec = makeTempProject('repo-spec-');
    const repoOpenspec = makeTempProject('repo-openspec-');
    try {
      // preparar .spec en uno y .openspec en otro
      fs.mkdirSync(path.join(repoSpec, '.spec'), { recursive: true });
      fs.mkdirSync(path.join(repoOpenspec, '.openspec'), { recursive: true });

      const p1 = await pm.registerProject(repoSpec);
      const p2 = await pm.registerProject(repoOpenspec);

      // también verificar que detectSpecDir funciona aislado
      assert.equal(pm.detectSpecDir(repoSpec), '.spec');
      assert.equal(pm.detectSpecDir(repoOpenspec), '.openspec');
      assert.equal(p1.specDir, '.spec');
      assert.equal(p2.specDir, '.openspec');

      // WHEN listProjects (equiv GET)
      const result = await pm.listProjects();
      assert.equal(result.projects.length, 2);
      assert.ok('activeProjectId' in result);

      const foundSpec = result.projects.find((p) => p.path === fs.realpathSync(path.resolve(repoSpec)));
      const foundOpenspec = result.projects.find((p) => p.path === fs.realpathSync(path.resolve(repoOpenspec)));
      assert.ok(foundSpec, 'debe contener proyecto .spec');
      assert.ok(foundOpenspec, 'debe contener proyecto .openspec');

      // cada uno incluye specDir detectado y salud
      assert.equal(foundSpec.specDir, '.spec');
      assert.equal(foundSpec.exists, true);
      assert.equal(foundSpec.specExists, true);

      assert.equal(foundOpenspec.specDir, '.openspec');
      assert.equal(foundOpenspec.exists, true);
      assert.equal(foundOpenspec.specExists, true);

      // proyecto sin spec dir => specExists false
      const repoPlain = makeTempProject('repo-plain-');
      try {
        const pPlain = await pm.registerProject(repoPlain);
        assert.equal(pPlain.specDir, null);
        const after = await pm.listProjects();
        const foundPlain = after.projects.find((p) => p.id === pPlain.id);
        assert.equal(foundPlain.specDir, null);
        assert.equal(foundPlain.exists, true);
        assert.equal(foundPlain.specExists, false);
      } finally {
        cleanupDirs(repoPlain);
      }

      // validar que spec canónico absoluta no usa chdir y que detecta specs/ fallback
      const repoSpecs = makeTempProject('repo-specs-');
      try {
        fs.mkdirSync(path.join(repoSpecs, 'specs'), { recursive: true });
        assert.equal(pm.detectSpecDir(repoSpecs), 'specs');
      } finally {
        cleanupDirs(repoSpecs);
      }
    } finally {
      cleanupDirs(repoSpec, repoOpenspec);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Concurrencia 5 POST simultáneos sin corrupción (JSON válido, tmp+rename, lock)
// ---------------------------------------------------------------------------

test('S1.5 — GIVEN 5 POST concurrentes paths distintos WHEN todos persisten THEN projects.json final contiene 5 sin corrupción (JSON válido, tmp+rename, lock)', async () => {
  await withIsolatedHome(async (tmpHome) => {
    const repos = Array.from({ length: 5 }, (_, i) => makeTempProject(`repo-conc-${i}-`));
    try {
      // WHEN 5 concurrentes
      const results = await Promise.all(repos.map((p) => pm.registerProject(p)));
      assert.equal(results.length, 5);
      // ids únicos
      const ids = results.map((r) => r.id);
      assert.equal(new Set(ids).size, 5);
      // cada uno UUID v4
      for (const id of ids) assert.match(id, UUID_V4_RE);

      // THEN file contiene 5 sin corrupción
      const storePath = pm.getProjectsFilePath();
      assert.ok(fs.existsSync(storePath));
      const raw = fs.readFileSync(storePath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(raw), 'JSON debe ser válido tras concurrencia');
      const data = JSON.parse(raw);
      assert.equal(data.projects.length, 5);
      // paths corresponden a los 5 canónicos
      const canonicalRepos = repos.map((p) => fs.realpathSync(path.resolve(p))).sort();
      const storedPaths = data.projects.map((p) => p.path).sort();
      assert.deepEqual(storedPaths, canonicalRepos);

      // tmp+rename: no tmp residual
      const files = fs.readdirSync(path.join(tmpHome, '.un-specweaver'));
      assert.equal(files.some((f) => f.includes('.tmp.')), false);

      // lock: verificar que no hay corrupción intercalada (doble parse ya hecho)
      // también listar via API debe dar 5
      const listed = await pm.listProjects();
      assert.equal(listed.projects.length, 5);

      // verificar también que no hay .bak corrupto innecesario
      const hasBak = files.some((f) => f.startsWith('projects.json.bak.'));
      // si hubo corrupción, habría bak; pero en este caso no debe haber (o puede haber 0)
      // No asertamos estrictamente, solo que JSON válido ya verificó que no hubo corrupción.
    } finally {
      cleanupDirs(...repos);
    }
  });
});

// ---------------------------------------------------------------------------
// Adicional: integridad general y contrato AD-01 (no chdir)
// ---------------------------------------------------------------------------

test('AD-01 — project-manager no usa process.chdir', () => {
  const pmPath = path.resolve(import.meta.dirname, '../src/dashboard/project-manager.mjs');
  const src = fs.readFileSync(pmPath, 'utf8');
  assert.doesNotMatch(src, /process\.chdir/);
});

test('AD-02 — project-manager usa writeAtomic tmp+rename', () => {
  const pmPath = path.resolve(import.meta.dirname, '../src/dashboard/project-manager.mjs');
  const src = fs.readFileSync(pmPath, 'utf8');
  assert.match(src, /writeAtomic/);
  assert.match(src, /\.tmp\./);
  assert.match(src, /rename/);
});

test('AD-08 — canonicalPath valida absolute y existe', () => {
  // ya cubierto en S1.3 pero reforzar: detectSpecDir no debe lanzar
  assert.equal(pm.detectSpecDir('/tmp/noexiste-tmp-xyz-12345'), null);
});

test('recuperación de JSON corrupto no crashea y hace backup', async () => {
  await withIsolatedHome(async (tmpHome) => {
    const repoA = makeTempProject('repo-corrupt-a-');
    try {
      // crear un projects.json corrupto manualmente
      const storeDir = pm.getStoreDir();
      fs.mkdirSync(storeDir, { recursive: true });
      const storePath = pm.getProjectsFilePath();
      fs.writeFileSync(storePath, '{ corrupt json [', 'utf8');
      assert.ok(fs.existsSync(storePath));

      // WHEN listProjects debe recuperar sin crash
      const first = await pm.listProjects();
      // THEN resetea a vacío
      assert.equal(first.projects.length, 0);
      // y hace backup
      const files = fs.readdirSync(storeDir);
      const bak = files.find((f) => f.startsWith('projects.json.bak.'));
      assert.ok(bak, 'debe crear backup del corrupto');

      // registro después debe funcionar normal
      const p = await pm.registerProject(repoA);
      assert.match(p.id, UUID_V4_RE);
      const after = await pm.listProjects();
      assert.equal(after.projects.length, 1);
    } finally {
      cleanupDirs(repoA);
    }
  });
});

test('name explícito respeta override y deriva correctamente', async () => {
  await withIsolatedHome(async () => {
    const repo = makeTempProject('repo-name-');
    try {
      const withName = await pm.registerProject(repo, 'Mi Proyecto');
      assert.equal(withName.name, 'Mi Proyecto');
      // segundo proyecto con nombre distinto implícito
      const repo2 = makeTempProject('another-repo-xyz-');
      try {
        const p2 = await pm.registerProject(repo2);
        assert.equal(p2.name, path.basename(fs.realpathSync(path.resolve(repo2))));
      } finally {
        cleanupDirs(repo2);
      }
    } finally {
      cleanupDirs(repo);
    }
  });
});
