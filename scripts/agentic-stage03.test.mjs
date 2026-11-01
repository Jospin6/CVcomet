/** Offline stage 03 checks; no secrets, database or LangGraph package required. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AgenticError } from '../src/lib/agentic/core/errors.ts';
import { makeMissionThread } from '../src/lib/agentic/core/persistence/thread.ts';
import { readCheckpointDatabaseConfig } from '../src/lib/agentic/core/persistence/config.ts';
import { advisoryLockKey, withPgThreadLock } from '../src/lib/agentic/core/persistence/locking.ts';
import {
  runDurableAgentGraph, hasPendingInterrupt, isGraphPaused,
  durableMissionExists, deleteDurableMission,
} from '../src/lib/agentic/core/execution/durable-runner.ts';

const actor = 'user-003';
const identity = (id=actor) => ({ runId: randomUUID(), agentId: 'resume', access: { kind: 'authenticated', actorId: id } });
const missionId = () => randomUUID();
const isCode = code => error => error instanceof AgenticError && error.code === code;

function fakeDurableStore() {
  const checkpoints = new Map();
  const running = new Set();
  const store = {
    checkpointer: {
      async getTuple(config) { return checkpoints.get(config.configurable.thread_id); },
      async deleteThread(threadId) { checkpoints.delete(threadId); },
    },
    async withThreadLock(threadId, task) {
      if (running.has(threadId)) throw new AgenticError('AGENT_THREAD_BUSY', 409);
      running.add(threadId);
      try { return await task(); } finally { running.delete(threadId); }
    },
  };
  const createGraph = (scope) => ({
    async getState(config) {
      assert.ok(config.configurable.thread_id.startsWith('cv3-v1-'));
      return { tasks: [{ interrupts: [{ key: 'approval' }] }] };
    },
    async invoke(input, config) {
      assert.equal(config.configurable.thread_id.length, 71);
      assert.ok(config.signal);
      assert.equal(config.recursionLimit, 16);
      const runResult = await scope.step('demo_pause', async () => input?.resume
        ? { done: true }
        : { __interrupt__: [{ value: { kind: 'approval' } }] });
      checkpoints.set(config.configurable.thread_id, { checkpoint: { id: randomUUID() } });
      return runResult;
    },
  });
  return { store, createGraph, checkpoints };
}

test('stage03: thread is stable across attempts and isolated by agent, actor and mission', () => {
  const id = missionId();
  const first = makeMissionThread({ identity: identity(), missionId: id }).configurable.thread_id;
  assert.equal(first, makeMissionThread({ identity: identity(), missionId: id }).configurable.thread_id);
  assert.notEqual(first, makeMissionThread({ identity: identity('user-004'), missionId: id }).configurable.thread_id);
  assert.notEqual(first, makeMissionThread({ identity: { ...identity(), agentId: 'ats' }, missionId: id }).configurable.thread_id);
  assert.notEqual(first, makeMissionThread({ identity: identity(), missionId: missionId() }).configurable.thread_id);
  assert.ok(!first.includes(actor));
  assert.equal(first.length, 71);
});

test('stage03: malformed mission and anonymous durable access rejected', () => {
  assert.throws(() => makeMissionThread({ identity: identity(), missionId: 'resume:user-003' }), isCode('AGENT_INVALID_MISSION_ID'));
  assert.throws(() => makeMissionThread({ identity: { runId:'run-1', agentId:'demo', access:{kind:'public_demo'} }, missionId:missionId() }), isCode('AGENT_ACCESS_DENIED'));
});

test('stage03: config requires direct URL, bounded pool, never echoes secret', () => {
  assert.deepEqual(readCheckpointDatabaseConfig({ DATABASE_URL_UNPOOLED: 'postgresql://alice:secret@db.example.org:5432/cv' }), {
    connectionString: 'postgresql://alice:secret@db.example.org:5432/cv', maxConnections: 4,
  });
  assert.equal(readCheckpointDatabaseConfig({AGENTIC_CHECKPOINT_DATABASE_URL:'postgres://alice:pw@server:5432/cv',AGENTIC_CHECKPOINT_POOL_MAX:'7'}).maxConnections,7);
  assert.throws(() => readCheckpointDatabaseConfig({DATABASE_URL:'postgresql://alice:pw@db/cv'}), isCode('AGENT_CHECKPOINT_NOT_CONFIGURED'));
  for (const value of ['0', '2', '11', 'not-number', '1.1']) {
    assert.throws(() => readCheckpointDatabaseConfig({DATABASE_URL_UNPOOLED:'postgresql://alice:pw@db/cv',AGENTIC_CHECKPOINT_POOL_MAX:value}), isCode('AGENT_CHECKPOINT_CONFIG_INVALID'));
  }
  try { readCheckpointDatabaseConfig({DATABASE_URL_UNPOOLED:'not-a-secret-URL'}); } catch(error) {
    assert.equal(error.message, 'AGENT_CHECKPOINT_CONFIG_INVALID');
    assert.ok(!error.message.includes('not-a-secret-URL'));
  }
});

test('stage03: thread lock uses safe parameterized bigint SQL and releases client', async () => {
  const queries = [];
  let released = false;
  const pool = { async connect() { return {
    async query(sql, params) { queries.push({sql,params}); return {rows:[{[sql.includes('try_')?'acquired':'released']:true}]}; },
    release() { released = true; },
  }; } };
  const result = await withPgThreadLock(pool, 'cv3-v1-demo', async () => 17);
  assert.equal(result,17);
  assert.equal(queries.length,2);
  assert.deepEqual(queries[0].params,queries[1].params);
  assert.match(queries[0].sql,/\$1::bigint/);
  assert.equal(typeof advisoryLockKey('cv3-v1-demo'), 'string');
  assert.equal(released,true);
});

test('stage03: locked thread fails fast and releases client', async () => {
  let released = false;
  const pool = {async connect() {return {
    async query() {return {rows:[{acquired:false}]};}, release() {released=true;},
  };}};
  await assert.rejects(withPgThreadLock(pool, 'thread', async () => 1),isCode('AGENT_THREAD_BUSY'));
  assert.equal(released,true);
});

test('stage03: lock transport errors use safe code and destroy bad connection', async () => {
  let destroyed;
  const pool = {async connect() {return {
    async query(sql) {if (sql.includes('try_')) return {rows:[{acquired:true}]}; throw new Error('SECRET');},
    release(value) {destroyed = value;},
  };}};
  await withPgThreadLock(pool, 'thread', async () => 1);
  assert.equal(destroyed,true);
  await assert.rejects(withPgThreadLock({connect:async()=>{throw Error('SECRET');}},'thread',async()=>1),isCode('AGENT_CHECKPOINT_UNAVAILABLE'));
});

test('stage03: detects real approval pending rather than ordinary state', () => {
  assert.equal(hasPendingInterrupt({tasks:[{interrupts:[{id:'approval'}]}]}),true);
  assert.equal(hasPendingInterrupt({tasks:[{interrupts:[]}]}),false);
  assert.equal(hasPendingInterrupt({tasks:[]}),false);
  assert.equal(isGraphPaused({__interrupt__:[{value:'approval'}]}),true);
  assert.equal(isGraphPaused({done:true}),false);
});

test('stage03: pause, persistent resume, duplicate start rejection and deletion', async () => {
  const {store,createGraph}=fakeDurableStore();
  const id=missionId();
  const events=[];
  const options={identity:identity(),missionId:id,createGraph,store,onEvent:event=>events.push(event)};
  const start=await runDurableAgentGraph({...options,mode:{kind:'start',input:{request:'demo'}}});
  assert.equal(start.status,'paused');
  assert.equal(await durableMissionExists({identity:identity(),missionId:id},store),true);
  assert.deepEqual(events.filter(e=>e.kind.startsWith('run.')).map(e=>e.kind),['run.started','run.paused']);
  await assert.rejects(runDurableAgentGraph({...options,mode:{kind:'start',input:{request:'demo'}}}),isCode('AGENT_THREAD_ALREADY_EXISTS'));
  const second=await runDurableAgentGraph({...options,identity:identity(),mode:{kind:'resume',resumeInput:{resume:true}}});
  assert.equal(second.status,'completed');
  assert.deepEqual(second.output,{done:true});
  await deleteDurableMission({identity:identity(),missionId:id},store);
  assert.equal(await durableMissionExists({identity:identity(),missionId:id},store),false);
});

test('stage03: missing thread and wrong actor cannot resume saved mission', async () => {
  const {store,createGraph}=fakeDurableStore();
  const id=missionId();
  await assert.rejects(runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'resume',resumeInput:{resume:true}},createGraph,store}),isCode('AGENT_THREAD_NOT_FOUND'));
  await runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'start',input:{}},createGraph,store});
  await assert.rejects(runDurableAgentGraph({identity:identity('other-user'),missionId:id,mode:{kind:'resume',resumeInput:{resume:true}},createGraph,store}),isCode('AGENT_THREAD_NOT_FOUND'));
});

test('stage03: resume without interrupted node is rejected', async () => {
  const {store,createGraph}=fakeDurableStore();
  const id=missionId();
  await runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'start',input:{}},createGraph,store});
  const cleanGraph=scope=>({
    ...createGraph(scope),getState:async()=>({tasks:[{interrupts:[]}]})
  });
  await assert.rejects(runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'resume',resumeInput:{resume:true}},createGraph:cleanGraph,store}),isCode('AGENT_THREAD_NOT_INTERRUPTED'));
});

test('stage03: same-thread concurrent execution cannot bypass lock', async () => {
  const {store,createGraph}=fakeDurableStore();
  const id=missionId();
  let release;
  let entered;
  const acquired=new Promise(resolve=>{entered=resolve;});
  const gate=new Promise(resolve=>{release=resolve;});
  const slowGraph=scope=>({
    ...createGraph(scope),
    async invoke() {entered();await gate;return {done:true};},
  });
  const first=runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'start',input:{}},createGraph:slowGraph,store});
  await acquired;
  await assert.rejects(runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'start',input:{}},createGraph:slowGraph,store}),isCode('AGENT_THREAD_BUSY'));
  release();await first;
});

test('stage03: retry is allowed only for incomplete, non-interrupted checkpoints', async () => {
  const {store,createGraph}=fakeDurableStore();
  const id=missionId();
  await runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'start',input:{}},createGraph,store});
  // Simulate a failed prior step: queued work but no approval interrupt.
  const retryGraph=scope=>({
    ...createGraph(scope),getState:async()=>({next:['recover_failed_step'],tasks:[]}),
  });
  const resumed=await runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'retry',retryInput:{resume:true}},createGraph:retryGraph,store});
  assert.equal(resumed.status,'completed');
  const wrongGraph=scope=>({...createGraph(scope),getState:async()=>({next:[],tasks:[]})});
  await assert.rejects(runDurableAgentGraph({identity:identity(),missionId:id,mode:{kind:'retry',retryInput:{resume:true}},createGraph:wrongGraph,store}),isCode('AGENT_THREAD_NOT_RETRYABLE'));
});
