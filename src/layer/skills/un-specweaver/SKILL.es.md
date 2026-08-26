---
name: un-specweaver
description: "Flujo de desarrollo dirigido por especificacion que une BMAD (planeacion) con OpenSpec/SDD (ejecucion). Usar al arrancar un proyecto, al adoptar uno existente, al procesar requerimientos o tickets nuevos, al planear sprints y al construir."
---

# un-specweaver

Une la mitad de planeacion de **BMAD METHOD** con la mitad de ejecucion de **OpenSpec / SDD**.
El puente entre ambos es deterministico: no lo improvises, ejecutalo.

## Comandos

| Comando | Cuando |
|---|---|
| `/sw:new` | proyecto desde cero |
| `/sw:adopt` | proyecto que ya existe |
| `/sw:change "<req>"` | requerimiento nuevo: cambia lo acordado, **pasa por control de alcance** |
| `/sw:bug "<defecto>"` | defecto: lo acordado esta bien, la implementacion no lo cumple |
| `/sw:ticket <n>` | issue de GitHub: clasifica y enruta a uno de los dos anteriores |
| `/sw:sprint` | repartir trabajo segun dependencias reales |
| `/sw:build <change-id>` | construir un change |
| `/sw:sync` | actualizar vendors de forma controlada |
| `/sw:doctor` | diagnostico del entorno y del flujo |

En OpenCode los mismos comandos son `/sw-new`, `/sw-change`, etc.
Si el usuario describe una de esas situaciones sin invocar el comando, sugierelo.

## Defecto y requerimiento son dos flujos, no uno

La diferencia no es de tamaño ni de urgencia:

- **Defecto** — el spec dice lo correcto, la implementacion no lo cumple. No toca el PRD.
  **No pasa por control de alcance**: lo acordado no cambia.
- **Requerimiento** — el spec no contempla el caso. Cambia lo acordado, asi que **si** pasa
  por control de alcance antes de tocar un archivo.

Ante la duda, tratalo como requerimiento: pasar por control de alcance de mas cuesta una
conversacion; saltarselo de menos mete comportamiento nuevo sin que nadie lo apruebe.

## Regla de frontera

BMAD **termina en la story**. De ahi en adelante el contrato es el spec de OpenSpec, y la
construccion se hace contra el. Las fases del SDD de Gentle-AI no se usan: rehacen el trabajo
que BMAD ya hizo antes y con mas profundidad (epicas, historias, criterios, cobertura de FR).

Lo que **si** se usa de Gentle-AI son sus skills, que no tienen ceremonia: `judgment-day`
(revision adversarial), `work-unit-commits`, `branch-pr`, `chained-pr`, y los subagentes
`review-readability` / `review-reliability` / `review-resilience` / `review-risk`.
Se invocan pidiendolos en lenguaje normal.
`bmad-agent-dev`, `bmad-build`, `bmad-build-auto` y `bmad-spec` estan podados en esta
instalacion a proposito. Si no los encuentras, no es un error: no busques agentes
desarrolladores de BMAD ni uses `bmad-spec` en lugar de OpenSpec.

## Fuente de verdad por tipo de dato

Antes de buscar algo, sabe donde vive. No dupliques entre capas.

| Dato | Donde vive | No lo busques en |
|---|---|---|
| Intencion de producto (el *que* de negocio) | `_bmad-output/` (PRD, epics) | los specs |
| Contrato de comportamiento (el *que* tecnico) | `openspec/specs/` | el PRD |
| Decisiones y rationale (el *por que*) | Engram **si existe**, si no `design.md` | los docs |
| Estructura del codigo (el *donde*) | grafo de graphify **si existe** | leyendo archivos a ciegas |
| Trazabilidad FR ↔ story ↔ change | `.un-specweaver/trace.json` | ningun otro lado |
| Arquitectura de la organizacion | `docs/architecture-base.md` | inventarla |

Carga `docs/architecture-base.md` en cualquier fase de diseno o construccion: manda sobre
cualquier default que asumirias.

## Reglas que aplican a todo el flujo

1. **Los specs son derivados.** Se regeneran desde `_bmad-output/epics.md` con
   `npx un-specweaver bridge`, no se editan a mano. Si un spec esta mal, el epics.md esta mal.
2. **El alcance se controla antes de tocar archivos**, no despues. Ver `/sw:change`.
3. **Un desarrollador, un change a la vez.** Las stories estan dimensionadas para eso.
4. **Los `#### Scenario:` del spec son los casos de prueba.** No inventes criterios nuevos
   durante la construccion.

## Las preferencias del proyecto mandan

`.un-specweaver/config.json` guarda lo que el usuario eligio al inicializar:

```json
"preferences": { "lang": "es", "engramScope": "project", "graphify": "auto" }
```

**Leelas antes de decidir por tu cuenta.** Si `graphify` es `"off"`, no lo uses aunque este
instalado. Si `engramScope` es `"global"`, la memoria se comparte con los otros proyectos del
usuario y conviene decirlo antes de guardar algo sensible. Nunca preguntes estas cosas en una
conversacion: ya estan decididas, y se cambian con `npx un-specweaver init --graphify off`.

## Capacidades opcionales

**graphify** se detecta, no se instala. Si `graphify-out/graph.json` existe, consultalo en vez de
leer archivos a ciegas. Si la skill esta pero no hay grafo, ofrece construirlo. Si no esta, sigue
sin el y **dilo** — el fallo grave es invocarlo, que no pase nada, y seguir como si tuvieras el mapa.
`npx un-specweaver doctor` reporta si esta disponible y donde. Puede estar en Claude Code y no en OpenCode.

**Engram** lo instala Gentle-AI, pero puede quedar bloqueado por la confianza de Homebrew.
Si `engram` no esta en PATH, escribe el rationale en `design.md` del change bajo `## Decisions`
y dilo. Nunca lo pierdas en silencio.

**uv** (Python) lo usa BMAD para resolver su configuracion. Si falta, las skills traen fallback
manual: es mas lento, no es un error.

## Limite conocido

El plan de sprint asume que los epics son independientes. Una dependencia entre epics que no
este escrita en el texto de la story no aparece en las olas. Verificala a mano contra
`trace.json` antes de repartir trabajo en paralelo.
