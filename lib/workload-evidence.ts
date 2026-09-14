export type WorkloadRequest = {
  kind: 'interactive' | 'batch' | 'training';
  model: string;
  tokensPerSecond: number;
  firstTokenMs: number;
  perTokenMs: number;
};

export type BenchmarkReference = {
  id: string;
  gpu: string;
  model: string;
  scenario: string;
  precision: string;
  tokensPerSecond: number;
  ttftP99Ms: number | null;
  tpotP99Ms: number | null;
};

export const defaultWorkloadRequest: WorkloadRequest = {
  kind: 'interactive',
  model: 'llama2-70b-99',
  tokensPerSecond: 1000,
  firstTokenMs: 2000,
  perTokenMs: 200,
};

export function benchmarkRecordId(b: BenchmarkReference) {
  return `mlperf-${b.gpu.toLowerCase()}${b.scenario === 'Offline' ? '-offline' : ''}`;
}

export function findWorkloadEvidence(
  request: WorkloadRequest,
  benchmarks: BenchmarkReference[],
): {
  level: 'measured' | 'reported' | 'none';
  recordIds: string[];
  message: string;
} {
  if (request.kind === 'training') {
    const id =
      request.model === 'llama3'
        ? 'meta-roce'
        : request.model === 'deepseek-v3'
          ? 'deepseek'
          : null;
    return id
      ? {
          level: 'reported',
          recordIds: [id],
          message:
            'A reported training deployment is available. This is not a sized recommendation for your own training run.',
        }
      : {
          level: 'none',
          recordIds: [],
          message:
            'No matching training record in this library. A model-specific training benchmark is needed before recommending a tested configuration.',
        };
  }
  const targets =
    request.kind === 'interactive'
      ? [request.tokensPerSecond, request.firstTokenMs, request.perTokenMs]
      : [request.tokensPerSecond];
  if (targets.some((n) => !Number.isFinite(n) || n <= 0)) {
    return {
      level: 'none',
      recordIds: [],
      message: 'Enter positive, finite performance targets.',
    };
  }
  const scenario = request.kind === 'interactive' ? 'Server' : 'Offline';
  const candidates = benchmarks.filter(
    (b) => b.model === request.model && b.scenario === scenario,
  );
  const matching = candidates.filter(
    (b) =>
      b.tokensPerSecond >= request.tokensPerSecond &&
      (request.kind === 'batch' ||
        (b.ttftP99Ms !== null &&
          b.tpotP99Ms !== null &&
          b.ttftP99Ms <= request.firstTokenMs &&
          b.tpotP99Ms <= request.perTokenMs)),
  );
  // Preserve library order. These records have different precision/software;
  // they are evidence choices, not a ranking of cost or hardware efficiency.
  return matching.length
    ? {
        level: 'measured',
        recordIds: matching.map(benchmarkRecordId),
        message:
          'These recorded runs meet the numeric targets under their own test conditions. Precision, software and request patterns must also suit your client.',
      }
    : {
        level: 'none',
        recordIds: [],
        message: candidates.length
          ? 'No recorded run meets all these targets. This does not mean the hardware cannot do it; a matching test is missing. Adding servers would be an unmeasured design.'
          : 'No benchmark for this model and workload in this library. A model with the same parameter count is not a substitute.',
      };
}

export function sourcePhaseAllowed(kind: string, phase: string) {
  if (kind === 'training')
    return ['train', 'load', 'checkpoint'].includes(phase);
  if (kind === 'inference')
    return ['prefill', 'decode', 'load'].includes(phase);
  return true;
}
