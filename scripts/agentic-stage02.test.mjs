import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AgenticError } from '../src/lib/agentic/core/errors.ts';
import { createRunBudget } from '../src/lib/agentic/core/execution/budget.ts';
import { runAgentGraph } from '../src/lib/agentic/core/execution/runner.ts';
import { ReadToolRegistry } from '../src/lib/agentic/core/tools/read-tool-registry.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const access = { kind: 'authenticated', actorId: 'user-001' };
const identity = { runId: 'test-run-001', agentId: 'resume', access };

const isCode = (code) => (error) => error instanceof AgenticError && error.code === code;

test('step02: each specialized agent has separate agent/nodes/tools/prompts directories', () => {
  const ids = ['profile','resume','cover-letter','ats','job-match','job-discovery','career-map',
    'interview-text','interview-voice','application','supervisor','demo'];
  for (const id of ids) {
    for (const segment of ['agent', 'nodes', 'tools', 'prompts']) {
      assert.ok(fs.statSync(path.join(root, 'src/lib/agentic/agents', id, segment)).isDirectory(), `${id}/${segment}`);
    }
  }
});

test('step02: core budget validates its constraints', () => {
  assert.throws(() => createRunBudget({ timeoutMs: 0 }), isCode('AGENT_INVALID_BUDGET'));
  assert.throws(() => createRunBudget({ timeoutMs: 999_999 }), isCode('AGENT_INVALID_BUDGET'));
});

test('step02: completion is bounded and emits only safe events', async () => {
  const events = [];
  const result = await runAgentGraph({
    identity,
    input: { text: 'private text must not be logged' },
    onEvent: (event) => events.push(event),
    createGraph: (scope) => ({
      async invoke(input, config) {
        assert.ok(config.signal);
        assert.equal(config.recursionLimit, 16);
        return scope.step('verify', () => input.text.length);
      },
    }),
  });
  assert.equal(result, 31);
  assert.deepEqual(events.map(e => e.kind), ['run.started','step.started','step.completed','run.completed']);
  assert.ok(!JSON.stringify(events).includes('private text'));
  assert.ok(events.every(e => Object.keys(e).every(key => ['kind','runId','agentId','at','step','code'].includes(key))));
});

test('step02: caller cancellation ends an execution with a stable code', async () => {
  const controller = new AbortController();
  const pending = runAgentGraph({
    identity,
    input: {},
    signal: controller.signal,
    createGraph: () => ({ invoke: () => new Promise(() => {}) }),
  });
  controller.abort();
  await assert.rejects(pending, isCode('AGENT_CANCELLED'));
});

test('step02: time budget expires even if underlying graph never settles', async () => {
  await assert.rejects(runAgentGraph({
    identity,
    input: {},
    timeoutMs: 15,
    createGraph: () => ({ invoke: () => new Promise(() => {}) }),
  }), isCode('AGENT_DEADLINE_EXCEEDED'));
});

test('step02: no public-demo bypass for a domain agent', async () => {
  await assert.rejects(runAgentGraph({
    identity: { runId: 'test', agentId: 'resume', access: { kind: 'public_demo' } },
    input: {},
    createGraph: () => ({ invoke: async () => ({}) }),
  }), isCode('AGENT_ACCESS_DENIED'));
});

test('step02: invalid recursion limits are rejected', async () => {
  await assert.rejects(runAgentGraph({
    identity,
    input: {},
    recursionLimit: 900,
    createGraph: () => ({ invoke: async () => ({}) }),
  }), isCode('AGENT_INVALID_BUDGET'));
});

test('step02: tool registry requires validation, permission and distinct names', async () => {
  const tools = new ReadToolRegistry();
  let executed = 0;
  tools.register({
    name: 'read_name',
    validate(value) { if (typeof value !== 'string') throw new Error('bad'); return value; },
    authorize(value, context) {
      if (context.access.kind !== 'authenticated' || context.access.actorId !== 'user-001' || value !== 'allowed') {
        throw new AgenticError('AGENT_TOOL_FORBIDDEN', 403);
      }
    },
    execute(value) { executed += 1; return value.toUpperCase(); },
  });
  const budget = createRunBudget();
  try {
    const context = { access, signal: budget.signal };
    await assert.rejects(tools.invoke('read_name', 123, context), isCode('AGENT_TOOL_INPUT_INVALID'));
    await assert.rejects(tools.invoke('read_name', 'denied', context), isCode('AGENT_TOOL_FORBIDDEN'));
    await assert.rejects(tools.invoke('missing', 'allowed', context), isCode('AGENT_TOOL_UNKNOWN'));
    await assert.rejects(tools.invoke('read_name', 'allowed', { access: { kind: 'public_demo' }, signal: budget.signal }), isCode('AGENT_TOOL_FORBIDDEN'));
    assert.equal(executed, 0);
    assert.equal(await tools.invoke('read_name', 'allowed', context), 'ALLOWED');
    assert.equal(executed, 1);
    assert.throws(() => tools.register({ name: 'read_name' }), isCode('AGENT_TOOL_DUPLICATE'));
  } finally { budget.close(); }
});

test('step02: error details and observer exceptions do not leak or control outcomes', async () => {
  const events = [];
  await assert.rejects(runAgentGraph({
    identity,
    input: {},
    onEvent: (event) => { events.push(event); if (event.kind === 'run.started') throw new Error('observer'); },
    createGraph: (scope) => ({
      invoke: () => scope.step('private-step', () => { throw new Error('SECRET_DB_CONNECTION_STRING'); }),
    }),
  }), isCode('AGENT_RUN_FAILED'));
  assert.ok(!JSON.stringify(events).includes('SECRET_DB_CONNECTION_STRING'));
  assert.deepEqual(events.map(e => e.kind), ['run.started','step.started','step.failed','run.failed']);
});


test('step02: identity and step metadata are rejected safely', async () => {
  await assert.rejects(runAgentGraph({
    identity: { runId: 'run001', agentId: 'resume' },
    input: {},
    createGraph: () => ({ invoke: async () => ({}) }),
  }), isCode('AGENT_INVALID_IDENTITY'));
  await assert.rejects(runAgentGraph({
    identity: { runId: 'run001', agentId: 'resume', access: { kind: 'authenticated', actorId: 'bad\nactor' } },
    input: {},
    createGraph: () => ({ invoke: async () => ({}) }),
  }), isCode('AGENT_INVALID_IDENTITY'));
  const events = [];
  await assert.rejects(runAgentGraph({
    identity,
    input: {},
    onEvent: (event) => events.push(event),
    createGraph: (scope) => ({ invoke: () => scope.step('private document content', () => 'should not run') }),
  }), isCode('AGENT_STEP_FAILED'));
  assert.ok(!JSON.stringify(events).includes('private document content'));
});

test('step02: tool execution and authorization errors cannot expose provider secrets', async () => {
  const tools = new ReadToolRegistry();
  tools.register({
    name: 'read_private',
    validate: (value) => value,
    authorize() { throw new Error('SECRET_DB_CONNECTION'); },
    execute: () => 'never',
  });
  tools.register({
    name: 'read_unstable',
    validate: (value) => value,
    authorize() {},
    execute() { throw new Error('SECRET_PROVIDER_TOKEN'); },
  });
  const budget = createRunBudget();
  try {
    const context = { access, signal: budget.signal };
    await assert.rejects(tools.invoke('read_private', {}, context), isCode('AGENT_TOOL_FORBIDDEN'));
    await assert.rejects(tools.invoke('read_unstable', {}, context), isCode('AGENT_STEP_FAILED'));
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(tools.invoke('read_unstable', {}, { access, signal: aborted.signal }), isCode('AGENT_CANCELLED'));
  } finally { budget.close(); }
});
