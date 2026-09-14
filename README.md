# Supplying Demand

A single-page consulting tool for matching startup workloads to data-center cluster offers, with an expandable educational cluster lab. Inspect dated public cluster disclosures, make a hardware variant, and connect workload behavior to GPU servers, host resources, backend topology, north–south traffic and storage requirements.

- Read a plain-English account of each cluster’s hardware, workload, measured result and consulting implications above the map. Scenario descriptions update with the inputs and remain explicitly unmeasured.
- Drag or click reference components onto the map. Select a component to explain or configure it in the adjacent inspector.
- Follow prompt processing, token generation, training, checkpoint and model-loading paths.
- Explore seven public records, including Meta H100/RoCE training, DeepSeek-V3, and H100/B300 MLPerf submissions. Unknown configuration fields remain unknown.
- Inspect four pinned MLPerf runs, including their model, precision, software, system metadata, publication date and latency constraints.
- Export/import version 2 scenario JSON, or download a Markdown qualification memo. Data stays in page memory until exported. No API keys or model calls are needed.

## Matching workflow

The main comparison keeps one client workload fixed while evaluating up to twelve offers. Start with an illustrative dense inference, MoE inference, or dense full-training case, then enter actual model revisions, engines, request shapes, allocation configurations and provider terms. Example allocations have no implied price or availability.

The readout distinguishes configuration blockers, missing or stale benchmarks, missed targets, and recorded targets met. Availability, region, start date and provider references remain separate supply checks. CPU, GPU memory/compute, local links, backend fabrics, storage and frontend networking each have a plain-English causal explanation and an acceptance test to request. Changes in the visual sandbox are separate copies of the selected offer.

Record a dated workload run against the entire offered allocation. Rate, latency and quality must pass together before inference cost is calculated. Changing tested model/configuration inputs marks the run stale. Quote, business deadline and target changes re-evaluate the existing result. All entered evidence remains user-provided, not independently verified. Import/export preserves complete comparisons and captured evidence; a Markdown client brief captures assumptions and open questions.

Inference quote cost per million output tokens uses the entire allocation’s hourly quote divided by measured token production at an explicit planned busy fraction. Training duration uses token budget / measured training rate and excludes extra downtime, evaluation and other work. The specialization comparison calculates the measured rate needed to match a qualifying baseline’s quoted unit cost, subject to the client target. It is not a capex/opex model or an explanation of another provider’s API price.

MoE inference memory includes **all resident weights**, an explicit cache allowance, scratch and reserve. Active parameters do not replace resident parameters. MoE training, expert routing performance and separated prefill/decode pools are not simulated. The DeepSeek report is used to explain why software, architecture and placement matter; its results do not become a generic prediction.

The original dated evidence, plain-English cluster descriptions and drag/drop sandbox remain available below the main comparison on the same page.

## Development

Node 24 recommended.

```sh
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

The root page renders `components/cluster-lab.tsx`, with the main workflow in `components/matching-desk.tsx` and comparison logic in `lib/matching.ts`. Domain calculations and validation live in `lib/cluster-lab.ts`; curated disclosures are in `lib/cluster-evidence.ts`. The preceding guided workbench remains in source for reference but is no longer part of the page.

## Evidence and refresh

`scripts/refresh-evidence.py` retrieves official MLCommons summary files, system metadata and valid performance logs from pinned Git revisions. Run `python3 scripts/refresh-evidence.py` to regenerate `data/mlperf-snapshot.json`. Updating versions requires reviewing the submissions and editing the selected source definitions. The snapshots are reviewed as of September 12, 2026; they are not live telemetry or available-for-sale inventory.

H100 Llama 2 70B data comes from MLPerf Inference v5.0 at FP8, and B300 from v6.0 at FP4. Their bars are not a controlled GPU-only comparison or evidence of scale-out RoCE performance. B300 submission metadata lists 270 GB per GPU, while the nominal DGX reference palette uses 288 GB. Both remain explicitly labeled.

## Calculation scope

All GB and TB are decimal. Dense inference memory uses explicit weight and full-attention KV-cache architecture assumptions. Dense full training assumes 16 bytes per parameter for state, plus an editable activation/scratch allowance and reserve. Aggregate GPU memory is a lower-bound screen, not a guarantee of per-GPU fit or predicted throughput.

A missing spine blocks only an explicitly cross-leaf, cross-server workload group in this simplified topology. Uplink oversubscription does not become a fabricated application slowdown. The reference server has eight locally connected GPUs. Placement, rails, routing, congestion control and failures need deployment-specific validation.

Frontend capacity budgets simultaneous client and storage traffic using the larger full-duplex direction and an explicit utilization allowance. Storage requirements include model loading, dataset reads, durable checkpoint writes, data retention and protection overhead. CPU, drive, metadata and software performance require measurements. This is not a deployable bill of materials or a procurement guarantee.

## Verification

Domain tests cover benchmark applicability and staleness, cost gating, supply qualification, MoE resident memory, specialization thresholds, comparison round-trips, memory formulas, inventory bounds, cross-leaf connectivity, full-duplex traffic sizing, storage retention and durability targets, validation, and benchmark provenance. Existing consulting-domain tests are also retained.

When supported, the browser exposes `read_cluster_mapping` and `configure_cluster_scenario` through WebMCP. Configuration validates complete scenario objects before updating the visible page; rejected inputs leave state unchanged.
