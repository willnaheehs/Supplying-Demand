import { analyzeScenario, type Scenario } from './cluster-lab.ts';
import { fmt } from './consulting.ts';
import type { ClusterDescription } from './cluster-evidence';

export function describeScenario(s: Scenario): ClusterDescription {
  const a = analyzeScenario(s);
  const serverWord = s.nodes === 1 ? 'server' : 'servers';
  const path = !a.crossNode
    ? 'The selected workload group fits within one eight-GPU server, so its GPU exchanges stay local.'
    : !s.crossLeaf
      ? 'The workload spans servers placed on the same leaf or rail; this placement does not use a spine for their GPU exchanges.'
      : a.routeMissing
        ? 'The workload spans leaves, but no usable spine path connects them in this configuration.'
        : `The workload spans leaves connected through a spine. Each leaf has ${s.downlinks} endpoint ports and ${s.uplinks} same-speed uplinks, a ${fmt(a.oversub)}:1 capacity ratio.`;
  const storage =
    s.storageNodes > 0
      ? `Shared storage has ${s.storageNodes} server(s), each with ${s.storageCores} CPU cores, ${fmt(s.storageRam)} GB of RAM and a ${fmt(s.storageNic)} Gb/s network connection. After the configured protection overhead, it provides ${fmt(a.usableTB)} TB of usable capacity.`
      : 'No shared storage servers are configured.';
  const workload =
    s.workload === 'training'
      ? `The intended workload is full training of a dense ${fmt(s.parameters)}-billion-parameter model on ${fmt(s.trainTokensB)} billion tokens in ${fmt(s.days)} days. That deadline requires an average ${fmt(a.requiredTps, 0)} training tokens per second.`
      : `The intended workload is inference for a dense ${fmt(s.parameters)}-billion-parameter model, targeting ${fmt(s.targetTps, 0)} output tokens per second. The service targets are ${fmt(s.ttftMs)} ms to the first token and ${fmt(s.tpotMs)} ms per subsequent token at the 99th percentile.`;
  const memory = a.fit
    ? `The calculated ${fmt(a.memory.total)} GB memory requirement fits within the selected group’s ${fmt(a.capacity)} GB in aggregate, assuming the software can partition the state appropriately.`
    : `The calculated ${fmt(a.memory.total)} GB memory requirement exceeds the selected group’s ${fmt(a.capacity)} GB.`;
  const bottleneck = a.issues.length
    ? `The current checks identify ${a.issues.length === 1 ? 'a gap' : 'gaps'}: ${a.issues.join(' ')}`
    : 'The capacity and connectivity checks reveal no listed blockers.';
  const io =
    a.writeTarget > 0
      ? `The storage target is ${fmt(a.readTarget)} GB/s of reads and ${fmt(a.writeTarget)} GB/s of durable writes.`
      : `The storage read target is ${fmt(a.readTarget)} GB/s; no checkpoint-write target is set.`;
  return {
    hardware: `This scenario uses ${s.nodes} ${serverWord} with eight ${s.gpu} GPUs each (${a.totalGPUs} GPUs total), ${fmt(s.hbm)} GB of memory per GPU, and ${s.cores} CPU cores plus ${fmt(s.ramGB)} GB of RAM per server. Each host has ${fmt(s.cacheTB)} TB of local NVMe. The configured backend is ${s.fabric === 'roce' ? 'RoCE Ethernet' : 'InfiniBand'} at ${fmt(s.linkGbps)} Gb/s per endpoint. ${path} ${storage} A separate ${fmt(s.nsGbps)} Gb/s aggregate north–south network carries client and storage traffic.`,
    result: `${workload} ${memory} ${io}`,
    meaning: `${bottleneck} These are planning calculations, not measured workload results. Actual speed, latency and efficiency remain unverified; benchmark the model, software and traffic pattern before promising this outcome to a client.`,
  };
}
