---
name: build
title: "UB: Construir un change"
description: "Entrega un change de OpenSpec al flujo SDD para implementarlo, verificando primero que sus dependencias esten satisfechas."
allowed-tools: Bash(npx:*), Bash(git:*), Read, Write, Edit, Glob, Grep, Bash
---

# /sw:build — construir un change

El change-id viene en `$ARGUMENTS`. Si viene vacio, muestra la ola actual de
`.un-specweaver/sprint-plan.md` y pregunta cual.

**Esta es la unica fase que escribe codigo de producto.** Las skills constructoras de BMAD estan
podadas de este proyecto a proposito: si buscas `bmad-build` o `bmad-agent-dev` y no aparecen,
no es un error.

## Paso 0 — Verificar que el entorno de construccion esta completo

`npx un-specweaver doctor`. Aqui **si** bloquean los pasos de Gentle-AI (`gentle-bin`,
`gentle-config`): son el SDD que hace la construccion. Si estan en "falta", resuelvelos con
`npx un-specweaver init` antes de seguir.

## Paso 1 — Verificar que se puede empezar

Antes de escribir nada:

1. Busca el change en `.un-specweaver/sprint-plan.md`. Si declara `depende de`, verifica que **cada**
   dependencia este archivada (`openspec/changes/archive/`) o con su `tasks.md` completo.
2. Si una dependencia no esta lista, **detente y dilo**. Construir sobre un spec que todavia
   puede cambiar es trabajo que se va a botar.
3. Lee el change completo: `proposal.md`, `specs/**/spec.md`, `tasks.md`.

## Paso 2 — Cargar el contexto correcto

```
npx un-specweaver context
```

Lista los artefactos que BMAD ya produjo, en sus rutas reales (son fechadas y configurables,
no las adivines). **Cargalos antes de diseñar**:

- **`architecture/ARCHITECTURE-SPINE.md`** — decisiones tecnicas ya tomadas y revisadas.
  **Vinculantes.** El diseño del SDD no las rediscute: las implementa.
- **`ux-designs/DESIGN.md` y `EXPERIENCE.md`** — diseño y experiencia. **Vinculantes**
  para todo lo visual y de interaccion. Los UX-DR que cubre esta story salen de aqui.
- **`epics.md`** — la story de la que salio este change, con sus criterios completos.
- **`prds/prd.md`** — solo si necesitas el porque de un requisito.

Y ademas:

- **`docs/architecture-base.md`** — restricciones de la organizacion; manda sobre cualquier
  default que asumirias, y sobre el ARCHITECTURE-SPINE si se contradicen (dilo si pasa).
- el mapa del codigo, **si esta disponible** (ver abajo)
- Engram para decisiones previas relacionadas, **si esta disponible** (ver abajo)

Saltarse los artefactos de planeacion es el desperdicio mas caro de este flujo: significa
rediseñar desde cero lo que ya se decidio, se reviso y se aprobo.

## Mapa del codigo (graphify)

graphify es **opcional**. Resuelve en este orden y **di cual rama tomaste**:

0. **Lee `.un-specweaver/config.json`.** Si `preferences.graphify` es `"off"`, el usuario decidio
   no usarlo: salta a la rama 3 aunque este instalado. La preferencia manda sobre la deteccion.

1. **Existe `graphify-out/graph.json`** → consultalo con `/graphify query "<pregunta>"`.
   No leas archivos a ciegas cuando hay grafo.
2. **Existe la skill graphify pero no hay grafo** → ofrece construirlo con `/graphify .`
   antes de seguir. En repos grandes tarda, asi que pregunta en vez de asumir.
3. **No existe ninguno** → sigue con exploracion normal (Glob/Grep/Read) y **avisa
   explicitamente que el mapa va a ser menos confiable**.

El unico error grave aqui es el silencioso: invocar `/graphify`, que no pase nada, y seguir
como si tuvieras el mapa. `npx un-specweaver doctor` reporta si esta disponible y donde.

Nota: la skill suele vivir en `~/.claude/skills/`, asi que puede estar en Claude Code y no en
OpenCode. Verifica en el agente donde estas corriendo, no asumas.

## Paso 3 — Construir contra el spec

**Esta es la unica fase que escribe codigo de producto.** Construis vos, aqui, contra el
contrato que ya existe. No hay fases intermedias que orquestar.

El spec **es** la especificacion. Cada `#### Scenario:` de `specs/**/spec.md` es un caso de
prueba que tiene que tener un test que lo ejerza. `tasks.md` es el checklist.

1. Implementa cada tarea de `tasks.md` respetando las restricciones del Paso 2.
2. Escribi el test de cada escenario. Un escenario sin test es un requisito sin verificar.
3. **No inventes criterios nuevos.** Si algo falta, falta en el spec, y eso se arregla por
   `/sw:change`, no aqui.
4. Si el change necesita decisiones tecnicas de fondo — patron nuevo, dependencia externa,
   migracion, cosa que atraviesa modulos — escribi `design.md` en la carpeta del change antes
   de programar. **Solo si aplica**: OpenSpec lo pide condicional, no por defecto.

### Skills de Gentle-AI que ayudan aqui

Se invocan pidiendolas en lenguaje normal, sin ceremonia:

- **`work-unit-commits`** — agrupa los cambios en commits revisables en vez de un mamotreto
- **`judgment-day`** — revision adversarial con dos jueces que se contradicen
- los subagentes **`review-readability`**, **`review-reliability`**, **`review-resilience`**,
  **`review-risk`** — cada uno mira con un lente distinto
- **`branch-pr`** / **`chained-pr`** — PRs con chequeo de issue; parte los de mas de 400 lineas

Ofrecelas al cerrar, no las impongas.

## Paso 4 — Cerrar

1. Marca las casillas de `tasks.md` que quedaron hechas de verdad
2. `npx @fission-ai/openspec validate --all --strict`
3. Registra las decisiones de implementacion que no son obvias desde el codigo (ver "Memoria" abajo)
4. `openspec archive <change-id>` cuando este entregado — eso mueve el delta al spec principal

## Memoria de decisiones (Engram)

Engram es **opcional**. `npx un-specweaver doctor` dice si esta disponible, y
`.un-specweaver/config.json` dice con que alcance: `preferences.engramScope` en `"project"`
significa que este proyecto no ve la memoria de los demas; en `"global"`, la comparte.
Si guardas algo sensible de un cliente y el alcance es global, **dilo antes de guardarlo**.

- **Si `engram` esta en PATH** → guarda ahi la decision y su razon.
- **Si no esta** → escribela igual, en `design.md` del change bajo `## Decisions`, y **avisa
  al usuario** que se guardo ahi porque Engram no esta instalado.

Lo que no se vale es invocar Engram, que no pase nada, y perder el rationale en silencio.
Un "por que" que no quedo escrito en ningun lado se pierde igual que si nunca se hubiera pensado.

## Frontera

Un change a la vez. Si aparece algo fuera del alcance del change mientras construyes,
**no lo metas aqui**: anotalo y sacalo por `/sw:change`. Un change que crece a mitad de
construccion es un change que ya no corresponde a su spec.
