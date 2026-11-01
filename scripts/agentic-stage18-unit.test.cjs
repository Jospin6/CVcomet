const {test}=require('node:test');
const assert=require('node:assert/strict');
const {read,load,prefix,kinds,sse,createDB,service}=require('./agentic-stage18-fixtures.cjs');

test('stage18 exact allowlist; safe step and error codes, no prompt data',()=>{
  assert.ok(kinds.PROGRESS_KINDS.includes('mission.started'));
  assert.ok(kinds.PROGRESS_KINDS.includes('tool.failed'));
  assert.ok(kinds.PROGRESS_KINDS.includes('approval.required'));
  assert.equal(kinds.MAX_PROGRESS_EVENTS_PER_ATTEMPT,48);
  assert.deepEqual(JSON.parse(JSON.stringify(kinds.safeProgress({kind:'step.started',step:'supervisor.route',code:'SAFE_CODE'}))),
    {kind:'step.started',step:'supervisor.route',code:'SAFE_CODE'});
  assert.deepEqual(JSON.parse(JSON.stringify(kinds.safeProgress({kind:'tool.failed',step:'get_my_profile\nsecret',code:'secret'}))),{kind:'tool.failed'});
  assert.throws(()=>kinds.safeProgress({kind:'prompt.delta',step:'private'}));
  assert.throws(()=>kinds.safeProgress({kind:'tool.failed\ndata:private'}));
});

test('stage18 graph events map into only safe progress types',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(kinds.mapGraphProgress({kind:'step.started',step:'supervisor.route'}))),
    {kind:'step.started',step:'supervisor.route'});
  assert.equal(kinds.mapGraphProgress({kind:'run.started'}),null);
  assert.equal(kinds.mapGraphProgress({kind:'run.completed'}),null);
  assert.equal(kinds.mapGraphProgress({kind:'token.delta',step:'text'}),null);
  assert.equal(kinds.mapGraphProgress({kind:'step.failed',step:'supervisor.respond',code:'AGENT_RUN_FAILED'}).kind,'step.failed');
});

test('stage18 SSE frames are valid, bounded and newline-injection-resistant',()=>{
  const frame=sse.progressFrame({id:'42',kind:'step.completed',step:'supervisor.route',at:'2026-11-01T00:00:00.000Z'});
  assert.match(frame,/^id: 42\nevent: step.completed\ndata: \{/);
  assert.equal(sse.parseCursor('42'),42n);
  assert.equal(sse.parseCursor('42\nevent:evil'),0n);
  assert.equal(sse.parseCursor('-3'),0n);
  assert.equal(sse.parseCursor('99999999999999999999999'),0n);
  assert.throws(()=>sse.progressFrame({id:'1',kind:'script.inject',at:'x'}));
  assert.throws(()=>sse.progressFrame({id:'1\nX: bad',kind:'mission.started',at:'x'}));
});

test('stage18 persistent metadata remains owner scoped, serial, attempt scoped, and replayable',async()=>{
  const {db,events,setRun}=createDB();
  const {persist,replay}=service(db);
  await assert.rejects(replay.assertProgressMissionOwner('bob','mission-1'),e=>e.code==='MISSION_NOT_FOUND');
  await replay.assertProgressMissionOwner('alice','mission-1');
  const writer=persist.createMissionProgressWriter({userId:'alice',missionId:'mission-1',runId:'run-alice',attempt:1});
  writer.emit({kind:'mission.started'});
  writer.emit({kind:'step.started',step:'supervisor.context'});
  writer.emit({kind:'step.completed',step:'supervisor.context'});
  writer.emit({kind:'mission.completed'});
  assert.equal(await writer.flush(),true);
  assert.deepEqual(events.map(e=>e.kind),['mission.started','step.started','step.completed','mission.completed']);
  assert.equal(events.every(e=>e.userId==='alice' && !('message' in e)&&!('prompt' in e)),true);
  const all=await replay.readMissionProgress('alice','mission-1','req-1');
  assert.equal(all.events.length,4);assert.equal(all.events[0].id,'1');
  assert.equal((await replay.readMissionProgress('alice','mission-1','req-1',2n)).events.length,2);
  assert.equal((await replay.readMissionProgress('bob','mission-1','req-1')).found,false);
  assert.equal((await replay.readMissionProgress('alice','mission-1','unknown')).found,false);
  setRun({attempt:2});
  assert.equal((await replay.readMissionProgress('alice','mission-1','req-1')).events.length,0);
});

test('stage18 event persistence failures do not mutate user mission result',async()=>{
  const broken={careerMissionProgressEvent:{async create(){throw Error('database down secret');}}};
  const {persist}=service(broken);
  const writer=persist.createMissionProgressWriter({userId:'alice',missionId:'mission-1',runId:'r',attempt:1});
  writer.emit({kind:'step.started'});
  assert.equal(await writer.flush(),false);
});

test('stage18 progress storage rejects raw private data and enforces event cap',async()=>{
  const {db,events}=createDB();
  const {persist}=service(db);
  const writer=persist.createMissionProgressWriter({userId:'alice',missionId:'mission-1',runId:'run-alice',attempt:1});
  for(let i=0;i<200;i++)writer.emit({kind:'step.completed',step:'supervisor.route'});
  await writer.flush();
  assert.equal(events.length,48);
  assert.throws(()=>writer.emit({kind:'full_model_text',code:'TEXT'}));
});

test('stage18 supervisor and read tools only emit metadata, final response remains vetted',()=>{
  const service=read('src/lib/career-os/agent-service.ts');
  const graph=read('src/lib/agentic/agents/supervisor/agent/supervisor.agent.ts');
  const readPolicy=read('src/lib/career-os/agent-engine.ts');
  assert.match(graph,/onEvent: options.onEvent/);
  assert.match(service,/onEvent: observer\?\.onGraphEvent/);
  assert.match(readPolicy,/emitTool\("failed", call.tool\)/);
  assert.match(service,/reviewCareerAgentAnswer\(assertAgentAnswer\(final.text\)\)/);
  assert.doesNotMatch(service,/streamText\(/);
});

test('stage18 mission lifecycle progress is committed with lease/idempotence',()=>{
  const mission=read('src/lib/career-os/mission-service.ts');
  assert.match(mission,/createMissionStreamAgent\(/);
  assert.match(mission,/runCareerAgent\(actor, message, signal/);
  assert.match(mission,/await progress.flush\(\)/);
  assert.match(mission,/kind: "mission.completed"/);
  assert.match(mission,/kind: "mission.failed"/);
  assert.match(mission,/leaseToken: claim.leaseToken/);
  assert.match(mission,/status: "RUNNING"/);
  assert.match(mission,/kind: "approval.required"/);
});

test('stage18 SSE endpoint authenticates owner, filters by requestKey and supports reconnect',()=>{
  const route=read('src/app/api/career/v1/missions/[id]/runs/events/route.ts');
  assert.match(route,/getSessionUser\(/);
  assert.match(route,/assertProgressMissionOwner\(actor.id, id.data\)/);
  assert.match(route,/assertMissionRequestKey\(/);
  assert.match(route,/last-event-id/);
  assert.match(route,/private, no-store, no-transform/);
  assert.match(route,/readMissionProgress\(actor.id, id.data, requestKey, cursor\)/);
  assert.doesNotMatch(route,/res\.write\(.*answer|prompt|toolPayload/);
});

test('stage18 UI replays through EventSource and never auto-approves writes',()=>{
  const page=read('src/app/dashboard/assistant/page.tsx');
  const panel=read('src/components/career/CareerMissionProgress.tsx');
  assert.match(page,/new EventSource\(/);
  assert.match(page,/setTracking\(latest \?/);
  assert.match(page,/lastProgressId/);
  assert.match(page,/syncMissionUrl/);
  assert.match(page,/get\("missionId"\)/);
  assert.match(page,/CareerMissionProgress/);
  assert.match(panel,/aria-live="polite"/);
  assert.doesNotMatch(page,/localStorage|sessionStorage/);
  assert.match(page,/setDraftReviewed\(false\)/);
  assert.match(page,/pendingApprovals/);
});

test('stage18 schema cascade and bounded payload, no copy of personal content',()=>{
  const schema=read('prisma/schema.prisma');
  const sql=read('prisma/migrations/20261101001500_career_mission_progress_stream/migration.sql');
  assert.match(schema,/model CareerMissionProgressEvent/);
  assert.match(schema,/BigInt @id @default\(autoincrement\(\)\)/);
  assert.match(sql,/ON DELETE CASCADE/g);
  for(const forbidden of ['prompt','toolArguments','answer','documentContent','transcript']){
    assert.doesNotMatch(schema.slice(schema.indexOf('model CareerMissionProgressEvent'), schema.indexOf('// Approvals bind')),new RegExp('^\\s*'+forbidden+'\\s+', 'm'));
  }
});


test('stage18 tool events fire without revealing private tool results', async()=>{
 const agentEngine=load('src/lib/career-os/agent-engine.ts',{'./contracts.ts':{
  CAREER_READ_TOOLS:['get_my_profile'],
  CareerContractError:class CareerContractError extends Error {constructor(status,code){super(code);this.code=code;}}
 }});
 const trace=[];
 const args=[{tool:'get_my_profile',input:{}}];
 const output=await agentEngine.executeAgentReads(args,async()=>({private:'document text'}),{
  onToolEvent:(kind,tool)=>trace.push({kind,tool})
 });
 assert.deepEqual(trace,[{kind:'started',tool:'get_my_profile'},{kind:'completed',tool:'get_my_profile'}]);
 assert.equal(JSON.stringify(trace).includes('document text'),false);
 await assert.rejects(agentEngine.executeAgentReads(args,async()=>{throw Error('upstream secret')},{
  onToolEvent:(kind,tool)=>trace.push({kind,tool})
 }),/upstream secret/);
 assert.deepEqual(trace.at(-1),{kind:'failed',tool:'get_my_profile'});
});

test('stage18 mission stream adapter maps LangGraph events and persists final states',async()=>{
 const {db,events}=createDB();
 const {persist}=service(db);
 const stream=load(prefix+'agent/mission-stream.agent.ts',{'../tools/events.tool':kinds,
  '../nodes/persist.node':persist});
 const agent=stream.createMissionStreamAgent({userId:'alice',missionId:'mission-1',runId:'run-alice',attempt:1});
 agent.onProgress({kind:'mission.started'});
 agent.onGraphEvent({kind:'step.started',step:'supervisor.route',runId:'graph-run',agentId:'supervisor',at:new Date().toISOString()});
 agent.onGraphEvent({kind:'step.completed',step:'supervisor.route',runId:'graph-run',agentId:'supervisor',at:new Date().toISOString()});
 agent.onProgress({kind:'mission.completed'});
 await agent.flush();
 assert.deepEqual(events.map(e=>e.kind),['mission.started','step.started','step.completed','mission.completed']);
 assert.equal(events.every(e=>e.userId==='alice'),true);
});
