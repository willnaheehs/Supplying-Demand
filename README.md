# Supplying Demand

A two-way consulting workbench for AI infrastructure:

- Practice three fictional dense-language-model client cases: inference, adapter tuning, and full-parameter training.
- Assess actual client requirements using guided discovery, transparent memory calculations, a component decision map, and a qualification memo.
- Enter available compute, RoCE / InfiniBand / TCP fabric, storage and facility inventory to screen client archetypes and expose configuration gaps.

Client assessments stay in browser memory. Export JSON to resume an assessment and Markdown to keep the recommendation, inputs, evidence, component rationale and references. Nothing is sent to an AI model. The app does not discover real buyers or promise measured performance.

## Development

Node 22.13+ for the starter; Node 24 recommended for the TypeScript test runner.

```sh
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

## Method

All capacities use decimal GB / TB. Inference memory uses a full-attention KV-cache formula with editable architecture inputs. Training state assumes an explicitly configurable byte count per trainable parameter; activations, temporary storage and planning reserve are input assumptions. Aggregate GPU memory is not automatically shared or evenly sharded. Reported GPU lower bounds check memory only. Topology checks distinguish a local group, a same-leaf/rail group, and a cross-leaf path. Uplink oversubscription never becomes a fabricated application-performance multiplier.

CPU throughput, storage performance, scheduling, model quality, commercial viability and actual latency require workload-specific measurements. Scope currently excludes detailed MoE, multimodal and advanced cache/sharding simulation. Hardware quantities are an inventory screen, not a validated deployable bill of materials.

Sources are included within the app and exported memo. The reference compute fields are based on the NVIDIA DGX B300 specification; the fabric, storage and client examples are illustrative assumptions.

## Verification

Domain tests cover memory formulas, adapter versus full training state, topology connectivity, oversubscription, missing inventory, reverse matching and report content. The browser's read-only assessment tool is exposed when WebMCP is supported; it rejects unexpected arguments. No broad browser UI or responsive testing was requested.
