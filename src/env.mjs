// Preflight y deteccion. Todo puro salvo las lecturas de disco y `which`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { t } from './i18n.mjs';

export const VENDORS = JSON.parse(fs.readFileSync(new URL('./vendors.json', import.meta.url), 'utf8'));

// Sin shell: escanear PATH evita el warning de deprecacion de Node y cualquier
// riesgo de inyeccion si el nombre del binario viniera de un flag del usuario.
export function which(bin, env = process.env) {
  if (!bin || bin.includes('/')) return null;
  for (const dir of (env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, bin);
    try { fs.accessSync(candidate, fs.constants.X_OK); return candidate; } catch { /* siguiente */ }
  }
  return null;
}

const semver = (v) => String(v).replace(/^v/, '').split('.').map(Number);
export function gte(a, b) {
  const [A, B] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d > 0; }
  return true;
}

export function preflight(lang = 'es') {
  const checks = [];
  const push = (key, ok, detail, fatal = true) => checks.push({ name: t(lang, key), ok, detail, fatal });
  const nf = t(lang, 'check.notFound');

  push('check.node', gte(process.versions.node, '20.11.0'), `node ${process.versions.node}`);
  push('check.npx', !!which('npx'), which('npx') || nf);
  push('check.curl', !!which('curl'), which('curl') || nf);
  push('check.git', !!which('git'), which('git') || nf, false);
  // BMAD verifica uv al instalar y sus skills lo usan para resolver customize.toml.
  // No es bloqueante: las skills traen fallback manual. Pero callarlo seria mentir.
  push('check.uv', !!which('uv'), which('uv') || t(lang, 'check.uvMissing'), false);

  const platform = os.platform();
  push('check.platform', platform === 'darwin' || platform === 'linux', platform);

  return { checks, ok: checks.every((c) => c.ok || !c.fatal), platform };
}

// Un agente cuenta como instalado si tiene binario en PATH o directorio de config en $HOME.
export function detectAgents(home = os.homedir()) {
  const found = [];
  for (const [id, cfg] of Object.entries(VENDORS.agents)) {
    const bin = cfg.bin ? which(cfg.bin) : null;
    const dir = cfg.home ? path.join(home, cfg.home) : null;
    const hasDir = dir ? fs.existsSync(dir) : false;
    // Se copia cfg entero: enumerar campos a mano es como se perdio commandStyle una vez.
    // `home` NO se pisa: es la ruta RELATIVA del agente, y se usa tal cual dentro del
    // proyecto (Gentle-AI la replica ahi con --scope workspace). La absoluta va aparte.
    if (bin || hasDir) found.push({ ...cfg, id, bin, homeDir: hasDir ? dir : null });
  }
  return found;
}

// Homebrew exige confianza por ITEM y por TIPO. Verificado contra un caso real: `engram`
// existe en el tap como formula Y como cask; confiar la formula no basta porque brew resuelve
// `brew install engram` a la cask, y pide `--cask` aparte. Ademas `brew tap-info` reporta el
// tap entero como "Untrusted" aunque haya items suyos confiados, asi que se lee trust.json.
export function brewTrusted(home = os.homedir(), env = process.env) {
  const files = [
    env.XDG_CONFIG_HOME && path.join(env.XDG_CONFIG_HOME, 'homebrew', 'trust.json'),
    path.join(home, '.homebrew', 'trust.json'),
  ].filter(Boolean);
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      return {
        formulae: new Set(j.trustedformulae || []),
        casks: new Set(j.trustedcasks || []),
        taps: new Set(j.trustedtaps || []),
      };
    } catch { /* siguiente */ }
  }
  return { formulae: new Set(), casks: new Set(), taps: new Set() };
}

// Que tipos publica el tap para cada nombre. Un nombre puede ser las dos cosas.
export function brewTapKinds(tap) {
  try {
    const out = execFileSync('brew', ['tap-info', tap, '--json'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const info = JSON.parse(out)[0] || {};
    return { formulae: new Set(info.formula_names || []), casks: new Set(info.cask_tokens || []) };
  } catch { return null; }
}

// Devuelve [{ name, kind }] de lo que aun falta autorizar. Vacio = nada pendiente.
// null = no aplica (sin brew, o el tap no esta instalado).
export function untrustedItems(tap, names, home = os.homedir(), env = process.env) {
  if (!which('brew')) return null;
  const kinds = brewTapKinds(tap);
  if (!kinds) return null;
  const trusted = brewTrusted(home, env);

  // Confiar el tap entero cubre todos sus items. Ignorarlo producia un bloqueo falso
  // justo despues de que el usuario hiciera lo que se le pidio.
  if (trusted.taps.has(tap)) return [];

  const missing = [];
  for (const name of names) {
    const full = `${tap}/${name}`;
    // Se exige confianza para cada tipo bajo el que el tap lo publica: no se puede
    // adivinar cual va a resolver brew, y equivocarse deja al usuario en el mismo error.
    if (kinds.formulae.has(full) && !trusted.formulae.has(full)) missing.push({ name: full, kind: 'formula' });
    if (kinds.casks.has(full) && !trusted.casks.has(full)) missing.push({ name: full, kind: 'cask' });
  }
  return missing;
}

// Engram lo instala Gentle-AI, pero puede quedar bloqueado por confianza de Homebrew.
// Se detecta por la misma razon que graphify: el fallo grave seria que un comando diga
// "registra esto en Engram", no pase nada, y el rationale se pierda en silencio.

// Nombre de repo tal como lo deriva engram de `origin` (extractRepoName + normalize):
// ultimo segmento de la URL, sin .git, en minusculas. Se replica para que las memorias
// guardadas ANTES de correr init (por autodeteccion) queden bajo el mismo nombre.
export function gitRemoteName(root) {
  try {
    const url = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().replace(/\.git$/, '');
    const name = url.split(/[/:]/).filter(Boolean).pop() || '';
    return name.trim().toLowerCase() || null;
  } catch { return null; }
}

// Nombre de proyecto para Engram: estable y derivado del repo. Es la etiqueta que separa
// la memoria de un proyecto de la de otro. Primero el remote (lo mismo que engram
// autodetecta); sin remote, la carpeta en forma segura.
export function engramProject(root) {
  const remote = gitRemoteName(root);
  if (remote) return remote;
  return path.basename(path.resolve(root)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const ENGRAM_CONFIG = path.join('.engram', 'config.json');

// Lee a que proyecto quedo atada la memoria. La fuente es .engram/config.json: es el
// caso 0 de la deteccion de engram (mayor prioridad) y lo respetan TODOS sus servidores
// MCP — el plugin de Claude Code, el global de Gentle-AI, OpenCode y el CLI — porque
// todos resuelven por cwd.
export function engramBinding(root) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, ENGRAM_CONFIG), 'utf8'));
    return String(j.project_name || '').trim().toLowerCase() || null;
  } catch { return null; }
}

// Version anterior: un servidor "engram" con --project en .mcp.json. En Claude Code
// convivia con el plugin de Engram y el agente veia dos juegos de herramientas de
// memoria; en OpenCode no aplicaba (no lee .mcp.json). Se detecta para retirarlo.
export function legacyEngramMcp(root) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8'));
    const srv = j.mcpServers?.engram;
    if (!srv) return null;
    const i = (srv.args || []).indexOf('--project');
    if (i >= 0 && srv.args[i + 1]) return srv.args[i + 1];
    return srv.env?.ENGRAM_PROJECT || null;
  } catch { return null; }
}

export function detectEngram(root) {
  const bin = which('engram');
  return { available: !!bin, bin, project: engramBinding(root), legacyMcp: !!legacyEngramMcp(root) };
}

export function isGitRepo(dir) {
  try { execFileSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

// Dos archivos, porque son dos cosas. `config.json` es del PROYECTO (idioma, poda extra) y va
// al repo: el equipo comparte la decision. `local.json` es de la MAQUINA (que agentes tiene
// cada quien, rutas de binarios, que paso instalo, cuando) y se ignora: commitearlo era un
// diff por compañero en cada PR — señalado en revision de codigo, y con razon.
const PROJECT_KEYS = ['version', 'preferences', 'pruneExtra'];

export function readState(root) {
  const dir = path.join(root, '.un-specweaver');
  const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } };
  const config = read('config.json');
  if (!config) return null;
  const local = read('local.json') || {};
  // Un config.json de 0.x traia todo junto: se lee igual, y el proximo init lo separa.
  const merged = { ...config, ...local };
  merged.preferences = { ...(config.preferences || {}), ...(local.agents ? { agents: local.agents } : {}) };
  if (config.lang && !merged.preferences.lang) merged.preferences.lang = config.lang;
  return merged;
}

export function writeState(root, state) {
  const dir = path.join(root, '.un-specweaver');
  fs.mkdirSync(dir, { recursive: true });
  const { agents: _prefAgents, ...projectPrefs } = state.preferences || {};
  const config = { version: 2, preferences: projectPrefs };
  if (state.pruneExtra) config.pruneExtra = true;
  const local = {};
  for (const [k, v] of Object.entries(state)) if (!PROJECT_KEYS.includes(k) && k !== 'lang') local[k] = v;
  if (state.preferences?.agents) local.agents = state.preferences.agents;
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'local.json'), JSON.stringify(local, null, 2) + '\n', 'utf8');
}

// Traduce nuestros ids canonicos a los que espera cada vendor.
export function vendorIds(agents, vendor) {
  return agents.map((a) => a.ids?.[vendor]).filter(Boolean).join(',');
}

// graphify es parte del metodo, no una capacidad opcional: el grafo AST es el unico testigo
// de la estructura REAL del codigo, y /sw:change lo usa para medir impacto. Se detecta con
// precision porque el modo de fallo que hay que evitar es el silencioso: que el agente invoque
// /graphify, no pase nada, y siga explorando a ciegas sin decirlo.
//
// La skill se instala DENTRO del proyecto (graphify install --project), en la ruta que cada
// agente usa para graphify — no coincide con la de BMAD para OpenCode (.opencode vs .agents).
export function detectGraphify(root, agents = Object.entries(VENDORS.agents).map(([id, a]) => ({ ...a, id }))) {
  const v = VENDORS.graphify;
  const skills = agents
    .filter((a) => a.graphifySkill)
    .map((a) => ({ id: a.id, path: a.graphifySkill, present: fs.existsSync(path.join(root, a.graphifySkill, 'SKILL.md')) }));
  const graphPath = path.join(root, v.outDir, 'graph.json');
  return {
    bin: which(v.bin),
    skills,
    ignore: graphifyIgnoreOk(root),
    hook: graphifyHookOk(root),
    graph: fs.existsSync(graphPath) ? path.relative(root, graphPath) : null,
  };
}

export const GRAPHIFY_IGNORE_START = '# >>> un-specweaver >>>';
export const GRAPHIFY_IGNORE_END   = '# <<< un-specweaver <<<';

export function graphifyIgnoreOk(root) {
  try { return fs.readFileSync(path.join(root, VENDORS.graphify.ignoreFile), 'utf8').includes(GRAPHIFY_IGNORE_START); }
  catch { return false; }
}

// El hook lo escribe `graphify hook install` en .git/hooks/post-commit. Se verifica por
// contenido, no por existencia: un post-commit ajeno no cuenta.
export function graphifyHookOk(root) {
  try {
    const gitDir = execFileSync('git', ['-C', root, 'rev-parse', '--git-dir'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const hook = path.resolve(root, gitDir, 'hooks', 'post-commit');
    return fs.readFileSync(hook, 'utf8').includes('graphify');
  } catch { return false; }
}
