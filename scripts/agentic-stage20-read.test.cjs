const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
let ts;
try { ts=require('typescript'); } catch { ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript')); }
const root=path.resolve(__dirname,'..');
const rel='src/lib/agentic/agents/evaluation/tools/rollout-read.tool.ts';
const code=ts.transpileModule(fs.readFileSync(path.join(root,rel),'utf8'),
 {fileName:rel,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const compareCode=ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/agentic/agents/evaluation/tools/rollout-compare.tool.ts'),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(js, deps, env={}){
 const module={exports:{}};
 const fn=vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{Date,Number,Math,JSON,Array,Object,process:{env},console});
 fn(name=>{if(Object.hasOwn(deps,name))return deps[name];throw Error('Unmocked module: '+name)},module,module.exports);
 return module.exports;
}
const compare=load(compareCode,{});
const now=new Date('2026-11-01T00:00:00.000Z');
test('stage20: grouped database observation is anonymized, bounded and historically unattributed',async()=>{
 const seen=[];
 const db={careerAgentObservation:{
  groupBy:async q=>{seen.push(['group',q]);return [
   {engine:'GRAPH',outcome:'COMPLETED',_count:{_all:48}},
   {engine:'GRAPH',outcome:'FAILED',_count:{_all:2}},
   {engine:'LEGACY',outcome:'COMPLETED',_count:{_all:48}},
   {engine:'LEGACY',outcome:'FAILED',_count:{_all:2}},
   {engine:'UNKNOWN',outcome:'COMPLETED',_count:{_all:10}}];},
  findMany:async q=>{seen.push(['times',q]);return Array.from({length:48},()=>({durationMs:q.where.engine==='GRAPH'?8000:5000}));},
 }};
 const reader=load(code,{
  '../../../../../../prisma/prisma':{default:db},
  '@/lib/quality/agent-quality-policy':{percentile:(items)=>items.at(-1)??null},
  '@/lib/agentic/core/policies/career-rollout':{safeCareerRolloutConfig:()=>({mode:'rollout',percent:25,killSwitch:false,effectiveMode:'rollout'})},
  './rollout-compare.tool':compare,
 });
 const value=await reader.readCareerRolloutComparison(now);
 assert.equal(value.decision,'REQUIRES_REVIEW');
 assert.equal(value.unattributedHistorical,10);
 assert.equal(value.engines[0].total,50);assert.equal(value.engines[1].total,50);
 assert.equal(value.engines[1].p95Ms,8000);
 assert.ok(seen.every(([key,q])=>JSON.stringify(q).includes('createdAt')));
 assert.ok(seen.filter(([key])=>key==='times').every(([,q])=>q.take===1000&&
  JSON.stringify(q.select)==='{"durationMs":true}'));
 assert.doesNotMatch(JSON.stringify(value),/userId|actorId|CV text|password|prompt:/);
});
test('stage20: missing or failed live telemetry yields insufficient evidence, never fake pass',async()=>{
 const db={careerAgentObservation:{
  groupBy:async()=>[],findMany:async()=>[],
 }};
 const reader=load(code,{
  '../../../../../../prisma/prisma':{default:db},
  '@/lib/quality/agent-quality-policy':{percentile:()=>null},
  '@/lib/agentic/core/policies/career-rollout':{safeCareerRolloutConfig:()=>({mode:'graph',percent:null,killSwitch:false,effectiveMode:'graph'})},
  './rollout-compare.tool':compare,
 });
 const result=await reader.readCareerRolloutComparison(now);
 assert.equal(result.decision,'INSUFFICIENT_DATA');
 assert.ok(result.engines.every(x=>x.p95Ms===null&&x.total===0));
});
