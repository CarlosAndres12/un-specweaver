import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import { Sparkles, Layers, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import StoryNode from './nodes/StoryNode.jsx';
import DependencyEdge from './edges/DependencyEdge.jsx';

const nodeTypes = {
  storyNode: StoryNode,
};

const edgeTypes = {
  dependencyEdge: DependencyEdge,
};

export default function ArchitectureFlow({
  projectId,
  graphData,
  onNodeSelect,
  onRefresh,
  theme = 'dark',
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedWave, setSelectedWave] = useState('all');
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Auto-layout algorithm: DAG arranged by Wave columns and rank rows
  const applyLayout = useCallback((rawNodes, rawEdges) => {
    const waveGroups = new Map();
    rawNodes.forEach((node) => {
      const wave = node.data?.wave || 1;
      if (!waveGroups.has(wave)) waveGroups.set(wave, []);
      waveGroups.get(wave).push(node);
    });

    const layoutedNodes = [];
    const sortedWaves = Array.from(waveGroups.keys()).sort((a, b) => a - b);

    sortedWaves.forEach((wave, colIdx) => {
      const colNodes = waveGroups.get(wave);
      colNodes.forEach((node, rowIdx) => {
        layoutedNodes.push({
          ...node,
          position: {
            x: colIdx * 340 + 80,
            y: rowIdx * 160 + 60,
          },
        });
      });
    });

    return layoutedNodes;
  }, []);

  // Delete edge handler passed down to custom edge
  const handleDeleteEdge = useCallback(async (edgeId) => {
    if (!projectId) return;

    let targetEdge = null;
    setEdges((eds) => {
      targetEdge = eds.find((e) => e.id === edgeId);
      return eds.filter((e) => e.id !== edgeId);
    });

    if (!targetEdge) return;

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/graph/edges`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: targetEdge.source, target: targetEdge.target }),
      });
      const data = await res.json();
      if (data.ok) {
        showNotification(`Dependencia eliminada`, 'success');
        if (onRefresh) onRefresh();
      } else {
        // Rollback
        setEdges((eds) => [...eds, targetEdge]);
        showNotification(`Error: ${data.message || 'No se pudo eliminar'}`, 'error');
      }
    } catch (err) {
      setEdges((eds) => [...eds, targetEdge]);
      showNotification(`Error de red: ${err.message}`, 'error');
    }
  }, [projectId, onRefresh, setEdges]);

  const prevGraphRef = React.useRef(null);

  // Synchronize graphData from props into React Flow state
  useEffect(() => {
    if (!graphData) return;
    const serialized = JSON.stringify({
      nodes: graphData.nodes?.map((n) => n.id),
      edges: graphData.edges?.map((e) => e.id),
    });
    if (prevGraphRef.current === serialized) return;
    prevGraphRef.current = serialized;

    const rawNodes = (graphData.nodes || []).map((n) => ({
      ...n,
      type: 'storyNode',
    }));

    const rawEdges = (graphData.edges || []).map((e) => ({
      ...e,
      type: 'dependencyEdge',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#38bdf8',
        width: 14,
        height: 14,
      },
      data: {
        ...e.data,
        onDelete: handleDeleteEdge,
      },
    }));

    const positioned = applyLayout(rawNodes, rawEdges);
    setNodes(positioned);
    setEdges(rawEdges);
  }, [graphData, applyLayout, handleDeleteEdge, setNodes, setEdges]);

  // Connect handler: Visual-to-Code mutation!
  const onConnect = useCallback(
    async (connection) => {
      const { source, target } = connection;
      if (!source || !target || source === target || !projectId) return;

      // Optimistic edge addition
      const optimisticEdge = {
        id: `e-${source}-${target}`,
        source,
        target,
        type: 'dependencyEdge',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#38bdf8',
          width: 14,
          height: 14,
        },
        data: {
          onDelete: handleDeleteEdge,
        },
      };

      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/graph/edges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, target, action: 'add' }),
        });
        const data = await res.json();

        if (res.ok && data.ok) {
          setEdges((eds) => addEdge(optimisticEdge, eds));
          showNotification(`Dependencia añadida: Story ${target} depende de Story ${source}`, 'success');
          if (onRefresh) onRefresh();
        } else if (data.code === 'CIRCULAR_DEPENDENCY') {
          showNotification('¡Dependencia rechazada! Generaría un ciclo circular.', 'error');
        } else {
          showNotification(`Error: ${data.message || 'Fallo de mutación'}`, 'error');
        }
      } catch (err) {
        showNotification(`Error de conexión: ${err.message}`, 'error');
      }
    },
    [projectId, handleDeleteEdge, setEdges, onRefresh]
  );

  const handleManualLayout = () => {
    setNodes((currentNodes) => applyLayout(currentNodes, edges));
    showNotification('Disposición jerárquica DAG recalculada');
  };

  // Filter nodes by wave if active
  const displayedNodes = useMemo(() => {
    if (selectedWave === 'all') return nodes;
    return nodes.filter((n) => String(n.data?.wave) === String(selectedWave));
  }, [nodes, selectedWave]);

  return (
    <div className="canvas-container">
      {/* Floating Toolbar */}
      <div className="floating-toolbar">
        <button
          className="btn-pill"
          onClick={handleManualLayout}
          title="Reorganizar nodos automáticamente (DAG)"
        >
          <Sparkles size={14} color="#38bdf8" />
          <span>Auto-Layout</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
          <Layers size={14} color="#94a3b8" />
          <select
            className="project-select"
            value={selectedWave}
            onChange={(e) => setSelectedWave(e.target.value)}
          >
            <option value="all">Todas las Olas</option>
            {(graphData?.waves || []).map((w) => (
              <option key={w.wave} value={w.wave}>
                Ola {w.wave} ({w.stories?.length || 0} stories)
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn-icon"
          onClick={onRefresh}
          title="Refrescar estado desde disco"
          style={{ marginLeft: 'auto' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: notification.type === 'error' ? 'rgba(244, 63, 94, 0.95)' : 'rgba(15, 23, 42, 0.95)',
            border: `1px solid ${notification.type === 'error' ? '#f43f5e' : '#38bdf8'}`,
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {notification.msg}
        </div>
      )}

      {/* React Flow Viewport */}
      <ReactFlow
        nodes={displayedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeSelect && onNodeSelect(node)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'dependencyEdge' }}
      >
        <Background
          color={theme === 'dark' ? '#1e293b' : '#cbd5e1'}
          gap={20}
          size={1.5}
        />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.status === 'completada') return '#34d399';
            if (n.data?.status === 'en_progreso') return '#38bdf8';
            return '#64748b';
          }}
          nodeStrokeWidth={2}
          maskColor={theme === 'dark' ? 'rgba(9, 13, 22, 0.7)' : 'rgba(248, 250, 252, 0.7)'}
          position="bottom-left"
        />
      </ReactFlow>
    </div>
  );
}
