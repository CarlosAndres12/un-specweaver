/**
 * Barrel for dashboard.
 * ESM strict — re-exports public API for Story 1.1 + 1.3 + 2.1 + 2.2 + 2.3.
 */

export {
  getStoreDir,
  getProjectsFilePath,
  ProjectManagerError,
  withLock,
  _resetLockForTests,
  detectSpecDir,
  canonicalPath,
  writeAtomic,
  writeAtomicSync,
  registerProject,
  listProjects,
  getProject,
  setActiveProject,
  touchLastActive,
} from './project-manager.mjs';

export { createServer, start } from './server.mjs';

export {
  ALLOWED_COMMANDS,
  createExecutionId,
  runCommand,
  getExecution,
  getStream,
  listExecutions,
  killAll,
  attachClient,
  detachClient,
  subscribe,
  sendInput,
  _resetForTests as _resetRunnerForTests,
  _getExecutionsMap,
} from './command-runner.mjs';

export { compileDiagram, mapStateToWorkflow, mapStateToLifecycle } from './archify-bridge.mjs';

export {
  getEpicsState,
  getSprintState,
  getDoctorState,
  getGitState,
  getConsolidatedState,
  emitChangeForProject,
  planSprintForProject,
} from './state-adapter.mjs';

export {
  createWatcher,
  closeWatcher,
  closeAllWatchers,
  getWatcher,
  DEBOUNCE_MS,
  ECHO_WINDOW_MS,
  recentWrites,
  computeHash,
  registerRecentWrite,
  clearRecentWrites,
  shouldSuppress,
} from './watcher.mjs';
