const { test }=require('node:test');
const assert=require('node:assert/strict');
const {read,load,base,metrics,policy,now,from,evidence}=require('./agentic-stage19-fixtures.cjs');
const result=opts=>{const summary=metrics.assembleEvaluation(evidence(opts));return {...summary,...policy.evaluateStage19Gates(summary)};};
const status=(obj,key)=>obj.gates.find(x=>x.key===key).status;

test('stage19: observed metrics have honest denominators and operational scope',()=>{
 const data=result();
 assert.equal(data.scope,'agentic_operational_partial');
 assert.equal(data.careerAssistant.total,50);
 assert.equal(data.missions.terminalCompletionPercent,96);
 assert.equal(data.missions.toolEventCounts.completed,11);
 assert.equal(data.aiUsage.scope,'all_recorded_ai_features');
 assert.equal(status(data,'career_assistant_completion'),'PASS');
 assert.equal(data.decision,'REQUIRES_REVIEW');
 assert.equal(status(data,'cross_user_access_and_unapproved_actions'),'NOT_MEASURED');
});

test('stage19: no samples never look like 100 percent success, zero latency or zero cost',()=>{
 const data=result({completed:0,failed:0,missionCompleted:0,missionFailed:0,tracked:0,priced:0,p95:null});
 assert.equal(data.missions.terminalCompletionPercent,null);
 assert.equal(data.aiUsage.estimatedUSD,null);
 assert.equal(data.aiUsage.coverage,'no_data');
 assert.equal(status(data,'career_assistant_completion'),'INSUFFICIENT_DATA');
 assert.equal(status(data,'career_assistant_p95_latency'),'INSUFFICIENT_DATA');
 assert.equal(status(data,'recorded_ai_cost_coverage'),'INSUFFICIENT_DATA');
});

test('stage19: failures, latency, unreconciled leases and incomplete cost coverage block staging',()=>{
 const data=result({completed:32,failed:18,p95:65000,missionCompleted:20,missionFailed:30,lease:4,tracked:10,priced:5});
 assert.equal(data.decision,'BLOCKED');
 for(const key of ['career_assistant_completion','career_assistant_p95_latency','mission_terminal_completion','expired_running_leases','recorded_ai_cost_coverage'])
   assert.equal(status(data,key),'FAIL',key);
 assert.equal(data.aiUsage.estimatedUSD,null);
});

test('stage19: no invented actual model cost from configured rates or missing rows',()=>{
 const sample=evidence({tracked:10,priced:9});sample.aiUsage.estimatedUSD='99.00';
 const data=metrics.assembleEvaluation(sample);
 assert.equal(data.aiUsage.estimatedUSD,null);
 assert.equal(data.aiUsage.coverage,'incomplete');
 sample.aiUsage.pricedCalls=10;sample.aiUsage.estimatedUSD='provider bill: secret';
 assert.equal(metrics.assembleEvaluation(sample).aiUsage.estimatedUSD,null);
 sample.aiUsage.estimatedUSD='0.082000';
 assert.equal(metrics.assembleEvaluation(sample).aiUsage.estimatedUSD,'0.082000');
});

test('stage19: arbitrary database error string is not returned to admin response',()=>{
 const input=evidence();input.career.errors=[{code:'password db://secret',count:1}];
 const output=metrics.assembleEvaluation(input);
 assert.deepEqual(JSON.parse(JSON.stringify(output.careerAssistant.errors)),[{code:'AGENT_FAILED',count:1}]);
 assert.doesNotMatch(JSON.stringify(output),/secret/);
});

test('stage19: duplicate status groups combine without double counting nonexistent events',()=>{
 const input=evidence();input.runStatuses=[{key:'COMPLETED',count:2},{key:'COMPLETED',count:3},{key:'FAILED',count:0}];
 const data=metrics.assembleEvaluation(input);
 assert.equal(data.missions.completed,5);assert.equal(data.missions.failed,0);
 assert.equal(data.missions.terminalCompletionPercent,100);
 assert.equal(status({...data,...policy.evaluateStage19Gates(data)},'mission_terminal_completion'),'INSUFFICIENT_DATA');
});

test('stage19: pure read tool only selects grouped metadata and disallows unknown event names',async()=>{
 const calls=[];
 const db={
  careerMissionRun:{groupBy:async query=>{calls.push(['runs',query]);return [{status:'COMPLETED',_count:{_all:3}}];},
   count:async query=>{calls.push(['leases',query]);return 2;}},
  careerMissionProgressEvent:{groupBy:async query=>{calls.push(['progress',query]);return [
   {kind:'tool.completed',_count:{_all:4}},{kind:'secret: private answer',_count:{_all:1}}];}},
  aIUsage:{aggregate:async query=>{calls.push(['cost',query]);return {_count:{_all:2,estimatedCost:1},_sum:{estimatedCost:{toString:()=> '0.04'},inputTokens:10,outputTokens:5}};}},
 };
 const career=evidence().career;
 const loader=load(base+'tools/read.tool.ts',{
  '../../../../../../prisma/prisma':{default:db},
  '@/lib/quality/agent-observations':{getCareerQualityOverview:async x=>{assert.equal(x.getTime(),now.getTime());return career;}},
 });
 const data=await loader.readStage19Evaluation(from,now);
 assert.deepEqual(JSON.parse(JSON.stringify(data.progressEvents)),[{key:'tool.completed',count:4}]);
 assert.equal(data.aiUsage.trackedCalls,2);assert.equal(data.aiUsage.pricedCalls,1);
 assert.equal(data.aiUsage.estimatedUSD,null);
 assert.equal(data.expiredRunningLeases,2);
 assert.ok(calls.every(([,query])=>JSON.stringify(query).includes('createdAt')));
 assert.equal(JSON.stringify(calls).includes('userId'),false);
 assert.equal(JSON.stringify(calls).includes('answer'),false);
});

test('stage19: admin GET is gated before graph execution, uses no raw candidate fields',()=>{
 const route=read('src/app/api/admin/agentic/quality/route.ts');
 assert.match(route,/await requireAIAdmin\(req\)/);
 assert.match(route,/runEvaluationAgent\(\{ adminId: actor.id, signal: req.signal \}\)/);
 assert.doesNotMatch(route,/findMany|question|answer|prompt|resumeContent/);
 const agent=read(base+'agent/evaluation.agent.ts');
 assert.match(agent,/timeoutMs: 15_000/);assert.match(agent,/runAgentGraph/);
});

test('stage19: security checks are explicitly not measured by operational counters',()=>{
 const data=result();
 assert.equal(status(data,'cross_user_access_and_unapproved_actions'),'NOT_MEASURED');
 assert.equal(status(data,'groundedness_and_hiring_claims'),'NOT_MEASURED');
 assert.equal(status(data,'model_provider_recovery'),'NOT_MEASURED');
 assert.notEqual(data.decision,'PASS');
});

test('stage19: all 16 specialized prior-stage tests are covered by offline evaluation runner',()=>{
 const text=read('scripts/agentic-stage19-evaluation.cjs');
 assert.match(text,/length:16/);
 assert.match(text,/node.*agentic-stage01\.test/);
 assert.match(text,/test:security-guards/);
 assert.match(text,/test:cvcomet:baseline/);
 assert.match(text,/real_runtime_/);
 assert.match(text,/productionCertified: false/);
 assert.doesNotMatch(text,/assert\(.*accuracy.*100/);
});

test('stage19: UI shows missing values and read-only gates, avoids any auto approval action',()=>{
 const page=read('src/app/admin/agentic-quality/page.tsx');
 assert.match(page,/Non mesuré/);
 assert.match(page,/INSUFFICIENT_DATA/);
 assert.match(page,/À évaluer/);
 assert.doesNotMatch(page,/fetch\([^)]*method:\s*["']POST/);
 assert.match(page,/\/api\/admin\/agentic\/quality/);
});

test('stage19: avoids saving documents/prompts or exposing users in evaluation graph state',()=>{
 const state=read(base+'agent/state.ts');
 const readTool=read(base+'tools/read.tool.ts');
 assert.doesNotMatch(state,/prompt:\s*Annotation|resume:\s*Annotation|transcript:\s*Annotation|message:\s*Annotation/);
 assert.doesNotMatch(readTool,/findMany\(|\.question\b|\.answer\b|select:\s*\{\s*userId/);
 assert.match(readTool,/groupBy/);
 assert.match(readTool,/getCareerQualityOverview/);
});
