import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel, MarkerType } from '@xyflow/react';
// Fuente unica compartida con el CLI standalone (bin/un-specweaver.mjs) y con render.mjs
// (dashboard server) — antes cada uno tenia su propia copia a mano del mismo objeto (hallazgo
// de la revision nativa sobre 415c4d8). Este modulo no tiene imports de Node (fs/path), a
// diferencia de render.mjs, para que Vite lo pueda empaquetar sin problema para el navegador.
import { DIAGRAM_TYPE_LABELS } from '../../../status/diagram-labels.mjs';

const GROUP_COLORS = ['--accent-cyan', '--accent-purple', '--accent-green', '--accent-amber', '--accent-rose'];
// Canvas (MiniMap) can't resolve CSS custom properties, so it needs literal
// hex values — same tradeoff ArchitectureFlow's own MiniMap already makes.
const GROUP_COLORS_HEX = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f43f5e'];

function colorForGroup(group, groupOrder) {
  const idx = groupOrder.indexOf(group);
  const varName = GROUP_COLORS[idx % GROUP_COLORS.length];
  return `var(${varName})`;
}

function hexColorForGroup(group, groupOrder) {
  const idx = groupOrder.indexOf(group);
  return GROUP_COLORS_HEX[idx % GROUP_COLORS_HEX.length];
}

// Graphify's JSON carries no positions, so nodes are laid out on a simple
// deterministic grid: one column per `group` (computed server-side by
// classifyDiagramType(), grouping by kind/top-level-directory/directory/community
// depending on the classified diagramType), stacked rows within it — mirrors
// ArchitectureFlow's own wave-column layout, no extra layout dep.
function layoutGraph(archGraph) {
  const groupOrder = Array.from(new Set(archGraph.nodes.map((n) => n.group || 'other')));
  const colIndex = new Map(groupOrder.map((g, i) => [g, i]));
  const rowCount = new Map();

  const nodes = archGraph.nodes.map((n) => {
    const group = n.group || 'other';
    const col = colIndex.get(group) || 0;
    const row = rowCount.get(group) || 0;
    rowCount.set(group, row + 1);
    const color = colorForGroup(group, groupOrder);
    return {
      id: n.id,
      position: { x: col * 260 + 60, y: row * 90 + 60 },
      data: { label: n.label },
      style: {
        background: 'var(--bg-card)',
        border: `1px solid ${color}`,
        color: 'var(--text-primary)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 12,
        minWidth: 140,
      },
    };
  });

  const edges = archGraph.edges.map((e, i) => ({
    id: `ae-${i}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 12, height: 12 },
    style: { stroke: '#64748b' },
  }));

  return { nodes, edges, groupOrder };
}

export default function ArchitectureTab({ projectId }) {
  const [archGraph, setArchGraph] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArchGraph(data.archGraph || null);
    } catch (err) {
      console.error('Error fetching architecture data:', err);
      setError('No se pudo cargar el grafo de arquitectura.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const layout = useMemo(() => {
    if (!archGraph || !archGraph.nodes?.length) return null;
    return layoutGraph(archGraph);
  }, [archGraph]);

  if (!projectId) {
    return <div className="progress-view progress-empty">Selecciona un proyecto para ver su arquitectura.</div>;
  }
  if (loading && !archGraph) {
    return <div className="progress-view progress-empty">Cargando arquitectura…</div>;
  }
  if (error) {
    return <div className="progress-view progress-empty">{error}</div>;
  }
  if (!layout) {
    return (
      <div className="progress-view progress-empty">
        Sin grafo de arquitectura disponible (requiere graphify-out/graph.json).
      </div>
    );
  }

  return (
    <div className="canvas-container">
      <ReactFlow
        nodes={layout.nodes}
        edges={layout.edges}
        fitView
        // Kept for general breathing room; empirically confirmed (see
        // odd/tasks/plan-minimap-overlap.md) that this padding value has no
        // measurable effect on the MiniMap/node overlap below — that's
        // fixed by MiniMap's own smaller `style` size, not this.
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background color="#1e293b" gap={20} size={1.5} />
        <Controls showInteractive={false} position="bottom-right" />
        <Panel position="top-left" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          {DIAGRAM_TYPE_LABELS[archGraph.diagramType] || 'Diagrama de arquitectura'}
        </Panel>
        <MiniMap
          nodeColor={(n) => hexColorForGroup(archGraph.nodes.find((x) => x.id === n.id)?.group || 'other', layout.groupOrder)}
          nodeStrokeWidth={2}
          position="bottom-left"
          style={{ width: 100, height: 75 }}
        />
      </ReactFlow>
    </div>
  );
}
