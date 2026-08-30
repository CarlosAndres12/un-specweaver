import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import * as pm from '../src/dashboard/project-manager.mjs';
import * as stateAdapter from '../src/dashboard/state-adapter.mjs';
import { createServer } from '../src/dashboard/server.mjs';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function writeEpicsAt(projectPath, epicTitle, storyTitle, given, when, then) {
  const dir = path.join(projectPath, '_bmad-output', 'planning-artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const md = [
    `# Project ${epicTitle}`,
    '',
    `## Epic 1: ${epicTitle}`,
    `Goal for ${epicTitle} — isolated adapter verification.`,
    '',
    `### Story 1.1: ${storyTitle}`,
    `As a dev, I want ${storyTitle}, So that it works for ${epicTitle}.`,
    '',
    `**Acceptance Criteria**`,
    `- **Given** ${given}`,
    `- **When** ${when}`,
    `- **Then** ${then}`,
    '',
  ].join('\n');
  const file = path.join(dir, 'epics.md');
  fs.writeFileSync(file, md, 'utf8');
  return file;
}

// ---------------------------------------------------------------------------
// S1.3-1: GIVEN dos proyectos A y B con epics.md distintos WHEN getEpics via state-adapter THEN cada uno retorna epicas de su propio projectPath sin chdir
// ---------------------------------------------------------------------------
test('S1.3-1 — GIVEN dos proyectos A y B con epics.md distintos WHEN getEpics(projectPathA/B) via state-adapter THEN cada uno retorna epicas propias sin usar process.chdir', async () => {
  const tmpA = makeTempProject('state-a-');
  const tmpB = makeTempProject('state-b-');
  try {
    writeEpicsAt(tmpA, 'Alpha Feature', 'Alpha Story', 'context A', 'do A', 'result A');
    writeEpicsAt(tmpB, 'Beta Feature', 'Beta Story', 'context B', 'do B', 'result B');

    // WHEN getEpicsState A y B via state-adapter con projectPath explicito
    const [stateA, stateB] = await Promise.all([
      stateAdapter.getEpicsState(tmpA),
      stateAdapter.getEpicsState(tmpB),
    ]);

    // THEN cada uno retorna epicas de su propio projectPath
    assert.ok(stateA.all.length > 0, 'A should have epics');
    assert.ok(stateB.all.length > 0, 'B should have epics');
    // Verify titles distinct and isolated (not swapped)
    const titlesA = stateA.all.map((e) => e.title).join('|');
    const titlesB = stateB.all.map((e) => e.title).join('|');
    assert.match(titlesA, /Alpha Story/, 'A should contain Alpha');
    assert.match(titlesB, /Beta Story/, 'B should contain Beta');
    assert.doesNotMatch(titlesA, /Beta Story/, 'A should NOT contain Beta (isolation)');
    assert.doesNotMatch(titlesB, /Alpha Story/, 'B should NOT contain Alpha (isolation)');

    // Also verify source paths are isolated
    assert.equal(stateA.projectPath, path.resolve(tmpA));
    assert.equal(stateB.projectPath, path.resolve(tmpB));
    assert.ok(stateA.source && stateA.source.startsWith(path.resolve(tmpA)), 'A source should be inside A');
    assert.ok(stateB.source && stateB.source.startsWith(path.resolve(tmpB)), 'B source should be inside B');

    // Concurrent second call should remain isolated
    const [againA, againB] = await Promise.all([
      stateAdapter.getEpicsState(tmpA),
      stateAdapter.getEpicsState(tmpB),
    ]);
    assert.equal(againA.all[0].title, stateA.all[0].title);
    assert.equal(againB.all[0].title, stateB.all[0].title);

    // Verify no process.chdir in src/dashboard/* (AD-01)
    const pmSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/project-manager.mjs'), 'utf8');
    const serverSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
    const adapterSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/state-adapter.mjs'), 'utf8');
    const archifySrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/archify-bridge.mjs'), 'utf8');
    const runnerSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/command-runner.mjs'), 'utf8');
    for (const [name, src] of [['project-manager', pmSrc], ['server', serverSrc], ['state-adapter', adapterSrc], ['archify-bridge', archifySrc], ['command-runner', runnerSrc]]) {
      assert.doesNotMatch(src, /process\.chdir/, `${name} should not use process.chdir`);
    }
    // Also grep filesystem via direct check: src/dashboard/state-adapter.mjs must not contain literal process.chdir
    assert.doesNotMatch(adapterSrc, /process\.chdir/);

    // Verify adapter uses projectPath explicit (path.join with projectPath or resolved)
    assert.match(adapterSrc, /projectPath/, 'adapter should reference projectPath');
    assert.match(adapterSrc, /path\.join\(.*projectPath|path\.resolve\(.*projectPath|path\.join\(resolved/, 'adapter should join projectPath');
  } finally {
    cleanupDirs(tmpA, tmpB);
  }
});

test('S1.3-1b — getSprintState tambien aislado por projectPath', async () => {
  const tmpA = makeTempProject('sprint-a-');
  const tmpB = makeTempProject('sprint-b-');
  try {
    // A has epics with 2 stories sequential, B with 1 story
    const dirA = path.join(tmpA, '_bmad-output', 'planning-artifacts');
    fs.mkdirSync(dirA, { recursive: true });
    const mdA = [
      '# Project A',
      '## Epic 1: Epic A',
      'Goal A',
      '### Story 1.1: Story A1',
      'As a dev, I want A1, So that A works.',
      '**Acceptance Criteria**',
      '- **Given** gA1',
      '- **When** wA1',
      '- **Then** tA1',
      '### Story 1.2: Story A2',
      'As a dev, I want A2, So that A2 works.',
      '**Acceptance Criteria**',
      '- **Given** gA2',
      '- **When** wA2',
      '- **Then** tA2',
    ].join('\n');
    fs.writeFileSync(path.join(dirA, 'epics.md'), mdA, 'utf8');

    writeEpicsAt(tmpB, 'Epic B', 'Story B1', 'gB', 'wB', 'tB');

    const [sprintA, sprintB] = await Promise.all([
      stateAdapter.getSprintState(tmpA),
      stateAdapter.getSprintState(tmpB),
    ]);

    assert.ok(sprintA.nodes.length >= 2, 'A should have 2 nodes');
    assert.equal(sprintB.nodes.length, 1, 'B should have 1 node');
    // Isolation: titles differ (both 1.1 but titles distinct), lengths differ proves isolation
    assert.notEqual(sprintA.nodes[0].title, sprintB.nodes[0].title, 'sprint titles should be isolated');
    assert.match(sprintA.nodes[0].title, /A1/, 'A sprint should contain A1');
    assert.match(sprintB.nodes[0].title, /B1/, 'B sprint should contain B1');
    assert.equal(sprintA.projectPath, path.resolve(tmpA));
    assert.equal(sprintB.projectPath, path.resolve(tmpB));
  } finally {
    cleanupDirs(tmpA, tmpB);
  }
});

// ---------------------------------------------------------------------------
// S1.3-2: GIVEN projectId valido WHEN GET /api/projects/:id/state THEN 200 {epics, sprint, git, doctor} agregado sin 500 incluso si faltan artefactos
// ---------------------------------------------------------------------------
test('S1.3-2 — GIVEN projectId valido WHEN GET /api/projects/:id/state THEN 200 {epics, sprint, git, doctor} agregado sin 500', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const tmp = makeTempProject('state-2-');
    try {
      writeEpicsAt(tmp, 'Gabriel Feature', 'Gabriel Story', 'context G', 'do G', 'result G');

      const reg = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      });
      assert.equal(reg.res.status, 201);
      const id = reg.json.project.id;

      const { res, json } = await getJson(`${base}/api/projects/${id}/state`);
      assert.equal(res.status, 200, `expected 200 got ${res.status} ${JSON.stringify(json)}`);
      assert.ok(json.project, 'should have project');
      assert.ok(json.epics, 'should have epics');
      assert.ok(json.sprint !== undefined, 'should have sprint');
      assert.ok(json.git !== undefined, 'should have git');
      assert.ok(json.doctor !== undefined, 'should have doctor');
      // epics shape
      assert.ok(Array.isArray(json.epics.all), 'epics.all should be array');
      assert.ok(json.epics.byStatus, 'epics.byStatus should exist');
      assert.ok('pendiente' in json.epics.byStatus);
      // sprint shape
      assert.ok('active' in json.sprint);
      assert.ok('planned' in json.sprint || Array.isArray(json.sprint.nodes) || Array.isArray(json.sprint.planned));
      // git shape
      assert.ok('branch' in json.git || 'exists' in json.git);
      // doctor shape
      assert.ok('ok' in json.doctor);
      assert.ok(Array.isArray(json.doctor.checks));

      // Verify projectPath explicit: epics.projectPath should be tmp
      assert.equal(json.epics.projectPath, path.resolve(tmp), 'epics should carry projectPath explicit');
      assert.equal(json.project.path, path.resolve(tmp));

      // Verify isolation: project path not confused with cwd
      const cwd = process.cwd();
      assert.notEqual(json.project.path, cwd, 'project path should not be cwd');
    } finally {
      cleanupDirs(tmp);
      await srv.close();
    }
  });
});

test('S1.3-2b — GIVEN project sin artefactos WHEN GET /state THEN 200 estructura vacia sin 500', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const tmp = makeTempProject('state-empty-');
    try {
      // No epics.md, no .spec, no .git — empty directory
      assert.equal(fs.readdirSync(tmp).length, 0);

      const reg = await getJson(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmp }),
      });
      assert.equal(reg.res.status, 201);
      const id = reg.json.project.id;

      const { res, json, text } = await getJson(`${base}/api/projects/${id}/state`);
      assert.equal(res.status, 200, `empty artefacts should still be 200 not 500, got ${res.status} ${text}`);
      // Should contain empty structures, not error 500
      assert.ok(json.epics, 'epics should exist even when empty');
      assert.equal(json.epics.all.length, 0, 'epics.all should be empty when no file');
      assert.ok(json.epics.byStatus, 'byStatus should exist');
      assert.equal(json.epics.byStatus.pendiente.length, 0);
      // sprint empty
      assert.ok(json.sprint, 'sprint should exist');
      assert.equal(json.sprint.active, null);
      // git and doctor should exist without throwing
      assert.ok(json.git !== undefined, 'git should exist');
      assert.ok(json.doctor !== undefined, 'doctor should exist');
      // Ensure no internal error leaked as 500
      assert.notEqual(json.code, 'INTERNAL');
      // Verify source null for empty
      assert.equal(json.epics.source, null);
    } finally {
      cleanupDirs(tmp);
      await srv.close();
    }
  });
});

test('S1.3-2c — getConsolidatedState directo retorna vacio sin 500 cuando faltan artefactos', async () => {
  const tmp = makeTempProject('consolidated-empty-');
  try {
    const state = await stateAdapter.getConsolidatedState(tmp);
    assert.ok(state.project, 'should have project');
    assert.ok(state.epics, 'should have epics');
    assert.equal(state.epics.all.length, 0);
    assert.ok(state.sprint);
    assert.equal(state.sprint.active, null);
    assert.ok(state.git);
    assert.ok(state.doctor);
  } finally {
    cleanupDirs(tmp);
  }
});

// ---------------------------------------------------------------------------
// S1.3-3: GIVEN projectId inexistente WHEN GET /api/projects/:id/state THEN 404 PROJECT_NOT_FOUND tipado
// ---------------------------------------------------------------------------
test('S1.3-3 — GIVEN projectId inexistente WHEN GET /api/projects/:id/state THEN 404 PROJECT_NOT_FOUND tipado', async () => {
  await withIsolatedHome(async () => {
    const srv = createServer({ port: 0, host: '127.0.0.1' });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    try {
      const fakeId = crypto.randomUUID();
      const { res, json } = await getJson(`${base}/api/projects/${fakeId}/state`);
      assert.equal(res.status, 404);
      const code = json.code || json.error?.code;
      assert.equal(code, 'PROJECT_NOT_FOUND', `expected PROJECT_NOT_FOUND got ${JSON.stringify(json)}`);
      assert.ok(json.message || json.error?.message, 'should have message');
      // Ensure not 500 and not generic NOT_FOUND
      assert.notEqual(code, 'INTERNAL');
      assert.notEqual(code, 'NOT_FOUND');
    } finally {
      await srv.close();
    }
  });
});

test('S1.3-3b — getConsolidatedState con id inexistente lanza PROJECT_NOT_FOUND', async () => {
  await withIsolatedHome(async () => {
    const fakeId = crypto.randomUUID();
    let threw = false;
    try {
      await stateAdapter.getConsolidatedState(fakeId);
    } catch (e) {
      threw = true;
      assert.equal(e.code, 'PROJECT_NOT_FOUND');
      assert.equal(e.status, 404);
    }
    assert.ok(threw, 'should throw PROJECT_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// S1.3-4: GIVEN adaptador invoca emit-openspec o plan-sprint WHEN inspecciono invocacion THEN recibe projectPath como argumento explicito o cwd de subprocess, nunca cwd global
// ---------------------------------------------------------------------------
test('S1.3-4 — adaptador invoca emit-openspec/plan-sprint con projectPath explicito o cwd subprocess, nunca cwd global', () => {
  const adapterSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/state-adapter.mjs'), 'utf8');
  // Debe contener projectPath
  assert.match(adapterSrc, /projectPath/, 'should reference projectPath');
  // Debe invocar planSprint y emitChange (bridges)
  assert.match(adapterSrc, /planSprint/, 'should invoke planSprint');
  assert.match(adapterSrc, /emitChange/, 'should invoke emitChange (emit-openspec)');
  // Debe usar path.join con projectPath o cwd explicito con resolved/projectPath
  assert.match(adapterSrc, /path\.join\(.*projectPath|path\.join\(resolved/, 'should join projectPath via path.join');
  // Debe usar cwd explicito para git y subprocess
  assert.match(adapterSrc, /cwd:\s*resolved/, 'should use cwd: resolved (projectPath explicit)');
  // Nunca debe usar process.chdir
  assert.doesNotMatch(adapterSrc, /process\.chdir/);
  // Verificar helpers emitChangeForProject y planSprintForProject reciben projectPath
  assert.match(adapterSrc, /emitChangeForProject\s*\(\s*projectPath/, 'emitChangeForProject should receive projectPath');
  assert.match(adapterSrc, /planSprintForProject\s*\(\s*projectPath/, 'planSprintForProject should receive projectPath');
  // Tambien getEpicsState, getSprintState etc deben tener projectPath param
  assert.match(adapterSrc, /getEpicsState\s*\(\s*projectPath/, 'getEpicsState should take projectPath');
  assert.match(adapterSrc, /getSprintState\s*\(\s*projectPath/, 'getSprintState should take projectPath');
  assert.match(adapterSrc, /getGitState\s*\(\s*projectPath/, 'getGitState should take projectPath');
  assert.match(adapterSrc, /getDoctorState\s*\(\s*projectPath/, 'getDoctorState should take projectPath');
  assert.match(adapterSrc, /getConsolidatedState\s*\(\s*projectIdOrPath/, 'getConsolidatedState should take idOrPath');
  // Verificar que getSprintState internamente llama getEpicsState(projectPath) y planSprint(doc) con origen projectPath
  assert.match(adapterSrc, /getEpicsState\s*\(\s*resolved/, 'getSprintState should call getEpicsState with resolved projectPath');
  assert.match(adapterSrc, /planSprint\s*\(\s*doc/, 'should call planSprint(doc) where doc came from projectPath');

  // Verificar server tambien delega con projectPath explicito sin chdir
  const serverSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/server.mjs'), 'utf8');
  assert.doesNotMatch(serverSrc, /process\.chdir/);
  assert.match(serverSrc, /stateAdapter\.getConsolidatedState/, 'server should delegate to stateAdapter.getConsolidatedState');
  assert.match(serverSrc, /tryGetConsolidatedState/, 'server should use tryGetConsolidatedState that delegates');
});

test('S1.3-4b — runtime: planSprint y emitChange wrappers usan projectPath explicito', async () => {
  const tmp = makeTempProject('emit-plan-');
  try {
    writeEpicsAt(tmp, 'Wrap Epic', 'Wrap Story', 'g', 'w', 't');
    const epicsState = await stateAdapter.getEpicsState(tmp);
    assert.ok(epicsState.doc, 'should have doc');
    const epic = epicsState.doc.epics[0];
    const story = epic.stories[0];

    // planSprintForProject debe funcionar con projectPath explicito
    const plan = stateAdapter.planSprintForProject(tmp, epicsState.doc);
    assert.ok(plan.nodes.length > 0);
    assert.ok(Array.isArray(plan.waves));

    // emitChangeForProject debe funcionar con projectPath explicito
    const emitted = stateAdapter.emitChangeForProject(tmp, epic, story, new Set(), 'es');
    assert.ok(emitted.id, 'should have change id');
    assert.ok(emitted.capability, 'should have capability');
    assert.ok(emitted.files, 'should have files');
    // Verify files contain spec path that uses capability derived from epic
    const specKey = `specs/${emitted.capability}/spec.md`;
    assert.ok(emitted.files[specKey], `should have ${specKey}`);

    // Verify that getGitState uses cwd explicito (call it)
    const git = await stateAdapter.getGitState(tmp);
    assert.ok('exists' in git, 'git state should have exists');
    assert.equal(git.projectPath, path.resolve(tmp));
  } finally {
    cleanupDirs(tmp);
  }
});

test('S1.3-extra — ESM estricto y exports completos', async () => {
  assert.equal(typeof stateAdapter.getEpicsState, 'function');
  assert.equal(typeof stateAdapter.getSprintState, 'function');
  assert.equal(typeof stateAdapter.getDoctorState, 'function');
  assert.equal(typeof stateAdapter.getGitState, 'function');
  assert.equal(typeof stateAdapter.getConsolidatedState, 'function');
  assert.equal(typeof stateAdapter.emitChangeForProject, 'function');
  assert.equal(typeof stateAdapter.planSprintForProject, 'function');

  // Index barrel should re-export
  const indexSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/index.mjs'), 'utf8');
  assert.match(indexSrc, /getEpicsState/);
  assert.match(indexSrc, /getSprintState/);
  assert.match(indexSrc, /getConsolidatedState/);
  assert.match(indexSrc, /state-adapter/);

  // Check ESM syntax (no require)
  const adapterSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/state-adapter.mjs'), 'utf8');
  assert.match(adapterSrc, /import .* from/);
  assert.doesNotMatch(adapterSrc, /require\(/);
});
