// Todas las cadenas visibles del CLI, en un solo lugar.
// Regla: si una cadena se imprime al usuario, vive aqui. Si esta embebida en el codigo,
// alguien la va a olvidar cuando se agregue un idioma.
const S = {
  es: {
    ok: 'ok   ', fail: 'FALLA', warn: 'aviso', missing: 'falta', skip: 'skip ', drift: 'DRIFT',

    'init.header': (root) => `\nspecweaver init  —  ${root}\n`,
    'init.preflightFailed': '\nPreflight fallo. Corrige lo marcado FALLA y vuelve a intentar.',
    'init.notGitRepo': 'el directorio no es un repo git; los vendors funcionan igual, pero no vas a poder revertir',
    'init.unknownAgent': (id, valid) => `\nAgente desconocido: "${id}". Validos: ${valid}`,
    'init.noAgents': (valid) => `\nNo se detecto ningun agente. Instala Claude Code u OpenCode, o pasa --agents <id>.\nValidos: ${valid}`,
    'init.agents': 'agentes', 'init.language': 'idioma',
    'init.forced': '(forzados con --agents)', 'init.autodetected': '(autodetectados)',
    'init.dryRun': '\n--- dry-run: nada se escribe ni se ejecuta ---',
    'init.done': '\nListo.',
    'init.failed': (n, ids) => `\n${n} paso(s) con error: ${ids}`,
    'init.next': `\nSiguiente:
  1. Llena docs/architecture-base.md con la arquitectura de tu organizacion.
     Si lo dejas en blanco, /sw:new te lo va a decir y decidis ahi.
  2. Abri tu agente en esta carpeta y corre:  /sw:new
     (en OpenCode es /sw-new)

Los comandos, para tenerlos a mano:
  /sw:new              arrancar un proyecto desde cero
  /sw:build <change>   construir una historia
  /sw:change "<req>"   requerimiento nuevo (cambia lo acordado)
  /sw:bug "<defecto>"  defecto (lo acordado esta bien, el codigo no)
  /sw:ticket <n>       issue de GitHub: clasifica y enruta
  /sw:doctor           salud del entorno y del flujo`,
    'prefs.header': `\n  Configuracion del proyecto — Enter toma el valor por defecto [1].\n  Queda en .un-specweaver/config.json y no se vuelve a preguntar.\n`,
    'prefs.ask': '  > ',
    'prefs.agentsHeader': '\n  Agentes a configurar (detectados en tu maquina)\n',
    'prefs.agentsHint': '    Numeros separados por coma, o Enter para todos.\n',
    'prefs.agentsStored': (a) => `${a} (elegidos al configurar)`,
    'prefs.lang': `
  Idioma de comandos, documentos y mensajes
    1) Espanol
    2) English
`,
    'prefs.engramScope': `
  Memoria de Engram
    1) Por proyecto  — este proyecto no ve la memoria de los demas
    2) Global        — una sola memoria para todo lo que trabajes
`,
    'prefs.graphify': `
  Mapa del codigo con graphify (opcional, se detecta solo)
    1) Usarlo si esta instalado
    2) Ignorarlo aunque este
`,

    'lang.name': 'Spanish',

    'check.node': 'node >= 20.11', 'check.npx': 'npx', 'check.curl': 'curl',
    'check.git': 'git', 'check.platform': 'plataforma soportada',
    'check.uv': 'uv (Python)', 'check.uvMissing': 'ausente — BMAD resuelve su config sin el, pero mas lento',
    'check.notFound': 'no encontrado',

    'run.wrote': (f) => `escrito ${f}`,
    'run.removed': (f) => `removido ${f}`,
    'run.kept': (f) => `conservado ${f}`,
    'run.refusedOutside': (p) => `se rechazo borrar fuera del proyecto: ${p}`,
    'run.exitCode': (c) => `salio con codigo ${c}`,
    'run.unknownAction': (k) => `accion desconocida: ${k}`,
    'run.blocked': 'bloqueado por un prerequisito que solo vos podes autorizar',
    'run.remoteCode': (s) => `     ejecuta codigo remoto:\n       ${s}\n     continuar?`,
    'run.notAuthorized': 'no autorizado por el usuario',
    'run.yesChars': ['s', 'si', 'y', 'yes'],
    'run.yesNo': '[s/N]',
    'run.stepFailed': (id) => `     Paso "${id}" fallo. Los que no dependen de el siguen; corrige y vuelve a correr.`,
    'run.skippedDep': (dep) => `omitido: depende de "${dep}", que fallo`,
    'run.alreadyDone': 'ya hecho, se omite',

    'step.gitignore.title': 'Ignorar lo regenerable en git',
    'step.gitignore.ok': 'bloque ya presente',
    'step.gitignore.create': 'crea .gitignore',
    'step.gitignore.append': 'agrega el bloque al .gitignore existente',
    'step.gitignore.why': (n) => `${n} archivos de vendor son regenerables con init; el repo guarda specs, no dependencias`,
    'step.gitignore.noGit': 'no es un repo git, se omite',

    'step.surface.title': 'Una sola superficie de comandos',
    'step.surface.ok': 'sin comandos que compitan',
    'step.surface.pending': (n) => `${n} comando(s) de vendor por ocultar`,
    'step.surface.after': 'corre despues de instalar los vendors',
    'step.surface.why': 'compite con /sw:* y confunde: la skill sigue disponible',
    'step.surface.note': `Se podan COMANDOS, no skills. judgment-day, work-unit-commits, branch-pr y los
     revisores siguen ahi: se invocan pidiendolos en lenguaje normal.`,

    'step.bmad.title': 'BMAD METHOD (planeacion)',
    'step.bmad.ok': '_bmad/ ya existe (usa --force para reinstalar)',
    'step.bmad.why': (v) => `instala el modulo bmm pineado en ${v}, alcance del proyecto`,
    'step.bmad-prune.title': 'Podar los agentes constructores de BMAD',
    'step.bmad-prune.after': 'corre despues de instalar BMAD',
    'step.bmad-prune.pending': (n) => `${n} skill(s)/comando(s) por remover`,
    'step.bmad-prune.ok': 'ya podado',
    'step.bmad-prune.willRemove': 'se remueven si BMAD los instala en este mismo run',
    'step.bmad-prune.why': 'la construccion la hace el SDD',
    'step.openspec.title': 'OpenSpec (artefactos de especificacion)',
    'step.openspec.ok': 'openspec/ ya existe',
    'step.openspec.why': 'inicializa openspec/ y registra los comandos del agente',
    'step.gentle-bin.title': 'Binario de Gentle-AI',
    'step.gentle-bin.missing': 'no esta en PATH',
    'step.gentle-bin.already': (b) => `${b} ya instalado`,
    'step.gentle-bin.brew': 'via Homebrew: no ejecuta scripts remotos',
    'step.gentle-bin.curl': 'via oficial de Gentle-AI: descarga y ejecuta un script remoto',
    'step.gentle-config.title': 'Configurar Gentle-AI (SDD + Engram) en los agentes',
    'step.gentle-config.after': 'corre despues de instalar el binario',
    'step.gentle-config.ok': 'SDD instalado en el proyecto',
    'step.gentle-config.pending': (a) => `agentes: ${a}`,
    'step.gentle-config.why': (a) => `configura ${a} (alcance workspace para los assets de Gentle-AI)`,
    'step.gentle-config.perAgent': `Se configura un agente por comando: si uno falla (toolchain
     viejo, version incompatible), los demas quedan igual configurados.`,
    'step.gentle-config.globalWarning': `ATENCION: Engram registra su servidor MCP fuera del proyecto —
     ~/.engram/, ~/.claude/mcp/engram.json y la config de cada agente. --scope workspace
     no lo contiene: la config MCP es global por naturaleza. Verificado en una maquina real.`,
    'step.gentle.untrusted': (list) => `Homebrew no confia en: ${list}`,
    'step.gentle.untrustedWhy': `Gentle-AI instala Engram como parte de su propio pipeline, y brew se niega a
     cargar formulas no confiables. Autorizar una formula le da permiso de ejecutar codigo de
     instalacion en tu maquina: es una decision tuya, un-specweaver no la toma por vos.`,
    'step.gentle.untrustedFix': (cmds, tap) => `minimo privilegio — autoriza solo lo que falta:
${cmds}

     O de una vez el tap entero, si preferis no repetir esto cada vez que Gentle-AI
     sume una dependencia (incluye tambien gentle-creation y gentleman-dots):
       brew trust ${tap}

     Y despues:
       npx un-specweaver init`,
    'step.layer.title': 'Capa un-specweaver (comandos, skill, arquitectura base)',
    'step.layer.pending': (n) => `${n} archivo(s)`,
    'step.layer.ok': 'al dia',
    'step.layer.skill': (d) => `skill de orquestacion (${d})`,
    'step.layer.command': (inv, agent) => `${inv} en ${agent}`,
    'step.layer.arch': 'plantilla de arquitectura; se carga como contexto en diseno y construccion',
    'step.depAfter': (dep) => `se revisa tras "${dep}"`,
    'step.nothing': 'nada que podar',

    'doctor.fixing': 'Reparando salud del proyecto...',
    'doctor.header': (root) => `\nspecweaver doctor  —  ${root}\n`,
    'doctor.installed': (at, agents) => `\n  instalado  ${at}  agentes: ${agents}`,
    'doctor.noState': '\n  aviso  este proyecto no tiene .un-specweaver/config.json — corre "un-specweaver init"',
    'doctor.steps': '\n  pasos',
    'blocks.plan': 'necesario para planear (/sw:new, /sw:adopt)',
    'blocks.build': 'solo bloquea /sw:build — planear funciona sin esto',
    'blocks.none': 'higiene del repo, no bloquea nada',
    'doctor.pendingPlan': (n) => `\n${n} paso(s) bloquean la planeacion. Corre "un-specweaver init".`,
    'doctor.pendingBuildOnly': (n) => `\n${n} paso(s) pendiente(s), pero ninguno bloquea planear. Pod\u00e9s arrancar con /sw:new.`,
    'doctor.vendors': '\n  vendors pineados',
    'doctor.optional': '\n  opcional',
    'doctor.vendorLine': (installed, pinned) => `instalado: ${installed.padEnd(30)} pineado ahora: ${pinned}`,
    'doctor.notInstalled': 'no instalado',
    'doctor.unknownVersion': 'version desconocida',
    'doctor.pending': (n) => `\n${n} paso(s) pendiente(s). Corre "un-specweaver init" — los ya hechos se omiten solos.`,
    'doctor.allGood': '\nTodo al dia.',

    'engram.name': 'engram',
    'engram.present': (b) => `presente (${b})`,
    'engram.absent': 'ausente — el flujo funciona, pero el rationale de las decisiones no se guarda',
    'engram.globalByChoice': 'memoria GLOBAL por configuracion — compartida con tus otros proyectos',
    'graphify.disabled': 'desactivado por configuracion del proyecto',
    'step.engram.globalChoice': 'configurado como memoria global',
    'engram.store': (p) => `memoria en ${p}`,
    'engram.noStore': 'binario disponible, sin memoria en este proyecto todavia',
    'engram.scoped': (p) => `memoria aislada como "${p}"`,
    'engram.shared': 'MEMORIA COMPARTIDA con otros proyectos — sin --project, las busquedas ven todo',
    'step.engram.title': 'Aislar la memoria de Engram por proyecto',
    'step.engram.ok': (p) => `atado a "${p}"`,
    'step.engram.pending': (p) => `atar la memoria al proyecto "${p}"`,
    'step.engram.skip': 'engram no esta instalado',
    'step.engram.why': 'sin esto la memoria de este proyecto se mezcla con la de los demas',

    'graphify.name': 'graphify',
    'graphify.present': (where) => `presente (${where})`,
    'graphify.absent': 'ausente — los comandos siguen funcionando, pero sin mapa del codigo',
    'graphify.graph': (p) => `grafo construido en ${p}`,
    'graphify.noGraph': 'skill disponible, sin grafo construido todavia',
  },

  en: {
    ok: 'ok   ', fail: 'FAIL ', warn: 'warn ', missing: 'todo ', skip: 'skip ', drift: 'DRIFT',

    'init.header': (root) => `\nspecweaver init  —  ${root}\n`,
    'init.preflightFailed': '\nPreflight failed. Fix what is marked FAIL and try again.',
    'init.notGitRepo': 'not a git repo; the vendors still work, but you will not be able to revert',
    'init.unknownAgent': (id, valid) => `\nUnknown agent: "${id}". Valid: ${valid}`,
    'init.noAgents': (valid) => `\nNo agent detected. Install Claude Code or OpenCode, or pass --agents <id>.\nValid: ${valid}`,
    'init.agents': 'agents', 'init.language': 'language',
    'init.forced': '(forced with --agents)', 'init.autodetected': '(autodetected)',
    'init.dryRun': '\n--- dry-run: nothing is written or executed ---',
    'init.done': '\nDone.',
    'init.failed': (n, ids) => `\n${n} step(s) failed: ${ids}`,
    'init.next': `\nNext:
  1. Fill docs/architecture-base.md with your organization's architecture.
     If you leave it blank, /sw:new will tell you and you decide there.
  2. Open your agent in this folder and run:  /sw:new
     (on OpenCode it is /sw-new)

The commands, for reference:
  /sw:new              start a project from scratch
  /sw:build <change>   build one story
  /sw:change "<req>"   new requirement (changes what was agreed)
  /sw:bug "<defect>"   defect (what was agreed is fine, the code is not)
  /sw:ticket <n>       GitHub issue: classify and route
  /sw:doctor           environment and flow health`,
    'prefs.header': `\n  Project setup — Enter takes the default [1].\n  Stored in .un-specweaver/config.json and never asked again.\n`,
    'prefs.ask': '  > ',
    'prefs.agentsHeader': '\n  Agents to configure (detected on your machine)\n',
    'prefs.agentsHint': '    Comma-separated numbers, or Enter for all.\n',
    'prefs.agentsStored': (a) => `${a} (chosen at setup)`,
    'prefs.lang': `
  Language for commands, documents and messages
    1) Espanol
    2) English
`,
    'prefs.engramScope': `
  Engram memory
    1) Per project  — this project does not see other projects' memory
    2) Global       — one shared memory across everything you work on
`,
    'prefs.graphify': `
  Code map via graphify (optional, auto-detected)
    1) Use it if installed
    2) Ignore it even if present
`,

    'lang.name': 'English',

    'check.node': 'node >= 20.11', 'check.npx': 'npx', 'check.curl': 'curl',
    'check.git': 'git', 'check.platform': 'supported platform',
    'check.uv': 'uv (Python)', 'check.uvMissing': 'absent — BMAD resolves its config without it, but slower',
    'check.notFound': 'not found',

    'run.wrote': (f) => `wrote ${f}`,
    'run.removed': (f) => `removed ${f}`,
    'run.kept': (f) => `kept ${f}`,
    'run.refusedOutside': (p) => `refused to delete outside the project: ${p}`,
    'run.exitCode': (c) => `exited with code ${c}`,
    'run.unknownAction': (k) => `unknown action: ${k}`,
    'run.blocked': 'blocked by a prerequisite only you can authorize',
    'run.remoteCode': (s) => `     runs remote code:\n       ${s}\n     continue?`,
    'run.notAuthorized': 'not authorized by the user',
    'run.yesChars': ['y', 'yes', 's', 'si'],
    'run.yesNo': '[y/N]',
    'run.stepFailed': (id) => `     Step "${id}" failed. Steps that do not depend on it continue; fix and run again.`,
    'run.skippedDep': (dep) => `skipped: depends on "${dep}", which failed`,
    'run.alreadyDone': 'already done, skipping',

    'step.gitignore.title': 'Ignore regenerable files in git',
    'step.gitignore.ok': 'block already present',
    'step.gitignore.create': 'creates .gitignore',
    'step.gitignore.append': 'appends the block to the existing .gitignore',
    'step.gitignore.why': (n) => `${n} vendor files are regenerable with init; the repo keeps specs, not dependencies`,
    'step.gitignore.noGit': 'not a git repo, skipped',

    'step.surface.title': 'One command surface',
    'step.surface.ok': 'no competing commands',
    'step.surface.pending': (n) => `${n} vendor command(s) to hide`,
    'step.surface.after': 'runs after the vendors are installed',
    'step.surface.why': 'competes with /sw:* and confuses: the skill stays available',
    'step.surface.note': `Commands are pruned, not skills. judgment-day, work-unit-commits, branch-pr and
     the reviewers are still there: invoke them by asking in plain language.`,

    'step.bmad.title': 'BMAD METHOD (planning)',
    'step.bmad.ok': '_bmad/ already exists (use --force to reinstall)',
    'step.bmad.why': (v) => `installs the bmm module pinned at ${v}, project scope`,
    'step.bmad-prune.title': 'Prune BMAD builder skills',
    'step.bmad-prune.after': 'runs after BMAD is installed',
    'step.bmad-prune.pending': (n) => `${n} skill(s)/command(s) to remove`,
    'step.bmad-prune.ok': 'already pruned',
    'step.bmad-prune.willRemove': 'removed if BMAD installs them in this same run',
    'step.bmad-prune.why': 'building is done by SDD',
    'step.openspec.title': 'OpenSpec (specification artifacts)',
    'step.openspec.ok': 'openspec/ already exists',
    'step.openspec.why': 'initializes openspec/ and registers the agent commands',
    'step.gentle-bin.title': 'Gentle-AI binary',
    'step.gentle-bin.missing': 'not on PATH',
    'step.gentle-bin.already': (b) => `${b} already installed`,
    'step.gentle-bin.brew': 'via Homebrew: runs no remote scripts',
    'step.gentle-bin.curl': "Gentle-AI's official path: downloads and runs a remote script",
    'step.gentle-config.title': 'Configure Gentle-AI (SDD + Engram) on the agents',
    'step.gentle-config.after': 'runs after the binary is installed',
    'step.gentle-config.ok': 'SDD installed in the project',
    'step.gentle-config.pending': (a) => `agents: ${a}`,
    'step.gentle-config.why': (a) => `configures ${a} (workspace scope for Gentle-AI assets)`,
    'step.gentle-config.perAgent': `One agent per command: if one fails (stale toolchain,
     incompatible version), the others still get configured.`,
    'step.gentle-config.globalWarning': `HEADS UP: Engram registers its MCP server outside the project —
     ~/.engram/, ~/.claude/mcp/engram.json and each agent's config. --scope workspace does not
     contain it: MCP config is global by nature. Verified on a real machine.`,
    'step.gentle.untrusted': (list) => `Homebrew does not trust: ${list}`,
    'step.gentle.untrustedWhy': `Gentle-AI installs Engram as part of its own pipeline, and brew refuses to load
     untrusted formulae. Trusting a formula grants it permission to run install code on your
     machine: that is your decision, un-specweaver does not make it for you.`,
    'step.gentle.untrustedFix': (cmds, tap) => `least privilege — authorize only what is missing:
${cmds}

     Or the whole tap at once, if you would rather not repeat this every time Gentle-AI
     adds a dependency (it also includes gentle-creation and gentleman-dots):
       brew trust ${tap}

     Then:
       npx un-specweaver init`,
    'step.layer.title': 'un-specweaver layer (commands, skill, base architecture)',
    'step.layer.pending': (n) => `${n} file(s)`,
    'step.layer.ok': 'up to date',
    'step.layer.skill': (d) => `orchestration skill (${d})`,
    'step.layer.command': (inv, agent) => `${inv} on ${agent}`,
    'step.layer.arch': 'architecture template; loaded as context in design and build',
    'step.depAfter': (dep) => `re-checked after "${dep}"`,
    'step.nothing': 'nothing to prune',

    'doctor.fixing': 'Repairing project health...',
    'doctor.header': (root) => `\nspecweaver doctor  —  ${root}\n`,
    'doctor.installed': (at, agents) => `\n  installed  ${at}  agents: ${agents}`,
    'doctor.noState': '\n  warn   this project has no .un-specweaver/config.json — run "un-specweaver init"',
    'doctor.steps': '\n  steps',
    'blocks.plan': 'required to plan (/sw:new, /sw:adopt)',
    'blocks.build': 'only blocks /sw:build — planning works without it',
    'blocks.none': 'repo hygiene, blocks nothing',
    'doctor.pendingPlan': (n) => `\n${n} step(s) block planning. Run "un-specweaver init".`,
    'doctor.pendingBuildOnly': (n) => `\n${n} step(s) pending, but none blocks planning. You can start with /sw:new.`,
    'doctor.vendors': '\n  pinned vendors',
    'doctor.optional': '\n  optional',
    'doctor.vendorLine': (installed, pinned) => `installed: ${installed.padEnd(30)} pinned now: ${pinned}`,
    'doctor.notInstalled': 'not installed',
    'doctor.unknownVersion': 'unknown version',
    'doctor.pending': (n) => `\n${n} step(s) pending. Run "un-specweaver init" — completed ones are skipped.`,
    'doctor.allGood': '\nAll up to date.',

    'engram.name': 'engram',
    'engram.present': (b) => `presente (${b})`,
    'engram.absent': 'ausente — el flujo funciona, pero el rationale de las decisiones no se guarda',
    'engram.globalByChoice': 'memoria GLOBAL por configuracion — compartida con tus otros proyectos',
    'graphify.disabled': 'desactivado por configuracion del proyecto',
    'step.engram.globalChoice': 'configurado como memoria global',
    'engram.store': (p) => `memoria en ${p}`,
    'engram.noStore': 'binario disponible, sin memoria en este proyecto todavia',
    'engram.scoped': (p) => `memoria aislada como "${p}"`,
    'engram.shared': 'MEMORIA COMPARTIDA con otros proyectos — sin --project, las busquedas ven todo',
    'step.engram.title': 'Aislar la memoria de Engram por proyecto',
    'step.engram.ok': (p) => `atado a "${p}"`,
    'step.engram.pending': (p) => `atar la memoria al proyecto "${p}"`,
    'step.engram.skip': 'engram no esta instalado',
    'step.engram.why': 'sin esto la memoria de este proyecto se mezcla con la de los demas',

    'engram.name': 'engram',
    'engram.present': (b) => `present (${b})`,
    'engram.absent': 'absent — the flow works, but decision rationale is not recorded',
    'engram.globalByChoice': 'GLOBAL memory by configuration — shared with your other projects',
    'graphify.disabled': 'disabled by project configuration',
    'step.engram.globalChoice': 'configured as global memory',
    'engram.store': (p) => `memory at ${p}`,
    'engram.noStore': 'binary available, no memory in this project yet',
    'engram.scoped': (p) => `memory isolated as "${p}"`,
    'engram.shared': 'MEMORY SHARED with other projects — without --project, searches see everything',
    'step.engram.title': 'Scope Engram memory to this project',
    'step.engram.ok': (p) => `bound to "${p}"`,
    'step.engram.pending': (p) => `bind memory to project "${p}"`,
    'step.engram.skip': 'engram is not installed',
    'step.engram.why': "without this the project's memory mixes with every other project's",

    'graphify.name': 'graphify',
    'graphify.present': (where) => `present (${where})`,
    'graphify.absent': 'absent — commands still work, but without a code map',
    'graphify.graph': (p) => `graph built at ${p}`,
    'graphify.noGraph': 'skill available, no graph built yet',
  },
};

export const LANGS = Object.keys(S);

export function t(lang, key, ...args) {
  const v = (S[lang] || S.es)[key] ?? S.es[key];
  if (v === undefined) throw new Error(`cadena i18n faltante: ${key}`);
  return typeof v === 'function' ? v(...args) : v;
}

// Sirve para el test que verifica que ningun idioma se quede atras.
export function keysOf(lang) { return Object.keys(S[lang] || {}); }
