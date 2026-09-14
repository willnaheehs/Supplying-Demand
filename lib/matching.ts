import {
  analyzeScenario,
  initialScenario,
  gpuSpecs,
  validateScenario,
  type Scenario,
} from './cluster-lab.ts';
export const demandFields = [
  'workload',
  'parameters',
  'weightBytes',
  'context',
  'concurrency',
  'layers',
  'kvHeads',
  'headDim',
  'kvBytes',
  'overhead',
  'margin',
  'targetTps',
  'ttftMs',
  'tpotMs',
  'trainTokensB',
  'days',
  'requestsPerSecond',
  'requestMB',
  'responseMB',
  'datasetRead',
  'datasetTB',
  'checkpointGB',
  'checkpointWindow',
  'checkpointCopies',
  'loadCopies',
  'loadWindow',
] as const;
export type Demand = {
  client: string;
  model: string;
  engine: string;
  architecture: 'dense' | 'moe';
  activeParameters: number;
  moeCacheGB: number;
  inputTokens: number;
  outputTokens: number;
  busyFraction: number;
  region: string;
  neededOn: string;
  inputs: Pick<Scenario, (typeof demandFields)[number]>;
};
export type Run = {
  signature: string;
  rate: number;
  ttft: number;
  tpot: number;
  qualityPass: boolean;
  reference: string;
  date: string;
  trace: string;
};
export type Offer = {
  id: string;
  name: string;
  kind: 'example' | 'client';
  hardware: Scenario;
  hourly: number;
  region: string;
  availableOn: string;
  availability: 'unknown' | 'confirmed' | 'unavailable';
  reference: string;
  run: Run | null;
};
export const defaultDemand: Demand = {
  client: 'Startup inference service',
  model: '70B dense model · specify revision',
  engine: '',
  architecture: 'dense',
  activeParameters: 70,
  moeCacheGB: 64,
  inputTokens: 1024,
  outputTokens: 256,
  busyFraction: 0.6,
  region: '',
  neededOn: '',
  inputs: Object.fromEntries(
    demandFields.map((k) => [k, initialScenario[k]]),
  ) as Demand['inputs'],
};
export const exampleOffers: Offer[] = [
  {
    id: 'a',
    name: 'H100 · RoCE allocation',
    kind: 'example',
    hardware: { ...initialScenario, nodes: 2, group: 8 },
    hourly: 0,
    region: '',
    availableOn: '',
    availability: 'unknown',
    reference: '',
    run: null,
  },
  {
    id: 'b',
    name: 'H200 · RoCE allocation',
    kind: 'example',
    hardware: { ...initialScenario, gpu: 'H200', hbm: 141, nodes: 2, group: 8 },
    hourly: 0,
    region: '',
    availableOn: '',
    availability: 'unknown',
    reference: '',
    run: null,
  },
  {
    id: 'c',
    name: 'B300 · InfiniBand allocation',
    kind: 'example',
    hardware: {
      ...initialScenario,
      gpu: 'B300',
      hbm: 288,
      cores: 128,
      linkGbps: 800,
      fabric: 'ib',
      nodes: 1,
      group: 8,
    },
    hourly: 0,
    region: '',
    availableOn: '',
    availability: 'unknown',
    reference: '',
    run: null,
  },
];
export function useProfile(d: Demand, id: string): Demand {
  const inputs = { ...d.inputs };
  if (id === 'train')
    return {
      ...d,
      model: '7B dense training · specify revision',
      architecture: 'dense',
      activeParameters: 7,
      inputs: {
        ...inputs,
        workload: 'training',
        parameters: 7,
        weightBytes: 2,
        overhead: 128,
        trainTokensB: 100,
        days: 30,
        datasetRead: 8,
        checkpointGB: 112,
      },
    };
  if (id === 'moe')
    return {
      ...d,
      model: 'DeepSeek-V3 architecture · specify revision',
      architecture: 'moe',
      activeParameters: 37,
      moeCacheGB: 64,
      inputs: {
        ...inputs,
        workload: 'inference',
        parameters: 671,
        weightBytes: 1,
        overhead: 32,
        datasetRead: 0,
        checkpointGB: 0,
      },
    };
  return {
    ...d,
    model: '70B dense model · specify revision',
    architecture: 'dense',
    activeParameters: 70,
    inputs: {
      ...inputs,
      workload: 'inference',
      parameters: 70,
      weightBytes: 2,
      overhead: 16,
      datasetRead: 0,
      checkpointGB: 0,
    },
  };
}
export function asScenario(d: Demand, o: Offer): Scenario {
  return { ...o.hardware, ...d.inputs };
}
export function signature(d: Demand, o: Offer): string {
  // Targets, pricing and scheduling are comparison criteria; the tested workload and configuration are frozen.
  const i = { ...d.inputs } as Record<string, unknown>;
  for (const k of ['targetTps', 'ttftMs', 'tpotMs', 'trainTokensB', 'days'])
    delete i[k];
  const hardware = Object.fromEntries(
    Object.entries(o.hardware).filter(
      ([k]) =>
        !demandFields.includes(k as (typeof demandFields)[number]) &&
        k !== 'notes',
    ),
  );
  return JSON.stringify({
    model: d.model,
    engine: d.engine,
    architecture: d.architecture,
    active: d.activeParameters,
    cache: d.moeCacheGB,
    inputTokens: d.inputTokens,
    outputTokens: d.outputTokens,
    inputs: i,
    hardware,
  });
}
export function evaluate(d: Demand, o: Offer) {
  const s = asScenario(d, o),
    a = analyzeScenario(s);
  const memory =
    d.architecture === 'moe'
      ? (d.inputs.parameters * d.inputs.weightBytes +
          d.moeCacheGB +
          d.inputs.overhead) *
        (1 + d.inputs.margin / 100)
      : a.memory.total;
  const issues = a.issues.filter((x) => !x.includes('memory estimate'));
  if (memory > a.capacity)
    issues.unshift(
      'The planned model state exceeds this workload group’s GPU memory.',
    );
  if (d.architecture === 'moe' && d.inputs.workload === 'training')
    issues.unshift(
      'MoE training requires model-specific state and parallelism analysis.',
    );
  if (d.architecture === 'moe' && d.activeParameters > d.inputs.parameters)
    issues.unshift('Active parameters cannot exceed total parameters.');
  const stale = !!o.run && o.run.signature !== signature(d, o),
    run = stale ? null : o.run;
  const inference = d.inputs.workload === 'inference',
    target = a.requiredTps;
  const ratePass = !!run && run.rate >= target;
  const latencyPass =
    !!run &&
    (!inference ||
      (run.ttft <= d.inputs.ttftMs && run.tpot <= d.inputs.tpotMs));
  const measuredPass = !!run && ratePass && latencyPass && run.qualityPass;
  const supplyGaps: string[] = [];
  if (o.kind === 'example')
    supplyGaps.push(
      'Illustrative configuration; replace it with an actual provider offer.',
    );
  if (o.availability === 'unavailable')
    supplyGaps.push('Provider marks this allocation unavailable.');
  else if (o.availability !== 'confirmed')
    supplyGaps.push('Availability is not confirmed.');
  if (
    d.region &&
    o.region.toLowerCase().trim() !== d.region.toLowerCase().trim()
  )
    supplyGaps.push('Required region is missing or does not match.');
  if (d.neededOn && (!o.availableOn || o.availableOn > d.neededOn))
    supplyGaps.push('Capacity is not confirmed by the required date.');
  if (!o.reference.trim())
    supplyGaps.push('Provider reference or quote is missing.');
  const cost =
    inference && measuredPass && issues.length === 0 && o.hourly > 0
      ? (o.hourly * 1e6) / (run!.rate * 3600 * d.busyFraction)
      : null;
  const trainingHours =
    !inference && measuredPass && issues.length === 0
      ? (d.inputs.trainTokensB * 1e9) / (run!.rate * 3600)
      : null;
  const trainingCost =
    trainingHours !== null && o.hourly > 0 ? trainingHours * o.hourly : null;
  const status = issues.length
    ? 'Configuration gap'
    : stale
      ? 'Retest after change'
      : !run
        ? 'Benchmark needed'
        : !measuredPass
          ? 'Measured target miss'
          : 'Recorded targets met';
  const next = issues.length
    ? issues[0]
    : stale
      ? 'Repeat the test: the workload or hardware changed after this result was recorded.'
      : !run
        ? 'Run this exact model and request trace on the offered allocation. Record throughput, tail latency and quality together.'
        : !run.qualityPass
          ? 'Resolve model quality before using this result for a client.'
          : !ratePass
            ? 'The recorded rate is below the client target. Test a revised allocation or workload.'
            : !latencyPass
              ? 'The recorded response times miss the service target. Profile queueing, prompt processing and token generation.'
              : supplyGaps.length
                ? supplyGaps[0]
                : 'The recorded run covers the entered targets. Confirm contractual performance, cost inclusions and failure behavior.';
  return {
    a,
    memory,
    issues,
    supplyGaps,
    stale,
    run,
    measuredPass,
    ratePass,
    latencyPass,
    status,
    next,
    cost,
    trainingHours,
    trainingCost,
    headroom: a.capacity - memory,
    checkpointFloor:
      s.checkpointGB > 0 && a.dataPathCeiling > 0
        ? s.checkpointGB / a.dataPathCeiling
        : null,
  };
}
export type Lever = 'memory' | 'spine' | 'frontend' | 'storage';
export function changeLever(o: Offer, lever: Lever): Offer {
  let h = { ...o.hardware };
  if (lever === 'memory') {
    const gpu = h.gpu === 'H100' ? 'H200' : 'B300';
    h = {
      ...h,
      gpu,
      hbm: gpuSpecs[gpu].hbm,
      cores: gpuSpecs[gpu].cores,
      linkGbps: gpuSpecs[gpu].link,
    };
  }
  if (lever === 'spine') h = { ...h, spine: !h.spine };
  if (lever === 'frontend')
    h = { ...h, nsGbps: Math.min(102400, h.nsGbps * 2 || 100) };
  if (lever === 'storage')
    h = { ...h, storageNodes: Math.min(512, h.storageNodes + 1) };
  return {
    ...o,
    hardware: h,
    name: o.name + ' · variant',
    kind: 'example',
    availability: 'unknown',
    hourly: 0,
    reference: '',
  };
}
export const mechanisms = [
  {
    id: 'memory',
    name: 'GPU memory',
    output: 'Model fit & concurrency',
    why: 'All resident weights and the request cache must fit. In a mixture-of-experts model, active parameters describe computation per token; they do not replace total resident weights.',
    ask: 'What exact checkpoint, precision, KV-cache method and peak memory per GPU were tested?',
    proof:
      'Profile peak HBM per GPU with the target context and concurrent sequences.',
    source: 'https://huggingface.co/docs/transformers/kv_cache',
  },
  {
    id: 'compute',
    name: 'GPU compute & bandwidth',
    output: 'First token & token rate',
    why: 'Prompt processing and token generation stress compute and memory movement differently. Batching, kernels and precision change the balance.',
    ask: 'What are the input/output length distributions, arrival bursts and latency targets?',
    proof:
      'Measure prompt time, decode time, queueing, throughput and tail latency in the same run.',
    source: 'https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html',
  },
  {
    id: 'fabric',
    name: 'NVLink, NICs & fabric',
    output: 'Communication waiting time',
    why: 'Local links connect GPUs inside a server. The backend connects model shards and training workers across servers. A spine supplies a path across leaves; independent local replicas do not use it for their internal tensor exchanges.',
    ask: 'Which GPUs form one communicating group? Can those GPUs be allocated on the required leaves and rails?',
    proof:
      'Profile collectives or expert exchange during the job, including congestion and failure conditions.',
    source:
      'https://engineering.fb.com/2024/08/05/data-center-engineering/roce-network-distributed-ai-training-at-scale/',
  },
  {
    id: 'cpu',
    name: 'CPUs, RAM & local NVMe',
    output: 'Data preparation & GPU idle time',
    why: 'The host prepares data, tokenizes, schedules and stages work. Idle GPUs can reflect a host pipeline bottleneck even when GPU specifications are ample.',
    ask: 'How much CPU preprocessing, host memory and local caching does the real pipeline need?',
    proof:
      'Measure CPU saturation, NUMA placement, input queues and GPU idle time under production-shaped load.',
    source:
      'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html',
  },
  {
    id: 'storage',
    name: 'Storage servers & drives',
    output: 'Data feed, cold start & recovery',
    why: 'Capacity retains the data; end-to-end durable bandwidth and metadata performance govern loading and checkpointing. More raw terabytes alone do not establish faster I/O.',
    ask: 'What read rate, durable checkpoint window, file sizes and retention are required?',
    proof:
      'Test concurrent reads and durable writes beyond cache, then restore during degraded operation.',
    source: 'https://docs.nvidia.com/gpudirect-storage/design-guide/',
  },
  {
    id: 'frontend',
    name: 'North–south network',
    output: 'Client traffic & storage transfers',
    why: 'Client requests, model loads, dataset reads and checkpoint writes share this path in the planning model. It can limit work even if the GPU backend is fast.',
    ask: 'Are storage and service traffic separated? What bandwidth is guaranteed at each network cut?',
    proof:
      'Measure both directions with simultaneous client and background traffic, including bursts.',
    source:
      'https://engineering.fb.com/2024/08/05/data-center-engineering/roce-network-distributed-ai-training-at-scale/',
  },
] as const;
export function validateComparison(v: unknown): {
  demand: Demand;
  offers: Offer[];
  selected: string;
} {
  if (!v || typeof v !== 'object') throw new Error('Invalid comparison.');
  const x = v as {
    version: number;
    demand: Demand;
    offers: Offer[];
    selected: string;
  };
  if (
    x.version !== 1 ||
    !Array.isArray(x.offers) ||
    x.offers.length < 1 ||
    x.offers.length > 12
  )
    throw new Error('Unsupported comparison file.');
  const d = x.demand;
  if (!d || typeof d !== 'object') throw new Error('Missing demand.');
  for (const k of ['client', 'model', 'engine', 'region', 'neededOn'] as const)
    if (typeof d[k] !== 'string' || d[k].length > 1000)
      throw new Error('Invalid client details.');
  for (const k of [
    'activeParameters',
    'moeCacheGB',
    'inputTokens',
    'outputTokens',
    'busyFraction',
  ] as const)
    if (
      typeof d[k] !== 'number' ||
      !Number.isFinite(d[k]) ||
      d[k] < 0 ||
      d[k] > 1e9
    )
      throw new Error('Invalid workload inputs.');
  if (
    !['dense', 'moe'].includes(d.architecture) ||
    d.busyFraction <= 0 ||
    d.busyFraction > 1
  )
    throw new Error('Invalid workload assumptions.');
  if (
    Object.keys(d.inputs ?? {}).length !== demandFields.length ||
    demandFields.some((k) => !(k in d.inputs))
  )
    throw new Error('Incomplete demand inputs.');
  validateScenario({ ...initialScenario, ...d.inputs });
  if (!validDate(d.neededOn)) throw new Error('Invalid required date.');
  const ids = new Set<string>();
  for (const o of x.offers) {
    if (!o || typeof o !== 'object') throw new Error('Invalid offer.');
    for (const k of [
      'id',
      'name',
      'region',
      'availableOn',
      'reference',
    ] as const)
      if (typeof o[k] !== 'string' || o[k].length > 10000)
        throw new Error('Invalid offer details.');
    if (ids.has(o.id)) throw new Error('Duplicate offer.');
    ids.add(o.id);
    if (
      !['example', 'client'].includes(o.kind) ||
      !['unknown', 'confirmed', 'unavailable'].includes(o.availability) ||
      !Number.isFinite(o.hourly) ||
      o.hourly < 0
    )
      throw new Error('Invalid offer terms.');
    validateScenario(o.hardware);
    if (o.run !== null) {
      if (!d.engine.trim())
        throw new Error('A recorded run needs an engine/version.');
      const r = o.run;
      if (!r || typeof r !== 'object') throw new Error('Invalid recorded run.');
      for (const k of ['signature', 'reference', 'date', 'trace'] as const)
        if (typeof r[k] !== 'string' || r[k].length > 50000)
          throw new Error('Invalid run provenance.');
      for (const k of ['rate', 'ttft', 'tpot'] as const)
        if (typeof r[k] !== 'number' || !Number.isFinite(r[k]) || r[k] < 0)
          throw new Error('Invalid performance measurement.');
      if (
        r.rate <= 0 ||
        typeof r.qualityPass !== 'boolean' ||
        !r.reference.trim() ||
        !r.trace.trim() ||
        !validDate(r.date, false)
      )
        throw new Error('Incomplete benchmark evidence.');
    }
    if (!validDate(o.availableOn))
      throw new Error('Invalid availability date.');
  }
  return structuredClone({
    demand: d,
    offers: x.offers,
    selected: ids.has(x.selected) ? x.selected : x.offers[0].id,
  });
}

function validDate(value: string, allowEmpty = true) {
  if (value === '' && allowEmpty) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function specializationTest(
  d: Demand,
  baseline: Offer,
  candidate: Offer,
) {
  const b = evaluate(d, baseline);
  if (
    !b.measuredPass ||
    b.stale ||
    b.issues.length ||
    baseline.hourly <= 0 ||
    candidate.hourly <= 0
  )
    return null;
  return {
    costParityRate: (b.run!.rate * candidate.hourly) / baseline.hourly,
    requiredRate: Math.max(
      b.a.requiredTps,
      (b.run!.rate * candidate.hourly) / baseline.hourly,
    ),
    premium: candidate.hourly / baseline.hourly,
  };
}
