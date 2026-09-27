import React, { useState, useEffect, useCallback } from 'react';

const PHASE_LABELS = {
  understand: 'Entender',
  decide: 'Decidir',
  decompose: 'Descomponer',
  translate: 'Traducir',
  build: 'Construir',
  close: 'Cerrar',
};

function MetricTile({ label, value, sub }) {
  return (
    <div className="metric-tile">
      <div className="metric-tile-value">{value}</div>
      <div className="metric-tile-label">{label}</div>
      {sub != null && <div className="metric-tile-sub">{sub}</div>}
    </div>
  );
}

function PhaseStep({ phase }) {
  const status = phase.done ? 'done' : phase.partial ? 'partial' : 'pending';
  return (
    <div className={`phase-step ${status}`}>
      <div className="phase-step-dot">{phase.n}</div>
      <div className="phase-step-label">{PHASE_LABELS[phase.key] || phase.key}</div>
    </div>
  );
}

export default function ProgressTab({ projectId }) {
  const [model, setModel] = useState(null);
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
      setModel(data.model || null);
    } catch (err) {
      console.error('Error fetching status data:', err);
      setError('No se pudo cargar el progreso del proyecto.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (!projectId) {
    return <div className="progress-view progress-empty">Selecciona un proyecto para ver su progreso.</div>;
  }
  if (loading && !model) {
    return <div className="progress-view progress-empty">Cargando progreso…</div>;
  }
  if (error) {
    return <div className="progress-view progress-empty">{error}</div>;
  }
  if (!model) {
    return <div className="progress-view progress-empty">Sin datos de progreso disponibles.</div>;
  }

  const { metrics, phases, requirements, decisions, sprint, project } = model;

  return (
    <div className="progress-view">
      <div className="progress-header">
        <h2>{project.name}</h2>
        <span className="progress-generated">
          Actualizado {new Date(model.generatedAt).toLocaleString()}
        </span>
      </div>

      <div className="metric-tiles">
        <MetricTile
          label="Requisitos cubiertos"
          value={metrics.requirements.coveragePct != null ? `${metrics.requirements.coveragePct}%` : '—'}
          sub={`${metrics.requirements.covered}/${metrics.requirements.fr} FR`}
        />
        <MetricTile
          label="Requisitos terminados"
          value={metrics.requirements.donePct != null ? `${metrics.requirements.donePct}%` : '—'}
        />
        <MetricTile
          label="Stories"
          value={`${metrics.storiesDone}/${metrics.stories}`}
          sub={metrics.storiesPct != null ? `${metrics.storiesPct}%` : null}
        />
        <MetricTile
          label="Tareas"
          value={`${metrics.tasks.done}/${metrics.tasks.total}`}
          sub={metrics.tasksPct != null ? `${metrics.tasksPct}%` : null}
        />
        <MetricTile
          label="Cambios activos"
          value={metrics.changes.active}
          sub={`${metrics.changes.archived} archivados`}
        />
      </div>

      <section className="progress-section">
        <h3>Fases</h3>
        <div className="phase-stepper">
          {(phases || []).map((p) => (
            <PhaseStep key={p.n} phase={p} />
          ))}
        </div>
      </section>

      {sprint && (
        <section className="progress-section">
          <h3>Sprint</h3>
          <div className="metric-tiles">
            <MetricTile label="Olas" value={sprint.waves.length} />
            <MetricTile label="Ola actual" value={sprint.current ?? '—'} />
            <MetricTile label="Listas" value={sprint.totals.ready} />
            <MetricTile label="En progreso" value={sprint.totals.inProgress} />
            <MetricTile label="Archivadas" value={sprint.totals.archived} />
          </div>
        </section>
      )}

      <section className="progress-section">
        <h3>Requisitos</h3>
        <div className="metric-tiles">
          <MetricTile label="Funcionales" value={metrics.requirements.fr} />
          <MetricTile label="No funcionales" value={metrics.requirements.nfr} />
          <MetricTile label="UX" value={metrics.requirements.ux} />
          <MetricTile label="Inestables" value={metrics.requirements.unstable} />
        </div>
        {requirements?.orphans?.length > 0 && (
          <div className="progress-orphans">
            <span className="progress-orphans-label">Sin story asignada:</span>{' '}
            {requirements.orphans.join(', ')}
          </div>
        )}
      </section>

      <section className="progress-section">
        <h3>Decisiones clave</h3>
        {decisions?.key?.length ? (
          <ul className="decision-list">
            {decisions.key.slice(0, 10).map((d, i) => (
              <li key={i} className={`decision-item decision-${d.type}`}>
                <span className="decision-type">{d.type}</span>
                <span className="decision-text">{d.text}</span>
                {d.date && <span className="decision-date">{d.date}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="progress-empty-inline">Sin decisiones registradas todavía.</p>
        )}
      </section>
    </div>
  );
}
