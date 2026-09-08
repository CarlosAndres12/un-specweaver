import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { compilarProductBrief, compilarPRD, crearProyectoWizard } from '../src/dashboard/wizard-service.mjs';
import { start as startServer } from '../src/dashboard/server.mjs';

test('E5S1 & E5S2 — compilarProductBrief y compilarPRD con requisitos numerados', () => {
  const brief = compilarProductBrief({
    problem: 'Falta de plataforma unificada de desarrollo.',
    audience: 'Desarrolladores y arquitectos de software.',
    valueProp: 'Unión determinística de BMad y OpenSpec.',
    kpis: [{ metric: 'Tiempo de adopción', target: '< 3 minutos' }],
    outOfScope: ['Soporte legado no POSIX'],
  }, 'Mi Proyecto Demo');

  assert.match(brief, /# Product Brief — Mi Proyecto Demo/);
  assert.match(brief, /Falta de plataforma unificada de desarrollo/);
  assert.match(brief, /Desarrolladores y arquitectos de software/);
  assert.match(brief, /Tiempo de adopción/);

  const prd = compilarPRD({
    requirements: {
      fr: [
        { id: 'FR-001', title: 'Login Seguro', desc: 'El sistema DEBE autenticar usuarios.', priority: 'Must' },
        { id: 'FR-002', title: 'Dashboard Central', desc: 'El sistema DEBE presentar métricas.', priority: 'Should' },
      ],
      nfr: [
        { id: 'NFR-001', title: 'Latencia p95', desc: 'Respuestas en <200ms.', priority: 'Must' },
      ],
    },
    architecture: {
      style: 'Clean Architecture',
      stack: 'Node.js, ESM',
    },
  }, 'Mi Proyecto Demo');

  assert.match(prd, /# PRD — Mi Proyecto Demo/);
  assert.match(prd, /\|\s*\*\*FR-001\*\*\s*\|\s*Login Seguro\s*\|\s*El sistema DEBE autenticar usuarios\.\s*\|\s*Must\s*\|/);
  assert.match(prd, /\|\s*\*\*FR-002\*\*\s*\|\s*Dashboard Central\s*\|\s*El sistema DEBE presentar métricas\.\s*\|\s*Should\s*\|/);
  assert.match(prd, /\|\s*\*\*NFR-001\*\*\s*\|\s*Latencia p95\s*\|\s*Respuestas en <200ms\.\s*\|\s*Must\s*\|/);
});

test('E5S3 — crearProyectoWizard y endpoint POST /api/projects/wizard', async () => {
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'un-specweaver-wiz-'));
  const projectPath = path.join(tmpBase, 'mi-app-nueva');

  const { server, port, close } = await startServer({ port: 0, host: '127.0.0.1' });

  try {
    const payload = {
      name: 'Mi App Nueva',
      path: projectPath,
      lang: 'es',
      brief: {
        problem: 'Gestión compleja de requerimientos',
        audience: 'Equipos ágiles',
        valueProp: 'Automatización asistida por IA',
      },
      requirements: {
        fr: [
          { id: 'FR-001', title: 'Generación de Specs', desc: 'El sistema DEBE compilar specs.', priority: 'Must' },
        ],
        nfr: [
          { id: 'NFR-001', title: 'Trazabilidad 100%', desc: 'Trazabilidad sin huecos.', priority: 'Must' },
        ],
      },
      architecture: {
        style: 'Event-Driven',
        stack: 'Node.js, ESM, OpenSpec',
        engramScope: 'project',
        graphify: 'auto',
      },
    };

    const res = await fetch(`http://127.0.0.1:${port}/api/projects/wizard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.project);
    assert.equal(data.project.name, 'Mi App Nueva');

    // Verificar archivos creados en disco
    const briefContent = await fs.readFile(path.join(projectPath, '_bmad-output', 'planning-artifacts', 'product-brief.md'), 'utf8');
    assert.match(briefContent, /Product Brief — Mi App Nueva/);

    const prdContent = await fs.readFile(path.join(projectPath, '_bmad-output', 'planning-artifacts', 'prd.md'), 'utf8');
    assert.match(prdContent, /FR-001/);
    assert.match(prdContent, /NFR-001/);

    const configContent = await fs.readFile(path.join(projectPath, '.un-specweaver', 'config.json'), 'utf8');
    const config = JSON.parse(configContent);
    assert.equal(config.preferences.lang, 'es');
    assert.equal(config.preferences.engramScope, 'project');

  } finally {
    if (close) await close();
    else server.close();
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => {});
  }
});
