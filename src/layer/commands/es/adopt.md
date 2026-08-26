---
name: adopt
title: "UB: Adoptar proyecto existente"
description: "Trae un proyecto que ya existe a este flujo: mapea el codigo real, deriva su arquitectura, levanta un PRD brownfield y fija una linea base de specs."
allowed-tools: Bash(npx:*), Bash(git:*), Read, Write, Edit, Glob, Grep
---

# /sw:adopt — proyecto existente

El error tipico es planear sobre lo que **crees** que hace el codigo. Aqui se mapea primero.

## Fase 1 — Mapear lo que existe de verdad

El error tipico de esta fase es planear contra lo que crees que hace el codigo.

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

## Fase 2 — Arquitectura real vs arquitectura declarada

1. Deriva del grafo la arquitectura **real**: capas, fronteras, dependencias, donde vive el dominio.
2. Contrastala contra `docs/architecture-base.md`.
3. **Escribe las diferencias explicitamente.** No las silencies ni las "corrijas" mentalmente.

Cada diferencia es una de tres cosas, y hay que decidir cual antes de seguir:
- deuda tecnica conocida → se documenta y se deja
- la base esta desactualizada → se actualiza `docs/architecture-base.md`
- violacion real → se convierte en un epic de remediacion

## Fase 3 — PRD brownfield

`bmad-document-project` para levantar lo que el sistema hace hoy, y luego `bmad-prd` sobre eso.

Regla: el PRD brownfield describe **lo que existe**, no lo que quisieras que existiera. Lo nuevo
entra despues por `/sw:change`.

## Fase 4 — Linea base de specs

Para cada capability que ya funciona, escribe su spec en `openspec/specs/<capability>/spec.md`
con `## Purpose` y sus `### Requirement:` en presente. Esta linea base es contra lo que
`/sw:change` va a medir el alcance de todo lo que llegue despues; sin ella, el control de
alcance no tiene contra que comparar.

Verifica: `npx @fission-ai/openspec validate --all --strict`

## Fase 5 — De aqui en adelante

El proyecto ya esta en el flujo. Lo nuevo entra por `/sw:change`, los tickets por `/sw:ticket`,
y epics nuevos con `bmad-create-epics-and-stories` + `npx un-specweaver bridge`.
