'use client';
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
  type ReactNode,
} from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Cpu,
  Database,
  Download,
  HardDrive,
  Network,
  Plus,
  Search,
  Server,
  X,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  catalogStats,
  emptyHardware,
  evidenceLabels,
  filterCatalog,
  metricText,
  type CatalogEntry,
  type CatalogFilter,
  type CatalogHardware,
} from '@/lib/catalog';
import manifest from '@/data/catalog-manifest.json';
import '@/app/catalog.css';

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="cat-choice">
      <span>{label}</span>
      <Select
        value={value || '__all'}
        items={[
          { value: '__all', label: 'All' },
          ...options.map(([value, label]) => ({ value, label })),
        ]}
        onValueChange={(v) =>
          v !== null && onChange(v === '__all' ? '' : String(v))
        }
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function FormChoice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="cat-field">
      <span>{label}</span>
      <Select
        value={value}
        onValueChange={(v) => v !== null && onChange(String(v))}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function Field({
  label,
  value,
  onChange,
  required,
  multiline,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const props = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    required,
    placeholder,
    maxLength: 4000,
  };
  return (
    <label className="cat-field">
      <span>
        {label}
        {required && ' *'}
      </span>
      {multiline ? (
        <Textarea {...props} rows={3} />
      ) : (
        <Input
          {...props}
          type={type}
          min={type === 'number' ? 0 : undefined}
          step={type === 'number' ? 'any' : undefined}
        />
      )}
    </label>
  );
}

const hardwareFields: [keyof CatalogHardware, string][] = [
  ['acceleratorMemory', 'Memory per accelerator'],
  ['cpu', 'CPU model'],
  ['cpusPerNode', 'CPUs per node'],
  ['ram', 'Host RAM per node'],
  ['scaleUp', 'Within-node interconnect'],
  ['network', 'Network / NICs'],
  ['topology', 'Network topology'],
  ['frontend', 'North–south network'],
  ['localStorage', 'Local storage per node'],
  ['sharedStorage', 'Shared storage'],
  ['storageServers', 'Storage servers'],
  ['countNote', 'Count / configuration notes'],
];
const numericHardware = [
  'acceleratorCount',
  'nodes',
  'acceleratorsPerNode',
  'cpusPerNode',
];
function ManualForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: CatalogEntry | null;
  onSaved: (entry: CatalogEntry) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    name: initial?.name || '',
    operator: initial?.operator || '',
    model: initial?.model || '',
    workloadKind: initial?.workloadKind || 'inference',
    evidenceKind: initial?.evidenceKind || 'deployment',
    scenario: initial?.scenario || '',
    precision: initial?.precision || '',
    date: initial?.date || '',
    suite: initial?.suite || '',
    software: initial?.software || '',
    conditions: initial?.conditions || '',
    outcome: initial?.outcome || '',
    limitation: initial?.limitation || '',
    metricName: initial?.metric?.name || '',
    metricValue: initial?.metric ? String(initial.metric.value) : '',
    unit: initial?.metric?.unit || '',
    direction: initial?.metric?.direction || 'context',
    ttft:
      initial?.ttftP99Ms === null || initial?.ttftP99Ms === undefined
        ? ''
        : String(initial.ttftP99Ms),
    tpot:
      initial?.tpotP99Ms === null || initial?.tpotP99Ms === undefined
        ? ''
        : String(initial.tpotP99Ms),
    sourceUrls: initial?.sources.map((s) => s.url).join('\n') || '',
    systemId: initial?.systemId || '',
  });
  const [hardware, setHardware] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initial?.hardware || emptyHardware).map(([k, v]) => [
        k,
        v === null ? '' : String(v),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const set = (key: keyof typeof draft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const hw = (key: string, value: string) =>
    setHardware((h) => ({ ...h, [key]: value }));
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/catalog', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          id: initial?.id,
          hardware: Object.fromEntries(
            Object.entries(hardware).map(([k, v]) => [
              k,
              v === '' ? null : numericHardware.includes(k) ? Number(v) : v,
            ]),
          ),
          metric:
            draft.metricValue === '' && !draft.metricName && !draft.unit
              ? null
              : {
                  name: draft.metricName,
                  value:
                    draft.metricValue === '' ? null : Number(draft.metricValue),
                  unit: draft.unit,
                  direction: draft.direction,
                },
          ttftP99Ms: draft.ttft === '' ? null : Number(draft.ttft),
          tpotP99Ms: draft.tpot === '' ? null : Number(draft.tpot),
          sources: draft.sourceUrls
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((url, i) => ({
              title:
                initial?.sources.find((s) => s.url === url)?.title ||
                `Source ${i + 1}`,
              url,
            })),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        record: CatalogEntry;
      };
      if (!response.ok)
        throw new Error(data.error || 'Could not save the record.');
      onSaved(data.record);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Save failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="cat-form" onSubmit={save}>
      <p className="cat-note">
        Your additions are saved to your signed-in account and labeled “User
        entered.” A source link records provenance; it does not certify the
        claim.
      </p>
      <div className="cat-form-grid">
        <Field
          label="System name"
          value={draft.name}
          onChange={(v) => set('name', v)}
          required
          placeholder="Provider · cluster or server"
        />
        <Field
          label="Operator / submitter"
          value={draft.operator}
          onChange={(v) => set('operator', v)}
          required
        />
        <FormChoice
          label="Workload"
          value={draft.workloadKind}
          options={['inference', 'training', 'network', 'unspecified']}
          onChange={(v) => set('workloadKind', v)}
        />
        <FormChoice
          label="Evidence type"
          value={draft.evidenceKind}
          options={['deployment', 'benchmark', 'training-trial', 'research']}
          onChange={(v) => set('evidenceKind', v)}
        />
        <Field
          label="Exact model / workload"
          value={draft.model}
          onChange={(v) => set('model', v)}
          required
          placeholder="Include model version and size"
        />
        <Field
          label="Scenario"
          value={draft.scenario}
          onChange={(v) => set('scenario', v)}
          required
          placeholder="Offline, Server, pretraining, LoRA…"
        />
        <Field
          label="Accelerator model"
          value={hardware.accelerator}
          onChange={(v) => hw('accelerator', v)}
          required
          placeholder="H100 SXM 80 GB"
        />
        <Field
          label="Total accelerators"
          value={hardware.acceleratorCount}
          onChange={(v) => hw('acceleratorCount', v)}
          type="number"
        />
        <Field
          label="Nodes"
          value={hardware.nodes}
          onChange={(v) => hw('nodes', v)}
          type="number"
        />
        <Field
          label="Accelerators per node"
          value={hardware.acceleratorsPerNode}
          onChange={(v) => hw('acceleratorsPerNode', v)}
          type="number"
        />
      </div>
      <details>
        <summary>
          CPU, networks, storage & software <ChevronDown size={14} />
        </summary>
        <p>Leave undisclosed specifications blank.</p>
        <div className="cat-form-grid">
          {hardwareFields.map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={hardware[key]}
              onChange={(v) => hw(key, v)}
              type={numericHardware.includes(key) ? 'number' : 'text'}
            />
          ))}
          <Field
            label="Software stack"
            value={draft.software}
            onChange={(v) => set('software', v)}
          />
          <Field
            label="Precision"
            value={draft.precision}
            onChange={(v) => set('precision', v)}
          />
        </div>
      </details>
      <Field
        label="What was achieved?"
        value={draft.outcome}
        onChange={(v) => set('outcome', v)}
        required
        multiline
        placeholder="Describe the reported result, or say that no numeric performance was disclosed."
      />
      <details open={!!initial?.metric}>
        <summary>
          Numeric result & latency (if measured) <ChevronDown size={14} />
        </summary>
        <div className="cat-form-grid">
          <Field
            label="Metric name"
            value={draft.metricName}
            onChange={(v) => set('metricName', v)}
            placeholder="Completed output throughput"
          />
          <Field
            label="Result value"
            value={draft.metricValue}
            onChange={(v) => set('metricValue', v)}
            type="number"
          />
          <Field
            label="Units"
            value={draft.unit}
            onChange={(v) => set('unit', v)}
            placeholder="Tokens/s, minutes, GPU-hours…"
          />
          <FormChoice
            label="How to interpret the value"
            value={draft.direction}
            options={['higher', 'lower', 'context']}
            onChange={(v) => set('direction', v)}
          />
          <Field
            label="P99 first-token latency (ms)"
            value={draft.ttft}
            onChange={(v) => set('ttft', v)}
            type="number"
          />
          <Field
            label="P99 output-token latency (ms)"
            value={draft.tpot}
            onChange={(v) => set('tpot', v)}
            type="number"
          />
        </div>
      </details>
      <Field
        label="Test conditions"
        value={draft.conditions}
        onChange={(v) => set('conditions', v)}
        required
        multiline
        placeholder="Input/output lengths, concurrency, batch, quality target, parallelism, dataset… State unknowns."
      />
      <Field
        label="Limits of this evidence"
        value={draft.limitation}
        onChange={(v) => set('limitation', v)}
        required
        multiline
        placeholder="What would need to be checked for a client's workload?"
      />
      <Field
        label="Source links · one per line"
        value={draft.sourceUrls}
        onChange={(v) => set('sourceUrls', v)}
        required
        multiline
        placeholder="https://… · link hardware details and measured results"
      />
      <div className="cat-form-grid">
        <Field
          label="Observation date (optional)"
          value={draft.date}
          onChange={(v) => set('date', v)}
          type="date"
        />
        <Field
          label="Benchmark suite / version"
          value={draft.suite}
          onChange={(v) => set('suite', v)}
        />
      </div>
      <details>
        <summary>Group with an existing system</summary>
        <Field
          label="System identifier"
          value={draft.systemId}
          onChange={(v) => set('systemId', v)}
          placeholder="Copy the system ID from another observation, or leave blank"
        />
      </details>
      {error && (
        <p role="alert" className="cat-error">
          {error}
        </p>
      )}
      <div className="cat-save">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Save observation'}
        </Button>
      </div>
    </form>
  );
}

export function CatalogMap({
  entry,
  onBack,
  onEdit,
}: {
  entry: CatalogEntry;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [part, setPart] = useState('compute');
  const h = entry.hardware;
  const training = entry.workloadKind === 'training';
  const parts: {
    id: string;
    title: string;
    icon: ReactNode;
    value: string | null;
    detail: string;
    role: string;
    ask: string;
  }[] = [
    {
      id: 'compute',
      title: 'Accelerator servers',
      icon: <Cpu />,
      value: h.accelerator,
      detail: `${h.acceleratorCount?.toLocaleString() || 'Undisclosed'} total accelerators · ${h.nodes?.toLocaleString() || 'undisclosed'} nodes · ${h.acceleratorsPerNode || '?'} per node. Memory per accelerator: ${h.acceleratorMemory || 'not disclosed'}. ${h.countNote || ''}`,
      role: training
        ? 'Accelerators calculate the forward pass, backward pass and updates. Memory must hold the model, activations and training state under the chosen partitioning.'
        : 'Accelerators calculate model outputs. Memory holds weights and workload state; language generation also needs a KV cache. Model size alone does not set the serving rate.',
      ask: 'Does the client have the same model, precision, batch and software? Verify memory fit and benchmark the actual request mix.',
    },
    {
      id: 'scaleUp',
      title: 'Within-node links',
      icon: <Network />,
      value: h.scaleUp,
      detail:
        h.scaleUp ||
        'The source does not identify the within-node accelerator interconnect.',
      role: 'These links carry transfers between accelerators when a workload is partitioned within a server. The parallelism strategy determines how often transfers occur.',
      ask: 'How are model layers, tensors or experts divided across accelerators? A faster link matters only when this path limits the job.',
    },
    {
      id: 'network',
      title: 'Network & topology',
      icon: <Network />,
      value: h.network,
      detail: `NIC / network disclosure: ${h.network || 'unknown'}. Topology: ${h.topology || 'unknown'}. Network roles are not assumed from a NIC name.`,
      role: training
        ? 'Workers exchange gradients, activations or expert tokens. Fabric bandwidth, congestion and placement can limit distributed training.'
        : 'A model split across servers communicates over the fabric. Independent replicas have different network needs from tensor, expert or context parallel serving.',
      ask: 'Ask for endpoint bandwidth, fabric role, oversubscription, rail layout and collective tests. A leaf/spine count cannot be inferred from GPU count.',
    },
    {
      id: 'storage',
      title: 'Storage & storage servers',
      icon: <HardDrive />,
      value: h.sharedStorage || h.localStorage,
      detail: `Local per node: ${h.localStorage || 'unknown'}. Shared: ${h.sharedStorage || 'unknown'}. Storage servers: ${h.storageServers || 'unknown'}.`,
      role: training
        ? 'Storage feeds training examples and writes checkpoints. Sustainable throughput and checkpoint pause/restart times affect useful training time.'
        : 'Storage loads weights and supplies application data. Disk capacity is not a measurement of steady-state token throughput.',
      ask: 'Measure data-loader throughput, checkpoint size and recovery time. Local SSD capacity alone does not establish shared storage performance.',
    },
    {
      id: 'frontend',
      title: 'North–south network',
      icon: <ArrowUpRight />,
      value: h.frontend,
      detail:
        h.frontend ||
        'No distinct frontend configuration is disclosed. Backend NICs are not automatically counted as client-facing capacity.',
      role: training
        ? 'Data ingestion, checkpoint movement and job management may use a separate frontend network.'
        : 'This carries client requests and responses, and often data or retrieval traffic. Its demand depends on payload size and request rate.',
      ask: 'Ask for usable ingress/egress, gateway limits, payload sizes and p99 application latency.',
    },
    {
      id: 'cpu',
      title: 'CPU & host memory',
      icon: <Server />,
      value: h.cpu,
      detail: `${h.cpusPerNode || 'Undisclosed'} CPUs per node. CPU: ${h.cpu || 'unknown'}. Host RAM per node: ${h.ram || 'unknown'}. Software: ${entry.software || 'not disclosed'}.`,
      role: 'Host processors schedule work, prepare data and feed accelerators. Host memory supports data loading, staging and runtime processes.',
      ask: 'Check preprocessing, tokenization, CPU utilization and host-memory pressure for the actual workload.',
    },
  ];
  const selected = parts.find((p) => p.id === part)!;
  return (
    <section
      className="cat-mapping"
      aria-label="Selected database configuration"
    >
      <div className="lab-toolbar">
        <div>
          <b>
            {entry.operator} · {entry.name}
          </b>
          <span>
            {entry.suite ||
              (entry.date
                ? `Reported ${entry.date}`
                : 'Report date not specified')}{' '}
            · reviewed {entry.reviewedAt}
          </span>
        </div>
        <div className="toolbar-actions">
          <span className="lc-evidence-badge reported">
            {entry.origin === 'manual'
              ? 'User entered · unverified'
              : evidenceLabels[entry.evidenceKind]}
          </span>
          {entry.origin === 'manual' && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit record
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to sandbox
          </Button>
        </div>
      </div>
      <div className="cat-map-layout">
        <div className="cat-diagram">
          <div className="cat-workload">
            <BookOpen size={20} />
            <div>
              <small>
                {entry.workloadKind.toUpperCase()} · {entry.scenario}
              </small>
              <strong>{entry.model}</strong>
            </div>
            <span>{entry.precision || 'Precision not disclosed'}</span>
          </div>
          <div className="cat-flow-label">
            <ArrowDown size={18} /> Published configuration · click a component
          </div>
          <div className="cat-parts">
            {parts.map((p) => (
              <button
                key={p.id}
                className={`cat-part cat-part-${p.id} ${p.id === part ? 'selected' : ''} ${p.value ? '' : 'unknown'}`}
                onClick={() => setPart(p.id)}
                aria-pressed={p.id === part}
              >
                {p.icon}
                <small>{p.title}</small>
                <strong>{p.value || 'Not disclosed'}</strong>
                {p.id === 'compute' && (
                  <span>
                    {h.acceleratorCount?.toLocaleString() || '?'} accelerators ·{' '}
                    {h.nodes?.toLocaleString() || '?'} nodes
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="cat-flow-label">
            <ArrowDown size={18} /> Observed together · individual component
            effects not isolated
          </div>
          <div className="cat-result">
            <div>
              <small>{entry.metric?.name || 'Reported outcome'}</small>
              <strong>{metricText(entry)}</strong>
              {entry.metric && (
                <span>
                  {entry.metric.direction === 'context'
                    ? 'Interpret within these conditions'
                    : `${entry.metric.direction === 'higher' ? 'Higher' : 'Lower'} is better for this metric under comparable conditions`}
                </span>
              )}
            </div>
            <p>{entry.outcome}</p>
          </div>
        </div>
        <aside className="cat-inspector">
          <span className="lab-eyebrow">HOW THE HARDWARE CONTRIBUTES</span>
          <h2>{selected.title}</h2>
          <p>{selected.detail}</p>
          <h3>Role in this workload</h3>
          <p>{selected.role}</p>
          <h3>What to verify for a client</h3>
          <p>{selected.ask}</p>
          <p className="cat-note">
            The role explanation is general engineering guidance. The source
            result measures the whole configuration, not the isolated benefit of
            this component.
          </p>
        </aside>
      </div>
      <div className="cat-evidence-detail">
        <div>
          <h3>Conditions behind the outcome</h3>
          <p>{entry.conditions}</p>
          {(entry.ttftP99Ms !== null || entry.tpotP99Ms !== null) && (
            <p>
              P99 first token:{' '}
              {entry.ttftP99Ms === null
                ? 'not disclosed'
                : `${entry.ttftP99Ms.toFixed(2)} ms`}{' '}
              · P99 output token:{' '}
              {entry.tpotP99Ms === null
                ? 'not disclosed'
                : `${entry.tpotP99Ms.toFixed(2)} ms`}
            </p>
          )}
          <p className="cat-note">{entry.limitation}</p>
        </div>
        <div>
          <h3>Evidence trail</h3>
          {entry.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
              <ArrowUpRight size={13} />
            </a>
          ))}
          <small>System ID: {entry.systemId}</small>
          <small>Observation ID: {entry.id}</small>
        </div>
      </div>
    </section>
  );
}

export default function ClusterCatalog({
  open,
  onOpenChange: setOpen,
  openSignal,
  onSelect,
  onStats,
  selectedId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openSignal: number;
  onSelect: (entry: CatalogEntry) => void;
  onStats: (count: number) => void;
  selectedId: string | null;
}) {
  const [records, setRecords] = useState<CatalogEntry[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>({}),
    [limit, setLimit] = useState(6);
  const [formOpen, setFormOpen] = useState(false),
    [editing, setEditing] = useState<CatalogEntry | null>(null),
    [saved, setSaved] = useState('');
  const ref = useRef<HTMLElement>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch('/api/catalog', { signal });
        const data = (await response.json()) as {
          error?: string;
          records: CatalogEntry[];
        };
        if (!response.ok)
          throw new Error(data.error || 'Could not load the database.');
        setError('');
        setRecords(data.records);
        onStats(data.records.length);
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : 'Could not load records.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [onStats],
  );
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (openSignal) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [openSignal]);
  useEffect(() => {
    const edit = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const entry = records.find((r) => r.id === id && r.origin === 'manual');
      if (entry) {
        setEditing(entry);
        setFormOpen(true);
      }
    };
    window.addEventListener('edit-catalog-entry', edit);
    return () => window.removeEventListener('edit-catalog-entry', edit);
  }, [records]);
  const stats = catalogStats(records);
  const update = (key: keyof CatalogFilter, value: string) => {
    setFilter((f) => ({
      ...f,
      [key]: value,
      ...(key === 'unit' && !value ? { minimum: '' } : {}),
    }));
    setLimit(6);
  };
  const filtered = useMemo(
    () =>
      filterCatalog(records, filter).sort(
        (a, b) =>
          (a.origin === 'manual'
            ? 0
            : ['deployment', 'research'].includes(a.evidenceKind)
              ? 1
              : 2) -
            (b.origin === 'manual'
              ? 0
              : ['deployment', 'research'].includes(b.evidenceKind)
                ? 1
                : 2) ||
          (b.suite || '').localeCompare(a.suite || '') ||
          a.operator.localeCompare(b.operator) ||
          a.model.localeCompare(b.model),
      ),
    [records, filter],
  );
  const options = (
    getter: (r: CatalogEntry) => string | null,
  ): [string, string][] =>
    Array.from(new Set(records.map(getter).filter((v): v is string => !!v)))
      .sort()
      .map((v) => [v, v]);
  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            manifest,
            records,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supplying-demand-catalog.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="cat-library" ref={ref} aria-labelledby="catalog-title">
      <div className="cat-heading">
        <button
          className="cat-heading-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <Database size={20} />
          <div>
            <h2 id="catalog-title">Cluster database</h2>
            <span>
              {loading
                ? 'Loading sourced configurations…'
                : `${stats.records.toLocaleString()} observations · ${stats.systems} system configurations · ${stats.operators} operators / submitters`}
            </span>
          </div>
          <ChevronDown size={17} />
        </button>
        <div className="cat-heading-actions">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !!error}
            onClick={exportData}
          >
            <Download size={14} />
            Export
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={14} />
            Add observation
          </Button>
        </div>
      </div>
      {saved && (
        <output className="cat-saved">
          {saved}
          <button
            onClick={() => setSaved('')}
            aria-label="Dismiss save message"
          >
            <X size={14} />
          </button>
        </output>
      )}
      {open && (
        <div className="cat-library-content">
          <div className="cat-search">
            <Search size={17} />
            <Input
              aria-label="Search cluster database"
              placeholder="Start with hardware or a workload: H100 RoCE, Llama, AMD, storage…"
              value={filter.query || ''}
              onChange={(e) => update('query', e.target.value)}
            />
          </div>
          <div className="cat-filters">
            <Choice
              label="Workload"
              value={filter.workload || ''}
              options={['inference', 'training', 'network', 'unspecified'].map(
                (v) => [v, v],
              )}
              onChange={(v) => update('workload', v)}
            />
            <Choice
              label="Evidence"
              value={filter.evidence || ''}
              options={[
                ...Object.entries(evidenceLabels),
                ['manual', 'My additions'],
              ]}
              onChange={(v) => update('evidence', v)}
            />
            <Choice
              label="Exact model"
              value={filter.model || ''}
              options={options((r) => r.model)}
              onChange={(v) => update('model', v)}
            />
            <Choice
              label="Accelerator"
              value={filter.accelerator || ''}
              options={options((r) => r.hardware.accelerator)}
              onChange={(v) => update('accelerator', v)}
            />
          </div>
          <details className="cat-more-filters">
            <summary>Filter by outcome & test conditions</summary>
            <div className="cat-filters">
              <Choice
                label="Scenario"
                value={filter.scenario || ''}
                options={options((r) => r.scenario)}
                onChange={(v) => update('scenario', v)}
              />
              <Choice
                label="Result units"
                value={filter.unit || ''}
                options={options((r) => r.metric?.unit || null)}
                onChange={(v) => update('unit', v)}
              />
              <label className="cat-choice" htmlFor="catalog-minimum">
                <span>Minimum recorded value</span>
                <Input
                  id="catalog-minimum"
                  type="number"
                  min="0"
                  step="any"
                  disabled={!filter.unit}
                  value={filter.minimum || ''}
                  onChange={(e) => update('minimum', e.target.value)}
                  placeholder={
                    filter.unit ? `In ${filter.unit}` : 'Choose units first'
                  }
                />
              </label>
            </div>
            <p>
              Filters find observations, not guaranteed fits. Same units do not
              make different models, releases, precision or latency targets
              comparable. For time or resource cost, a lower value may be
              better.
            </p>
          </details>
          {error ? (
            <p role="alert" className="cat-error">
              {error}{' '}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  setError('');
                  void load();
                }}
              >
                Retry
              </Button>
            </p>
          ) : loading ? (
            <output className="cat-note">
              Loading the source catalog and your saved observations…
            </output>
          ) : (
            <>
              <div className="cat-results-heading">
                <span>
                  {filtered.length} observations match · select one to map its
                  configuration
                </span>
                {Object.values(filter).some(Boolean) && (
                  <button
                    onClick={() => {
                      setFilter({});
                      setLimit(6);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="cat-cards">
                {filtered.slice(0, limit).map((entry) => (
                  <button
                    key={entry.id}
                    className={`cat-card ${selectedId === entry.id ? 'active' : ''}`}
                    onClick={() => {
                      onSelect(entry);
                      setOpen(false);
                    }}
                  >
                    <span className="cat-card-kind">
                      {entry.origin === 'manual'
                        ? 'USER ENTERED · UNVERIFIED'
                        : evidenceLabels[entry.evidenceKind].toUpperCase()}
                      <ArrowUpRight size={15} />
                    </span>
                    <strong>
                      {entry.operator} · {entry.name}
                    </strong>
                    <span className="cat-card-hardware">
                      <Cpu size={13} />
                      {entry.hardware.acceleratorCount?.toLocaleString() ||
                        '?'}{' '}
                      × {entry.hardware.accelerator}
                    </span>
                    <span className="cat-card-workload">
                      <ArrowRight size={14} />
                      {entry.model} · {entry.scenario}
                    </span>
                    <b>{metricText(entry)}</b>
                    <small>
                      {entry.suite ||
                        (entry.date
                          ? `Reported ${entry.date}`
                          : 'Date not specified')}
                    </small>
                  </button>
                ))}
              </div>
              {!filtered.length && (
                <p className="cat-empty">
                  No records match these filters. Clear a filter or add a
                  sourced observation; a missing record does not mean the
                  hardware cannot run the workload.
                </p>
              )}
              {filtered.length > limit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="cat-load-more"
                  onClick={() => setLimit((n) => n + 12)}
                >
                  Show 12 more · {filtered.length - limit} remaining
                </Button>
              )}
            </>
          )}
          <details className="cat-method">
            <summary>Coverage, sources & how to read the evidence</summary>
            <p>{manifest.method}</p>
            <p>{manifest.counting}</p>
            <p>
              {stats.measured} benchmark / trial records · {stats.reports}{' '}
              operator / research reports · {stats.manual} manual additions.
              Source snapshot reviewed {manifest.reviewedAt}. Manual additions
              are private to your signed-in account. Hardware is transcribed
              where disclosed; an unknown value is never treated as zero.
            </p>
            <p>
              Training trial minutes are not official aggregate scores or full
              pretraining time. Reported production use is not a controlled
              benchmark. None of these records establishes current rental
              availability.
            </p>
            <a
              href="https://github.com/willnaheehs/supplying-demand/tree/main/data"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source snapshots & import manifest <ArrowUpRight size={13} />
            </a>
          </details>
        </div>
      )}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="catalog-sheet" side="right">
          <SheetHeader>
            <SheetTitle>
              {editing ? 'Edit observation' : 'Add a cluster observation'}
            </SheetTitle>
            <SheetDescription>
              Connect a specific configuration to a workload and its reported
              result.
            </SheetDescription>
          </SheetHeader>
          {formOpen && (
            <ManualForm
              key={editing?.id || 'new'}
              initial={editing}
              onCancel={() => setFormOpen(false)}
              onSaved={(entry) => {
                const next = [
                  entry,
                  ...records.filter((r) => r.id !== entry.id),
                ];
                setRecords(next);
                onStats(next.length);
                setFormOpen(false);
                setSaved(
                  'Saved to your database. This observation will be here when you return.',
                );
                onSelect(entry);
                setOpen(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
