/** Mandatory production-like DB test. Uses a dedicated test DB, never production data. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
config({ path: '.env.local', override: false, quiet: true });
config({ path: '.env', override: false, quiet: true });

import { setupPostgresCheckpoints, closePostgresCheckpoints, getPostgresPersistence } from '../src/lib/agentic/core/persistence/postgres.ts';
import { runDurableDemo } from '../src/lib/agentic/agents/demo/agent/durable-demo.agent.ts';
import { deleteDurableMission } from '../src/lib/agentic/core/execution/durable-runner.ts';

// Only a dedicated database is allowed to receive writes from this test.
test('stage03 PostgreSQL: checkpoint survives a pool restart and HITL resume works', async () => {
  if (process.env.AGENTIC_CHECKPOINT_TEST_DB !== '1' || !process.env.AGENTIC_CHECKPOINT_DATABASE_URL) {
    assert.fail('Set AGENTIC_CHECKPOINT_TEST_DB=1 and AGENTIC_CHECKPOINT_DATABASE_URL to a DEDICATED test database.');
  }
  const id = randomUUID();
  const identity={runId:randomUUID(),agentId:'demo',access:{kind:'authenticated',actorId:randomUUID()}};
  let created = false;
  try {
    await setupPostgresCheckpoints();
    const first=await runDurableDemo({actorId:identity.access.actorId,runId:identity.runId,missionId:id,mode:'start'});
    assert.equal(first.status,'paused');
    created = true;
    // Simulate a new worker/process resource lifecycle.
    await closePostgresCheckpoints();
    const second=await runDurableDemo({actorId:identity.access.actorId,runId:randomUUID(),missionId:id,mode:'resume',approved:true});
    assert.equal(second.status,'completed');
    assert.equal(second.output.result,'approved');
  } finally {
    try {
      if (created) await deleteDurableMission({identity,missionId:id},getPostgresPersistence());
    } finally {
      await closePostgresCheckpoints();
    }
  }
});
