import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun,
  Moon,
  Terminal as TermIcon,
  GitBranch,
  Activity,
  FolderOpen,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import ArchitectureFlow from './components/canvas/ArchitectureFlow.jsx';
import NodeInspector from './components/inspector/NodeInspector.jsx';
import TerminalDrawer from './components/terminal/TerminalDrawer.jsx';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [stateData, setStateData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [activeCommand, setActiveCommand] = useState(null);

  // Sync theme class to document.body
  useEffect(() => {
    document.body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
  }, [theme]);

  // Fetch projects list
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data = await res.json();
      setProjects(data.projects || []);
      if (data.activeProjectId) {
        setActiveProjectId(data.activeProjectId);
        const p = (data.projects || []).find((x) => x.id === data.activeProjectId);
        setActiveProject(p || null);
      } else if (data.projects && data.projects.length > 0) {
        setActiveProjectId(data.projects[0].id);
        setActiveProject(data.projects[0]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, []);

  // Fetch active project graph data (React Flow nodes/edges)
  const fetchGraphData = useCallback(async (projId = activeProjectId) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projId)}/graph`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (err) {
      console.error('Error fetching graph data:', err);
    }
  }, [activeProjectId]);

  // Fetch active project consolidated state (git, doctor, epics)
  const fetchStateData = useCallback(async (projId = activeProjectId) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projId)}/state`);
      if (res.ok) {
        const data = await res.json();
        setStateData(data);
      }
    } catch (err) {
      console.error('Error fetching state data:', err);
    }
  }, [activeProjectId]);

  // Initial load
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // When activeProjectId changes, fetch graph and state
  useEffect(() => {
    if (activeProjectId) {
      fetchGraphData(activeProjectId);
      fetchStateData(activeProjectId);
    }
  }, [activeProjectId, fetchGraphData, fetchStateData]);

  // SSE real-time listener (Code-to-Visual synchronization)
  useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('FS_CHANGE', (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (!activeProjectId || payload.projectId === activeProjectId) {
          fetchGraphData(activeProjectId);
          fetchStateData(activeProjectId);
        }
      } catch {}
    });

    es.addEventListener('graph_updated', (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (!activeProjectId || payload.projectId === activeProjectId) {
          fetchGraphData(activeProjectId);
          fetchStateData(activeProjectId);
        }
      } catch {}
    });

    return () => {
      es.close();
    };
  }, [activeProjectId, fetchGraphData, fetchStateData]);

  // Switch active project
  const handleSelectProject = async (newId) => {
    setActiveProjectId(newId);
    const p = projects.find((x) => x.id === newId);
    setActiveProject(p || null);
    setSelectedNode(null);
    try {
      await fetch(`/api/projects/${encodeURIComponent(newId)}/active`, { method: 'POST' });
    } catch {}
  };

  // Run command from inspector or top bar
  const handleRunCommand = async (cmd) => {
    if (!activeProjectId) return;
    setIsTerminalOpen(true);
    setActiveCommand(cmd);
    try {
      await fetch(`/api/projects/${encodeURIComponent(activeProjectId)}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
    } catch (err) {
      console.error('Error running command:', err);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="top-header">
        <div className="brand-section">
          <div className="brand-logo">S</div>
          <div className="brand-title">
            <span>un-specweaver</span>
            <span className="badge-version">v0.1.1</span>
          </div>

          <div className="project-select-container">
            <FolderOpen size={14} color="#38bdf8" />
            <select
              className="project-select"
              value={activeProjectId || ''}
              onChange={(e) => handleSelectProject(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Project Health & Git Status */}
        <div className="header-status-group">
          {stateData?.git && (
            <div className="status-pill">
              <GitBranch size={12} />
              <span>{stateData.git.branch || 'main'}</span>
              <span className={`status-dot ${stateData.git.dirty ? 'amber' : 'green'}`} />
            </div>
          )}

          {stateData?.doctor && (
            <div className="status-pill">
              <Activity size={12} />
              <span>Doctor</span>
              <span className={`status-dot ${stateData.doctor.ok ? 'green' : 'amber'}`} />
            </div>
          )}

          {graphData && (
            <div className="status-pill">
              <span>{graphData.nodes?.length || 0} Stories</span>
              <span style={{ color: '#64748b' }}>•</span>
              <span>{graphData.waves?.length || 0} Olas</span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className="btn-pill"
            onClick={() => setIsTerminalOpen((v) => !v)}
            title="Abrir / Cerrar Terminal Drawer (Ctrl+~)"
          >
            <TermIcon size={14} />
            <span>Terminal</span>
          </button>
        </div>
      </header>

      {/* Main Canvas Viewport */}
      <ArchitectureFlow
        projectId={activeProjectId}
        graphData={graphData}
        onNodeSelect={(node) => setSelectedNode(node)}
        onRefresh={() => {
          fetchGraphData(activeProjectId);
          fetchStateData(activeProjectId);
        }}
        theme={theme}
      />

      {/* Contextual Node Inspector Drawer */}
      <NodeInspector
        selectedNode={selectedNode}
        projectId={activeProjectId}
        onClose={() => setSelectedNode(null)}
        onRunCommand={handleRunCommand}
        onStoryUpdated={() => {
          fetchGraphData(activeProjectId);
          fetchStateData(activeProjectId);
        }}
      />

      {/* Terminal Drawer (xterm.js) */}
      <TerminalDrawer
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        activeCommand={activeCommand}
      />
    </div>
  );
}
