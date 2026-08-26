# un-specweaver

Un comando monta un entorno de desarrollo dirigido por especificacion que junta la mitad de
**planeacion** de [BMAD METHOD](https://github.com/bmad-code-org/BMAD-METHOD) con la mitad de
**ejecucion** de [Gentle-AI](https://github.com/Gentleman-Programming/gentle-ai) / OpenSpec,
y el puente deterministico entre ambos.

```bash
npx un-specweaver init
```

Funciona en **macOS** y **Linux**, con **Claude Code** (de pago) y **OpenCode** (gratis).
Nadie necesita clonar este repositorio.

## Instalacion para el equipo

Soporta **macOS** y **Linux**, con **Claude Code** u **OpenCode** (al menos uno).

### Requisitos previos

| | Version | Por que |
|---|---|---|
| Node.js | **20.11+** | lo verifica el preflight y bloquea si falta |
| Un agente | Claude Code **o** OpenCode | sin agente no hay donde correr los comandos |
| git | cualquiera | aviso, no bloquea: sin repo no se puede revertir |
| `uv` (Python) | opcional | BMAD lo usa para su config; funciona sin el, mas lento |

---

### macOS

**1. Node 20+ y Homebrew**

```bash
# Homebrew, si no lo tenes
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node        # Node 20+
brew install uv          # opcional
```

**2. Un agente**

```bash
brew install --cask claude-code      # o: npm install -g @anthropic-ai/claude-code
brew install sst/tap/opencode        # OpenCode
```

**3. El entorno, en la carpeta de tu proyecto**

```bash
cd mi-proyecto
npx un-specweaver init
```

**4. Autorizar el tap de Homebrew.** `init` se va a detener aqui: Gentle-AI instala Engram y GGA
desde un tap de terceros y brew se niega a cargar formulas no confiables. **Es una decision de
seguridad que la herramienta no toma por nadie.**

```bash
brew trust gentleman-programming/tap
npx un-specweaver init
```

Si preferis minimo privilegio, `init` lista exactamente que items autorizar uno por uno.

---

### Linux

**1. Node 20+**

```bash
# Debian / Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora
sudo dnf install nodejs npm

# Arch
sudo pacman -S nodejs npm

# uv (opcional, cualquier distro)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**2. Un agente**

```bash
npm install -g @anthropic-ai/claude-code
curl -fsSL https://opencode.ai/install | bash      # OpenCode
```

**3. El entorno**

```bash
cd mi-proyecto
npx un-specweaver init
```

**4. Gentle-AI.** En Linux **no hay paso de `brew trust`**: sin Homebrew, `init` usa el instalador
oficial de Gentle-AI, que detecta tu gestor de paquetes (apt / dnf / pacman). Va a pedirte
confirmacion antes de ejecutar un script remoto — es `curl | bash`, y la herramienta nunca lo
corre sin que digas que si. Con `--yes` se salta la confirmacion.

> **Nota honesta:** el flujo completo se probo end-to-end en macOS. La ruta de Linux esta
> implementada y el instalador de Gentle-AI la soporta oficialmente, pero no la corri yo.
> Si algo falla ahi, `npx un-specweaver doctor` dice exactamente que paso y que bloquea.

---

### Las cuatro preguntas de `init`

Se hacen **una sola vez** y quedan en `.un-specweaver/config.json`:

| Pregunta | Opciones | Recomendado |
|---|---|---|
| Idioma | Espanol / English | el del equipo |
| Memoria de Engram | Por proyecto / Global | **por proyecto** |
| graphify | Usarlo si esta / Ignorarlo | usarlo si esta |
| Agentes | los detectados en la maquina | los que uses de verdad |

Con flags, sin preguntas (util para scripts):

```bash
npx un-specweaver init --lang es --engram-scope project --graphify auto \
  --agents claude-code,opencode
```

---

### Verificar

```bash
npx un-specweaver doctor
```

Todo en `ok`. Si algo falta, dice **que bloquea**: los pasos de Gentle-AI solo impiden
`/sw:build`; planear funciona sin ellos.

### Empezar

Abri tu agente en esa carpeta:

```
/sw:new          # Claude Code
/sw-new          # OpenCode
```

---

## Idioma

Es una decision de proyecto, no un flag suelto. `init` la pregunta si no pasas `--lang` y hay
terminal, la guarda en `.un-specweaver/config.json`, y no vuelve a preguntar. La respetan **los
comandos, la skill, la plantilla de arquitectura y los mensajes del CLI**.

```
$ npx un-specweaver init

  Idioma del proyecto:
    1) Espanol
    2) English
  > 2

  agents   claude-code, opencode (autodetected)
  language en (English)

▸ BMAD METHOD (planning)  [bmad]
```

Precedencia: `--lang` > lo guardado > pregunta si hay terminal > `es`.
Sin terminal (CI) nunca pregunta.

## Por que no es un fork

BMAD y Gentle-AI se actualizan casi a diario. Un hibrido vendorizado queda congelado en el tiempo
y hereda el mantenimiento de dos proyectos ajenos. Aqui los vendors se **invocan pineados** desde
`src/vendors.json`, que es el unico punto de control de drift que existe: se sube una version ahi,
se publica, y `un-specweaver doctor` reporta la diferencia en cada proyecto instalado.

## El corte

```
  BMAD                          un-specweaver                    Gentle-AI / OpenSpec
  ─────────────────────────     ────────────────────        ────────────────────────
  analyst → pm → architect                                  sdd: explore → propose
  prd → epics → stories    ───▶  bridge/  ───▶  changes ───▶ spec → design → implement
  correct-course                 trace.json                  Engram (decisiones)
  sprint-planning                sprint-plan.md              RDD (review acotado)
  ✗ podado
```

BMAD termina en la story. `init` **poda** las skills que cruzan la frontera:

| Podado | Por que |
|---|---|
| `bmad-agent-dev`, `bmad-build`, `bmad-build-auto` | escriben codigo; aqui lo hace el SDD |
| `bmad-spec` | produce su propio contrato de maquina; aqui lo hace OpenSpec |
| `bmad-dev-story`, `bmad-dev-auto`, `bmad-quick-dev`, `bmad-create-story` | shims deprecados que reenvian a `bmad-build`, que ya no existe |
| `bmad-qa-generate-e2e-tests` | **no** se poda por defecto; `--prune-extra` lo hace si quieres que el SDD sea el unico dueno de los tests |

La poda alcanza **skills y comandos**. BMAD instala cada skill dos veces: el directorio en
`<skills>/` y ademas un comando en `.opencode/commands/<skill>.md`. Podar solo el directorio
deja los agentes constructores invocables desde OpenCode.

Dos agentes desarrolladores compitiendo por el mismo archivo es la falla de diseno mas probable
de este montaje. La poda la evita en la instalacion, no con una regla que el agente pueda ignorar.

## Comandos del agente

`init` instala ocho comandos, en el idioma elegido, en el formato de cada agente.
En Claude Code son `/sw:new`; en OpenCode los mismos son `/sw-new`.

| Comando | Cuando |
|---|---|
| `/sw:new` | proyecto desde cero: idea → PRD → epics → stories → changes verificados |
| `/sw:adopt` | proyecto existente: graphify → arquitectura real → PRD brownfield → linea base de specs |
| `/sw:change "<req>"` | requerimiento a mitad del desarrollo: **control de alcance primero**, luego regenerar solo lo afectado |
| `/sw:ticket <n>` | issue de GitHub: clasifica defecto vs requerimiento y enruta |
| `/sw:sprint` | recalcula las olas y reparte trabajo por dependencias reales |
| `/sw:build <id>` | la unica fase que escribe codigo de producto; verifica dependencias antes de empezar |
| `/sw:sync` | actualiza vendors de forma controlada |
| `/sw:doctor` | entorno + coherencia del flujo (FR sin change, specs huerfanos, frontera intacta) |

Los dos agentes reciben lo mismo: las nueve skills, los nueve comandos y la skill de
orquestacion. Un agente no se declara soportado hasta haber corrido el flujo completo con el;
por eso la lista es corta.

## Capacidades opcionales

Se **detectan, nunca se instalan**. Ausentes no son un error: `doctor` las reporta en su propia
seccion y el flujo sigue funcionando.

**graphify** — mapa del codigo. Los comandos que se benefician (`/sw:adopt`, `/sw:build`) llevan
tres ramas explicitas: hay grafo → consultarlo; hay skill sin grafo → ofrecer construirlo;
no hay nada → seguir **diciendo que el mapa va a ser menos confiable**. El fallo que esto evita
es el silencioso: invocar `/graphify`, que no pase nada, y seguir como si tuvieras el mapa.

Detalle que importa: la skill suele vivir en `~/.claude/skills/`, asi que puede existir para
Claude Code y no para OpenCode. La deteccion mira las cuatro rutas posibles y reporta cual.

**uv** (Python) — BMAD lo usa para resolver su configuracion y lo verifica al instalar.
Preflight lo revisa como **aviso, no como bloqueante**: las skills de BMAD traen fallback manual.

## Comandos del CLI

```bash
npx un-specweaver init [dir]          # monta el entorno completo
npx un-specweaver doctor [dir]        # salud, pasos pendientes y drift de vendors
npx un-specweaver bridge <epics.md>   # stories de BMAD -> changes de OpenSpec
npx un-specweaver vendors             # versiones pineadas
```

`init` acepta `--agents`, `--lang es|en`, `--dry-run`, `--yes`, `--force`, `--prune-extra`,
`--only`, `--skip`, `--keep-going`.

**`--dry-run` imprime el plan exacto** — cada comando, cada archivo, cada borrado — sin ejecutar
nada. El plan y la ejecucion salen del mismo codigo, asi que no puede mentir.

### Que hace `init`

1. `.gitignore`: bloque marcado con lo regenerable. Va **primero** para que un paso posterior
   que falle no deje vendor a medio instalar listo para commitear
2. Preflight: node ≥ 20.11, npx, curl, plataforma; `git` y `uv` como avisos
3. BMAD pineado, alcance del proyecto, solo el modulo de planeacion, idioma configurado
4. Poda de la frontera
5. `openspec init` con los agentes detectados
6. Gentle-AI: binario (brew si esta disponible, si no el script oficial) + configuracion `--scope workspace`
7. Los ocho comandos `/sw:*` en el formato de cada agente, la skill `un-specweaver` en todos los
   dirs de skills, y `docs/architecture-base.md`

### Prerequisitos que la herramienta NO resuelve sola

Gentle-AI instala **Engram** como parte de su propio pipeline, y brew se niega a cargar formulas
no confiables. `un-specweaver` **detecta cuales faltan y da el comando minimo**, pero no lo ejecuta:
autorizar una formula le da permiso de correr codigo de instalacion, y esa es una decision del
usuario.

```
! Homebrew no confia en: gentleman-programming/tap/engram
  corre esto y vuelve a intentar:
    brew trust --formula gentleman-programming/tap/engram
    npx un-specweaver init
```

La confianza se mide **por formula, no por tap**: `brew tap-info` reporta un tap como "Untrusted"
aunque una formula suya si este confiada — verificado en una maquina donde `gentle-ai` instalaba
bien y `engram` fallaba, con el tap marcado untrusted en ambos casos. Se lee `trust.json` y se pide
solo lo que falta, en vez de confiar el tap entero (que ademas incluye `gentle-creation`,
`gentleman-dots` y `gga`).

El paso **falla** en vez de omitirse en silencio: reportar "listo" sobre algo que no ocurrio
seria mentir.

### Que bloquea que

`doctor` anota cada paso pendiente con lo que impide. No todo pendiente es un bloqueo:

| Paso | Bloquea |
|---|---|
| `bmad`, `bmad-prune`, `openspec`, `layer` | planear (`/sw:new`, `/sw:adopt`) |
| `gentle-bin`, `gentle-config` | **solo** `/sw:build` — planear funciona sin ellos |
| `gitignore` | nada; es higiene del repo |

Sin esa distincion un agente se detiene por Gentle-AI antes siquiera de levantar requerimientos,
que es exactamente lo que pasaba antes.

### Que va al repo y que no

`init` escribe un bloque marcado en `.gitignore` (preserva lo que ya tuvieras, y re-ejecutar lo
reemplaza en vez de duplicarlo). En un proyecto real la diferencia es de **499 archivos a 7**:

| Al repo | Ignorado |
|---|---|
| `openspec/` — los specs son el producto | `_bmad/`, `node_modules/` |
| `_bmad-output/` — PRD y epics | `.claude/skills/bmad-*/`, `.agents/skills/bmad-*/` |
| `docs/architecture-base.md` | `.claude/commands/sw/`, `.opencode/commands/sw-*.md` |
| `.un-specweaver/` — config y trazabilidad | skills y comandos de OpenSpec |

Se ignora **por patron exacto, nunca `.claude/` entero**: tus propias skills y comandos siguen
versionados. Un companero clona, corre `npx un-specweaver init`, y reconstituye el tooling desde
el pin — el repo guarda especificaciones, no dependencias.

### Que se escribe fuera del proyecto

Casi todo queda dentro. Verificado con snapshot antes/despues: los pasos `bmad`, `openspec`,
`layer` y `gitignore` **no** tocan `~/.claude` ni `~/.agents`.

Dos excepciones, ambas anunciadas antes de correr:

| Paso | Que escribe fuera |
|---|---|
| `gentle-bin` | el binario de Gentle-AI (herramienta de sistema, via Homebrew o script oficial) |
| `gentle-config` | Engram registra su servidor MCP: `~/.engram/`, `~/.claude/mcp/engram.json` y la config de cada agente |

`--scope workspace` cubre los assets de Gentle-AI pero **no** contiene a Engram: la configuracion
MCP es global por naturaleza. Verificado en una maquina real — la version anterior de este README
afirmaba lo contrario y era falso.

Si no querés nada fuera del proyecto, corre `init --skip gentle-bin,gentle-config`: perdes el SDD
y la memoria de decisiones, todo lo demas funciona igual.

Es idempotente: volver a correrlo omite lo ya hecho.

## El puente

```bash
npx un-specweaver bridge _bmad-output/epics.md
npx @fission-ai/openspec validate --all --strict
```

Opciones: `--only 1.2` · `--epic 1` · `--dry-run` · `--force` · `--strict` · `--lang es|en` · `--normative shall|debe`

### Mapeo

| BMAD | OpenSpec |
|---|---|
| `## Epic {N}: {titulo}` | capability → `specs/<kebab>/` |
| `### Story {N}.{M}` | **un change** → `changes/e{N}s{M}-<slug>/` |
| `So that {value}` | `proposal.md` → `## Why` |
| `I want {want}` | `proposal.md` → `## What Changes` + `### Requirement:` |
| bloque `Given/When/Then/And` | `#### Scenario:` + `- **GIVEN/WHEN/THEN/AND**` |
| FR Coverage Map | `.un-specweaver/trace.json` |

Funciona en **espanol e ingles**, autodetectado por puntaje de tokens (una palabra suelta que
"parezca" espanola no voltea un documento ingles). `--lang` fuerza el idioma.

## Decisiones no obvias

Todas verificadas contra los CLIs reales, no contra la documentacion.

- **`--no-shims` no existe.** Esta en los docs de BMAD; el binario 6.11.0 responde
  `unknown option`. Por eso los shims deprecados se podan por ruta.
- **`openspec validate --strict` exige el literal `SHALL`/`MUST`** aunque el spec este en espanol.
  El modo por defecto emite prosa espanola con el keyword intacto; `--normative debe` lee mejor
  pero obliga a soltar `--strict`.
- **Cada vendor nombra los agentes distinto** (BMAD `claude-code`, OpenSpec `claude`,
  Gentle `claude-code`). El mapa en `src/vendors.json` es el unico lugar donde eso se sabe.
- **`uv` es un prerequisito real de BMAD** que su documentacion no destaca: el instalador lo
  verifica en su primera linea. No bloquea, pero callarlo seria mentir.
- **Cada agente ubica y formatea los comandos distinto.** Claude Code:
  `.claude/commands/<ns>/<n>.md` con `name`/`description`/`allowed-tools`. OpenCode:
  `.opencode/commands/<ns>-<n>.md` con solo `description`. Las referencias cruzadas dentro del
  cuerpo se reescriben (`/sw:change` → `/sw-change`) para que un comando no le diga al usuario
  que invoque algo que en su agente no existe.
- **Una story = un change**, no un epic = un change. Las stories de BMAD estan dimensionadas para
  un solo dev agent, que es la unidad que consume el SDD.
- **Solo la primera story de un epic declara `## Purpose`.** El resto emite `ADDED Requirements`
  sobre la misma capability — todas ADDED, nunca MODIFIED: cada story agrega un requisito distinto.
- **La narrativa se pasa a tercera persona.** BMAD escribe "registrarme usando mi NIT"; un requisito
  normativo no habla en primera persona. En ingles ademas se quita el infinitivo duplicado
  ("allow X to to publish").
- **El grafo de dependencias no se inventa.** Stories del mismo epic van en secuencia (comparten
  capability); epics distintos en paralelo; las dependencias cruzadas solo se detectan si estan
  escritas en el texto. Ese limite se reporta en `sprint-plan.md` en vez de fingir precision.

## Fuente de verdad por tipo de dato

Tres memorias solapadas (BMAD + Engram + graphify) gastan tokens y se contradicen.
Una sola duena por dato:

| Dato | Duena |
|---|---|
| Intencion de producto (el *que* de negocio) | `_bmad-output/` |
| Contrato de comportamiento (el *que* tecnico) | `openspec/specs/` |
| Decisiones y rationale (el *por que*) | Engram |
| Estructura del codigo (el *donde*) | grafo de graphify |
| Trazabilidad FR ↔ story ↔ change | `.un-specweaver/trace.json` |
| Arquitectura de la organizacion | `docs/architecture-base.md` |

## Desarrollo

```bash
npm test                    # 118 tests
npm pack                    # ~23 kB
node bin/un-specweaver.mjs init --dry-run
```

`src/steps.mjs` separa **plan** (puro, testeable) de **ejecucion**. Un paso nuevo se agrega ahi
implementando `status()` y `plan()`; `--dry-run`, la idempotencia y `doctor` salen gratis.

## Estado

| Pieza | Estado |
|---|---|
| `bridge/` — story → change | **funciona**, es/en, validado contra `openspec validate --all --strict` |
| `init` / `doctor` — instalador multi-agente | **funciona**, probado end-to-end desde el tarball |
| 8 comandos `/sw:*` | **funciona**, es/en, Claude Code + OpenCode |
| Skill `un-specweaver` | **funciona**, es/en, todos los agentes |
| Mensajes del CLI bilingües | **funciona**, 86 cadenas, es/en |
| graphify como capacidad opcional | **funciona**, deteccion + tres ramas declaradas |
| Gentle-AI (binario) | **funciona** — instala via Homebrew |
| Engram | bloqueado por confianza del tap; detectado y reportado con remedio, sin ejecutar |
