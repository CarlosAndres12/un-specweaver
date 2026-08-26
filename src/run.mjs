import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { renderAction } from './steps.mjs';
import { t } from './i18n.mjs';

async function confirm(question, lang) {
  if (!process.stdin.isTTY) return false;          // sin TTY no se asume consentimiento
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${question} ${t(lang, 'run.yesNo')} `)).trim().toLowerCase();
  rl.close();
  return t(lang, 'run.yesChars').includes(a);
}

export async function runAction(a, ctx) {
  switch (a.kind) {
    case 'note':
      console.log(`     ${a.text}`);
      return { ok: true };

    case 'blocked': {
      console.error(`     ! ${a.title}`);
      console.error(`     ${a.why}`);
      console.error(`\n     ${a.fix}\n`);
      return { ok: false, error: t(ctx.lang, 'run.blocked') };
    }

    case 'write': {
      if (a.keepExisting && fs.existsSync(a.file)) { console.log(`     ${t(ctx.lang, 'run.kept', path.relative(ctx.root, a.file))}`); return { ok: true }; }
      fs.mkdirSync(path.dirname(a.file), { recursive: true });
      fs.writeFileSync(a.file, a.content, 'utf8');
      console.log(`     ${t(ctx.lang, 'run.wrote', path.relative(ctx.root, a.file))}`);
      return { ok: true };
    }

    case 'rm': {
      // Nunca borrar fuera de la raiz del proyecto, pase lo que pase con los flags.
      const target = path.resolve(a.target);
      const root = path.resolve(ctx.root);
      if (target === root || !target.startsWith(root + path.sep)) {
        return { ok: false, error: t(ctx.lang, 'run.refusedOutside', target) };
      }
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`     ${t(ctx.lang, 'run.removed', path.relative(root, target))}`);
      return { ok: true };
    }

    case 'shell': {
      if (!ctx.yes && !(await confirm(t(ctx.lang, 'run.remoteCode', a.script), ctx.lang))) {
        return { ok: false, error: t(ctx.lang, 'run.notAuthorized'), skipped: true };
      }
      const r = spawnSync('/bin/sh', ['-c', a.script], { cwd: ctx.root, stdio: 'inherit' });
      return r.status === 0 ? { ok: true } : { ok: false, error: t(ctx.lang, 'run.exitCode', r.status) };
    }

    case 'exec': {
      const r = spawnSync(a.cmd, a.args, { cwd: a.cwd || ctx.root, stdio: 'inherit', env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
      return r.status === 0 ? { ok: true } : { ok: false, error: t(ctx.lang, 'run.exitCode', r.status) };
    }

    default:
      return { ok: false, error: t(ctx.lang, 'run.unknownAction', a.kind) };
  }
}

export async function runPlan(plan, ctx) {
  const results = [];
  const failed = new Set();

  for (const step of plan) {
    // Un paso que fallo solo detiene a los que dependen de el. Antes cortaba todo:
    // un Codex desactualizado impedia instalar los comandos /sw:*, que no tienen
    // nada que ver con Codex.
    if (step.dependsOn && failed.has(step.dependsOn)) {
      console.log(`\n▸ ${step.title}  [${step.id}]`);
      console.error(`     ${t(ctx.lang, 'run.skippedDep', step.dependsOn)}`);
      results.push({ id: step.id, ok: false, error: t(ctx.lang, 'run.skippedDep', step.dependsOn) });
      failed.add(step.id);
      continue;
    }
    console.log(`\n▸ ${step.title}  [${step.id}]`);
    if (ctx.dryRun) {
      for (const a of step.actions) console.log(`     ${renderAction(a, ctx.root)}`);
      // Un dry-run que termina en "Listo" con un paso bloqueado se lee como exito.
      // Si el plan ya sabe que no puede correr, tiene que decirlo tambien en seco.
      const stop = step.actions.find((a) => a.kind === 'blocked');
      if (stop) console.error(`     ${stop.why}\n\n     ${stop.fix}\n`);
      results.push({ id: step.id, ok: !stop, dryRun: true, error: stop ? t(ctx.lang, 'run.blocked') : null });
      continue;
    }
    let ok = true, error = null;
    for (const a of step.actions) {
      const r = await runAction(a, ctx);
      if (r.ok) continue;
      console.error(`     ✗ ${r.error}`);
      // Una accion tolerante marca el paso como fallido pero deja correr las demas:
      // configurar un agente no deberia impedir configurar los otros.
      if (a.tolerateFailure) { ok = false; error = r.error; continue; }
      ok = false; error = r.error;
      if (!r.skipped) break;
    }
    results.push({ id: step.id, ok, error });
    if (!ok) { failed.add(step.id); console.error(t(ctx.lang, 'run.stepFailed', step.id)); }
  }
  return results;
}
