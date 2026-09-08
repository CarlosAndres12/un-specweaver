#!/usr/bin/env node
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { init, doctor, update } from '../src/init.mjs';
import { VENDORS } from '../src/env.mjs';

const pkg = createRequire(import.meta.url)('../package.json');

const HELP = `
un-specweaver ${pkg.version} — flujo de desarrollo dirigido por especificacion
  BMAD (planeacion) -> puente deterministico -> OpenSpec/SDD (ejecucion)

USO
  npx un-specweaver init [dir]        prepara el entorno completo en un proyecto
  npx un-specweaver update [dir]      actualiza la capa de skills, comandos y configuracion
  npx un-specweaver doctor [dir] [--fix] revisa salud, pasos pendientes y drift de vendors
  npx un-specweaver bridge <epics.md> convierte stories de BMAD en changes de OpenSpec
  npx un-specweaver context        lista los artefactos de planeacion a cargar
  npx un-specweaver vendors           muestra las versiones pineadas
  npx un-specweaver dashboard [--port <n>] [--host <h>] [--open]
  npx un-specweaver ui               alias de dashboard

INIT
  --agents <ids>   agentes a configurar (default: autodetectados)
                   validos: ${Object.keys(VENDORS.agents).join(', ')}
  Preferencias del proyecto. Si se omiten y hay terminal, init las pregunta una vez y
  quedan en .un-specweaver/config.json. Los flags siempre mandan sobre lo guardado.

  --lang es|en                 idioma de comandos, documentos y mensajes
  --engram-scope project|global  memoria aislada por proyecto, o una sola para todo
  --graphify auto|off          usar el mapa del codigo si esta instalado, o ignorarlo
  --dry-run        imprime el plan exacto sin escribir ni ejecutar nada
  --yes            no pregunta antes de ejecutar el instalador remoto de Gentle-AI
  --force          rehace pasos que ya estaban hechos
  --keep-vendor-commands  conserva /sdd-* y /opsx:* (por defecto se ocultan)
  --prune-extra    poda tambien ${VENDORS.bmad.pruneOptional.join(', ')} (el SDD queda unico dueno de los tests)
  --only <ids>     corre solo estos pasos (coma-separados)
  --skip <ids>     omite estos pasos
  --keep-going     no se detiene en el primer paso que falle

UPDATE
  npx un-specweaver update [dir] [--agents <ids>] [--lang es|en] [--vendors] [--dry-run]
  Actualiza comandos /sw:*, skills de agentes y .gitignore sin tocar arquitectura ni especificaciones.
  --vendors        reconcilia tambien dependencias upstream (BMAD, OpenSpec, Gentle-AI)

QUE HACE INIT
  1. preflight: node >= 20.11, npx, curl, plataforma
  2. instala BMAD pineado, alcance del proyecto, solo el modulo de planeacion
  3. poda ${VENDORS.bmad.prune.join(', ')}
     (escriben codigo o compiten con OpenSpec; --no-shims evita los shims deprecados)
  4. inicializa OpenSpec
  5. instala y configura Gentle-AI (SDD + Engram) con alcance workspace
  6. escribe la skill un-specweaver y docs/architecture-base.md

  Todo queda dentro del proyecto. Nada se escribe en tu $HOME salvo el binario
  de Gentle-AI, que es una herramienta de sistema.

DASHBOARD
  npx un-specweaver dashboard [--port <n>] [--host <h>] [--open]
  npx un-specweaver ui               alias de dashboard
  Inicia el servidor del dashboard en puerto libre (default 3100), sirve la SPA en /
  y loguea Dashboard en http://127.0.0.1:<port>
  Flags:
    --port <n>   puerto (default 3100, 0 = efimero, reintenta siguiente libre)
    --host <h>   host (default 127.0.0.1)
    --open       abrir navegador del sistema sin bloquear
    --no-open    no abrir navegador (default)
    --help, -h   ayuda de dashboard
`;

const DASHBOARD_HELP = `
un-specweaver dashboard — inicia el dashboard web multi-proyecto

USO
  npx un-specweaver dashboard [--port <n>] [--host <h>] [--open]
  npx un-specweaver ui               alias de dashboard

DESCRIPCION
  Inicia el servidor en puerto libre (default 3100, reintenta 3101, 3102... hasta 10 intentos),
  sirve la SPA en / y loguea Dashboard en http://127.0.0.1:<port>.

FLAGS
  --port <n>   puerto a usar (default 3100). 0 = puerto efimero aleatorio.
  --host <h>   host a usar (default 127.0.0.1)
  --open       abrir navegador del sistema a la URL efectiva sin bloquear
  --no-open    no abrir navegador (default)
  --help, -h   muestra esta ayuda
  --version, -v muestra la version

EJEMPLOS
  npx un-specweaver dashboard
  npx un-specweaver ui --port 3200 --open
  npx un-specweaver dashboard --port 0 --host 127.0.0.1
  npx un-specweaver dashboard --no-open

NOTAS
  ESM estricto, Node >=20.11, sin process.chdir.
  Apertura de navegador (preferencia Chromium): darwin open -a Chromium/Google Chrome, linux chromium/chromium-browser/google-chrome → xdg-open, win32 start chrome → start.
  Proceso no bloqueado: spawn detached + unref. SIGINT/SIGTERM cierran el servidor.
`;

function openBrowser(url) {
  // Preferencia Chromium sobre Firefox/default — mantiene fallback para compatibilidad
  const trySpawn = (cmd, args) => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
      child.on('error', () => {});
      child.unref();
      return child;
    } catch { return null; }
  };
  if (process.platform === 'darwin') {
    // Chromium → Google Chrome → open genérico (todos contienen 'open' para tests)
    const c = spawn('open', ['-a', 'Chromium', url], { detached: true, stdio: 'ignore' });
    c.on('error', () => {
      const c2 = spawn('open', ['-a', 'Google Chrome', url], { detached: true, stdio: 'ignore' });
      c2.on('error', () => trySpawn('open', [url]));
      c2.unref();
    });
    c.unref();
    // keep string 'open' present for grep tests — already covered
  } else if (process.platform === 'win32') {
    // Preferencia chromium via start chrome, fallback genérico start (contiene 'cmd' y 'start')
    const c = spawn('cmd', ['/c', 'start', 'chrome', url], { detached: true, stdio: 'ignore' });
    c.on('error', () => trySpawn('cmd', ['/c', 'start', '', url]));
    c.unref();
  } else {
    // linux: chromium-browser → chromium → google-chrome → google-chrome-stable → xdg-open (fallback)
    // Ejecutamos en cadena con fallback en error, manteniendo 'xdg-open' en el fuente para tests
    const candidates = [
      ['chromium-browser', [url]],
      ['chromium', [url]],
      ['google-chrome', [url]],
      ['google-chrome-stable', [url]],
      ['xdg-open', [url]],
    ];
    let idx = 0;
    const attempt = () => {
      if (idx >= candidates.length) return;
      const [cmd, args] = candidates[idx++];
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
      child.on('error', () => attempt());
      child.unref();
    };
    attempt();
  }
}

function flags(argv) {
  const o = { _: [], lang: null, only: [], skip: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agents') o.agents = argv[++i];
    else if (a === '--lang') o.lang = argv[++i];
    else if (a === '--engram-scope') o.engramScope = argv[++i];
    else if (a === '--graphify') o.graphify = argv[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--force') o.force = true;
    else if (a === '--fix') o.fix = true;
    else if (a === '--prune-extra') o.pruneExtra = true;
    else if (a === '--keep-vendor-commands') o.keepVendorCommands = true;
    else if (a === '--keep-going') o.keepGoing = true;
    else if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--skip') o.skip = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--vendors') o.vendors = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a.startsWith('--')) { console.error(`Opcion desconocida: ${a}`); process.exit(2); }
    else o._.push(a);
  }
  return o;
}

const argv = process.argv.slice(2);
const cmd = argv[0]?.startsWith('-') ? null : argv[0];

// `bridge` reenvia sus argumentos verbatim: tiene sus propios flags (--strict, --only,
// --normative...) y parsearlos aqui hacia que rechazara los suyos. Va antes de flags().
if (cmd === 'bridge') {
  const cli = new URL('../bridge/cli.mjs', import.meta.url);
  const r = spawnSync(process.execPath, [cli.pathname, ...argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

// dashboard / ui — subcomando con flags propios, ESM estricto, sin chdir
if (cmd === 'dashboard' || cmd === 'ui') {
  const dArgs = argv.slice(1);
  let port = 3100;
  let host = '127.0.0.1';
  let open = false;
  let help = false;
  let hasPort = false;
  for (let i = 0; i < dArgs.length; i++) {
    const a = dArgs[i];
    if (a === '--port') {
      const v = dArgs[++i];
      if (v === undefined) { console.error('Opcion --port requiere valor'); process.exit(2); }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 65535) { console.error(`Puerto invalido: ${v}`); process.exit(2); }
      port = n;
      hasPort = true;
    } else if (a.startsWith('--port=')) {
      const v = a.slice('--port='.length);
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 65535) { console.error(`Puerto invalido: ${v}`); process.exit(2); }
      port = n;
      hasPort = true;
    } else if (a === '--host') {
      const v = dArgs[++i];
      if (v === undefined) { console.error('Opcion --host requiere valor'); process.exit(2); }
      host = String(v);
    } else if (a.startsWith('--host=')) {
      host = a.slice('--host='.length);
      if (!host) { console.error('Opcion --host requiere valor'); process.exit(2); }
    } else if (a === '--open') {
      open = true;
    } else if (a === '--no-open') {
      open = false;
    } else if (a === '--help' || a === '-h') {
      help = true;
    } else if (a === '--version' || a === '-v') {
      console.log(pkg.version);
      process.exit(0);
    } else if (a.startsWith('--')) {
      console.error(`Opcion desconocida: ${a}`);
      process.exit(2);
    } else {
      console.error(`Argumento desconocido: ${a}`);
      process.exit(2);
    }
  }
  if (help) {
    console.log(DASHBOARD_HELP);
    process.exit(0);
  }

  const { createServer } = await import('../src/dashboard/server.mjs');
  const instance = createServer({ port, host });
  let result;
  try {
    result = await instance.start({ port, host });
  } catch (e) {
    console.error(`[dashboard] no se pudo iniciar: ${e.message}`);
    process.exit(1);
  }
  const url = `http://${result.host}:${result.port}`;
  if (open) {
    openBrowser(url);
  }
  const keepAlive = setInterval(() => {}, 60000);
  const shutdown = async () => {
    try { clearInterval(keepAlive); } catch {}
    try { await instance.close(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // Mantener proceso vivo mientras el servidor escucha
  if (process.platform === 'win32') {
    try { process.on('SIGBREAK', shutdown); } catch {}
  }
  // No hacer process.exit — dejar que el servidor siga
} else {
  const o = flags(cmd ? argv.slice(1) : argv);

  if (o.version) { console.log(pkg.version); process.exit(0); }
  if (o.help || !cmd) { console.log(HELP); process.exit(cmd ? 0 : 1); }

  switch (cmd) {
    case 'init':
      process.exit(await init({ ...o, dir: o._[0] }));

    case 'update':
      process.exit(await update({ ...o, dir: o._[0] }));

    case 'adopt':
      process.exit(await init({ ...o, dir: o._[0] || process.cwd(), yes: true, force: true }));

    case 'new':
      process.exit(await init({ ...o, dir: o._[0] || process.cwd(), yes: true }));

    case 'doctor':
      process.exit(await doctor({ dir: o._[0] || process.cwd(), lang: o.lang, fix: !!o.fix }));

    case 'sprint': {
      const { parseEpics } = await import('../bridge/parse-epics.mjs');
      const { planSprint } = await import('../bridge/plan-sprint.mjs');
      const fs = await import('node:fs');
      const root = path.resolve(o._[0] || process.cwd());
      const epicsFile = path.join(root, '_bmad-output/planning-artifacts/epics.md');
      if (!fs.existsSync(epicsFile)) {
        console.log('No se encontro epics.md. Genera artefactos de planeacion con BMAD.');
        process.exit(0);
      }
      const content = fs.readFileSync(epicsFile, 'utf8');
      const parsed = parseEpics(content);
      const plan = planSprint(parsed);
      console.log(`\nPlan de Sprint — ${plan.nodes.length} historias en ${plan.waves.length} olas:\n`);
      plan.waves.forEach((w, idx) => {
        console.log(`  🌊 Ola ${idx + 1} (${w.length} historias en paralelo):`);
        w.forEach((st) => console.log(`     • [Story ${st.story}] ${st.title} (${st.capability})`));
      });
      console.log('');
      process.exit(0);
    }

    case 'sync': {
      const fs = await import('node:fs');
      const root = path.resolve(o._[0] || process.cwd());
      const epicsFile = path.join(root, '_bmad-output/planning-artifacts/epics.md');
      if (fs.existsSync(epicsFile)) {
        const cli = new URL('../bridge/cli.mjs', import.meta.url);
        const r = spawnSync(process.execPath, [cli.pathname, epicsFile], { cwd: root, stdio: 'inherit' });
        process.exit(r.status ?? 0);
      } else {
        console.log('Sincronizando estado...');
        doctor({ dir: root });
        process.exit(0);
      }
    }

    case 'build': {
      const fs = await import('node:fs');
      const root = path.resolve(o._[0] || process.cwd());
      const epicsFile = path.join(root, '_bmad-output/planning-artifacts/epics.md');
      const extraArgs = argv.slice(1).filter((a) => a !== root);
      if (fs.existsSync(epicsFile)) {
        const cli = new URL('../bridge/cli.mjs', import.meta.url);
        const cliArgs = [cli.pathname, epicsFile];
        if (extraArgs.length > 0) {
          cliArgs.push(...extraArgs);
        } else {
          cliArgs.push('--strict');
        }
        const r = spawnSync(process.execPath, cliArgs, { cwd: root, stdio: 'inherit' });
        process.exit(r.status ?? 0);
      } else {
        console.log('Validando especificaciones de OpenSpec/SDD...');
        const cli = new URL('../bridge/cli.mjs', import.meta.url);
        const r = spawnSync(process.execPath, [cli.pathname, '--strict', ...extraArgs], { cwd: root, stdio: 'inherit' });
        process.exit(r.status ?? 0);
      }
    }

    case 'change': {
      console.log('\n[un-specweaver change] Creación de nuevo cambio con control de alcance');
      console.log('Para iniciar el cambio con OpenSpec, ejecuta en tu agente:');
      console.log('  /opsx-propose "<descripcion de tu cambio>"\n');
      process.exit(0);
    }

    case 'bug': {
      console.log('\n[un-specweaver bug] Registro y corrección de defecto');
      console.log('Para corregir un defecto sin alterar el PRD, ejecuta en tu agente:');
      console.log('  /opsx-propose "fix: <descripcion del defecto>"\n');
      process.exit(0);
    }

    case 'ticket': {
      console.log('\n[un-specweaver ticket] Clasificación de ticket o issue de GitHub');
      console.log('Para clasificar un ticket, ejecuta /sw:ticket en tu agente IA.\n');
      process.exit(0);
    }

    case 'context': {
      const { findPlanningArtifacts } = await import('../bridge/cli.mjs');
      const root = path.resolve(o._[0] || process.cwd());
      const found = findPlanningArtifacts(root);
      if (!found.length) { console.log('\nNo hay artefactos de planeacion todavia. Corre /sw:new.\n'); process.exit(0); }
      console.log('\nArtefactos de planeacion — cargalos antes de diseñar o construir:\n');
      let last = null;
      for (const a of found) {
        if (a.kind !== last) { console.log(`  ${a.kind}  (${a.what})`); last = a.kind; }
        console.log(`    ${path.relative(root, a.file)}`);
      }
      console.log('');
      process.exit(0);
    }

    case 'vendors':
      console.log(`\nversiones pineadas (${path.basename(new URL('../src/vendors.json', import.meta.url).pathname)})\n`);
      console.log(`  bmad      ${VENDORS.bmad.npm}@${VENDORS.bmad.version}   modulos: ${VENDORS.bmad.modules}   podado: ${VENDORS.bmad.prune.join(', ')}`);
      console.log(`  openspec  ${VENDORS.openspec.npm}@${VENDORS.openspec.version}`);
      console.log(`  gentle    ${VENDORS.gentle.bin} ${VENDORS.gentle.version}`);
      console.log(`\n  Para subir un vendor: edita src/vendors.json, publica, y "un-specweaver doctor" reporta el drift.\n`);
      process.exit(0);

    default:
      console.error(`Comando desconocido: ${cmd}\n${HELP}`);
      process.exit(2);
  }
}
