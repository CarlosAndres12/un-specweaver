import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, FileCode2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

function StoryNode({ data, selected }) {
  const {
    id,
    title,
    status = 'pendiente',
    wave = 1,
    requirements = [],
    acceptanceCriteria = [],
  } = data;

  const getStatusIcon = () => {
    switch (status) {
      case 'completada':
        return <CheckCircle2 size={13} className="text-emerald-400" color="#34d399" />;
      case 'en_progreso':
        return <Clock size={13} className="text-sky-400" color="#38bdf8" />;
      default:
        return <AlertCircle size={13} className="text-slate-400" color="#94a3b8" />;
    }
  };

  return (
    <div className={`story-node ${selected ? 'selected' : ''}`}>
      {/* Input Handle (Target - what this story depends on) */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="custom-handle"
      />

      <div className="story-node-header">
        <span className="story-node-id">Story {id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="story-wave-badge">Ola {wave}</span>
          {getStatusIcon()}
        </div>
      </div>

      <div className="story-node-body">
        <div className="story-node-title" title={title}>
          {title}
        </div>

        <div className="story-node-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileCode2 size={12} color="#64748b" />
            <span>{acceptanceCriteria.length} AC</span>
          </div>

          {requirements.length > 0 && (
            <span className="fr-badge-count">
              {requirements.length} FR
            </span>
          )}
        </div>
      </div>

      {/* Output Handle (Source - stories that depend on this story) */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="custom-handle"
      />
    </div>
  );
}

export default memo(StoryNode);
