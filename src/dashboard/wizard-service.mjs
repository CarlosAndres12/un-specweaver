/**
 * Wizard Service — Generador determinístico de Brief, PRD con requisitos numerados y setup de proyectos.
 * Cumple con invariante AD-01 (cero process.chdir).
 * ESM estricto, 100% español técnico.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { registerProject } from './project-manager.mjs';

/**
 * Compila el contenido Markdown del Product Brief.
 * @param {object} briefData
 * @param {string} projectName
 * @returns {string}
 */
export function compilarProductBrief(briefData = {}, projectName = 'Nuevo Proyecto') {
  const fecha = new Date().toISOString().slice(0, 10);
  const problema = briefData.problem || 'Definición del problema u oportunidad pendiente.';
  const audiencia = briefData.audience || 'Usuarios finales y equipos de desarrollo.';
  const propuestaValor = briefData.valueProp || 'Solución eficiente y escalable.';
  const kpis = Array.isArray(briefData.kpis) && briefData.kpis.length > 0
    ? briefData.kpis.map((k) => `- **${k.metric || 'Métrica'}:** ${k.target || 'Objetivo'}`).join('\n')
    : '- **Tiempo de Adopción:** < 5 minutos\n- **Confiabilidad:** 100% pruebas de contrato pasando';
  const outOfScope = Array.isArray(briefData.outOfScope) && briefData.outOfScope.length > 0
    ? briefData.outOfScope.map((o) => `- ${o}`).join('\n')
    : '- Despliegues en producción no locales\n- Integraciones de terceros no documentadas';

  return `---
title: "Product Brief — ${projectName}"
status: approved
created: ${fecha}
updated: ${fecha}
project: ${projectName}
---

# Product Brief — ${projectName}

## 1. Declaración del Problema y Oportunidad
${problema}

## 2. Público Objetivo y Usuarios Clave
${audiencia}

## 3. Propuesta de Valor Central
${propuestaValor}

## 4. Métricas de Éxito Clave (KPIs)
${kpis}

## 5. Límites de Alcance (Out-of-Scope)
${outOfScope}
`;
}

/**
 * Compila el contenido Markdown del PRD con requisitos funcionales y no funcionales numerados.
 * @param {object} prdData
 * @param {string} projectName
 * @returns {string}
 */
export function compilarPRD(prdData = {}, projectName = 'Nuevo Proyecto') {
  const fecha = new Date().toISOString().slice(0, 10);
  const frs = Array.isArray(prdData.requirements?.fr) && prdData.requirements.fr.length > 0
    ? prdData.requirements.fr
    : [
        { id: 'FR-001', title: 'Inicialización de Arquitectura Base', desc: 'El sistema DEBE configurar el entorno y dependencias iniciales.', priority: 'Must' },
        { id: 'FR-002', title: 'Flujo Central de Operaciones', desc: 'El sistema DEBE ejecutar las tareas y contratos principales.', priority: 'Must' },
      ];

  const nfrs = Array.isArray(prdData.requirements?.nfr) && prdData.requirements.nfr.length > 0
    ? prdData.requirements.nfr
    : [
        { id: 'NFR-001', title: 'Rendimiento y Baja Latencia', desc: 'Las operaciones críticas DEBEN responder en <300ms.', priority: 'Must' },
        { id: 'NFR-002', title: 'Aislamiento y Seguridad', desc: 'Cada componente DEBE ejecutarse con aislamiento estricto.', priority: 'Must' },
      ];

  const estiloArch = prdData.architecture?.style || 'Clean Architecture / Modular';
  const stack = prdData.architecture?.stack || 'Node.js, ESM nativo, OpenSpec';

  let tablaFR = '| ID | Requisito Funcional | Descripción Normativa | Prioridad |\n|---|---|---|---|\n';
  frs.forEach((fr, idx) => {
    const id = fr.id || `FR-${String(idx + 1).padStart(3, '0')}`;
    const tit = fr.title || `Requisito ${idx + 1}`;
    const desc = fr.desc || fr.description || 'El sistema DEBE cumplir la especificación requerida.';
    const prio = fr.priority || 'Must';
    tablaFR += `| **${id}** | ${tit} | ${desc} | ${prio} |\n`;
  });

  let tablaNFR = '| ID | Requisito No Funcional | Criterio de Aceptación | Prioridad |\n|---|---|---|---|\n';
  nfrs.forEach((nfr, idx) => {
    const id = nfr.id || `NFR-${String(idx + 1).padStart(3, '0')}`;
    const tit = nfr.title || `Requisito No Funcional ${idx + 1}`;
    const desc = nfr.desc || nfr.description || 'Cumplimiento normativo de calidad y rendimiento.';
    const prio = nfr.priority || 'Must';
    tablaNFR += `| **${id}** | ${tit} | ${desc} | ${prio} |\n`;
  });

  return `---
title: "Documento de Requisitos de Producto (PRD) — ${projectName}"
status: draft
created: ${fecha}
updated: ${fecha}
project: ${projectName}
version: 0.1.0
document_output_language: Spanish
---

# PRD — ${projectName}

## 1. Resumen Ejecutivo
Documento normativo de especificación y requerimientos del proyecto **${projectName}**, estructurado bajo el método BMAD y preparado para ejecución determinística con OpenSpec.

## 2. Decisiones Arquitectónicas y Stack
- **Estilo Arquitectónico:** ${estiloArch}
- **Stack Tecnológico:** ${stack}
- **Invariante:** Aislamiento de procesos y trazabilidad 100% verificable.

## 3. Requisitos Funcionales Numerados
${tablaFR}

## 4. Requisitos No Funcionales Numerados
${tablaNFR}

## 5. Trazabilidad y Verificación
Cada requisito funcional (\`FR-XXX\`) será descompuesto en historias de usuario trazables en \`_bmad-output/planning-artifacts/epics.md\` y validado mediante especificaciones ejecutables Given/When/Then en \`openspec/specs/\`.
`;
}

/**
 * Ejecuta el proceso completo de creación atómica de proyecto mediante el wizard.
 * @param {object} payload
 * @returns {Promise<{ project: object, files: string[] }>}
 */
export async function crearProyectoWizard(payload = {}) {
  const rutaAbsoluta = payload.path ? path.resolve(payload.path) : null;
  if (!rutaAbsoluta) {
    const err = new Error('La ruta absoluta del proyecto es requerida');
    err.code = 'INVALID_PATH';
    err.statusCode = 400;
    throw err;
  }

  const nombreProyecto = payload.name?.trim() || path.basename(rutaAbsoluta);
  const lang = payload.lang || 'es';
  const engramScope = payload.architecture?.engramScope || 'project';
  const graphify = payload.architecture?.graphify || 'auto';

  // 1. Crear directorios base
  const bmadDir = path.join(rutaAbsoluta, '_bmad-output', 'planning-artifacts');
  const unSpecDir = path.join(rutaAbsoluta, '.un-specweaver');
  const specDir = path.join(rutaAbsoluta, '.spec');

  await fs.mkdir(bmadDir, { recursive: true });
  await fs.mkdir(unSpecDir, { recursive: true });
  await fs.mkdir(specDir, { recursive: true });

  // 2. Compilar y escribir Product Brief
  const briefContent = compilarProductBrief(payload.brief, nombreProyecto);
  const briefPath = path.join(bmadDir, 'product-brief.md');
  await fs.writeFile(briefPath, briefContent, 'utf8');

  // 3. Compilar y escribir PRD con requisitos numerados
  const prdContent = compilarPRD(payload, nombreProyecto);
  const prdPath = path.join(bmadDir, 'prd.md');
  await fs.writeFile(prdPath, prdContent, 'utf8');

  // 4. Escribir configuración .un-specweaver/config.json
  const configContent = JSON.stringify({
    version: '1.0.0',
    preferences: {
      lang,
      engramScope,
      graphify,
    },
  }, null, 2);
  const configPath = path.join(unSpecDir, 'config.json');
  await fs.writeFile(configPath, configContent, 'utf8');

  // 5. Registrar en el inventario global
  const project = await registerProject(rutaAbsoluta, nombreProyecto);

  return {
    project,
    files: [briefPath, prdPath, configPath],
  };
}

export default {
  compilarProductBrief,
  compilarPRD,
  crearProyectoWizard,
};
