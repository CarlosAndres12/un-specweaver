import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { collectStatus, taskProgress, readChanges, sprintStatus } from '../src/status/collect.mjs';
import { renderTerminal, renderHtml, readArchGraph, classifyDiagramType } from '../src/status/render.mjs';

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

// Un proyecto minimo con un graph.json de graphify ya generado (graphify-out/), para probar
// la pestaña de Arquitectura sin necesitar el binario real de graphify.
function graphProject(nodes, edges) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-arch-'));
  fs.mkdirSync(path.join(dir, 'graphify-out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'graphify-out', 'graph.json'), JSON.stringify({ nodes, edges }));
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

// Nota sobre el estilo de estos tests: igual que el resto del archivo, no hay jsdom ni
// navegador: todo lo que hero()/flow()/memorySec() (y ahora topTabs()/architectureSec())
// producen es CODIGO FUENTE de cliente, embebido tal cual dentro de <script> (con ${} escapado
// a \${} para que Node no lo evalue). Lo unico que Node evalua de verdad es <style>, el <title>
// y el bloque de datos JSON (${json}, sin escapar). Por eso estos tests verifican: (a) que las
// cadenas literales (sin interpolar) que arman la estructura aparecen en el HTML, igual que
// `data-k="story"` en el test de autocontenido; y (b) que el modelo/UI embebido en el JSON trae
// lo correcto, igual que `/"id":"FR001"/` en ese mismo test.
test('el HTML tiene una barra de pestañas de nivel superior: Progreso y Arquitectura', () => {
  const dir = midProject();
  const s = collectStatus(dir);
  for (const lang of ['es', 'en']) {
    const html = renderHtml(s, lang);
    assert.match(html, /data-tab="progress"/);
    assert.match(html, /data-tab="architecture"/);
    // Progreso arranca visible, Arquitectura no: el manejador generico de click (ya
    // existente, bar.closest('.canvas, section')) hace el resto al hacer click.
    assert.match(html, /<div class="pane on" data-pane="progress">/);
    assert.match(html, /<div class="pane" data-pane="architecture">/);
    // la barra de pestañas y los dos paneles viven bajo la misma <section>, en el propio
    // codigo que arma el DOM: es lo que el manejador generico usa (bar.closest('.canvas,
    // section')) para encontrar los .pane[data-pane] a togglear cuando se hace click
    const renderCall = html.match(/<section class="apptabs">[\s\S]*?<\/main><\/section>/);
    assert.ok(renderCall, 'la section que envuelve la barra y los paneles existe en el render');
    assert.match(renderCall[0], /\$\{topTabs\(\)\}/);
    assert.match(renderCall[0], /data-pane="progress"/);
    assert.match(renderCall[0], /data-pane="architecture"/);
    // las etiquetas bilingues viajan en el bloque de datos, que si evalua Node
    assert.match(html, lang === 'es' ? /"tabProgress":"Progreso"/ : /"tabProgress":"Progress"/);
    assert.match(html, lang === 'es' ? /"tabArchitecture":"Arquitectura"/ : /"tabArchitecture":"Architecture"/);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Arquitectura: sin graph.json de graphify, no se embebe grafo y el cliente sabe mostrar el vacio', () => {
  const dir = midProject();
  const s = collectStatus(dir);
  assert.equal(s.graph.path, null, 'el fixture no trae graphify-out/graph.json');
  for (const lang of ['es', 'en']) {
    const html = renderHtml(s, lang);
    assert.match(html, /"archGraph":null/, 'sin graph.json no hay nada que dibujar: no se inventa data');
    assert.match(html, /function archEmpty/, 'el cliente tiene una rama explicita para el estado vacio');
    assert.match(html, /if \(!G \|\| !G\.nodes \|\| !G\.nodes\.length\) return archEmpty\(\);/, 'architectureSec() no revienta sin grafo');
    assert.match(html, lang === 'es' ? /"archNone":"Sin grafo todavia/ : /"archNone":"No graph yet/);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Arquitectura: con graph.json real, los nodos y aristas normalizados viajan embebidos para que el cliente los dibuje', () => {
  const dir = graphProject(
    [
      { id: 'src/app.mjs', label: 'app.mjs', kind: 'module' },
      { id: 'src/util.mjs', label: 'util.mjs', kind: 'module' },
      { id: 'src/app.mjs#run', label: 'run()', kind: 'function' },
    ],
    [
      { source: 'src/app.mjs', target: 'src/util.mjs', kind: 'imports' },
      { source: 'src/app.mjs#run', target: 'src/app.mjs', kind: 'defines' },
    ],
  );
  const s = collectStatus(dir);
  assert.equal(s.graph.path, 'graphify-out/graph.json');
  const html = renderHtml(s, 'es');
  // el grafo normalizado (id/label/kind, from/to) viaja en el JSON: nada de fetch en runtime,
  // sigue autocontenido
  assert.match(html, /"archGraph":\{"nodes":\[/);
  assert.match(html, /"id":"src\/app\.mjs","label":"app\.mjs","kind":"module"/);
  assert.match(html, /"label":"run\(\)"/);
  assert.match(html, /"from":"src\/app\.mjs#run","to":"src\/app\.mjs","kind":"defines"/);
  // el cliente sabe dibujar el SVG a partir de ese grafo (layout circular con las variables
  // CSS del tema, no colores fijos)
  assert.match(html, /function architectureSec/);
  assert.match(html, /class="archsvg"/);
  assert.match(html, /kindColor/);
  assert.doesNotMatch(html, /<script src=|https?:\/\/cdn|<link /, 'sigue autocontenido con el grafo embebido');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Arquitectura: acepta el formato node-link de NetworkX (edges bajo "links", no "edges")', () => {
  // graphify real produce networkx.node_link_data(): {directed, multigraph, graph, nodes, links}.
  // Confirmado contra un proyecto real (unal_dasboard): sin este fallback, readArchGraph()
  // veia 0 aristas pese a que graphify reportaba miles, porque solo miraba raw.edges.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-arch-nx-'));
  fs.mkdirSync(path.join(dir, 'graphify-out'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'graphify-out', 'graph.json'),
    JSON.stringify({
      directed: true,
      multigraph: false,
      graph: {},
      nodes: [
        { id: 'src/app.mjs', label: 'app.mjs', kind: 'module' },
        { id: 'src/util.mjs', label: 'util.mjs', kind: 'module' },
      ],
      links: [{ source: 'src/app.mjs', target: 'src/util.mjs', kind: 'imports' }],
    }),
  );
  const s = collectStatus(dir);
  const g = readArchGraph(s);
  assert.ok(g, 'con nodes+links reales, no deberia devolver null');
  assert.equal(g.nodes.length, 2);
  // relation es el nuevo campo (T4): el fixture no trae "relation" en sus links, asi que
  // cae en '' — kind sigue viajando igual que antes (compatibilidad con node-link "kind").
  assert.deepEqual(g.edges, [{ from: 'src/app.mjs', to: 'src/util.mjs', kind: 'imports', relation: '' }]);
  fs.rmSync(dir, { recursive: true, force: true });
});

// --- T4: clasificacion de tipo de diagrama (Component / Package / C4-Container) ---
//
// graphify real (confirmado contra unal_dasboard, 692 nodos) no trae kind/type/category en
// absoluto: readArchGraph() colapsaba silenciosamente todo a kind:''. Lo que si trae es
// source_file (ruta real, a veces '' para nodos no-codigo) y community/community_name
// (clustering ya calculado por graphify). classifyDiagramType() es la funcion pura que decide,
// a partir de esos campos ya normalizados por readArchGraph(), que tipo de diagrama corresponde
// y como agrupar cada nodo — sin LLM, sin I/O, facil de testear con fixtures en memoria.

test('classifyDiagramType: con kind en todos los nodos (fixtures existentes), sigue siendo component agrupado por kind', () => {
  const archGraph = {
    nodes: [
      { id: 'a', label: 'a', kind: 'module' },
      { id: 'b', label: 'b', kind: 'module' },
      { id: 'c', label: 'c', kind: 'function' },
    ],
    edges: [],
  };
  const result = classifyDiagramType(archGraph);
  assert.equal(result.diagramType, 'component');
  assert.equal(result.groups.get('a').group, 'module');
  assert.equal(result.groups.get('c').group, 'function');
});

test('classifyDiagramType: sin kind, source_file en pocos directorios de alto que cubren muchos nodos cada uno -> c4-container', () => {
  // 9 nodos, 3 directorios de tope (converter/api/ui), 3 nodos cada uno: 9/3 = 3 >= 3, 3 <= 8.
  const archGraph = {
    nodes: [
      { id: 'a1', label: 'a1', kind: '', sourceFile: 'converter/store/loader.py', community: '1' },
      { id: 'a2', label: 'a2', kind: '', sourceFile: 'converter/store/writer.py', community: '1' },
      { id: 'a3', label: 'a3', kind: '', sourceFile: 'converter/utils/helpers.py', community: '1' },
      { id: 'b1', label: 'b1', kind: '', sourceFile: 'api/routes/user.py', community: '2' },
      { id: 'b2', label: 'b2', kind: '', sourceFile: 'api/routes/order.py', community: '2' },
      { id: 'b3', label: 'b3', kind: '', sourceFile: 'api/models/user.py', community: '2' },
      { id: 'c1', label: 'c1', kind: '', sourceFile: 'ui/components/Button.jsx', community: '3' },
      { id: 'c2', label: 'c2', kind: '', sourceFile: 'ui/components/Modal.jsx', community: '3' },
      { id: 'c3', label: 'c3', kind: '', sourceFile: 'ui/pages/Home.jsx', community: '3' },
    ],
    edges: [],
  };
  const result = classifyDiagramType(archGraph);
  assert.equal(result.diagramType, 'c4-container');
  assert.equal(result.groups.get('a1').group, 'converter');
  assert.equal(result.groups.get('b3').group, 'api');
  assert.equal(result.groups.get('c2').group, 'ui');
});

test('classifyDiagramType: sin kind, muchos directorios de tope pequenos (baja cobertura promedio) -> package agrupado por directorio completo', () => {
  // 5 nodos, 5 directorios de tope distintos: 5/5 = 1 < 3 -> no c4, cae a package.
  const archGraph = {
    nodes: [
      { id: 'p1', label: 'p1', kind: '', sourceFile: 'moduleA/sub/file1.py', community: '' },
      { id: 'p2', label: 'p2', kind: '', sourceFile: 'moduleB/sub/file2.py', community: '' },
      { id: 'p3', label: 'p3', kind: '', sourceFile: 'moduleC/file3.py', community: '' },
      { id: 'p4', label: 'p4', kind: '', sourceFile: 'moduleD/file4.py', community: '' },
      { id: 'p5', label: 'p5', kind: '', sourceFile: 'moduleE/file5.py', community: '' },
    ],
    edges: [],
  };
  const result = classifyDiagramType(archGraph);
  assert.equal(result.diagramType, 'package');
  assert.equal(result.groups.get('p1').group, 'moduleA/sub');
  assert.equal(result.groups.get('p3').group, 'moduleC');
});

test('classifyDiagramType: sin kind y sin source_file en absoluto -> component agrupado por community', () => {
  const archGraph = {
    nodes: [
      { id: 'x1', label: 'x1', kind: '', sourceFile: '', community: '5', communityName: 'Core' },
      { id: 'x2', label: 'x2', kind: '', sourceFile: '', community: '5', communityName: 'Core' },
      { id: 'x3', label: 'x3', kind: '', sourceFile: '', community: '7', communityName: 'Utils' },
    ],
    edges: [],
  };
  const result = classifyDiagramType(archGraph);
  assert.equal(result.diagramType, 'component');
  assert.equal(result.groups.get('x1').group, '5');
  assert.equal(result.groups.get('x1').groupLabel, 'Core');
  assert.equal(result.groups.get('x3').group, '7');
});

test('readArchGraph: grafo real de graphify (sin kind, con source_file/community, edges con relation) trae diagramType y group/groupLabel por nodo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-arch-real-'));
  fs.mkdirSync(path.join(dir, 'graphify-out'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'graphify-out', 'graph.json'),
    JSON.stringify({
      directed: true,
      multigraph: false,
      graph: {},
      nodes: [
        { id: 'converter/store/loader.py', source_file: 'converter/store/loader.py', community: 1, community_name: 'Store' },
        { id: 'converter/store/writer.py', source_file: 'converter/store/writer.py', community: 1, community_name: 'Store' },
        { id: 'converter/utils/helpers.py', source_file: 'converter/utils/helpers.py', community: 1, community_name: 'Store' },
        { id: 'api/routes/user.py', source_file: 'api/routes/user.py', community: 2, community_name: 'Api' },
        { id: 'api/routes/order.py', source_file: 'api/routes/order.py', community: 2, community_name: 'Api' },
        { id: 'api/models/user.py', source_file: 'api/models/user.py', community: 2, community_name: 'Api' },
      ],
      links: [{ source: 'converter/store/loader.py', target: 'converter/store/writer.py', relation: 'imports' }],
    }),
  );
  const s = collectStatus(dir);
  const g = readArchGraph(s);
  assert.ok(g, 'con nodes+links reales, no deberia devolver null');
  // 6 nodos, 2 directorios de tope (converter/api), 3 cada uno: 6/2 = 3 >= 3 -> c4-container.
  assert.equal(g.diagramType, 'c4-container');
  const loader = g.nodes.find((n) => n.id === 'converter/store/loader.py');
  assert.equal(loader.sourceFile, 'converter/store/loader.py');
  assert.equal(loader.community, '1');
  assert.equal(loader.communityName, 'Store');
  assert.equal(loader.group, 'converter');
  assert.equal(loader.groupLabel, 'converter');
  assert.equal(g.edges[0].relation, 'imports');
  assert.equal(g.edges[0].kind, '', 'kind sigue existiendo (compatibilidad), vacio cuando no hay kind/type real');
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

// --- T5: `architecture` como paso standalone, fuera del pipeline completo de status ---
//
// Reusa exactamente readArchGraph()/classifyDiagramType() (mismas funciones que el endpoint
// del dashboard y renderHtml()) contra un proyecto dado, sin correr collectStatus() completo
// (BMAD/OpenSpec/decisiones/etc.) — solo lo minimo (detectGraphify + la ruta del grafo).

test('architecture desde el CLI: clasifica el mismo grafo que readArchGraph()/classifyDiagramType(), con o sin --json', () => {
  const dir = graphProject(
    [
      { id: 'src/app.mjs', label: 'app.mjs', kind: 'module' },
      { id: 'src/util.mjs', label: 'util.mjs', kind: 'module' },
      { id: 'src/app.mjs#run', label: 'run()', kind: 'function' },
    ],
    [
      { source: 'src/app.mjs', target: 'src/util.mjs', kind: 'imports' },
      { source: 'src/app.mjs#run', target: 'src/app.mjs', kind: 'defines' },
    ],
  );
  const out = execFileSync('node', [CLI, 'architecture'], { cwd: dir, stdio: 'pipe' }).toString();
  assert.match(out, /component/);
  assert.match(out, /Nodos: 3/);
  assert.match(out, /Aristas: 2/);
  // tambien acepta la ruta como argumento posicional, igual que `status [dir]`
  const out2 = execFileSync('node', [CLI, 'architecture', dir], { stdio: 'pipe' }).toString();
  assert.match(out2, /Nodos: 3/);

  const j = JSON.parse(execFileSync('node', [CLI, 'architecture', '--json'], { cwd: dir, stdio: 'pipe' }).toString());
  assert.equal(j.archGraph.diagramType, 'component');
  assert.equal(j.archGraph.nodes.length, 3);
  assert.equal(j.archGraph.edges.length, 2);
  assert.equal(j.archGraph.nodes.find((n) => n.id === 'src/app.mjs').group, 'module');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('architecture desde el CLI: sin graphify-out/graph.json, no revienta y avisa (exit 0)', () => {
  const dir = midProject();
  const out = execFileSync('node', [CLI, 'architecture'], { cwd: dir, stdio: 'pipe' }).toString();
  assert.match(out, /Sin grafo de arquitectura disponible/);
  const j = JSON.parse(execFileSync('node', [CLI, 'architecture', '--json'], { cwd: dir, stdio: 'pipe' }).toString());
  assert.equal(j.archGraph, null);
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
