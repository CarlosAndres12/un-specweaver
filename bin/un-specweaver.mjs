#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { init, doctor } from '../src/init.mjs';
import { VENDORS } from '../src/env.mjs';

const pkg = createRequire(import.meta.url)('../package.json');

const HELP = `
un-specweaver ${pkg.version} — flujo de desarrollo dirigido por especificacion
  BMAD (planeacion) -> puente deterministico -> OpenSpec/SDD (ejecucion)

USO
  npx un-specweaver init [dir]        prepara el entorno completo en un proyecto
  npx un-specweaver doctor [dir]      revisa salud, pasos pendientes y drift de vendors
  npx un-specweaver bridge <epics.md> convierte stories de BMAD en changes de OpenSpec
  npx un-specweaver context        lista los artefactos de planeacion a cargar
  npx un-specweaver vendors           muestra las versiones pineadas

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
`;

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
    else if (a === '--prune-extra') o.pruneExtra = true;
    else if (a === '--keep-vendor-commands') o.keepVendorCommands = true;
    else if (a === '--keep-going') o.keepGoing = true;
    else if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--skip') o.skip = argv[++i].split(',').map((s) => s.trim());
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

const o = flags(cmd ? argv.slice(1) : argv);

if (o.version) { console.log(pkg.version); process.exit(0); }
if (o.help || !cmd) { console.log(HELP); process.exit(cmd ? 0 : 1); }

switch (cmd) {
  case 'init':
    process.exit(await init({ ...o, dir: o._[0] }));

  case 'doctor':
    process.exit(doctor({ dir: o._[0], lang: o.lang }));

  case 'context': {
    // Los artefactos de planeacion viven en rutas fechadas y configurables. Que el agente
    // los adivine es como se pierden entre fases: aqui se listan.
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
