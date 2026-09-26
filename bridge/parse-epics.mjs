// Parser determinista del epics.md que produce BMAD (skill bmad-create-epics-and-stories).
// Entra markdown, sale un objeto. Cero dependencias.

const RE_EPIC     = /^##\s+Epic\s+(\d+)\s*:\s*(.+?)\s*$/i;
const RE_STORY    = /^###\s+Story\s+(\d+)\.(\d+)\s*:\s*(.+?)\s*$/i;
const RE_H2       = /^##\s+(.+?)\s*$/;
const RE_H3       = /^###\s+(.+?)\s*$/;
const RE_AC_FIELD = /^\*\*(Given|When|Then|And)\*\*\s*:?\s*(.*)$/i;
// BMAD 6.11 emite "FR-23" con guion; versiones y plantillas distintas usan "FR001" sin el.
// Verificado contra un PRD real: exigir FR\d+ dejaba trace.json sin un solo requisito
// mapeado, y el control de alcance de /sw:change sin ancla, en silencio.
// AD-n (decision de arquitectura) tambien se cita en "Cubre:": una story de andamiaje puede
// no tocar ningun FR y aun asi cubrir una decision. Sin esto quedaba "vacia".
const RE_REQ_ID   = /\b(UX-DR|NFR|FR|AD)[-_ ]?(\d+)\b/g;
const RE_REQ_LINE = /\b(UX-DR|NFR|FR)([-_ ]?)(\d+)\b\s*[:\-–]?\s*(.*)$/;
// Un requisito eliminado sigue en el inventario, tachado, para que el id no se reutilice:
// `~~**FR-15:** texto~~ **ELIMINADO 2026-08-26.**`. Contarlo como vivo lo mostraba "sin story".
const RE_REMOVED  = /\b(ELIMINADO|ELIMINADA|REMOVED|DEPRECATED|RETIRADO)\b/i;

// Se conserva la forma tal como la escribe el documento (para que grepear funcione),
// pero se deduplica por clave normalizada: FR-23 y FR23 son el mismo requisito.
const reqKey = (id) => id.replace(/[-_ ]/g, '').toUpperCase();

export function slug(s, max = 60) {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // acentos: "Autenticación" -> "Autenticacion"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

const stripBullet = (l) => l.replace(/^\s*[-*+]\s+/, '').trim();
const isHeading   = (l) => /^#{1,6}\s/.test(l);

// Divide el documento en bloques con su encabezado, preservando el orden.
function sections(lines) {
  const out = [];
  let cur = { h2: null, h3: null, lines: [] };
  for (const line of lines) {
    const m2 = line.match(RE_H2);
    const m3 = line.match(RE_H3);
    if (m2) { out.push(cur); cur = { h2: m2[1], h3: null, lines: [] }; continue; }
    if (m3) { out.push(cur); cur = { h2: cur.h2, h3: m3[1], lines: [] }; continue; }
    cur.lines.push(line);
  }
  out.push(cur);
  return out;
}

function parseRequirementList(lines) {
  const reqs = [];
  for (const raw of lines) {
    let line = stripBullet(raw).replace(/\*\*/g, '');
    if (!line) continue;
    const struck = /~~/.test(line);
    line = line.replace(/~~/g, '');
    const m = line.match(RE_REQ_LINE);
    if (!m) continue;
    const id = `${m[1]}${m[2]}${m[3]}`;
    let text = (m[4] || '').trim();
    const rm = text.match(RE_REMOVED);
    const removed = struck || !!rm;
    const req = { id, text, key: reqKey(id) };
    if (removed) {
      req.removed = true;
      const date = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (date) req.removedAt = date[1];
      // El texto util es el del requisito, no la nota de eliminacion.
      if (rm) req.text = text.slice(0, rm.index).trim().replace(/[.\s]+$/, '');
    }
    reqs.push(req);
  }
  return reqs;
}

// Los criterios de aceptacion vienen como grupos Given/When/Then/And.
// Un **Given** nuevo abre un grupo. Se tolera la variante en vinetas y el
// fallback de lista numerada que a veces emite el agente.
function parseAcceptanceCriteria(lines) {
  const acs = [];
  let cur = null, lastField = null;

  const flush = () => { if (cur && (cur.given || cur.when || cur.then)) acs.push(cur); cur = null; lastField = null; };

  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) { lastField = null; continue; }

    const m = line.match(RE_AC_FIELD);
    if (m) {
      const field = m[1].toLowerCase();
      const value = m[2].trim();
      if (field === 'given' || (!cur && field === 'when')) { flush(); cur = { given: '', when: '', then: '', and: [] }; }
      if (!cur) cur = { given: '', when: '', then: '', and: [] };
      if (field === 'and') { cur.and.push(value); lastField = { obj: cur.and, idx: cur.and.length - 1 }; }
      else { cur[field] = value; lastField = { obj: cur, idx: field }; }
      continue;
    }

    // Fallback: "1. El sistema hace X" o vineta suelta -> criterio solo con THEN.
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    if (num && !cur) { acs.push({ given: '', when: '', then: num[1].trim(), and: [] }); continue; }

    // Continuacion de la linea anterior (texto envuelto).
    if (lastField && !line.startsWith('**')) {
      if (Array.isArray(lastField.obj)) lastField.obj[lastField.idx] += ' ' + line;
      else lastField.obj[lastField.idx] += ' ' + line;
    }
  }
  flush();
  return acs;
}

function parseStoryBody(title, lines) {
  const acIdx = lines.findIndex((l) => /^\s*\**\s*Acceptance Criteria\s*:?\s*\**\s*$/i.test(l.replace(/\*\*/g, '**')) || /acceptance criteria/i.test(l) && /\*\*/.test(l));
  const head = acIdx === -1 ? lines : lines.slice(0, acIdx);
  const tail = acIdx === -1 ? [] : lines.slice(acIdx + 1);

  const narrative = head.join(' ').replace(/\s+/g, ' ').trim();
  const m = narrative.match(/As an?\s+(.+?)\s*,\s*I want\s+(.+?)\s*,\s*So that\s+(.+?)\s*\.?\s*(?:\*\*|$)/i);

  const seen = new Set();
  const reqIds = [];
  for (const x of lines.join('\n').matchAll(RE_REQ_ID)) {
    const k = reqKey(x[0]);
    if (seen.has(k)) continue;
    seen.add(k);
    reqIds.push(x[0]);          // forma literal del documento
  }

  return {
    title,
    role:    m ? m[1].trim() : '',
    want:    m ? m[2].trim() : '',
    benefit: m ? m[3].trim() : '',
    narrative,
    raw: lines.join('\n'),
    requirements: reqIds,
    acceptanceCriteria: parseAcceptanceCriteria(tail),
  };
}

// BMAD documenta la cobertura en tablas, no dentro de las stories. Verificado contra una
// corrida real: "### FR Coverage Map" mapea FR -> Epic y "## UX-DR Coverage Map" mapea a
// stories. Sin leerlas, trace.json queda con 29 requisitos y cero mapeos, en silencio.
//
// Las referencias se validan contra epics y stories que existan de verdad: sin eso,
// textos como "Astro 7" o "Node >= 22.12.0" se leerian como story 22.12.
function parseCoverageMaps(blocks, doc) {
  const byStory = new Map();
  const byEpic = new Map();
  const storyIds = new Set(doc.epics.flatMap((e) => e.stories.map((st) => st.id)));
  const epicNs = new Set(doc.epics.map((e) => e.n));

  const add = (map, key, id) => {
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.some((x) => reqKey(x) === reqKey(id))) list.push(id);
  };

  for (const b of blocks) {
    const heading = `${b.h3 || ''} ${b.h2 || ''}`;
    if (!/coverage map/i.test(heading)) continue;

    for (const raw of b.lines) {
      if (!raw.includes('|')) continue;
      const cells = raw.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length < 2 || /^-+$/.test(cells[0])) continue;

      const idMatch = cells[0].replace(/\*\*/g, '').match(/^(UX-DR|NFR|FR)([-_ ]?)(\d+)$/);
      if (!idMatch) continue;
      const id = `${idMatch[1]}${idMatch[2]}${idMatch[3]}`;

      const rest = cells.slice(1).join(' ');
      let matched = false;
      for (const m of rest.matchAll(/\b(\d{1,2})\.(\d{1,2})\b/g)) {
        const sid = `${m[1]}.${m[2]}`;
        if (storyIds.has(sid)) { add(byStory, sid, id); matched = true; }
      }
      for (const m of rest.matchAll(/\bEpic\s+(\d{1,2})\b/gi)) {
        const n = Number(m[1]);
        if (epicNs.has(n)) { add(byEpic, n, id); matched = true; }
      }
      if (!matched) doc.warnings.push(`${id} aparece en un Coverage Map pero no referencia ningun epic ni story existente.`);
    }
  }
  return { byStory, byEpic };
}

export function parseEpics(markdown) {
  const lines = markdown.split(/\r?\n/);

  const projectName =
    (markdown.match(/^#\s+(.+?)(?:\s*-\s*Epic Breakdown)?\s*$/m)?.[1] || 'Project').trim();

  const blocks = sections(lines);
  const doc = {
    projectName,
    requirements: { functional: [], nonFunctional: [], additional: [], ux: [] },
    epics: [],
    warnings: [],
  };

  let epic = null;
  for (const b of blocks) {
    const h2 = b.h2 || '';
    const h3 = b.h3 || '';

    if (/^Requirements Inventory$/i.test(h2)) {
      if (/^Functional Requirements$/i.test(h3))          doc.requirements.functional   = parseRequirementList(b.lines);
      else if (/^NonFunctional/i.test(h3))                doc.requirements.nonFunctional = parseRequirementList(b.lines);
      else if (/^Additional Requirements$/i.test(h3))     doc.requirements.additional   = parseRequirementList(b.lines);
      else if (/^UX Design Requirements$/i.test(h3))      doc.requirements.ux           = parseRequirementList(b.lines);
      continue;
    }

    const me = h2.match(/^Epic\s+(\d+)\s*:\s*(.+)$/i);
    if (me && !h3) {
      epic = { n: Number(me[1]), title: me[2].trim(), goal: b.lines.filter((l) => l.trim() && !isHeading(l)).join(' ').replace(/\s+/g, ' ').trim(), stories: [] };
      doc.epics.push(epic);
      continue;
    }

    const ms = h3.match(/^Story\s+(\d+)\.(\d+)\s*:\s*(.+)$/i);
    if (ms) {
      const [, n, m, title] = ms;
      const target = doc.epics.find((e) => e.n === Number(n));
      if (!target) { doc.warnings.push(`Story ${n}.${m} referencia un Epic ${n} que no existe.`); continue; }
      target.stories.push({ n: Number(n), m: Number(m), id: `${n}.${m}`, ...parseStoryBody(title.trim(), b.lines) });
    }
  }

  // Cobertura declarada en tablas. Se atribuye al nivel mas preciso disponible y se
  // registra de donde salio: una trazabilidad a nivel epic no es lo mismo que a nivel story,
  // y quien lea trace.json tiene que poder distinguirlo.
  const cov = parseCoverageMaps(blocks, doc);
  for (const epic of doc.epics) {
    for (const story of epic.stories) {
      const inline = story.requirements;
      const fromStory = cov.byStory.get(story.id) || [];
      const fromEpic = cov.byEpic.get(epic.n) || [];
      const seen = new Set();
      const merged = [];
      for (const id of [...inline, ...fromStory, ...fromEpic]) {
        const k = reqKey(id);
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(id);
      }
      story.requirements = merged;
      story.requirementsFrom = {
        story: [...new Set([...inline, ...fromStory])],
        epic: fromEpic.filter((id) => ![...inline, ...fromStory].some((x) => reqKey(x) === reqKey(id))),
      };
    }
  }

  // La cobertura vale venga de donde venga: tabla o mencion dentro de la story.
  // Contar solo las tablas marcaba como huerfano un FR que la story si citaba.
  const covered = new Set(doc.epics.flatMap((e) => e.stories).flatMap((st) => st.requirements).map(reqKey));
  const orphan = doc.requirements.functional.filter((r) => !r.removed && !covered.has(r.key));
  if (orphan.length) doc.warnings.push(`${orphan.length} requisito(s) sin cobertura declarada: ${orphan.map((r) => r.id).join(', ')}`);

  // Validaciones que deben romper el puente, no pasar silenciosas.
  for (const e of doc.epics) {
    if (!e.stories.length) doc.warnings.push(`Epic ${e.n} "${e.title}" no tiene stories.`);
    for (const s of e.stories) {
      if (!s.want) doc.warnings.push(`Story ${s.id} no tiene narrativa "As a / I want / So that" parseable.`);
      if (!s.acceptanceCriteria.length) doc.warnings.push(`Story ${s.id} no tiene criterios de aceptacion.`);
    }
  }
  return doc;
}
