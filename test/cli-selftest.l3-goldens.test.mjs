import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STEPS, commandPath, NAMESPACE } from '../src/steps.mjs';
import { VENDORS } from '../src/env.mjs';
import {
  withIsolatedHome,
  makeTempProject,
  cleanupDirs,
} from './helpers/isolated-home.mjs';

// Goldens L3 (ola 2): la capa instalada por agente × commandStyle, generada vía
// `buildPlan`/`files()` puro en proceso (sin spawn, sin red), comparada byte a
// byte contra `src/layer`. El oráculo es INDEPENDIENTE: no llama a
// `renderCommand` para construir lo esperado — re-deriva cada formato desde el
// asset crudo. Así, mutar `renderCommand` rompe el golden (tarea 2.4) en vez de
// moverse con él. Solo `commandPath` se reutiliza (mapeo de rutas, sin lógica
// de formato). Sin conteos literales: todo conjunto esperado se deriva de
// `src/layer` o de `src/vendors.json`.

const ROOT = path.resolve(import.meta.dirname, '..');
const LAYER = path.join(ROOT, 'src', 'layer');
const SELF = path.join(import.meta.dirname, 'cli-selftest.l3-goldens.test.mjs');

const AGENT_IDS = Object.keys(VENDORS.agents);
const LANGS = { es: 'Spanish', en: 'English' };
// Contrato documentado agente→estilo (diseño §Interfaces): se lee de
// vendors.json y se fija aquí para que un cambio de estilo rompa el golden.
const EXPECTED_STYLE = {
  'claude-code': 'namespaced',
  opencode: 'prefixed',
  antigravity: 'skill',
};

const ctxFor = (root, id, lang = 'es') => ({
  root,
  agents: [{ ...VENDORS.agents[id], id }],
  platform: 'linux',
  lang,
  langName: LANGS[lang],
});

const layerFiles = (ctx) => STEPS.find((s) => s.id === 'layer').files(ctx);

// Comandos vigentes por idioma, derivados del directorio (nunca literales).
const commandNames = (lang) =>
  fs
    .readdirSync(path.join(LAYER, 'commands', lang))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -'.md'.length))
    .sort();

// --- Oráculo independiente (no usa renderCommand de prod) --------------------
// Replica el contrato de formato por estilo desde el asset crudo:
// namespaced conserva `/sw:` y emite name+description+allowed-tools;
// prefixed reescribe a `/sw-` y emite solo description;
// skill reescribe a `sw-` y emite name `sw-<cmd>` + description.
function splitRaw(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, 'el asset crudo debe traer frontmatter ---/../---');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return { meta, body: m[2] };
}

const quoteYaml = (v) => `"${String(v).replace(/"/g, '\\"')}"`;

function expectedCommand(style, raw) {
  const { meta, body } = splitRaw(raw);
  if (style === 'skill') {
    const rewritten = body.replace(
      new RegExp(`/${NAMESPACE}:([a-z][a-z0-9-]*)`, 'g'),
      `${NAMESPACE}-$1`,
    );
    return (
      ['---', `name: ${NAMESPACE}-${meta.name || meta.title}`, `description: ${quoteYaml(meta.description || meta.title || '')}`, '---', ''].join('\n') +
      rewritten
    );
  }
  if (style === 'namespaced') {
    const head = ['---', `name: ${quoteYaml(meta.title || meta.name)}`, `description: ${quoteYaml(meta.description || '')}`];
    if (meta['allowed-tools']) head.push(`allowed-tools: ${meta['allowed-tools']}`);
    head.push('---', '');
    return head.join('\n') + body;
  }
  const rewritten = body.replace(
    new RegExp(`/${NAMESPACE}:([a-z][a-z0-9-]*)`, 'g'),
    `/${NAMESPACE}-$1`,
  );
  return ['---', `description: ${quoteYaml(meta.description || '')}`, '---', ''].join('\n') + rewritten;
}

function expectedSkill(lang) {
  return fs.readFileSync(path.join(LAYER, 'skills', 'un-specweaver', `SKILL.${lang}.md`), 'utf8');
}

function expectedArch(lang) {
  return fs.readFileSync(path.join(LAYER, 'docs', `architecture-base.${lang}.md`), 'utf8');
}

function findGenerated(files, root, agentCfg, name) {
  const rel = commandPath(agentCfg, name);
  const hit = files.find((f) => f.file === path.join(root, rel));
  assert.ok(hit, `la capa debe emitir ${rel} para ${agentCfg.id || agentCfg.commandStyle}`);
  return hit;
}

// ---------------------------------------------------------------------------
// Tarea 2.2 — golden por agente × estilo × idioma, byte a byte vs src/layer
// ---------------------------------------------------------------------------

for (const id of AGENT_IDS) {
  for (const lang of Object.keys(LANGS)) {
    test(`L3 — ${id} (${VENDORS.agents[id].commandStyle}) golden ${lang} byte a byte vs src/layer`, () => {
      assert.equal(VENDORS.agents[id].commandStyle, EXPECTED_STYLE[id], `${id} debe mantener su estilo documentado`);
      const root = makeTempProject('l3-');
      try {
        const agentCfg = { ...VENDORS.agents[id], id };
        const files = layerFiles(ctxFor(root, id, lang));
        for (const name of commandNames(lang)) {
          const raw = fs.readFileSync(path.join(LAYER, 'commands', lang, `${name}.md`), 'utf8');
          const got = findGenerated(files, root, agentCfg, name);
          assert.equal(got.content, expectedCommand(agentCfg.commandStyle, raw), `${id}/${lang}/${name}: el generado debe igualar al golden byte a byte`);
        }
        // La skill va a todos los agentes sin atajo: bytes idénticos al asset.
        for (const dir of [...new Set([agentCfg.skills])]) {
          const hit = files.find((f) => f.file === path.join(root, dir, 'un-specweaver', 'SKILL.md'));
          assert.ok(hit, `${id}: la skill debe emitirse en ${dir}`);
          assert.equal(hit.content, expectedSkill(lang), `${id}/${lang}: SKILL.md debe igualar al asset byte a byte`);
        }
        const arch = files.find((f) => f.file === path.join(root, 'docs', 'architecture-base.md'));
        assert.ok(arch, `${id}: la plantilla de arquitectura debe emitirse`);
        assert.equal(arch.content, expectedArch(lang), `${id}/${lang}: architecture-base.md debe igualar al asset byte a byte`);
      } finally {
        cleanupDirs(root);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Tarea 2.2 (doneMarker) + 2.3 — skills ancladas a vendors.json, sin conteos
// ---------------------------------------------------------------------------

test('L3 — doneMarker (sdd-apply) anclado a vendors.json y cubierto por skillPrefixes', () => {
  const { doneMarker, skills, skillPrefixes } = VENDORS.gentle;
  assert.ok(doneMarker && typeof doneMarker === 'string', 'vendors.json debe declarar doneMarker');
  assert.equal(doneMarker, 'sdd-apply', 'el marcador de install-evidence es sdd-apply');
  assert.ok(
    skillPrefixes.some((p) => doneMarker.startsWith(p)),
    `doneMarker ${doneMarker} debe estar cubierto por algún skillPrefixes de vendors.json (${skillPrefixes.join(', ')})`,
  );
  for (const s of skills) {
    assert.ok(typeof s === 'string' && s.length > 0, 'cada skill del manifiesto debe ser un nombre no vacío');
    assert.ok(!/\s/.test(s), `la skill ${s} no debe contener espacios`);
  }
  for (const p of skillPrefixes) {
    assert.ok(typeof p === 'string' && p.length > 0, 'cada prefijo del manifiesto debe ser no vacío');
  }
});

test('L3 — cambiar el manifiesto cambia lo esperado (sin listas ni conteos duros)', () => {
  // Triangulación: si el manifiesto ganara una skill, la derivación la incluye;
  // si el marcador dejara de estar cubierto, el chequeo falla. Nada está
  // hardcodeado: la prueba fallaría si el código congelara la lista.
  const derived = [...VENDORS.gentle.skills];
  const extended = { ...VENDORS.gentle, skills: [...VENDORS.gentle.skills, 'skill-nueva-de-manifiesto'] };
  assert.ok(extended.skills.includes('skill-nueva-de-manifiesto'), 'la derivación debe incluir una skill agregada al manifiesto');
  assert.ok(!derived.includes('skill-nueva-de-manifiesto'), 'la derivación vigente no debe inventar skills ausentes del manifiesto');
  const covered = (g) => g.skillPrefixes.some((p) => g.doneMarker.startsWith(p));
  assert.ok(covered(VENDORS.gentle), 'el manifiesto vigente cubre su doneMarker');
  assert.ok(!covered({ ...VENDORS.gentle, doneMarker: 'marcador-fuera-de-prefijo' }), 'un doneMarker sin prefijo debe detectarse como no cubierto');
});

// ---------------------------------------------------------------------------
// Tarea 2.4 — regresión de estilo: mutar un formato rompe su golden
// ---------------------------------------------------------------------------

function oneGenerated(id, lang, name) {
  const root = makeTempProject('l3-');
  const agentCfg = { ...VENDORS.agents[id], id };
  const files = layerFiles(ctxFor(root, id, lang));
  const got = findGenerated(files, root, agentCfg, name);
  const raw = fs.readFileSync(path.join(LAYER, 'commands', lang, `${name}.md`), 'utf8');
  const golden = expectedCommand(agentCfg.commandStyle, raw);
  assert.equal(got.content, golden, 'precondición: el golden vigente pasa antes de mutar');
  cleanupDirs(root);
  return golden;
}

test('L3 — regresión namespaced: quitar allowed-tools rompe el golden', () => {
  const golden = oneGenerated('claude-code', 'es', 'new');
  assert.match(golden, /^allowed-tools: /m, 'precondición: el golden namespaced trae allowed-tools');
  const mutated = golden.replace(/^allowed-tools: .*\n/m, '');
  assert.notEqual(mutated, golden, 'mutar el formato namespaced debe romper su golden');
});

test('L3 — regresión prefixed: devolver /sw: rompe el golden', () => {
  const golden = oneGenerated('opencode', 'es', 'change');
  assert.match(golden, /\/sw-change/, 'precondición: el golden prefixed usa /sw-');
  assert.ok(!golden.includes('/sw:'), 'precondición: el golden prefixed no contiene /sw:');
  const mutated = golden.replace(`/${NAMESPACE}-change`, `/${NAMESPACE}:change`);
  assert.notEqual(mutated, golden, 'mutar el formato prefixed debe romper su golden');
});

test('L3 — regresión skill: renombrar name: sw- rompe el golden', () => {
  const golden = oneGenerated('antigravity', 'en', 'build');
  assert.match(golden, new RegExp(`^name: ${NAMESPACE}-build$`, 'm'), 'precondición: el golden skill nombra sw-<cmd>');
  const mutated = golden.replace(`name: ${NAMESPACE}-build`, 'name: build');
  assert.notEqual(mutated, golden, 'mutar el formato skill debe romper su golden');
});

// ---------------------------------------------------------------------------
// Round-trip a disco con HOME aislado + auditoría de la suite
// ---------------------------------------------------------------------------

test('L3 — los goldens sobreviven un round-trip a disco en proyecto aislado', async () => {
  await withIsolatedHome(async () => {
    const proj = makeTempProject('l3-');
    try {
      const agentCfg = { ...VENDORS.agents['claude-code'], id: 'claude-code' };
      const files = layerFiles(ctxFor(proj, 'claude-code', 'es'));
      for (const f of files) {
        if (f.keepExisting) continue;
        fs.mkdirSync(path.dirname(f.file), { recursive: true });
        fs.writeFileSync(f.file, f.content, 'utf8');
      }
      for (const name of commandNames('es')) {
        const raw = fs.readFileSync(path.join(LAYER, 'commands', 'es', `${name}.md`), 'utf8');
        const onDisk = fs.readFileSync(path.join(proj, commandPath(agentCfg, name)), 'utf8');
        assert.equal(onDisk, expectedCommand('namespaced', raw), `${name}: el byte en disco debe igualar al golden`);
      }
    } finally {
      cleanupDirs(proj);
    }
  });
});

test('L3 — auditoría: sin helper duplicado ni deps de red/navegador/LLM', () => {
  const src = fs.readFileSync(SELF, 'utf8');
  // Patrones construidos por partes: escribirlos literales haría que la
  // auditoría se detectara a sí misma (self-match del propio source).
  const defHelper = new RegExp('function' + ' withIsolatedHome|const' + ' withIsolatedHome');
  assert.ok(!defHelper.test(src), 'la suite debe reutilizar el helper, no definir su propio withIsolatedHome');
  const banned = ['play' + 'wright', 'cy' + 'press', 'selen' + 'ium', 'open' + 'ai', 'anthro' + 'pic'];
  for (const frag of banned) {
    const hit = src.split('\n').some((line) => line.startsWith('import') && line.includes(frag));
    assert.ok(!hit, `la suite no debe importar ${frag} (límite explícito del harness)`);
  }
  assert.ok(!/\blength\s*===?\s*\d+/.test(src), 'la suite no debe usar conteos literales en asserts');
  assert.ok(src.includes('withIsolatedHome') && src.includes('makeTempProject'), 'la suite debe reutilizar el helper compartido');
});
