import snapshot from '../data/mlperf-snapshot.json';
export type EvidenceFact = {
  label: string;
  value: string | null;
  source: string;
  status?: 'reported' | 'derived';
};
export type ClusterDescription = {
  hardware: string;
  result: string;
  meaning: string;
};
export type ClusterRecord = {
  id: string;
  name: string;
  operator: string;
  kind: 'Production disclosure' | 'Benchmark submission' | 'Network experiment';
  workloadKind: 'inference' | 'training' | 'network' | 'unspecified';
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
  description: ClusterDescription;
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
    workloadKind: 'training',
    description: {
      hardware:
        'Meta’s March 2024 cluster contains 24,576 H100 GPUs in Grand Teton servers. A RoCE Ethernet fabric connects 400 Gb/s endpoints using Arista 7800, Wedge400 and Minipack2 switches. Tectonic and Hammerspace NFS storage run on YV3 Sierra Point servers with E1.S SSDs.',
      result:
        'Meta reported training Llama 3 on this system without network bottlenecks after jointly engineering its network, software and model. The disclosure does not give training tokens per second.',
      meaning:
        'This is a training example, not an inference benchmark. GPUs perform the model calculations; RoCE carries exchanges between training workers; storage feeds data and saves checkpoints. Meta also tuned placement, routing and the communication software. The result supports that complete approach, not a claim that H100 or RoCE alone determines performance.',
    },
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
    workloadKind: 'training',
    description: {
      hardware:
        'This companion cluster has 24,576 H100 GPUs in Grand Teton servers, Quantum-2 InfiniBand connecting 400 Gb/s endpoints, and the same published Tectonic/Hammerspace storage approach.',
      result:
        'Meta reported successful large generative-AI workloads on both clusters, but no matched application-speed comparison.',
      meaning:
        'This supports InfiniBand as a demonstrated training option. The disclosure cannot tell you how much faster it would be than RoCE for your client.',
    },
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
    workloadKind: 'training',
    description: {
      hardware:
        'DeepSeek-V3 trained on 2,048 H800 GPUs, with eight GPUs per server: 256 servers by calculation. NVLink and NVSwitch connect GPUs within each server; InfiniBand connects servers. The report does not provide a complete CPU, RAM, storage or north–south network configuration.',
      result:
        'The workload was a mixture-of-experts model with 671 billion total parameters and 37 billion active per token. Using FP8 mixed-precision training, DeepSeek reported 14.8 trillion pretraining tokens in 2.664 million H800 GPU-hours. The reported training stages together consumed 2.788 million GPU-hours, excluding earlier research and ablations.',
      meaning:
        'For a consultant, GPU-hours describe resources consumed by this particular training process. The result depends on the sparse model and its optimized software; it is not a sizing rule for a dense 671-billion-parameter model.',
    },
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
    workloadKind: 'unspecified',
    description: {
      hardware:
        'Meta reported assembling one cluster of roughly 129,000 H100 GPUs across five data-center buildings. This disclosure does not specify its server count, per-server CPU or RAM, exact network topology, or storage configuration.',
      result:
        'The reported achievement is the scale of the cluster itself. The article does not attach a particular model run, training rate, inference latency or GPU-utilization measurement to this system.',
      meaning:
        'For a consultant, this is a reference for infrastructure scale. There is not enough published information here to judge workload effectiveness or reproduce the configuration.',
    },
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
  ...benchmarks.map((b) => {
    const gpu = b.gpu;
    const online = b.scenario === 'Server';
    const s = b.systemMetadata;
    return {
      id: 'mlperf-' + gpu.toLowerCase() + (online ? '' : '-offline'),
      name: `MLPerf · 8 × ${gpu}${online ? '' : ' · batch'}`,
      workloadKind: 'inference' as const,
      operator: 'NVIDIA submission',
      kind: 'Benchmark submission' as const,
      date: b.published,
      gpu,
      gpuCount: 8,
      nodeCount: 1,
      fabric: 'Single-node run · external fabric effect not isolated',
      model: `Llama 2 70B · ${online ? 'interactive inference' : 'batch inference'}`,
      outcome: `${b.tokensPerSecond.toLocaleString('en-US')} output tokens/s in the submitted test.`,
      outcomeValue: b.tokensPerSecond.toLocaleString('en-US') + ' tokens/s',
      scope: `${b.version} closed division · ${b.precision.toUpperCase()} weights · OpenOrca · ${online ? '2,000 ms first-token / 200 ms per-token limits' : 'Offline batch; no interactive latency target'}. The measured rate applies to this test. A different model, request pattern or software setup needs another benchmark.`,
      source: b.sourceUrl,
      lesson:
        'Keep model, precision, software, request distribution and latency targets attached to every performance number.',
      benchmarkId: b.id,
      description: {
        hardware: `This NVIDIA benchmark used one server with eight ${gpu} GPUs, each listed with ${s.accelerator_memory_capacity} of GPU memory. Its submitted configuration lists ${s.host_processors_per_node} ${s.host_processor_model_name} CPUs, ${s.host_memory_capacity} of host RAM, and ${s.host_storage_capacity} of storage. The server provides local NVLink connections between GPUs. The NIC inventory is listed as “${s.host_network_card_count}”; this one-server run does not isolate an external fabric’s contribution.`,
        result: `It served Llama 2 70B using ${b.precision.toUpperCase()} weights in MLPerf Inference ${b.version} with the OpenOrca dataset. The measured result was ${b.tokensPerSecond.toLocaleString('en-US')} output tokens per second across the system. ${online ? `The 99th-percentile time to the first token was ${Math.round(b.ttftP99Ms || 0).toLocaleString('en-US')} ms; time per subsequent output token was ${Math.round(b.tpotP99Ms || 0)} ms. The benchmark limits were 2,000 ms and 200 ms respectively.` : 'This is an Offline batch result. It does not establish interactive response times.'}`,
        meaning: `This is a measured ${online ? 'throughput-and-latency' : 'batch-throughput'} reference for these exact test conditions. It does not promise the same rate for a different model, context length or service target. The H100 and B300 records also use different precision and software, so their difference cannot be attributed to the GPU alone.${gpu === 'B300' ? ' The submitted 270 GB memory figure is retained here; the reference palette separately uses the nominal 288 GB specification.' : ''}`,
      },
      facts: [
        { label: 'Parallelism / batching', value: null, source: b.sourceUrl },
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
          value: online
            ? `${b.ttftP99Ms} ms / ${b.tpotP99Ms} ms`
            : 'Not an interactive test; no latency target',
          source: b.sourceUrl,
        },
      ],
    };
  }),
  {
    id: 'metaroce-2026',
    workloadKind: 'network',
    description: {
      hardware:
        'Meta and AMD tested a 64-node AMD GPU cluster with Pensando programmable network cards. The experiment compared MetaRoCE with RoCEv2 for GPU communication; the GPU model, CPU, RAM and storage configuration are not specified.',
      result:
        'The workload was RCCL all-reduce and all-to-all: operations that combine or exchange data among GPUs. Meta reported retaining about 86% throughput at 1% packet loss, alongside tests of four- and eight-plane network topologies.',
      meaning:
        'For a consultant, this is evidence about network behavior when packets are lost. It does not measure model training speed or inference tokens per second, and MetaRoCE is a distinct transport design from conventional RoCEv2.',
    },
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
