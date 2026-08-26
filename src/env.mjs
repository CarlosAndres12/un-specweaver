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
// Nombre de proyecto para Engram: estable, derivado de la carpeta. Es la etiqueta que
// separa la memoria de un proyecto de la de otro.
export function engramProject(root) {
  return path.basename(path.resolve(root)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Lee del .mcp.json del proyecto si engram quedo atado a un proyecto concreto.
// Sin ese binding la memoria es global y se mezcla entre proyectos: verificado.
export function engramBinding(root) {
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
  const store = ['.engram', '.atl'].map((d) => path.join(root, d)).find((d) => fs.existsSync(d));
  return { available: !!bin, bin, store: store ? path.relative(root, store) : null, project: engramBinding(root) };
}

export function isGitRepo(dir) {
  try { execFileSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

export function readState(root) {
  const f = path.join(root, '.un-specweaver', 'config.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

export function writeState(root, state) {
  const dir = path.join(root, '.un-specweaver');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

// Traduce nuestros ids canonicos a los que espera cada vendor.
export function vendorIds(agents, vendor) {
  return agents.map((a) => a.ids?.[vendor]).filter(Boolean).join(',');
}

// graphify es una capacidad OPCIONAL: se detecta, nunca se instala.
// El modo de fallo que hay que evitar es el silencioso — que el agente invoque /graphify,
// no pase nada, y siga explorando a ciegas sin decirlo. Por eso se reporta siempre.
//
// Ojo: la skill suele vivir en ~/.claude/skills/, o sea que puede existir para Claude Code
// y no para OpenCode. Se miran las cuatro rutas y se reporta cual.
export function detectGraphify(root, home = os.homedir()) {
  const candidates = [
    [path.join(root, '.claude', 'skills', 'graphify'), 'proyecto/.claude'],
    [path.join(root, '.agents', 'skills', 'graphify'), 'proyecto/.agents'],
    [path.join(home, '.claude', 'skills', 'graphify'), '~/.claude'],
    [path.join(home, '.agents', 'skills', 'graphify'), '~/.agents'],
  ];
  const found = candidates.filter(([p]) => fs.existsSync(p));
  const graphPath = path.join(root, 'graphify-out', 'graph.json');
  return {
    available: found.length > 0,
    where: found.map(([, label]) => label).join(', ') || null,
    graph: fs.existsSync(graphPath) ? path.relative(root, graphPath) : null,
  };
}
