import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { X, Trash2, Terminal as TermIcon } from 'lucide-react';

export default function TerminalDrawer({
  isOpen,
  onClose,
  activeCommand,
}) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!termRef.current) {
      const term = new Terminal({
        theme: {
          background: '#090d16',
          foreground: '#f8fafc',
          cursor: '#38bdf8',
          selectionBackground: 'rgba(56, 189, 248, 0.3)',
          black: '#0f172a',
          red: '#f43f5e',
          green: '#34d399',
          yellow: '#fbbf24',
          blue: '#38bdf8',
          magenta: '#818cf8',
          cyan: '#22d3ee',
          white: '#f8fafc',
        },
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12.5,
        lineHeight: 1.3,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      term.writeln('\x1b[1;36mun-specweaver Terminal Drawer\x1b[0m — listo.');

      termRef.current = term;
      fitAddonRef.current = fitAddon;
    }
  }, []);

  useEffect(() => {
    if (isOpen && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
        } catch {}
      }, 100);
    }
  }, [isOpen]);

  const handleClear = () => {
    if (termRef.current) {
      termRef.current.clear();
    }
  };

  return (
    <div className={`terminal-drawer ${!isOpen ? 'closed' : ''}`}>
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TermIcon size={14} color="#38bdf8" />
          <span>Consola Integrada {activeCommand ? `— ${activeCommand}` : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button className="btn-icon" style={{ width: '26px', height: '26px' }} onClick={handleClear} title="Limpiar terminal">
            <Trash2 size={12} />
          </button>
          <button className="btn-icon" style={{ width: '26px', height: '26px' }} onClick={onClose} title="Cerrar terminal">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="terminal-body" ref={containerRef} />
    </div>
  );
}

export function writeToTerminal(text) {
  // Global helper if needed for command runner dispatch
}
