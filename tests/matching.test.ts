import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultDemand,
  exampleOffers,
  evaluate,
  useProfile,
  signature,
  changeLever,
  validateComparison,
  specializationTest,
  type Demand,
  type Offer,
} from '../lib/matching.ts';
const setup = () => ({
  d: { ...structuredClone(defaultDemand), engine: 'Engine test v1' },
  o: structuredClone(exampleOffers[0]),
});
function withRun(d: Demand, o: Offer, extra = {}) {
  return {
    ...o,
    hourly: 36,
    run: {
      signature: signature(d, o),
      rate: 2000,
      ttft: 800,
      tpot: 40,
      qualityPass: true,
      reference: 'Client load test',
      date: '2026-09-13',
      trace: 'Trace and quality threshold v1',
      ...extra,
    },
  };
}
test('MoE sizing retains all resident weights, rather than only active parameters', () => {
  const { d, o } = setup();
  const m = useProfile(d, 'moe');
  const r = evaluate(m, o);
  assert.equal(r.memory, (671 + 64 + 32) * 1.15);
  assert.ok(r.memory > 640);
  assert.ok(r.issues.some((x) => x.includes('memory')));
  const bigger = evaluate(m, { ...o, hardware: { ...o.hardware, hbm: 141 } });
  assert.ok(!bigger.issues.some((x) => x.includes('memory')));
  assert.ok(bigger.issues.some((x) => x.includes('North–south')));
});
test('cost is shown only for a matching run that meets throughput, latency and quality', () => {
  const { d, o } = setup();
  const b = withRun(d, o);
  const r = evaluate(d, b);
  assert.equal(r.measuredPass, true);
  assert.equal(r.cost, (36 * 1e6) / (2000 * 3600 * 0.6));
  for (const e of [
    { ttft: 1500 },
    { tpot: 100 },
    { rate: 500 },
    { qualityPass: false },
  ])
    assert.equal(evaluate(d, withRun(d, o, e)).cost, null);
  assert.equal(evaluate(d, o).cost, null);
});
test('hardware or workload changes stale a run, but quote and target edits re-evaluate it', () => {
  const { d, o } = setup();
  const b = withRun(d, o);
  assert.equal(evaluate({ ...d, model: 'Different revision' }, b).stale, true);
  assert.equal(
    evaluate(d, { ...b, hardware: { ...b.hardware, uplinks: 8 } }).stale,
    true,
  );
  assert.equal(evaluate(d, { ...b, hourly: 72 }).stale, false);
  assert.equal(
    evaluate({ ...d, inputs: { ...d.inputs, tpotMs: 20 } }, b).status,
    'Measured target miss',
  );
});
test('availability, region and timing remain separate from workload performance', () => {
  const { d, o } = setup();
  const b = withRun(d, {
    ...o,
    kind: 'client',
    reference: 'Quote',
    availability: 'confirmed',
    region: 'us-east',
    availableOn: '2026-10-01',
  });
  const r = evaluate({ ...d, region: 'eu-west', neededOn: '2026-09-20' }, b);
  assert.equal(r.measuredPass, true);
  assert.equal(r.supplyGaps.length, 2);
});
test('spine removal affects distributed cross-leaf groups, not local replicas', () => {
  const { d, o } = setup();
  assert.equal(evaluate(d, changeLever(o, 'spine')).a.routeMissing, false);
  assert.equal(
    evaluate(
      d,
      changeLever({ ...o, hardware: { ...o.hardware, group: 16 } }, 'spine'),
    ).a.routeMissing,
    true,
  );
});
test('a hypothetical change clears quote and supply claims without reusing a benchmark as current', () => {
  const { d, o } = setup();
  const b = withRun(d, {
    ...o,
    kind: 'client',
    availability: 'confirmed',
    reference: 'Quote',
  });
  const v = changeLever(b, 'frontend');
  assert.equal(v.hourly, 0);
  assert.equal(v.availability, 'unknown');
  assert.equal(v.kind, 'example');
  assert.equal(evaluate(d, v).stale, true);
});
test('specialization threshold uses a matched baseline and the actual price premium', () => {
  const { d, o } = setup();
  const base = withRun(d, o);
  const candidate = { ...exampleOffers[1], hourly: 72 };
  assert.equal(specializationTest(d, base, candidate)?.costParityRate, 4000);
  assert.equal(specializationTest(d, o, candidate), null);
});
test('training cost and completion estimates use the token budget and qualified training rate', () => {
  const { d, o } = setup();
  const t = useProfile(d, 'train');
  const b = withRun(t, o, { rate: 50000 });
  const r = evaluate(t, b);
  assert.equal(r.trainingHours, 100e9 / (50000 * 3600));
  assert.equal(r.trainingCost, r.trainingHours! * 36);
  assert.equal(r.cost, null);
});
test('comparison round-trip preserves recorded evidence and rejects invalid inputs', () => {
  const { d, o } = setup();
  const file = {
    version: 1,
    demand: d,
    offers: [withRun(d, o)],
    selected: o.id,
  };
  assert.deepEqual(
    validateComparison(JSON.parse(JSON.stringify(file))).offers[0].run,
    file.offers[0].run,
  );
  for (const bad of [
    { ...file, demand: { ...d, busyFraction: 0 } },
    { ...file, offers: [{ ...o, hourly: -1 }] },
    { ...file, demand: { ...d, neededOn: '2026-02-30' } },
    { ...file, offers: [{ ...withRun(d, o), run: { rate: 5 } }] },
  ])
    assert.throws(() => validateComparison(bad));
});

test('dense model edits do not inherit the hidden MoE active-parameter constraint', () => {
  const { d, o } = setup();
  const r = evaluate({ ...d, inputs: { ...d.inputs, parameters: 8 } }, o);
  assert.ok(!r.issues.some((x) => x.includes('Active parameters')));
});
