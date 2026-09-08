import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import * as pm from '../src/dashboard/project-manager.mjs';
import * as stateAdapter from '../src/dashboard/state-adapter.mjs';
import { createServer } from '../src/dashboard/server.mjs';

function createTempDir(prefix = 'specweaver-graph-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function requestJson(portOrServer, { method = 'GET', pathname = '/', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const port = typeof portOrServer === 'number'
      ? portOrServer
      : (portOrServer.port || (portOrServer.server && portOrServer.server.address().port) || portOrServer.address().port);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      Accept: 'application/json',
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: json, text: raw });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('Story 8.2 & 8.3 — getGraphData returns React Flow nodes and edges', async () => {
  const tmp = createTempDir();
  const epicsDir = path.join(tmp, '_bmad-output/planning-artifacts');
  fs.mkdirSync(epicsDir, { recursive: true });
  const epicsFile = path.join(epicsDir, 'epics.md');

  const sampleEpics = `
## Epic 1: Fundacion

### Story 1.1: Primera historia

**Description:** Desc 1.1
**FRs:** FR-001
**Acceptance Criteria:**
- **Given** init **When** run **Then** ok

### Story 1.2: Segunda historia

**Description:** Desc 1.2
**FRs:** FR-002
**Depende de:** Story 1.1
**Acceptance Criteria:**
- **Given** step1 **When** step2 **Then** done
`;
  fs.writeFileSync(epicsFile, sampleEpics, 'utf8');

  const graphData = await stateAdapter.getGraphData(tmp);
  assert.ok(Array.isArray(graphData.nodes), 'nodes should be array');
  assert.ok(Array.isArray(graphData.edges), 'edges should be array');

  // Verify node structure
  assert.equal(graphData.nodes.length, 2);
  const node1 = graphData.nodes.find((n) => n.id === '1.1');
  const node2 = graphData.nodes.find((n) => n.id === '1.2');
  assert.ok(node1, 'node 1.1 exists');
  assert.ok(node2, 'node 1.2 exists');
  assert.equal(node1.type, 'storyNode');
  assert.equal(node1.data.title, 'Primera historia');

  // Verify edge structure
  const edge = graphData.edges.find((e) => e.source === '1.1' && e.target === '1.2');
  assert.ok(edge, 'edge 1.1 -> 1.2 exists');
  assert.equal(edge.type, 'dependencyEdge');

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('Story 8.3 — updateGraphEdge mutates epics.md and prevents circular dependencies', async () => {
  const tmp = createTempDir();
  const epicsDir = path.join(tmp, '_bmad-output/planning-artifacts');
  fs.mkdirSync(epicsDir, { recursive: true });
  const epicsFile = path.join(epicsDir, 'epics.md');

  const sampleEpics = `
## Epic 1: Test

### Story 1.1: Alpha

**Description:** Alpha desc

### Story 1.2: Beta

**Description:** Beta desc

### Story 1.3: Gamma

**Description:** Gamma desc
`;
  fs.writeFileSync(epicsFile, sampleEpics, 'utf8');

  // 1. Add edge 1.1 -> 1.2 (1.2 depends on 1.1)
  const res1 = await stateAdapter.updateGraphEdge(tmp, { source: '1.1', target: '1.2', action: 'add' });
  assert.equal(res1.ok, true);

  const updatedContent = fs.readFileSync(epicsFile, 'utf8');
  assert.match(updatedContent, /Story\s+1\.1/);

  // 2. Add edge 1.2 -> 1.3 (1.3 depends on 1.2)
  const res2 = await stateAdapter.updateGraphEdge(tmp, { source: '1.2', target: '1.3', action: 'add' });
  assert.equal(res2.ok, true);

  // 3. Attempt circular dependency 1.3 -> 1.1 (1.1 depends on 1.3, cycle!)
  const resCycle = await stateAdapter.updateGraphEdge(tmp, { source: '1.3', target: '1.1', action: 'add' });
  assert.equal(resCycle.ok, false);
  assert.equal(resCycle.error, 'CIRCULAR_DEPENDENCY');

  // 4. Remove edge 1.1 -> 1.2
  const resRemove = await stateAdapter.updateGraphEdge(tmp, { source: '1.1', target: '1.2', action: 'remove' });
  assert.equal(resRemove.ok, true);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('Story 8.2 & 8.3 — HTTP Endpoints GET /graph and POST /graph/edges', async () => {
  const tmpHome = createTempDir('specweaver-home-');
  const origHome = process.env.HOME;
  process.env.HOME = tmpHome;

  const projectDir = createTempDir('specweaver-proj-');
  const epicsDir = path.join(projectDir, '_bmad-output/planning-artifacts');
  fs.mkdirSync(epicsDir, { recursive: true });
  fs.writeFileSync(
    path.join(epicsDir, 'epics.md'),
    `## Epic 1: Web\n\n### Story 1.1: Init\n\n**Description:** Init\n\n## Epic 2: API\n\n### Story 2.1: Build\n\n**Description:** Build\n`,
    'utf8'
  );

  const reg = await pm.registerProject(projectDir, 'Graph Test Proj');
  const projectId = reg.id;

  const app = createServer({ port: 0 });
  const server = await app.start();

  try {
    // 1. GET /api/projects/:id/graph — initial empty edges across epics
    const getRes = await requestJson(server, {
      method: 'GET',
      pathname: `/api/projects/${projectId}/graph`,
    });
    assert.equal(getRes.status, 200);
    assert.ok(Array.isArray(getRes.body.nodes));
    assert.equal(getRes.body.nodes.length, 2);
    assert.equal(getRes.body.edges.length, 0);

    // 2. POST /api/projects/:id/graph/edges — connect 1.1 -> 2.1
    const postRes = await requestJson(server, {
      method: 'POST',
      pathname: `/api/projects/${projectId}/graph/edges`,
      body: { source: '1.1', target: '2.1', action: 'add' },
    });
    assert.equal(postRes.status, 200);
    assert.equal(postRes.body.ok, true);

    // 3. Verify updated graph has edge
    const getRes2 = await requestJson(server, {
      method: 'GET',
      pathname: `/api/projects/${projectId}/graph`,
    });
    assert.equal(getRes2.body.edges.length, 1);
    assert.equal(getRes2.body.edges[0].source, '1.1');
    assert.equal(getRes2.body.edges[0].target, '2.1');

    // 4. Test Circular Dependency rejection (2.1 -> 1.1 would cycle)
    const cycleRes = await requestJson(server, {
      method: 'POST',
      pathname: `/api/projects/${projectId}/graph/edges`,
      body: { source: '2.1', target: '1.1', action: 'add' },
    });
    assert.equal(cycleRes.status, 400);
    assert.equal(cycleRes.body.code, 'CIRCULAR_DEPENDENCY');

    // 5. Test PATCH /api/projects/:id/graph/nodes/:nodeId
    const patchRes = await requestJson(server, {
      method: 'PATCH',
      pathname: `/api/projects/${projectId}/graph/nodes/1.1`,
      body: { title: 'Init Updated' },
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.ok, true);

    const getRes3 = await requestJson(server, {
      method: 'GET',
      pathname: `/api/projects/${projectId}/graph`,
    });
    const node1Updated = getRes3.body.nodes.find((n) => n.id === '1.1');
    assert.equal(node1Updated.data.title, 'Init Updated');

    // 6. Test DELETE /api/projects/:id/graph/edges
    const delRes = await requestJson(server, {
      method: 'DELETE',
      pathname: `/api/projects/${projectId}/graph/edges`,
      body: { source: '1.1', target: '2.1' },
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.ok, true);

    const getRes4 = await requestJson(server, {
      method: 'GET',
      pathname: `/api/projects/${projectId}/graph`,
    });
    assert.equal(getRes4.body.edges.length, 0);

    // 7. Test Vite SPA and static assets served by server.mjs
    const spaRes = await requestJson(server, {
      method: 'GET',
      pathname: '/',
    });
    assert.equal(spaRes.status, 200);
    assert.match(spaRes.text, /<div id="root">/);
    assert.match(spaRes.text, /assets\/index-/);
  } finally {
    await app.close();
    process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});
