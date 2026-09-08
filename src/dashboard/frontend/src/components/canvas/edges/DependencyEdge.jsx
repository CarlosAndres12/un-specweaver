import React from 'react';
import { BaseEdge, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';
import { X } from 'lucide-react';

export default function DependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const onEdgeClick = (evt) => {
    evt.stopPropagation();
    if (data?.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: '#38bdf8',
          strokeWidth: 2,
          strokeDasharray: '5,5',
          animation: 'dashdraw 0.5s linear infinite',
        }}
      />
      {data?.onDelete && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10,
            }}
          >
            <button
              onClick={onEdgeClick}
              title="Eliminar dependencia"
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f43f5e',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              <X size={10} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
