import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { VENDORS, preflight, detectAgents, detectGraphify, detectEngram, isGitRepo, writeState, readState, which } from './env.mjs';
import { buildPlan } from './steps.mjs';
import { runPlan } from './run.mjs';
import { t, LANGS } from './i18n.mjs';
import { resolvePrefs, promptPrefs, promptAgents, validateFlag, DEFAULTS } from './prefs.mjs';

export { resolvePrefs, promptPrefs } from './prefs.mjs';

function reportOptional(root, lang, prefs = DEFAULTS) {
  console.log(t(lang, 'doctor.optional'));
  const line = (key, ok, detail) =>
    console.log(`  ${t(lang, ok ? 'ok' : 'warn')}  ${t(lang, `${key}.name`).padEnd(14)} ${detail}`);

  const g = prefs.graphify === 'off' ? { available: false, where: null, graph: null, disabled: true } : detectGraphify(root);
  if (g.disabled) line('graphify', false, t(lang, 'graphify.disabled'));
  else line('graphify', g.available, g.available
    ? `${t(lang, 'graphify.present', g.where)} — ${g.graph ? t(lang, 'graphify.graph', g.graph) : t(lang, 'graphify.noGraph')}`
    : t(lang, 'graphify.absent'));

  const e = detectEngram(root);
  const wantGlobal = prefs.engramScope === 'global';
  line('engram', e.available && (!!e.project || wantGlobal), e.available
    ? `${t(lang, 'engram.present', e.bin)} — ${e.project ? t(lang, 'engram.scoped', e.project) : t(lang, wantGlobal ? 'engram.globalByChoice' : 'engram.shared')}`
    : t(lang, 'engram.absent'));

  return { graphify: g, engram: e };
}

export async function init(opts) {
  const root = path.resolve(opts.dir || process.cwd());
  fs.mkdirSync(root, { recursive: true });

  const prior = readState(root);
  const flags = { lang: opts.lang, engramScope: opts.engramScope, graphify: opts.graphify };
  for (const [k, v] of Object.entries(flags)) {
    const err = validateFlag(k, v);
    if (err) { console.error(err); return 2; }
  }
  const { prefs } = await resolvePrefs(
    { flags, stored: prior?.preferences || { lang: prior?.lang }, isTTY: process.stdin.isTTY },
    (keys) => promptPrefs(keys, flags.lang || prior?.preferences?.lang || DEFAULTS.lang),
  );
  const lang = prefs.lang;

  console.log(t(lang, 'init.header', root));

  const pf = preflight(lang);
  for (const c of pf.checks) console.log(`  ${t(lang, c.ok ? 'ok' : c.fatal ? 'fail' : 'warn')}  ${c.name.padEnd(22)} ${c.detail}`);
  if (!pf.ok) { console.error(t(lang, 'init.preflightFailed')); return 1; }
  if (!isGitRepo(root)) console.log(`  ${t(lang, 'warn')}  ${t(lang, 'check.git').padEnd(22)} ${t(lang, 'init.notGitRepo')}`);

  // Precedencia igual que las demas preferencias: flag > guardado > pregunta > detectado.
  // Re-detectar cada vez volvia a meter agentes que el usuario ya habia descartado.
  const flagAgents = opts.agents ? opts.agents.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const detected = detectAgents();
  let ids = flagAgents || prior?.preferences?.agents || null;
  let agentSource = flagAgents ? 'init.forced' : (ids ? 'prefs.agentsStored' : 'init.autodetected');

  if (!ids) {
    if (!detected.length) { console.error(t(lang, 'init.noAgents', Object.keys(VENDORS.agents).join(', '))); return 1; }
    ids = process.stdin.isTTY ? await promptAgents(detected, lang) : detected.map((a) => a.id);
    if (process.stdin.isTTY && detected.length > 1) agentSource = 'prefs.agentsStored';
  }

  const agents = ids.map((id) => {
    const cfg = VENDORS.agents[id];
    if (!cfg) { console.error(t(lang, 'init.unknownAgent', id, Object.keys(VENDORS.agents).join(', '))); process.exit(2); }
    return { ...cfg, id };
  });
  if (!agents.length) { console.error(t(lang, 'init.noAgents', Object.keys(VENDORS.agents).join(', '))); return 1; }
  prefs.agents = agents.map((a) => a.id);

  const agentLabel = agentSource === 'prefs.agentsStored'
    ? t(lang, 'prefs.agentsStored', agents.map((a) => a.id).join(', '))
    : `${agents.map((a) => a.id).join(', ')} ${t(lang, agentSource)}`;
  console.log(`\n  ${t(lang, 'init.agents').padEnd(9)}${agentLabel}`);
  console.log(`  ${t(lang, 'init.language').padEnd(9)}${lang} (${t(lang, 'lang.name')})`);

  const ctx = {
    root, agents, lang, prefs, platform: pf.platform, langName: t(lang, 'lang.name'),
    force: !!opts.force, pruneExtra: !!opts.pruneExtra, keepVendorCommands: !!opts.keepVendorCommands, yes: !!opts.yes,
    dryRun: !!opts.dryRun, keepGoing: !!opts.keepGoing,
  };
  const plan = buildPlan(ctx, { only: opts.only, skip: opts.skip });

  if (opts.dryRun) console.log(t(lang, 'init.dryRun'));
  const results = await runPlan(plan, ctx);

  const optional = opts.dryRun ? { graphify: detectGraphify(root), engram: detectEngram(root) } : reportOptional(root, lang, prefs);

  if (!opts.dryRun) {
    writeState(root, {
      version: 1,
      installedAt: new Date().toISOString(),
      lang,
      preferences: prefs,
      agents: agents.map((a) => a.id),
      // Se registra lo que quedo instalado de verdad, no lo que se pretendia instalar:
      // un estado optimista hace que doctor reporte "ok" sobre algo que no existe.
      vendors: {
        bmad: fs.existsSync(path.join(root, '_bmad')) ? `${VENDORS.bmad.npm}@${VENDORS.bmad.version}` : null,
        openspec: fs.existsSync(path.join(root, 'openspec')) ? `${VENDORS.openspec.npm}@${VENDORS.openspec.version}` : null,
        gentle: which(VENDORS.gentle.bin) ? VENDORS.gentle.version : null,
      },
      optional,
      pruned: [...VENDORS.bmad.prune, ...(opts.pruneExtra ? VENDORS.bmad.pruneOptional : [])],
      steps: results.map((r) => ({ id: r.id, ok: r.ok, error: r.error || null })),
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? t(lang, 'init.failed', failed.length, failed.map((r) => r.id).join(', ')) : t(lang, 'init.done'));
  if (!failed.length && !opts.dryRun) console.log(t(lang, 'init.next'));
  return failed.length ? 1 : 0;
}

export async function update(opts = {}) {
  const root = path.resolve(opts.dir || process.cwd());
  const prior = readState(root);
  const flags = { lang: opts.lang, engramScope: opts.engramScope, graphify: opts.graphify };
  for (const [k, v] of Object.entries(flags)) {
    if (v !== undefined) {
      const err = validateFlag(k, v);
      if (err) { console.error(err); return 2; }
    }
  }

  const lang = flags.lang || prior?.lang || prior?.preferences?.lang || DEFAULTS.lang;
  const flagAgents = opts.agents ? opts.agents.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const storedAgents = prior?.agents || prior?.preferences?.agents || null;
  const ids = flagAgents || storedAgents || detectAgents().map((a) => a.id);

  if (opts.vendors) {
    return init({ ...opts, dir: root, agents: ids.join(','), yes: true, force: true, lang });
  }

  const hasCustomOnly = Array.isArray(opts.only) ? opts.only.length > 0 : Boolean(opts.only && String(opts.only).trim().length > 0);
  const only = hasCustomOnly
    ? (Array.isArray(opts.only) ? opts.only : opts.only.split(',').map((s) => s.trim()))
    : ['gitignore', 'layer'];
  return init({
    ...opts,
    dir: root,
    agents: ids.join(','),
    lang,
    only,
    force: true,
  });
}

export async function doctor(opts) {
  const root = path.resolve(opts.dir || process.cwd());
  const state = readState(root);
  const prefs = { ...DEFAULTS, ...(state?.preferences || {}), ...(state?.lang ? { lang: state.lang } : {}) };
  const lang = opts.lang || prefs.lang;

  if (opts.fix) {
    console.log(`\n  ${t(lang, 'doctor.fixing')}\n`);
    await init({ ...opts, dir: root, yes: true, lang });
    console.log('');
  }

  console.log(t(lang, 'doctor.header', root));

  const pf = preflight(lang);
  for (const c of pf.checks) console.log(`  ${t(lang, c.ok ? 'ok' : c.fatal ? 'fail' : 'warn')}  ${c.name.padEnd(24)} ${c.detail}`);

  console.log(state ? t(lang, 'doctor.installed', state.installedAt, state.agents.join(', ')) : t(lang, 'doctor.noState'));

  const agents = state ? state.agents.map((id) => ({ ...VENDORS.agents[id], id })).filter((a) => a.skills) : detectAgents();
  const ctx = { root, agents, lang, prefs, platform: pf.platform, langName: t(lang, 'lang.name') };

  console.log(t(lang, 'doctor.steps'));
  let blockingPlan = 0, pendingOther = 0, drifted = false;
  for (const step of buildPlan(ctx)) {
    const isPending = step.status.state === 'pending';
    if (isPending) (step.blocks === 'plan' ? blockingPlan++ : pendingOther++);
    const mark = t(lang, step.status.state === 'ok' ? 'ok' : step.status.state === 'skip' ? 'skip' : 'missing');
    // Un paso pendiente sin decir QUE bloquea se lee como bloqueo total: es lo que hacia
    // que un agente se detuviera por gentle-config antes de siquiera planear.
    const why = isPending ? `  \u2014 ${t(lang, `blocks.${step.blocks}`)}` : '';
    console.log(`  ${mark}  ${step.id.padEnd(14)} ${step.status.detail}${why}`);
  }

  if (state) {
    console.log(t(lang, 'doctor.vendors'));
    const now = { bmad: `${VENDORS.bmad.npm}@${VENDORS.bmad.version}`, openspec: `${VENDORS.openspec.npm}@${VENDORS.openspec.version}`, gentle: VENDORS.gentle.version };
    const present = { bmad: fs.existsSync(path.join(root, '_bmad')), openspec: fs.existsSync(path.join(root, 'openspec')), gentle: !!which(VENDORS.gentle.bin) };
    for (const [k, v] of Object.entries(now)) {
      const had = state.vendors?.[k];
      if (present[k] && had !== v) drifted = true;
      const mark = !present[k] ? t(lang, 'missing') : had === v ? t(lang, 'ok') : t(lang, 'drift');
      const actual = !present[k] ? t(lang, 'doctor.notInstalled') : (had || t(lang, 'doctor.unknownVersion'));
      console.log(`  ${mark}  ${k.padEnd(14)} ${t(lang, 'doctor.vendorLine', actual, v)}`);
    }
  }

  reportOptional(root, lang, prefs);

  console.log(
    blockingPlan ? t(lang, 'doctor.pendingPlan', blockingPlan)
    : pendingOther ? t(lang, 'doctor.pendingBuildOnly', pendingOther)
    : t(lang, 'doctor.allGood'));
  return (drifted || blockingPlan > 0) ? 1 : 0;
}
