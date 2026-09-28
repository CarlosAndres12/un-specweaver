// Etiquetas legibles para archGraph.diagramType (ver classifyDiagramType() en render.mjs:
// 'component' | 'package' | 'c4-container'). Modulo minimo, sin imports de Node (fs/path,
// a diferencia de render.mjs), a proposito: asi lo puede importar tanto el lado Node (CLI
// standalone en bin/un-specweaver.mjs, y render.mjs por re-export) como el frontend
// empaquetado con Vite (ArchitectureTab.jsx) sin arrastrar dependencias de Node al bundle
// del navegador. Antes de este modulo, el mismo objeto estaba copiado a mano en ambos
// lugares (hallazgo de la revision nativa sobre el commit 415c4d8): esta es la unica fuente
// de verdad ahora.
export const DIAGRAM_TYPE_LABELS = {
  component: 'Diagrama de componentes',
  package: 'Diagrama de paquetes',
  'c4-container': 'Diagrama de contenedores (C4)',
};
