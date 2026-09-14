export type CatalogHardware = {
  accelerator: string;
  acceleratorCount: number | null;
  nodes: number | null;
  acceleratorsPerNode: number | null;
  countNote: string | null;
  acceleratorMemory: string | null;
  cpu: string | null;
  cpusPerNode: number | null;
  ram: string | null;
  localStorage: string | null;
  sharedStorage: string | null;
  storageServers: string | null;
  scaleUp: string | null;
  network: string | null;
  topology: string | null;
  frontend: string | null;
};
export type CatalogEntry = {
  id: string;
  systemId: string;
  name: string;
  operator: string;
  evidenceKind: 'benchmark' | 'training-trial' | 'deployment' | 'research';
  workloadKind: 'inference' | 'training' | 'network' | 'unspecified';
  model: string;
  scenario: string;
  precision: string | null;
  date: string | null;
  reviewedAt: string;
  suite: string | null;
  hardware: CatalogHardware;
  software: string | null;
  metric: {
    name: string;
    value: number;
    unit: string;
    direction: 'higher' | 'lower' | 'context';
  } | null;
  ttftP99Ms: number | null;
  tpotP99Ms: number | null;
  conditions: string;
  outcome: string;
  limitation: string;
  sources: { title: string; url: string }[];
  origin: 'seed' | 'manual';
  updatedAt?: string;
};

export const evidenceLabels: Record<CatalogEntry['evidenceKind'], string> = {
  benchmark: 'Measured inference',
  'training-trial': 'Training trial',
  deployment: 'Operator report',
  research: 'Research result',
};
export const emptyHardware: CatalogHardware = {
  accelerator: '',
  acceleratorCount: null,
  nodes: null,
  acceleratorsPerNode: null,
  countNote: null,
  acceleratorMemory: null,
  cpu: null,
  cpusPerNode: null,
  ram: null,
  localStorage: null,
  sharedStorage: null,
  storageServers: null,
  scaleUp: null,
  network: null,
  topology: null,
  frontend: null,
};
export function metricText(entry: CatalogEntry): string {
  return entry.metric
    ? `${entry.metric.value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${entry.metric.unit}`
    : 'No numeric result disclosed';
}
export function catalogStats(entries: CatalogEntry[]) {
  return {
    records: entries.length,
    systems: new Set(entries.map((r) => r.systemId)).size,
    operators: new Set(entries.map((r) => r.operator.toLowerCase())).size,
    measured: entries.filter(
      (r) =>
        r.evidenceKind === 'benchmark' || r.evidenceKind === 'training-trial',
    ).length,
    reports: entries.filter(
      (r) => r.evidenceKind === 'deployment' || r.evidenceKind === 'research',
    ).length,
    manual: entries.filter((r) => r.origin === 'manual').length,
  };
}

export type CatalogFilter = {
  query?: string;
  workload?: string;
  evidence?: string;
  model?: string;
  accelerator?: string;
  scenario?: string;
  unit?: string;
  minimum?: string;
};
export function filterCatalog(entries: CatalogEntry[], filter: CatalogFilter) {
  const words = (filter.query || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return entries.filter((r) => {
    if (filter.workload && r.workloadKind !== filter.workload) return false;
    if (
      filter.evidence === 'manual'
        ? r.origin !== 'manual'
        : filter.evidence && r.evidenceKind !== filter.evidence
    )
      return false;
    if (filter.model && r.model !== filter.model) return false;
    if (filter.scenario && r.scenario !== filter.scenario) return false;
    if (filter.accelerator && r.hardware.accelerator !== filter.accelerator)
      return false;
    if (filter.unit && r.metric?.unit !== filter.unit) return false;
    // A numeric threshold is meaningful only with an explicit metric unit.
    if (
      filter.minimum &&
      (!filter.unit ||
        !Number.isFinite(Number(filter.minimum)) ||
        !r.metric ||
        r.metric.value < Number(filter.minimum))
    )
      return false;
    const text = [
      r.name,
      r.operator,
      r.model,
      r.scenario,
      r.suite,
      ...Object.values(r.hardware),
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

function text(
  value: unknown,
  label: string,
  max: number,
  required = false,
): string | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    Array.from(value).some(
      (char) =>
        char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)),
    )
  )
    throw new Error(`${label} must be text, up to ${max} characters.`);
  if (!value.trim()) {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  return value.trim();
}
function number(value: unknown, label: string, whole = false): number | null {
  if (value === '' || value === null || value === undefined) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1e15 ||
    (whole && (!Number.isInteger(value) || value === 0))
  )
    throw new Error(
      `${label} must be a ${whole ? 'positive whole' : 'nonnegative finite'} number.`,
    );
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a record object.');
  return value as Record<string, unknown>;
}
function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !choices.includes(value as T))
    throw new Error(`${label} is invalid.`);
  return value as T;
}
export function validateManualEntry(
  input: unknown,
  id: string,
  now: string,
): CatalogEntry {
  const x = object(input),
    h = object(x.hardware);
  const hardware = { ...emptyHardware };
  for (const key of Object.keys(emptyHardware) as (keyof CatalogHardware)[]) {
    if (
      [
        'acceleratorCount',
        'nodes',
        'acceleratorsPerNode',
        'cpusPerNode',
      ].includes(key)
    ) {
      (hardware as Record<string, unknown>)[key] = number(h[key], key, true);
    } else {
      (hardware as Record<string, unknown>)[key] = text(
        h[key],
        key,
        2000,
        key === 'accelerator',
      );
    }
  }
  const sources = x.sources;
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 8)
    throw new Error('Provide between 1 and 8 source links.');
  const safeSources = sources.map((s) => {
    const item = object(s);
    const url = text(item.url, 'Source URL', 2000, true)!;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Source links must be valid HTTP or HTTPS URLs.');
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error(
        'Source links must use HTTP or HTTPS without embedded credentials.',
      );
    return {
      title: text(item.title, 'Source title', 200, true)!,
      url: parsed.href,
    };
  });
  let metric: CatalogEntry['metric'] = null;
  if (x.metric !== null && x.metric !== undefined) {
    const m = object(x.metric),
      value = number(m.value, 'Result');
    if (value === null)
      throw new Error('Enter a result value or leave the entire metric blank.');
    metric = {
      name: text(m.name, 'Metric name', 120, true)!,
      value,
      unit: text(m.unit, 'Metric unit', 60, true)!,
      direction: choice(
        m.direction,
        ['higher', 'lower', 'context'],
        'Metric direction',
      ),
    };
  }
  const day = text(x.date, 'Observation date', 10);
  if (
    day &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(day)) ||
      new Date(day).toISOString().slice(0, 10) !== day ||
      day > now.slice(0, 10))
  )
    throw new Error('Use a real observation date, today or earlier.');
  const evidenceKind = choice(
    x.evidenceKind,
    ['benchmark', 'training-trial', 'deployment', 'research'],
    'Evidence type',
  );
  const workloadKind = choice(
    x.workloadKind,
    ['inference', 'training', 'network', 'unspecified'],
    'Workload',
  );
  if (
    (evidenceKind === 'benchmark' || evidenceKind === 'training-trial') &&
    !metric
  )
    throw new Error(
      'A benchmark or training trial needs a numeric result and units.',
    );
  if (evidenceKind === 'benchmark' && workloadKind !== 'inference')
    throw new Error('Measured inference evidence needs an inference workload.');
  if (evidenceKind === 'training-trial' && workloadKind !== 'training')
    throw new Error('A training trial needs a training workload.');
  return {
    id,
    systemId:
      text(x.systemId, 'System identifier', 160) || `manual-system-${id}`,
    name: text(x.name, 'System name', 240, true)!,
    operator: text(x.operator, 'Operator / submitter', 160, true)!,
    evidenceKind,
    workloadKind,
    model: text(x.model, 'Model / workload', 200, true)!,
    scenario: text(x.scenario, 'Test scenario', 160, true)!,
    precision: text(x.precision, 'Precision', 100),
    date: day,
    reviewedAt: now.slice(0, 10),
    suite: text(x.suite, 'Benchmark suite', 160),
    hardware,
    software: text(x.software, 'Software', 4000),
    metric,
    ttftP99Ms: number(x.ttftP99Ms, 'P99 first-token latency'),
    tpotP99Ms: number(x.tpotP99Ms, 'P99 output-token latency'),
    conditions: text(x.conditions, 'Conditions', 4000, true)!,
    outcome: text(x.outcome, 'Outcome', 4000, true)!,
    limitation: text(x.limitation, 'Limitations', 2000, true)!,
    sources: safeSources,
    origin: 'manual',
    updatedAt: now,
  };
}
