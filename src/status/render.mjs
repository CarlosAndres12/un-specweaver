// Dos vistas del mismo modelo: texto para la terminal y un HTML autocontenido (CSS y JS
// inline, sin CDN, sin servidor) que se abre en el navegador y funciona offline y en CI.
// Un compañero lo abre sin instalar nada. Es el mismo modelo que graphify usa para graph.html.

const L = {
  es: {
    title: 'Estado del proyecto', phases: 'Fases', requirements: 'Requisitos', changes: 'Changes', sprint: 'Sprint',
    decisions: 'Decisiones', timeline: 'Historial', map: 'Mapa del codigo', memory: 'Memoria',
    phase: { understand: 'Entender', decide: 'Decidir', decompose: 'Descomponer', translate: 'Traducir', build: 'Construir', close: 'Cerrar' },
    state: { pending: 'pendiente', 'in-progress': 'en curso', done: 'tareas completas', archived: 'archivado', missing: 'sin change' },
    done: 'hecha', partial: 'en curso', notyet: 'pendiente', wave: 'Ola', current: 'ola actual', ready: 'se puede empezar',
    blockedBy: 'bloqueada por', toArchive: 'falta archivar', stories: 'stories', tasks: 'tareas', revision: 'rev', unstable: 'Requisitos que mas han cambiado',
    changesN: 'cambios', mentions: 'menciones', orphans: 'FR sin story', none: 'ninguno', coverage: 'cubierto por',
    noTrace: 'Sin trace.json todavia: corre el puente (/sw:new fase 2).', noSprint: 'Sin epics.md: no hay olas que calcular.',
    noDecisions: 'Sin memlogs todavia: BMAD los escribe al conversar.', generated: 'generado', entries: 'entradas', sources: 'fuentes',
    graphNodes: 'nodos', graphEdges: 'aristas', openGraph: 'abrir graph.html', noGraph: 'sin grafo (graphify update .)',
    engramOn: 'Engram atado a', engramOff: 'Engram sin atar (init)', engramAbsent: 'Engram no instalado',
    total: 'total', archived: 'archivados', inProgress: 'en curso', hint: 'Regenerar: npx un-specweaver status --html',
    delta: { ADDED: 'nuevo', MODIFIED: 'modificado' }, summary: 'Resumen', of: 'de',
  },
  en: {
    title: 'Project status', phases: 'Phases', requirements: 'Requirements', changes: 'Changes', sprint: 'Sprint',
    decisions: 'Decisions', timeline: 'History', map: 'Code map', memory: 'Memory',
    phase: { understand: 'Understand', decide: 'Decide', decompose: 'Decompose', translate: 'Translate', build: 'Build', close: 'Close' },
    state: { pending: 'pending', 'in-progress': 'in progress', done: 'tasks complete', archived: 'archived', missing: 'no change' },
    done: 'done', partial: 'in progress', notyet: 'pending', wave: 'Wave', current: 'current wave', ready: 'ready to start',
    blockedBy: 'blocked by', toArchive: 'archive pending', stories: 'stories', tasks: 'tasks', revision: 'rev', unstable: 'Requirements that changed most',
    changesN: 'changes', mentions: 'mentions', orphans: 'FR without story', none: 'none', coverage: 'covered by',
    noTrace: 'No trace.json yet: run the bridge (/sw:new phase 2).', noSprint: 'No epics.md: no waves to compute.',
    noDecisions: 'No memlogs yet: BMAD writes them while conversing.', generated: 'generated', entries: 'entries', sources: 'sources',
    graphNodes: 'nodes', graphEdges: 'edges', openGraph: 'open graph.html', noGraph: 'no graph (graphify update .)',
    engramOn: 'Engram bound to', engramOff: 'Engram not bound (init)', engramAbsent: 'Engram not installed',
    total: 'total', archived: 'archived', inProgress: 'in progress', hint: 'Regenerate: npx un-specweaver status --html',
    delta: { ADDED: 'new', MODIFIED: 'modified' }, summary: 'Summary', of: 'of',
  },
};

const mark = (p) => (p.done ? '●' : p.partial ? '◐' : '○');
const bar = (done, total, w = 10) => (total ? '▮'.repeat(Math.round((done / total) * w)).padEnd(w, '▯') : '▯'.repeat(w));

export function renderTerminal(s, lang = 'es') {
  const t = L[lang] || L.es;
  const o = [];
  o.push(`\n${t.title}: ${s.project.name}  (${s.generatedAt.slice(0, 16).replace('T', ' ')})\n`);

  o.push(`${t.phases}`);
  for (const p of s.phases) {
    const extra = p.count != null ? `  ${p.count}` : p.artifacts?.length ? `  ${p.artifacts.map((a) => a.file).join(', ')}` : '';
    o.push(`  ${mark(p)} ${String(p.n)}. ${t.phase[p.key].padEnd(12)} ${p.done ? t.done : p.partial ? t.partial : t.notyet}${extra}`);
  }

  o.push(`\n${t.changes}  ${s.changes.length} ${t.total}, ${s.changes.filter((c) => c.state === 'archived').length} ${t.archived}, ${s.changes.filter((c) => c.state === 'in-progress' || c.state === 'done').length} ${t.inProgress}`);
  for (const c of s.changes) {
    const pr = c.state === 'archived' ? `${t.state.archived} ${c.archivedAt || ''}` : `${bar(c.progress.done, c.progress.total)} ${c.progress.done}/${c.progress.total} ${t.tasks} · ${t.state[c.state]}`;
    o.push(`  ${(c.story || '').padEnd(5)} ${c.id.padEnd(48)} ${pr}${c.revision > 1 ? `  ${t.revision} ${c.revision}` : ''}`);
  }

  o.push(`\n${t.sprint}`);
  if (!s.sprint) o.push(`  ${t.noSprint}`);
  else {
    for (const w of s.sprint.waves) {
      o.push(`  ${t.wave} ${w.n}${w.n === s.sprint.current ? ` ← ${t.current}` : ''}`);
      for (const i of w.items) {
        const st = i.state === 'archived' ? t.state.archived : i.state === 'done' ? `${t.state.done} · ${t.toArchive}` : i.ready ? `${t.state[i.state]} · ${t.ready}` : i.blockedBy.length ? `${t.blockedBy} ${i.blockedBy.join(', ')}` : t.state[i.state];
        o.push(`    ${i.story.padEnd(5)} ${i.title.slice(0, 44).padEnd(44)} ${st}`);
      }
    }
    if (s.sprint.cycles.length) o.push(`  ⚠ ${s.sprint.cycles.join(', ')}`);
  }

  o.push(`\n${t.requirements}`);
  if (!s.requirements.rows.length) o.push(`  ${t.noTrace}`);
  else {
    const top = s.requirements.rows.filter((r) => r.changes > 0).sort((a, b) => b.changes - a.changes).slice(0, 8);
    o.push(`  ${t.unstable}: ${top.length ? top.map((r) => `${r.id} (${r.changes})`).join(', ') : t.none}`);
    o.push(`  ${t.orphans}: ${s.requirements.orphans.length ? s.requirements.orphans.join(', ') : t.none}`);
  }

  o.push(`\n${t.decisions}  ${s.decisions.total} ${t.entries}, ${s.decisions.sources} ${t.sources}${s.decisions.total ? '  ' + Object.entries(s.decisions.byType).map(([k, v]) => `${k} ${v}`).join(' · ') : `  ${t.noDecisions}`}`);

  o.push(`\n${t.map}  ${s.graph.path ? `${s.graph.nodes} ${t.graphNodes}, ${s.graph.edges} ${t.graphEdges}${s.graph.html ? ` · ${s.graph.html}` : ''}` : t.noGraph}`);
  o.push(`${t.memory}  ${s.engram.available ? (s.engram.project ? `${t.engramOn} "${s.engram.project}"` : t.engramOff) : t.engramAbsent}`);
  o.push(`\n${t.hint}\n`);
  return o.join('\n');
}

const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderHtml(s, lang = 'es') {
  const t = L[lang] || L.es;
  const stateClass = { pending: 'st-pending', 'in-progress': 'st-progress', done: 'st-done', archived: 'st-archived', missing: 'st-missing' };
  const pct = (c) => (c.progress.total ? Math.round((c.progress.done / c.progress.total) * 100) : 0);

  const phasesHtml = s.phases.map((p) => `
    <li class="phase ${p.done ? 'done' : p.partial ? 'partial' : ''}">
      <span class="dot"></span>
      <div><b>${p.n}. ${esc(t.phase[p.key])}</b> <small>${p.done ? esc(t.done) : p.partial ? esc(t.partial) : esc(t.notyet)}${p.count != null ? ` · ${p.count}` : ''}</small>
      ${p.artifacts?.length ? `<div class="files">${p.artifacts.map((a) => `<code>${esc(a.file)}</code>${a.date ? ` <small>${esc(a.date)}</small>` : ''}`).join('<br>')}</div>` : ''}</div>
    </li>`).join('');

  const changesHtml = s.changes.length ? `<table><thead><tr><th>Story</th><th>Change</th><th>${esc(t.tasks)}</th><th></th></tr></thead><tbody>${s.changes.map((c) => `
    <tr class="${stateClass[c.state]}"><td>${esc(c.story || '')}</td>
      <td><code>${esc(c.id)}</code>${c.revision > 1 ? ` <span class="tag">${esc(t.revision)} ${c.revision} · ${esc(t.delta[c.delta] || c.delta)}</span>` : ''}<br><small>${esc(c.title)}</small></td>
      <td>${c.state === 'archived' ? `<small>${esc(c.archivedAt || '')}</small>` : `<div class="bar"><i style="width:${pct(c)}%"></i></div><small>${c.progress.done}/${c.progress.total}</small>`}</td>
      <td><span class="state">${esc(t.state[c.state])}</span></td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(t.noTrace)}</p>`;

  const sprintHtml = s.sprint ? s.sprint.waves.map((w) => `
    <div class="wave ${w.n === s.sprint.current ? 'current' : ''}"><h4>${esc(t.wave)} ${w.n}${w.n === s.sprint.current ? ` <span class="tag">${esc(t.current)}</span>` : ''}</h4>
      <ul>${w.items.map((i) => `<li class="${stateClass[i.state]}"><b>${esc(i.story)}</b> ${esc(i.title)} <span class="state">${i.state === 'archived' ? esc(t.state.archived) : i.state === 'done' ? `${esc(t.state.done)} · ${esc(t.toArchive)}` : i.ready ? `${esc(t.state[i.state])} · ${esc(t.ready)}` : i.blockedBy.length ? `${esc(t.blockedBy)} ${esc(i.blockedBy.join(', '))}` : esc(t.state[i.state])}</span></li>`).join('')}</ul>
    </div>`).join('') + (s.sprint.cycles.length ? `<p class="warn">⚠ ${esc(s.sprint.cycles.join(', '))}</p>` : '') : `<p class="muted">${esc(t.noSprint)}</p>`;

  const reqHtml = s.requirements.rows.length ? `<table><thead><tr><th>ID</th><th></th><th>${esc(t.coverage)}</th><th>${esc(t.changesN)}</th><th>${esc(t.mentions)}</th></tr></thead><tbody>${s.requirements.rows.map((r) => `
    <tr class="${r.changes >= 3 ? 'hot' : r.changes > 0 ? 'warm' : ''}"><td><b>${esc(r.id)}</b></td><td>${esc(r.text)}</td><td>${r.stories.length ? esc(r.stories.join(', ')) : `<span class="warn">${esc(t.orphans)}</span>`}</td><td>${r.changes}</td><td>${r.mentions}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(t.noTrace)}</p>`;

  const decHtml = s.decisions.total ? `<p>${s.decisions.total} ${esc(t.entries)} · ${s.decisions.sources} ${esc(t.sources)} — ${Object.entries(s.decisions.byType).map(([k, v]) => `<span class="tag">${esc(k)} ${v}</span>`).join(' ')}</p>
    ${s.decisions.ranking.length ? `<h4>${esc(t.unstable)}</h4><ol>${s.decisions.ranking.filter((r) => r.changes > 0).map((r) => `<li><b>${esc(r.id)}</b> — ${r.changes} ${esc(t.changesN)}, ${r.mentions} ${esc(t.mentions)}${r.last ? ` <small>${esc(r.last)}</small>` : ''} <code>npx un-specweaver history ${esc(r.id)}</code></li>`).join('')}</ol>` : ''}` : `<p class="muted">${esc(t.noDecisions)}</p>`;

  const tlHtml = s.timeline.length ? `<ul class="tl">${s.timeline.slice(0, 80).map((e) => `<li><time>${esc(e.when || '—')}</time> <span class="tag">${esc(e.source)}</span> <span class="tag t-${esc(e.type)}">${esc(e.type)}</span> ${esc(e.text)}${e.refs?.length ? ` <small>${e.refs.map(esc).join(', ')}</small>` : ''}<br><small class="muted">${esc(e.file)}</small></li>`).join('')}</ul>` : `<p class="muted">—</p>`;

  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.project.name)} — ${esc(t.title)}</title>
<style>
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--line:#e7e5e4;--card:#fff;--ok:#16a34a;--warn:#d97706;--hot:#dc2626;--acc:#4f46e5;--tag:#f5f5f4}
@media(prefers-color-scheme:dark){:root{--bg:#0c0a09;--fg:#e7e5e4;--muted:#a8a29e;--line:#292524;--card:#1c1917;--tag:#292524}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1100px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}h4{margin:12px 0 6px;font-size:13px}
.muted{color:var(--muted)}.warn{color:var(--warn)}small{color:var(--muted);font-size:12px}code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--tag);padding:1px 5px;border-radius:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.card b{font-size:20px;display:block}
ul.phases{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.phase{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;display:flex;gap:8px}
.phase .dot{width:10px;height:10px;border-radius:50%;border:2px solid var(--muted);flex:none;margin-top:5px}.phase.done .dot{background:var(--ok);border-color:var(--ok)}.phase.partial .dot{background:linear-gradient(90deg,var(--warn) 50%,transparent 50%);border-color:var(--warn)}
.files{margin-top:4px;font-size:12px;word-break:break-all}table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:8px}th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;color:var(--muted)}
.bar{height:6px;background:var(--tag);border-radius:3px;overflow:hidden;min-width:80px}.bar i{display:block;height:100%;background:var(--acc)}.state{font-size:12px;color:var(--muted)}
.st-archived .state{color:var(--ok)}.st-progress .state,.st-done .state{color:var(--acc)}.st-missing .state{color:var(--hot)}tr.hot td:first-child b{color:var(--hot)}tr.warm td:first-child b{color:var(--warn)}
.tag{display:inline-block;font-size:11px;background:var(--tag);border-radius:4px;padding:0 6px;color:var(--muted)}.t-override,.t-modified{color:var(--hot)}.t-change{color:var(--warn)}.t-archived{color:var(--ok)}
.wave{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:8px}.wave.current{border-color:var(--acc)}.wave ul{margin:0;padding-left:0;list-style:none}.wave li{padding:3px 0}
ul.tl{list-style:none;padding:0;margin:0}ul.tl li{padding:6px 0;border-bottom:1px dashed var(--line)}time{font:12px ui-monospace,Menlo,monospace;color:var(--muted);margin-right:6px}
.tables{overflow-x:auto}footer{margin-top:32px;color:var(--muted);font-size:12px}
</style></head><body><main>
<h1>${esc(s.project.name)}</h1><p class="muted">${esc(t.title)} · ${esc(t.generated)} ${esc(s.generatedAt.slice(0, 16).replace('T', ' '))}${s.project.agents.length ? ` · ${esc(s.project.agents.join(', '))}` : ''}</p>

<h2>${esc(t.summary)}</h2>
<div class="grid">
  <div class="card"><b>${s.changes.length}</b>${esc(t.changes)}</div>
  <div class="card"><b>${s.changes.filter((c) => c.state === 'archived').length}</b>${esc(t.archived)}</div>
  <div class="card"><b>${s.sprint ? s.sprint.totals.ready : '—'}</b>${esc(t.ready)}</div>
  <div class="card"><b>${s.requirements.rows.length}</b>${esc(t.requirements)}</div>
  <div class="card"><b>${s.decisions.total}</b>${esc(t.decisions)}</div>
  <div class="card"><b>${s.graph.nodes ?? '—'}</b>${esc(t.map)} (${esc(t.graphNodes)})</div>
</div>

<h2>${esc(t.phases)}</h2><ul class="phases">${phasesHtml}</ul>
<h2>${esc(t.sprint)}${s.sprint ? ` <small>${s.sprint.totals.archived} ${esc(t.of)} ${s.sprint.totals.stories} ${esc(t.stories)} ${esc(t.archived)}</small>` : ''}</h2>${sprintHtml}
<h2>${esc(t.changes)}</h2><div class="tables">${changesHtml}</div>
<h2>${esc(t.requirements)}</h2><div class="tables">${reqHtml}</div>
<h2>${esc(t.decisions)}</h2>${decHtml}
<h2>${esc(t.timeline)}</h2>${tlHtml}
<h2>${esc(t.map)} · ${esc(t.memory)}</h2>
<p>${s.graph.path ? `${s.graph.nodes} ${esc(t.graphNodes)}, ${s.graph.edges} ${esc(t.graphEdges)}${s.graph.html ? ` — <a href="../${esc(s.graph.html)}">${esc(t.openGraph)}</a>` : ''}` : `<span class="muted">${esc(t.noGraph)}</span>`}<br>
${s.engram.available ? (s.engram.project ? `${esc(t.engramOn)} <code>${esc(s.engram.project)}</code>` : `<span class="warn">${esc(t.engramOff)}</span>`) : `<span class="muted">${esc(t.engramAbsent)}</span>`}</p>
<footer>${esc(t.hint)}</footer>
</main></body></html>
`;
}
