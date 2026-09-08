/**
 * Diagramas de Ingeniería de Software y BMad — Renderizadores SVG Nativos
 *
 * Soporta Tema Claro y Tema Oscuro de manera consistente.
 * Incluye diagramas Globales y por Elemento para cada una de las 9 secciones:
 * 1. 📊 Tablero & Diagramas (Flujo E2E, Grafo Olas, Secuencia Eco, Ciclo Vida, Por Épica)
 * 2. 🩺 Doctor & Salud (Pipeline Global de Diagnóstico + Detalle por Chequeo)
 * 3. 🌊 Sprint & Olas (Grafo Global DAG + Detalle por Ola / Historia)
 * 4. 🔄 Puente OpenSpec (Pipeline Global de Compilación + Detalle por Artefacto)
 * 5. 🔨 Construcción (Flujo Global de Verificación SDD + Detalle por Contrato)
 * 6. ✨ Cambios (Ciclo de Vida Global OpenSpec + Detalle por Requerimiento)
 * 7. 🐛 Defectos / Bugs (Bucle Global de Auto-Resolución + Detalle por Defecto)
 * 8. 🎫 Tickets (Matriz Global de Triage + Detalle por Tipo de Issue)
 * 9. 📦 Adopción (Motor Global de Onboarding + Detalle por Etapa)
 */

/**
 * Obtiene los tokens de color según el tema activo.
 * @param {string} [tema='claro'] 'claro' | 'oscuro'
 * @returns {object} Tokens de color para SVG
 */
export function getThemeTokens(tema = 'claro') {
  const isDark = tema === 'oscuro';
  return {
    isDark,
    bg: isDark ? '#090d16' : '#ffffff',
    cardBg: isDark ? '#0f172a' : '#f8fafc',
    cardInner: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '#334155' : '#e2e8f0',
    borderStrong: isDark ? '#475569' : '#cbd5e1',
    textMain: isDark ? '#f8fafc' : '#0f172a',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    textFaint: isDark ? '#64748b' : '#94a3b8',
    cyan: isDark ? '#38bdf8' : '#0284c7',
    cyanBg: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
    green: isDark ? '#34d399' : '#059669',
    greenBg: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(5, 150, 105, 0.1)',
    purple: isDark ? '#818cf8' : '#6366f1',
    purpleBg: isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(99, 102, 241, 0.1)',
    amber: isDark ? '#fbbf24' : '#d97706',
    amberBg: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(217, 119, 6, 0.1)',
    rose: isDark ? '#f43f5e' : '#e11d48',
    roseBg: isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(225, 29, 72, 0.1)',
  };
}

// ===========================================================================
// 1. 📊 TABLERO & DIAGRAMAS GLOBALES Y POR ÉPICA
// ===========================================================================

export function renderFlujoDatosSvg(tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 440" xmlns="http://www.w3.org/2000/svg" aria-label="Diagrama de Flujo de Datos E2E">
  <defs>
    <marker id="arrow-cyan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="${t.cyan}" />
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="${t.green}" />
    </marker>
    <marker id="arrow-purple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="${t.purple}" />
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  
  <!-- Filesystem -->
  <g transform="translate(20, 25)">
    <rect width="200" height="390" rx="8" fill="${t.cardBg}" stroke="${t.border}" stroke-width="1.5" />
    <text x="100" y="30" text-anchor="middle" fill="${t.textMuted}" font-size="12" font-weight="700" letter-spacing="1">FILESYSTEM</text>
    <text x="100" y="46" text-anchor="middle" fill="${t.textFaint}" font-size="10">Fuente de verdad</text>
    
    <g transform="translate(15, 65)">
      <rect width="170" height="55" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
      <text x="85" y="24" text-anchor="middle" fill="${t.textMain}" font-size="11" font-weight="600">epics.md / prd.md</text>
      <text x="85" y="42" text-anchor="middle" fill="${t.cyan}" font-size="9">_bmad-output/</text>
    </g>

    <g transform="translate(15, 135)">
      <rect width="170" height="55" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
      <text x="85" y="24" text-anchor="middle" fill="${t.textMain}" font-size="11" font-weight="600">changes/ & specs/</text>
      <text x="85" y="42" text-anchor="middle" fill="${t.green}" font-size="9">.spec/ (OpenSpec)</text>
    </g>

    <g transform="translate(15, 205)">
      <rect width="170" height="55" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
      <text x="85" y="24" text-anchor="middle" fill="${t.textMain}" font-size="11" font-weight="600">projects.json</text>
      <text x="85" y="42" text-anchor="middle" fill="${t.amber}" font-size="9">~/.un-specweaver/ (Atómico)</text>
    </g>
  </g>

  <!-- Watcher & Server -->
  <g transform="translate(260, 25)">
    <rect width="250" height="390" rx="8" fill="${t.cardBg}" stroke="${t.border}" stroke-width="1.5" />
    <text x="125" y="30" text-anchor="middle" fill="${t.cyan}" font-size="12" font-weight="700" letter-spacing="1">SERVIDOR REACTIVO</text>
    <text x="125" y="46" text-anchor="middle" fill="${t.textFaint}" font-size="10">Node.js ESM (Sin chdir)</text>

    <g transform="translate(15, 65)">
      <rect width="220" height="70" rx="6" fill="${t.cardInner}" stroke="${t.cyan}" stroke-width="1" />
      <text x="110" y="24" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">Watcher & Eco-Supresión</text>
      <text x="110" y="42" text-anchor="middle" fill="${t.textMain}" font-size="10">Debounce: 150ms</text>
      <text x="110" y="58" text-anchor="middle" fill="${t.textMuted}" font-size="9">Ventana eco: 500ms (hash match)</text>
    </g>

    <g transform="translate(15, 150)">
      <rect width="220" height="70" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
      <text x="110" y="24" text-anchor="middle" fill="${t.textMain}" font-size="11" font-weight="700">Adaptador de Estado</text>
      <text x="110" y="42" text-anchor="middle" fill="${t.textMuted}" font-size="10">Agregación en memoria</text>
      <text x="110" y="58" text-anchor="middle" fill="${t.green}" font-size="9">epics + sprint + git + doctor</text>
    </g>

    <g transform="translate(15, 235)">
      <rect width="220" height="70" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
      <text x="110" y="24" text-anchor="middle" fill="${t.textMain}" font-size="11" font-weight="700">Compilador Archify</text>
      <text x="110" y="42" text-anchor="middle" fill="${t.textMuted}" font-size="10">Bridge nativo en memoria</text>
      <text x="110" y="58" text-anchor="middle" fill="${t.purple}" font-size="9">HTML / SVG Sandbox</text>
    </g>
  </g>

  <!-- SPA Client -->
  <g transform="translate(550, 25)">
    <rect width="350" height="390" rx="8" fill="${t.cardBg}" stroke="${t.border}" stroke-width="1.5" />
    <text x="175" y="30" text-anchor="middle" fill="${t.green}" font-size="12" font-weight="700" letter-spacing="1">PANEL SPA VANILLA</text>
    <text x="175" y="46" text-anchor="middle" fill="${t.textFaint}" font-size="10">100% Español Técnico & Live SSE</text>

    <g transform="translate(15, 65)">
      <rect width="320" height="60" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
      <text x="160" y="24" text-anchor="middle" fill="${t.textMain}" font-size="11" font-weight="700">Quick Switcher (Cmd+P / Ctrl+P)</text>
      <text x="160" y="44" text-anchor="middle" fill="${t.cyan}" font-size="10">Conmutación de proyecto &lt;100ms</text>
    </g>

    <g transform="translate(15, 140)">
      <rect width="320" height="60" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
      <text x="160" y="24" text-anchor="middle" fill="${t.textMain}" font-size="11" font-weight="700">Páginas Dedicadas & Diagramas</text>
      <text x="160" y="44" text-anchor="middle" fill="${t.green}" font-size="10">Doctor, Sprint, Sync, Build, Change, Bug</text>
    </g>

    <g transform="translate(15, 215)">
      <rect width="320" height="60" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
      <text x="160" y="24" text-anchor="middle" fill="${t.textMain}" font-size="11" font-weight="700">Pi Shell Contextual</text>
      <text x="160" y="44" text-anchor="middle" fill="${t.purple}" font-size="10">Streaming SSE de stdout/stderr en vivo</text>
    </g>
  </g>

  <!-- Flechas Conectoras -->
  <line x1="220" y1="100" x2="260" y2="100" stroke="${t.cyan}" stroke-width="2" marker-end="url(#arrow-cyan)" />
  <line x1="510" y1="100" x2="550" y2="100" stroke="${t.cyan}" stroke-width="2" marker-end="url(#arrow-cyan)" />
  <line x1="510" y1="180" x2="550" y2="180" stroke="${t.green}" stroke-width="2" marker-end="url(#arrow-green)" />
  <line x1="510" y1="260" x2="550" y2="260" stroke="${t.purple}" stroke-width="2" marker-end="url(#arrow-purple)" />
</svg>`;
}

export function renderSecuenciaEcoSvg(tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 400" xmlns="http://www.w3.org/2000/svg" aria-label="Diagrama de Secuencia y Supresión de Eco">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  
  <!-- Columnas Actores -->
  <g transform="translate(60, 30)">
    <rect width="120" height="35" rx="6" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="60" y="22" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">Cliente SPA</text>
    <line x1="60" y1="35" x2="60" y2="350" stroke="${t.borderStrong}" stroke-dasharray="4 4" />
  </g>

  <g transform="translate(340, 30)">
    <rect width="140" height="35" rx="6" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="70" y="22" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">Servidor Dashboard</text>
    <line x1="70" y1="35" x2="70" y2="350" stroke="${t.borderStrong}" stroke-dasharray="4 4" />
  </g>

  <g transform="translate(640, 30)">
    <rect width="140" height="35" rx="6" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="70" y="22" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">Watcher & FS</text>
    <line x1="70" y1="35" x2="70" y2="350" stroke="${t.borderStrong}" stroke-dasharray="4 4" />
  </g>

  <!-- Paso 1: Mutación Web -->
  <g transform="translate(0, 90)">
    <line x1="120" y1="0" x2="410" y2="0" stroke="${t.cyan}" stroke-width="2" />
    <polygon points="405,-4 415,0 405,4" fill="${t.cyan}" />
    <text x="260" y="-8" text-anchor="middle" fill="${t.cyan}" font-size="10" font-weight="600">1. PUT /api/projects/:id/commands (o epics)</text>
  </g>

  <!-- Paso 2: Registro recentWrites -->
  <g transform="translate(0, 130)">
    <rect x="360" y="0" width="220" height="32" rx="4" fill="${t.amberBg}" stroke="${t.amber}" />
    <text x="470" y="20" text-anchor="middle" fill="${t.amber}" font-size="9" font-weight="700">2. recentWrites.set(path, hash, now)</text>
  </g>

  <!-- Paso 3: Escritura atómica a disco -->
  <g transform="translate(0, 180)">
    <line x1="410" y1="0" x2="710" y2="0" stroke="${t.purple}" stroke-width="2" />
    <polygon points="705,-4 715,0 705,4" fill="${t.purple}" />
    <text x="560" y="-8" text-anchor="middle" fill="${t.purple}" font-size="10">3. fs.writeFile atomic (tmp + rename)</text>
  </g>

  <!-- Paso 4: Watcher detecta cambio -->
  <g transform="translate(0, 230)">
    <line x1="710" y1="0" x2="410" y2="0" stroke="${t.green}" stroke-width="2" />
    <polygon points="415,-4 405,0 415,4" fill="${t.green}" />
    <text x="560" y="-8" text-anchor="middle" fill="${t.green}" font-size="10">4. Evento FS (Debounce 150ms)</text>
  </g>

  <!-- Paso 5: Supresión de Eco -->
  <g transform="translate(0, 280)">
    <rect x="290" y="0" width="280" height="34" rx="4" fill="${t.greenBg}" stroke="${t.green}" />
    <text x="430" y="21" text-anchor="middle" fill="${t.green}" font-size="10" font-weight="700">5. ¿diff &lt; 500ms y hash coincide? ➔ SUPRIMIR SSE</text>
  </g>
</svg>`;
}

export function renderGrafoOlasSvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 400" xmlns="http://www.w3.org/2000/svg" aria-label="Grafo de Olas BMad">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />

  <text x="460" y="30" text-anchor="middle" fill="${t.cyan}" font-size="13" font-weight="700">GRAFO DE OLAS DETERMINÍSTICAS (BMAD ➔ OPENSPEC)</text>

  <!-- Ola 1 -->
  <g transform="translate(40, 60)">
    <rect width="180" height="310" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="90" y="25" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">OLA 1: Fundación</text>
    
    <g transform="translate(10, 45)">
      <rect width="160" height="50" rx="6" fill="${t.cardInner}" stroke="${t.green}" />
      <text x="80" y="22" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="600">Story 1.1: CWD & Aislamiento</text>
      <text x="80" y="38" text-anchor="middle" fill="${t.green}" font-size="8">Completada (AD-01)</text>
    </g>
    <g transform="translate(10, 110)">
      <rect width="160" height="50" rx="6" fill="${t.cardInner}" stroke="${t.green}" />
      <text x="80" y="22" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="600">Story 1.2: Projects Registry</text>
      <text x="80" y="38" text-anchor="middle" fill="${t.green}" font-size="8">Completada (AD-02)</text>
    </g>
  </g>

  <!-- Ola 2 -->
  <g transform="translate(260, 60)">
    <rect width="180" height="310" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="90" y="25" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">OLA 2: Reactividad</text>

    <g transform="translate(10, 45)">
      <rect width="160" height="50" rx="6" fill="${t.cardInner}" stroke="${t.green}" />
      <text x="80" y="22" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="600">Story 2.1: Servidor SSE</text>
      <text x="80" y="38" text-anchor="middle" fill="${t.green}" font-size="8">Completada (AD-06)</text>
    </g>
    <g transform="translate(10, 110)">
      <rect width="160" height="50" rx="6" fill="${t.cardInner}" stroke="${t.green}" />
      <text x="80" y="22" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="600">Story 2.2: Supresión Eco</text>
      <text x="80" y="38" text-anchor="middle" fill="${t.green}" font-size="8">Completada (AD-05)</text>
    </g>
  </g>

  <!-- Ola 3 -->
  <g transform="translate(480, 60)">
    <rect width="180" height="310" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="90" y="25" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">OLA 3: Archify Visor</text>

    <g transform="translate(10, 45)">
      <rect width="160" height="50" rx="6" fill="${t.cardInner}" stroke="${t.green}" />
      <text x="80" y="22" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="600">Story 3.1: Compilador</text>
      <text x="80" y="38" text-anchor="middle" fill="${t.green}" font-size="8">Completada (AD-07)</text>
    </g>
    <g transform="translate(10, 110)">
      <rect width="160" height="50" rx="6" fill="${t.cardInner}" stroke="${t.green}" />
      <text x="80" y="22" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="600">Story 3.2: Visor Sandbox</text>
      <text x="80" y="38" text-anchor="middle" fill="${t.green}" font-size="8">Completada (AD-07)</text>
    </g>
  </g>

  <!-- Ola 4 -->
  <g transform="translate(700, 60)">
    <rect width="180" height="310" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="90" y="25" text-anchor="middle" fill="${t.amber}" font-size="11" font-weight="700">OLA 4: Workbench SPA</text>

    <g transform="translate(10, 45)">
      <rect width="160" height="50" rx="6" fill="${t.cardInner}" stroke="${t.cyan}" />
      <text x="80" y="22" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="600">Story 4.1: SPA Dedicada</text>
      <text x="80" y="38" text-anchor="middle" fill="${t.cyan}" font-size="8">En Progreso (AD-10)</text>
    </g>
    <g transform="translate(10, 110)">
      <rect width="160" height="50" rx="6" fill="${t.cardInner}" stroke="${t.cyan}" />
      <text x="80" y="22" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="600">Story 4.2: Tests & CLI</text>
      <text x="80" y="38" text-anchor="middle" fill="${t.cyan}" font-size="8">En Progreso (255 Pass)</text>
    </g>
  </g>
</svg>`;
}

export function renderCicloVidaArchifySvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 380" xmlns="http://www.w3.org/2000/svg" aria-label="Ciclo de Vida Archify">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="30" text-anchor="middle" fill="${t.purple}" font-size="13" font-weight="700">CICLO DE VIDA Y SANDBOX VISUAL ARCHIFY</text>

  <g transform="translate(80, 80)">
    <circle cx="50" cy="50" r="45" fill="${t.cyanBg}" stroke="${t.cyan}" stroke-width="2" />
    <text x="50" y="48" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="700">1. Estado</text>
    <text x="50" y="62" text-anchor="middle" fill="${t.cyan}" font-size="8">epics / sprint</text>
  </g>

  <g transform="translate(290, 80)">
    <circle cx="50" cy="50" r="45" fill="${t.purpleBg}" stroke="${t.purple}" stroke-width="2" />
    <text x="50" y="48" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="700">2. Compilar</text>
    <text x="50" y="62" text-anchor="middle" fill="${t.purple}" font-size="8">Workflow / SVG</text>
  </g>

  <g transform="translate(500, 80)">
    <circle cx="50" cy="50" r="45" fill="${t.greenBg}" stroke="${t.green}" stroke-width="2" />
    <text x="50" y="48" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="700">3. Diff</text>
    <text x="50" y="62" text-anchor="middle" fill="${t.green}" font-size="8">Sin parpadeo</text>
  </g>

  <g transform="translate(710, 80)">
    <circle cx="50" cy="50" r="45" fill="${t.amberBg}" stroke="${t.amber}" stroke-width="2" />
    <text x="50" y="48" text-anchor="middle" fill="${t.textMain}" font-size="10" font-weight="700">4. Render</text>
    <text x="50" y="62" text-anchor="middle" fill="${t.amber}" font-size="8">contain: content</text>
  </g>
</svg>`;
}

export function renderDiagramaEpicaSvg(epicId, state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 400" xmlns="http://www.w3.org/2000/svg" aria-label="Diagrama de Épica">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="30" text-anchor="middle" fill="${t.cyan}" font-size="13" font-weight="700">ARQUITECTURA DE ÉPICA ${epicId}</text>
  
  <g transform="translate(60, 70)">
    <rect width="380" height="280" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="190" y="30" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">Criterios Given / When / Then</text>
    <text x="30" y="70" fill="${t.textMain}" font-size="10">• Given proyecto registrado con path canónico</text>
    <text x="30" y="100" fill="${t.textMain}" font-size="10">• When se ejecutan comandos vía dashboard</text>
    <text x="30" y="130" fill="${t.textMain}" font-size="10">• Then CWD queda estrictamente aislado</text>
    <text x="30" y="160" fill="${t.green}" font-size="10">✓ Invariante AD-01: Cero process chdir</text>
  </g>

  <g transform="translate(480, 70)">
    <rect width="380" height="280" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="190" y="30" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">Flujo de Ejecución y Trazabilidad</text>
    <rect x="40" y="60" width="300" height="40" rx="4" fill="${t.cardInner}" stroke="${t.border}" />
    <text x="190" y="85" text-anchor="middle" fill="${t.textMain}" font-size="10">1. Invocación de API de Comandos</text>
    <rect x="40" y="120" width="300" height="40" rx="4" fill="${t.cardInner}" stroke="${t.border}" />
    <text x="190" y="145" text-anchor="middle" fill="${t.textMain}" font-size="10">2. Streaming SSE de stdout / stderr</text>
    <rect x="40" y="180" width="300" height="40" rx="4" fill="${t.cardInner}" stroke="${t.green}" />
    <text x="190" y="205" text-anchor="middle" fill="${t.green}" font-size="10">3. Actualización de Métricas de Salud</text>
  </g>
</svg>`;
}

// ===========================================================================
// 2. 🩺 DOCTOR & SALUD (Global + Elemento)
// ===========================================================================

export function renderDoctorGlobalSvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 340" xmlns="http://www.w3.org/2000/svg" aria-label="Pipeline Global de Salud y Diagnóstico">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="28" text-anchor="middle" fill="${t.cyan}" font-size="13" font-weight="700">PIPELINE GLOBAL DE SALUD Y REPARACIÓN AUTÓNOMA</text>

  <g transform="translate(40, 60)">
    <rect width="150" height="240" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="75" y="26" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">1. Entorno</text>
    <text x="75" y="60" text-anchor="middle" fill="${t.textMain}" font-size="10">Node.js >= 20.11</text>
    <text x="75" y="90" text-anchor="middle" fill="${t.textMain}" font-size="10">npx / curl / git</text>
    <text x="75" y="120" text-anchor="middle" fill="${t.textMain}" font-size="10">Linux POSIX</text>
    <text x="75" y="200" text-anchor="middle" fill="${t.green}" font-size="10" font-weight="700">✓ Preflight OK</text>
  </g>

  <g transform="translate(230, 60)">
    <rect width="190" height="240" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="95" y="26" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">2. Vendors Pineados</text>
    <text x="95" y="60" text-anchor="middle" fill="${t.textMain}" font-size="10">BMAD v6.11 (Podado)</text>
    <text x="95" y="90" text-anchor="middle" fill="${t.textMain}" font-size="10">OpenSpec v1.10</text>
    <text x="95" y="120" text-anchor="middle" fill="${t.textMain}" font-size="10">Gentle-AI v2.4</text>
    <text x="95" y="200" text-anchor="middle" fill="${t.green}" font-size="10" font-weight="700">✓ Vendors OK</text>
  </g>

  <g transform="translate(460, 60)">
    <rect width="190" height="240" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="95" y="26" text-anchor="middle" fill="${t.amber}" font-size="11" font-weight="700">3. Aislamiento MCP</text>
    <text x="95" y="60" text-anchor="middle" fill="${t.textMain}" font-size="10">Engram por proyecto</text>
    <text x="95" y="90" text-anchor="middle" fill="${t.textMain}" font-size="10">Superficie Unificada</text>
    <text x="95" y="120" text-anchor="middle" fill="${t.textMain}" font-size="10">Cero conflictos</text>
    <text x="95" y="200" text-anchor="middle" fill="${t.green}" font-size="10" font-weight="700">✓ MCP Aislado</text>
  </g>

  <g transform="translate(690, 60)">
    <rect width="190" height="240" rx="8" fill="${t.cardBg}" stroke="${t.green}" />
    <text x="95" y="26" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">4. Auto-Reparación</text>
    <text x="95" y="60" text-anchor="middle" fill="${t.textMain}" font-size="10">/sw:doctor --fix</text>
    <text x="95" y="90" text-anchor="middle" fill="${t.textMain}" font-size="10">Parcheo de dependencias</text>
    <text x="95" y="120" text-anchor="middle" fill="${t.textMain}" font-size="10">Auto-refresh de salud</text>
    <text x="95" y="200" text-anchor="middle" fill="${t.cyan}" font-size="10" font-weight="700">⚡ Reparación Lista</text>
  </g>
</svg>`;
}

export function renderDoctorElementSvg(checkName, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 220" xmlns="http://www.w3.org/2000/svg" aria-label="Chequeo Individual">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="35" fill="${t.cyan}" font-size="12" font-weight="700">CHEQUEO ESPECÍFICO: ${checkName.toUpperCase()}</text>
  <line x1="30" y1="50" x2="890" y2="50" stroke="${t.border}" />
  <rect x="30" y="70" width="260" height="110" rx="6" fill="${t.cardInner}" stroke="${t.green}" />
  <text x="160" y="105" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">✓ Estado: Verificado</text>
  <text x="160" y="135" text-anchor="middle" fill="${t.textMuted}" font-size="9">Inspección de binario y PATH</text>
  <rect x="310" y="70" width="580" height="110" rx="6" fill="${t.cardInner}" stroke="${t.border}" />
  <text x="330" y="105" fill="${t.textMain}" font-size="10">Regla de Conformidad: Versión verificada según política de aislamiento.</text>
  <text x="330" y="135" fill="${t.textMuted}" font-size="9">Comando de verificación autónoma: un-specweaver doctor --only ${checkName}</text>
</svg>`;
}

// ===========================================================================
// 3. 🌊 SPRINT & OLAS (Global + Elemento)
// ===========================================================================

export function renderSprintGlobalSvg(state, tema = 'claro') {
  return renderGrafoOlasSvg(state, tema);
}

export function renderSprintElementSvg(waveNumber, waveData, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 240" xmlns="http://www.w3.org/2000/svg" aria-label="Detalle de Ola">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="35" fill="${t.cyan}" font-size="12" font-weight="700">DETALLE DE EJECUCIÓN — OLA ${waveNumber}</text>
  <line x1="30" y1="50" x2="890" y2="50" stroke="${t.border}" />
  
  <g transform="translate(30, 70)">
    <rect width="400" height="130" rx="6" fill="${t.cardInner}" stroke="${t.cyan}" />
    <text x="200" y="30" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">Historias en Paralelo</text>
    <text x="20" y="65" fill="${t.textMain}" font-size="10">• Dependencias resueltas de la ola previa</text>
    <text x="20" y="90" fill="${t.textMain}" font-size="10">• Ejecución concurrente sin colisiones de archivos</text>
  </g>

  <g transform="translate(460, 70)">
    <rect width="430" height="130" rx="6" fill="${t.cardInner}" stroke="${t.green}" />
    <text x="215" y="30" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">Criterio de Cierre de Ola</text>
    <text x="20" y="65" fill="${t.textMain}" font-size="10">• Todas las historias con tests Given/When/Then en verde</text>
    <text x="20" y="90" fill="${t.textMain}" font-size="10">• Sincronización automática a OpenSpec trace.json</text>
  </g>
</svg>`;
}

// ===========================================================================
// 4. 🔄 PUENTE OPENSPEC (Global + Elemento)
// ===========================================================================

export function renderSyncGlobalSvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 320" xmlns="http://www.w3.org/2000/svg" aria-label="Compilación de Puente">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="28" text-anchor="middle" fill="${t.cyan}" font-size="13" font-weight="700">COMPILACIÓN DETERMINÍSTICA: BMAD ➔ OPENSPEC</text>

  <g transform="translate(40, 60)">
    <rect width="240" height="220" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="120" y="30" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">1. Entrada: BMAD AST</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• _bmad-output/epics.md</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Narrativa As a / I want</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Given/When/Then & And</text>
    <text x="20" y="160" fill="${t.textMain}" font-size="10">• Mapeo de Requisitos FR</text>
  </g>

  <g transform="translate(340, 60)">
    <rect width="240" height="220" rx="8" fill="${t.cardBg}" stroke="${t.purple}" />
    <text x="120" y="30" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">2. Motor de Transformación</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Slug y normalización</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Regla SHALL / normativo</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Generador determinístico</text>
    <text x="20" y="160" fill="${t.textMain}" font-size="10">• Cero mutaciones globales</text>
  </g>

  <g transform="translate(640, 60)">
    <rect width="240" height="220" rx="8" fill="${t.cardBg}" stroke="${t.green}" />
    <text x="120" y="30" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">3. Salida: OpenSpec</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• .spec/changes/&lt;story&gt;/</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• spec.md con Given/Then</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• .un-specweaver/trace.json</text>
    <text x="20" y="160" fill="${t.green}" font-size="10" font-weight="700">✓ Listo para build</text>
  </g>
</svg>`;
}

export function renderSyncElementSvg(elementName, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 180" xmlns="http://www.w3.org/2000/svg" aria-label="Elemento de Sincronización">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="30" fill="${t.cyan}" font-size="11" font-weight="700">TRANSFORMADOR DE ARTEFACTO: ${elementName}</text>
  <text x="30" y="70" fill="${t.textMain}" font-size="10">El parser valida el esquema Markdown y genera especificaciones OpenSpec byte a byte idénticas.</text>
  <rect x="30" y="90" width="860" height="50" rx="4" fill="${t.cardInner}" stroke="${t.green}" />
  <text x="50" y="120" fill="${t.green}" font-size="10" font-weight="600">✓ Validación de Trazabilidad: Vinculado a requisitos FR del PRD de BMAD</text>
</svg>`;
}

// ===========================================================================
// 5. 🔨 CONSTRUCCIÓN & SPECS (Global + Elemento)
// ===========================================================================

export function renderBuildGlobalSvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 300" xmlns="http://www.w3.org/2000/svg" aria-label="Pipeline de Construcción">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="28" text-anchor="middle" fill="${t.green}" font-size="13" font-weight="700">PIPELINE DE CONSTRUCCIÓN Y VERIFICACIÓN SDD</text>

  <g transform="translate(60, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">1. Contratos de Entrada</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• .spec/changes/*.md</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Invariantes AD-01..AD-10</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Normativa SHALL</text>
  </g>

  <g transform="translate(350, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.purple}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">2. Ejecución de Tests</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Node test runner nativo</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• 255/255 Tests de suites</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Verificación de CWD</text>
  </g>

  <g transform="translate(640, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.green}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">3. Artefacto Aprobado</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Evidencia en verde</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Cero regresiones</text>
    <text x="20" y="130" fill="${t.green}" font-size="10" font-weight="700">✓ Estado: APROBADO</text>
  </g>
</svg>`;
}

export function renderBuildElementSvg(contractName, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 180" xmlns="http://www.w3.org/2000/svg" aria-label="Contrato de Construcción">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="30" fill="${t.green}" font-size="11" font-weight="700">CONTRATO DE CONSTRUCCIÓN: ${contractName}</text>
  <text x="30" y="70" fill="${t.textMain}" font-size="10">Verificación estricta sin orquestación pesada. Construye directamente contra los requerimientos OpenSpec.</text>
  <rect x="30" y="90" width="860" height="50" rx="4" fill="${t.cardInner}" stroke="${t.cyan}" />
  <text x="50" y="120" fill="${t.cyan}" font-size="10" font-weight="600">✓ Salida: 0 errores de validación, compilación limpia en ESM</text>
</svg>`;
}

// ===========================================================================
// 6. ✨ CAMBIOS & REQUERIMIENTOS (Global + Elemento)
// ===========================================================================

export function renderChangeGlobalSvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 300" xmlns="http://www.w3.org/2000/svg" aria-label="Ciclo de Cambios">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="28" text-anchor="middle" fill="${t.cyan}" font-size="13" font-weight="700">FLUJO DE PROPOSICIÓN Y GESTIÓN DE CAMBIOS (OPENSPEC)</text>

  <g transform="translate(60, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">1. /opsx-propose</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Definición de alcance</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Criterios de éxito</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Control de scope</text>
  </g>

  <g transform="translate(350, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.purple}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">2. Delta Spec</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• .spec/changes/&lt;name&gt;/</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Given/When/Then delta</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Revisión adversarial</text>
  </g>

  <g transform="translate(640, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.green}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">3. Implementación</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Pi Shell con contexto</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Ejecución asistida IA</text>
    <text x="20" y="130" fill="${t.green}" font-size="10" font-weight="700">✓ Merged & Validated</text>
  </g>
</svg>`;
}

export function renderChangeElementSvg(changeTitle, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 180" xmlns="http://www.w3.org/2000/svg" aria-label="Elemento de Cambio">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="30" fill="${t.cyan}" font-size="11" font-weight="700">REQUERIMIENTO DE CAMBIO: ${changeTitle}</text>
  <text x="30" y="70" fill="${t.textMain}" font-size="10">El requerimiento genera un change aislado con capacidad de ejecución directa en Pi Shell.</text>
  <rect x="30" y="90" width="860" height="50" rx="4" fill="${t.cardInner}" stroke="${t.cyan}" />
  <text x="50" y="120" fill="${t.cyan}" font-size="10" font-weight="600">⚡ Acción disponible: '🚀 Implementar con IA' para envío directo de prompt al agente</text>
</svg>`;
}

// ===========================================================================
// 7. 🐛 DEFECTOS / BUGS (Global + Elemento)
// ===========================================================================

export function renderBugGlobalSvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 300" xmlns="http://www.w3.org/2000/svg" aria-label="Bucle de Auto-Resolución de Bugs">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="28" text-anchor="middle" fill="${t.rose}" font-size="13" font-weight="700">BUCLE DE DIAGNÓSTICO, TRIAGE Y AUTO-RESOLUCIÓN CON IA</text>

  <g transform="translate(40, 60)">
    <rect width="190" height="200" rx="8" fill="${t.cardBg}" stroke="${t.rose}" />
    <text x="95" y="30" text-anchor="middle" fill="${t.rose}" font-size="11" font-weight="700">1. Detección</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Registro manual o log</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Criterios de fallo</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Contexto del proyecto</text>
  </g>

  <g transform="translate(260, 60)">
    <rect width="190" height="200" rx="8" fill="${t.cardBg}" stroke="${t.amber}" />
    <text x="95" y="30" text-anchor="middle" fill="${t.amber}" font-size="11" font-weight="700">2. Carga en Pi Shell</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Precarga de path</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Inyección de prompt</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Aislamiento CWD</text>
  </g>

  <g transform="translate(480, 60)">
    <rect width="190" height="200" rx="8" fill="${t.cardBg}" stroke="${t.purple}" />
    <text x="95" y="30" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">3. Reparación IA</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Agente autónomo</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Edición de código</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Streaming live</text>
  </g>

  <g transform="translate(700, 60)">
    <rect width="190" height="200" rx="8" fill="${t.cardBg}" stroke="${t.green}" />
    <text x="95" y="30" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">4. Verificación</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Re-ejecución test</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Exit Code 0</text>
    <text x="20" y="130" fill="${t.green}" font-size="10" font-weight="700">✓ Defecto Cerrado</text>
  </g>
</svg>`;
}

export function renderBugElementSvg(bugTitle, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 180" xmlns="http://www.w3.org/2000/svg" aria-label="Elemento de Defecto">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="30" fill="${t.rose}" font-size="11" font-weight="700">TRAZA DE DEFECTO: ${bugTitle}</text>
  <text x="30" y="70" fill="${t.textMain}" font-size="10">El defecto cuenta con contexto aislado listo para dispatch al subagente de resolución.</text>
  <rect x="30" y="90" width="860" height="50" rx="4" fill="${t.cardInner}" stroke="${t.rose}" />
  <text x="50" y="120" fill="${t.rose}" font-size="10" font-weight="600">🛠️ Botón 'Resolver con IA' enviará el mensaje directo al Pi Shell sin pasos manuales</text>
</svg>`;
}

// ===========================================================================
// 8. 🎫 TICKETS & TRIAGE (Global + Elemento)
// ===========================================================================

export function renderTicketGlobalSvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 280" xmlns="http://www.w3.org/2000/svg" aria-label="Matriz de Triage de Tickets">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="28" text-anchor="middle" fill="${t.cyan}" font-size="13" font-weight="700">MATRIZ DE TRIAGE Y CLASIFICACIÓN DE TICKETS</text>

  <g transform="translate(60, 60)">
    <rect width="220" height="180" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">Issues GitHub Inbound</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Extracción de título/body</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Detección de severidad</text>
    <text x="20" y="130" fill="${t.textMuted}" font-size="10">Análisis semántico</text>
  </g>

  <g transform="translate(350, 60)">
    <rect width="220" height="180" rx="8" fill="${t.cardBg}" stroke="${t.purple}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">Enrutamiento</text>
    <text x="20" y="70" fill="${t.cyan}" font-size="10">➔ /sw:change (Feature)</text>
    <text x="20" y="100" fill="${t.rose}" font-size="10">➔ /sw:bug (Regresión)</text>
    <text x="20" y="130" fill="${t.amber}" font-size="10">➔ /sw:doctor (Entorno)</text>
  </g>

  <g transform="translate(640, 60)">
    <rect width="220" height="180" rx="8" fill="${t.cardBg}" stroke="${t.green}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">Derivación Lista</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Creación de OpenSpec spec</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Cierre automático de issue</text>
    <text x="20" y="130" fill="${t.green}" font-size="10" font-weight="700">✓ Trazabilidad OK</text>
  </g>
</svg>`;
}

export function renderTicketElementSvg(ticketName, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 160" xmlns="http://www.w3.org/2000/svg" aria-label="Elemento de Ticket">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="30" fill="${t.cyan}" font-size="11" font-weight="700">CLASIFICACIÓN DE TICKET: ${ticketName}</text>
  <rect x="30" y="60" width="860" height="70" rx="4" fill="${t.cardInner}" stroke="${t.border}" />
  <text x="50" y="90" fill="${t.textMain}" font-size="10">Regla de Enrutamiento: Clasifica si el issue requiere proposición de cambio o resolución de defecto.</text>
  <text x="50" y="115" fill="${t.green}" font-size="9">Comando de triage disponible: un-specweaver ticket --classify</text>
</svg>`;
}

// ===========================================================================
// 9. 📦 ADOPCIÓN & SETUP (Global + Elemento)
// ===========================================================================

export function renderAdoptGlobalSvg(state, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 300" xmlns="http://www.w3.org/2000/svg" aria-label="Pipeline de Adopción">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="28" text-anchor="middle" fill="${t.cyan}" font-size="13" font-weight="700">MOTOR DE ADOPCIÓN Y CONFIGURACIÓN NO DESTRUCTIVA</text>

  <g transform="translate(60, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">1. Inspección de Repo</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• Validación de path absoluto</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Detección de .git y stack</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Preservación de reglas previas</text>
  </g>

  <g transform="translate(350, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.purple}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">2. Inyección de Vendors</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• BMAD 6.11 (Podado)</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• OpenSpec 1.10</text>
    <text x="20" y="130" fill="${t.textMain}" font-size="10">• Gentle-AI & Engram MCP</text>
  </g>

  <g transform="translate(640, 60)">
    <rect width="220" height="200" rx="8" fill="${t.cardBg}" stroke="${t.green}" />
    <text x="110" y="30" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">3. Superficie Unificada</text>
    <text x="20" y="70" fill="${t.textMain}" font-size="10">• .agents/skills/un-specweaver</text>
    <text x="20" y="100" fill="${t.textMain}" font-size="10">• Comandos /sw:* en agentes</text>
    <text x="20" y="130" fill="${t.green}" font-size="10" font-weight="700">✓ Listo para Desarrollo</text>
  </g>
</svg>`;
}

export function renderAdoptElementSvg(stageName, tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 160" xmlns="http://www.w3.org/2000/svg" aria-label="Elemento de Adopción">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="30" fill="${t.cyan}" font-size="11" font-weight="700">ETAPA DE ADOPCIÓN: ${stageName}</text>
  <rect x="30" y="60" width="860" height="70" rx="4" fill="${t.cardInner}" stroke="${t.border}" />
  <text x="50" y="90" fill="${t.textMain}" font-size="10">El proceso de adopción es idempotente y no destructivo: reemplaza solo bloques autogenerados.</text>
  <text x="50" y="115" fill="${t.green}" font-size="9">✓ Preserva la memoria histórica del repositorio</text>
</svg>`;
}

// ===========================================================================
// 10. 🌱 NUEVO PROYECTO & WIZARD (Global + Elemento)
// ===========================================================================

export function renderNuevoProyectoGlobalSvg(tema = 'claro') {
  const t = getThemeTokens(tema);
  return `
<svg class="diagrama-svg" viewBox="0 0 920 280" xmlns="http://www.w3.org/2000/svg" aria-label="Flujo de Creación de Proyecto">
  <rect width="100%" height="100%" fill="${t.bg}" rx="12" stroke="${t.border}" stroke-width="1" />
  <text x="460" y="28" text-anchor="middle" fill="${t.cyan}" font-size="13" font-weight="700">ASISTENTE DE CREACIÓN: PRODUCT BRIEF ➔ PRD NUMERADO ➔ INICIALIZACIÓN</text>

  <!-- Paso 1 -->
  <g transform="translate(40, 60)">
    <rect width="150" height="180" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <circle cx="75" cy="35" r="16" fill="${t.cardInner}" stroke="${t.cyan}" stroke-width="2" />
    <text x="75" y="40" text-anchor="middle" fill="${t.cyan}" font-size="12" font-weight="700">1</text>
    <text x="75" y="75" text-anchor="middle" fill="${t.cyan}" font-size="11" font-weight="700">Identidad</text>
    <text x="15" y="105" fill="${t.textMain}" font-size="9">• Nombre & Path</text>
    <text x="15" y="125" fill="${t.textMain}" font-size="9">• Idioma (es/en)</text>
    <text x="15" y="145" fill="${t.textMain}" font-size="9">• Scope Engram</text>
  </g>

  <!-- Flecha 1-2 -->
  <path d="M 200 150 L 220 150" stroke="${t.cyan}" stroke-width="2" marker-end="url(#flecha-cyan)" />

  <!-- Paso 2 -->
  <g transform="translate(230, 60)">
    <rect width="150" height="180" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <circle cx="75" cy="35" r="16" fill="${t.cardInner}" stroke="${t.purple}" stroke-width="2" />
    <text x="75" y="40" text-anchor="middle" fill="${t.purple}" font-size="12" font-weight="700">2</text>
    <text x="75" y="75" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">Product Brief</text>
    <text x="15" y="105" fill="${t.textMain}" font-size="9">• Problema & KPIs</text>
    <text x="15" y="125" fill="${t.textMain}" font-size="9">• Audiencia / Users</text>
    <text x="15" y="145" fill="${t.textMain}" font-size="9">• Out-of-Scope</text>
  </g>

  <!-- Flecha 2-3 -->
  <path d="M 390 150 L 410 150" stroke="${t.purple}" stroke-width="2" />

  <!-- Paso 3 -->
  <g transform="translate(420, 60)">
    <rect width="150" height="180" rx="8" fill="${t.cardBg}" stroke="${t.purple}" />
    <circle cx="75" cy="35" r="16" fill="${t.cardInner}" stroke="${t.purple}" stroke-width="2" />
    <text x="75" y="40" text-anchor="middle" fill="${t.purple}" font-size="12" font-weight="700">3</text>
    <text x="75" y="75" text-anchor="middle" fill="${t.purple}" font-size="11" font-weight="700">PRD Numerado</text>
    <text x="15" y="105" fill="${t.textMain}" font-size="9">• FR-001, FR-002...</text>
    <text x="15" y="125" fill="${t.textMain}" font-size="9">• NFR-001, NFR-002</text>
    <text x="15" y="145" fill="${t.textMain}" font-size="9">• Prioridad Must</text>
  </g>

  <!-- Flecha 3-4 -->
  <path d="M 580 150 L 600 150" stroke="${t.green}" stroke-width="2" />

  <!-- Paso 4 -->
  <g transform="translate(610, 60)">
    <rect width="135" height="180" rx="8" fill="${t.cardBg}" stroke="${t.border}" />
    <circle cx="67" cy="35" r="16" fill="${t.cardInner}" stroke="${t.green}" stroke-width="2" />
    <text x="67" y="40" text-anchor="middle" fill="${t.green}" font-size="12" font-weight="700">4</text>
    <text x="67" y="75" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">Arquitectura</text>
    <text x="10" y="105" fill="${t.textMain}" font-size="9">• Clean Arch</text>
    <text x="10" y="125" fill="${t.textMain}" font-size="9">• Stack & Vendors</text>
    <text x="10" y="145" fill="${t.textMain}" font-size="9">• Graphify Auto</text>
  </g>

  <!-- Flecha 4-5 -->
  <path d="M 755 150 L 770 150" stroke="${t.green}" stroke-width="2" />

  <!-- Paso 5 -->
  <g transform="translate(775, 60)">
    <rect width="110" height="180" rx="8" fill="${t.cardBg}" stroke="${t.green}" />
    <circle cx="55" cy="35" r="16" fill="${t.cardInner}" stroke="${t.green}" stroke-width="2" />
    <text x="55" y="40" text-anchor="middle" fill="${t.green}" font-size="12" font-weight="700">5</text>
    <text x="55" y="75" text-anchor="middle" fill="${t.green}" font-size="11" font-weight="700">Lanzar</text>
    <text x="10" y="110" fill="${t.textMain}" font-size="9">• Preview MD</text>
    <text x="10" y="135" fill="${t.green}" font-size="9" font-weight="700">✓ /sw:new</text>
  </g>
</svg>`;
}

export function renderNuevoProyectoElementSvg(paso = 1, tema = 'claro') {
  const t = getThemeTokens(tema);
  const pasoTextos = {
    1: { tit: 'PASO 1: IDENTIDAD Y RUTA DEL PROYECTO', desc: 'Validación de ruta absoluta, nombre del workspace, idioma del proyecto y aislamiento de memoria.' },
    2: { tit: 'PASO 2: PRODUCT BRIEF (BMAD)', desc: 'Definición del problema fundamental, usuarios objetivo, métricas de éxito y límites explícitos de alcance.' },
    3: { tit: 'PASO 3: PRD CON REQUISITOS NUMERADOS', desc: 'Captura estructurada de Requisitos Funcionales (FR-XXX) y No Funcionales (NFR-XXX) con prioridad normativa.' },
    4: { tit: 'PASO 4: ARQUITECTURA Y DEPENDENCIAS', desc: 'Selección de estilo arquitectónico, stack tecnológico, pineado de vendors y opciones de graphify.' },
    5: { tit: 'PASO 5: PREVISUALIZACIÓN Y CREACIÓN ATÓMICA', desc: 'Generación en vivo de product-brief.md y prd.md con persistencia atómica y streaming en Pi Shell.' },
  };

  const info = pasoTextos[paso] || pasoTextos[1];

  return `
<svg class="diagrama-svg" viewBox="0 0 920 150" xmlns="http://www.w3.org/2000/svg" aria-label="Detalle del Paso del Asistente">
  <rect width="100%" height="100%" fill="${t.cardBg}" rx="8" stroke="${t.border}" />
  <text x="30" y="30" fill="${t.cyan}" font-size="11" font-weight="700">${info.tit}</text>
  <rect x="30" y="55" width="860" height="65" rx="4" fill="${t.cardInner}" stroke="${t.border}" />
  <text x="50" y="85" fill="${t.textMain}" font-size="10">${info.desc}</text>
  <text x="50" y="105" fill="${t.green}" font-size="9">✓ Conexión directa con el compilador determinístico de BMad y OpenSpec</text>
</svg>`;
}
