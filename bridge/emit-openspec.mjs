// Emisor determinista: story de BMAD -> change de OpenSpec.
// Una story = un change. Un epic = una capability.
import { slug } from './parse-epics.mjs';
import { reconcileScenarioNames, revisedId } from './history.mjs';

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lower1     = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const noDot      = (s) => String(s || '').trim().replace(/\.+$/, '');

export const capabilityPath = (epic) => slug(epic.title);
export const changeId       = (story) => `e${story.n}s${story.m}-${slug(story.title, 48)}`;

// La narrativa de BMAD es en primera persona ("I want registrarme usando mi NIT").
// Un requisito normativo es impersonal. Esta normalizacion cubre los casos comunes
// y es deterministica; lo que no puede resolver lo deja igual y lo reporta.
// Deteccion por puntaje, no por primera coincidencia: una sola palabra que "parezca"
// espanola no puede voltear un documento ingles. Se alimenta con la narrativa de las
// stories, no con el documento entero, porque la plantilla de BMAD escribe los
// keywords Given/When/Then en ingles aunque la story este en espanol.
const ES_TOKENS = /\b(el|la|los|las|un|una|unos|unas|que|para|con|del|de|por|puedo|quiero|mi|mis|su|sus|como|cuando|donde|sin|sobre|desde|hacia|entre|ser|estar|poder)\b/gi;
const EN_TOKENS = /\b(the|of|to|in|for|with|without|from|into|their|my|our|they|it|be|is|are|can|should|shall|so|that|able)\b/gi;

export function detectLang(text) {
  const t = String(text || '');
  const es = (t.match(ES_TOKENS) || []).length;
  const en = (t.match(EN_TOKENS) || []).length;
  return es > en ? 'es' : 'en';          // empate -> en (idioma por defecto de BMAD/OpenSpec)
}

export function langScores(text) {
  const t = String(text || '');
  return { es: (t.match(ES_TOKENS) || []).length, en: (t.match(EN_TOKENS) || []).length };
}

const PERSON_RULES = {
  es: [
    [/\b(\w+[aeiáéí]r)(?:me|nos)\b/gi, '$1se'],   // registrarme -> registrarse
    [/\bmis\b/gi, 'sus'],
    [/\bmi\b/gi, 'su'],
    [/\bmí\b/gi, 'sí'],
    [/\bme\b/gi, 'le'],       // "cuando me publiquen" -> "cuando le publiquen"
    [/\bnos\b/gi, 'les'],
    [/\bconmigo\b/gi, 'consigo'],
    [/\byo\b/gi, ''],
  ],
  en: [
    [/\bmyself\b/gi, 'themselves'],
    [/\bmy\b/gi, 'their'],
    [/\bmine\b/gi, 'theirs'],
    [/\bme\b/gi, 'them'],
    [/\bI\b/g, 'they'],
  ],
};

export function normalizePerson(text, lang) {
  let out = String(text || '');
  for (const [re, to] of PERSON_RULES[lang] || []) out = out.replace(re, to);
  return out.replace(/\s{2,}/g, ' ').trim();
}

// El marco normativo se emite en el idioma del documento, pero `openspec validate --strict`
// exige el literal SHALL/MUST aunque el spec este en espanol (lo comprobamos contra el CLI real:
// "should contain SHALL or MUST"). Por eso el modo por defecto es `shall`: prosa en espanol con
// el keyword normativo intacto. `--normative debe` da mejor prosa pero obliga a soltar --strict.
function requirementText(story, lang, normative = 'shall') {
  // La plantilla inglesa de BMAD escribe "I want **to** register"; la espanola no lleva
  // infinitivo marcado. Sin esto sale "allow buyer to to publish".
  const want = noDot(normalizePerson(story.want, lang))
    .replace(/^to\s+be\s+able\s+to\s+/i, '')
    .replace(/^(?:to|poder)\s+/i, '');
  const role = noDot(story.role).replace(/^(a|an|un|una|el|la)\s+/i, '');

  const kw = lang === 'es' && normative === 'debe' ? 'DEBE' : 'SHALL';

  if (!want) {
    return lang === 'es'
      ? `El sistema ${kw} soportar ${lower1(noDot(story.title))}.`
      : `The system SHALL support ${lower1(noDot(story.title))}.`;
  }
  if (/^(the system|el sistema)\b/i.test(want)) {
    const t = capitalize(want);
    return /\b(SHALL|MUST|DEBE)\b/.test(t) ? `${t}.` : `${t}.`;
  }

  if (lang === 'es') {
    return role
      ? `El sistema ${kw} permitir que un ${role} pueda ${lower1(want)}.`
      : `El sistema ${kw} ${lower1(want)}.`;
  }
  return role
    ? `The system SHALL allow ${role} to ${lower1(want)}.`
    : `The system SHALL ${lower1(want)}.`;
}

function scenarioName(ac, i, taken) {
  const src = noDot(ac.when) || noDot(ac.then) || `Criterio ${i + 1}`;
  let name = capitalize(src.replace(/\s+/g, ' ')).slice(0, 72).replace(/[\s,;:-]+$/, '');
  if (taken.has(name.toLowerCase())) name = `${name} (${i + 1})`;
  taken.add(name.toLowerCase());
  return name;
}

// Los nombres de escenario que este change va a emitir. Para un requisito nuevo, derivados
// del WHEN. Para uno ya archivado, los nombres archivados mandan: OpenSpec exige que un
// MODIFIED traiga todos los escenarios actuales por nombre exacto.
export function scenarioNames(story, existing = null) {
  const taken = new Set();
  const candidates = story.acceptanceCriteria.map((ac, i) => scenarioName(ac, i, taken));
  if (!existing) return { names: candidates, dropped: [] };
  return reconcileScenarioNames(candidates, existing.scenarios);
}

function specDelta(epic, story, { isNewCapability, lang, normative, delta, names }) {
  const out = [];
  if (isNewCapability) {
    const purpose = noDot(epic.goal) || `Agrupa el comportamiento del epic "${epic.title}".`;
    // OpenSpec --strict exige 50+ caracteres en Purpose.
    const padded = purpose.length >= 50 ? purpose : `${purpose} Cubre las stories del Epic ${epic.n}: ${epic.title}.`;
    out.push('## Purpose', '', `${padded}.`.replace(/\.\.$/, '.'), '');
  }
  out.push(`## ${delta} Requirements`, '');
  out.push(`### Requirement: ${noDot(story.title)}`);
  out.push(requirementText(story, lang, normative), '');

  story.acceptanceCriteria.forEach((ac, i) => {
    out.push(`#### Scenario: ${names[i]}`);
    if (ac.given) out.push(`- **GIVEN** ${noDot(ac.given)}`);
    if (ac.when)  out.push(`- **WHEN** ${noDot(ac.when)}`);
    if (ac.then)  out.push(`- **THEN** ${noDot(ac.then)}`);
    for (const a of ac.and) out.push(`- **AND** ${noDot(a)}`);
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function proposal(epic, story, cap, { isNewCapability, delta, revision }) {
  let why = noDot(story.benefit)
    ? `${capitalize(noDot(story.benefit))}.`
    : `Entrega la Story ${story.id} del Epic ${epic.n}: ${epic.title}.`;
  // Una revision no es una story nueva: el porque de la primera version sigue valiendo, y
  // el lector tiene que saber que esta reemplazando algo ya construido.
  if (revision > 1) why += ` Revision ${revision} de la Story ${story.id}: el requisito ya estaba archivado y la story cambio.`;

  const lines = [
    '## Why', '', why, '',
    '## What Changes', '',
    `- ${capitalize(noDot(story.want) || noDot(story.title))}.`,
    ...story.acceptanceCriteria.filter((ac) => ac.then).map((ac) => `- ${capitalize(noDot(ac.then))}.`),
    '',
    '## Capabilities', '',
    '### New Capabilities', '',
  ];

  if (isNewCapability) lines.push(`- \`${cap}\`: ${noDot(epic.goal) || epic.title}.`, '');
  else lines.push('', '');

  lines.push('### Modified Capabilities', '');
  if (isNewCapability) lines.push('', '');
  else if (delta === 'MODIFIED') lines.push(`- \`${cap}\`: modifica el requisito "${noDot(story.title)}" (revision ${revision}).`, '');
  else lines.push(`- \`${cap}\`: agrega el requisito "${noDot(story.title)}".`, '');

  lines.push('## Impact', '',
    `- Origen: BMAD Story ${story.id} — Epic ${epic.n}: ${epic.title}`,
    ...coverageLines(story),
    `- Capability: \`${cap}\``,
    '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// La precision importa: un FR atribuido al epic entero no dice que ESTA story lo cumpla.
// Mezclarlos en una sola lista haria creer que la trazabilidad es mas fina de lo que es.
function coverageLines(story) {
  const from = story.requirementsFrom || { story: story.requirements || [], epic: [] };
  const out = [];
  if (from.story.length) out.push(`- Requisitos de esta story: ${from.story.join(', ')}`);
  if (from.epic.length) out.push(`- Requisitos del epic (precision de epic, no de story): ${from.epic.join(', ')}`);
  if (!out.length) out.push('- Requisitos cubiertos: (sin mapeo en epics.md)');
  return out;
}

// Cada afirmacion del escenario es una tarea. Antes se emitia una sola por criterio
// usando el THEN e ignorando los **AND**, asi que un escenario con cinco exigencias
// producia una casilla: el tasks.md salia mas delgado que el spec que debia cumplir.
function assertions(story) {
  const out = [];
  story.acceptanceCriteria.forEach((ac, i) => {
    const items = [ac.then, ...ac.and].map(noDot).filter(Boolean);
    if (!items.length && ac.when) items.push(noDot(ac.when));
    for (const text of items) out.push({ text, criterion: i + 1 });
  });
  if (!out.length) out.push({ text: noDot(story.want) || noDot(story.title), criterion: 1 });
  return out;
}

function tasks(story) {
  const items = assertions(story);
  const out = ['## 1. Implementacion', ''];
  items.forEach((a, i) => out.push(`- [ ] 1.${i + 1} ${a.text}`));
  out.push('', '## 2. Verificacion', '');
  items.forEach((a, i) => out.push(`- [ ] 2.${i + 1} Test del criterio ${a.criterion}: ${a.text}`));
  out.push('');
  return out.join('\n');
}

/**
 * @param {Set<string>} existingCapabilities capabilities ya presentes en openspec/specs/
 *        o ya declaradas por un change anterior de este mismo lote.
 * @param {object} [opts]
 * @param {{name:string, scenarios:string[]}|null} [opts.existingRequirement] el requisito tal
 *        como esta en el spec principal (ya archivado). Si existe, el delta es MODIFIED.
 * @param {number} [opts.revision] 1 la primera vez; n+1 tras n archives de la misma story.
 */
export function emitChange(epic, story, existingCapabilities, lang, normative = 'shall', opts = {}) {
  const cap = capabilityPath(epic);
  const isNewCapability = !existingCapabilities.has(cap);
  const existing = opts.existingRequirement || null;
  const revision = opts.revision || 1;
  const delta = existing ? 'MODIFIED' : 'ADDED';
  const id = revisedId(changeId(story), revision);
  const { names, dropped } = scenarioNames(story, existing);

  const files = {
    'proposal.md': proposal(epic, story, cap, { isNewCapability, delta, revision }),
    'tasks.md': tasks(story),
    [`specs/${cap}/spec.md`]: specDelta(epic, story, { isNewCapability, lang, normative, delta, names }),
  };

  return {
    id, capability: cap, isNewCapability, delta, revision, dropped,
    trace: {
      changeId: id,
      capability: cap,
      revision,
      delta,
      bmad: { epic: epic.n, epicTitle: epic.title, story: story.id, storyTitle: story.title },
      requirements: story.requirements,
      // De donde salio cada atribucion, para que /sw:change sepa cuanto puede confiar.
      requirementsFrom: story.requirementsFrom || { story: story.requirements || [], epic: [] },
      requirementName: noDot(story.title),
      scenarios: story.acceptanceCriteria.length,
    },
    files,
  };
}
