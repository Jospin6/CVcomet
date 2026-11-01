/** Mandatory step 02 gate: requires the REAL installed @langchain/langgraph package.
 * Never silently SKIP this test. No DB, API keys or network calls are needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AgenticError } from '../src/lib/agentic/core/errors.ts';

test('stage02 REAL LangGraph: compile, execute nodes/tool, emit events, reject invalid input', async () => {
  let runDemoAgent;
  try {
    ({ runDemoAgent } = await import('../src/lib/agentic/agents/demo/agent/demo.agent.ts'));
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND') {
      assert.fail('Install project dependencies first (npm install), then run the mandatory LangGraph integration test.');
    }
    throw error;
  }
  const events = [];
  const output = await runDemoAgent({
    runId: 'step02-real-graph-test',
    text: '  Hello   graph world  ',
    onEvent: (event) => events.push(event),
  });
  assert.equal(output.normalized, 'Hello graph world');
  assert.equal(output.wordCount, 3);
  assert.equal(output.result, 'Hello graph world (3 words)');
  assert.deepEqual(events.map((event) => event.kind), [
    'run.started',
    'step.started', 'step.completed',
    'step.started', 'step.completed',
    'step.started', 'step.completed',
    'run.completed',
  ]);
  assert.deepEqual(events.filter((event) => event.kind === 'step.started').map((event) => event.step), [
    'normalize', 'inspect', 'render',
  ]);
  await assert.rejects(
    runDemoAgent({ runId: 'step02-invalid-input', text: '    ' }),
    (error) => error instanceof AgenticError && error.code === 'AGENT_TOOL_INPUT_INVALID',
  );
});
