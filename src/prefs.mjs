// Preferencias del proyecto: se preguntan UNA vez, quedan en .un-specweaver/config.json,
// y no se vuelven a preguntar. Los flags siempre mandan sobre lo guardado.
import readline from 'node:readline/promises';
import { t } from './i18n.mjs';

export const DEFAULTS = { lang: 'es' };

export const CHOICES = {
  lang: ['es', 'en'],
};

// Cada pregunta: la respuesta vacia toma el default, que va primero.
const QUESTIONS = [
  { key: 'lang', options: ['es', 'en'], aliases: { es: ['1', 'es', 'espanol', 'español'], en: ['2', 'en', 'english', 'ingles'] } },
];

export function parseAnswer(key, answer, fallback) {
  const q = QUESTIONS.find((x) => x.key === key);
  const a = String(answer || '').trim().toLowerCase();
  if (!a) return fallback;
  for (const [value, forms] of Object.entries(q.aliases)) if (forms.includes(a)) return value;
  return fallback;
}

/**
 * Precedencia: flag > guardado > pregunta (si hay terminal) > default.
 * `ask` solo se llama para las claves que de verdad hay que preguntar.
 */
export async function resolvePrefs({ flags = {}, stored = {}, isTTY = false }, ask) {
  const out = {};
  const pending = [];

  for (const { key } of QUESTIONS) {
    if (flags[key] && CHOICES[key].includes(flags[key])) { out[key] = flags[key]; continue; }
    if (stored[key] && CHOICES[key].includes(stored[key])) { out[key] = stored[key]; continue; }
    pending.push(key);
  }

  if (!pending.length) return { prefs: out, asked: [] };
  if (!isTTY) {                                   // CI: defaults explicitos, nunca se cuelga
    for (const k of pending) out[k] = DEFAULTS[k];
    return { prefs: out, asked: [] };
  }

  const answers = await ask(pending);
  for (const k of pending) out[k] = parseAnswer(k, answers[k], DEFAULTS[k]);
  return { prefs: out, asked: pending };
}

// Los agentes no son una opcion fija: dependen de lo que haya en la maquina.
// Se preguntan aparte y quedan guardados, para no re-detectar (y re-meter) uno que
// el usuario ya descarto.
export async function promptAgents(detected, lang = 'es') {
  if (detected.length <= 1) return detected.map((a) => a.id);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(t(lang, 'prefs.agentsHeader'));
  detected.forEach((a, i) => process.stdout.write(`    ${i + 1}) ${a.id}\n`));
  process.stdout.write(t(lang, 'prefs.agentsHint'));
  const raw = await rl.question(t(lang, 'prefs.ask'));
  rl.close();
  process.stdout.write('\n');
  return parseAgents(raw, detected.map((a) => a.id));
}

export function parseAgents(raw, available) {
  const a = String(raw || '').trim().toLowerCase();
  if (!a) return available;                       // Enter = todos los detectados
  const picked = [];
  for (const tok of a.split(/[,\s]+/).filter(Boolean)) {
    const byNum = available[Number(tok) - 1];
    if (byNum) { picked.push(byNum); continue; }
    if (available.includes(tok)) picked.push(tok);
  }
  return picked.length ? [...new Set(picked)] : available;
}

export async function promptPrefs(keys, lang = 'es') {
  process.stdout.write(t(lang, 'prefs.header'));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answers = {};
  for (const k of keys) {
    process.stdout.write(t(lang, `prefs.${k}`));
    answers[k] = await rl.question(t(lang, 'prefs.ask'));
  }
  rl.close();
  process.stdout.write('\n');
  return answers;
}

export function validateFlag(key, value) {
  if (value === undefined || value === null) return null;
  return CHOICES[key].includes(value) ? null : `--${key}: ${CHOICES[key].join(' | ')}`;
}
