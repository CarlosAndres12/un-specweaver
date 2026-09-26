import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectStatus, taskProgress, readChanges, sprintStatus } from '../src/status/collect.mjs';
import { renderTerminal, renderHtml } from '../src/status/render.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'bin', 'un-specweaver.mjs');
const BRIDGE = path.join(ROOT, 'bridge', 'cli.mjs');

// Un proyecto a mitad de camino: puente corrido, un change en curso, otro archivado.
function midProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-'));
  fs.cpSync(path.join(ROOT, 'fixtures', 'planning-artifacts'), path.join(dir, '_bmad-output', 'planning-artifacts'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'fixtures', 'epics.sample.md'), path.join(dir, '_bmad-output', 'planning-artifacts', 'epics.md'));
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'archive'), { recursive: true });
  execFileSync('node', [BRIDGE], { cwd: dir, stdio: 'pipe' });
  const t = path.join(dir, 'openspec', 'changes', 'e1s1-registro-de-proveedor-con-nit', 'tasks.md');
  fs.writeFileSync(t, fs.readFileSync(t, 'utf8').replace('- [ ] 1.1', '- [x] 1.1'));
  fs.renameSync(path.join(dir, 'openspec', 'changes', 'e2s1-publicar-orden-de-compra'), path.join(dir, 'openspec', 'changes', 'archive', '2026-09-10-e2s1-publicar-orden-de-compra'));
  return dir;
}

test('taskProgress cuenta casillas y nada mas', () => {
  assert.deepEqual(taskProgress('- [x] 1.1 a\n- [ ] 1.2 b\n- texto suelto\n  - [X] 2.1 c\n'), { done: 2, total: 3 });
  assert.deepEqual(taskProgress(''), { done: 0, total: 0 });
});

test('el estado es una vista: se deriva de disco, no guarda nada', () => {
  const dir = midProject();
  const before = fs.readdirSync(path.join(dir, '.un-specweaver')).sort();
  const s = collectStatus(dir);
  assert.deepEqual(fs.readdirSync(path.join(dir, '.un-specweaver')).sort(), before, 'collect no escribe');

  assert.equal(s.project.name, 'Portal de Proveedores');
  assert.deepEqual(s.phases.map((p) => [p.key, p.done, !!p.partial]), [
    ['understand', false, false], ['decide', false, false], ['decompose', true, false],
    ['translate', true, false], ['build', false, true], ['close', false, true],
  ]);
  assert.deepEqual(s.changes.map((c) => `${c.story}:${c.state}`), ['1.1:in-progress', '1.2:pending', '2.1:archived', '2.2:pending']);
  assert.equal(s.changes.find((c) => c.story === '2.1').archivedAt, '2026-09-10');
  assert.equal(s.changes.find((c) => c.story === '1.1').progress.done, 1);

  // Sprint: la ola actual es la primera con algo sin archivar; bloqueos solo por deps no archivadas.
  assert.equal(s.sprint.current, 1);
  const items = Object.fromEntries(s.sprint.waves.flatMap((w) => w.items).map((i) => [i.story, i]));
  assert.equal(items['1.1'].ready, true);
  assert.deepEqual(items['1.2'].blockedBy, ['1.1']);
  assert.deepEqual(items['2.1'].blockedBy, [], 'archivado: no se reporta bloqueado');
  assert.equal(items['2.2'].ready, true, 'su dependencia 2.1 ya esta archivada');

  // Regla de /sw:build: tasks.md completo tambien satisface una dependencia (nadie archiva a tiempo).
  const t12 = path.join(dir, 'openspec', 'changes', 'e1s1-registro-de-proveedor-con-nit', 'tasks.md');
  fs.writeFileSync(t12, fs.readFileSync(t12, 'utf8').replace(/- \[ \]/g, '- [x]'));
  const s2 = collectStatus(dir);
  const it2 = Object.fromEntries(s2.sprint.waves.flatMap((w) => w.items).map((i) => [i.story, i]));
  assert.equal(it2['1.1'].state, 'done');
  assert.deepEqual(it2['1.2'].blockedBy, [], '1.1 con tareas completas ya no bloquea');
  assert.equal(it2['1.2'].ready, true);
  assert.equal(it2['1.1'].ready, false, 'terminada no es "lista para empezar"');
  assert.equal(s2.sprint.current, 2, 'la ola 1 esta satisfecha');
  assert.equal(s.sprint.totals.ready, 1, 'solo cuenta las pendientes listas para empezar');

  // Requisitos: cobertura del trace + inestabilidad de los memlogs.
  const fr1 = s.requirements.rows.find((r) => r.id === 'FR001');
  assert.deepEqual(fr1.stories, ['1.1']);
  assert.equal(fr1.changes, 4);
  assert.deepEqual(s.requirements.orphans, []);
  assert.equal(s.decisions.total, 12);
  assert.equal(s.decisions.ranking[0].id, 'FR001');

  // Historial: mas reciente primero; el archive y la corrida del puente estan.
  assert.ok(s.timeline.some((e) => e.source === 'openspec' && e.type === 'archived' && e.when === '2026-09-10'));
  assert.ok(s.timeline.some((e) => e.source === 'bridge'));
  assert.ok(s.timeline.every((e, i, a) => i === 0 || String(a[i - 1].when) >= String(e.when)));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('un proyecto vacio no explota: todo pendiente y sin sprint', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-'));
  const s = collectStatus(dir);
  assert.ok(s.phases.every((p) => !p.done));
  assert.equal(s.sprint, null);
  assert.deepEqual(s.changes, []);
  assert.deepEqual(s.requirements.rows, []);
  assert.match(renderTerminal(s, 'es'), /Sin epics\.md/);
  assert.match(renderTerminal(s, 'en'), /No epics\.md/);
  assert.match(renderHtml(s, 'es'), /<!doctype html>/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('una revision -r2 manda sobre la version archivada de la misma story', () => {
  const dir = midProject();
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'e2s1-publicar-orden-de-compra-r2'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', 'e2s1-publicar-orden-de-compra-r2', 'tasks.md'), '- [ ] 1.1 x\n');
  const changes = readChanges(dir, JSON.parse(fs.readFileSync(path.join(dir, '.un-specweaver', 'trace.json'), 'utf8')));
  const r2 = changes.find((c) => c.id.endsWith('-r2'));
  assert.equal(r2.revision, 2);
  assert.equal(r2.story, '2.1');
  const sp = sprintStatus(dir, changes);
  const it = sp.waves.flatMap((w) => w.items).find((i) => i.story === '2.1');
  assert.equal(it.state, 'pending', 'la story vuelve a estar abierta');
  assert.equal(it.changeId, 'e2s1-publicar-orden-de-compra-r2');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('el HTML es autocontenido, bilingue y escapa lo que viene de los archivos', () => {
  const dir = midProject();
  const s = collectStatus(dir);
  s.changes[0].title = '<script>alert(1)</script>';
  for (const lang of ['es', 'en']) {
    const html = renderHtml(s, lang);
    assert.doesNotMatch(html, /<script src=|https?:\/\/cdn|<link /, 'sin CDN ni recursos externos');
    assert.doesNotMatch(html, /<script>alert/, 'escapado');
    assert.match(html, /&lt;script&gt;alert/);
    assert.match(html, lang === 'es' ? /Ola 1/ : /Wave 1/);
    assert.match(html, /FR001/);
    assert.match(html, /2026-09-10/);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('status desde el CLI: terminal, --html escribe el dashboard, --json el modelo', () => {
  const dir = midProject();
  const run = (...a) => execFileSync('node', [CLI, 'status', ...a], { cwd: dir, stdio: 'pipe' }).toString();
  assert.match(run(), /Ola 1 ← ola actual/);
  assert.match(run('--lang', 'en'), /Wave 1 ← current wave/);
  const out = run('--html');
  assert.match(out, /dashboard\.html/);
  assert.ok(fs.existsSync(path.join(dir, '.un-specweaver', 'dashboard.html')));
  const j = JSON.parse(run('--json'));
  assert.equal(j.changes.length, 4);
  fs.rmSync(dir, { recursive: true, force: true });
});
