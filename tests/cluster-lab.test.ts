import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  analyzeScenario,
  applyComponent,
  initialScenario,
  validateScenario,
  withWorkload,
  withClient,
} from '../lib/cluster-lab.ts';
const s = { ...initialScenario };
test('north–south capacity uses the larger full-duplex direction with explicit payload allowance', () => {
  const a = analyzeScenario({
    ...s,
    parameters: 0,
    loadCopies: 0,
    datasetRead: 4,
    checkpointGB: 600,
    checkpointWindow: 100,
    requestsPerSecond: 1000,
    requestMB: 1,
    responseMB: 2,
    utilization: 0.8,
  });
  assert.equal(a.ingress, 5);
  assert.equal(a.egress, 8);
  assert.equal(a.nsRequiredGbps, 80);
});
test('a spine is needed only when the job crosses leaves, not for independent local groups', () => {
  assert.equal(
    analyzeScenario({ ...s, spine: false, group: 8 }).routeMissing,
    false,
  );
  assert.equal(
    analyzeScenario({ ...s, spine: false, group: 16 }).routeMissing,
    true,
  );
  assert.equal(
    analyzeScenario({ ...s, spine: false, group: 16, crossLeaf: false })
      .routeMissing,
    false,
  );
  assert.equal(
    analyzeScenario({ ...s, uplinks: 0, group: 16 }).routeMissing,
    true,
  );
  const a = analyzeScenario({ ...s, group: 16, downlinks: 32, uplinks: 8 });
  assert.equal(a.oversub, 4);
  assert.equal(a.routeMissing, false);
});
test('storage budgets include protection, retention and simultaneous checkpoint traffic', () => {
  const a = analyzeScenario({
    ...s,
    parameters: 70,
    weightBytes: 2,
    datasetTB: 10,
    checkpointGB: 1000,
    checkpointCopies: 3,
    checkpointWindow: 100,
    storageNodes: 2,
    rawTBPerStorage: 40,
    protection: 2,
    measuredWrite: 5,
  });
  assert.equal(a.usableTB, 40);
  assert.equal(a.storageRequiredTB, 13.14);
  assert.equal(a.writeTarget, 10);
  assert.ok(a.issues.some((x) => x.includes('below the checkpoint target')));
});
test('GPU inventory never supplies more memory than actually configured', () => {
  const a = analyzeScenario({ ...s, nodes: 1, group: 16 });
  assert.equal(a.capacity, 640);
  assert.ok(a.issues.some((x) => x.includes('more GPUs')));
  const b = analyzeScenario(applyComponent(s, 'b300'));
  assert.equal(b.capacity, 8 * 288);
  assert.equal(b.requiredTps, a.requiredTps);
  assert.equal(applyComponent(s, 'ib').fabric, 'ib');
  assert.equal(
    analyzeScenario(applyComponent(s, 'ib')).requiredTps,
    analyzeScenario(s).requiredTps,
  );
});
test('changing phases in the same workload preserves user assumptions', () => {
  const custom = { ...s, overhead: 52, group: 4, datasetRead: 3 };
  assert.deepEqual(withWorkload(custom, 'inference'), custom);
  const training = withWorkload(custom, 'training');
  assert.equal(training.group, 16);
  assert.equal(training.checkpointGB, 1120);
});
test('import and page tool validation reject invalid divisors and incomplete or invented fields', () => {
  assert.deepEqual(validateScenario(s), s);
  for (const bad of [
    { utilization: 0 },
    { utilization: 1.1 },
    { checkpointWindow: 0 },
    { loadWindow: 0 },
    { protection: 0.5 },
    { weightBytes: 0 },
    { days: 0 },
    { nodes: 1.5 },
    { hbm: Infinity },
    { gpu: 'H1' },
    { storageCores: 1.5 },
    { extra: 42 },
  ])
    assert.throws(() => validateScenario({ ...s, ...bad }));
  assert.throws(() => validateScenario({}));
});
test('benchmark snapshot retains distinct run conditions and pinned valid result evidence', () => {
  const data = JSON.parse(
    readFileSync(
      new URL('../data/mlperf-snapshot.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(data.length, 4);
  assert.equal(new Set(data.map((b: { id: string }) => b.id)).size, 4);
  for (const b of data) {
    assert.ok(b.tokensPerSecond > 0);
    assert.match(b.sourceUrl, /github.com.*[a-f0-9]{40}/);
    assert.equal(b.nodes * b.gpusPerNode, 8);
    if (b.scenario === 'Server') {
      assert.ok(b.ttftP99Ms > 0 && b.ttftP99Ms < 2000);
      assert.ok(b.tpotP99Ms > 0 && b.tpotP99Ms < 200);
    }
  }
  const h = data.find(
    (b: { gpu: string; scenario: string }) =>
      b.gpu === 'H100' && b.scenario === 'Server',
  );
  const b = data.find(
    (b: { gpu: string; scenario: string }) =>
      b.gpu === 'B300' && b.scenario === 'Server',
  );
  assert.equal(h.precision, 'fp8');
  assert.equal(b.precision, 'fp4');
  assert.notEqual(h.version, b.version);
  assert.equal(parseFloat(b.systemMetadata.accelerator_memory_capacity), 270);
});

test('client profiles use the supplied hardware and expose a training memory gap', () => {
  const hardware = { ...s, nodes: 1, hbm: 20 };
  const assistant = withClient(hardware, 'assistant');
  const training = withClient(hardware, 'trainer');
  assert.equal(assistant.hbm, 20);
  assert.equal(assistant.nodes, 1);
  assert.equal(assistant.fabric, hardware.fabric);
  assert.equal(analyzeScenario(assistant).fit, true);
  assert.equal(analyzeScenario(training).fit, false);
  assert.equal(training.parameters, 7);
  assert.equal(training.group, 8);
});
