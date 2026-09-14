'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  FileUp,
  Plus,
  FlaskConical,
  Undo2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  defaultDemand,
  exampleOffers,
  useProfile,
  asScenario,
  evaluate,
  signature,
  changeLever,
  mechanisms,
  validateComparison,
  specializationTest,
  type Demand,
  type Offer,
  type Lever,
} from '@/lib/matching';
import { gpuSpecs, type Scenario } from '@/lib/cluster-lab';
import { fmt } from '@/lib/consulting';
function Field({
  label,
  value,
  onChange,
  min = 0,
  max = 1e9,
  step = 'any',
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  hint?: string;
}) {
  return (
    <label className="md-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n))
            onChange(
              Math.max(min, Math.min(max, step === 1 ? Math.round(n) : n)),
            );
        }}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="md-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        maxLength={1000}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="md-field">
      <span>{label}</span>
      <Select
        value={value}
        items={options.map(([value, label]) => ({ value, label }))}
        onValueChange={(v) => v && onChange(String(v))}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="md-toggle">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
function download(name: string, data: string, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
export default function MatchingDesk({
  onOpenLab,
}: {
  onOpenLab: (s: Scenario, name: string) => void;
}) {
  const [demand, setDemand] = useState<Demand>(() =>
    structuredClone(defaultDemand),
  );
  const [offers, setOffers] = useState<Offer[]>(() =>
    structuredClone(exampleOffers),
  );
  const [selected, setSelected] = useState('a');
  const [baselineId, setBaselineId] = useState('a');
  const [mechanism, setMechanism] = useState('memory');
  const [showInputs, setShowInputs] = useState(false);
  const [before, setBefore] = useState<Offer | null>(null);
  const [message, setMessage] = useState('');
  const [runDraft, setRunDraft] = useState({
    rate: 0,
    ttft: 0,
    tpot: 0,
    qualityPass: false,
    reference: '',
    date: '',
    trace: '',
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const offer = offers.find((o) => o.id === selected)!;
  const result = evaluate(demand, offer);
  const lesson = mechanisms.find((m) => m.id === mechanism)!;
  const inference = demand.inputs.workload === 'inference';
  const base =
    offers.find((o) => o.id === baselineId && o.id !== selected) ||
    offers.find((o) => o.id !== selected);
  const parity = base ? specializationTest(demand, base, offer) : null;
  const testedConfiguration = signature(demand, offer);
  useEffect(() => {
    setRunDraft({
      rate: 0,
      ttft: 0,
      tpot: 0,
      qualityPass: false,
      reference: '',
      date: '',
      trace: '',
    });
  }, [testedConfiguration]);
  const input = (k: keyof Demand['inputs'], v: number | string) =>
    setDemand((d) => ({ ...d, inputs: { ...d.inputs, [k]: v } }));
  const changeOffer = (patch: Partial<Offer>) =>
    setOffers((os) =>
      os.map((o) => (o.id === selected ? { ...o, ...patch } : o)),
    );
  const hardware = (k: keyof Scenario, v: Scenario[keyof Scenario]) =>
    changeOffer({ hardware: { ...offer.hardware, [k]: v } });
  const pickOffer = (id: string) => {
    setSelected(id);
    setBefore(null);
    setRunDraft({
      rate: 0,
      ttft: 0,
      tpot: 0,
      qualityPass: false,
      reference: '',
      date: '',
      trace: '',
    });
  };
  const experiment = (lever: Lever) => {
    setBefore(structuredClone(offer));
    const changed = changeLever(offer, lever);
    changeOffer(changed);
    setMessage(
      'This is now an unquoted variant. Availability, pricing and benchmark applicability need to be re-established.',
    );
  };
  const recordRun = () => {
    if (
      !demand.engine.trim() ||
      !runDraft.reference.trim() ||
      !runDraft.date ||
      !runDraft.trace.trim() ||
      runDraft.rate <= 0 ||
      (inference && (runDraft.ttft <= 0 || runDraft.tpot <= 0))
    ) {
      setMessage(
        'Record the engine/version, dated test reference, request trace, and positive performance measurements first.',
      );
      return;
    }
    changeOffer({ run: { ...runDraft, signature: signature(demand, offer) } });
    setMessage(
      'Result attached to these workload and hardware inputs. Changes to them will require a retest.',
    );
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > 2e6) throw new Error('Choose a comparison under 2 MB.');
      const next = validateComparison(JSON.parse(await file.text()));
      setDemand(next.demand);
      setOffers(next.offers);
      pickOffer(next.selected);
      setMessage(
        'Comparison imported. Provider claims and entered measurements still require your verification.',
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Could not import comparison.',
      );
    }
  };
  const exportBrief = () =>
    download(
      'supplying-demand-client-brief.md',
      `# ${demand.client}\n\nModel: ${demand.model}\nEngine: ${demand.engine || 'Not recorded'}\nWorkload: ${inference ? 'inference' : 'training'}\nRequired rate: ${result.a.requiredTps} tokens/s\n\n${offers
        .map((o) => {
          const r = evaluate(demand, o);
          return `## ${o.name}\nType: ${o.kind}\nProvider reference: ${o.reference || 'Missing'}\nAvailability: ${o.availability}; region: ${o.region || 'unknown'}; available from: ${o.availableOn || 'unknown'}\nStatus: ${r.status}\n${r.next}\nMemory requirement: ${r.memory} GB; group capacity: ${r.a.capacity} GB\nConfiguration gaps: ${r.issues.join(' ') || 'None listed'}\nSupply gaps: ${r.supplyGaps.join(' ') || 'None listed'}\nHourly allocation quote: ${o.hourly || 'unknown'} USD\nQuote cost per million output tokens: ${r.cost === null ? 'Unestablished' : r.cost + ' USD'}\nTraining compute-hours estimate: ${r.trainingHours ?? 'Unestablished'}\nRun: ${JSON.stringify(o.run)}\nHardware: ${JSON.stringify(o.hardware)}`;
        })
        .join(
          '\n\n',
        )}\n\n## Client assumptions\n${JSON.stringify(demand, null, 2)}\n\n## Tests to request\n${mechanisms.map((m) => `${m.name}: ${m.proof}\n${m.source}`).join('\n\n')}\n\nCapacity calculations are preliminary. Entered benchmarks are user-provided evidence, not independently verified. Compute cost uses the entered allocation quote, measured rate and planned busy fraction; it is not an API price. Training duration excludes additional downtime and work outside the token budget.`,
      'text/markdown',
    );
  return (
    <section className="matching-desk" aria-label="Supply and demand matching">
      <div className="md-heading">
        <div>
          <span className="md-eyebrow">
            A CLIENT NEED. AN AVAILABLE CLUSTER. A DEFENSIBLE MATCH.
          </span>
          <h2>Which cluster makes sense for this workload?</h2>
        </div>
        <div className="md-actions">
          <button onClick={() => fileRef.current?.click()}>
            <FileUp size={15} />
            Import comparison
          </button>
          <button
            onClick={() =>
              download(
                'supplying-demand-comparison.json',
                JSON.stringify(
                  { version: 1, demand, offers, selected },
                  null,
                  2,
                ),
              )
            }
          >
            <Download size={15} />
            Save comparison
          </button>
        </div>
        <input
          hidden
          type="file"
          ref={fileRef}
          accept=".json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
      </div>
      <div className="md-start">
        <span>Learn with a case</span>
        <button onClick={() => setDemand((d) => useProfile(d, 'inference'))}>
          70B inference
        </button>
        <button onClick={() => setDemand((d) => useProfile(d, 'moe'))}>
          DeepSeek-style MoE
        </button>
        <button onClick={() => setDemand((d) => useProfile(d, 'train'))}>
          7B full training
        </button>
        <small>
          Illustrative demand and supply; enter real client offers below.
        </small>
      </div>
      <div className="md-workspace">
        <div className="md-demand">
          <div className="md-column-title">
            <span>01</span>
            <h3>The startup needs</h3>
          </div>
          <TextField
            label="Client / project"
            value={demand.client}
            onChange={(client) => setDemand((d) => ({ ...d, client }))}
          />
          <TextField
            label="Model and exact revision"
            value={demand.model}
            onChange={(model) => setDemand((d) => ({ ...d, model }))}
          />
          <Pick
            label="Workload"
            value={demand.inputs.workload}
            options={[
              ['inference', 'Inference · serving users'],
              ['training', 'Full-parameter training'],
            ]}
            onChange={(v) => input('workload', v)}
          />
          <div className="md-pair">
            <Field
              label="Total parameters · billions"
              value={demand.inputs.parameters}
              min={0.1}
              onChange={(v) => input('parameters', v)}
            />
            <Field
              label="Weight bytes / parameter"
              value={demand.inputs.weightBytes}
              min={0.25}
              max={8}
              onChange={(v) => input('weightBytes', v)}
            />
          </div>
          {inference ? (
            <>
              <Field
                label="Required output tokens / second"
                value={demand.inputs.targetTps}
                onChange={(v) => input('targetTps', v)}
              />
              <div className="md-pair">
                <Field
                  label="p99 first token · ms"
                  value={demand.inputs.ttftMs}
                  min={1}
                  onChange={(v) => input('ttftMs', v)}
                />
                <Field
                  label="p99 per token · ms"
                  value={demand.inputs.tpotMs}
                  min={1}
                  onChange={(v) => input('tpotMs', v)}
                />
              </div>
            </>
          ) : (
            <div className="md-pair">
              <Field
                label="Training tokens · billions"
                value={demand.inputs.trainTokensB}
                min={1}
                onChange={(v) => input('trainTokensB', v)}
              />
              <Field
                label="Deadline · days"
                value={demand.inputs.days}
                min={1}
                onChange={(v) => input('days', v)}
              />
            </div>
          )}
          <button
            className="md-text-button"
            aria-expanded={showInputs}
            onClick={() => setShowInputs((v) => !v)}
          >
            {showInputs ? 'Hide' : 'Edit'} model behavior, data & constraints{' '}
            <ArrowRight size={14} />
          </button>
        </div>
        <div className="md-supply">
          <div className="md-column-title">
            <span>02</span>
            <h3>Compare the available supply</h3>
            <button
              onClick={() => {
                if (offers.length >= 12) return;
                const id = crypto.randomUUID();
                setOffers((os) => [
                  ...os,
                  {
                    ...structuredClone(offer),
                    id,
                    name: 'New provider allocation',
                    kind: 'client',
                    availability: 'unknown',
                    hourly: 0,
                    reference: '',
                    run: null,
                  },
                ]);
                pickOffer(id);
              }}
              disabled={offers.length >= 12}
            >
              <Plus size={15} />
              Add offer
            </button>
          </div>
          <div className="md-offers">
            {offers.map((o) => {
              const r = evaluate(demand, o);
              return (
                <button
                  key={o.id}
                  className={`md-offer ${selected === o.id ? 'selected' : ''}`}
                  onClick={() => pickOffer(o.id)}
                  aria-pressed={selected === o.id}
                >
                  <div>
                    <strong>{o.name}</strong>
                    <small>
                      {o.kind === 'example'
                        ? 'Illustrative · not listed for sale'
                        : o.availability === 'confirmed'
                          ? 'Availability entered by you'
                          : 'Availability ' + o.availability}{' '}
                      · {o.hardware.nodes * 8} GPUs ·{' '}
                      {o.hardware.fabric === 'roce' ? 'RoCE' : 'InfiniBand'}
                    </small>
                  </div>
                  <span
                    className={
                      r.issues.length || (r.run && !r.measuredPass)
                        ? 'md-status gap'
                        : 'md-status'
                    }
                  >
                    {r.status}
                  </span>
                  <p>
                    {r.issues[0] ||
                      `${fmt(r.memory)} GB planned / ${fmt(r.a.capacity)} GB in this model group. ${r.a.crossNode ? 'Communicates across servers.' : 'Model group stays inside a server.'}`}
                  </p>
                  <div className="md-offer-bottom">
                    <span>
                      {o.hourly
                        ? money(o.hourly) + '/h quote'
                        : 'Quote missing'}
                    </span>
                    <b>
                      {inference
                        ? r.cost === null
                          ? 'Cost per token unestablished'
                          : money(r.cost) + ' / 1M output tokens'
                        : r.trainingCost === null
                          ? 'Training cost unestablished'
                          : money(r.trainingCost) + ' token-budget estimate'}
                    </b>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="md-verdict">
            <span className="md-eyebrow">03 · THE CONSULTING READOUT</span>
            <h3>{result.status}</h3>
            <p>{result.next}</p>
            {result.measuredPass && (
              <p>
                Entered run: {fmt(result.run!.rate)} tokens/s
                {inference
                  ? `, p99 first token ${fmt(result.run!.ttft)} ms and per token ${fmt(result.run!.tpot)} ms`
                  : ''}
                .{' '}
                {result.supplyGaps.length
                  ? 'Supply qualification is still open.'
                  : 'Supply fields are filled; confirm them with the provider.'}
              </p>
            )}
            {(result.issues.length > 1 || result.supplyGaps.length > 0) && (
              <details className="md-gaps">
                <summary>Open configuration and supply questions</summary>
                {[...result.issues.slice(1), ...result.supplyGaps].map(
                  (g, i) => (
                    <p key={i}>{g}</p>
                  ),
                )}
              </details>
            )}
            <div className="md-actions">
              <button
                onClick={() => onOpenLab(asScenario(demand, offer), offer.name)}
                disabled={demand.architecture === 'moe'}
              >
                Inspect a copy in the visual sandbox
                <ArrowRight size={15} />
              </button>
              <button onClick={exportBrief}>
                <Download size={15} />
                Client brief
              </button>
            </div>
            {demand.architecture === 'moe' && (
              <small>
                The map’s dense-model calculator is separate. Use the MoE memory
                and communication explanation here.
              </small>
            )}
          </div>
        </div>
      </div>
      {showInputs && (
        <div className="md-detail-grid">
          <div>
            <h3>How the model behaves</h3>
            <Pick
              label="Architecture"
              value={demand.architecture}
              options={[
                ['dense', 'Dense model'],
                ['moe', 'Mixture of experts (MoE)'],
              ]}
              onChange={(v) =>
                setDemand((d) => ({
                  ...d,
                  architecture: v as Demand['architecture'],
                }))
              }
            />
            {demand.architecture === 'moe' && (
              <>
                <Field
                  label="Active parameters per token · billions"
                  value={demand.activeParameters}
                  onChange={(activeParameters) =>
                    setDemand((d) => ({ ...d, activeParameters }))
                  }
                />
                <Field
                  label="Planned total KV cache per group · GB"
                  value={demand.moeCacheGB}
                  onChange={(moeCacheGB) =>
                    setDemand((d) => ({ ...d, moeCacheGB }))
                  }
                  hint="Explicit assumption. Establish the model’s MLA/cache representation; this is not a measured DeepSeek value."
                />
              </>
            )}
            <TextField
              label="Serving / training engine and version"
              value={demand.engine}
              onChange={(engine) => setDemand((d) => ({ ...d, engine }))}
            />
            <div className="md-pair">
              <Field
                label="Typical input tokens"
                value={demand.inputTokens}
                step={1}
                onChange={(inputTokens) =>
                  setDemand((d) => ({ ...d, inputTokens }))
                }
              />
              <Field
                label="Typical output tokens"
                value={demand.outputTokens}
                step={1}
                onChange={(outputTokens) =>
                  setDemand((d) => ({ ...d, outputTokens }))
                }
              />
            </div>
            <div className="md-pair">
              <Field
                label="Resident tokens / sequence"
                value={demand.inputs.context}
                min={1}
                step={1}
                onChange={(v) => input('context', v)}
              />
              <Field
                label="Sequences / model group"
                value={demand.inputs.concurrency}
                min={1}
                step={1}
                onChange={(v) => input('concurrency', v)}
              />
            </div>
            {demand.architecture === 'dense' && (
              <details>
                <summary>Attention architecture</summary>
                {(['layers', 'kvHeads', 'headDim', 'kvBytes'] as const).map(
                  (k) => (
                    <Field
                      key={k}
                      label={
                        {
                          layers: 'Layers',
                          kvHeads: 'KV heads',
                          headDim: 'Head dimension',
                          kvBytes: 'KV bytes per element',
                        }[k]
                      }
                      value={demand.inputs[k]}
                      min={k === 'kvBytes' ? 0.25 : 1}
                      onChange={(v) => input(k, v)}
                    />
                  ),
                )}
              </details>
            )}
            <div className="md-pair">
              <Field
                label="Activations / scratch · GB"
                value={demand.inputs.overhead}
                onChange={(v) => input('overhead', v)}
              />
              <Field
                label="Memory reserve · %"
                value={demand.inputs.margin}
                max={100}
                onChange={(v) => input('margin', v)}
              />
            </div>
          </div>
          <div>
            <h3>Data, timing and utilization</h3>
            <TextField
              label="Required region (exact provider label)"
              value={demand.region}
              onChange={(region) => setDemand((d) => ({ ...d, region }))}
            />
            <TextField
              label="Capacity needed by"
              type="date"
              value={demand.neededOn}
              onChange={(neededOn) => setDemand((d) => ({ ...d, neededOn }))}
            />
            <Field
              label="Planned busy fraction"
              value={demand.busyFraction}
              min={0.01}
              max={1}
              hint="0.6 = 60% of paid time at the recorded rate. Used for inference cost; not a measured utilization claim."
              onChange={(busyFraction) =>
                setDemand((d) => ({ ...d, busyFraction }))
              }
            />
            <div className="md-pair">
              <Field
                label="Retained dataset · TB"
                value={demand.inputs.datasetTB}
                onChange={(v) => input('datasetTB', v)}
              />
              <Field
                label="Dataset reads · GB/s"
                value={demand.inputs.datasetRead}
                onChange={(v) => input('datasetRead', v)}
              />
              <Field
                label="Checkpoint payload · GB"
                value={demand.inputs.checkpointGB}
                onChange={(v) => input('checkpointGB', v)}
              />
              <Field
                label="Durable checkpoint window · s"
                value={demand.inputs.checkpointWindow}
                min={1}
                onChange={(v) => input('checkpointWindow', v)}
              />
              <Field
                label="Retained checkpoints"
                value={demand.inputs.checkpointCopies}
                step={1}
                onChange={(v) => input('checkpointCopies', v)}
              />
              <Field
                label="Requests / second"
                value={demand.inputs.requestsPerSecond}
                onChange={(v) => input('requestsPerSecond', v)}
              />
              <Field
                label="Request payload · MB"
                value={demand.inputs.requestMB}
                onChange={(v) => input('requestMB', v)}
              />
              <Field
                label="Response payload · MB"
                value={demand.inputs.responseMB}
                onChange={(v) => input('responseMB', v)}
              />
              <Field
                label="Simultaneous model loads"
                value={demand.inputs.loadCopies}
                step={1}
                onChange={(v) => input('loadCopies', v)}
              />
              <Field
                label="Load window · seconds"
                value={demand.inputs.loadWindow}
                min={1}
                onChange={(v) => input('loadWindow', v)}
              />
            </div>
          </div>
        </div>
      )}
      <div className="md-specialization">
        <div>
          <span className="md-eyebrow">
            RENT AS OFFERED, RECONFIGURE, OR SPECIALIZE?
          </span>
          <h3>What would justify the extra cost?</h3>
          <p>
            {parity && base
              ? `${offer.name} must sustain at least ${fmt(parity.requiredRate, 0)} ${inference ? 'output' : 'training'} tokens/s to cover the client’s rate target and match ${base.name}’s quoted cost per token at the same busy fraction. It must also meet the same quality${inference ? ' and latency' : ''} requirements.`
              : 'Enter allocation quotes for two offers and a qualifying workload run for the baseline. The comparison can then show the throughput a specialized configuration must reach to justify its price.'}
          </p>
          <small>
            Unit-cost parity is a test target, not a performance forecast or a
            buy/build total-cost comparison. Include engineering, operations,
            commitment and unused-capacity costs in the quotes where applicable.
          </small>
        </div>
        {base && (
          <Pick
            label="Baseline for the selected offer"
            value={base.id}
            options={offers
              .filter((o) => o.id !== selected)
              .map((o) => [o.id, o.name])}
            onChange={setBaselineId}
          />
        )}
      </div>
      <div className="md-causal">
        <div>
          <span className="md-eyebrow">LEARN WHY THE MATCH CHANGES</span>
          <h3>Hardware → behavior → client outcome</h3>
        </div>
        <div className="md-mechanisms">
          {mechanisms.map((m) => (
            <button
              key={m.id}
              onClick={() => setMechanism(m.id)}
              className={mechanism === m.id ? 'active' : ''}
            >
              <strong>{m.name}</strong>
              <span>{m.output}</span>
            </button>
          ))}
        </div>
        <div className="md-lesson">
          <p>{lesson.why}</p>
          <div>
            <p>
              <b>Ask the startup / data center:</b> {lesson.ask}
            </p>
            <p>
              <b>Evidence to request:</b> {lesson.proof}{' '}
              <a href={lesson.source} target="_blank" rel="noreferrer">
                Technical source
                <ArrowUpRight size={13} />
              </a>
            </p>
          </div>
        </div>
        <div className="md-experiments">
          <span>
            <FlaskConical size={16} />
            Try one change
          </span>
          {(['memory', 'spine', 'frontend', 'storage'] as Lever[]).map((l) => (
            <button key={l} onClick={() => experiment(l)}>
              {
                {
                  memory: 'Change GPU memory tier',
                  spine: offer.hardware.spine ? 'Remove spine' : 'Add spine',
                  frontend: 'Double frontend capacity',
                  storage: 'Add a storage server',
                }[l]
              }
            </button>
          ))}
          {before && (
            <button
              onClick={() => {
                changeOffer(before);
                setBefore(null);
              }}
            >
              <Undo2 size={14} />
              Undo
            </button>
          )}
        </div>
        {before && (
          <p className="md-delta">
            Memory headroom: {fmt(evaluate(demand, before).headroom)} →{' '}
            {fmt(result.headroom)} GB. Network ceiling for storage transfers:{' '}
            {fmt(evaluate(demand, before).a.dataPathCeiling)} →{' '}
            {fmt(result.a.dataPathCeiling)} GB/s.{' '}
            {result.a.routeMissing
              ? 'A required cross-leaf path is missing.'
              : result.a.crossNode
                ? 'Check placement and communication in the job.'
                : 'The model group stays local; a spine does not accelerate its internal GPU exchanges.'}{' '}
            These changes establish capacity or paths; their speed benefit needs
            a test.
          </p>
        )}
      </div>
      <details className="md-provider">
        <summary>
          Enter {offer.name}’s actual configuration, quote and test results
        </summary>
        <div className="md-provider-grid">
          <div>
            <h3>Provider & allocation</h3>
            <TextField
              label="Offer name"
              value={offer.name}
              onChange={(name) => changeOffer({ name })}
            />
            <Pick
              label="Record type"
              value={offer.kind}
              options={[
                ['example', 'Illustrative configuration'],
                ['client', 'Actual provider offer'],
              ]}
              onChange={(v) => changeOffer({ kind: v as Offer['kind'] })}
            />
            <TextField
              label="Provider reference / quote"
              value={offer.reference}
              onChange={(reference) => changeOffer({ reference })}
            />
            <Pick
              label="Availability"
              value={offer.availability}
              options={[
                ['unknown', 'Not confirmed'],
                ['confirmed', 'Confirmed by provider'],
                ['unavailable', 'Unavailable'],
              ]}
              onChange={(v) =>
                changeOffer({ availability: v as Offer['availability'] })
              }
            />
            <TextField
              label="Region"
              value={offer.region}
              onChange={(region) => changeOffer({ region })}
            />
            <TextField
              label="Available from"
              type="date"
              value={offer.availableOn}
              onChange={(availableOn) => changeOffer({ availableOn })}
            />
            <Field
              label="Entire allocation quote · USD/hour"
              value={offer.hourly}
              onChange={(hourly) => changeOffer({ hourly })}
              hint="0 means unknown. Include all costs you want to compare; never enter a per-GPU price here."
            />
            <Pick
              label="GPU family"
              value={offer.hardware.gpu}
              options={[
                ['H100', 'H100'],
                ['H200', 'H200'],
                ['B300', 'B300'],
              ]}
              onChange={(v) => {
                const gpu = v as Scenario['gpu'];
                changeOffer({
                  hardware: {
                    ...offer.hardware,
                    gpu,
                    hbm: gpuSpecs[gpu].hbm,
                    cores: gpuSpecs[gpu].cores,
                    linkGbps: gpuSpecs[gpu].link,
                  },
                });
              }}
            />
            <div className="md-pair">
              <Field
                label="Servers · 8 GPUs each"
                value={offer.hardware.nodes}
                step={1}
                min={1}
                max={4096}
                onChange={(v) => hardware('nodes', v)}
              />
              <Field
                label="GPUs in one model/job group"
                value={offer.hardware.group}
                step={1}
                min={1}
                max={32768}
                onChange={(v) => hardware('group', v)}
              />
              <Field
                label="Usable HBM / GPU · GB"
                value={offer.hardware.hbm}
                min={1}
                onChange={(v) => hardware('hbm', v)}
              />
              <Field
                label="CPU cores / server"
                value={offer.hardware.cores}
                step={1}
                onChange={(v) => hardware('cores', v)}
              />
              <Field
                label="Host RAM / server · GB"
                value={offer.hardware.ramGB}
                onChange={(v) => hardware('ramGB', v)}
              />
              <Field
                label="Local NVMe / server · TB"
                value={offer.hardware.cacheTB}
                onChange={(v) => hardware('cacheTB', v)}
              />
            </div>
          </div>
          <div>
            <h3>Network & storage</h3>
            <Pick
              label="GPU backend"
              value={offer.hardware.fabric}
              options={[
                ['roce', 'RoCE Ethernet'],
                ['ib', 'InfiniBand'],
              ]}
              onChange={(v) => hardware('fabric', v)}
            />
            <Toggle
              label="Workload group crosses leaves"
              checked={offer.hardware.crossLeaf}
              onChange={(v) => hardware('crossLeaf', v)}
            />
            <Toggle
              label="Spine path exists"
              checked={offer.hardware.spine}
              onChange={(v) => hardware('spine', v)}
            />
            <div className="md-pair">
              {(
                [
                  'linkGbps',
                  'downlinks',
                  'uplinks',
                  'nsGbps',
                  'storageNodes',
                  'storageCores',
                  'storageRam',
                  'storageNic',
                  'rawTBPerStorage',
                  'protection',
                  'measuredRead',
                  'measuredWrite',
                ] as const
              ).map((k) => (
                <Field
                  key={k}
                  label={
                    {
                      linkGbps: 'Endpoint / uplink · Gb/s',
                      downlinks: 'Endpoint ports / leaf',
                      uplinks: 'Spine ports / leaf',
                      nsGbps: 'Aggregate frontend · Gb/s',
                      storageNodes: 'Storage server count',
                      storageCores: 'Storage CPU cores / server',
                      storageRam: 'Storage RAM / server · GB',
                      storageNic: 'Storage NIC / server · Gb/s',
                      rawTBPerStorage: 'Raw drives / server · TB',
                      protection: 'Raw-to-usable factor',
                      measuredRead: 'Recorded read · GB/s',
                      measuredWrite: 'Recorded durable write · GB/s',
                    }[k]
                  }
                  value={offer.hardware[k]}
                  min={
                    ['linkGbps', 'downlinks', 'protection'].includes(k) ? 1 : 0
                  }
                  step={
                    [
                      'downlinks',
                      'uplinks',
                      'storageNodes',
                      'storageCores',
                    ].includes(k)
                      ? 1
                      : 'any'
                  }
                  onChange={(v) => hardware(k, v)}
                />
              ))}
            </div>
            <Field
              label="Planned network payload fraction"
              value={offer.hardware.utilization}
              min={0.1}
              max={1}
              onChange={(v) => hardware('utilization', v)}
            />
            <p className="md-note">
              A port-count model is a planning screen. Record rails, NIC
              affinity, routing, congestion controls, drive tiers and degraded
              behavior with the provider.
            </p>
          </div>
          <div>
            <h3>Prove the workload result</h3>
            <p className="md-note">
              Enter one run across this entire allocation, using this
              model/version, engine, traffic shape and quality requirement.
              Generic MLPerf scores are not substituted for this client test.
            </p>
            <TextField
              label="Engine / version"
              value={demand.engine}
              onChange={(engine) => setDemand((d) => ({ ...d, engine }))}
            />
            <TextField
              label="Test report / log reference"
              value={runDraft.reference}
              onChange={(reference) =>
                setRunDraft((r) => ({ ...r, reference }))
              }
            />
            <TextField
              type="date"
              label="Test date"
              value={runDraft.date}
              onChange={(date) => setRunDraft((r) => ({ ...r, date }))}
            />
            <TextField
              label="Request trace / dataset and quality criterion"
              value={runDraft.trace}
              onChange={(trace) => setRunDraft((r) => ({ ...r, trace }))}
            />
            <Field
              label={
                inference
                  ? 'Measured allocation output tokens/s'
                  : 'Measured allocation training tokens/s'
              }
              value={runDraft.rate}
              onChange={(rate) => setRunDraft((r) => ({ ...r, rate }))}
            />
            {inference && (
              <div className="md-pair">
                <Field
                  label="Measured p99 first token · ms"
                  value={runDraft.ttft}
                  onChange={(ttft) => setRunDraft((r) => ({ ...r, ttft }))}
                />
                <Field
                  label="Measured p99 per token · ms"
                  value={runDraft.tpot}
                  onChange={(tpot) => setRunDraft((r) => ({ ...r, tpot }))}
                />
              </div>
            )}
            <Toggle
              label="Client model-quality criterion passed"
              checked={runDraft.qualityPass}
              onChange={(qualityPass) =>
                setRunDraft((r) => ({ ...r, qualityPass }))
              }
            />
            <button className="md-primary" onClick={recordRun}>
              Attach result to this configuration
            </button>
            {offer.run && (
              <p className="md-note">
                Recorded {offer.run.date}: {offer.run.reference}.{' '}
                {result.stale
                  ? 'Inputs changed; retest required.'
                  : 'Applies to the current recorded inputs.'}
              </p>
            )}
            <p className="md-note">
              Inference cost = hourly allocation quote ÷ (measured output
              tokens/s × 3,600 × planned busy fraction) × 1,000,000. This
              excludes unentered costs and does not explain another provider’s
              API pricing. Training time = token budget ÷ measured training
              rate; add downtime, evaluation and other work separately.
            </p>
          </div>
        </div>
      </details>
      <details className="md-post">
        <summary>Why a generic cluster can be a poor fit</summary>
        <p>
          Dax’s post argues that broadly configured clusters can be hard to
          optimize for a particular inference service. That is a hypothesis to
          investigate through a matched workload test. Hardware, precision,
          serving software, traffic mix, utilization and commercial pricing all
          affect the comparison.{' '}
          <a
            href="https://x.com/thdxr/status/2099129187390898291"
            target="_blank"
            rel="noreferrer"
          >
            Read the post
          </a>
        </p>
        <p>
          DeepSeek-V3’s report describes separating prompt processing from token
          generation during inference, alongside model-specific parallelism and
          communication work. A specialization to test is whether separate pools
          improve this client’s latency and useful throughput enough to cover KV
          transfers, extra networking and operational cost. The current
          calculator does not simulate that split or infer DeepSeek’s economics.{' '}
          <a
            href="https://arxiv.org/html/2412.19437v1#S3.SS4"
            target="_blank"
            rel="noreferrer"
          >
            DeepSeek’s inference design
          </a>
        </p>
      </details>
      {message && (
        <div className="md-message" role="status">
          {message}
          <button onClick={() => setMessage('')} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
    </section>
  );
}
