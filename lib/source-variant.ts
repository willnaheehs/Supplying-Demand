import type { ClusterRecord, benchmarks } from './cluster-evidence';
import {
  gpuSpecs,
  initialScenario,
  withWorkload,
  type Scenario,
} from './cluster-lab.ts';
import type { WorkloadRequest } from './workload-evidence';

export function sourceVariant(
  record: ClusterRecord,
  benchmark?: (typeof benchmarks)[number],
  target?: WorkloadRequest | null,
): Scenario {
  const gpu =
    record.gpu === 'B300' ? 'B300' : record.gpu === 'H200' ? 'H200' : 'H100';
  const s: Scenario = {
    ...initialScenario,
    gpu,
    hbm: benchmark
      ? parseFloat(benchmark.systemMetadata.accelerator_memory_capacity)
      : gpuSpecs[gpu].hbm,
    nodes: benchmark ? benchmark.nodes : 2,
    group: 8,
    cores: benchmark
      ? benchmark.systemMetadata.host_processors_per_node *
        benchmark.systemMetadata.host_processor_core_count
      : gpuSpecs[gpu].cores,
    linkGbps: gpuSpecs[gpu].link,
    fabric: record.fabric.includes('InfiniBand') ? 'ib' : 'roce',
    weightBytes: benchmark ? (benchmark.precision === 'fp4' ? 0.5 : 1) : 2,
    ...(target && target.kind !== 'training'
      ? {
          targetTps: target.tokensPerSecond,
          ttftMs: target.firstTokenMs,
          tpotMs: target.perTokenMs,
        }
      : {}),
  };
  // A source is not a complete planning model. Unspecified fields stay explicitly
  // assumed; training references must never silently become inference scenarios.
  return withWorkload(
    s,
    record.workloadKind === 'training' ? 'training' : 'inference',
  );
}
