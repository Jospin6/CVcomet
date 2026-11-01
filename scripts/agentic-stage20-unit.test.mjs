import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseCareerAgentEngine, careerRolloutBucket, safeCareerRolloutConfig } from '../src/lib/agentic/core/policies/career-rollout.ts';
import { compareCareerRollout } from '../src/lib/agentic/agents/evaluation/tools/rollout-compare.tool.ts';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const actor='0ea87f3b-5a5c-4ecb-bc98-b8f87c9e27a8';
const config=(mode, pct, kill) => ({CVCOMET_CAREER_AGENT_ENGINE:mode,CVCOMET_CAREER_AGENT_ROLLOUT_PERCENT:pct,CVCOMET_CAREER_AGENT_KILL_SWITCH:kill});
const windowFrom = new Date('2026-10-25T00:00:00.000Z');
const windowTo = new Date('2026-11-01T00:00:00.000Z');
const sample=(engine,completed,failed,p95Ms,sampledCompleted=completed)=>({engine,completed,failed,p95Ms,sampledCompleted});
const summary=(items,unknown=0)=>compareCareerRollout(items,unknown,{mode:'rollout',percent:25,killSwitch:false,effectiveMode:'rollout'},windowFrom,windowTo);

test('stage20 unchanged configuration preserves stage16+ GRAPH behavior',()=>{
 assert.equal(chooseCareerAgentEngine(actor,{}),'GRAPH');
 assert.equal(chooseCareerAgentEngine(actor,config('graph')),'GRAPH');
 assert.equal(chooseCareerAgentEngine(actor,config('legacy')),'LEGACY');
});
test('stage20 emergency kill switch takes precedence over every other setting',()=>{
 for (const kill of ['true','on','1',' TRUE '])
  assert.equal(chooseCareerAgentEngine(actor,config('graph','100',kill)),'LEGACY');
 assert.equal(safeCareerRolloutConfig(config('graph','99','1')).effectiveMode,'legacy');
});
test('stage20 canary cohorts stable and server-bound, 0 and 100 exact',()=>{
 const b=careerRolloutBucket(actor);assert.equal(b,careerRolloutBucket(actor));assert.ok(b>=0&&b<100);
 assert.equal(chooseCareerAgentEngine(actor,config('rollout','0')),'LEGACY');
 assert.equal(chooseCareerAgentEngine(actor,config('rollout','100')),'GRAPH');
 assert.equal(chooseCareerAgentEngine(actor,config('rollout',String(Math.max(0,Math.floor(b))))),'LEGACY');
 assert.equal(chooseCareerAgentEngine(actor,config('rollout',String(Math.min(100,Math.ceil(b)+1)))),'GRAPH');
});
test('stage20 invalid percentages / unknown modes fail closed to legacy',()=>{
 for(const value of ['-1','101','NaN','1e2','33.333','abc',' 10','', '1.0x'])
  assert.equal(chooseCareerAgentEngine(actor,config('rollout',value)),'LEGACY',value);
 assert.equal(chooseCareerAgentEngine(actor,config('unknown','100')),'LEGACY');
});
test('stage20 rollout config returns no actor, prompt, or deployment secrets',()=>{
 const result=safeCareerRolloutConfig(config('rollout','12.5','false'));
 assert.deepEqual(result,{mode:'rollout',percent:12.5,killSwitch:false,effectiveMode:'rollout'});
 assert.doesNotMatch(JSON.stringify(result), /actorId|secret|prompt|token|password/);
});
test('stage20 no traffic never looks equivalent or 100 percent successful',()=>{
 const s=summary([]);
 assert.equal(s.decision,'INSUFFICIENT_DATA');
 assert.ok(s.engines.every(x=>x.completionPercent===null&&!x.sampleAdequate));
});
test('stage20 old unknown rows cannot be assigned to either engine',()=>{
 const s=summary([sample('GRAPH',40,0,1500),sample('LEGACY',40,0,1700)],90);
 assert.equal(s.decision,'REQUIRES_REVIEW');
 assert.equal(s.unattributedHistorical,90);
 assert.equal(s.engines.reduce((acc,x)=>acc+x.total,0),80);
});
test('stage20 no silent PASS for small samples, including fewer than 30 latencies',()=>{
 const s=summary([sample('GRAPH',30,0,1000,12),sample('LEGACY',40,0,1700,40)]);
 assert.equal(s.engines[1].sampleAdequate,false);
 assert.equal(s.decision,'INSUFFICIENT_DATA');
});
test('stage20 graph degradation by 5 points or latency > 55s blocks rollout',()=>{
 const s=summary([sample('GRAPH',31,9,56000),sample('LEGACY',40,0,2500)]);
 assert.equal(s.decision,'BLOCKED');
 assert.equal(s.engines[1].completionPercent,77.5);
});
test('stage20 reasonable operational metrics require human review (never certification)',()=>{
 const s=summary([sample('GRAPH',48,2,5000),sample('LEGACY',48,2,6000)]);
 assert.equal(s.decision,'REQUIRES_REVIEW');
 assert.equal(s.scope,'career_assistant_rollout_only');
 assert.ok(s.warnings.some(x=>x.includes('not measured')));
});
test('stage20 orchestration chooses once and never retries with a second model after a failure',()=>{
 const service=read('src/lib/career-os/agent-service.ts');
 assert.match(service,/chooseCareerAgentEngine\(actor.id, process.env\)/);
 assert.match(service,/return runLegacyCareerAgent\(actor, message, signal, history, applicationId\)/);
 assert.match(service,/runCareerSupervisorAgent\(/);
 assert.doesNotMatch(service,/catch\s*\([^)]*\)\s*\{[^}]*runLegacyCareerAgent\(/);
});
test('stage20 legacy retains strict read tools, quotas, answers review and ownership enforcement',()=>{
 const legacy=read('src/lib/career-os/legacy-agent-service.ts');
 for(const required of ['withApplicationContext(', 'executeCareerReadTool(actor, tool, input)',
  'reserveProfileAI(actor.id, "CAREER_ASSISTANT")','reviewCareerAgentAnswer(assertAgentAnswer(final.text))',
  'engine: "LEGACY"']) assert.ok(legacy.includes(required),required);
 assert.equal((legacy.match(/reserveProfileAI\(actor.id, "CAREER_ASSISTANT"\)/g)||[]).length,2);
 assert.doesNotMatch(legacy, /sendEmail\(|submitApplication\(|prisma\.resume\.update\(/);
});
test('stage20 telemetry has explicit unknown legacy history and no private payload field',()=>{
 const schema=read('prisma/schema.prisma');const migration=read('prisma/migrations/20261101010000_agentic_career_rollout_metrics/migration.sql');
 assert.match(schema,/engine\s+String\s+@default\("UNKNOWN"\)/);
 assert.match(migration,/ADD COLUMN "engine" VARCHAR\(12\) NOT NULL DEFAULT 'UNKNOWN'/);
 assert.match(migration,/CREATE INDEX "CareerAgentObservation_engine_createdAt_outcome_idx"/);
 assert.match(read('src/lib/quality/agent-quality-policy.ts'),/input.engine === "GRAPH" \|\| input.engine === "LEGACY"/);
});
test('stage20 no client override of cohort and metrics API checks admin before DB',()=>{
 for(const route of ['src/app/api/career/v1/agent/route.ts','src/app/api/assistant/route.ts']){
  const src=read(route);assert.match(src,/\.strict\(\)/);assert.doesNotMatch(src,/CVCOMET_CAREER_AGENT_ENGINE|rolloutPercent|killSwitch/);
 }
 const admin=read('src/app/api/admin/agentic/rollout/route.ts');
 assert.ok(admin.indexOf('await requireAIAdmin(req)') < admin.indexOf('await readCareerRolloutComparison()'));
 assert.match(admin,/aiAdminResponse\(/);
});
test('stage20 comparison only reads grouped metadata and bounded durations',()=>{
 const src=read('src/lib/agentic/agents/evaluation/tools/rollout-read.tool.ts');
 assert.match(src,/groupBy\(\{ by: \["engine", "outcome"\]/);
 assert.match(src,/take: 1000/);
 assert.match(src,/select: \{ durationMs: true \}/);
 assert.doesNotMatch(src,/select: \{\s*(?:question|answer|email|prompt|document)/);
});
test('stage20 UI stays read-only and shows manual decision and sampling caveats',()=>{
 const src=read('src/app/admin/agentic-quality/page.tsx');
 assert.match(src,/api\/admin\/agentic\/rollout/);
 assert.match(src,/comparaison ne démontre pas la fiabilité factuelle/);
 assert.doesNotMatch(src,/fetch\("\/api\/admin\/agentic\/rollout"[^;]*method: "POST"/);
});
