import snapshot from '../data/mlperf-snapshot.json';
export type EvidenceFact = {
  label: string;
  value: string | null;
  source: string;
  status?: 'reported' | 'derived';
};
export type ClusterRecord = {
  id: string;
  name: string;
  operator: string;
  kind: 'Production disclosure' | 'Benchmark submission' | 'Network experiment';
  date: string;
  gpu: string;
  gpuCount: number | null;
  nodeCount: number | null;
  fabric: string;
  model: string;
  outcome: string;
  outcomeValue?: string;
  scope: string;
  facts: EvidenceFact[];
  source: string;
  lesson: string;
  benchmarkId?: string;
};
const meta =
  'https://engineering.fb.com/2024/03/12/data-center-engineering/building-metas-genai-infrastructure/';
const metaNetwork =
  'https://engineering.fb.com/2024/08/05/data-center-engineering/roce-network-distributed-ai-training-at-scale/';
const deepseek = 'https://arxiv.org/html/2412.19437v1';
const evolution =
  'https://engineering.fb.com/2025/09/29/data-infrastructure/metas-infrastructure-evolution-and-the-advent-of-ai/';
const meta2026 =
  'https://engineering.fb.com/2026/08/24/networking-traffic/metaroce-rdma-transport-ai-ethernet/';
export const benchmarks = snapshot;
export const clusterRecords: ClusterRecord[] = [
  {
    id: 'meta-roce',
    name: 'Meta · RoCE cluster',
    operator: 'Meta',
    kind: 'Production disclosure',
    date: '2024-03-12',
    gpu: 'H100',
    gpuCount: 24576,
    nodeCount: null,
    fabric: 'RoCE · 400 Gb/s endpoints',
    model: 'Llama 3 training',
    outcome: 'Meta reported Llama 3 training on this RoCE cluster.',
    scope:
      'Operator disclosure, not a controlled fabric comparison. Current allocation and achieved tokens/s are not disclosed here.',
    source: meta,
    lesson:
      'H100 + RoCE has supported large-model training. Software, placement and network engineering are part of the result.',
    facts: [
      {
        label: 'Compute platform',
        value: '24,576 H100 · Grand Teton',
        source: meta,
      },
      {
        label: 'Backend network',
        value: 'Arista 7800, Wedge400, Minipack2 · 400G endpoints',
        source: meta,
      },
      {
        label: 'Storage',
        value: 'Flash-optimized Tectonic + Hammerspace NFS',
        source: meta,
      },
      {
        label: 'Storage servers',
        value: 'YV3 Sierra Point · E1.S SSDs',
        source: meta,
      },
      {
        label: 'North–south / frontend',
        value:
          'Separate ingestion, checkpoint and logging network (Meta design)',
        source: metaNetwork,
      },
      { label: 'Per-server CPU / RAM', value: null, source: meta },
      { label: 'Storage GB/s / client latency', value: null, source: meta },
    ],
  },
  {
    id: 'meta-ib',
    name: 'Meta · InfiniBand cluster',
    operator: 'Meta',
    kind: 'Production disclosure',
    date: '2024-03-12',
    gpu: 'H100',
    gpuCount: 24576,
    nodeCount: null,
    fabric: 'Quantum-2 InfiniBand · 400 Gb/s',
    model: 'Large GenAI workloads',
    outcome:
      'Meta reported successful large GenAI workloads on both fabric designs.',
    scope:
      'Do not attribute a particular model run or a numeric RoCE/IB speed advantage to this disclosure.',
    source: meta,
    lesson:
      'Fabric choice needs the job’s communication and operational requirements, even when the GPUs match.',
    facts: [
      {
        label: 'Compute platform',
        value: '24,576 H100 · Grand Teton',
        source: meta,
      },
      {
        label: 'Backend network',
        value: 'NVIDIA Quantum-2 · 400G endpoints',
        source: meta,
      },
      {
        label: 'Storage',
        value: 'Tectonic + Hammerspace; flash-based storage hosts',
        source: meta,
      },
      { label: 'Per-server CPU / RAM', value: null, source: meta },
      { label: 'Matched application benchmark', value: null, source: meta },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek · V3 training',
    operator: 'DeepSeek',
    kind: 'Production disclosure',
    date: '2024-12-27',
    gpu: 'H800',
    gpuCount: 2048,
    nodeCount: 256,
    fabric: 'InfiniBand between nodes',
    model: 'DeepSeek-V3 · 671B total / 37B active',
    outcome: '2.788 million H800 GPU-hours for the reported training stages.',
    outcomeValue: '2.788M GPU-hours',
    scope:
      '14.8T pretraining tokens; 2.664M GPU-hours pretraining. Full-stage total excludes preceding research and ablations. This is a sparse MoE model.',
    source: deepseek,
    lesson:
      'Parameter count alone hides large differences: active experts, precision and communication overlap matter.',
    facts: [
      {
        label: 'Compute',
        value: '2,048 H800; 8 GPUs per node',
        source: deepseek,
      },
      {
        label: 'Node count',
        value: '256 = 2,048 ÷ 8',
        source: deepseek,
        status: 'derived',
      },
      {
        label: 'Local / external network',
        value: 'NVLink + NVSwitch / InfiniBand',
        source: deepseek,
      },
      {
        label: 'Training strategy',
        value:
          'FP8 mixed precision; 16-way pipeline, 64-way expert parallelism; ZeRO-1',
        source: deepseek,
      },
      { label: 'Storage servers / throughput', value: null, source: deepseek },
      { label: 'CPU / RAM / frontend', value: null, source: deepseek },
    ],
  },
  {
    id: 'meta-129k',
    name: 'Meta · 129k H100 system',
    operator: 'Meta',
    kind: 'Production disclosure',
    date: '2025-09-29',
    gpu: 'H100',
    gpuCount: 129000,
    nodeCount: null,
    fabric: 'Not specified in this disclosure',
    model: 'Large-model capacity expansion',
    outcome:
      'Meta reported building a single 129k-H100 cluster across five buildings.',
    outcomeValue: '129k H100',
    scope:
      '129k is the operator’s rounded count. No model-specific throughput or full bill of materials is published in this source.',
    source: evolution,
    lesson:
      'A large fleet count establishes scale, not a particular workload’s performance or available rental capacity.',
    facts: [
      {
        label: 'Reported scale',
        value: '129k H100 GPUs · five data center buildings',
        source: evolution,
      },
      { label: 'Exact GPU count', value: null, source: evolution },
      { label: 'Backend / frontend network', value: null, source: evolution },
      { label: 'CPU / storage configuration', value: null, source: evolution },
      {
        label: 'Model run / tokens per second',
        value: null,
        source: evolution,
      },
    ],
  },
  ...(['H100', 'B300'] as const).map((gpu) => {
    const b = benchmarks.find((x) => x.gpu === gpu && x.scenario === 'Server')!;
    const s = b.systemMetadata;
    return {
      id: 'mlperf-' + gpu.toLowerCase(),
      name: `MLPerf · 8 × ${gpu}`,
      operator: 'NVIDIA submission',
      kind: 'Benchmark submission' as const,
      date: b.published,
      gpu,
      gpuCount: 8,
      nodeCount: 1,
      fabric: 'Single-node run · external fabric effect not isolated',
      model: 'Llama 2 70B · Server',
      outcome: `${b.tokensPerSecond.toLocaleString('en-US')} output tokens/s in the submitted test.`,
      outcomeValue: b.tokensPerSecond.toLocaleString('en-US') + ' tokens/s',
      scope: `${b.version} closed division · ${b.precision.toUpperCase()} weights · OpenOrca · 2,000 ms TTFT / 200 ms TPOT limits. A benchmark system is not a production client deployment.`,
      source: b.sourceUrl,
      lesson:
        'Keep model, precision, software, request distribution and latency targets attached to every performance number.',
      benchmarkId: b.id,
      facts: [
        {
          label: 'GPU memory',
          value: `8 × ${s.accelerator_memory_capacity} (submission metadata)`,
          source: b.systemUrl,
        },
        {
          label: 'CPU / RAM',
          value: `${s.host_processors_per_node} × ${s.host_processor_model_name}; ${s.host_memory_capacity} RAM`,
          source: b.systemUrl,
        },
        {
          label: 'Host storage',
          value: s.host_storage_capacity,
          source: b.systemUrl,
        },
        {
          label: 'NIC inventory',
          value: s.host_network_card_count,
          source: b.systemUrl,
        },
        { label: 'Fabric impact on result', value: null, source: b.sourceUrl },
        {
          label: 'Software / weight precision',
          value: `${b.software}; ${b.precision.toUpperCase()}`,
          source: b.summaryUrl,
        },
        {
          label: 'p99 first token / output token',
          value: `${b.ttftP99Ms} ms / ${b.tpotP99Ms} ms`,
          source: b.sourceUrl,
        },
      ],
    };
  }),
  {
    id: 'metaroce-2026',
    name: 'Meta · RDMA experiment',
    operator: 'Meta + AMD',
    kind: 'Network experiment',
    date: '2026-08-24',
    gpu: 'AMD · model not specified',
    gpuCount: null,
    nodeCount: 64,
    fabric: 'MetaRoCE vs RoCEv2',
    model: 'RCCL all-reduce / all-to-all',
    outcome: 'Reported ~86% throughput retained at 1% packet loss.',
    outcomeValue: '~86% at 1% loss',
    scope:
      'Transport/collective experiment. This is not an LLM tokens/s result, nor evidence that these are the settings for every Meta production cluster.',
    source: meta2026,
    lesson:
      'Network resiliency can be measured separately; translating it into model output requires an application test.',
    facts: [
      {
        label: 'Test cluster',
        value: '64 AMD GPU nodes; exact GPU model/count not specified',
        source: meta2026,
      },
      {
        label: 'NICs',
        value: 'AMD Pensando programmable NICs',
        source: meta2026,
      },
      {
        label: 'Workload',
        value: 'RCCL all-reduce and all-to-all',
        source: meta2026,
      },
      {
        label: 'Validation topology',
        value: '4-plane / 8-plane, up to 4,000 connections reported',
        source: meta2026,
      },
      {
        label: 'Storage / CPU / application result',
        value: null,
        source: meta2026,
      },
    ],
  },
];
