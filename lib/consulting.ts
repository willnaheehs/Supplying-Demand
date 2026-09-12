export type Workload = 'inference' | 'lora' | 'training';
export type Inputs = {
  name: string; goal: string; workload: Workload; parameters: number; weightBytes: number;
  context: number; sequences: number; layers: number; kvHeads: number; headDim: number; kvBytes: number;
  overheadGB: number; stateBytes: number; trainablePercent: number; marginPercent: number;
  targetTps: number; firstTokenMs: number; tokenMs: number; tokensB: number; days: number;
  checkpointGB: number; checkpointSeconds: number; readGBs: number; storageTB: number;
};
export type Hardware = {
  label: string; nodes: number; gpus: number; hbm: number; gpuGroup: number;
  sockets: number; cpuCores: number; ram: number; nvmeTB: number;
  fabric: 'roce'|'ib'|'tcp'; topology: 'single'|'spine'|'disconnected'; nvlink: boolean;
  nicPorts: number; linkGbps: number; downlinks: number; uplinks: number; uplinkGbps: number;
  storageServers: number; storageCores: number; storageRam: number; storageNicGbps: number;
  storageMedia: 'nvme'|'mixed'|'hdd'; drivesPerServer:number; driveTB:number; serviceGbps:number; sharedFabric:boolean;
  storageTB: number; readGBs: number; writeGBs: number; nodeKW: number; powerKW: number;
};
export const sources = [
  {title:'DGX B300 system specifications', url:'https://docs.nvidia.com/dgx/dgxb300-user-guide/introduction-to-dgxb300.html', note:'8 GPUs, 288 GB per GPU, host components and network interfaces.'},
  {title:'Inference metrics · NVIDIA', url:'https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html', note:'Latency, first token, and throughput definitions.'},
  {title:'Model memory · Hugging Face', url:'https://huggingface.co/docs/transformers/model_memory_anatomy', note:'Weights, optimizer state, gradients, activations, and temporary memory.'},
  {title:'KV cache strategies · Hugging Face', url:'https://huggingface.co/docs/transformers/kv_cache', note:'Cache behavior varies with model architecture and serving strategy.'},
  {title:'HGX physical network topologies · NVIDIA', url:'https://docs.nvidia.com/enterprise-reference-architectures/hgx-ai-factory/latest/networking-physical-topologies.html', note:'Scale-out connectivity and reference fabric layouts.'},
  {title:'RoCE configuration · NVIDIA', url:'https://docs.nvidia.com/networking-ethernet-software/cumulus-linux/Layer-1-and-Switch-Ports/Quality-of-Service/RDMA-over-Converged-Ethernet-RoCE/', note:'Validated endpoints, congestion control, ECN and PFC options.'},
  {title:'GPUDirect Storage design · NVIDIA', url:'https://docs.nvidia.com/gpudirect-storage/design-guide/', note:'Storage data paths and host-memory bounce buffers.'},
  {title:'Distributed training · PyTorch', url:'https://pytorch.org/blog/maximizing-training/', note:'Communication, sharding, and training performance.'},
  {title:'Storage services · BeeGFS', url:'https://doc.beegfs.io/8.1/architecture/overview.html', note:'Metadata and file contents have distinct service roles.'},
];
export const baseInputs: Inputs = {
 name:'Meridian · employee assistant',goal:'Host an internal assistant. Keep response times predictable at peak usage.',workload:'inference',
 parameters:70,weightBytes:2,context:32768,sequences:8,layers:80,kvHeads:8,headDim:128,kvBytes:2,
 overheadGB:16,stateBytes:16,trainablePercent:1,marginPercent:15,
 targetTps:500,firstTokenMs:1000,tokenMs:50,tokensB:100,days:30,
 checkpointGB:0,checkpointSeconds:120,readGBs:1,storageTB:2,
};
export const defaultHardware: Hardware = {
 label:'B300 reference compute · illustrative cluster',nodes:4,gpus:8,hbm:288,gpuGroup:8,
 sockets:2,cpuCores:128,ram:2048,nvmeTB:30.72,nvlink:true,
 fabric:'roce',topology:'spine',nicPorts:8,linkGbps:800,downlinks:32,uplinks:16,uplinkGbps:800,
 storageServers:2,storageCores:64,storageRam:512,storageNicGbps:800,storageMedia:'nvme',drivesPerServer:24,driveTB:7.68,serviceGbps:800,sharedFabric:false,storageTB:200,readGBs:0,writeGBs:0,nodeKW:14.5,powerKW:80,
};
export const cases: {id:string;title:string;level:string;brief:string;lesson:string;buyer:string;inputs:Inputs;quiz:{question:string;options:string[];answer:number;explanation:string}}[] = [
 {id:'assistant',title:'An internal AI assistant',level:'01 · Inference',buyer:'Enterprise AI platform team',brief:'“We want a private 70B assistant for employees. Eight long conversations may be active per model instance, and our service needs 500 output tokens per second.”',lesson:'Separate model fit from the capacity to serve users at a latency target.',inputs:baseInputs,quiz:{question:'The model weights fit in GPU memory. What can you promise the client?',options:['The latency target will be met.','The weights fit; serving capacity still needs testing.','A faster spine will make every answer faster.'],answer:1,explanation:'Memory is a feasibility check. Measure the actual model, prompts, concurrency and serving software before promising throughput or response time.'}},
 {id:'adapt',title:'Adapt a model to company data',level:'02 · Fine-tuning',buyer:'Applied AI / domain model team',brief:'“We want to adapt a 32B model to our support data using adapters. About 1% of the parameters will be trained; our existing evaluation set defines acceptable quality.”',lesson:'Identify which weights change before sizing optimizer memory.',inputs:{...baseInputs,name:'Relay · support model',goal:'Adapt a model with LoRA adapters and complete the token budget within 7 days.',workload:'lora',parameters:32,context:8192,sequences:4,layers:64,overheadGB:48,trainablePercent:1,tokensB:2,days:7,checkpointGB:4,checkpointSeconds:60,readGBs:2,storageTB:10},quiz:{question:'The client says “fine-tuning.” What should you establish before sizing memory?',options:['Whether they will update all weights or train adapters.','The number of spine switches to buy.','The maximum advertised GPU FLOPS.'],answer:0,explanation:'Full-parameter training and adapter training have different trainable state. Ask about precision, sequence length, microbatch, and activation checkpointing as well.'}},
 {id:'train',title:'Train across multiple servers',level:'03 · Distributed training',buyer:'Foundation model training team',brief:'“We are planning a dense 405B training run. The planned job processes 100B tokens in 30 days. A checkpoint may be 6.5 TB, with a two-minute write window.”',lesson:'Tie GPU count, communication and checkpoint storage to the same deadline.',inputs:{...baseInputs,name:'Atlas · dense model training',goal:'Process 100B training tokens in 30 days at the agreed model quality.',workload:'training',parameters:405,overheadGB:1000,tokensB:100,days:30,checkpointGB:6500,checkpointSeconds:120,readGBs:8,storageTB:200},quiz:{question:'When does a spine become necessary for this job?',options:['Whenever a GPU is used for training.','Whenever there is more than one physical rack.','When communicating endpoints occupy different leaves and need a path between them.'],answer:2,explanation:'Placement and routing decide the need for a spine. Several servers can communicate on the same leaf or rail; cross-leaf traffic needs a connecting path. Then size uplinks for the traffic that uses that path.'}},
];
export function estimate(i:Inputs) {
 const weights=i.parameters*i.weightBytes;
 const kv=i.workload==='inference'?2*i.layers*i.kvHeads*i.headDim*i.context*i.sequences*i.kvBytes/1e9:0;
 const state=i.workload==='training'?Math.max(0,i.parameters*(i.stateBytes-i.weightBytes)):i.workload==='lora'?i.parameters*i.trainablePercent/100*Math.max(0,i.stateBytes-i.weightBytes):0;
 const base=weights+kv+state+i.overheadGB;
 const reserve=base*i.marginPercent/100;
 return {weights,kv,state,overhead:i.overheadGB,reserve,total:base+reserve,
   requiredTps:i.workload==='inference'?i.targetTps:(i.days>0?i.tokensB*1e9/(i.days*86400):0),
   checkpointGBs:i.checkpointSeconds>0?i.checkpointGB/i.checkpointSeconds:0};
}
export function assess(i:Inputs,h:Hardware,group=h.gpuGroup) {
 const e=estimate(i),totalGPUs=h.nodes*h.gpus;
 const minGPUs=h.hbm>0?Math.ceil(e.total/h.hbm):Infinity;
 const allocated=Math.min(group,totalGPUs),capacity=allocated*h.hbm;
 const crossNode=group>h.gpus;
 const noRoute=crossNode&&h.topology==='disconnected';
 const ratio=h.uplinks>0&&h.uplinkGbps>0?(h.downlinks*h.linkGbps)/(h.uplinks*h.uplinkGbps):Infinity;
 const issues:string[]=[];
 if(crossNode&&h.nicPorts===0) issues.push('No compute NIC ports are listed for this cross-server workload.');
 if(h.cpuCores===0||h.ram===0) issues.push('Host CPU and RAM capacity must be specified.');
 if(h.storageServers>0&&(h.storageCores===0||h.storageRam===0||h.storageNicGbps===0)) issues.push('Storage hosts need CPU, RAM and a usable network interface.');
 if(h.storageTB>h.storageServers*h.drivesPerServer*h.driveTB) issues.push('Claimed usable storage exceeds the listed raw drive capacity.');
 if(h.serviceGbps===0&&(i.readGBs>0||i.checkpointGB>0)) issues.push('The workload needs a data path, but no storage/service link capacity is listed.');
 if(i.parameters<=0) issues.push('Establish the model and its parameter count.');
 if(group>totalGPUs) issues.push(`The group needs ${group} GPUs; only ${totalGPUs} are available.`);
 if(e.total>capacity) issues.push(`The memory estimate exceeds this group by ${fmt(e.total-capacity)} GB.`);
 if(noRoute) issues.push('The selected GPU group spans disconnected leaves. Restore a network path or change placement.');
 if(crossNode&&h.topology==='spine'&&(h.uplinks===0||h.uplinkGbps===0)) issues.push('The spine has no configured uplink capacity.');
 if(i.storageTB>h.storageTB) issues.push('Usable shared storage is smaller than the requested retained data.');
 if(h.storageServers===0&&(i.storageTB>0||i.checkpointGB>0)) issues.push('Shared storage is required by this case, but no storage server is listed.');
 if(h.powerKW>0&&h.nodes*h.nodeKW>h.powerKW) issues.push('Compute power alone exceeds the available IT power budget.');
 const cautions:string[]=[];
 if(crossNode&&h.sharedFabric) cautions.push('GPU and storage traffic share the fabric. Test both together and include their simultaneous uplink demand.');
 if(h.readGBs>Math.min(h.nodes*h.serviceGbps,h.storageServers*h.storageNicGbps)/8||h.writeGBs>Math.min(h.nodes*h.serviceGbps,h.storageServers*h.storageNicGbps)/8) cautions.push('The entered storage throughput exceeds the listed aggregate endpoint link ceiling. Reconcile the inventory and measurement.');
 if(i.readGBs>Math.min(h.nodes*h.serviceGbps,h.storageServers*h.storageNicGbps)/8) cautions.push('The data-read target exceeds the listed aggregate storage/service endpoint link ceiling.');
 if(crossNode&&h.fabric==='tcp') cautions.push('Cross-server GPU communication uses ordinary Ethernet/TCP here. Validate scaling or qualify an RDMA fabric.');
 if(crossNode&&h.topology==='spine'&&ratio>1) cautions.push(`${fmt(ratio)}:1 downlink/uplink ratio can constrain simultaneous cross-leaf traffic. It is not an application slowdown factor.`);
 if(group>1&&!h.nvlink) cautions.push('Check GPU-to-GPU bandwidth over the actual PCIe paths; this group has no NVLink.');
 if(h.writeGBs===0&&i.checkpointGB>0) cautions.push('Sustained durable checkpoint write bandwidth is unknown.');
 if(h.writeGBs>0&&h.writeGBs<e.checkpointGBs) cautions.push('Recorded write bandwidth is below the checkpoint target.');
 if(h.readGBs===0&&i.readGBs>0) cautions.push('Sustained data-read bandwidth is unknown.');
 if(h.readGBs>0&&h.readGBs<i.readGBs) cautions.push('Recorded read bandwidth is below the data-feed target.');
 return {e,minGPUs,totalGPUs,capacity,crossNode,ratio,issues,cautions,feasible:issues.length===0};
}
export function supplyMatches(h:Hardware) {
 return cases.map(c=>{
  const e=estimate(c.inputs),floor=Math.ceil(e.total/Math.max(1,h.hbm));
  const group=c.inputs.workload==='training'?h.nodes*h.gpus:Math.pow(2,Math.ceil(Math.log2(Math.max(1,floor))));
  const a=assess(c.inputs,h,group);
  return {case:c,group,...a};
 }).sort((a,b)=>Number(b.feasible)-Number(a.feasible));
}
export function fmt(n:number,d=1){return Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d}):'—';}
export const fieldQuestions = [
 {title:'What does success mean?',ask:'Which output matters, at what load, and with what quality?',why:'Inference needs latency and throughput together. Training needs a token budget, deadline, and quality target.',evidence:'A representative request trace or a written training plan.'},
 {title:'What exactly will run?',ask:'Which model revision, precision, context length, and software?',why:'These change memory demand, supported kernels, and how work can be split across GPUs.',evidence:'A model configuration, framework version, and reproducible command.'},
 {title:'What happens at peak demand?',ask:'How many simultaneous sequences, how long are inputs and outputs, and how bursty are arrivals?',why:'Concurrent sessions occupy memory; bursts and queues can break a latency target.',evidence:'Arrival patterns and prompt/output length distributions, including p95.'},
 {title:'How will data reach the GPUs?',ask:'What are the dataset format, hot working set, checkpoint size, retention, and recovery target?',why:'CPU preparation, local cache, metadata and durable storage can limit the same job.',evidence:'Data-loader profiling and storage tests with representative file sizes.'},
 {title:'What can the client actually operate?',ask:'What are the power, cooling, rack, budget, availability, tenancy and support constraints?',why:'A candidate must be installable, affordable, recoverable and operationally supportable.',evidence:'Facility sign-off, current inventory, commercial quotes and service commitments.'},
];
export type Component = {id:string;name:string;group:string;role:string;ask:string;effect:string;test:string;source:number};
export const components:Component[] = [
 {id:'gpu',name:'GPU compute',group:'Compute server',role:'Executes the matrix and attention operations in the model.',ask:'Which precision and kernels does this exact model use?',effect:'Prefill and training often expose substantial compute demand. Compare delivered tokens per second at the required quality.',test:'Run the complete model with the chosen precision, batch and framework; record utilization and the target output.',source:0},
 {id:'hbm',name:'GPU memory / HBM',group:'Compute server',role:'Holds model weights, cached attention state, activations and training state.',ask:'How much must be resident per GPU after partitioning?',effect:'Capacity controls fit. HBM bandwidth can influence token generation; a larger memory capacity alone does not prove faster output.',test:'Measure peak allocated and reserved device memory and latency under representative load.',source:2},
 {id:'nvlink',name:'NVLink / NVSwitch',group:'Compute server',role:'Provides high-bandwidth communication within a supported GPU domain.',ask:'Can a model instance or a tightly communicating group stay within this domain?',effect:'Placement changes how much repeated GPU communication enters the external fabric. An eight-GPU B300 server and a GB300 NVL72 rack have different domains.',test:'Check the exact platform topology and run collectives within the intended group.',source:4},
 {id:'cpu',name:'CPUs',group:'Compute server',role:'Prepare data, tokenize requests, schedule work and run host-side services.',ask:'Are GPUs waiting on preprocessing, tokenization or a busy CPU socket?',effect:'Host delays reduce useful GPU work and can add to first-token latency. More cores help only if the host work can use them.',test:'Profile data-loader time, CPU saturation and NUMA placement while GPUs run.',source:7},
 {id:'ram',name:'System RAM',group:'Compute server',role:'Buffers input, stores host working sets and supports CPU-side processing.',ask:'Does the host working set fit, and can memory channels supply it quickly enough?',effect:'Insufficient RAM can cause paging or smaller buffers. Capacity and memory bandwidth are separate requirements.',test:'Measure resident memory, paging and host-memory bandwidth in the full job.',source:0},
 {id:'pcie',name:'PCIe / NUMA layout',group:'Compute server',role:'Connects host CPUs, GPUs, adapters and NVMe devices.',ask:'Which GPU and NIC share the closest supported path?',effect:'A fast adapter can be limited by an upstream link or an unfavorable host path.',test:'Inspect the OEM lane diagram and measure transfers on the deployed device pairs.',source:6},
 {id:'nvme',name:'Local NVMe cache',group:'Compute server',role:'Stages reusable datasets, model files and temporary outputs close to compute.',ask:'How large is the hot working set, and how often will cache contents be reused?',effect:'Cache hits reduce repeated shared-storage reads. Local writes need the required durability or replication before counting as recoverable checkpoints.',test:'Compare cold and warm starts, cache hit rates and sustained writes.',source:6},
 {id:'boot',name:'Boot drives / BMC',group:'Compute server',role:'Boot media runs the host; the management controller supports remote recovery.',ask:'How is a failed server reimaged and restored without the data network?',effect:'Recovery time changes available GPU-hours and the ability to meet a deadline.',test:'Exercise remote console, boot recovery and management-network isolation.',source:0},
 {id:'nic',name:'NICs / DPUs',group:'Fabric',role:'Move compute, storage and service traffic through their assigned interfaces.',ask:'How many usable ports serve each GPU and each traffic class?',effect:'RoCE or InfiniBand capability, PCIe paths and actual link rates determine the external communication path. DPU offloads need a specific software use case.',test:'Verify negotiated rates, RDMA transfers, counters and GPU/NIC affinity.',source:0},
 {id:'leaf',name:'Leaf switches',group:'Fabric',role:'Connect endpoints and forward local or upstream traffic.',ask:'Which communicating GPU endpoints share a leaf or rail?',effect:'Traffic within a leaf need not consume spine uplinks. Port placement can change the external capacity needed.',test:'Map every endpoint and rail; test simultaneous traffic, not one link alone.',source:4},
 {id:'spine',name:'Spine switches',group:'Fabric',role:'Connect leaves when traffic must cross between them.',ask:'Does the workload group cross leaves, and how much traffic crosses at once?',effect:'A spine supplies a path and uplink capacity. It can affect training synchronization or distributed inference if that path is on the critical path.',test:'Compare step time or serving latency with cross-leaf load; examine uplink saturation.',source:4},
 {id:'roce',name:'RoCE congestion control',group:'Fabric',role:'Coordinates RDMA traffic over a validated Ethernet network.',ask:'Are endpoint rate control, ECN, QoS, buffers and any PFC settings validated together?',effect:'Congestion can expose long transfer tails. Lossless and lossy RoCE designs have different requirements; PFC is not a universal setting.',test:'Stress incast and competing traffic, and observe congestion and pause counters.',source:5},
 {id:'optics',name:'Cables / optics',group:'Fabric',role:'Complete the physical links between adapters and switches.',ask:'Are the speed, reach, connector and vendor qualifications correct?',effect:'A missing, degraded or unsupported link can reduce capacity or interrupt jobs.',test:'Verify the bill of materials, optical levels, error counters and failure paths.',source:0},
 {id:'storage',name:'Storage servers',group:'Storage & services',role:'Serve shared datasets, model files and durable checkpoints.',ask:'What are the aggregate read/write targets under concurrent client access?',effect:'Durable checkpoint time and data starvation can extend a training run. Inference also needs acceptable model load and restart time.',test:'Measure end-to-end throughput at the required durability and concurrent client count.',source:8},
 {id:'storagecpu',name:'Storage CPUs / RAM',group:'Storage & services',role:'Run the filesystem, protocol, protection and caching work on storage hosts.',ask:'Can these hosts process the target I/O without CPU or memory pressure?',effect:'Fast drives and fast NICs cannot bypass a saturated storage service. Volatile RAM buffering is not durable completion.',test:'Profile storage-host CPU, cache pressure and sustained writes beyond the cache.',source:8},
 {id:'drives',name:'Drive tiers / protection',group:'Storage & services',role:'Provide persistent capacity with the chosen replication or erasure coding.',ask:'What usable capacity and failure tolerance remain after protection?',effect:'Raw drive capacity is not usable capacity; rebuild traffic can compete with client I/O.',test:'Validate protected capacity, degraded-mode throughput and recovery behavior.',source:8},
 {id:'metadata',name:'Metadata service',group:'Storage & services',role:'Locates files and handles file operations separately from bulk content transfers.',ask:'Is the dataset many small files or a few large sequential objects?',effect:'Metadata operations can slow data loading even while bulk bandwidth remains available.',test:'Measure open/stat rates and training data-loader stalls with the real file layout.',source:8},
 {id:'servicenet',name:'Storage / service network',group:'Storage & services',role:'Carries data, client requests and supporting service traffic.',ask:'Is it separate from the GPU fabric or sharing its capacity?',effect:'A compute spine alone does not prove adequate storage or client connectivity. A converged fabric needs capacity and traffic isolation analysis.',test:'Benchmark storage and GPU communication together if links are shared.',source:4},
 {id:'control',name:'Gateway / scheduler / telemetry',group:'Operations & facility',role:'Admits requests, places jobs, and exposes useful system measurements.',ask:'Which admission, placement and recovery policy supports the client’s service target?',effect:'Queueing and poor placement can lose the benefit of otherwise capable hardware.',test:'Replay bursts, validate GPU placement and test node failure with observability enabled.',source:1},
 {id:'power',name:'Racks / power / cooling',group:'Operations & facility',role:'Make the planned system installable and sustainable at load.',ask:'Are rack limits, power delivery, cooling and network/storage overhead included?',effect:'A configuration that cannot sustain its planned power and temperature cannot deliver its intended usable capacity.',test:'Confirm the actual OEM installation plan and perform sustained-load acceptance.',source:0},
];
export function report(i:Inputs,h:Hardware,notes:string,checks:Record<string,boolean>) {
 const a=assess(i,h);
 return `# ${i.name || 'Client assessment'}\n\nStatus: preliminary architecture hypothesis; performance is unverified.\n\n## Client objective\n${i.goal}\n\n## Workload and hardware inputs\n${JSON.stringify({workload:i,hardware:h},null,2)}\n\n## Calculated requirements\n- Planning memory: ${fmt(a.e.total)} GB across one workload group, assuming supported partitioning.\n- Memory-only GPU lower bound: ${fmt(a.minGPUs,0)}. This is not a performance recommendation.\n- Group memory: ${fmt(a.capacity)} GB.\n- Required ${i.workload==='inference'?'output':'training'} tokens/s: ${fmt(a.e.requiredTps)}.\n- Checkpoint sustained write target: ${fmt(a.e.checkpointGBs)} GB/s.\n\n## Configuration gaps\n${[...a.issues,...a.cautions].map(x=>'- '+x).join('\n')||'- No listed arithmetic or topology blockers; real-world validation remains required.'}\n\n## Component rationale and acceptance plan\n${components.map(c=>`### ${c.name}\n${c.role}\nAsk: ${c.ask}\nOutput relevance: ${c.effect}\nValidate: ${c.test}\nSource: ${sources[c.source].url}`).join('\n\n')}\n\n## Evidence recorded\n${Object.entries(checks).filter(([,v])=>v).map(([k])=>'- '+k).join('\n')||'None confirmed.'}\n\n## Consultant notes / quotes / benchmark provenance\n${notes||'Not supplied.'}\n\n## Assumptions\nAll GB and TB are decimal. Memory uses a simple full-attention KV formula and explicit training-state assumptions, with no performance simulation. Assumed activation/scratch memory must be profiled. Aggregate HBM is not automatically shared or evenly partitioned. CPU, storage and facility fit require measurement. No total cost or optimal GPU count is claimed.\n\n## Sources\n${sources.map(s=>`- [${s.title}](${s.url})`).join('\n')}`;
}
