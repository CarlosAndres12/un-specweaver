import React, { useState, useEffect } from 'react';
import { X, Hammer, Stethoscope, Save, Edit3, CheckSquare, Layers, FileText } from 'lucide-react';

export default function NodeInspector({
  selectedNode,
  projectId,
  onClose,
  onRunCommand,
  onStoryUpdated,
}) {
  if (!selectedNode) return null;

  const data = selectedNode.data || {};
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.title || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(data.title || '');
    setIsEditing(false);
  }, [selectedNode]);

  const handleSaveTitle = async () => {
    if (!projectId || !data.id) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/graph/nodes/${encodeURIComponent(data.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const resData = await res.json();
      if (resData.ok) {
        setIsEditing(false);
        if (onStoryUpdated) onStoryUpdated();
      }
    } catch (err) {
      console.error('Error saving story:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="inspector-drawer">
      <div className="inspector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="story-node-id" style={{ fontSize: '0.95rem' }}>Story {data.id}</span>
          <span className="story-wave-badge">Ola {data.wave || 1}</span>
        </div>
        <button className="btn-icon" onClick={onClose} title="Cerrar inspector">
          <X size={16} />
        </button>
      </div>

      <div className="inspector-content">
        {/* Title Section */}
        <div className="inspector-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="inspector-section-title">Título</span>
            {!isEditing ? (
              <button
                className="btn-icon"
                style={{ width: '24px', height: '24px' }}
                onClick={() => setIsEditing(true)}
                title="Editar título"
              >
                <Edit3 size={12} />
              </button>
            ) : (
              <button
                className="btn-icon"
                style={{ width: '24px', height: '24px', color: '#34d399' }}
                onClick={handleSaveTitle}
                disabled={isSaving}
                title="Guardar título"
              >
                <Save size={12} />
              </button>
            )}
          </div>

          {!isEditing ? (
            <p style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.3rem', lineHeight: 1.4 }}>
              {title}
            </p>
          ) : (
            <textarea
              style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--accent-cyan)',
                color: 'var(--text-primary)',
                padding: '0.5rem',
                borderRadius: '6px',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                marginTop: '0.3rem',
                resize: 'vertical',
                outline: 'none',
              }}
              rows={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </div>

        {/* Epic & Capability */}
        <div className="inspector-section">
          <span className="inspector-section-title">Epic Asociada</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
            <Layers size={14} color="#818cf8" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{data.epicTitle || `Epic ${data.epic}`}</span>
          </div>
          {data.capability && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
              {data.capability}
            </div>
          )}
        </div>

        {/* Requirements */}
        {data.requirements && data.requirements.length > 0 && (
          <div className="inspector-section">
            <span className="inspector-section-title">Requisitos (FRs)</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
              {data.requirements.map((fr, idx) => (
                <span key={idx} className="fr-badge-count" style={{ fontSize: '0.75rem', padding: '2px 7px' }}>
                  {fr}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Acceptance Criteria */}
        {data.acceptanceCriteria && data.acceptanceCriteria.length > 0 && (
          <div className="inspector-section">
            <span className="inspector-section-title">Criterios de Aceptación ({data.acceptanceCriteria.length})</span>
            <div style={{ marginTop: '0.5rem' }}>
              {data.acceptanceCriteria.map((ac, idx) => (
                <div key={idx} className="criteria-card">
                  {ac.given && (
                    <div style={{ marginBottom: '0.2rem' }}>
                      <span className="criteria-keyword">Given </span>
                      <span>{ac.given}</span>
                    </div>
                  )}
                  {ac.when && (
                    <div style={{ marginBottom: '0.2rem' }}>
                      <span className="criteria-keyword" style={{ color: '#818cf8' }}>When </span>
                      <span>{ac.when}</span>
                    </div>
                  )}
                  {ac.then && (
                    <div>
                      <span className="criteria-keyword" style={{ color: '#34d399' }}>Then </span>
                      <span>{ac.then}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full-Stack Actions */}
        <div className="inspector-section" style={{ marginTop: '2rem' }}>
          <span className="inspector-section-title">Acciones de Construcción</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button
              className="btn-pill primary"
              style={{ justifyContent: 'center', padding: '10px' }}
              onClick={() => onRunCommand && onRunCommand(`build ${data.id}`)}
            >
              <Hammer size={16} />
              <span>Construir Story {data.id} (SDD)</span>
            </button>

            <button
              className="btn-pill"
              style={{ justifyContent: 'center', padding: '8px' }}
              onClick={() => onRunCommand && onRunCommand('doctor')}
            >
              <Stethoscope size={14} />
              <span>Ejecutar Diagnóstico Doctor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
