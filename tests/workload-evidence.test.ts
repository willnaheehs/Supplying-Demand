import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultWorkloadRequest,
  findWorkloadEvidence,
  sourcePhaseAllowed,
} from '../lib/workload-evidence.ts';
import { sourceVariant } from '../lib/source-variant.ts';
import { explainRecord } from '../lib/record-explanation.ts';
import type { ClusterRecord } from '../lib/cluster-evidence';
const runs = JSON.parse(
  readFileSync(
    new URL('../data/mlperf-snapshot.json', import.meta.url),
    'utf8',
  ),
);
const request = { ...defaultWorkloadRequest };

test('interactive evidence selects Server results, keeping complete test identities', () => {
  const result = findWorkloadEvidence(request, runs);
  assert.equal(result.level, 'measured');
  assert.deepEqual(result.recordIds, ['mlperf-h100', 'mlperf-b300']);
  assert.match(result.message, /own test conditions/);
});
test('rate, first-token latency and per-token latency must pass together', () => {
  assert.deepEqual(
    findWorkloadEvidence({ ...request, tokensPerSecond: 80000 }, runs)
      .recordIds,
    ['mlperf-b300'],
  );
  assert.deepEqual(
    findWorkloadEvidence(
      { ...request, firstTokenMs: 500, perTokenMs: 160 },
      runs,
    ).recordIds,
    ['mlperf-b300'],
  );
  assert.deepEqual(
    findWorkloadEvidence({ ...request, perTokenMs: 150 }, runs).recordIds,
    ['mlperf-h100'],
  );
  const failed = findWorkloadEvidence(
    { ...request, tokensPerSecond: 80000, perTokenMs: 150 },
    runs,
  );
  assert.equal(failed.level, 'none');
  assert.deepEqual(failed.recordIds, []);
});
test('batch results cannot substitute for online latency, nor for a different model', () => {
  assert.deepEqual(
    findWorkloadEvidence({ ...request, kind: 'batch' }, runs).recordIds,
    ['mlperf-h100-offline', 'mlperf-b300-offline'],
  );
  assert.equal(
    findWorkloadEvidence(
      { ...request, firstTokenMs: 100, perTokenMs: 10 },
      runs,
    ).level,
    'none',
  );
  for (const model of ['llama3.1-70b', 'deepseek-v3', 'other']) {
    assert.equal(
      findWorkloadEvidence({ ...request, model }, runs).level,
      'none',
    );
  }
});
test('invalid targets cannot qualify a configuration and high demand is not extrapolated', () => {
  for (const tokensPerSecond of [0, -1, NaN, Infinity, 1e9]) {
    assert.equal(
      findWorkloadEvidence({ ...request, tokensPerSecond }, runs).level,
      'none',
    );
  }
  assert.equal(
    findWorkloadEvidence({ ...request, firstTokenMs: NaN }, runs).level,
    'none',
  );
});
test('training remains a reported deployment, never an inference recommendation', () => {
  assert.deepEqual(
    findWorkloadEvidence(
      { ...request, kind: 'training', model: 'llama3' },
      runs,
    ).recordIds,
    ['meta-roce'],
  );
  assert.equal(
    findWorkloadEvidence(
      { ...request, kind: 'training', model: 'llama3' },
      runs,
    ).level,
    'reported',
  );
  assert.deepEqual(
    findWorkloadEvidence(
      { ...request, kind: 'training', model: 'deepseek-v3' },
      runs,
    ).recordIds,
    ['deepseek'],
  );
  assert.equal(
    findWorkloadEvidence({ ...request, model: 'llama3' }, runs).level,
    'none',
  );
});
test('source phases prevent showing inference as reported Meta training', () => {
  assert.equal(sourcePhaseAllowed('training', 'decode'), false);
  assert.equal(sourcePhaseAllowed('training', 'prefill'), false);
  assert.equal(sourcePhaseAllowed('training', 'train'), true);
  assert.equal(sourcePhaseAllowed('inference', 'train'), false);
  assert.equal(sourcePhaseAllowed('inference', 'decode'), true);
});
test('a variant of a training source preserves workload type and labels causal evidence correctly', () => {
  const meta = {
    id: 'meta-roce',
    gpu: 'H100',
    fabric: 'RoCE',
    workloadKind: 'training',
    source: 'https://engineering.fb.com/',
  } as ClusterRecord;
  const variant = sourceVariant(meta);
  assert.equal(variant.workload, 'training');
  assert.equal(variant.group, variant.nodes * 8);
  assert.ok(variant.checkpointGB > 0);
  assert.match(
    explainRecord(meta, 'fabric').evidence,
    /not proof of inference performance/,
  );
});
test('benchmark variants retain submitted memory and requested targets without a measured speed', () => {
  const b = runs.find(
    (b: { gpu: string; scenario: string }) =>
      b.gpu === 'B300' && b.scenario === 'Server',
  );
  const record = {
    gpu: 'B300',
    fabric: 'Single-node run',
    workloadKind: 'inference',
  } as ClusterRecord;
  const variant = sourceVariant(record, b, {
    ...request,
    tokensPerSecond: 80000,
  });
  assert.equal(variant.hbm, 270);
  assert.equal(variant.cores, 112);
  assert.equal(variant.targetTps, 80000);
  assert.equal(variant.workload, 'inference');
  assert.equal('tokensPerSecond' in variant, false);
});
