// Cada paso separa PLAN (puro, testeable, imprimible con --dry-run) de EJECUCION.
// Sin esa separacion, --dry-run seria una mentira mantenida a mano.
import fs from 'node:fs';
import path from 'node:path';
import { VENDORS, which, vendorIds, isGitRepo, untrustedItems, engramProject, engramBinding } from './env.mjs';
import { t } from './i18n.mjs';

const LAYER = new URL('./layer/', import.meta.url);
const readAsset = (rel) => fs.readFileSync(new URL(rel, LAYER), 'utf8');
const listAssets = (rel) => fs.readdirSync(new URL(rel, LAYER)).filter((f) => f.endsWith('.md')).sort();

export const NAMESPACE = 'sw';

// Frontmatter minimo: clave: valor por linea, sin anidamiento. Suficiente para
// comandos y evita meter una dependencia de YAML en un paquete que no tiene ninguna.
function splitFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return { meta, body: m[2] };
}

const yamlStr = (v) => `"${String(v).replace(/"/g, '\\"')}"`;

// Cada agente nombra y ubica los comandos distinto. Verificado contra lo que
// OpenSpec instala: Claude usa .claude/commands/<ns>/<n>.md -> /ns:n con frontmatter
// name/description/allowed-tools; OpenCode usa .opencode/commands/<ns>-<n>.md -> /ns-n
// con solo description.
export function renderCommand(style, meta, body) {
  // El cuerpo es unico para los agentes, pero las referencias cruzadas entre comandos
  // tienen que usar la sintaxis del agente donde se leen: /sw:change en Claude, /sw-change
  // en OpenCode, sw-change en Antigravity (skills).
  if (style === 'skill') {
    body = body.replace(new RegExp(`/${NAMESPACE}:([a-z][a-z0-9-]*)`, 'g'), `${NAMESPACE}-$1`);
    const lines = [
      '---',
      `name: ${NAMESPACE}-${meta.name || meta.title}`,
      `description: ${yamlStr(meta.description || meta.title || '')}`,
      '---',
      '',
    ];
    return lines.join('\n') + body;
  }
  if (style !== 'namespaced') {
    body = body.replace(new RegExp(`/${NAMESPACE}:([a-z][a-z0-9-]*)`, 'g'), `/${NAMESPACE}-$1`);
  }
  if (style === 'namespaced') {
    const lines = ['---', `name: ${yamlStr(meta.title || meta.name)}`, `description: ${yamlStr(meta.description || '')}`];
    if (meta['allowed-tools']) lines.push(`allowed-tools: ${meta['allowed-tools']}`);
    lines.push('---', '');
    return lines.join('\n') + body;
  }
  return ['---', `description: ${yamlStr(meta.description || '')}`, '---', ''].join('\n') + body;
}

export function commandPath(agent, name) {
  if (agent.commandStyle === 'skill') {
    return path.join(agent.skills, `${NAMESPACE}-${name}`, 'SKILL.md');
  }
  return agent.commandStyle === 'namespaced'
    ? path.join(agent.commands, NAMESPACE, `${name}.md`)
    : path.join(agent.commands, `${NAMESPACE}-${name}.md`);
}

const exec  = (cmd, args, why, opts = {}) => ({ kind: 'exec', cmd, args, why, ...opts });
const write = (file, content, why, opts = {}) => ({ kind: 'write', file, content, why, ...opts });
const rm    = (target, why) => ({ kind: 'rm', target, why });
const note  = (text) => ({ kind: 'note', text });
// Un prerequisito que solo el usuario puede autorizar. Falla el paso a proposito:
// reportar "listo" sobre algo que no ocurrio seria mentir.
const blocked = (title, why, fix) => ({ kind: 'blocked', title, why, fix });

// `curl | sh` es la via oficial de Gentle-AI, pero descarga y ejecuta codigo remoto.
// Se marca `consent: true` para que el runner nunca lo corra sin autorizacion explicita.
const shell = (script, why) => ({ kind: 'shell', script, why, consent: true });

const skillDirs   = (agents) => [...new Set(agents.map((a) => a.skills))];

// Gentle-AI con --scope workspace replica el directorio del agente DENTRO del proyecto:
// OpenCode termina en <proyecto>/.config/opencode/ con sus propios commands y skills.
// Descubierto en una instalacion limpia: 60 archivos sin ignorar y los /sdd-* seguian
// visibles en OpenCode porque la poda solo miraba .opencode/commands.
const agentHomes = (agents) => [...new Set(agents.map((a) => a.home).filter(Boolean))];
const commandDirs = (agents) => [...new Set([
  ...agents.filter((a) => a.commandStyle !== 'skill').map((a) => a.commands).filter(Boolean),
  ...agentHomes(agents).map((h) => path.join(h, 'commands')),
])];

export const GITIGNORE_START = '# >>> un-specweaver >>>';
export const GITIGNORE_END   = '# <<< un-specweaver <<<';

// Lo que se ignora es SOLO lo regenerable con `un-specweaver init`, por patron exacto.
// Ignorar `.claude/` entero escondería las skills y comandos propios del usuario, que no
// son nuestros para ocultar.
export function gitignoreBlock(_agentsIgnored) {
  // Se cubren los directorios de TODOS los agentes conocidos, no solo los seleccionados.
  // Correr `init --agents claude-code` regeneraba el bloque sin las rutas de .agents/ y
  // desprotegia 229 archivos que ya estaban ignorados. Ignorar la ruta de un agente que
  // no esta instalado no cuesta nada; desprotegerla si.
  const agents = Object.values(VENDORS.agents);
  const lines = [GITIGNORE_START, '# Regenerable con `un-specweaver init` — no va al repo.', '',
                 'node_modules/', '_bmad/', '**/.openspec-target',
                 ...VENDORS.gentle.generatedProjectDirs.map((d) => `${d}/`), ''];
  // Cada vendor escribe en sitios distintos. OpenSpec ademas crea <dir-del-agente>/skills/,
  // que no aparece en la config porque BMAD manda las skills de OpenCode a .agents/skills.
  // Se deriva del directorio propio del agente para no dejar esa ruta fuera.
  const siblings = agents.flatMap((a) => (a.commands ? [path.join(path.dirname(a.commands), 'skills')] : []));
  const dirs = [...new Set([...agents.flatMap((a) => [a.skills, a.commands].filter(Boolean)), ...siblings])].sort();
  for (const d of dirs) {
    if (d.endsWith('skills')) {
      lines.push(`${d}/bmad-*/`, `${d}/openspec-*/`, `${d}/un-specweaver/`, `${d}/${NAMESPACE}-*/`);
      // Gentle-AI instala ~25 skills mas. Se enumeran porque no comparten un prefijo unico
      // y porque ignorar `${d}/` entero escondería las skills propias del usuario.
      for (const pre of VENDORS.gentle.skillPrefixes) lines.push(`${d}/${pre}*/`);
      for (const sk of VENDORS.gentle.skills) lines.push(`${d}/${sk}/`);
    } else {
      lines.push(`${d}/${NAMESPACE}/`, `${d}/${NAMESPACE}-*.md`, `${d}/opsx/`, `${d}/opsx-*.md`, `${d}/bmad-*.md`);
      for (const pre of VENDORS.gentle.skillPrefixes) lines.push(`${d}/${pre}*.md`);
    }
  }
  // Config de agente generada por Gentle-AI. CLAUDE.md y settings.json quedan fuera de
  // esta lista a proposito: los genera, pero son los que un humano edita, y perder las
  // reglas propias en silencio es peor que un poco de ruido en git.
  const homes = [...new Set([
    ...agents.map((a) => (a.commands ? path.dirname(a.commands) : null)).filter(Boolean),
    ...agentHomes(agents),
  ])].sort();
  // Un home donde el usuario tambien guarda lo suyo (.claude, que contiene sus skills y
  // comandos) se ignora por patron. Un home que Gentle-AI creo entero (.config/opencode,
  // que no es donde viven las skills ni los comandos de OpenCode) se puede ignorar completo.
  const sharedWithUser = new Set(agents.flatMap((a) => [a.skills, a.commands].filter(Boolean).map((d) => path.dirname(d))));
  for (const h of homes) {
    for (const d of VENDORS.gentle.generatedDirs) lines.push(`${h}/${d}/`);
    for (const pre of VENDORS.gentle.agentPrefixes) lines.push(`${h}/agents/${pre}*.md`);
    if (!sharedWithUser.has(h)) lines.push(`${h}/`);
  }

  lines.push('', `# Al repo SI van: openspec/, _bmad-output/, docs/, .un-specweaver/, ${VENDORS.gentle.keepTracked.join(', ')}`, GITIGNORE_END);
  return lines.join('\n') + '\n';
}

function hasGentleConfig(root, agents) {
  const marker = VENDORS.gentle.doneMarker;
  return agents.some((a) => {
    const candidates = [
      a.skills,
      a.home ? path.join(a.home, 'skills') : null,
      a.home ? path.join(a.home, 'antigravity-cli', 'skills') : null,
      a.commands && a.commandStyle !== 'skill' ? path.join(path.dirname(a.commands), 'skills') : null,
    ].filter(Boolean);
    return candidates.some((dir) => fs.existsSync(path.join(root, dir, marker)));
  });
}

export const STEPS = [
  {
    id: 'gitignore',
    blocks: 'none',
    title: 'gitignore',
    titleKey: 'step.gitignore.title',
    status(ctx) {
      if (!isGitRepo(ctx.root)) return { state: 'skip', detail: t(ctx.lang, 'step.gitignore.noGit') };
      const f = path.join(ctx.root, '.gitignore');
      const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      return cur.includes(GITIGNORE_START)
        ? { state: 'ok', detail: t(ctx.lang, 'step.gitignore.ok') }
        : { state: 'pending', detail: t(ctx.lang, fs.existsSync(f) ? 'step.gitignore.append' : 'step.gitignore.create') };
    },
    plan(ctx) {
      const f = path.join(ctx.root, '.gitignore');
      const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      const block = gitignoreBlock(ctx.agents);
      // Se preserva lo que el usuario ya tenia; el bloque propio se reemplaza entero.
      const without = cur.includes(GITIGNORE_START)
        ? cur.replace(new RegExp(`${GITIGNORE_START}[\\s\\S]*?${GITIGNORE_END}\\n?`), '')
        : cur;
      const content = without.trimEnd() ? `${without.trimEnd()}\n\n${block}` : block;
      return [write(f, content, t(ctx.lang, 'step.gitignore.why', '~400'))];
    },
  },

  {
    id: 'bmad',
    blocks: 'plan',
    titleKey: 'step.bmad.title',
    status(ctx) {
      const dir = path.join(ctx.root, '_bmad');
      return fs.existsSync(dir)
        ? { state: 'ok', detail: t(ctx.lang, 'step.bmad.ok') }
        : { state: 'pending', detail: `npm ${VENDORS.bmad.npm}@${VENDORS.bmad.version}` };
    },
    plan(ctx) {
      const v = VENDORS.bmad;
      const args = [
        '--yes', `${v.npm}@${v.version}`, 'install', '--yes',
        '--directory', ctx.root,
        '--modules', v.modules,
        '--tools', vendorIds(ctx.agents, 'bmad'),
        '--communication-language', ctx.langName,
        '--document-output-language', ctx.langName,
        // Sin esto, --yes instala shims deprecados que reenvian a skills que este
        // montaje poda; quedarian apuntando al vacio.
        ...(v.noShims ? ['--no-shims'] : []),
      ];
      return [exec('npx', args, t(ctx.lang, 'step.bmad.why', v.version))];
    },
  },

  {
    id: 'bmad-prune',
    blocks: 'plan',
    dependsOn: 'bmad',
    titleKey: 'step.bmad-prune.title',
    status(ctx) {
      // Sin BMAD instalado no hay nada en disco que podar, pero eso no es "ya podado":
      // el paso corre despues de la instalacion. Decir lo contrario haria mentir al dry-run.
      if (!fs.existsSync(path.join(ctx.root, '_bmad'))) return { state: 'pending', detail: t(ctx.lang, 'step.bmad-prune.after') };
      const present = this.targets(ctx).filter((t) => fs.existsSync(t));
      return present.length
        ? { state: 'pending', detail: t(ctx.lang, 'step.bmad-prune.pending', present.length) }
        : { state: 'ok', detail: t(ctx.lang, 'step.bmad-prune.ok') };
    },
    targets(ctx) {
      const list = [...VENDORS.bmad.prune, ...(ctx.pruneExtra ? VENDORS.bmad.pruneOptional : [])];
      return [
        // BMAD instala cada skill dos veces: el directorio y un comando .md por agente.
        // Podar solo el directorio deja los constructores invocables desde OpenCode.
        ...skillDirs(ctx.agents).flatMap((d) => list.map((s) => path.join(ctx.root, d, s))),
        ...commandDirs(ctx.agents).flatMap((d) => list.map((s) => path.join(ctx.root, d, `${s}.md`))),
      ];
    },
    plan(ctx) {
      const all = this.targets(ctx);
      const present = all.filter((t) => fs.existsSync(t));
      const targets = present.length ? present : all;      // aun no instalado: se planean todos
      return [
        note(VENDORS.bmad.pruneReason),
        ...(present.length ? [] : [note(t(ctx.lang, 'step.bmad-prune.willRemove'))]),
        ...targets.map((target) => rm(target, t(ctx.lang, 'step.bmad-prune.why'))),
      ];
    },
  },

  {
    id: 'openspec',
    blocks: 'plan',
    titleKey: 'step.openspec.title',
    status(ctx) {
      return fs.existsSync(path.join(ctx.root, 'openspec'))
        ? { state: 'ok', detail: t(ctx.lang, 'step.openspec.ok') }
        : { state: 'pending', detail: `npm ${VENDORS.openspec.npm}@${VENDORS.openspec.version}` };
    },
    plan(ctx) {
      const v = VENDORS.openspec;
      return [exec('npx', [
        '--yes', `${v.npm}@${v.version}`, 'init', ctx.root,
        '--tools', vendorIds(ctx.agents, 'openspec'),
        '--language', ctx.langName,
      ], t(ctx.lang, 'step.openspec.why'))];
    },
  },

  {
    id: 'gentle-bin',
    blocks: 'build',
    titleKey: 'step.gentle-bin.title',
    status(ctx) {
      const bin = which(VENDORS.gentle.bin);
      return bin ? { state: 'ok', detail: bin } : { state: 'pending', detail: t(ctx.lang, 'step.gentle-bin.missing') };
    },
    plan(ctx) {
      const v = VENDORS.gentle;
      if (which(v.bin)) return [note(t(ctx.lang, 'step.gentle-bin.already', v.bin))];
      if (ctx.platform === 'darwin' && which('brew')) {
        return [exec('brew', ['install', `${v.brewTap}/${v.brewFormula}`], t(ctx.lang, 'step.gentle-bin.brew'))];
      }
      return [shell(`curl -fsSL ${v.installer} | bash`, t(ctx.lang, 'step.gentle-bin.curl'))];
    },
  },

  {
    id: 'gentle-config',
    blocks: 'build',
    dependsOn: 'gentle-bin',
    titleKey: 'step.gentle-config.title',
    status(ctx) {
      if (!which(VENDORS.gentle.bin)) return { state: 'pending', detail: t(ctx.lang, 'step.gentle-config.after') };
      // gentle-ai 2.4 ya no crea .atl/. La evidencia de que corrio es que el SDD quedo
      // instalado en el dir de skills del agente.
      const done = hasGentleConfig(ctx.root, ctx.agents);
      return done
        ? { state: 'ok', detail: t(ctx.lang, 'step.gentle-config.ok') }
        : { state: 'pending', detail: t(ctx.lang, 'step.gentle-config.pending', ctx.agents.map((a) => a.id).join(', ')) };
    },
    plan(ctx) {
      const v = VENDORS.gentle;
      const missing = untrustedItems(v.brewTap, v.brewFormulae);
      if (missing && missing.length) {
        // Item por item y tipo por tipo, no el tap entero: menos privilegio, y evita
        // el caso de engram, que es formula y cask a la vez.
        const cmds = missing.map((m) => `       brew trust --${m.kind} ${m.name}`).join('\n');
        return [blocked(
          t(ctx.lang, 'step.gentle.untrusted', missing.map((m) => `${m.name} (${m.kind})`).join(', ')),
          t(ctx.lang, 'step.gentle.untrustedWhy'),
          t(ctx.lang, 'step.gentle.untrustedFix', cmds, v.brewTap),
        )];
      }
      // Este es el unico paso que escribe fuera del proyecto. Decirlo antes de correr,
      // no despues de que el usuario lo descubra en su HOME.
      // Un comando por agente. Pasarlos todos juntos hacia que un Codex desactualizado
      // tumbara la configuracion de Claude Code, que no tenia nada malo.
      return [
        note(t(ctx.lang, 'step.gentle-config.globalWarning')),
        note(t(ctx.lang, 'step.gentle-config.perAgent')),
        ...ctx.agents.map((a) => exec(VENDORS.gentle.bin, [
          'install', '--agents', a.ids.gentle, '--scope', 'workspace',
        ], t(ctx.lang, 'step.gentle-config.why', a.id), { tolerateFailure: true })),
      ];
    },
  },

  {
    id: 'engram-scope',
    blocks: 'build',
    // Sin dependsOn a proposito: ya verifica el binario de engram por su cuenta, y
    // declarar la dependencia hacia que un fallo de gentle-config lo arrastrara.
    titleKey: 'step.engram.title',
    status(ctx) {
      if (ctx.prefs?.engramScope === 'global') return { state: 'skip', detail: t(ctx.lang, 'step.engram.globalChoice') };
      if (!which('engram')) return { state: 'skip', detail: t(ctx.lang, 'step.engram.skip') };
      const bound = engramBinding(ctx.root);
      const want = engramProject(ctx.root);
      return bound === want
        ? { state: 'ok', detail: t(ctx.lang, 'step.engram.ok', bound) }
        : { state: 'pending', detail: t(ctx.lang, 'step.engram.pending', want) };
    },
    plan(ctx) {
      const f = path.join(ctx.root, '.mcp.json');
      const project = engramProject(ctx.root);
      let j = {};
      try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* nuevo */ }
      j.mcpServers = j.mcpServers || {};
      // Se preservan los demas servidores; solo se define/ajusta engram.
      j.mcpServers.engram = {
        command: which('engram') || 'engram',
        args: ['mcp', '--tools=agent', '--project', project],
      };
      return [write(f, JSON.stringify(j, null, 2) + '\n', t(ctx.lang, 'step.engram.why'))];
    },
  },

  {
    id: 'surface',
    blocks: 'none',
    dependsOn: 'gentle-config',
    titleKey: 'step.surface.title',
    status(ctx) {
      if (ctx.keepVendorCommands) return { state: 'skip', detail: '--keep-vendor-commands' };
      const found = this.targets(ctx).filter((t) => fs.existsSync(t));
      return found.length
        ? { state: 'pending', detail: t(ctx.lang, 'step.surface.pending', found.length) }
        : { state: 'ok', detail: t(ctx.lang, 'step.surface.ok') };
    },
    targets(ctx) {
      const out = [];
      for (const d of commandDirs(ctx.agents)) {
        const dir = path.join(ctx.root, d);
        for (const sub of VENDORS.surface.pruneCommandDirs) out.push(path.join(dir, sub));
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
          if (f.endsWith('.md') && VENDORS.surface.pruneCommandPrefixes.some((p) => f.startsWith(p))) out.push(path.join(dir, f));
        }
      }
      return out;
    },
    plan(ctx) {
      const found = this.targets(ctx).filter((t) => fs.existsSync(t));
      if (!found.length) return [note(t(ctx.lang, 'step.surface.ok'))];
      return [note(t(ctx.lang, 'step.surface.note')), ...found.map((f) => rm(f, t(ctx.lang, 'step.surface.why')))];
    },
  },

  {
    id: 'layer',
    blocks: 'plan',
    titleKey: 'step.layer.title',
    status(ctx) {
      const missing = this.files(ctx).filter((f) => !f.keepExisting && !fs.existsSync(f.file));
      return missing.length ? { state: 'pending', detail: t(ctx.lang, 'step.layer.pending', missing.length) } : { state: 'ok', detail: t(ctx.lang, 'step.layer.ok') };
    },
    files(ctx) {
      const lang = ctx.lang === 'en' ? 'en' : 'es';
      const out = [];

      // La skill va a todos los agentes: es el mismo contenido, sin atajo.
      const skill = readAsset(`skills/un-specweaver/SKILL.${lang}.md`);
      for (const d of skillDirs(ctx.agents))
        out.push({ file: path.join(ctx.root, d, 'un-specweaver', 'SKILL.md'), content: skill, why: t(ctx.lang, 'step.layer.skill', d) });

      // Los comandos solo a los agentes con formato documentado (Claude Code, OpenCode).
      const names = listAssets(`commands/${lang}`).map((f) => f.replace(/\.md$/, ''));
      for (const agent of ctx.agents.filter((a) => a.commands)) {
        for (const name of names) {
          const { meta, body } = splitFrontmatter(readAsset(`commands/${lang}/${name}.md`));
          const invocation = agent.commandStyle === 'namespaced'
            ? `/${NAMESPACE}:${name}`
            : (agent.commandStyle === 'skill' ? `${NAMESPACE}-${name}` : `/${NAMESPACE}-${name}`);
          out.push({
            file: path.join(ctx.root, commandPath(agent, name)),
            content: renderCommand(agent.commandStyle, meta, body),
            why: t(ctx.lang, 'step.layer.command', invocation, agent.id),
          });
        }
      }

      out.push({
        file: path.join(ctx.root, 'docs', 'architecture-base.md'),
        content: readAsset(`docs/architecture-base.${lang}.md`),
        why: t(ctx.lang, 'step.layer.arch'),
        keepExisting: true,
      });
      return out;
    },
    plan(ctx) {
      return this.files(ctx)
        .filter((f) => !(f.keepExisting && fs.existsSync(f.file)))
        .map((f) => write(f.file, f.content, f.why, { keepExisting: f.keepExisting }));
    },
  },
];

export function buildPlan(ctx, { only = [], skip = [] } = {}) {
  const selected = STEPS.filter((s) => (!only.length || only.includes(s.id)) && !skip.includes(s.id));
  const statuses = new Map(selected.map((s) => [s.id, s.status(ctx)]));

  // Si una dependencia va a correr en este mismo run, el dependiente no puede
  // reportarse como "ya hecho" contra un disco que todavia no cambio.
  for (const s of selected) {
    const dep = s.dependsOn && statuses.get(s.dependsOn);
    if (dep && dep.state === 'pending' && statuses.get(s.id).state === 'ok') {
      statuses.set(s.id, { state: 'pending', detail: t(ctx.lang, 'step.depAfter', s.dependsOn) });
    }
  }

  return selected.map((s) => {
    const status = statuses.get(s.id);
    const actions = status.state === 'ok' && !ctx.force ? [note(t(ctx.lang, 'run.alreadyDone'))]
      : status.state === 'skip' ? [note(status.detail)]
      : s.plan(ctx);
    return { id: s.id, blocks: s.blocks, title: t(ctx.lang, s.titleKey), status, actions };
  });
}

export function renderAction(a, root) {
  const rel = (p) => path.relative(root, p) || '.';
  switch (a.kind) {
    case 'exec':  return `$ ${a.cmd} ${a.args.map((x) => (/[\s]/.test(x) ? JSON.stringify(x) : x)).join(' ')}`;
    case 'shell': return `$ ${a.script}`;
    case 'write': return `+ ${rel(a.file)} (${Buffer.byteLength(a.content)} bytes)`;
    case 'rm':    return `- ${rel(a.target)}`;
    case 'note':  return `  ${a.text}`;
    case 'blocked': return `! ${a.title}`;
    default:      return `  ?`;
  }
}
