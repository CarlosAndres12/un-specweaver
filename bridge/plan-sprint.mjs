// Grafo de dependencias derivado del mapeo, no inventado.
//
// Reglas (deterministas):
//  1. Stories del mismo epic -> SECUENCIAL. Es la regla del propio BMAD
//     ("Stories MUST NOT depend on future stories within the same epic") y ademas
//     comparten la misma capability, asi que sus deltas tocan el mismo spec.md.
//  2. Epics distintos -> PARALELO. Capabilities disjuntas, deltas disjuntos.
//  3. Dependencia explicita en el texto ("depende de Story 2.1") -> arista extra.
//
// Limite conocido y declarado: una dependencia cruzada entre epics que no este
// escrita en el texto NO se detecta. Se reporta como "revisar a mano" en vez de
// fingir precision.
import { capabilityPath, changeId } from './emit-openspec.mjs';

const RE_DEP = /(?:depend[ea]?\w*\s+(?:de|of|on)|requiere|requires|after|despues de|bloquead[oa]\s+por|blocked by)[\s:*`]+(?:la\s+)?stor(?:y|ia)\s+(\d+\.\d+)/gi;

export function planSprint(doc) {
  const nodes = [];
  const byStory = new Map();

  for (const epic of doc.epics) {
    const ordered = [...epic.stories].sort((a, b) => a.m - b.m);
    ordered.forEach((story, i) => {
      const node = {
        story: story.id,
        title: story.title,
        changeId: changeId(story),
        capability: capabilityPath(epic),
        epic: epic.n,
        dependsOn: i > 0 ? [ordered[i - 1].id] : [],
        dependsOnReason: i > 0 ? ['secuencia dentro del epic (misma capability)'] : [],
      };
      nodes.push(node);
      byStory.set(story.id, node);
    });
  }

  // Aristas explicitas del texto.
  const crossEpic = [];
  for (const epic of doc.epics) {
    for (const story of epic.stories) {
      const node = byStory.get(story.id);
      const hay = story.raw || story.narrative;   // el bloque completo: la dependencia suele ir como prosa al final
      for (const m of hay.matchAll(RE_DEP)) {
        const dep = m[1];
        if (dep === story.id || !byStory.has(dep)) continue;
        if (node.dependsOn.includes(dep)) continue;
        node.dependsOn.push(dep);
        node.dependsOnReason.push('dependencia declarada en el texto de la story');
        if (byStory.get(dep).epic !== node.epic) crossEpic.push(`${story.id} -> ${dep}`);
      }
    }
  }

  // Niveles: ola N = todo lo que ya tiene sus dependencias en olas < N.
  const done = new Set();
  const waves = [];
  let guard = 0;
  while (done.size < nodes.length && guard++ < nodes.length + 5) {
    const wave = nodes.filter((n) => !done.has(n.story) && n.dependsOn.every((d) => done.has(d)));
    if (!wave.length) break;                       // ciclo
    wave.forEach((n) => done.add(n.story));
    waves.push(wave);
  }
  const cycles = nodes.filter((n) => !done.has(n.story)).map((n) => n.story);

  return { nodes, waves, cycles, crossEpic };
}

export function renderSprintPlan(doc, plan) {
  const L = [`# Plan de sprint — ${doc.projectName}`, ''];
  L.push(`Derivado de ${doc.epics.length} epic(s) y ${plan.nodes.length} story/ies.`, '');
  L.push('Stories del mismo epic van en secuencia (comparten capability). Epics distintos van en paralelo.', '');

  plan.waves.forEach((wave, i) => {
    L.push(`## Ola ${i + 1} — ${wave.length} change(s) en paralelo`, '');
    for (const n of wave) {
      L.push(`- **Story ${n.story}** — ${n.title}`);
      L.push(`  - change: \`openspec/changes/${n.changeId}/\``);
      L.push(`  - capability: \`${n.capability}\``);
      if (n.dependsOn.length) L.push(`  - depende de: ${n.dependsOn.join(', ')} (${[...new Set(n.dependsOnReason)].join('; ')})`);
    }
    L.push('');
  });

  if (plan.crossEpic.length) L.push('## Dependencias cruzadas entre epics (declaradas)', '', ...plan.crossEpic.map((d) => `- ${d}`), '');
  if (plan.cycles.length)    L.push('## ⚠ Ciclo de dependencias — no planificables', '', ...plan.cycles.map((c) => `- Story ${c}`), '');

  L.push('## Limite conocido', '',
    'Una dependencia entre epics que no este escrita en el texto de la story NO se detecta aqui.',
    'Este plan asume que los epics son independientes salvo que la story diga lo contrario.', '');
  return L.join('\n');
}
