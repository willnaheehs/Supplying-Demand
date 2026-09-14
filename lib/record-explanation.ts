import type { ClusterRecord } from './cluster-evidence';

const networkSource =
  'https://engineering.fb.com/2024/08/05/data-center-engineering/roce-network-distributed-ai-training-at-scale/';
export function explainRecord(record: ClusterRecord, part: string) {
  if (record.workloadKind === 'inference') {
    const reasons: Record<string, string> = {
      workload:
        'The task is generating answers with Llama 2 70B. Model, precision, software and the OpenOrca request distribution are part of the tested setup. Batch throughput and interactive response time answer different client needs.',
      compute:
        'GPU memory holds weights and the live request state. GPU compute processes prompts, while compute and memory bandwidth both affect token generation. Eight GPUs provide capacity and parallel execution; the reported rate belongs to the complete software-and-hardware setup.',
      fabric:
        'This test uses one GPU server. NVLink is available for local GPU exchanges; no second GPU server or external spine is needed for inter-server model traffic in this run. The result does not show that InfiniBand improves inference or that RoCE would be slower.',
      frontend:
        'Client requests and responses still need a service network. Its required bandwidth depends on payloads and request rate. This submission does not measure a production north–south service or establish its required uplink speed.',
      storage:
        'The submitted SSD and CIFS storage hold model files and test data. Storage matters for loading and any runtime reads, but this result does not isolate storage speed or prove that extra storage increases steady-state tokens per second.',
      operations:
        'The submitted CPUs and host RAM support the runtime, data preparation and GPU scheduling. Their exact inventory is part of the tested system; the result does not isolate their speed contribution or prove this is the minimum host configuration.',
    };
    return {
      reason: reasons[part] || reasons.workload,
      evidence:
        'The benchmark demonstrates the complete system under its stated model, precision, software, quality and traffic conditions. It is not an experiment isolating the contribution of each part. Re-test a changed setup.',
      source: record.source,
    };
  }
  if (record.workloadKind === 'training') {
    const meta = record.id.startsWith('meta-');
    const reasons: Record<string, string> = {
      workload:
        'Training updates model weights repeatedly. Workers must compute, exchange model state and consume training data together. This source reports training use; it does not measure an inference service.',
      compute:
        'The GPUs perform forward and backward calculations and hold portions of training state. Splitting work across GPUs makes large training jobs possible, but adds communication and synchronization. GPU count alone does not establish time to train.',
      fabric: meta
        ? 'Training workers exchange gradients and other model data. The backend carries those exchanges; leaves and spines connect workers in different racks. Meta also adjusted job placement, routing and communication software to reduce congestion. Adding a spine helps only when the job needs that path or its capacity.'
        : 'NVLink/NVSwitch carry GPU exchanges inside a server; InfiniBand carries exchanges between servers. DeepSeek combined these links with pipeline and expert parallelism and communication overlap. The result depends on that joint design.',
      frontend: meta
        ? 'Meta separates dataset ingestion, checkpoints and logging from GPU-to-GPU training exchanges. Sufficient frontend bandwidth keeps those transfers from stalling the training job. The public design does not provide a per-client sizing rule.'
        : 'Dataset reads and checkpoint writes need a path to storage. This report does not disclose enough frontend detail to reproduce or size that path.',
      storage: meta
        ? 'Flash-backed Tectonic supports dataset reads and synchronized checkpoint saves and restores. Hammerspace also makes shared files available to workers. Their role is to feed and recover the job; the source does not establish required storage throughput for your model.'
        : 'Training needs datasets, model files and durable checkpoints. DeepSeek reports the training result but not a complete storage-server configuration, so an exact storage recommendation cannot be derived from this record.',
      operations:
        'CPUs and RAM support the training runtime and data preparation. Power, cooling and recovery affect sustained operation. Per-server host details are incomplete in this source; they must stay unknown rather than being filled with generic GPU-server specifications.',
    };
    return {
      reason: reasons[part] || reasons.workload,
      evidence: meta
        ? 'Meta reports successful training after tuning the complete system. That is evidence of a working training design, not proof of inference performance, minimum GPU count or an advantage over every other fabric.'
        : 'The report records DeepSeek-V3 training resource use for its own model and software. It does not predict the training time or inference rate of another workload.',
      source:
        meta && ['fabric', 'frontend'].includes(part)
          ? networkSource
          : record.source,
    };
  }
  return {
    reason: record.lesson,
    evidence: record.scope,
    source: record.source,
  };
}
