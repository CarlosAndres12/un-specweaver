import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, MarkerType } from '@xyflow/react';

const KIND_COLORS = ['--accent-cyan', '--accent-purple', '--accent-green', '--accent-amber', '--accent-rose'];
// Canvas (MiniMap) can't resolve CSS custom properties, so it needs literal
// hex values — same tradeoff ArchitectureFlow's own MiniMap already makes.
const KIND_COLORS_HEX = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f43f5e'];

function colorForKind(kind, kindOrder) {
  const idx = kindOrder.indexOf(kind);
  const varName = KIND_COLORS[idx % KIND_COLORS.length];
  return `var(${varName})`;
}

function hexColorForKind(kind, kindOrder) {
  const idx = kindOrder.indexOf(kind);
  return KIND_COLORS_HEX[idx % KIND_COLORS_HEX.length];
}

// Graphify's JSON carries no positions, so nodes are laid out on a simple
// deterministic grid: one column per `kind`, stacked rows within it —
// mirrors ArchitectureFlow's own wave-column layout, no extra layout dep.
function layoutGraph(archGraph) {
  const kindOrder = Array.from(new Set(archGraph.nodes.map((n) => n.kind || '')));
  const colIndex = new Map(kindOrder.map((k, i) => [k, i]));
  const rowCount = new Map();

  const nodes = archGraph.nodes.map((n) => {
    const kind = n.kind || '';
    const col = colIndex.get(kind) || 0;
    const row = rowCount.get(kind) || 0;
    rowCount.set(kind, row + 1);
    const color = colorForKind(kind, kindOrder);
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

  return { nodes, edges, kindOrder };
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
        <MiniMap
          nodeColor={(n) => hexColorForKind(archGraph.nodes.find((x) => x.id === n.id)?.kind || '', layout.kindOrder)}
          nodeStrokeWidth={2}
          position="bottom-left"
          style={{ width: 100, height: 75 }}
        />
      </ReactFlow>
    </div>
  );
}
