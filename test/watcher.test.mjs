import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import * as watcher from '../src/dashboard/watcher.mjs';
import { createServer } from '../src/dashboard/server.mjs';

function makeTempProject(prefix = 'watcher-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function cleanupDirs(...dirs) {
  for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
}
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Ensure clean state between tests
function resetWatcher() {
  try { watcher.closeAllWatchers(); } catch {}
  // also reset via test helper if available
  try { watcher._resetForTests(); } catch {}
}

// ---------------------------------------------------------------------------
// S2.3-1: .git / node_modules / dist → 0 eventos
// ---------------------------------------------------------------------------
test('S2.3-1 — GIVEN watcher activo proj-1 WHEN escribo en .git/index | node_modules/foo/index.js | dist/bundle.js THEN 0 eventos FS_CHANGE', async () => {
  const tmp = makeTempProject('watcher-s1-');
  const events = [];
  try {
    // Pre-create ignored dirs before watcher to avoid directory-creation noise
    fs.mkdirSync(path.join(tmp, '.git'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'node_modules', 'foo'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });

    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(120);

    fs.writeFileSync(path.join(tmp, '.git', 'index'), `ref: refs/heads/main ${Date.now()}`);
    fs.writeFileSync(path.join(tmp, 'node_modules', 'foo', 'index.js'), `console.log("${Date.now()}")`);
    fs.writeFileSync(path.join(tmp, 'dist', 'bundle.js'), `// bundle ${Date.now()}`);

    await delay(350);

    assert.equal(events.length, 0, `expected 0 eventos but got ${JSON.stringify(events)}`);

    // Also verify that writing again still 0
    fs.writeFileSync(path.join(tmp, '.git', 'index'), `ref: refs/heads/main ${Date.now()} again`);
    await delay(350);
    assert.equal(events.length, 0, `still expected 0 after second .git write, got ${JSON.stringify(events)}`);
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

test('S2.3-1b — denylist estricto adicional: build, .turbo, .cache → 0 eventos', async () => {
  const tmp = makeTempProject('watcher-s1b-');
  const events = [];
  try {
    fs.mkdirSync(path.join(tmp, 'build'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.turbo'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.cache'), { recursive: true });

    resetWatcher();
    watcher.createWatcher('proj-1b', tmp, (e) => events.push(e));
    await delay(120);

    fs.writeFileSync(path.join(tmp, 'build', 'app.js'), `build ${Date.now()}`);
    fs.writeFileSync(path.join(tmp, '.turbo', 'cache.json'), `{"t":${Date.now()}}`);
    fs.writeFileSync(path.join(tmp, '.cache', 'data.bin'), `cache ${Date.now()}`);

    await delay(350);
    assert.equal(events.length, 0, `expected 0 for build/.turbo/.cache, got ${JSON.stringify(events)}`);
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

// ---------------------------------------------------------------------------
// S2.3-2: epics.md y .spec/** → emite FS_CHANGE con {projectId, file, timestamp}
// ---------------------------------------------------------------------------
test('S2.3-2 — GIVEN escribo en epics.md y .spec/changes/foo/spec.md WHEN watcher observa THEN emite FS_CHANGE con {projectId, file, timestamp}', async () => {
  const tmp = makeTempProject('watcher-s2-');
  const events = [];
  try {
    // Prepare nested .spec dir before watcher to isolate file-write events only
    fs.mkdirSync(path.join(tmp, '.spec', 'changes', 'foo'), { recursive: true });

    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(120);

    fs.writeFileSync(path.join(tmp, 'epics.md'), `# Epic ${Date.now()}\n`);
    fs.writeFileSync(path.join(tmp, '.spec', 'changes', 'foo', 'spec.md'), `# Spec ${Date.now()}\n`);

    await delay(350);

    // Should have at least 2 events (one per file) — debounce per file keeps them separate
    assert.ok(events.length >= 2, `expected >=2 eventos, got ${events.length}: ${JSON.stringify(events)}`);

    const epicsEv = events.find((e) => e.file === 'epics.md');
    const specEv = events.find((e) => e.file === '.spec/changes/foo/spec.md');

    assert.ok(epicsEv, `should emit epics.md, got ${JSON.stringify(events)}`);
    assert.ok(specEv, `should emit .spec/changes/foo/spec.md, got ${JSON.stringify(events)}`);

    for (const ev of [epicsEv, specEv]) {
      assert.equal(ev.type, 'FS_CHANGE');
      assert.equal(ev.projectId, 'proj-1');
      assert.ok(typeof ev.timestamp === 'number', 'timestamp should be number (Date.now())');
      assert.ok(ev.timestamp > 0);
      // file must be posix relative
      assert.doesNotMatch(ev.file, /\\/);
      assert.ok(!path.isAbsolute(ev.file), 'file should be relative posix');
    }

    // Also verify allowlist covers .openspec and specs variants
    events.length = 0;
    fs.mkdirSync(path.join(tmp, '.openspec', 'changes', 'bar'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'specs', 'demo'), { recursive: true });
    await delay(120);
    fs.writeFileSync(path.join(tmp, '.openspec', 'changes', 'bar', 'spec.md'), '# openspec');
    fs.writeFileSync(path.join(tmp, 'specs', 'demo', 'spec.md'), '# specs');
    await delay(350);
    const openspecEv = events.find((e) => e.file === '.openspec/changes/bar/spec.md');
    const specsEv = events.find((e) => e.file === 'specs/demo/spec.md');
    assert.ok(openspecEv, `should emit .openspec/**, got ${JSON.stringify(events)}`);
    assert.ok(specsEv, `should emit specs/**, got ${JSON.stringify(events)}`);

    // epics.*.md variant
    events.length = 0;
    fs.writeFileSync(path.join(tmp, 'epics.foo.md'), '# epics foo');
    await delay(350);
    const epicsFooEv = events.find((e) => e.file === 'epics.foo.md');
    assert.ok(epicsFooEv, `should emit epics.*.md, got ${JSON.stringify(events)}`);
    assert.equal(epicsFooEv.projectId, 'proj-1');
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

// ---------------------------------------------------------------------------
// S2.3-3: ráfaga 10 writes a epics.md en 50 ms → 1 evento coalescado tras 150 ms
// ---------------------------------------------------------------------------
test('S2.3-3 — GIVEN ráfaga 10 writes a epics.md en 50ms WHEN pasa debounce 150ms THEN exactamente 1 evento FS_CHANGE coalescado', async () => {
  const tmp = makeTempProject('watcher-s3-');
  const events = [];
  try {
    resetWatcher();
    watcher.createWatcher('proj-1', tmp, (e) => events.push(e));
    await delay(120);

    // Ensure epics.md exists before burst (so initial creation not counted separately if needed)
    fs.writeFileSync(path.join(tmp, 'epics.md'), 'init');
    await delay(350);
    // reset after init
    events.length = 0;

    // Ráfaga: 10 writes en ~50 ms (5 ms apart)
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(tmp, 'epics.md'), `# epic burst ${i} ${Date.now()}`);
      await delay(5);
    }

    // Antes de 150 ms, aún no debe haber emitido (debounce)
    await delay(80);
    // At 80ms after last write, still within debounce? Last write was ~45ms ago plus 80 = 125 total after last, so still <150
    // But to be safe we check that after 350ms total we get exactly 1
    await delay(270); // total ~350 after last

    assert.equal(events.length, 1, `expected exactly 1 coalesced event, got ${events.length}: ${JSON.stringify(events)}`);
    assert.equal(events[0].type, 'FS_CHANGE');
    assert.equal(events[0].file, 'epics.md');
    assert.equal(events[0].projectId, 'proj-1');
    assert.ok(typeof events[0].timestamp === 'number');

    // Verify that a new write after debounce window emits a second event
    await delay(200);
    events.length = 0;
    fs.writeFileSync(path.join(tmp, 'epics.md'), `# new after debounce ${Date.now()}`);
    await delay(350);
    assert.equal(events.length, 1, `after debounce window, new write should emit 1 more, got ${JSON.stringify(events)}`);

    // Verify per-file debounce: rapid writes to two different files should each emit 1 (not coalesced across files)
    events.length = 0;
    fs.mkdirSync(path.join(tmp, '.spec', 'changes', 'burst'), { recursive: true });
    await delay(120);
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(tmp, 'epics.md'), `epics ${i}`);
      fs.writeFileSync(path.join(tmp, '.spec', 'changes', 'burst', 'spec.md'), `spec ${i}`);
      await delay(5);
    }
    await delay(350);
    // Should have 2 events (one per file key)
    assert.equal(events.length, 2, `expected 2 events for 2 files burst, got ${JSON.stringify(events)}`);
    assert.ok(events.some((e) => e.file === 'epics.md'));
    assert.ok(events.some((e) => e.file === '.spec/changes/burst/spec.md'));
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});

// ---------------------------------------------------------------------------
// S2.3-4: dos proyectos A y B con watchers independientes → aislamiento
// ---------------------------------------------------------------------------
test('S2.3-4 — GIVEN dos proyectos A y B con watchers independientes WHEN escribo epics.md en A THEN solo A emite FS_CHANGE con projectId:A; B no emite', async () => {
  const tmpA = makeTempProject('watcher-A-');
  const tmpB = makeTempProject('watcher-B-');
  const eventsA = [];
  const eventsB = [];
  try {
    resetWatcher();
    watcher.createWatcher('proj-A', tmpA, (e) => eventsA.push(e));
    watcher.createWatcher('proj-B', tmpB, (e) => eventsB.push(e));
    await delay(150);

    // Write only in A
    fs.writeFileSync(path.join(tmpA, 'epics.md'), `# A ${Date.now()}`);
    await delay(350);

    assert.equal(eventsA.length, 1, `A should have 1 event, got ${JSON.stringify(eventsA)}`);
    assert.equal(eventsA[0].projectId, 'proj-A');
    assert.equal(eventsA[0].file, 'epics.md');
    assert.equal(eventsA[0].type, 'FS_CHANGE');
    assert.equal(eventsB.length, 0, `B should have 0 events, got ${JSON.stringify(eventsB)}`);

    // Now write in B only
    eventsA.length = 0;
    eventsB.length = 0;
    fs.writeFileSync(path.join(tmpB, 'epics.md'), `# B ${Date.now()}`);
    await delay(350);
    assert.equal(eventsB.length, 1, `B should now have 1 event after its own write, got ${JSON.stringify(eventsB)}`);
    assert.equal(eventsB[0].projectId, 'proj-B');
    assert.equal(eventsA.length, 0, `A should have 0 after B write, got ${JSON.stringify(eventsA)}`);

    // Write in both concurrently — ensure dirs exist before file writes
    eventsA.length = 0;
    eventsB.length = 0;
    fs.mkdirSync(path.join(tmpA, '.spec', 'changes', 'foo'), { recursive: true });
    fs.writeFileSync(path.join(tmpA, '.spec', 'changes', 'foo', 'spec.md'), '# A spec 2');
    fs.writeFileSync(path.join(tmpB, 'epics.md'), '# B second');
    // Need to ensure dirs exist for B as well? B already has epics.md
    await delay(350);
    // A should have 1 (.spec/...), B 1 (epics.md)
    assert.equal(eventsA.length, 1, `A should have 1 after concurrent, got ${JSON.stringify(eventsA)}`);
    assert.equal(eventsB.length, 1, `B should have 1 after concurrent, got ${JSON.stringify(eventsB)}`);
    assert.equal(eventsA[0].projectId, 'proj-A');
    assert.equal(eventsB[0].projectId, 'proj-B');

    // Verify getWatcher isolation
    assert.ok(watcher.getWatcher('proj-A'), 'getWatcher A should exist');
    assert.ok(watcher.getWatcher('proj-B'), 'getWatcher B should exist');
    assert.equal(watcher.getWatcher('proj-A').projectPath, path.resolve(tmpA));
    assert.equal(watcher.getWatcher('proj-B').projectPath, path.resolve(tmpB));

    // Close A only, B should remain independent
    watcher.closeWatcher('proj-A');
    assert.equal(watcher.getWatcher('proj-A'), null);
    assert.ok(watcher.getWatcher('proj-B'), 'B should remain after closing A');
    eventsA.length = 0;
    eventsB.length = 0;
    fs.writeFileSync(path.join(tmpB, 'epics.md'), `# B after A closed ${Date.now()}`);
    await delay(350);
    assert.equal(eventsB.length, 1, `B should still emit after A closed`);
    assert.equal(eventsA.length, 0, `A should not emit after closed`);
  } finally {
    resetWatcher();
    cleanupDirs(tmpA, tmpB);
  }
});

// ---------------------------------------------------------------------------
// AD checks and API surface
// ---------------------------------------------------------------------------
test('Watcher — exports y contrato ESM, sin process.chdir, debounce 150ms por archivo', async () => {
  assert.equal(typeof watcher.createWatcher, 'function');
  assert.equal(typeof watcher.closeWatcher, 'function');
  assert.equal(typeof watcher.closeAllWatchers, 'function');
  assert.equal(typeof watcher.getWatcher, 'function');
  assert.equal(watcher.DEBOUNCE_MS, 150);

  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/dashboard/watcher.mjs'), 'utf8');
  assert.doesNotMatch(src, /process\.chdir/, 'watcher should not use process.chdir');
  assert.match(src, /import .* from/, 'should be ESM');
  assert.doesNotMatch(src, /require\(/, 'should not use require');
  // Verify Map<key, timeout> pattern (debounce per file)
  assert.match(src, /Map.*timeout|debounceMap|Map.*key/, 'should use Map for debounce');
  // Verify allowlist/denylist strings
  assert.match(src, /\.git/, 'should contain denylist .git');
  assert.match(src, /node_modules/, 'should contain denylist node_modules');
  assert.match(src, /epics\.md/, 'should contain allowlist epics.md');
  assert.match(src, /\.spec/, 'should contain allowlist .spec');
});

test('Watcher — isAllowed / isDenied filtering logic', () => {
  // Allowlist positives
  assert.equal(watcher._isAllowedForTests('epics.md'), true);
  assert.equal(watcher._isAllowedForTests('epics.foo.md'), true);
  assert.equal(watcher._isAllowedForTests('.spec/changes/foo/spec.md'), true);
  assert.equal(watcher._isAllowedForTests('.openspec/spec.md'), true);
  assert.equal(watcher._isAllowedForTests('specs/demo/spec.md'), true);
  assert.equal(watcher._isAllowedForTests('.spec'), true);
  // Denylist
  assert.equal(watcher._isDeniedForTests('.git/index'), true);
  assert.equal(watcher._isDeniedForTests('node_modules/foo/index.js'), true);
  assert.equal(watcher._isDeniedForTests('dist/bundle.js'), true);
  assert.equal(watcher._isDeniedForTests('build/app.js'), true);
  assert.equal(watcher._isDeniedForTests('.turbo/cache'), true);
  assert.equal(watcher._isDeniedForTests('.cache/data'), true);
  // Denylist overrides allowlist: if a .spec file inside node_modules should be denied
  // Our logic checks denied first, so isDenied true and isAllowed also true for ".spec" but denied wins via early return
  assert.equal(watcher._isDeniedForTests('node_modules/.spec/foo'), true);
  // Not allowed
  assert.equal(watcher._isAllowedForTests('README.md'), false);
  assert.equal(watcher._isAllowedForTests('src/index.mjs'), false);
  assert.equal(watcher._isAllowedForTests('.gitignore'), false);
});

test('Watcher — server integration hook: watchProject / unwatchProject / closeAllWatchers no rompe', async () => {
  const srv = createServer({ port: 0, host: '127.0.0.1' });
  const tmp = makeTempProject('watcher-srv-');
  try {
    assert.equal(typeof srv.watchProject, 'function', 'server should expose watchProject');
    assert.equal(typeof srv.unwatchProject, 'function');
    assert.equal(typeof srv.getWatcher, 'function');
    assert.equal(typeof srv.closeAllWatchers, 'function');

    const { port } = await srv.start();
    assert.ok(port > 0);

    // watchProject should succeed
    const ok = srv.watchProject('srv-proj-1', tmp);
    assert.equal(ok, true);
    const rec = srv.getWatcher('srv-proj-1');
    assert.ok(rec, 'watcher should exist after watchProject');
    assert.equal(rec.projectId, 'srv-proj-1');

    // SSE broadcast integration: watch an allowed file and verify broadcast would happen
    // We can't easily assert SSE without client, but we can verify watcher still independent
    await delay(120);
    // Write a file and verify that server's watcher would have captured if we spy broadcast?
    // Simpler: verify that unwatch works
    const closed = srv.unwatchProject('srv-proj-1');
    assert.equal(closed, true);
    assert.equal(srv.getWatcher('srv-proj-1'), null);

    // Re-watch and then close via closeAllWatchers
    srv.watchProject('srv-proj-1', tmp);
    assert.ok(srv.getWatcher('srv-proj-1'));
    srv.closeAllWatchers();
    assert.equal(srv.getWatcher('srv-proj-1'), null);

    // watchProject with invalid path should return false not throw
    const bad = srv.watchProject('bad', '/nonexistent/path/that/does/not/exist');
    assert.equal(bad, false);

    await srv.close();
    // After server close, watchers should be cleaned
    assert.equal(watcher.getWatcher('srv-proj-1'), null);
  } finally {
    try { await srv.close(); } catch {}
    resetWatcher();
    cleanupDirs(tmp);
  }
});

test('Watcher — closeWatcher idempotente y closeAllWatchers limpia debounce timers', async () => {
  const tmp = makeTempProject('watcher-close-');
  try {
    resetWatcher();
    watcher.createWatcher('p1', tmp, () => {});
    assert.ok(watcher.getWatcher('p1'));
    assert.equal(watcher.closeWatcher('p1'), true);
    assert.equal(watcher.getWatcher('p1'), null);
    // second close should be false (already closed)
    assert.equal(watcher.closeWatcher('p1'), false);
    assert.equal(watcher.closeWatcher('nonexistent'), false);

    // closeAll after single
    watcher.createWatcher('p1', tmp, () => {});
    watcher.createWatcher('p2', tmp, () => {});
    assert.ok(watcher.getWatcher('p1'));
    assert.ok(watcher.getWatcher('p2'));
    watcher.closeAllWatchers();
    assert.equal(watcher.getWatcher('p1'), null);
    assert.equal(watcher.getWatcher('p2'), null);
  } finally {
    resetWatcher();
    cleanupDirs(tmp);
  }
});
