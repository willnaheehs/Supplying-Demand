'use client';
import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { benchmarks, clusterRecords } from '@/lib/cluster-evidence';
import {
  defaultWorkloadRequest,
  findWorkloadEvidence,
  type WorkloadRequest,
} from '@/lib/workload-evidence';

export default function WorkloadFinder({
  activeRecordId,
  onSelect,
}: {
  activeRecordId: string | null;
  onSelect: (id: string, request: WorkloadRequest) => void;
}) {
  const [request, setRequest] = useState<WorkloadRequest>(
    defaultWorkloadRequest,
  );
  const [submitted, setSubmitted] = useState<WorkloadRequest>(
    defaultWorkloadRequest,
  );
  const dirty = JSON.stringify(request) !== JSON.stringify(submitted);
  const result = findWorkloadEvidence(submitted, benchmarks);
  const training = request.kind === 'training';
  const models = training
    ? [
        { value: 'llama3', label: 'Llama 3 · Meta training disclosure' },
        { value: 'deepseek-v3', label: 'DeepSeek-V3 · MoE training' },
        { value: 'other', label: 'Another model' },
      ]
    : [
        { value: 'llama2-70b-99', label: 'Llama 2 70B' },
        { value: 'llama3.1-70b', label: 'Llama 3.1 70B' },
        { value: 'deepseek-v3', label: 'DeepSeek-V3' },
        { value: 'other', label: 'Another model' },
      ];
  const update = (patch: Partial<WorkloadRequest>) =>
    setRequest((r) => ({ ...r, ...patch }));
  return (
    <section
      className="workload-finder"
      aria-label="Find a configuration for a workload"
    >
      <div className="workload-choice">
        <b>What do you need to run?</b>
        <Tabs
          value={request.kind}
          onValueChange={(value) => {
            const kind = value as WorkloadRequest['kind'];
            update({
              kind,
              model: kind === 'training' ? 'llama3' : 'llama2-70b-99',
            });
          }}
        >
          <TabsList>
            <TabsTrigger value="interactive">Interactive inference</TabsTrigger>
            <TabsTrigger value="batch">Batch inference</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted({ ...request });
          const next = findWorkloadEvidence(request, benchmarks);
          if (next.recordIds[0]) onSelect(next.recordIds[0], request);
        }}
      >
        <div className="workload-inputs">
          <div className="workload-model">
            <label id="workload-model-label">Model</label>
            <Select
              value={request.model}
              items={models}
              onValueChange={(v) => v && update({ model: String(v) })}
            >
              <SelectTrigger aria-labelledby="workload-model-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!training && (
            <label className="workload-rate">
              Output tokens / second
              <input
                type="number"
                min="1"
                max="1000000000"
                required
                value={request.tokensPerSecond || ''}
                onChange={(e) =>
                  update({ tokensPerSecond: Number(e.target.value) })
                }
              />
            </label>
          )}
          <button className="lc-primary" type="submit">
            {training ? 'Show reported setup' : 'Show tested setup'}
            <ArrowRight size={15} />
          </button>
        </div>
        {request.kind === 'interactive' && (
          <details className="workload-targets">
            <summary>
              Response-time targets · {request.firstTokenMs} /{' '}
              {request.perTokenMs} ms <ChevronDown size={14} />
            </summary>
            <div>
              <label>
                p99 first token · ms
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  required
                  value={request.firstTokenMs || ''}
                  onChange={(e) =>
                    update({ firstTokenMs: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                p99 per output token · ms
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  required
                  value={request.perTokenMs || ''}
                  onChange={(e) =>
                    update({ perTokenMs: Number(e.target.value) })
                  }
                />
              </label>
            </div>
          </details>
        )}
      </form>
      <div
        className={`workload-match ${!dirty && result.level === 'none' ? 'unsupported' : ''}`}
        role="status"
      >
        {dirty ? (
          <p>
            Choose “{training ? 'Show reported setup' : 'Show tested setup'}” to
            apply these changes. The map still shows the previous selection.
          </p>
        ) : (
          <>
            <div className="workload-matches">
              <span>
                {result.level === 'measured'
                  ? 'Tested references'
                  : result.level === 'reported'
                    ? 'Reported deployment'
                    : 'No matching evidence'}
              </span>
              {result.recordIds.map((id) => {
                const r = clusterRecords.find((record) => record.id === id)!;
                const b = benchmarks.find((b) => b.id === r.benchmarkId);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activeRecordId === id}
                    onClick={() => onSelect(id, submitted)}
                  >
                    {activeRecordId === id && <CheckCircle2 size={14} />}
                    {b
                      ? `8 × ${b.gpu} · ${b.precision.toUpperCase()} · ${b.version}`
                      : r.name}
                  </button>
                );
              })}
            </div>
            <p>
              {result.message}
              {result.level === 'none'
                ? ' The map below remains a reference, not a match for this request.'
                : !result.recordIds.includes(activeRecordId || '')
                  ? ' Select a reference above to put it back on the map.'
                  : ''}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
