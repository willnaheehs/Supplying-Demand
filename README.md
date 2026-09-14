# Supplying Demand

A single-page consulting tool for matching startup workloads to data-center cluster offers, built around an always-visible educational hardware map. Inspect dated public cluster disclosures, make a hardware variant, and connect workload behavior to GPU servers, host resources, backend topology, north–south traffic and storage requirements.

- Read an account of each cluster’s hardware, workload, measured result and consulting implications below the map. Scenario descriptions update with the inputs and remain explicitly unmeasured.
- Start with interactive inference, batch inference or training. Choose a model and numeric targets to find matching evidence. Inference matches retain exact benchmark scenario, precision, software and request distribution; training disclosures are labeled reported, not measured client recommendations. Missing evidence never becomes an invented configuration.
- Drag or click reference components onto the map. Select a component to explain or configure it in the adjacent inspector.
- Follow prompt processing, token generation, training, checkpoint and model-loading paths.
- Search a sourced database of **677 workload observations, 228 system/configuration identifiers and 46 model/workload labels**. The initial sample includes 540 valid inference runs, 119 successful training trials and 18 operator/research observations. These are observations, not 677 distinct physical clusters.
- Select a database observation to map its accelerators, CPU/RAM, within-node links, network topology, local/shared storage, storage servers and frontend. Click a component for its role, disclosed details and client verification questions. Unknown fields remain unknown. Each outcome retains source links, units and conditions.
- Add and edit your own sourced observations. They persist in platform D1 and are private to the signed-in account; user-entered claims are explicitly unverified. Export the catalog, including your additions, as JSON. Published seed records stay read-only in the UI.
- The original guided sandbox retains four pinned MLPerf examples plus the original cluster disclosures. It supports scenario JSON and Markdown exports; sandbox scenarios and offer comparisons still stay in page memory until exported. The growing catalog and the smaller guided example set are labeled separately. No model API key is needed.

## Matching workflow

The optional “Compare offers for a client” section is closed by default below the map, descriptions and evidence. It keeps one client workload fixed while evaluating up to twelve offers. Start with an illustrative dense inference, MoE inference, or dense full-training case, then enter actual model revisions, engines, request shapes, allocation configurations and provider terms. Example allocations have no implied price or availability.

The readout distinguishes configuration blockers, missing or stale benchmarks, missed targets, and recorded targets met. Availability, region, start date and provider references remain separate supply checks. CPU, GPU memory/compute, local links, backend fabrics, storage and frontend networking each have a causal explanation and an acceptance test to request. Exploring an offer on the map creates a separate copy and returns to the canvas.

Record a dated workload run against the entire offered allocation. Rate, latency and quality must pass together before inference cost is calculated. Changing tested model/configuration inputs marks the run stale. Quote, business deadline and target changes re-evaluate the existing result. All entered evidence remains user-provided, not independently verified. Import/export preserves complete comparisons and captured evidence; a Markdown client brief captures assumptions and open questions.

Inference quote cost per million output tokens uses the entire allocation’s hourly quote divided by measured token production at an explicit planned busy fraction. Training duration uses token budget / measured training rate and excludes extra downtime, evaluation and other work. The specialization comparison calculates the measured rate needed to match a qualifying baseline’s quoted unit cost, subject to the client target. It is not a capex/opex model or an explanation of another provider’s API price.

MoE inference memory includes **all resident weights**, an explicit cache allowance, scratch and reserve. Active parameters do not replace resident parameters. MoE training, expert routing performance and separated prefill/decode pools are not simulated. The DeepSeek report is used to explain why software, architecture and placement matter; its results do not become a generic prediction.

The workload selector, visual map, component palette and workload paths are the main view. Click a component for a workload-specific explanation and the limits of its supporting evidence. Source phases stay aligned with training or inference, and training variants preserve their workload type. Longer descriptions follow the outcomes; source calculations and detailed offer comparison expand only when needed.

## Development

Node 24 recommended.

```sh
npm install
npm run db:local
npm run dev
npm test
npx tsc --noEmit
npm run build
```

The root page renders `components/cluster-lab.tsx`, with the optional detailed comparison in `components/matching-desk.tsx` and comparison logic in `lib/matching.ts`. Domain calculations and validation live in `lib/cluster-lab.ts`; curated disclosures are in `lib/cluster-evidence.ts`. The preceding guided workbench remains in source for reference but is no longer part of the page.

The growing library is `components/cluster-catalog.tsx`; record types, validation and filtering are in `lib/catalog.ts`. `/api/catalog` serves the combined catalog and saves manual entries using prepared D1 statements in `db/catalog-store.ts`. The platform forwards signed-in identity; anonymous production requests are rejected. Writes require same-origin JSON. Manual records are owner-scoped, while source snapshots are shared with authenticated viewers. Database responses are not cacheable. Local development uses Sites' local identity, or a development-only localhost fallback.

`db/schema.ts` is the schema source of truth; `npx drizzle-kit generate` creates schema-only migrations in `drizzle/`. Applied production migrations must remain immutable. Sites applies them before publishing. `npm run db:local` applies unapplied migrations to the project-local preview database; it does not access production. Seed import is idempotent, revisioned, and never overwrites manual records. The next snapshot can retire withdrawn seed observations. Back up manual data with the catalog Export button; it is not committed to the public Git repository.

## Evidence and refresh

`python3 scripts/refresh-catalog.py` rebuilds `data/cluster-catalog.json` and `data/catalog-manifest.json` from six pinned MLCommons repositories (Inference and Training v5.0, v5.1 and v6.0), plus `data/cluster-deployments.json`. It uses only Python's standard library and public sources. A cache defaults to `/tmp/sd-catalog-research`; use `--cache PATH` to choose another. Changing a pin requires review of the resulting data and manifest. Keep operator/research additions in `cluster-deployments.json` so refresh preserves them.

The sample takes up to 180 inference configurations and 40 training `result_0` trials per release, round-robin by submitter then model/scenario, independent of performance. Inference requires a closed datacenter submission, compliance flag, no summary errors, unique result path, retrievable system metadata and a raw `VALID` performance log. Power variants are excluded. Training requires a closed submission with `run_start` and a successful `run_stop`; its metric is elapsed trial minutes, **not the official aggregate MLPerf result** and not complete model pretraining time. Exclusions and repository revisions are recorded in the manifest. System identities group submitter/platform identifiers; they are not verified physical-machine identities, and counts must not be summed across observations.

Operator and author sources include Meta engineering reports, DeepSeek-V3, BLOOM, Falcon, Poro, PaLM, DBRX, Llama 3 scaling, TorchTitan, context-parallel inference and NVIDIA's Colossus deployment report. Some have numeric outcomes; others only substantiate reported use. They do not establish current rental availability. Networking metadata can mix roles; the importer never invents a backend/frontend split, spine count or shared-storage system. Counts derived from nodes × accelerators/node are labeled; conflicting count labels remain unknown. Benchmark units and model/scenario identities are preserved. Precision, software, prompt distribution, latency requirements and quality targets can differ, including across MLPerf versions. Equal units do not establish comparable results.

The application does not predict performance for changed hardware. Database observations show the original measured/reported configuration, while the sandbox performs explicit capacity arithmetic. Published outcomes are not transferred to arbitrary variants.

`scripts/refresh-evidence.py` retrieves official MLCommons summary files, system metadata and valid performance logs from pinned Git revisions. Run `python3 scripts/refresh-evidence.py` to regenerate `data/mlperf-snapshot.json`. Updating versions requires reviewing the submissions and editing the selected source definitions. The snapshots are reviewed as of September 12, 2026; they are not live telemetry or available-for-sale inventory.

H100 Llama 2 70B data comes from MLPerf Inference v5.0 at FP8, and B300 from v6.0 at FP4. Their bars are not a controlled GPU-only comparison or evidence of scale-out RoCE performance. B300 submission metadata lists 270 GB per GPU, while the nominal DGX reference palette uses 288 GB. Both remain explicitly labeled.

## Calculation scope

All GB and TB are decimal. Dense inference memory uses explicit weight and full-attention KV-cache architecture assumptions. Dense full training assumes 16 bytes per parameter for state, plus an editable activation/scratch allowance and reserve. Aggregate GPU memory is a lower-bound screen, not a guarantee of per-GPU fit or predicted throughput.

A missing spine blocks only an explicitly cross-leaf, cross-server workload group in this simplified topology. Uplink oversubscription does not become a fabricated application slowdown. The reference server has eight locally connected GPUs. Placement, rails, routing, congestion control and failures need deployment-specific validation.

Frontend capacity budgets simultaneous client and storage traffic using the larger full-duplex direction and an explicit utilization allowance. Storage requirements include model loading, dataset reads, durable checkpoint writes, data retention and protection overhead. CPU, drive, metadata and software performance require measurements. This is not a deployable bill of materials or a procurement guarantee.

## Verification

Domain tests cover benchmark applicability and staleness, cost gating, supply qualification, MoE resident memory, specialization thresholds, comparison round-trips, memory formulas, inventory bounds, cross-leaf connectivity, full-duplex traffic sizing, storage retention and durability targets, validation, and benchmark provenance. Existing consulting-domain tests are also retained.

When supported, the browser exposes `read_cluster_mapping` and `configure_cluster_scenario` through WebMCP. Configuration validates complete scenario objects before updating the visible page; rejected inputs leave state unchanged.
