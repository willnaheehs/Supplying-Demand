import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,assess,baseInputs,defaultHardware,cases,supplyMatches,report} from '../lib/consulting.ts';

test('70B full-attention inference sizing separates weights, KV and headroom',()=>{
 const e=estimate(baseInputs);
 assert.equal(e.weights,140);
 assert.equal(e.kv,85.89934592);
 assert.ok(Math.abs(e.total-278.184247808)<1e-8);
 const longer=estimate({...baseInputs,context:baseInputs.context*2});
 assert.equal(longer.kv,e.kv*2);
 assert.equal(longer.weights,e.weights);
});
test('training only allocates trainable state; adapters have a different footprint',()=>{
 const full=estimate({...baseInputs,parameters:32,workload:'training',overheadGB:0,marginPercent:0});
 const adapter=estimate({...baseInputs,parameters:32,workload:'lora',overheadGB:0,marginPercent:0});
 assert.equal(full.total,512);assert.equal(adapter.total,68.48);
 assert.equal(full.kv,0);
});
test('a missing spine blocks cross-leaf groups but not single-server replicas',()=>{
 const disconnected={...defaultHardware,topology:'disconnected' as const};
 assert.equal(assess(baseInputs,disconnected,8).feasible,true);
 assert.ok(assess(baseInputs,disconnected,16).issues.some(x=>x.includes('disconnected')));
 const sameLeaf={...disconnected,topology:'single' as const};
 assert.equal(assess(baseInputs,sameLeaf,16).feasible,true);
});
test('oversubscription is a caution rather than fabricated performance',()=>{
 const a=assess(baseInputs,{...defaultHardware,uplinks:8},16);
 assert.equal(a.ratio,4);assert.equal(a.feasible,true);
 assert.ok(a.cautions.some(x=>x.includes('not an application slowdown')));
 assert.ok(assess(baseInputs,{...defaultHardware,uplinks:0},16).issues.length>0);
});
test('unavailable GPUs, host resources and impossible storage capacity are screened out',()=>{
 assert.ok(assess(baseInputs,{...defaultHardware,nodes:1},32).issues.some(x=>x.includes('only 8')));
 assert.ok(assess(baseInputs,{...defaultHardware,hbm:8}).issues.some(x=>x.includes('exceeds this group')));
 assert.ok(assess(baseInputs,{...defaultHardware,nicPorts:0},16).issues.some(x=>x.includes('No compute NIC')));
 assert.ok(assess(baseInputs,{...defaultHardware,storageTB:10000}).issues.some(x=>x.includes('raw drive capacity')));
 assert.ok(assess(baseInputs,{...defaultHardware,cpuCores:0}).issues.some(x=>x.includes('Host CPU')));
});
test('reverse matching preserves independent inference when the large training job cannot fit',()=>{
 const matches=supplyMatches({...defaultHardware,nodes:1});
 assert.equal(matches.find(m=>m.case.id==='assistant')!.feasible,true);
 assert.equal(matches.find(m=>m.case.id==='train')!.feasible,false);
 assert.equal(matches.find(m=>m.case.id==='assistant')!.group,1);
});
test('training deadlines and durable checkpoint throughput are required outputs',()=>{
 const e=estimate(cases[2].inputs);
 assert.ok(Math.abs(e.requiredTps-38580.24691358)<.001);
 assert.ok(Math.abs(e.checkpointGBs-54.1666666667)<.001);
 const a=assess(cases[2].inputs,{...defaultHardware,gpuGroup:32,writeGBs:20});
 assert.ok(a.cautions.some(x=>x.includes('below the checkpoint target')));
 assert.equal(estimate({...cases[2].inputs,days:0}).requiredTps,0);
});
test('export records inputs, open gaps, assumptions and all component evidence',()=>{
 const text=report(baseInputs,defaultHardware,'Example note',{'Model and software revision recorded':true});
 for(const fragment of ['preliminary','Example note','Storage CPUs / RAM','RoCE congestion','No total cost','Model and software revision recorded'])assert.ok(text.includes(fragment));
});
