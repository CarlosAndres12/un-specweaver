// Las decisiones que BMAD registra mientras conversa con el usuario, leidas como datos.
//
// Cada artefacto de planeacion (brief, PRD, arquitectura, UX) lleva un `.memlog.md` con entradas
// tipadas — (decision), (change), (override), (assumption), (event), y otras que aparecen sin
// documentarse: (constraint), (direction), (question), (version). `bmad-correct-course` ademas
// escribe `sprint-change-proposal-<fecha>.md` con tablas de impacto por FR. Todo eso existia y
// nadie lo leia: /sw:change podia proponer algo que ya se habia descartado con motivo verificado.
//
// Esto es una VISTA derivada. No guarda nada: se calcula desde los archivos cada vez. Si se
// guardara una copia, en un mes contradiria al memlog.
import fs from 'node:fs';
import path from 'node:path';
import { readLedger } from './history.mjs';

// Los ids que un texto puede citar. Mismo criterio de tolerancia que parse-epics (FR-23 y FR23
// son lo mismo) mas los que BMAD usa en arquitectura y UX: AD-9 (decision arquitectonica),
// UJ-1 (recorrido), NFR, UX-DR, Story 1.2, Epic 3.
const RE_REF = /\b(UX-DR|NFR|FR|AD|UJ)[-_ ]?(\d+)\b|\b(Story|Epic)\s+(\d+(?:\.\d+)?)\b/gi;

export const refKey = (id) => String(id).replace(/[-_ ]/g, '').toUpperCase();

export function extractRefs(text) {
  const out = [];
  const seen = new Set();
  for (const m of String(text).matchAll(RE_REF)) {
    // Se conserva la forma literal del documento (FR001, FR-21, UX-DR01) para que grepear
    // funcione; la deduplicacion es por clave normalizada.
    const id = m[1] ? m[0].trim() : `${m[3][0].toUpperCase()}${m[3].slice(1).toLowerCase()} ${m[4]}`;
    const k = refKey(id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(id);
  }
  return out;
}

const RE_ENTRY = /^- \((\w[\w-]*)\)\s*(.*)$/;

// Frontmatter minimo (topic, updated, ...) + entradas. Una linea que no abre entrada y no es
// frontmatter se pega a la entrada anterior: texto envuelto. Tipos desconocidos se conservan
// tal cual: el formato es de BMAD, no un contrato, y filtrar seria perder informacion.
export function parseMemlog(md, meta = {}) {
  const lines = String(md).split(/\r?\n/);
  const out = { meta: { ...meta }, entries: [] };
  let i = 0;
  if (lines[0] === '---') {
    i = 1;
    for (; i < lines.length && lines[i] !== '---'; i++) {
      const kv = lines[i].match(/^([A-Za-z][\w-]*):\s*(.*)$/);
      if (kv) out.meta[kv[1]] = kv[2].trim();
    }
    i++;
  }
  let cur = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(RE_ENTRY);
    if (m) {
      cur = { type: m[1].toLowerCase(), text: m[2].trim(), refs: [], order: out.entries.length };
      out.entries.push(cur);
      continue;
    }
    if (cur && line.trim() && !line.startsWith('#')) cur.text += ' ' + line.trim();
  }
  for (const e of out.entries) e.refs = extractRefs(e.text);
  return out;
}

// La propuesta de cambio de sprint: cada fila de tabla que cite un id es una entrada. Se
// conserva la fila entera como texto — la clasificacion ("Dentro del alcance", "Scope creep",
// "se elimina") viene en la prosa y no vale la pena adivinarla con un parser mas listo.
export function parseChangeProposal(md, meta = {}) {
  const out = { meta: { ...meta }, entries: [] };
  let section = '';
  for (const raw of String(md).split(/\r?\n/)) {
    const h = raw.match(/^#{1,4}\s+(.+?)\s*$/);
    if (h) { section = h[1]; continue; }
    if (!raw.includes('|')) continue;
    const cells = raw.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2 || cells.every((c) => /^-+$/.test(c))) continue;
    const text = cells.join(' — ').replace(/\*\*/g, '').replace(/`/g, '');
    const refs = extractRefs(text);
    if (!refs.length) continue;
    out.entries.push({ type: 'change', text, refs, section, order: out.entries.length });
  }
  return out;
}

// Donde viven las fuentes. Misma raiz configurable que el resto (planning_artifacts).
export function findDecisionSources(root, planningRoot) {
  const out = [];
  const kinds = ['briefs', 'prds', 'architecture', 'ux-designs'];
  for (const kind of kinds) {
    const d = path.join(planningRoot, kind);
    if (!fs.existsSync(d)) continue;
    const walk = (p, depth = 0) => {
      if (depth > 2) return;
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        const f = path.join(p, e.name);
        if (e.isDirectory()) walk(f, depth + 1);
        else if (e.name === '.memlog.md') out.push({ kind, file: f, format: 'memlog', artifact: path.basename(p) });
      }
    };
    walk(d);
  }
  if (fs.existsSync(planningRoot)) {
    for (const e of fs.readdirSync(planningRoot)) {
      const m = e.match(/^sprint-change-proposal-(\d{4}-\d{2}-\d{2})\.md$/);
      if (m) out.push({ kind: 'change-proposal', file: path.join(planningRoot, e), format: 'proposal', artifact: e, date: m[1] });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

export function collectDecisions(root, planningRoot) {
  const sources = findDecisionSources(root, planningRoot);
  const entries = [];
  for (const src of sources) {
    const md = fs.readFileSync(src.file, 'utf8');
    const parsed = src.format === 'memlog' ? parseMemlog(md, {}) : parseChangeProposal(md, {});
    const date = src.date || (parsed.meta.updated || '').slice(0, 10) || null;
    for (const e of parsed.entries) {
      entries.push({ ...e, kind: src.kind, artifact: src.artifact, file: path.relative(root, src.file), date });
    }
  }
  const byRef = new Map();
  for (const e of entries) for (const r of e.refs) {
    const k = refKey(r);
    if (!byRef.has(k)) byRef.set(k, { id: r, entries: [] });
    byRef.get(k).entries.push(e);
  }
  return { sources, entries, byRef };
}

// Tipos que cuentan como "este requisito se movio". (decision) es como nacio; (change) y
// (override) son que cambio despues; una fila en un change-proposal es un cambio de alcance.
const UNSTABLE = new Set(['change', 'override']);

// Historia de un requisito: lo que dijeron las conversaciones de planeacion (memlogs y
// change-proposals) + lo que hizo el puente (ledger: revisiones de las stories que lo cubren).
export function requirementHistory(root, planningRoot, id, trace = null) {
  const { byRef } = collectDecisions(root, planningRoot);
  const k = refKey(id);
  const planning = (byRef.get(k)?.entries || []).map((e) => ({
    when: e.date, source: e.kind === 'change-proposal' ? 'change-proposal' : `memlog:${e.kind}`,
    type: e.type, text: e.text, file: e.file,
  }));

  // Stories que cubren este requisito segun trace.json, y sus corridas en el ledger.
  const stories = (trace?.changes || []).filter((c) => (c.requirements || []).some((r) => refKey(r) === k));
  const storyIds = new Set(stories.map((c) => c.bmad.story));
  const bridge = [];
  for (const run of readLedger(root)) {
    for (const c of run.changes || []) {
      if (!storyIds.has(c.story)) continue;
      bridge.push({
        when: run.at.slice(0, 10), source: 'bridge', type: c.action === 'skipped' ? 'skipped' : (c.delta || 'ADDED').toLowerCase(),
        text: `Story ${c.story} → ${c.changeId}${c.revision > 1 ? ` (revision ${c.revision})` : ''}${c.tasksLost?.length ? `; ${c.tasksLost.length} tarea(s) perdida(s)` : ''}`,
        file: '.un-specweaver/changelog.jsonl',
      });
    }
  }
  const events = [...planning, ...bridge].sort((a, b) => String(a.when || '').localeCompare(String(b.when || '')));
  const changes = events.filter((e) => UNSTABLE.has(e.type) || e.source === 'change-proposal' || e.type === 'modified').length;
  return { id, stories: stories.map((c) => c.bmad.story), events, changes };
}

// Ranking de inestabilidad: cuantas veces cambio cada requisito despues de nacer.
export function instabilityRanking(root, planningRoot, trace = null) {
  const { byRef } = collectDecisions(root, planningRoot);
  const ids = new Set([...byRef.keys()]);
  for (const c of trace?.changes || []) for (const r of c.requirements || []) ids.add(refKey(r));
  const rows = [];
  for (const k of ids) {
    const id = byRef.get(k)?.id || [...(trace?.changes || [])].flatMap((c) => c.requirements || []).find((r) => refKey(r) === k) || k;
    if (!/^(FR|NFR|UXDR|AD)/.test(k)) continue;           // stories y epics no son requisitos
    const h = requirementHistory(root, planningRoot, id, trace);
    rows.push({ id, changes: h.changes, mentions: h.events.length, stories: h.stories, last: h.events.at(-1)?.when || null });
  }
  return rows.sort((a, b) => b.changes - a.changes || b.mentions - a.mentions || a.id.localeCompare(b.id));
}
