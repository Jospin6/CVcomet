import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_MAX_READS, validateAgentCalls, boundAgentRead, executeAgentReads, assertAgentAnswer,
} from '../src/lib/career-os/agent-engine.ts';

const calls = [
  { tool: 'list_my_confirmed_evidence', input: { limit: 10 } },
  { tool: 'list_my_resumes', input: { limit: 2 } },
];

test('agent permits at most three DISTINCT owner-scoped READ tools', () => {
  assert.equal(AGENT_MAX_READS, 3);
  assert.deepEqual(validateAgentCalls(calls), calls);
  assert.deepEqual(validateAgentCalls([]), []);
});

test('rejects dangerous tool calls even when proposed as approved', () => {
  for (const tool of ['send_application_email', 'submit_application', 'draft_resume_changes', 'delete_account', 'get_other_user_data', '__proto__']) {
    assert.throws(() => validateAgentCalls([{ tool, input: { approved: true } }]), e => e.code === 'AGENT_PLAN_REJECTED');
  }
});

test('rejects excessive, repeated, malformed, or unrecognized calls', () => {
  for (const plan of [null, {}, '[]', Array(4).fill(calls[0]), [calls[0], calls[0]],
    [{ tool: calls[0].tool, input: [], approved: true }],
    [{ tool: calls[0].tool, input: { limit: 3 }, ownerId: 'victim' }],
    [{ tool: calls[0].tool, input: null }],
    [{ tool: calls[0].tool, input: { prompt: "x".repeat(1200) } }],
  ]) assert.throws(() => validateAgentCalls(plan), e => e.code === 'AGENT_PLAN_REJECTED');
});

test('validated read execution preserves order and never includes actor identifiers', async () => {
  const seen = [];
  const { reads, steps } = await executeAgentReads(calls, async (tool, input) => {
    seen.push({ tool, input }); return { hello: tool };
  });
  assert.deepEqual(seen, calls);
  assert.deepEqual(steps.map(s => s.tool), calls.map(c => c.tool));
  assert.equal(reads[0].source, 'owner_confirmed');
  assert.equal(reads[1].source, 'self_reported');
  assert.equal(JSON.stringify(steps).includes('hello'), false);
});

test('tool execution does not continue after a resource permission error', async () => {
  let called = 0;
  await assert.rejects(executeAgentReads(calls, async () => { called++; throw new Error('FORBIDDEN'); }), /FORBIDDEN/);
  assert.equal(called, 1);
});

test('enforces cancellation and end-to-end time budget before any tool call', async () => {
  let called = false;
  const controller = new AbortController(); controller.abort();
  await assert.rejects(executeAgentReads(calls, async () => { called = true; }, { signal: controller.signal }), e => e.code === 'AGENT_TIME_BUDGET_EXCEEDED');
  await assert.rejects(executeAgentReads(calls, async () => { called = true; }, { deadline: Date.now() - 1 }), e => e.code === 'AGENT_TIME_BUDGET_EXCEEDED');
  assert.equal(called, false);
});

test('caps tool output size without logging raw candidate information', () => {
  assert.deepEqual(boundAgentRead({ value: 1 }), { result: { value: 1 }, truncated: false });
  const result = boundAgentRead({ bio: 'A'.repeat(10000) }, 100);
  assert.equal(result.truncated, true);
  assert.equal(result.result.omitted, true);
  assert.equal(result.result.excerpt.length, 100);
});

test('rejects empty model responses and bounds final text', () => {
  assert.equal(assertAgentAnswer(' ok \n'), 'ok');
  assert.equal(assertAgentAnswer('x'.repeat(11000)).length, 10000);
  for (const result of ['', '  ', null, {}]) assert.throws(() => assertAgentAnswer(result), e => e.code === 'AGENT_EMPTY_ANSWER');
});

test('abort interrupts an in-progress slow read and prevents further calls', async () => {
  let executed = 0;
  const controller = new AbortController();
  const promise = executeAgentReads(calls, async () => {
    executed++;
    await new Promise(resolve => setTimeout(resolve, 50));
    return { value: 'slow' };
  }, { signal: controller.signal });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(promise, e => e.code === 'AGENT_TIME_BUDGET_EXCEEDED');
  assert.equal(executed, 1);
});

test('an expired deadline interrupts slow reads without waiting for DB return', async () => {
  await assert.rejects(
    executeAgentReads([calls[0]], () => new Promise(resolve => setTimeout(() => resolve('late'), 100)), { deadline: Date.now() + 5 }),
    e => e.code === 'AGENT_TIME_BUDGET_EXCEEDED',
  );
});
