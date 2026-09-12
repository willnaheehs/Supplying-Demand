import { baseInputs, estimate } from './consulting.ts';
export type GPU = 'H100' | 'H200' | 'B300';
export type Phase = 'prefill' | 'decode' | 'train' | 'checkpoint' | 'load';
export const gpuSpecs: Record<
  GPU,
  { hbm: number; link: number; cores: number; power: number; source: string }
> = {
  H100: {
    hbm: 80,
    link: 400,
    cores: 112,
    power: 10.2,
    source:
      'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html',
  },
  H200: {
    hbm: 141,
    link: 400,
    cores: 112,
    power: 10.2,
    source:
      'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html',
  },
  B300: {
    hbm: 288,
    link: 800,
    cores: 128,
    power: 14.5,
    source:
      'https://docs.nvidia.com/dgx/dgxb300-user-guide/introduction-to-dgxb300.html',
  },
};
export type Scenario = {
  gpu: GPU;
  hbm: number;
  nodes: number;
  group: number;
  fabric: 'roce' | 'ib';
  crossLeaf: boolean;
  spine: boolean;
  linkGbps: number;
  downlinks: number;
  uplinks: number;
  cores: number;
  ramGB: number;
  cacheTB: number;
  nsGbps: number;
  storageNodes: number;
  storageCores: number;
  storageRam: number;
  storageNic: number;
  rawTBPerStorage: number;
  protection: number;
  measuredRead: number;
  measuredWrite: number;
  utilization: number;
  workload: 'inference' | 'training';
  parameters: number;
  weightBytes: number;
  context: number;
  concurrency: number;
  layers: number;
  kvHeads: number;
  headDim: number;
  kvBytes: number;
  overhead: number;
  margin: number;
  targetTps: number;
  ttftMs: number;
  tpotMs: number;
  trainTokensB: number;
  days: number;
  requestsPerSecond: number;
  requestMB: number;
  responseMB: number;
  datasetRead: number;
  datasetTB: number;
  checkpointGB: number;
  checkpointWindow: number;
  checkpointCopies: number;
  loadCopies: number;
  loadWindow: number;
  notes: string;
};
export const initialScenario: Scenario = {
  gpu: 'H100',
  hbm: 80,
  nodes: 2,
  group: 8,
  fabric: 'roce',
  crossLeaf: true,
  spine: true,
  linkGbps: 400,
  downlinks: 32,
  uplinks: 16,
  cores: 112,
  ramGB: 2000,
  cacheTB: 30.72,
  nsGbps: 100,
  storageNodes: 2,
  storageCores: 64,
  storageRam: 512,
  storageNic: 200,
  rawTBPerStorage: 40,
  protection: 2,
  measuredRead: 0,
  measuredWrite: 0,
  utilization: 0.7,
  workload: 'inference',
  parameters: 70,
  weightBytes: 2,
  context: 8192,
  concurrency: 8,
  layers: 80,
  kvHeads: 8,
  headDim: 128,
  kvBytes: 2,
  overhead: 16,
  margin: 15,
  targetTps: 1000,
  ttftMs: 1000,
  tpotMs: 50,
  trainTokensB: 100,
  days: 30,
  requestsPerSecond: 100,
  requestMB: 0.01,
  responseMB: 0.005,
  datasetRead: 0,
  datasetTB: 10,
  checkpointGB: 0,
  checkpointWindow: 120,
  checkpointCopies: 3,
  loadCopies: 1,
  loadWindow: 60,
  notes: '',
};
export const palette = [
  { id: 'h100', label: 'H100', hint: '80 GB HBM · swap GPUs', zone: 'compute' },
  {
    id: 'h200',
    label: 'H200',
    hint: '141 GB HBM · swap GPUs',
    zone: 'compute',
  },
  {
    id: 'b300',
    label: 'B300',
    hint: '288 GB HBM · swap GPUs',
    zone: 'compute',
  },
  { id: 'server', label: 'GPU server', hint: 'Add 8 GPUs', zone: 'compute' },
  {
    id: 'roce',
    label: 'RoCE Ethernet',
    hint: 'Change backend fabric',
    zone: 'fabric',
  },
  {
    id: 'ib',
    label: 'InfiniBand',
    hint: 'Change backend fabric',
    zone: 'fabric',
  },
  {
    id: 'spine',
    label: 'Spine capacity',
    hint: 'Add 8 uplinks / leaf',
    zone: 'fabric',
  },
  {
    id: 'storage',
    label: 'Storage server',
    hint: 'Add capacity + endpoint',
    zone: 'storage',
  },
  {
    id: 'frontend',
    label: '100 GbE uplink',
    hint: 'Add north–south capacity',
    zone: 'frontend',
  },
] as const;
export function applyComponent(s: Scenario, id: string): Scenario {
  if (['h100', 'h200', 'b300'].includes(id)) {
    const gpu = id.toUpperCase() as GPU;
    const p = gpuSpecs[gpu];
    return { ...s, gpu, hbm: p.hbm, linkGbps: p.link, cores: p.cores };
  }
  if (id === 'server') {
    const nodes = Math.min(4096, s.nodes + 1);
    return {
      ...s,
      nodes,
      group: s.workload === 'training' ? nodes * 8 : s.group,
    };
  }
  if (id === 'roce' || id === 'ib') return { ...s, fabric: id };
  if (id === 'spine')
    return { ...s, spine: true, uplinks: Math.min(512, s.uplinks + 8) };
  if (id === 'storage')
    return { ...s, storageNodes: Math.min(512, s.storageNodes + 1) };
  if (id === 'frontend')
    return { ...s, nsGbps: Math.min(102400, s.nsGbps + 100) };
  throw new Error('Unknown component.');
}
export function analyzeScenario(s: Scenario) {
  const memory = estimate({
    ...baseInputs,
    parameters: s.parameters,
    weightBytes: s.weightBytes,
    workload: s.workload,
    context: s.context,
    sequences: s.concurrency,
    layers: s.layers,
    kvHeads: s.kvHeads,
    headDim: s.headDim,
    kvBytes: s.kvBytes,
    overheadGB: s.overhead,
    marginPercent: s.margin,
    stateBytes: 16,
    tokensB: s.trainTokensB,
    days: s.days,
    targetTps: s.targetTps,
  });
  const totalGPUs = s.nodes * 8,
    group = Math.min(s.group, totalGPUs),
    capacity = group * s.hbm,
    crossNode = s.group > 8;
  const routeMissing =
    crossNode && s.crossLeaf && (!s.spine || s.uplinks === 0);
  const oversub = s.uplinks ? s.downlinks / s.uplinks : Infinity;
  const checkpointRate = s.checkpointGB / s.checkpointWindow;
  const loadRate = (memory.weights * s.loadCopies) / s.loadWindow;
  const readTarget = s.datasetRead + loadRate;
  const writeTarget = checkpointRate;
  const ingress = (s.requestsPerSecond * s.requestMB) / 1000 + readTarget;
  const egress = (s.requestsPerSecond * s.responseMB) / 1000 + writeTarget;
  const nsRequiredGbps = (Math.max(ingress, egress) * 8) / s.utilization;
  const nsCeiling = (s.nsGbps / 8) * s.utilization;
  const storageLinkCeiling =
    ((s.storageNodes * s.storageNic) / 8) * s.utilization;
  const dataPathCeiling = Math.min(nsCeiling, storageLinkCeiling);
  const usableTB = (s.storageNodes * s.rawTBPerStorage) / s.protection;
  const storageRequiredTB =
    s.datasetTB + (s.checkpointCopies * s.checkpointGB + memory.weights) / 1000;
  const issues: string[] = [];
  if (s.cores === 0 || s.ramGB === 0)
    issues.push('Compute host CPU or RAM is missing.');
  if (s.storageNodes > 0 && (s.storageCores === 0 || s.storageRam === 0))
    issues.push('Storage host CPU or RAM is missing.');
  if (s.parameters === 0) issues.push('Model size is not established.');
  if (s.group > totalGPUs)
    issues.push(
      'The workload group asks for more GPUs than this inventory contains.',
    );
  if (memory.total > capacity)
    issues.push(
      'The workload’s memory estimate exceeds the selected GPU group.',
    );
  if (routeMissing)
    issues.push('Cross-leaf GPU communication has no usable spine path.');
  if (nsRequiredGbps > s.nsGbps)
    issues.push(
      'North–south capacity is below the simultaneous traffic budget.',
    );
  if (storageRequiredTB > usableTB)
    issues.push(
      'Protected storage capacity is below data and checkpoint retention needs.',
    );
  if (Math.max(readTarget, writeTarget) > storageLinkCeiling)
    issues.push(
      'Storage-server network capacity is below the required data rate.',
    );
  if (s.measuredRead > 0 && s.measuredRead < readTarget)
    issues.push('Entered durable read throughput is below the read target.');
  if (s.measuredWrite > 0 && s.measuredWrite < writeTarget)
    issues.push(
      'Entered durable write throughput is below the checkpoint target.',
    );
  return {
    memory,
    totalGPUs,
    capacity,
    crossNode,
    routeMissing,
    oversub,
    checkpointRate,
    loadRate,
    readTarget,
    writeTarget,
    ingress,
    egress,
    nsRequiredGbps,
    nsCeiling,
    storageLinkCeiling,
    dataPathCeiling,
    usableTB,
    storageRequiredTB,
    issues,
    minGPUs: Math.ceil(memory.total / s.hbm),
    fit: memory.total <= capacity,
    requiredTps: memory.requiredTps,
  };
}
export function validateScenario(input: unknown): Scenario {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Expected a scenario object.');
  const s = input as Scenario;
  if (Object.keys(s).some((k) => !(k in initialScenario)))
    throw new Error('Unknown scenario field.');
  for (const [k, v] of Object.entries(initialScenario)) {
    const value = (s as unknown as Record<string, unknown>)[k];
    if (typeof value !== typeof v) throw new Error(`Invalid ${k}.`);
    if (
      typeof value === 'number' &&
      (!Number.isFinite(value) || value < 0 || value > 1e9)
    )
      throw new Error(`Invalid ${k}.`);
  }
  if (
    !['H100', 'H200', 'B300'].includes(s.gpu) ||
    !['roce', 'ib'].includes(s.fabric) ||
    !['inference', 'training'].includes(s.workload)
  )
    throw new Error('Unsupported GPU, fabric or workload.');
  for (const k of [
    'nodes',
    'group',
    'hbm',
    'protection',
    'checkpointWindow',
    'loadWindow',
    'context',
    'layers',
    'kvHeads',
    'headDim',
    'kvBytes',
    'concurrency',
    'weightBytes',
    'days',
    'linkGbps',
    'downlinks',
  ] as const)
    if (s[k] <= 0) throw new Error(`${k} must be positive.`);
  if (s.protection < 1)
    throw new Error('Protection factor must be at least 1.');
  if (s.utilization <= 0 || s.utilization > 1)
    throw new Error('Utilization must be greater than 0 and no more than 1.');
  for (const k of [
    'nodes',
    'group',
    'cores',
    'storageCores',
    'context',
    'storageNodes',
    'downlinks',
    'uplinks',
    'concurrency',
    'layers',
    'kvHeads',
    'headDim',
    'checkpointCopies',
    'loadCopies',
  ] as const)
    if (!Number.isInteger(s[k]))
      throw new Error(`${k} must be a whole number.`);
  if (s.nodes > 4096 || s.group > 32768 || s.notes.length > 100000)
    throw new Error('Scenario exceeds supported limits.');
  return { ...s };
}
export const phaseInfo: Record<
  Phase,
  { label: string; path: string; result: string; detail: string }
> = {
  prefill: {
    label: 'Process a prompt',
    path: 'CPU → GPU compute → KV cache',
    result: 'Time to first token',
    detail:
      'Tokenization and scheduling feed prompt processing. Long inputs change attention work and the cache footprint; measure queueing as part of first-token latency.',
  },
  decode: {
    label: 'Generate tokens',
    path: 'GPU compute ↔ HBM; fabric if sharded',
    result: 'Time per output token',
    detail:
      'The model repeatedly produces tokens. Memory access, attention, batching and any model-shard communication determine the delivered rate.',
  },
  train: {
    label: 'Training step',
    path: 'Data → CPU → GPUs ↔ collectives',
    result: 'Training tokens/s and completion time',
    detail:
      'Forward and backward computation combine with state synchronization. Communication that overlaps compute is different from communication that leaves GPUs waiting.',
  },
  checkpoint: {
    label: 'Save a checkpoint',
    path: 'GPU / host state → frontend → storage',
    result: 'Durable checkpoint time',
    detail:
      'A checkpoint must reach the required durability. GPU compute-fabric bandwidth does not establish the storage path’s write capacity.',
  },
  load: {
    label: 'Load a model / data',
    path: 'Storage → frontend → host / GPU',
    result: 'Time to ready and data-feed stalls',
    detail:
      'Cold starts and dataset reads consume the frontend path. Caching may reduce repeated reads; metadata, storage CPU and supported direct paths also matter.',
  },
};

export function withWorkload(
  s: Scenario,
  workload: Scenario['workload'],
): Scenario {
  if (s.workload === workload) return s;
  const training = workload === 'training';
  return {
    ...s,
    workload,
    group: training ? s.nodes * 8 : Math.min(8, s.nodes * 8),
    overhead: training ? 128 : 16,
    datasetRead: training ? 8 : 0,
    checkpointGB: training ? s.parameters * 16 : 0,
  };
}

export const clientProfiles = [
  {
    id: 'assistant',
    name: 'Internal assistant team',
    description: '8B dense model · interactive answers',
    parameters: 8,
    workload: 'inference',
    layers: 32,
    kvHeads: 8,
    context: 4096,
    concurrency: 16,
    targetTps: 500,
  },
  {
    id: 'api',
    name: 'AI API provider',
    description: '70B dense model · shared serving',
    parameters: 70,
    workload: 'inference',
    layers: 80,
    kvHeads: 8,
    context: 8192,
    concurrency: 8,
    targetTps: 1000,
  },
  {
    id: 'trainer',
    name: 'Model training company',
    description: '7B dense model · 100B training tokens',
    parameters: 7,
    workload: 'training',
    layers: 32,
    kvHeads: 8,
    context: 4096,
    concurrency: 8,
    targetTps: 0,
  },
] as const;
export function withClient(s: Scenario, id: string): Scenario {
  const p = clientProfiles.find((x) => x.id === id);
  if (!p) throw new Error('Unknown client profile.');
  const training = p.workload === 'training';
  return {
    ...s,
    parameters: p.parameters,
    workload: p.workload,
    layers: p.layers,
    kvHeads: p.kvHeads,
    context: p.context,
    concurrency: p.concurrency,
    targetTps: p.targetTps,
    group: training ? s.nodes * 8 : Math.min(8, s.nodes * 8),
    weightBytes: 2,
    kvBytes: 2,
    headDim: 128,
    overhead: training ? 128 : 16,
    margin: 15,
    trainTokensB: 100,
    days: 30,
    ttftMs: 1000,
    tpotMs: 50,
    datasetRead: training ? 8 : 0,
    checkpointGB: training ? p.parameters * 16 : 0,
  };
}
