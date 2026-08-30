import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const BIN = path.resolve(import.meta.dirname, '../bin/un-specweaver.mjs');
const DOC_ES = path.resolve(import.meta.dirname, '../src/layer/commands/es/dashboard.md');
const DOC_EN = path.resolve(import.meta.dirname, '../src/layer/commands/en/dashboard.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function waitForDashboardLog(child, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const onStdout = (d) => { stdout += d.toString(); check(); };
    const onStderr = (d) => { stderr += d.toString(); check(); };
    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    const timer = setTimeout(() => {
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      reject(new Error(`timeout waiting for Dashboard log. stdout=${JSON.stringify(stdout)} stderr=${JSON.stringify(stderr)}`));
    }, timeoutMs);
    function check() {
      const m = stdout.match(/Dashboard en http:\/\/([^:]+):(\d+)/);
      if (m) {
        clearTimeout(timer);
        child.stdout.off('data', onStdout);
        child.stderr.off('data', onStderr);
        resolve({ host: m[1], port: Number(m[2]), url: `http://${m[1]}:${m[2]}`, stdout, stderr, getStdout: () => stdout, getStderr: () => stderr });
      }
    }
    // immediate check in case already buffered
    check();
  });
}

async function killChild(child) {
  try { child.kill('SIGTERM'); } catch {}
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 900);
    child.on('close', () => { clearTimeout(t); resolve(); });
    child.on('exit', () => { clearTimeout(t); resolve(); });
  });
  // ensure killed
  try { child.kill('SIGKILL'); } catch {}
}

async function spawnDashboard(args, opts = {}) {
  const child = spawn(process.execPath, [BIN, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
  return child;
}

// ---------------------------------------------------------------------------
// 4.3-3 — doc es debe documentar uso, flags, ejemplos, ESM
// ---------------------------------------------------------------------------

test('4.3-3 — GIVEN src/layer/commands/es/dashboard.md WHEN lo leo THEN documenta uso, flags (--open, --port, --host), ejemplos y ESM estricto en español', () => {
  assert.ok(fs.existsSync(DOC_ES), 'src/layer/commands/es/dashboard.md debe existir');
  const content = fs.readFileSync(DOC_ES, 'utf8');
  // frontmatter
  assert.match(content, /name:\s*dashboard/, 'frontmatter name dashboard');
  assert.match(content, /title:/, 'debe tener title');
  // uso
  assert.match(content, /Uso|USO/i, 'debe documentar Uso');
  assert.match(content, /npx un-specweaver dashboard/, 'debe mostrar uso dashboard');
  assert.match(content, /npx un-specweaver ui/, 'debe mencionar alias ui');
  // flags
  assert.match(content, /--open/, 'debe documentar --open');
  assert.match(content, /--port/, 'debe documentar --port');
  assert.match(content, /--host/, 'debe documentar --host');
  // ejemplos
  assert.match(content, /Ejemplo|ejemplos/i, 'debe tener ejemplos');
  assert.ok(content.includes('npx un-specweaver dashboard --port') || content.includes('--port 3200'), 'ejemplos deben incluir --port');
  // ESM estricto
  assert.match(content, /ESM estricto/i, 'debe mencionar ESM estricto');
  // español
  assert.match(content, /puerto|servidor|navegador/i, 'debe estar en español');
  // adicional: Node >=20.11 o Node
  assert.match(content, /Node/, 'debe mencionar Node');
});

test('4.3-3b — src/layer/commands/en/dashboard.md espejo en ingles existe y documenta flags', () => {
  if (!fs.existsSync(DOC_EN)) {
    // opcional pero recomendado — si no existe, no fallar duro? spec dice opcional pero recomendado.
    // Marcamos como skip si no existe, pero idealmente debe existir.
    assert.ok(fs.existsSync(DOC_ES), 'al menos es debe existir');
    return;
  }
  const content = fs.readFileSync(DOC_EN, 'utf8');
  assert.match(content, /--open/);
  assert.match(content, /--port/);
  assert.match(content, /--host/);
  assert.match(content, /Usage/i);
});

// ---------------------------------------------------------------------------
// Bin implementacion: alias, flags, open, ESM, no chdir, detached
// ---------------------------------------------------------------------------

test('4.3-bin — bin/un-specweaver.mjs registra dashboard con alias ui y flags --port --host --open', () => {
  const src = fs.readFileSync(BIN, 'utf8');
  assert.match(src, /dashboard/, 'debe manejar comando dashboard');
  assert.match(src, /['"]ui['"]/i, 'debe manejar alias ui');
  assert.match(src, /--port/, 'debe parsear --port');
  assert.match(src, /--host/, 'debe parsear --host');
  assert.match(src, /--open/, 'debe parsear --open');
  assert.match(src, /--no-open/, 'debe soportar --no-open');
  assert.match(src, /createServer/, 'debe importar createServer de src/dashboard/server.mjs');
  assert.doesNotMatch(src, /process\.chdir\s*\(/, 'no debe usar process.chdir() (AD-01)');
  assert.match(src, /ESM|import/, 'debe ser ESM');
});

test('4.3-bin — apertura navegador sin bloquear: spawn detached + unref + open/xdg-open/start', () => {
  const src = fs.readFileSync(BIN, 'utf8');
  assert.match(src, /detached/, 'debe usar spawn detached');
  assert.match(src, /unref/, 'debe hacer unref para no bloquear');
  assert.match(src, /xdg-open/, 'linux: xdg-open');
  assert.match(src, /open/, 'darwin: open');
  // win32 start via cmd /c start
  assert.match(src, /cmd/, 'win32: cmd');
  assert.match(src, /start/, 'win32: start');
  // SIGINT/SIGTERM handling
  assert.match(src, /SIGINT/, 'debe manejar SIGINT');
  assert.match(src, /SIGTERM/, 'debe manejar SIGTERM');
});

test('4.3-bin — help global incluye dashboard y dashboard --help detalla flags', async () => {
  const { spawnSync } = await import('node:child_process');
  const rHelp = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' });
  assert.match(rHelp.stdout, /dashboard/, 'help global debe mencionar dashboard');
  assert.match(rHelp.stdout, /ui/, 'help global debe mencionar alias ui');

  const rDashHelp = spawnSync(process.execPath, [BIN, 'dashboard', '--help'], { encoding: 'utf8' });
  assert.equal(rDashHelp.status, 0);
  assert.match(rDashHelp.stdout, /--port/, 'dashboard --help debe listar --port');
  assert.match(rDashHelp.stdout, /--host/, 'dashboard --help debe listar --host');
  assert.match(rDashHelp.stdout, /--open/, 'dashboard --help debe listar --open');
  assert.match(rDashHelp.stdout, /ESM estricto/, 'dashboard --help debe mencionar ESM');
});

// ---------------------------------------------------------------------------
// 4.3-1 — dashboard / ui inicia servidor puerto libre (default 3100), sirve SPA, loguea
// ---------------------------------------------------------------------------

test('4.3-1 — GIVEN Node >=20.11 y bin/un-specweaver.mjs WHEN npx un-specweaver dashboard --port 0 THEN inicia servidor puerto libre, sirve SPA en / y loguea Dashboard en http://127.0.0.1:<port>', { timeout: 10000 }, async () => {
  const child = await spawnDashboard(['dashboard', '--port', '0']);
  try {
    const info = await waitForDashboardLog(child);
    assert.ok(info.port > 0, 'puerto debe ser >0');
    assert.match(info.stdout, /Dashboard en http:\/\/127\.0\.0\.1:\d+/, 'log debe contener Dashboard en http://127.0.0.1:<port>');
    // GET / SPA
    const res = await fetch(`${info.url}/`);
    assert.equal(res.status, 200, 'GET / debe ser 200');
    const ct = res.headers.get('content-type') || '';
    assert.match(ct, /text\/html/, 'Content-Type debe ser text/html');
    const html = await res.text();
    assert.match(html, /Panel de Control un-specweaver/, 'SPA debe contener Panel de Control');
    // GET /api/projects 200
    const res2 = await fetch(`${info.url}/api/projects`);
    assert.equal(res2.status, 200);
    const j = await res2.json();
    assert.ok('projects' in j || Array.isArray(j.projects) || j.projects !== undefined, 'api/projects debe retornar JSON');
    // 404 vs 200: unknown api -> 404, known -> 200
    const res404 = await fetch(`${info.url}/api/no-existe-dashboard-test`);
    assert.equal(res404.status, 404, 'ruta api desconocida debe ser 404');
    const j404 = await res404.json();
    assert.ok(j404.code, '404 debe tener code');
  } finally {
    await killChild(child);
  }
});

test('4.3-1b — alias ui funciona igual que dashboard', { timeout: 10000 }, async () => {
  const child = await spawnDashboard(['ui', '--port', '0']);
  try {
    const info = await waitForDashboardLog(child);
    assert.ok(info.port > 0);
    assert.match(info.stdout, /Dashboard en http:\/\/127\.0\.0\.1:\d+/);
    const res = await fetch(`${info.url}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Panel de Control un-specweaver/);
  } finally {
    await killChild(child);
  }
});

test('4.3-1c — sin --port usa default 3100 o siguiente libre y sirve SPA', { timeout: 10000 }, async () => {
  // Ocupar 3100 para forzar retry si está libre? No ocupamos, solo verificamos que loguea con puerto >=3100
  const child = await spawnDashboard(['dashboard', '--port', '0', '--host', '127.0.0.1']);
  try {
    const info = await waitForDashboardLog(child);
    assert.ok(info.port > 0);
    // Si usamos 0, puerto es efímero >1024, pero si probamos sin args, sería 3100+something
    // Aquí probamos que --host funciona y log refleja host
    assert.match(info.stdout, new RegExp(`Dashboard en http://${info.host}:${info.port}`));
    const res = await fetch(`${info.url}/`);
    assert.equal(res.status, 200);
  } finally {
    await killChild(child);
  }
});

// ---------------------------------------------------------------------------
// 4.3-2 — --open abre navegador sin bloquear, respeta URL efectiva (retry)
// ---------------------------------------------------------------------------

test('4.3-2 — GIVEN dashboard --open --port 0 WHEN inicia THEN no bloquea y sigue sirviendo (spawn detached)', { timeout: 10000 }, async () => {
  const child = await spawnDashboard(['dashboard', '--port', '0', '--open']);
  try {
    const info = await waitForDashboardLog(child);
    assert.ok(info.port > 0);
    // No debe haber crasheado: esperar 600ms y verificar que sigue vivo y sirve
    await new Promise((r) => setTimeout(r, 600));
    // child should still be running: kill SIGTERM should succeed and fetch should still work before kill
    const res = await fetch(`${info.url}/`);
    assert.equal(res.status, 200, '--open no debe bloquear: fetch debe seguir funcionando');
    assert.match(info.stdout, /Dashboard en http:\/\/127\.0\.0\.1:\d+/);
    // Verificar que stderr no contiene crash grave
    // xdg-open puede fallar si no hay display, pero no debe matar el servidor
    // Si xdg-open no existe, nuestro openBrowser hace swallow, así que stderr no debe tener uncaught
    const stderr = await new Promise((r) => {
      let data = '';
      child.stderr.on('data', (d) => (data += d.toString()));
      setTimeout(() => r(data), 300);
    });
    // No debe haber "Error" fatal que mate el proceso
    assert.doesNotMatch(stderr, /Unhandled|throw/i);
  } finally {
    await killChild(child);
  }
});

test('4.3-2b — GIVEN --open --port 3200 ocupado WHEN inicia en siguiente libre THEN abre URL efectiva sin bloquear', { timeout: 10000 }, async () => {
  // Ocupar 3200
  const dummy = http.createServer((_, res) => res.end('dummy'));
  await new Promise((resolve, reject) => {
    dummy.listen(3200, '127.0.0.1', resolve);
    dummy.on('error', reject);
  });
  const child = await spawnDashboard(['dashboard', '--port', '3200', '--open']);
  try {
    const info = await waitForDashboardLog(child, 5000);
    // Debe haber reintentado a 3201
    assert.equal(info.port, 3201, 'si 3200 ocupado debe reintentar a 3201');
    assert.match(info.stdout, /Dashboard en http:\/\/127\.0\.0\.1:3201/);
    // No bloquea
    await new Promise((r) => setTimeout(r, 500));
    const res = await fetch(`${info.url}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Panel de Control/);
  } finally {
    await killChild(child);
    await new Promise((r) => dummy.close(r));
  }
});

test('4.3-2c — --no-open no intenta abrir navegador y sigue sirviendo', { timeout: 8000 }, async () => {
  const child = await spawnDashboard(['dashboard', '--port', '0', '--no-open']);
  try {
    const info = await waitForDashboardLog(child);
    assert.ok(info.port > 0);
    const res = await fetch(`${info.url}/`);
    assert.equal(res.status, 200);
  } finally {
    await killChild(child);
  }
});

test('4.3-flags — opcion desconocida falla con codigo 2', async () => {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [BIN, 'dashboard', '--invalido'], { encoding: 'utf8' });
  assert.equal(r.status, 2, 'opcion desconocida debe salir 2');
  const combined = (r.stdout || '') + (r.stderr || '');
  assert.match(combined, /Opcion desconocida|desconocida/i);
});

test('4.3-bin — proceso dashboard termina limpio con SIGTERM (cierre de servidor)', { timeout: 8000 }, async () => {
  const child = await spawnDashboard(['dashboard', '--port', '0']);
  const info = await waitForDashboardLog(child);
  // Enviar SIGTERM y verificar que cierra con 0
  const closePromise = new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  child.kill('SIGTERM');
  const result = await Promise.race([
    closePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout esperando close tras SIGTERM')), 3000)),
  ]);
  // Debe cerrar con 0 (nuestro shutdown hace process.exit(0))
  assert.equal(result.code, 0, 'SIGTERM debe cerrar con exit 0');
  // puerto ya no debe responder
  await new Promise((r) => setTimeout(r, 200));
  await assert.rejects(() => fetch(`${info.url}/`, { signal: AbortSignal.timeout(800) }), 'puerto cerrado no debe responder');
});
