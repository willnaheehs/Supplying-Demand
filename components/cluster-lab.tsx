'use client';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Download,
  FileUp,
  GripVertical,
  HardDrive,
  Info,
  Network,
  Plus,
  RotateCcw,
  Server,
  SlidersHorizontal,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  clusterRecords,
  benchmarks,
  type ClusterRecord,
} from '@/lib/cluster-evidence';
import {
  analyzeScenario,
  applyComponent,
  gpuSpecs,
  initialScenario,
  palette,
  phaseInfo,
  validateScenario,
  withWorkload,
  clientProfiles,
  withClient,
  type Scenario,
  type Phase,
} from '@/lib/cluster-lab';
import { fmt } from '@/lib/consulting';
import { describeScenario } from '@/lib/cluster-description';
import MatchingDesk from '@/components/matching-desk';
import WorkloadFinder from '@/components/workload-finder';
import ClusterCatalog, { CatalogMap } from '@/components/cluster-catalog';
import type { CatalogEntry } from '@/lib/catalog';
import catalogManifest from '@/data/catalog-manifest.json';
import { explainRecord } from '@/lib/record-explanation';
import {
  sourcePhaseAllowed,
  defaultWorkloadRequest,
  type WorkloadRequest,
} from '@/lib/workload-evidence';
import { sourceVariant } from '@/lib/source-variant';
import '@/app/matching-desk.css';

type Part =
  | 'workload'
  | 'compute'
  | 'fabric'
  | 'frontend'
  | 'storage'
  | 'operations';
const partNames: Record<Part, string> = {
  workload: 'Client & workload',
  compute: 'GPU servers',
  fabric: 'Compute fabric',
  frontend: 'North–south network',
  storage: 'Storage servers',
  operations: 'CPU, power & operations',
};
const color: Record<Part, string> = {
  workload: '#8b79ae',
  compute: '#2e9274',
  fabric: '#547ec0',
  frontend: '#b99145',
  storage: '#b99145',
  operations: '#8097a5',
};
function Pick({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: [string, string][];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="lc-field">
      <label id={id}>{label}</label>
      <Select
        value={value}
        items={choices.map(([value, label]) => ({ value, label }))}
        onValueChange={(v) => v !== null && onChange(String(v))}
      >
        <SelectTrigger aria-labelledby={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="lc-toggle">
      <label htmlFor={id}>{label}</label>
      <Switch id={id} checked={value} onCheckedChange={onChange} />
    </div>
  );
}
function save(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function sourceLink(url: string, label = 'Source') {
  return (
    <a className="lab-source" href={url} target="_blank" rel="noreferrer">
      {label}
      <ArrowUpRight size={13} />
    </a>
  );
}
const teaching: Record<
  Part,
  { reason: string; verify: string; source: string }
> = {
  workload: {
    reason:
      'Model identity, precision, sequence length, concurrency and the service target belong together. A parameter count alone does not determine the right system.',
    verify:
      'Collect the model revision, quality target, request trace or training token budget, and the software configuration.',
    source: 'https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html',
  },
  compute: {
    reason:
      'HBM must hold resident state. GPU compute and memory bandwidth then affect how fast the work runs. Adding GPU memory only establishes a capacity possibility.',
    verify:
      'Profile peak memory per GPU and benchmark the exact model, precision, sharding and load. More aggregate HBM is not automatically one shared pool.',
    source: 'https://huggingface.co/docs/transformers/model_memory_anatomy',
  },
  fabric: {
    reason:
      'The backend joins GPUs that must exchange tensors. A spine is useful when communicating endpoints span leaves. Keeping tightly coupled work local can reduce cross-leaf demand.',
    verify:
      'Measure collectives and exposed communication in the real job. Verify NIC affinity, routing, congestion control, optics and failure behavior.',
    source:
      'https://engineering.fb.com/2024/08/05/data-center-engineering/roce-network-distributed-ai-training-at-scale/',
  },
  frontend: {
    reason:
      'The frontend carries client traffic, data ingestion, model loading and checkpoint writes. It is separate from the GPU-to-GPU fabric in this scenario.',
    verify:
      'Budget simultaneous traffic in each direction. Then validate the slowest link, bursts, service latency and failover; do not size it from GPU FLOPS.',
    source:
      'https://engineering.fb.com/2024/08/05/data-center-engineering/roce-network-distributed-ai-training-at-scale/',
  },
  storage: {
    reason:
      'Storage capacity keeps datasets and checkpoints. Storage-server CPUs, RAM, NICs, drive tiers, metadata and data protection determine the deliverable I/O.',
    verify:
      'Measure end-to-end durable reads/writes beyond RAM cache, with actual file sizes and concurrent clients. Include degraded operation and restore tests.',
    source: 'https://docs.nvidia.com/gpudirect-storage/design-guide/',
  },
  operations: {
    reason:
      'CPUs prepare data and schedule work; RAM and local NVMe buffer the working set. Power, cooling, management and recovery determine sustained usable capacity.',
    verify:
      'Profile preprocessing and NUMA locality, then verify power delivery, cooling, BMC access, scheduler placement and recovery with the OEM and operator.',
    source:
      'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html',
  },
};
export default function ClusterLab() {
  const [catalogSelection, setCatalogSelection] = useState<CatalogEntry | null>(
    null,
  );
  const [catalogOpenSignal, setCatalogOpenSignal] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [catalogCount, setCatalogCount] = useState(catalogManifest.recordCount);
  const catalogMapRef = useRef<HTMLDivElement>(null);
  const labRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDetailsElement>(null);
  const [scenario, setScenario] = useState<Scenario>({ ...initialScenario });
  const [recordId, setRecordId] = useState('mlperf-h100');
  const [workloadTarget, setWorkloadTarget] = useState<WorkloadRequest | null>(
    defaultWorkloadRequest,
  );
  const [observed, setObserved] = useState(true);
  const [part, setPart] = useState<Part>('compute');
  const [phase, setPhase] = useState<Phase>('decode');
  const [inspector, setInspector] = useState('explain');
  const [benchmarkScenario, setBenchmarkScenario] = useState('Server');
  const [drag, setDrag] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [showData, setShowData] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [clientName, setClientName] = useState('My cluster scenario');
  const [baseline, setBaseline] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<HTMLElement>(null);
  const record = clusterRecords.find((r) => r.id === recordId)!;
  const recordBenchmark = benchmarks.find((b) => b.id === record.benchmarkId);
  const singleNodeEvidence = observed && record.nodeCount === 1;
  const recordExplanation = explainRecord(record, part);
  const a = analyzeScenario(scenario);
  const phaseData = phaseInfo[phase];
  const description = observed
    ? record.description
    : describeScenario(scenario);
  const descriptionHardwareSource = record.benchmarkId
    ? benchmarks.find((b) => b.id === record.benchmarkId)!.systemUrl
    : record.source;
  const selectPart = (p: Part) => {
    setPart(p);
    setInspector('explain');
  };
  const selectRecord = (id: string, target?: WorkloadRequest) => {
    const selected = clusterRecords.find((r) => r.id === id);
    if (!selected) return;
    setRecordId(id);
    setWorkloadTarget(target || null);
    setObserved(true);
    setInspector('explain');
    setPart('compute');
    setPhase(selected.workloadKind === 'inference' ? 'decode' : 'train');
    const b = benchmarks.find((b) => b.id === selected.benchmarkId);
    if (b) setBenchmarkScenario(b.scenario);
    setNotice('');
  };
  const startVariant = (r: ClusterRecord = record) => {
    const b = benchmarks.find((b) => b.id === r.benchmarkId);
    const s = sourceVariant(r, b, workloadTarget);
    setScenario(s);
    setObserved(false);
    setBaseline(r.name);
    setClientName('Variant · ' + r.name);
    setPhase(s.workload === 'training' ? 'train' : 'decode');
    setInspector('configure');
    setNotice(
      b
        ? 'Compute fields come from this submission. Workload, frontend and storage assumptions remain editable; its measured throughput does not transfer automatically.'
        : r.id === 'deepseek'
          ? 'Created an unmeasured dense-model training scenario on reference H100s. This calculator cannot reproduce DeepSeek-V3’s MoE model or H800 result.'
          : `Created a two-server ${s.workload} planning scenario. Model size and undisclosed fields are assumptions; this does not reproduce the production cluster.`,
    );
    return s;
  };
  const change = (key: keyof Scenario, value: Scenario[keyof Scenario]) => {
    if (observed) {
      const s = startVariant();
      setScenario({ ...s, [key]: value });
    } else setScenario((prev) => ({ ...prev, [key]: value }));
  };
  const apply = (id: string) => {
    const s = observed ? startVariant() : scenario;
    setScenario(applyComponent(s, id));
    setObserved(false);
    setInspector('configure');
    const item = palette.find((x) => x.id === id)!;
    setPart(item.zone as Part);
    setDrag(null);
    setNotice(
      `${item.label} applied. Scenario outputs recalculated; source measurements remain unchanged.`,
    );
  };
  const drop = (ev: DragEvent, zone: Part) => {
    ev.preventDefault();
    ev.stopPropagation();
    const id = ev.dataTransfer.getData('application/x-supplying-demand');
    const item = palette.find((x) => x.id === id);
    if (item?.zone === zone) apply(id);
    else if (item)
      setNotice(
        `Drop ${item.label} on ${partNames[item.zone as Part]}, or click its palette button.`,
      );
    setDrag(null);
  };
  const numeric = (
    key: keyof Scenario,
    label: string,
    { min = 0, max = 1e9, integer = false, hint = '' } = {},
  ) => (
    <div className="lc-field" key={key}>
      <label htmlFor={`lab-${key}`}>{label}</label>
      <input
        id={`lab-${key}`}
        type="number"
        value={Number(scenario[key])}
        min={min}
        max={max}
        step={integer ? 1 : 'any'}
        onChange={(ev) => {
          let value = Number(ev.target.value);
          if (!Number.isFinite(value)) return;
          value = Math.max(min, Math.min(max, value));
          if (integer) value = Math.round(value);
          change(key, value);
        }}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
  const selectPhase = (p: Phase) => {
    setPhase(p);
    if (!observed && (p === 'train' || p === 'prefill' || p === 'decode'))
      setScenario((s) =>
        withWorkload(s, p === 'train' ? 'training' : 'inference'),
      );
  };
  const exportScenario = () =>
    save(
      'supplying-demand-scenario.json',
      JSON.stringify(
        {
          version: 2,
          clientName,
          scenario,
          sourceRecordId: recordId,
          baseline,
          observed,
        },
        null,
        2,
      ),
      'application/json',
    );
  const importScenario = async (file: File) => {
    try {
      if (file.size > 2e6) throw new Error('Choose a file under 2 MB.');
      const data = JSON.parse(await file.text());
      if (data.version !== 2)
        throw new Error('This canvas imports version 2 scenario files.');
      const next = validateScenario(data.scenario);
      if (typeof data.clientName !== 'string' || data.clientName.length > 300)
        throw new Error('Invalid scenario name.');
      setScenario(next);
      setClientName(data.clientName);
      setObserved(false);
      setBaseline(typeof data.baseline === 'string' ? data.baseline : null);
      if (clusterRecords.some((r) => r.id === data.sourceRecordId))
        setRecordId(data.sourceRecordId);
      setPhase(next.workload === 'training' ? 'train' : 'decode');
      setNotice(
        'Scenario imported. Measurements remain attached to their original sources.',
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not import scenario.');
    }
  };
  const exportMemo = () =>
    save(
      'supplying-demand-mapping.md',
      `# ${clientName}\n\nMode: ${observed ? 'Published source view' : 'Unmeasured what-if scenario'}\n\n## Configuration and workload\n${description.hardware}\n\n${description.result}\n\n${description.meaning}\n\n## Source record\n${record.name} — ${record.date}\n${record.outcome}\n${record.scope}\n${record.source}\n\n## Scenario inputs\n${JSON.stringify(scenario, null, 2)}\n\n## Calculated requirements (scenario only)\nMemory ${fmt(a.memory.total)} GB across ${scenario.group} GPUs; capacity ${fmt(a.capacity)} GB. Memory lower bound ${a.minGPUs} GPUs; not a performance recommendation.\nOutput target ${fmt(a.requiredTps)} tokens/s (not predicted).\nRead ${fmt(a.readTarget)} GB/s; durable write ${fmt(a.writeTarget)} GB/s.\nFrontend ingress ${fmt(a.ingress)} GB/s; egress ${fmt(a.egress)} GB/s; planned link floor ${fmt(a.nsRequiredGbps)} Gb/s at ${fmt(scenario.utilization * 100)}% utilization.\nRetained storage ${fmt(a.storageRequiredTB)} TB; configured usable ${fmt(a.usableTB)} TB.\n\n## Gaps\n${a.issues.join('\n') || 'No listed arithmetic blockers; actual workload performance remains unverified.'}\n\n## Qualification\n${Object.entries(
        teaching,
      )
        .map(([k, v]) => `${partNames[k as Part]}: ${v.verify}\n${v.source}`)
        .join(
          '\n\n',
        )}\n\n## Notes\n${scenario.notes}\n\nGB and TB are decimal. Source benchmark results do not apply automatically to this variant. CPU/IOPS/metadata behavior and usable performance need validation.`,
      'text/markdown',
    );
  const latest = useRef({ scenario, recordId, observed, catalogSelection });
  latest.current = { scenario, recordId, observed, catalogSelection };
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (args: unknown) => unknown;
    };
    const mc = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!mc?.registerTool) return;
    const ac = new AbortController();
    const register = (tool: Tool) => {
      try {
        void Promise.resolve(
          mc.registerTool(tool, { signal: ac.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'read_cluster_mapping',
      description:
        'Read the active cluster evidence, the editable scenario, calculated capacity requirements and sourced benchmark records. Does not claim simulated performance.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (args) => {
        if (
          !args ||
          typeof args !== 'object' ||
          Array.isArray(args) ||
          Object.keys(args).length
        )
          throw new Error('Use an empty object.');
        if (latest.current.catalogSelection)
          return {
            view: 'catalog',
            source: latest.current.catalogSelection,
            scenario: latest.current.scenario,
            scope:
              'The visible map shows a sourced database observation. The saved sandbox scenario is separate; no predicted performance is assigned to it.',
          };
        return {
          ...latest.current,
          analysis: analyzeScenario(latest.current.scenario),
          source: clusterRecords.find((r) => r.id === latest.current.recordId),
          benchmarks: benchmarks.map((b) => ({
            id: b.id,
            gpu: b.gpu,
            scenario: b.scenario,
            tokensPerSecond: b.tokensPerSecond,
            precision: b.precision,
            source: b.sourceUrl,
          })),
        };
      },
    });
    register({
      name: 'configure_cluster_scenario',
      description:
        'Apply a complete validated what-if scenario to the visible canvas. Switches from published-source view to an unmeasured scenario. Does not purchase or deploy hardware.',
      inputSchema: {
        type: 'object',
        properties: {
          scenario: {
            type: 'object',
            description:
              'Complete Scenario object returned by read_cluster_mapping.',
          },
        },
        required: ['scenario'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (args) => {
        if (
          !args ||
          typeof args !== 'object' ||
          Array.isArray(args) ||
          Object.keys(args).some((k) => k !== 'scenario')
        )
          throw new Error('Provide only scenario.');
        const s = validateScenario((args as { scenario: unknown }).scenario);
        flushSync(() => {
          setCatalogSelection(null);
          setScenario(s);
          setObserved(false);
          setPhase(s.workload === 'training' ? 'train' : 'decode');
          setInspector('configure');
        });
        return { applied: true, analysis: analyzeScenario(s) };
      },
    });
    return () => ac.abort();
  }, []);
  const brief = observed
    ? record.outcome
    : part === 'compute'
      ? `${fmt(a.memory.total)} GB planned across a ${scenario.group}-GPU group. ${a.fit ? 'Memory arithmetic fits; execution still needs a benchmark.' : 'This group is too small for the memory assumptions.'}`
      : part === 'fabric'
        ? !a.crossNode
          ? 'This model group stays within one server. Its local tensor exchanges do not require the external spine.'
          : !scenario.crossLeaf
            ? 'The communicating endpoints share a leaf / rail. Validate port placement before adding a spine for this traffic.'
            : a.routeMissing
              ? 'This distributed group spans leaves with no usable spine path. Restore a path or change placement.'
              : `The group crosses leaves. The ${fmt(a.oversub)}:1 downlink/uplink ratio can expose congestion; it is not an application slowdown multiplier.`
        : part === 'frontend'
          ? `${fmt(a.ingress)} GB/s ingress and ${fmt(a.egress)} GB/s egress require at least ${fmt(a.nsRequiredGbps)} Gb/s at the chosen ${fmt(scenario.utilization * 100)}% utilization allowance.`
          : part === 'storage'
            ? `${fmt(a.readTarget)} GB/s reads, ${fmt(a.writeTarget)} GB/s durable writes and ${fmt(a.storageRequiredTB)} TB retained. Media performance is ${scenario.measuredRead || scenario.measuredWrite ? 'entered as an assumption' : 'still unknown'}.`
            : part === 'operations'
              ? `${scenario.cores} CPU cores and ${fmt(scenario.ramGB)} GB RAM per server. Core count does not prove preprocessing throughput. ${fmt(scenario.nodes * gpuSpecs[scenario.gpu].power)} kW is a reference compute-only maximum.`
              : `The client needs ${fmt(a.requiredTps)} ${scenario.workload === 'training' ? 'training' : 'output'} tokens/s. This is a target, not a prediction.`;
  const Node = ({
    id,
    children,
    className = '',
  }: {
    id: Part;
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={`lc-node node-${id} ${part === id ? 'selected' : ''} ${drag && palette.find((p) => p.id === drag)?.zone === id ? 'drop-target' : ''} ${className}`}
      onDragOver={(ev) => {
        if (palette.find((p) => p.id === drag)?.zone === id)
          ev.preventDefault();
      }}
      onDrop={(ev) => drop(ev, id)}
    >
      <button
        className="node-select"
        onClick={() => selectPart(id)}
        aria-label={`Inspect ${partNames[id]}`}
      >
        {children}
      </button>
    </div>
  );
  const rateStatus = (value: number, target: number) =>
    target === 0
      ? 'No target set'
      : value === 0
        ? 'Measurement missing'
        : value >= target
          ? 'Entered rate covers target'
          : 'Below target';
  const bRows = benchmarks.filter((b) => b.scenario === benchmarkScenario);
  return (
    <>
      <header className="lab-nav">
        <a href="/" className="lab-brand">
          <ArrowLeftRight size={21} />
          Supplying Demand
        </a>
        <span className="one-page-label">Cluster lab</span>
        <div className="lab-nav-actions">
          <button
            onClick={() => {
              setShowGuide((v) => !v);
            }}
          >
            <Info size={15} />
            How to use
          </button>
          <button
            disabled={!!catalogSelection}
            title={
              catalogSelection
                ? 'Return to the sandbox to import a scenario'
                : undefined
            }
            onClick={() => fileRef.current?.click()}
          >
            <FileUp size={15} />
            Import
          </button>
          <button
            disabled={!!catalogSelection}
            title={
              catalogSelection
                ? 'Use Export in the cluster database to save evidence records'
                : undefined
            }
            onClick={exportScenario}
          >
            <Download size={15} />
            Save scenario
          </button>
        </div>
        <input
          hidden
          type="file"
          ref={fileRef}
          accept=".json,application/json"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) void importScenario(f);
            ev.target.value = '';
          }}
        />
      </header>
      <main className="cluster-app">
        <div className="lab-title">
          <div>
            <h1>Start with the workload. See the hardware.</h1>
            <p>
              Find a tested reference, then explore why each component matters.
            </p>
          </div>
          <button
            className="lc-data-button"
            onClick={() => {
              setCatalogOpen(true);
              setCatalogOpenSignal((n) => n + 1);
            }}
          >
            <span className="data-dot" />
            {catalogCount.toLocaleString()} sourced observations
            <ChevronDown size={15} />
          </button>
        </div>
        {showGuide && (
          <div className="lc-guide">
            <b>One page, two directions.</b>
            <span>
              Choose a workload and show a tested setup. Click any part of the
              map to learn why it matters. Use “Explore a variant” to change it.
              Drag components onto their matching block, or click a palette
              item. Change the workload and follow the colored paths. Open
              “Data” below for exact benchmark conditions.
            </span>
            <button
              onClick={() => setShowGuide(false)}
              aria-label="Close guide"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <ClusterCatalog
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          openSignal={catalogOpenSignal}
          onStats={setCatalogCount}
          selectedId={catalogSelection?.id || null}
          onSelect={(entry) => {
            setCatalogSelection(entry);
            setTimeout(
              () =>
                catalogMapRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                }),
              40,
            );
          }}
        />
        {catalogSelection && (
          <div ref={catalogMapRef}>
            <CatalogMap
              key={catalogSelection.id}
              entry={catalogSelection}
              onBack={() => setCatalogSelection(null)}
              onEdit={() =>
                window.dispatchEvent(
                  new CustomEvent('edit-catalog-entry', {
                    detail: catalogSelection.id,
                  }),
                )
              }
            />
          </div>
        )}
        <div hidden={!!catalogSelection}>
          <p className="cat-note">
            Guided sandbox examples below use a smaller reference set. Search
            the cluster database above for the full evidence library.
          </p>
          <WorkloadFinder
            activeRecordId={observed ? recordId : null}
            onSelect={selectRecord}
          />
          <div className="lab-toolbar" ref={labRef}>
            <div>
              <b>{observed ? record.name : clientName}</b>
              <span>
                {observed
                  ? `Reported ${record.date} · current inventory not verified`
                  : baseline
                    ? `Unmeasured variant · source: ${baseline}`
                    : 'Editable what-if · reference components + explicit assumptions'}
              </span>
            </div>
            <div className="toolbar-actions">
              {observed ? (
                <button className="lc-primary" onClick={() => startVariant()}>
                  Explore a variant
                  <ArrowRight size={15} />
                </button>
              ) : (
                <>
                  <button
                    className="lc-quiet"
                    onClick={() => {
                      setScenario({ ...initialScenario });
                      setBaseline(null);
                      setClientName('My cluster scenario');
                      setPhase('decode');
                      setNotice('Reference scenario restored.');
                    }}
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                  <button
                    className="lc-quiet"
                    onClick={() => {
                      setPart('workload');
                      setInspector('configure');
                    }}
                  >
                    <Users size={14} />
                    Client fit & target
                  </button>
                </>
              )}
              <span
                className={`lc-evidence-badge ${observed ? 'reported' : 'assumed'}`}
              >
                {observed ? 'Published evidence' : 'Scenario · unmeasured'}
              </span>
            </div>
          </div>
          {notice && (
            <div role="status" className="lc-notice">
              {notice}
              <button onClick={() => setNotice('')} aria-label="Dismiss notice">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="lab-surface">
            <aside className="lab-palette">
              <p className="lab-eyebrow">DRAG OR CLICK TO APPLY</p>
              {palette.map((item) => (
                <button
                  key={item.id}
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData(
                      'application/x-supplying-demand',
                      item.id,
                    );
                    ev.dataTransfer.effectAllowed = 'copy';
                    setDrag(item.id);
                  }}
                  onDragEnd={() => setDrag(null)}
                  onClick={() => apply(item.id)}
                >
                  <GripVertical className="drag-grip" size={13} />
                  {item.zone === 'compute' ? (
                    <Cpu size={18} />
                  ) : item.zone === 'storage' ? (
                    <HardDrive size={18} />
                  ) : (
                    <Network size={18} />
                  )}
                  <span>
                    {item.label}
                    <small>{item.hint}</small>
                  </span>
                </button>
              ))}
              <p className="palette-foot">
                Palette items create a scenario. They never alter published
                results.
              </p>
            </aside>
            <div className="canvas-column">
              <div
                className="phase-switcher"
                aria-label="Highlight a workload phase"
              >
                {(Object.keys(phaseInfo) as Phase[]).map((p) => (
                  <button
                    key={p}
                    className={phase === p ? 'active' : ''}
                    onClick={() => selectPhase(p)}
                    disabled={
                      observed && !sourcePhaseAllowed(record.workloadKind, p)
                    }
                    title={
                      observed && !sourcePhaseAllowed(record.workloadKind, p)
                        ? `This source reports ${record.workloadKind}, not this phase. Explore a variant to change the workload.`
                        : undefined
                    }
                  >
                    {phaseInfo[p].label}
                  </button>
                ))}
              </div>
              <div
                className={`lab-canvas full-canvas phase-${phase} ${a.routeMissing && !observed ? 'missing-route' : ''}`}
              >
                <div className="canvas-grid" />
                <div className="canvas-top-label">
                  {observed
                    ? 'SCHEMATIC · UNDISCLOSED FIELDS STAY UNKNOWN'
                    : 'LOGICAL PATHS · NOT A CABLING PLAN'}
                </div>
                <svg
                  className="connection-layer"
                  viewBox="0 0 720 540"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    className={`path client-path ${phase === 'prefill' || phase === 'decode' ? 'lit' : ''}`}
                    d="M260 73 H119 V178"
                  />
                  <path
                    className={`path data-path ${['train', 'prefill', 'load', 'checkpoint'].includes(phase) ? 'lit' : ''}`}
                    d="M208 228 H255"
                  />
                  <path
                    className={`path data-path ${['train', 'load', 'checkpoint'].includes(phase) ? 'lit' : ''}`}
                    d="M119 370 V278"
                  />
                  <path
                    style={singleNodeEvidence ? { display: 'none' } : undefined}
                    className={`path tensor-path ${(phase === 'train' || phase === 'prefill' || phase === 'decode') && (observed ? !singleNodeEvidence : a.crossNode) ? 'lit' : ''}`}
                    d="M497 229 H536"
                  />
                  <path
                    style={singleNodeEvidence ? { display: 'none' } : undefined}
                    className={`path tensor-path ${(phase === 'train' || phase === 'prefill' || phase === 'decode') && (observed ? !singleNodeEvidence : a.crossNode) ? 'lit' : ''}`}
                    d="M616 291 V370"
                  />
                  <path className="path ops-path" d="M377 420 V388" />
                  <circle cx="228" cy="228" r="3" fill="#bd9243" />
                  <circle cx="516" cy="229" r="3" fill="#5c89bc" />
                </svg>
                <Node id="workload">
                  <div className="node-title">
                    <Users size={16} />
                    <span>
                      {observed ? 'Reported workload' : 'Client workload'}
                    </span>
                    <SlidersHorizontal size={12} />
                  </div>
                  <strong>
                    {observed
                      ? record.model
                      : `${fmt(scenario.parameters)}B · ${scenario.workload === 'training' ? 'full training' : 'inference'}`}
                  </strong>
                  <small>
                    {observed
                      ? record.kind
                      : `${fmt(a.requiredTps)} tokens/s target`}
                  </small>
                </Node>
                <Node id="frontend">
                  <div className="node-title">
                    <Network size={16} />
                    <span>North–south</span>
                  </div>
                  <strong>
                    {observed
                      ? 'Frontend / services'
                      : `${fmt(scenario.nsGbps)} Gb/s`}
                  </strong>
                  <small>
                    {observed
                      ? record.id.startsWith('meta-')
                        ? 'Storage & service path'
                        : 'Configuration not disclosed'
                      : 'Client + storage traffic'}
                  </small>
                  <div className="node-mini-bar">
                    <i
                      style={{
                        width: observed
                          ? '0%'
                          : Math.min(
                              100,
                              (a.nsRequiredGbps /
                                Math.max(1, scenario.nsGbps)) *
                                100,
                            ) + '%',
                        background:
                          a.nsRequiredGbps > scenario.nsGbps
                            ? '#cc7950'
                            : '#c79c4c',
                      }}
                    />
                  </div>
                </Node>
                <Node id="compute">
                  <div className="node-title">
                    <Cpu size={17} />
                    <span>
                      {observed
                        ? recordBenchmark
                          ? 'Tested GPU server'
                          : 'Reported compute'
                        : 'GPU server group'}
                    </span>
                    <SlidersHorizontal size={12} />
                  </div>
                  <strong className="compute-number">
                    {observed
                      ? record.gpuCount
                        ? fmt(record.gpuCount, 0)
                        : `${record.nodeCount} nodes`
                      : `${scenario.nodes * 8} × ${scenario.gpu}`}
                  </strong>
                  {observed ? (
                    <>
                      {recordBenchmark ? (
                        <>
                          <div className="gpu-grid">
                            {Array.from({ length: 8 }, (_, n) => (
                              <i key={n}>{record.gpu}</i>
                            ))}
                          </div>
                          <small>
                            {
                              recordBenchmark.systemMetadata
                                .accelerator_memory_capacity
                            }{' '}
                            / GPU · {recordBenchmark.precision.toUpperCase()}{' '}
                            weights
                          </small>
                        </>
                      ) : (
                        <p className="node-sub">{record.gpu}</p>
                      )}
                      <div
                        className={`reported-compute ${recordBenchmark ? 'benchmark-compute' : ''}`}
                      >
                        <span>
                          {record.nodeCount
                            ? `${fmt(record.nodeCount, 0)} nodes${record.id === 'deepseek' ? ' · derived count' : ''}`
                            : 'Node count not disclosed'}
                        </span>
                        {!recordBenchmark && (
                          <span>Aggregate cluster · not a server diagram</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="gpu-grid">
                        {Array.from({ length: 8 }, (_, n) => (
                          <i key={n}>{scenario.gpu}</i>
                        ))}
                      </div>
                      <small>
                        {scenario.nodes} server(s) × 8 GPUs · {scenario.hbm} GB
                        / GPU
                      </small>
                      <div className="node-memory">
                        <span>{fmt(a.memory.total)} GB needed</span>
                        <span>
                          {a.fit ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <Info size={14} />
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="host-row">
                    {observed
                      ? recordBenchmark
                        ? `${recordBenchmark.systemMetadata.host_processors_per_node * recordBenchmark.systemMetadata.host_processor_core_count} CPU cores · ${recordBenchmark.systemMetadata.host_memory_capacity} RAM`
                        : 'Click for CPU, RAM and source fields'
                      : `${scenario.cores} CPU cores · ${fmt(scenario.ramGB)} GB RAM / server`}
                  </div>
                </Node>
                <Node
                  id="fabric"
                  className={!observed && !scenario.spine ? 'spine-off' : ''}
                >
                  <div className="node-title">
                    <Network size={16} />
                    <span>
                      {singleNodeEvidence ? 'Within server' : 'East–west'}
                    </span>
                  </div>
                  <strong>
                    {observed
                      ? singleNodeEvidence
                        ? 'NVLink GPU connections'
                        : record.fabric
                      : scenario.fabric === 'roce'
                        ? 'RoCE Ethernet'
                        : 'InfiniBand'}
                  </strong>
                  <small>
                    {observed
                      ? singleNodeEvidence
                        ? 'No inter-server model traffic in this run'
                        : 'See source for topology'
                      : `${scenario.linkGbps} Gb/s endpoints`}
                  </small>
                  <div className="mini-topology">
                    <i>{singleNodeEvidence ? 'GPU' : 'Leaf'}</i>
                    <em>↔</em>
                    <i className={!scenario.spine && !observed ? 'absent' : ''}>
                      {observed
                        ? singleNodeEvidence
                          ? 'GPU'
                          : 'Fabric'
                        : scenario.spine
                          ? 'Spine'
                          : 'No spine'}
                    </i>
                  </div>
                </Node>
                <Node id="storage">
                  <div className="node-title">
                    <HardDrive size={16} />
                    <span>
                      {recordBenchmark && observed
                        ? 'Submitted storage'
                        : 'Shared storage'}
                    </span>
                  </div>
                  <strong>
                    {observed
                      ? recordBenchmark
                        ? recordBenchmark.systemMetadata.host_storage_capacity
                        : record.id.startsWith('meta-') &&
                            record.id !== 'meta-129k'
                          ? 'Tectonic + NFS'
                          : 'Not fully disclosed'
                      : `${scenario.storageNodes} storage servers`}
                  </strong>
                  <small>
                    {observed
                      ? 'Open reported storage fields'
                      : `${fmt(a.usableTB)} TB protected usable`}
                  </small>
                  <div className="storage-stack">
                    {observed && recordBenchmark ? (
                      <>
                        <span>SSD</span>
                        <span>CIFS</span>
                      </>
                    ) : (
                      <>
                        <span>CPU</span>
                        <span>RAM</span>
                        <span>NIC</span>
                        <span>SSD</span>
                      </>
                    )}
                  </div>
                </Node>
                <Node id="operations">
                  <div className="node-title">
                    <Zap size={15} />
                    <span>Host & operations</span>
                  </div>
                  <small>
                    {observed
                      ? 'CPU · RAM · power · management'
                      : `${fmt(scenario.cacheTB)} TB local NVMe / server`}
                  </small>
                  <span className="ops-tags">PCIe / NUMA · BMC · cooling</span>
                </Node>
                <div
                  className={`second-group ${singleNodeEvidence || (!observed && scenario.nodes === 1) ? 'not-present' : ''}`}
                >
                  <Server size={17} />
                  <strong>
                    {observed
                      ? singleNodeEvidence
                        ? 'One GPU server only'
                        : 'Other endpoints'
                      : scenario.nodes > 1
                        ? 'Additional servers'
                        : 'One server only'}
                  </strong>
                  <small>
                    {observed
                      ? singleNodeEvidence
                        ? 'External fabric benefit not measured'
                        : 'Only when the source establishes them'
                      : a.crossNode
                        ? 'This group crosses servers'
                        : 'Independent replicas or other jobs'}
                  </small>
                </div>
                <div className="canvas-legend">
                  <span>
                    <i style={{ background: '#5f8abf' }} />
                    GPU fabric
                  </span>
                  <span>
                    <i style={{ background: '#bd9243' }} />
                    Frontend / storage
                  </span>
                  <span>
                    <i style={{ background: '#8c7daf' }} />
                    Client traffic
                  </span>
                </div>
              </div>
              <div className="phase-explanation">
                <b>{phaseData.result}</b>
                <span>
                  {observed
                    ? record.workloadKind === 'training'
                      ? 'Training reference. This source does not measure inference performance.'
                      : record.workloadKind === 'inference'
                        ? 'Inference reference. The reported rate applies to the stated benchmark conditions.'
                        : 'Conceptual path only. This source does not report model-level performance.'
                    : phaseData.path}
                </span>
              </div>
            </div>
            <aside className="lab-inspector">
              <div className="inspector-title">
                <span style={{ background: color[part] }} />
                <h2>{partNames[part]}</h2>
              </div>
              <Tabs
                value={inspector}
                onValueChange={(v) => {
                  if (v === 'configure' && observed) startVariant();
                  setInspector(String(v));
                }}
              >
                <TabsList className="inspector-tabs">
                  <TabsTrigger value="explain">Why it matters</TabsTrigger>
                  <TabsTrigger value="configure">Configure</TabsTrigger>
                  <TabsTrigger value="data">Evidence</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="inspector-body">
                {inspector === 'data' ? (
                  <>
                    <p className="lc-kicker">
                      {record.kind} · {record.date}
                    </p>
                    <h3 className="reported-outcome">
                      {record.outcomeValue || record.outcome}
                    </h3>
                    {record.outcomeValue && <p>{record.outcome}</p>}
                    <p className="source-scope">{record.scope}</p>
                    {record.facts.map((f) => (
                      <div className="fact-row" key={f.label}>
                        <span>
                          {f.label}
                          <em>
                            {f.value
                              ? f.status === 'derived'
                                ? 'Derived'
                                : 'Reported'
                              : 'Unknown'}
                          </em>
                        </span>
                        <p>{f.value || 'Not disclosed in this source.'}</p>
                        {sourceLink(f.source)}
                      </div>
                    ))}
                    <div className="lab-note">{record.lesson}</div>
                    <button
                      className="lc-primary"
                      onClick={() => startVariant()}
                    >
                      Explore a variant
                      <ArrowRight size={14} />
                    </button>
                  </>
                ) : inspector === 'explain' ? (
                  <>
                    <p className="lc-kicker">
                      {observed
                        ? 'SOURCE-BOUND OBSERVATION'
                        : 'FOR THIS SCENARIO'}
                    </p>
                    <div className="lc-verdict">{brief}</div>
                    <h3>Why this matters for the workload</h3>
                    <p>
                      {observed
                        ? recordExplanation.reason
                        : teaching[part].reason}
                    </p>
                    <h3>
                      {observed
                        ? 'What the evidence establishes'
                        : 'What would prove it?'}
                    </h3>
                    <p>
                      {observed
                        ? recordExplanation.evidence
                        : teaching[part].verify}
                    </p>
                    {sourceLink(
                      observed
                        ? recordExplanation.source
                        : teaching[part].source,
                      'Technical reference',
                    )}
                    {!observed && (
                      <div className="lab-note">{phaseData.detail}</div>
                    )}
                    {part === 'fabric' && !observed && (
                      <>
                        <Toggle
                          label="Spine path present"
                          value={scenario.spine}
                          onChange={(v) => change('spine', v)}
                        />
                        <Toggle
                          label="Group spans different leaves"
                          value={scenario.crossLeaf}
                          onChange={(v) => change('crossLeaf', v)}
                        />
                      </>
                    )}
                    <button
                      className="lc-secondary"
                      onClick={() => {
                        if (observed) startVariant();
                        setInspector('configure');
                      }}
                    >
                      <SlidersHorizontal size={14} />
                      Change {partNames[part].toLowerCase()}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="lc-kicker">
                      EDITABLE ASSUMPTIONS · DECIMAL UNITS
                    </p>
                    {part === 'workload' && (
                      <>
                        <div className="client-profiles">
                          <h3>Who could use this hardware?</h3>
                          <p>
                            Illustrative client profiles. Memory fit is a first
                            screen; service performance remains unmeasured.
                          </p>
                          {clientProfiles.map((p) => {
                            const candidate = withClient(scenario, p.id);
                            const fit = analyzeScenario(candidate);
                            return (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setScenario(candidate);
                                  setClientName(p.name + ' · scenario');
                                  setPhase(
                                    p.workload === 'training'
                                      ? 'train'
                                      : 'decode',
                                  );
                                  setNotice(
                                    'Client profile applied to your hardware. Review the assumptions below and qualify with the actual workload.',
                                  );
                                }}
                              >
                                <strong>
                                  {p.name}
                                  <span>
                                    {fit.fit ? 'Memory fits' : 'HBM gap'}
                                  </span>
                                </strong>
                                <small>{p.description}</small>
                              </button>
                            );
                          })}
                        </div>
                        <div className="lc-field">
                          <label htmlFor="lc-client">
                            Client / scenario name
                          </label>
                          <input
                            id="lc-client"
                            value={clientName}
                            maxLength={300}
                            onChange={(e) => setClientName(e.target.value)}
                          />
                        </div>
                        <Pick
                          label="Workload"
                          value={scenario.workload}
                          choices={[
                            ['inference', 'Dense LLM inference'],
                            ['training', 'Dense full-parameter training'],
                          ]}
                          onChange={(v) =>
                            selectPhase(v === 'training' ? 'train' : 'decode')
                          }
                        />
                        {numeric('parameters', 'Parameters · billions')}
                        {scenario.workload === 'inference' &&
                          numeric('weightBytes', 'Weight bytes / parameter', {
                            min: 0.25,
                            max: 8,
                            hint: '2 = BF16; 1 or 0.5 requires supported quantization and a quality test.',
                          })}
                        {scenario.workload === 'inference' ? (
                          <>
                            {numeric('targetTps', 'Required output tokens/s')}
                            {numeric('ttftMs', 'p99 first-token target · ms')}
                            {numeric('tpotMs', 'p99 output-token target · ms')}
                            {numeric(
                              'context',
                              'Resident tokens per sequence',
                              {
                                min: 1,
                                max: 1e7,
                                integer: true,
                              },
                            )}
                            {numeric('concurrency', 'Sequences per GPU group', {
                              min: 1,
                              max: 1e6,
                              integer: true,
                            })}
                            <details>
                              <summary>KV-cache architecture</summary>
                              {numeric('layers', 'Attention layers', {
                                min: 1,
                                max: 1000,
                                integer: true,
                              })}
                              {numeric('kvHeads', 'KV heads', {
                                min: 1,
                                max: 1000,
                                integer: true,
                              })}
                              {numeric('headDim', 'Head dimension', {
                                min: 1,
                                max: 4096,
                                integer: true,
                              })}
                              {numeric('kvBytes', 'KV bytes per element', {
                                min: 0.25,
                                max: 8,
                              })}
                              <p>
                                Full-attention formula; not a model of MLA,
                                sliding windows or prefix sharing.
                              </p>
                            </details>
                          </>
                        ) : (
                          <>
                            {numeric(
                              'trainTokensB',
                              'Training token budget · billions',
                            )}
                            {numeric('days', 'Deadline · days', {
                              min: 1,
                              max: 3650,
                            })}
                          </>
                        )}
                        {numeric('overhead', 'Activations / scratch · GB', {
                          hint: 'Assumed across the GPU group; profile actual peaks.',
                        })}
                        {numeric('margin', 'Planning memory reserve · %', {
                          max: 100,
                        })}
                        <p>
                          MoE disclosures are available as evidence. This
                          calculator covers dense models.
                        </p>
                      </>
                    )}
                    {part === 'compute' && (
                      <>
                        <Pick
                          label="GPU reference family"
                          value={scenario.gpu}
                          choices={[
                            ['H100', 'H100 · 80 GB'],
                            ['H200', 'H200 · 141 GB'],
                            ['B300', 'B300 · 288 GB'],
                          ]}
                          onChange={(v) => apply(v.toLowerCase())}
                        />
                        {numeric('hbm', 'Available HBM per GPU · GB', {
                          min: 1,
                          max: 4096,
                          hint: 'Use the actual SKU / allocation; benchmark metadata may differ from nominal capacity.',
                        })}
                        {numeric('nodes', 'GPU servers · 8 GPUs each', {
                          min: 1,
                          max: 4096,
                          integer: true,
                        })}
                        {numeric('group', 'GPUs in this workload group', {
                          min: 1,
                          max: 32768,
                          integer: true,
                          hint: 'One model instance or one sharded training job.',
                        })}
                        <button
                          className="lc-secondary"
                          onClick={() => change('group', scenario.nodes * 8)}
                        >
                          Use all {scenario.nodes * 8} GPUs in this job
                        </button>
                        <div className="lab-note">
                          HBM does not automatically pool across GPUs. The
                          runtime must support the partitioning, and each GPU’s
                          state must fit.
                        </div>
                        {sourceLink(
                          gpuSpecs[scenario.gpu].source,
                          'Reference server specifications',
                        )}
                      </>
                    )}
                    {part === 'fabric' && (
                      <>
                        <Pick
                          label="Backend fabric"
                          value={scenario.fabric}
                          choices={[
                            ['roce', 'RoCE Ethernet'],
                            ['ib', 'InfiniBand'],
                          ]}
                          onChange={(v) => change('fabric', v)}
                        />
                        <Toggle
                          label="Endpoints span different leaves"
                          value={scenario.crossLeaf}
                          onChange={(v) => change('crossLeaf', v)}
                        />
                        <Toggle
                          label="Spine path present"
                          value={scenario.spine}
                          onChange={(v) => change('spine', v)}
                        />
                        {numeric('linkGbps', 'Endpoint & uplink rate · Gb/s', {
                          min: 1,
                          max: 6400,
                        })}
                        {numeric('downlinks', 'Endpoint ports per leaf', {
                          min: 1,
                          max: 512,
                          integer: true,
                        })}
                        {numeric('uplinks', 'Spine uplinks per leaf', {
                          max: 512,
                          integer: true,
                        })}
                        <div className="lab-note">
                          Nominal capacity ratio: {fmt(a.oversub)}:1. Link
                          counts, rails, oversubscription and contention must be
                          validated as a complete topology.
                        </div>
                        <p>
                          RoCE requires supported endpoints and validated
                          congestion behavior; changing the label alone cannot
                          predict a speed difference.
                        </p>
                      </>
                    )}
                    {part === 'frontend' && (
                      <>
                        {numeric(
                          'nsGbps',
                          'Aggregate frontend capacity · Gb/s',
                          {
                            max: 102400,
                          },
                        )}
                        {numeric('utilization', 'Planned usable fraction', {
                          min: 0.1,
                          max: 1,
                          hint: '0.7 = budget 70% of line rate for payload; an explicit assumption.',
                        })}
                        <h3>Client traffic</h3>
                        {numeric('requestsPerSecond', 'Requests / second')}
                        {numeric('requestMB', 'Input payload / request · MB')}
                        {numeric('responseMB', 'Output payload / request · MB')}
                        <h3>Concurrent background traffic</h3>
                        {numeric('loadCopies', 'Simultaneous model loads', {
                          integer: true,
                          max: 4096,
                        })}
                        {numeric('loadWindow', 'Model load window · seconds', {
                          min: 1,
                        })}
                        {numeric('datasetRead', 'Dataset read rate · GB/s')}
                        <p>
                          Checkpoint writes also use this frontend. Full-duplex
                          links are budgeted by the larger direction, not
                          ingress plus egress.
                        </p>
                      </>
                    )}
                    {part === 'storage' && (
                      <>
                        {numeric('storageNodes', 'Storage server count', {
                          max: 512,
                          integer: true,
                        })}
                        <div className="lc-two">
                          {numeric('storageCores', 'CPU cores / server', {
                            integer: true,
                            max: 2048,
                          })}
                          {numeric('storageRam', 'RAM / server · GB')}
                        </div>
                        {numeric(
                          'storageNic',
                          'NIC bandwidth / server · Gb/s',
                          {
                            max: 6400,
                          },
                        )}
                        {numeric('rawTBPerStorage', 'Raw drives / server · TB')}
                        {numeric(
                          'protection',
                          'Raw-to-usable capacity factor',
                          {
                            min: 1,
                            max: 10,
                            hint: '2 = two raw TB per usable TB; confirm the actual protection layout.',
                          },
                        )}
                        {numeric('datasetTB', 'Dataset retained · TB')}
                        {numeric('checkpointGB', 'Checkpoint payload · GB')}
                        {numeric(
                          'checkpointWindow',
                          'Durable write window · seconds',
                          { min: 1 },
                        )}
                        {numeric('checkpointCopies', 'Retained checkpoints', {
                          integer: true,
                          max: 10000,
                        })}
                        <details>
                          <summary>Recorded storage performance</summary>
                          {numeric('measuredRead', 'Aggregate read · GB/s', {
                            hint: '0 = unknown; user-entered measurement/assumption.',
                          })}
                          {numeric(
                            'measuredWrite',
                            'Aggregate durable write · GB/s',
                            {
                              hint: '0 = unknown; test beyond volatile buffers.',
                            },
                          )}
                        </details>
                        <p>
                          Drive type, metadata IOPS, storage CPU saturation and
                          rebuild traffic still need evidence.
                        </p>
                      </>
                    )}
                    {part === 'operations' && (
                      <>
                        {numeric('cores', 'CPU cores / compute server', {
                          integer: true,
                          max: 2048,
                        })}
                        {numeric('ramGB', 'System RAM / compute server · GB')}
                        {numeric('cacheTB', 'Local NVMe / compute server · TB')}
                        <div className="lab-note">
                          CPU, PCIe / NUMA, boot drives, BMC, service NICs, rack
                          power, cooling and scheduling all require an OEM
                          design and workload acceptance tests.
                        </div>
                        <div className="lc-field">
                          <label htmlFor="lc-notes">
                            Client constraints / evidence notes
                          </label>
                          <textarea
                            id="lc-notes"
                            value={scenario.notes}
                            onChange={(e) => change('notes', e.target.value)}
                            placeholder="Budget, tenancy, data placement, facility limits, quotes, benchmark results…"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
          <section
            className="outcome-shelf"
            aria-label="Mapped outcomes"
            aria-live="polite"
          >
            {observed ? (
              <>
                <div className="outcome-cell wide">
                  <span>Reported workload → outcome</span>
                  <strong>{record.outcomeValue || record.model}</strong>
                  <p>{record.outcome}</p>
                </div>
                <div className="outcome-cell wide">
                  <span>What this evidence does not establish</span>
                  <p>{record.scope}</p>
                  {sourceLink(record.source, 'Open original source')}
                </div>
              </>
            ) : (
              <>
                <button
                  className={`outcome-cell ${!a.fit ? 'attention' : ''}`}
                  onClick={() => selectPart('compute')}
                >
                  <span>Memory fit</span>
                  <strong>
                    {fmt(a.memory.total)} <em>/ {fmt(a.capacity)} GB</em>
                  </strong>
                  <div className="outcome-bar">
                    <i
                      style={{
                        width:
                          Math.min(
                            100,
                            (a.memory.total / Math.max(1, a.capacity)) * 100,
                          ) + '%',
                      }}
                    />
                  </div>
                  <small>
                    {a.minGPUs} GPU memory floor · throughput unverified
                  </small>
                </button>
                <button
                  className={`outcome-cell ${a.routeMissing ? 'attention' : ''}`}
                  onClick={() => selectPart('fabric')}
                >
                  <span>Compute communication</span>
                  <strong>
                    {a.routeMissing
                      ? 'Path missing'
                      : a.crossNode
                        ? 'Cross-server'
                        : 'Inside server'}
                  </strong>
                  <small>
                    {a.crossNode && scenario.crossLeaf
                      ? `${fmt(a.oversub)}:1 nominal uplink ratio`
                      : 'External spine not on this GPU path'}
                  </small>
                </button>
                <button
                  className={`outcome-cell ${a.nsRequiredGbps > scenario.nsGbps ? 'attention' : ''}`}
                  onClick={() => selectPart('frontend')}
                >
                  <span>North–south line-rate floor</span>
                  <strong>
                    {fmt(a.nsRequiredGbps)} <em>Gb/s</em>
                  </strong>
                  <small>
                    {fmt(scenario.nsGbps)} Gb/s configured ·{' '}
                    {fmt(scenario.utilization * 100)}% budget
                  </small>
                </button>
                <button
                  className={`outcome-cell ${a.storageRequiredTB > a.usableTB ? 'attention' : ''}`}
                  onClick={() => selectPart('storage')}
                >
                  <span>Durable storage target</span>
                  <strong>
                    {fmt(a.writeTarget)} <em>GB/s write</em>
                  </strong>
                  <small>
                    {fmt(a.storageRequiredTB)} TB retained ·{' '}
                    {scenario.measuredWrite
                      ? 'entered rate available'
                      : 'write performance unknown'}
                  </small>
                </button>
              </>
            )}
          </section>
          {!observed && (
            <div className="scenario-conclusion">
              <div>
                <b>
                  {a.issues.length
                    ? `${a.issues.length} configuration gap${a.issues.length === 1 ? '' : 's'} to resolve`
                    : 'No listed capacity or path blockers'}
                </b>
                <p>
                  {a.issues.length
                    ? a.issues.join(' ')
                    : 'Model performance, quality, host processing and storage behavior still need a workload benchmark.'}
                </p>
              </div>
              <button className="lc-secondary" onClick={exportMemo}>
                <Download size={15} />
                Export mapping
              </button>
            </div>
          )}
          <article
            className="cluster-description"
            aria-labelledby="description-title"
          >
            <div className="description-heading">
              <h2 id="description-title">
                {observed ? record.name : clientName}
              </h2>
              <span>
                {observed
                  ? `Reported ${record.date}`
                  : 'Planning scenario · unmeasured'}
              </span>
            </div>
            <p>
              {description.hardware}
              {observed && (
                <> {sourceLink(descriptionHardwareSource, 'Hardware source')}</>
              )}
            </p>
            <p>
              {description.result}
              {observed && <> {sourceLink(record.source, 'Result source')}</>}
            </p>
            <p className="description-meaning">{description.meaning}</p>
          </article>
          <details className="source-library">
            <summary>
              Explore other published systems <ChevronDown size={16} />
            </summary>
            <div
              className="evidence-strip"
              aria-label="Documented cluster examples"
            >
              {clusterRecords.map((r) => (
                <button
                  key={r.id}
                  className={observed && r.id === recordId ? 'active' : ''}
                  onClick={() => {
                    selectRecord(r.id);
                    labRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                >
                  <span>
                    {r.kind.toUpperCase()} · {r.date}
                  </span>
                  <strong>
                    {r.name}
                    <ArrowUpRight size={15} />
                  </strong>
                  <small>
                    {r.gpuCount
                      ? fmt(r.gpuCount, 0) + ' GPUs'
                      : r.nodeCount + ' nodes'}{' '}
                    · {r.model}
                  </small>
                </button>
              ))}
            </div>
          </details>
          <section ref={dataRef} className="data-section">
            <button
              className="data-section-toggle"
              onClick={() => setShowData((v) => !v)}
              aria-expanded={showData}
            >
              <span>
                <span className="data-dot" />
                The data behind the canvas
              </span>
              <small>Sources, benchmark outcomes & calculations</small>
              <ChevronDown size={17} />
            </button>
            {showData && (
              <div className="data-content">
                <div className="benchmark-heading">
                  <div>
                    <p className="lab-eyebrow">
                      MEASURED INFERENCE · SAME MODEL, DIFFERENT CONDITIONS
                    </p>
                    <h2>Llama 2 70B · eight GPUs</h2>
                  </div>
                  <Pick
                    label="MLPerf scenario"
                    value={benchmarkScenario}
                    choices={[
                      ['Server', 'Server · latency constrained'],
                      ['Offline', 'Offline · batch throughput'],
                    ]}
                    onChange={setBenchmarkScenario}
                  />
                </div>
                <p className="comparison-warning">
                  These records use different MLPerf versions, software and
                  weight precision. The bars show submitted results, not a
                  controlled GPU-only comparison or a prediction for this
                  scenario. Neither single-node result establishes RoCE
                  performance across nodes.
                </p>
                <div className="benchmark-bars">
                  {bRows.map((b) => (
                    <div key={b.id} className="benchmark-row">
                      <div>
                        <strong>{b.gpu}</strong>
                        <small>
                          {b.version} · {b.precision.toUpperCase()} ·{' '}
                          {b.published}
                        </small>
                      </div>
                      <div>
                        <div className="benchmark-bar-track">
                          <i
                            style={{
                              width:
                                (100 * b.tokensPerSecond) /
                                  Math.max(
                                    ...bRows.map((x) => x.tokensPerSecond),
                                  ) +
                                '%',
                            }}
                          />
                        </div>
                        <span>{fmt(b.tokensPerSecond, 0)} output tokens/s</span>
                      </div>
                      <div className="benchmark-conditions">
                        <span>
                          {b.scenario === 'Server'
                            ? `p99 TTFT ${fmt(b.ttftP99Ms || 0)} ms · TPOT ${fmt(b.tpotP99Ms || 0)} ms`
                            : 'Offline has no online latency target'}
                        </span>
                        {sourceLink(b.sourceUrl, `Run ${b.submissionId}`)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="benchmark-reading">
                  <Info size={19} />
                  <p>
                    {benchmarkScenario === 'Server'
                      ? observed
                        ? 'Server results pair aggregate throughput with p99 latency. These source runs use 2,000 / 200 ms benchmark limits and OpenOrca. A client with a different model or request distribution needs a matching benchmark.'
                        : `Your scenario target is ${fmt(scenario.targetTps)} output tokens/s at p99 TTFT ${fmt(scenario.ttftMs)} ms and TPOT ${fmt(scenario.tpotMs)} ms. These source runs use 2,000 / 200 ms limits and OpenOrca; their results do not automatically apply to this scenario.`
                      : 'Offline throughput measures a different serving situation. Do not use an offline bar to promise interactive response times.'}
                  </p>
                </div>
                <details className="source-metadata">
                  <summary>Exact system metadata & test conditions</summary>
                  {bRows.map((b) => (
                    <div className="metadata-card" key={b.id}>
                      <h3>{b.system}</h3>
                      <p>
                        <b>Weight precision:</b> {b.precision.toUpperCase()} ·{' '}
                        <b>Memory:</b>{' '}
                        {b.systemMetadata.accelerator_memory_capacity} per GPU
                      </p>
                      <p>
                        <b>CPU / host RAM:</b>{' '}
                        {b.systemMetadata.host_processors_per_node} ×{' '}
                        {b.systemMetadata.host_processor_model_name} /{' '}
                        {b.systemMetadata.host_memory_capacity}
                      </p>
                      <p>
                        <b>Storage:</b> {b.systemMetadata.host_storage_capacity}{' '}
                        · <b>NIC inventory:</b>{' '}
                        {b.systemMetadata.host_network_card_count}
                      </p>
                      <p>
                        <b>Software:</b> {b.software}
                      </p>
                      <p>
                        <b>Accuracy output:</b> {b.accuracy}
                      </p>
                      <p>
                        Metadata shown as submitted. In particular, B300’s
                        submission lists 270 GB per GPU; the reference-server
                        palette uses the nominal 288 GB specification.
                      </p>
                      {sourceLink(b.systemUrl, 'Pinned system JSON')}{' '}
                      {sourceLink(b.summaryUrl, 'Pinned result summary')}
                    </div>
                  ))}
                </details>
                <div className="data-calculations">
                  <div>
                    <h3>How the frontend is sized</h3>
                    <div className="direction-budget">
                      <span>Ingress</span>
                      <i
                        style={{
                          width:
                            Math.min(
                              100,
                              (a.ingress / Math.max(a.ingress, a.egress, 1)) *
                                100,
                            ) + '%',
                        }}
                      />
                      <b>{fmt(a.ingress)} GB/s</b>
                    </div>
                    <div className="direction-budget">
                      <span>Egress</span>
                      <i
                        style={{
                          width:
                            Math.min(
                              100,
                              (a.egress / Math.max(a.ingress, a.egress, 1)) *
                                100,
                            ) + '%',
                        }}
                      />
                      <b>{fmt(a.egress)} GB/s</b>
                    </div>
                    <p>
                      Ingress = client request payloads +{' '}
                      {fmt(scenario.datasetRead)} GB/s dataset reads +{' '}
                      {fmt(a.loadRate)} GB/s model loading.
                    </p>
                    <p>
                      Egress = client response payloads +{' '}
                      {fmt(a.checkpointRate)} GB/s checkpoint writes.
                    </p>
                    <code>
                      Line-rate floor = max(ingress, egress) × 8 ÷{' '}
                      {scenario.utilization}
                    </code>
                    <p>
                      Full-duplex aggregate planning assumption. Validate
                      per-node NICs, each network cut, protocol overhead, bursts
                      and failure headroom.
                    </p>
                  </div>
                  <div>
                    <h3>What storage must deliver</h3>
                    <p>
                      Read target: <b>{fmt(a.readTarget)} GB/s</b> ·{' '}
                      {rateStatus(scenario.measuredRead, a.readTarget)}
                    </p>
                    <p>
                      Durable write target: <b>{fmt(a.writeTarget)} GB/s</b> ·{' '}
                      {rateStatus(scenario.measuredWrite, a.writeTarget)}
                    </p>
                    <p>
                      Required capacity: <b>{fmt(a.storageRequiredTB)} TB</b> =
                      dataset + retained checkpoints + one model-weight copy.
                    </p>
                    <p>
                      Configured usable capacity: {scenario.storageNodes} ×{' '}
                      {scenario.rawTBPerStorage} raw TB ÷ {scenario.protection}{' '}
                      protection factor = <b>{fmt(a.usableTB)} TB</b>.
                    </p>
                    <p>
                      Endpoint/network payload ceiling:{' '}
                      <b>{fmt(a.dataPathCeiling)} GB/s</b>. It excludes CPU,
                      drive, metadata and software constraints and is not a
                      throughput forecast.
                    </p>
                  </div>
                </div>
                <details>
                  <summary>Memory equation & scope</summary>
                  <p>
                    Weights = parameters × bytes per parameter. Inference KV = 2
                    × layers × KV heads × head dimension × resident tokens ×
                    concurrent sequences × KV bytes. Full training uses an
                    assumed 16 bytes per parameter across weights, gradients,
                    master weights and optimizer state. Add the
                    activation/scratch allowance and reserve.
                  </p>
                  <p>
                    All GB and TB are decimal. The aggregate estimate assumes
                    supported partitioning and does not prove per-GPU fit.
                    Dense-model scope; MoE and MLA require model-specific
                    analysis. The reference compute values are vendor
                    specifications; unspecified topology, storage and service
                    settings are scenario assumptions.
                  </p>
                </details>
                <div className="freshness-note">
                  <b>Evidence reviewed September 12, 2026.</b>
                  <p>
                    This is a curated set of public disclosures and pinned
                    benchmark files, not live telemetry, a complete market
                    inventory, or a list of available capacity for sale. Each
                    record retains its original date. Undisclosed fields remain
                    unknown. Scenario files stay in this page until you export
                    them.
                  </p>
                </div>
              </div>
            )}
          </section>
          <details className="advanced-comparison" ref={comparisonRef}>
            <summary>
              <span>Compare offers for a client</span>
              <small>Optional · quotes, targets & measured results</small>
              <ChevronDown size={17} />
            </summary>
            <MatchingDesk
              onOpenLab={(s, name) => {
                setScenario(s);
                setClientName(name);
                setObserved(false);
                setBaseline(null);
                setNotice(
                  'Loaded a copy of this offer. Map edits stay in this scenario.',
                );
                if (comparisonRef.current) comparisonRef.current.open = false;
                setPhase(s.workload === 'training' ? 'train' : 'decode');
                setInspector('explain');
                setTimeout(
                  () =>
                    labRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    }),
                  30,
                );
              }}
            />
          </details>
        </div>
      </main>
    </>
  );
}
