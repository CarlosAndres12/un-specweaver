import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
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

  // La cobertura sale de epics.md, no del trace: un trace danado no puede decir "sin story".
  fs.writeFileSync(path.join(dir, '.un-specweaver', 'trace.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(dir, '.un-specweaver', 'trace.json'), 'utf8')), changes: [] }));
  const s3 = collectStatus(dir);
  assert.deepEqual(s3.requirements.rows.find((r) => r.id === 'FR001').stories, ['1.1']);
  assert.equal(s3.metrics.requirements.coveragePct, 100);

  // FR completado = todas sus stories terminadas o archivadas. FR003 lo cubre 2.1 (archivada).
  assert.equal(s.requirements.rows.find((r) => r.id === 'FR003').done, true);
  assert.equal(s.requirements.rows.find((r) => r.id === 'FR001').done, false, '1.1 a medias');
  assert.equal(s.metrics.requirements.done, 1);
  // FR005 esta eliminado en el fixture: no es vivo, no es huerfano, y el inventario viene de epics.md.
  assert.equal(s.metrics.requirements.fr, 4); assert.equal(s.metrics.requirements.removed, 1);
  assert.ok(s.requirements.rows.find((r) => r.id === 'FR005').removed);
  assert.equal(s.metrics.requirements.coveragePct, 100);
  assert.ok(s.changes[0].tasks.length > 0 && 'done' in s.changes[0].tasks[0], 'las tareas llevan texto y estado');
  assert.equal(s.changes[0].tasks[0].n, '1.1'); assert.match(s.changes[0].tasks[0].section, /Implementacion/);
  assert.ok(s.metrics.activity.some((d) => d.date === '2026-09-10' && d.archived === 1), 'la actividad por dia registra el archive');
  assert.ok(s.metrics.activity.every((d) => 'commits' in d), 'los commits de git entran en la actividad (0 si no hay repo)');
  assert.ok(s.activityDetail['2026-09-10'].archived.some((a) => a.story === '2.1'), 'el detalle por dia trae que se archivo');
  assert.ok(s.documents.some((x) => x.memlog && x.kind === 'prds' && /FR001/.test(x.text)), 'los memlogs viajan con su texto');
  assert.equal(s.decisions.all.length, 12, 'todas las entradas, no solo las clave');
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
    assert.doesNotMatch(html, /<script>alert/, 'nada de los archivos puede cerrar el script de datos');
    assert.match(html, /\\u003cscript>alert\(1\)\\u003c\/script>/, 'va en el JSON con < escapado; el cliente lo escapa al pintar');
    assert.match(html, /const esc = \(x\) =>/, 'el cliente escapa todo texto que viene de archivos');
    assert.match(html, /replace\(\/\\\*\\\*\(\[\^\*\]\+\)\\\*\\\*\/g/, 'la regex de negrita llega escapada al cliente (un \\* sin escapar la volvia un comentario)');
    assert.match(html, lang === 'es' ? /¿Como vamos\?/ : /How are we doing\?/);
    assert.match(html, /"id":"FR001"/, 'el modelo va embebido');
    assert.match(html, /"archivedAt":"2026-09-10"/);
    assert.match(html, /data-k="story"|\.blk\[data-k/, 'el flujo se dibuja en cliente');
    assert.match(html, /cr\('fr'/, 'cadena de anillos clicable');
    assert.match(html, lang === 'es' ? /Cuando se trabajo/ : /When work happened/);
    assert.match(html, /\$\{d\}\\n\$\{parts\.join\('\\n'\)\}/, 'los saltos de linea del tooltip llegan escapados al cliente (un \\n crudo rompia el script)');
    assert.match(html, /class="cal"/, 'calendario de actividad');
    assert.match(html, /\/\^\\s\{2,\}\//, 'los backslashes de las regex del cliente sobreviven al template');
    assert.match(html, /function mdBlock/, 'los documentos se renderizan en cliente');
    assert.match(html, /\\u003c/, 'el JSON embebido escapa < para no cerrar el script');
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

// --- cerrar: validar y archivar como comando, no como recordatorio ----------------------
import { closable, closeChanges, unarchivedDone } from '../src/close.mjs';

test('closable lista solo los changes con todas las tareas marcadas y sin archivar', () => {
  const dir = midProject();
  assert.deepEqual(closable(dir).map((c) => c.story), [], '1.1 esta a medias; 2.1 ya archivado');
  const t = path.join(dir, 'openspec', 'changes', 'e1s1-registro-de-proveedor-con-nit', 'tasks.md');
  fs.writeFileSync(t, fs.readFileSync(t, 'utf8').replace(/- \[ \]/g, '- [x]'));
  assert.deepEqual(closable(dir).map((c) => c.story), ['1.1']);
  assert.equal(unarchivedDone(dir), 1);
  assert.equal(collectStatus(dir).metrics.changes.doneUnarchived, 1);
  assert.match(renderHtml(collectStatus(dir), 'es'), /terminadas sin cerrar/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('closeChanges valida antes de archivar y no archiva lo que no valida', () => {
  const calls = [];
  const run = (args) => { calls.push(args.join(' ')); return args[0] === 'validate' && args[1] === 'malo' ? { status: 1, out: 'Requirement X is missing SHALL' } : { status: 0, out: 'archived' }; };
  const r = closeChanges('/x', ['bueno', 'malo'], { run });
  assert.deepEqual(calls, ['validate bueno --strict', 'archive bueno --yes', 'validate malo --strict'], 'malo no llega a archive');
  assert.deepEqual(r.map((x) => [x.id, x.ok, x.step]), [['bueno', true, 'archive'], ['malo', false, 'validate']]);
  assert.match(r[1].out, /SHALL/);
  assert.ok(closeChanges('/x', ['a'], { dryRun: true, run: () => { throw new Error('no debe correr'); } })[0].dryRun);
});

test('close desde el CLI: sin ids lista; doctor avisa mientras haya terminadas sin cerrar', () => {
  const dir = midProject();
  const t = path.join(dir, 'openspec', 'changes', 'e1s1-registro-de-proveedor-con-nit', 'tasks.md');
  fs.writeFileSync(t, fs.readFileSync(t, 'utf8').replace(/- \[ \]/g, '- [x]'));
  const out = execFileSync('node', [CLI, 'close'], { cwd: dir, stdio: 'pipe' }).toString();
  assert.match(out, /1 change\(s\) con todas las tareas completas/);
  assert.match(out, /e1s1-registro-de-proveedor-con-nit/);
  const dry = execFileSync('node', [CLI, 'close', '--done', '--dry-run'], { cwd: dir, stdio: 'pipe' }).toString();
  assert.match(dry, /\[dry\] e1s1-registro-de-proveedor-con-nit/);
  // spawnSync (no execFileSync): este fixture nunca corrio `init`, asi que doctor
  // tambien reporta bloqueo de plan (bmad/layer faltantes) y sale !=0 — el punto
  // aqui es el aviso de unarchivedDone, no el exit code general de doctor.
  const doc = spawnSync('node', [CLI, 'doctor'], { cwd: dir, stdio: 'pipe' }).stdout.toString();
  assert.match(doc, /1 story\/ies con todas las tareas completas SIN archivar/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bridge y close regeneran el dashboard si ya existe; si no existe, no lo inventan', () => {
  const dir = midProject();
  let out = execFileSync('node', [BRIDGE, '--force'], { cwd: dir, stdio: 'pipe' }).toString();
  assert.doesNotMatch(out, /Dashboard actualizado/);
  execFileSync('node', [CLI, 'status', '--html'], { cwd: dir, stdio: 'pipe' });
  const f = path.join(dir, '.un-specweaver', 'dashboard.html');
  fs.writeFileSync(f, 'viejo');
  out = execFileSync('node', [BRIDGE, '--force'], { cwd: dir, stdio: 'pipe' }).toString();
  assert.match(out, /Dashboard actualizado/);
  assert.ok(fs.readFileSync(f, 'utf8').length > 1000, 'regenerado');
  fs.rmSync(dir, { recursive: true, force: true });
});
