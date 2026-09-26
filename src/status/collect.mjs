// En que va el proyecto, leido de los archivos que ya existen. Una VISTA: no guarda nada, no
// tiene estado propio, se recalcula cada vez. Si guardara algo, en un mes contradiria a la
// fuente (PRD, specs, memlogs, ledger) — que es exactamente lo que la tercera regla prohibe.
import fs from 'node:fs';
import path from 'node:path';
import { parseEpics } from '../../bridge/parse-epics.mjs';
import { planSprint } from '../../bridge/plan-sprint.mjs';
import { findEpics, planningRoot, findPlanningArtifacts } from '../../bridge/cli.mjs';
import { readLedger } from '../../bridge/history.mjs';
import { collectDecisions, instabilityRanking, refKey } from '../../bridge/decisions.mjs';
import { VENDORS, readState, detectEngram, detectGraphify } from '../env.mjs';

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const exists = (f) => fs.existsSync(f);
const mtime = (f) => { try { return fs.statSync(f).mtime.toISOString().slice(0, 10); } catch { return null; } };

// Fecha que BMAD pone en el nombre de la carpeta (prd-<proyecto>-2026-08-26) o del archivo.
const dateIn = (p) => (p.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null;

// Progreso de un change: casillas de tasks.md.
export function taskProgress(md) {
  const lines = String(md || '').split('\n').filter((l) => /^\s*- \[[ xX]\] /.test(l));
  const done = lines.filter((l) => /^\s*- \[[xX]\]/.test(l)).length;
  return { done, total: lines.length };
}

// Los changes de OpenSpec, activos y archivados, con su estado derivado.
export function readChanges(root, trace) {
  const dir = path.join(root, 'openspec', 'changes');
  const byId = new Map((trace?.changes || []).map((c) => [c.changeId, c]));
  const out = [];
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'archive') continue;
    const t = byId.get(e.name);
    const progress = taskProgress(readText(path.join(dir, e.name, 'tasks.md')));
    const state = progress.total && progress.done === progress.total ? 'done' : progress.done > 0 ? 'in-progress' : 'pending';
    out.push(changeRow(e.name, t, progress, state, null));
  }
  const arch = path.join(dir, 'archive');
  if (exists(arch)) {
    for (const e of fs.readdirSync(arch, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const m = e.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
      const id = m ? m[2] : e.name;
      const t = byId.get(id) || [...byId.values()].find((c) => id.startsWith(c.changeId.replace(/-r\d+$/, '')));
      const progress = taskProgress(readText(path.join(arch, e.name, 'tasks.md')));
      out.push(changeRow(id, t, progress, 'archived', m ? m[1] : null));
    }
  }
  return out.sort((a, b) => (a.story || '').localeCompare(b.story || '', undefined, { numeric: true }) || a.id.localeCompare(b.id));
}

function changeRow(id, t, progress, state, archivedAt) {
  const m = id.match(/^e(\d+)s(\d+)-/);
  return {
    id, state, archivedAt, progress,
    story: t?.bmad?.story || (m ? `${m[1]}.${m[2]}` : null),
    title: t?.bmad?.storyTitle || id,
    capability: t?.capability || null,
    revision: t?.revision || (id.match(/-r(\d+)$/) ? Number(id.match(/-r(\d+)$/)[1]) : 1),
    delta: t?.delta || 'ADDED',
    requirements: t?.requirements || [],
  };
}

const readText = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

// Olas del sprint con el estado real de cada change: que se puede empezar ya, que esta
// bloqueado y por quien. Se recalculan desde epics.md (misma regla que el puente); si no hay
// epics.md, no hay sprint.
export function sprintStatus(root, changes) {
  const epicsFile = findEpics(root)[0];
  if (!epicsFile) return null;
  const doc = parseEpics(readText(epicsFile));
  const plan = planSprint(doc);
  const byStory = new Map();
  for (const c of changes) {
    // La revision mas alta manda: es la version vigente de esa story.
    const cur = byStory.get(c.story);
    if (!cur || c.revision > cur.revision || (c.revision === cur.revision && c.state === 'archived')) byStory.set(c.story, c);
  }
  const stateOf = (story) => byStory.get(story)?.state || 'missing';
  // Misma regla que /sw:build: una dependencia esta satisfecha si esta archivada O con su
  // tasks.md completo. Verificado en un proyecto real donde nadie archivaba: exigir el archive
  // marcaba como bloqueadas 22 stories cuyas dependencias ya estaban terminadas.
  const satisfied = (story) => ['archived', 'done'].includes(stateOf(story));
  const waves = plan.waves.map((wave, i) => ({
    n: i + 1,
    items: wave.map((n) => {
      const st = stateOf(n.story);
      const blockedBy = satisfied(n.story) ? [] : n.dependsOn.filter((d) => !satisfied(d));
      return { story: n.story, title: n.title, changeId: byStory.get(n.story)?.id || n.changeId, capability: n.capability, state: st, blockedBy, ready: !satisfied(n.story) && !blockedBy.length };
    }),
  }));
  const all = waves.flatMap((w) => w.items);
  const current = waves.find((w) => w.items.some((i) => !satisfied(i.story)))?.n || null;
  return {
    waves, current,
    totals: { stories: all.length, archived: all.filter((i) => i.state === 'archived').length, inProgress: all.filter((i) => i.state === 'in-progress' || i.state === 'done').length, ready: all.filter((i) => i.ready && i.state === 'pending').length, missing: all.filter((i) => i.state === 'missing').length },
    crossEpic: plan.crossEpic, cycles: plan.cycles,
  };
}

// Las seis fases del metodo, con el artefacto que prueba que pasaron.
export function phases(root, artifacts, trace, changes) {
  const of = (kind) => artifacts.filter((a) => a.kind === kind).map((a) => ({ file: path.relative(root, a.file), date: dateIn(a.file) || mtime(a.file) }));
  const brief = of('briefs'), prd = of('prds'), arch = of('architecture'), ux = of('ux-designs'), epics = of('epics');
  const active = changes.filter((c) => c.state !== 'archived');
  const archived = changes.filter((c) => c.state === 'archived');
  return [
    { n: 1, key: 'understand', done: prd.length > 0, artifacts: [...brief, ...prd] },
    { n: 2, key: 'decide', done: arch.length > 0, partial: arch.length > 0 && !ux.length, artifacts: [...arch, ...ux] },
    { n: 3, key: 'decompose', done: epics.length > 0, artifacts: epics },
    { n: 4, key: 'translate', done: !!trace && (trace.changes || []).length > 0, artifacts: trace ? [{ file: '.un-specweaver/trace.json', date: mtime(path.join(root, '.un-specweaver', 'trace.json')) }] : [], count: trace?.changes?.length || 0 },
    { n: 5, key: 'build', done: changes.length > 0 && active.every((c) => c.state === 'done'), partial: active.some((c) => c.state !== 'pending'), count: active.length },
    { n: 6, key: 'close', done: changes.length > 0 && archived.length === changes.length, partial: archived.length > 0, count: archived.length },
  ];
}

// Requisitos con cobertura (trace) e inestabilidad (decisiones).
export function requirementsView(root, pr, trace) {
  if (!trace) return { rows: [], orphans: [] };
  const rank = new Map(instabilityRanking(root, pr, trace).map((r) => [refKey(r.id), r]));
  const covered = new Map();
  for (const c of trace.changes || []) for (const r of c.requirements || []) {
    const k = refKey(r);
    if (!covered.has(k)) covered.set(k, []);
    covered.get(k).push(c.bmad.story);
  }
  const groups = [['functional', 'FR'], ['nonFunctional', 'NFR'], ['ux', 'UX-DR'], ['additional', 'ADD']];
  const rows = [];
  for (const [g, label] of groups) {
    for (const r of trace.requirements?.[g] || []) {
      const k = refKey(r.id);
      const h = rank.get(k);
      rows.push({ id: r.id, group: label, text: r.text, stories: [...new Set(covered.get(k) || [])], changes: h?.changes || 0, mentions: h?.mentions || 0, last: h?.last || null });
    }
  }
  return { rows, orphans: rows.filter((r) => r.group === 'FR' && !r.stories.length).map((r) => r.id) };
}

// Linea de tiempo unica: decisiones que cambian algo, corridas del puente, archives.
export function timeline(root, pr, changes) {
  const ev = [];
  const { entries } = collectDecisions(root, pr);
  for (const e of entries) {
    if (!['change', 'override', 'decision'].includes(e.type) && e.kind !== 'change-proposal') continue;
    ev.push({ when: e.date, source: e.kind, type: e.type, text: e.text, refs: e.refs, file: e.file });
  }
  for (const run of readLedger(root)) {
    const written = (run.changes || []).filter((c) => c.action === 'written');
    if (!written.length) continue;
    ev.push({ when: run.at.slice(0, 10), source: 'bridge', type: written.some((c) => c.delta === 'MODIFIED') ? 'modified' : 'generated',
      text: written.map((c) => `${c.changeId}${c.revision > 1 ? ` (r${c.revision})` : ''}`).join(', '), refs: written.map((c) => `Story ${c.story}`), file: '.un-specweaver/changelog.jsonl' });
  }
  for (const c of changes) if (c.state === 'archived' && c.archivedAt) ev.push({ when: c.archivedAt, source: 'openspec', type: 'archived', text: c.id, refs: c.story ? [`Story ${c.story}`] : [], file: `openspec/changes/archive/${c.archivedAt}-${c.id}` });
  return ev.sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')));
}

export function collectStatus(root) {
  root = path.resolve(root);
  const state = readState(root);
  const trace = readJson(path.join(root, '.un-specweaver', 'trace.json'));
  const pr = planningRoot(root);
  const artifacts = findPlanningArtifacts(root);
  const changes = readChanges(root, trace);
  const decisions = collectDecisions(root, pr);
  const byType = {};
  for (const e of decisions.entries) byType[e.type] = (byType[e.type] || 0) + 1;
  const g = detectGraphify(root);
  const graph = g.graph ? readJson(path.join(root, g.graph)) : null;
  const e = detectEngram(root);

  return {
    generatedAt: new Date().toISOString(),
    project: { name: trace?.project || path.basename(root), root, lang: state?.preferences?.lang || state?.lang || 'es', agents: state?.agents || [], installedAt: state?.installedAt || null, vendors: state?.vendors || null },
    phases: phases(root, artifacts, trace, changes),
    requirements: requirementsView(root, pr, trace),
    changes,
    sprint: sprintStatus(root, changes),
    decisions: { total: decisions.entries.length, sources: decisions.sources.length, byType, ranking: instabilityRanking(root, pr, trace).slice(0, 10) },
    timeline: timeline(root, pr, changes),
    graph: { available: !!g.bin, path: g.graph, html: exists(path.join(root, VENDORS.graphify.outDir, 'graph.html')) ? path.join(VENDORS.graphify.outDir, 'graph.html') : null, nodes: graph?.nodes?.length ?? null, edges: graph?.edges?.length ?? null },
    engram: { available: e.available, project: e.project },
  };
}
