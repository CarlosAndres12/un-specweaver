# un-specweaver

**Desarrollo dirigido por especificacion, de la idea al codigo, con trazabilidad completa.**

Una metodologia y la herramienta que la implementa. En vez de describirle una funcionalidad a un
agente y esperar que acierte, el trabajo baja por fases: cada una produce un artefacto verificable
que alimenta a la siguiente, y cada linea de codigo se puede rastrear hasta el requisito que la
justifica.

```bash
npx un-specweaver init
```

macOS y Linux. Claude Code u OpenCode. Espanol o ingles. Nadie necesita clonar este repositorio.

---

## La metodologia

Seis fases. Cada una tiene una salida concreta, y ninguna empieza sin la anterior.

| | Fase | Produce | Por que existe |
|---|---|---|---|
| 1 | **Entender** | brief y PRD con requisitos numerados | sin requisitos numerados no hay que rastrear |
| 2 | **Decidir** | arquitectura y diseno UX | las decisiones tecnicas se toman una vez, no en cada historia |
| 3 | **Descomponer** | epicas e historias con criterios Given/When/Then | una historia es la unidad que una persona puede terminar |
| 4 | **Traducir** | un contrato ejecutable por historia | **deterministico**: misma entrada, misma salida, siempre |
| 5 | **Construir** | codigo que cumple el contrato | los escenarios del contrato son los casos de prueba |
| 6 | **Cerrar** | el contrato pasa a ser la verdad del sistema | de ahi se mide el alcance de todo lo que llegue despues |

### Las tres reglas que la sostienen

**El contrato es derivado, no fuente.** Los contratos se regeneran desde las historias; no se
editan a mano. Si un contrato esta mal, la historia esta mal. Editar el derivado desincroniza los
dos y nadie se entera hasta que es tarde.

**El alcance se controla antes de tocar archivos.** Un requerimiento nuevo se clasifica primero
—dentro del alcance, scope creep, o epica nueva— y recien despues se toca algo. Un defecto no
pasa por ese control: lo acordado no cambio, solo no se cumplio. Son dos flujos distintos a
proposito.

**Cada dato tiene un solo dueno.** La intencion de producto vive en el PRD; el contrato de
comportamiento en los specs; el rationale en la memoria; la estructura del codigo en el grafo.
Duplicar entre capas es como empiezan a contradecirse.

---

## El flujo, en comandos

Nueve comandos, un solo vocabulario. En Claude Code se escriben `/sw:new`; en OpenCode, `/sw-new`.

```
                  ┌─ /sw:new ─────────────────────────────────┐
   idea  ────────▶│  entender → decidir → descomponer         │
                  │  → traducir → verificar                   │
                  └───────────────────┬───────────────────────┘
                                      │  contratos verificados
                                      ▼
   /sw:sprint ──▶ que se puede hacer en paralelo y que no
                                      │
                                      ▼
   /sw:build <id> ──▶ construir una historia contra su contrato
                                      │
                                      ▼
                              /sw:build la archiva
```

| Comando | Cuando |
|---|---|
| `/sw:new` | proyecto desde cero |
| `/sw:adopt` | proyecto que ya existe: mapear, derivar arquitectura, fijar la linea base |
| `/sw:build <id>` | construir una historia |
| `/sw:change "<req>"` | requerimiento nuevo — **cambia lo acordado**, pasa por control de alcance |
| `/sw:bug "<defecto>"` | defecto — lo acordado esta bien, el codigo no. Sin control de alcance |
| `/sw:ticket <n>` | issue de GitHub: clasifica y enruta a uno de los dos anteriores |
| `/sw:sprint` | recalcula que se puede paralelizar segun dependencias reales |
| `/sw:sync` | actualizar las herramientas de forma controlada |
| `/sw:doctor` | salud del entorno y coherencia del flujo |

---

## Que hace la herramienta

`un-specweaver` no reimplementa la metodologia: **orquesta herramientas que ya la resuelven bien**,
las pinea a una version conocida, y aporta la pieza que a ninguna le sobraba.

| Fase | Motor |
|---|---|
| Entender, decidir, descomponer | [BMAD METHOD](https://github.com/bmad-code-org/BMAD-METHOD) |
| **Traducir** | **el puente de este repositorio** |
| Contratos y verificacion | [OpenSpec](https://github.com/Fission-AI/OpenSpec) |
| Construccion, revision, memoria | [Gentle-AI](https://github.com/Gentleman-Programming/gentle-ai) + Engram |

**La fase 4 es la que no existia.** BMAD llega hasta la historia; OpenSpec arranca en el contrato;
entre las dos habia un salto que se hacia a mano o se improvisaba. El puente lo cierra de forma
deterministica: mismo `epics.md`, mismos contratos, byte por byte, con la trazabilidad
requisito ↔ historia ↔ contrato escrita en un archivo.

Ademas la herramienta hace tres cosas que suenan menores y no lo son:

- **Poda lo que se pisa.** Dos herramientas del stack traen agentes constructores; si conviven,
  compiten por el mismo archivo. Se remueven en la instalacion, no con una regla que un agente
  pueda ignorar.
- **Deja un solo vocabulario.** Los comandos de los vendors se ocultan; queda `/sw:*`. Las skills
  utiles siguen todas disponibles.
- **Aisla la memoria por proyecto.** Por defecto se comparte entre proyectos; aqui se ata a este.

Nada se forkea. Los vendors se actualizan solos y el pin vive en un unico archivo.

---

## Instalacion para el equipo

Cinco pasos. **Los cuatro primeros son iguales en macOS y Linux**; solo cambian el gestor
de paquetes del sistema y un permiso de Homebrew que aplica solo a macOS.

### Lo que tiene que estar antes de correr `init`

| | Requisito | Bloquea si falta |
|---|---|---|
| 1 | Node.js **20.11+** | **si** |
| 2 | **Claude Code** u **OpenCode** (al menos uno) | **si** |
| 3 | Homebrew — **solo macOS** | si, para Gentle-AI |
| 4 | git | no, pero sin el no podes revertir |
| 5 | `uv` (Python) | no, solo hace mas lento a BMAD |

---

### Paso 1 — Node.js 20.11 o superior

<table>
<tr><th>macOS</th><th>Linux</th></tr>
<tr><td>

```bash
brew install node
```

</td><td>

```bash
# Debian / Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora
sudo dnf install nodejs npm

# Arch
sudo pacman -S nodejs npm
```

</td></tr>
</table>

En macOS, si no tenes Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Homebrew **no es opcional en macOS**: es como se instala Gentle-AI. En Linux no hace falta.

### Paso 2 — Un agente (igual en los dos sistemas)

```bash
npm install -g @anthropic-ai/claude-code    # Claude Code
npm install -g opencode-ai                  # OpenCode
```

Con uno alcanza. Si instalas los dos, `init` te deja elegir cuales configurar.

### Paso 3 — Opcional: `uv`

```bash
# macOS
brew install uv

# Linux (cualquier distro)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

BMAD lo usa para resolver su configuracion. Sin el funciona igual, solo mas lento.

### Paso 4 — Comprobar antes de seguir

```bash
node --version      # v20.11.0 o superior
claude --version    # o: opencode --version
git --version
brew --version      # solo macOS
```

Si algo falta, volve al paso correspondiente. `init` tambien lo verifica y te dice que falta,
pero es mas rapido saberlo ahora.

### Paso 5 — Montar el entorno

```bash
cd mi-proyecto
npx un-specweaver init
```

Hace cuatro preguntas —idioma, alcance de la memoria, graphify y que agentes configurar— y
despues instala BMAD, inicializa OpenSpec y configura Gentle-AI. Tarda unos minutos.

**En macOS se va a detener una vez** pidiendo autorizar un tap de Homebrew: Gentle-AI instala
Engram y GGA desde un tap de terceros, y brew se niega a cargar formulas no confiables.
**Es una decision de seguridad que la herramienta no toma por nadie.**

```bash
brew trust gentleman-programming/tap
npx un-specweaver init
```

Si preferis minimo privilegio, `init` lista exactamente que items autorizar uno por uno.

**En Linux ese paso no existe.** Sin Homebrew se usa el instalador oficial de Gentle-AI, que
detecta tu gestor de paquetes. Va a pedir confirmacion antes de ejecutar el script remoto
(`curl | bash`); con `--yes` se salta la confirmacion.

> La ruta de Linux esta implementada y Gentle-AI la soporta oficialmente, pero el flujo completo
> se probo end-to-end solo en macOS. Si algo falla, `doctor` dice que paso y que bloquea.

---

### Las cuatro preguntas de `init`

Se hacen **una sola vez** y quedan en `.un-specweaver/config.json`:

| Pregunta | Opciones | Recomendado |
|---|---|---|
| Idioma | Espanol / English | el del equipo |
| Memoria de Engram | Por proyecto / Global | **por proyecto** |
| graphify | Usarlo si esta / Ignorarlo | usarlo si esta |
| Agentes | los detectados en la maquina | los que uses de verdad |

Sin preguntas, para scripts o CI:

```bash
npx un-specweaver init --lang es --engram-scope project --graphify auto \
  --agents claude-code,opencode --yes
```

### Verificar

```bash
npx un-specweaver doctor
```

Todo en `ok`. Si algo falta, dice **que bloquea**: los pasos de Gentle-AI solo impiden
`/sw:build`; planear funciona sin ellos.

### Empezar

Abri tu agente en esa carpeta y corre:

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

Quince comandos. La ayuda sale del mismo codigo que ejecuta, asi que no puede mentir:

```bash
npx un-specweaver --help              # ayuda completa, sale 1 sin comando
npx un-specweaver --version           # version, sale 0
npx un-specweaver <comando> --help    # ayuda completa, sale 0 (salvo bridge y dashboard)
```

Sin comando imprime la ayuda y sale 1; comando o flag desconocido sale 2. Ojo: `--help`
junto a un comando imprime la ayuda global (no una por comando); solo `dashboard` tiene
ayuda propia y `bridge` rechaza `--help` (ver abajo).

| Comando | Que hace |
|---|---|
| `init [dir]` | monta el entorno completo (ver abajo) |
| `new [dir]` | como `init`, sin preguntar |
| `adopt [dir]` | como `init`, sin preguntar y rehecho |
| `update [dir]` | actualiza skills, comandos y config sin tocar arquitectura ni specs |
| `doctor [dir]` | salud, pasos pendientes y drift; sale 1 si hay deriva o bloqueo |
| `bridge <epics.md>` | stories de BMAD → changes de OpenSpec |
| `sprint [dir]` | olas de trabajo paralelo desde `epics.md` |
| `sync [dir]` | `bridge` si hay epics, si no `doctor` |
| `build [...]` | valida specs o corre `bridge` con tus flags |
| `change` / `bug` / `ticket` | te dicen que comando del agente correr |
| `context [dir]` | lista los artefactos de planeacion a cargar |
| `vendors` | muestra las versiones pineadas |
| `dashboard` / `ui` | dashboard web multi-proyecto |

### `init` / `new` / `adopt`

```bash
npx un-specweaver init [dir] [--agents <ids>] [--lang es|en]
  [--engram-scope project|global] [--graphify auto|off]
  [--dry-run] [--yes] [--force] [--prune-extra] [--keep-vendor-commands]
  [--only <pasos>] [--skip <pasos>] [--keep-going]
```

- `new` equivale a `init --yes`; `adopt` equivale a `init --yes --force`.
- `--agents`: cuales configurar (por defecto los autodetectados).
- `--engram-scope project|global`: memoria aislada por proyecto o una sola para todo.
- `--graphify auto|off`: usar el mapa del codigo si esta instalado.
- `--prune-extra`: poda tambien los opcionales (el SDD queda unico dueno de los tests).
- `--keep-vendor-commands`: conserva `/sdd-*` y `/opsx:*` (por defecto se ocultan).
- `--only` / `--skip`: pasos coma-separados; `--keep-going` no se detiene en el primer fallo.
- `--dry-run` seguis leyendo abajo: imprime el plan exacto sin ejecutar nada.

**`--dry-run` imprime el plan exacto** — cada comando, cada archivo, cada borrado — sin ejecutar
nada. El plan y la ejecucion salen del mismo codigo, asi que no puede mentir.

### `update`

```bash
npx un-specweaver update [dir] [--agents <ids>] [--lang es|en] [--vendors] [--dry-run]
```

Reconcilia comandos `/sw:*`, skills y `.gitignore` sin tocar arquitectura ni especificaciones.
`--vendors` reconcilia tambien dependencias upstream (BMAD, OpenSpec, Gentle-AI).

### `doctor`

```bash
npx un-specweaver doctor [dir] [--fix] [--lang es|en]
```

Revisa salud, pasos pendientes y drift de vendors. `--fix` corre `init --yes` primero y
despues reporta. Pensado para CI: sale **0** si esta todo bien y **1** si hay deriva de
vendors o pasos que bloquean la planeacion.

```bash
npx un-specweaver doctor || echo "proyecto enfermo"
```

### `bridge`

```bash
npx un-specweaver bridge [epics.md] [--out <dir>] [--only 1.2] [--epic 1]
  [--dry-run] [--force] [--strict] [--lang es|en] [--normative shall|debe]
```

Convierte stories de BMAD en changes de OpenSpec, deterministico: mismo `epics.md`, mismo
output, siempre. Sin ruta busca `epics.md` solo (config de BMAD incluida); si hay varios te
pide que elijas. Escribe `openspec/changes/e{N}s{M}-<slug>/`, `.un-specweaver/trace.json` y
`.un-specweaver/sprint-plan.md`; omite changes que ya existen salvo `--force`.
`--strict` aborta si el parser emitio avisos. `--normative debe` lee mejor en espanol pero
`openspec validate --strict` lo rechaza (ver Decisiones no obvias).

> `bridge` reenvia sus flags verbatim al puente, asi que **no tiene `--help` propio**:
> `bridge --help` responde `Opcion desconocida` y sale 2.

### `sprint` / `sync` / `build`

```bash
npx un-specweaver sprint [dir]     # olas de trabajo en paralelo desde epics.md
npx un-specweaver sync [dir]       # bridge si hay epics; si no, doctor
npx un-specweaver build [flags]    # valida specs o corre bridge con tus flags
```

- `sprint` sin `epics.md` avisa y sale 0.
- `build` con `epics.md` corre `bridge <epics> [tus flags]` (`--strict` por defecto); sin
  epics valida con `bridge --strict`.

### `change` / `bug` / `ticket`

Atajos que imprimen que hacer en tu agente (`/opsx-propose`, `/sw:ticket`). Siempre salen 0;
el trabajo real pasa en el agente, no en el CLI.

### `context` / `vendors`

```bash
npx un-specweaver context [dir]    # artefactos a cargar antes de diseñar o construir
npx un-specweaver vendors          # pin actual: bmad, openspec, gentle
```

- `context` lista briefs, PRDs, arquitectura, disenos UX y epics; sin artefactos te manda a
  `/sw:new`.
- Para subir un vendor: edita `src/vendors.json`, publica, y `doctor` reporta el drift.

### `dashboard` / `ui`

```bash
npx un-specweaver dashboard [--port 3100] [--host 127.0.0.1] [--open | --no-open]
npx un-specweaver ui --port 3200 --open
```

Inicia el servidor en puerto libre (default 3100, reintenta hasta 10), sirve la SPA en `/`.
`--port 0` pide puerto efimero; `--open` abre el navegador sin bloquear (`--no-open` por
defecto). `--help` / `-h` y `--version` / `-v` tambien valen aqui.

### Codigos de salida

| Codigo | Cuando |
|---|---|
| 0 | todo bien — incluye `--version`, `<comando> --help`, `dashboard --help` y `sprint` sin epics |
| 1 | `doctor` con deriva o bloqueo; `bridge --strict` con avisos o ciclos; `dashboard` que no arranca; `--help` sin comando |
| 2 | comando o flag desconocido — incluye `bridge --help` |

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

El detalle de la tercera regla. Tres memorias solapadas (BMAD + Engram + graphify) gastan tokens y se contradicen.
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
