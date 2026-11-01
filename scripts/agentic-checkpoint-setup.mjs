/** Explicit, idempotent PostgresSaver schema setup. Run once per deployment. */
import { config } from 'dotenv';
config({ path: '.env.local', override: false, quiet: true });
config({ path: '.env', override: false, quiet: true });

import { setupPostgresCheckpoints, closePostgresCheckpoints } from '../src/lib/agentic/core/persistence/postgres.ts';

try {
  await setupPostgresCheckpoints();
  process.stdout.write('LangGraph PostgreSQL checkpointer schema is ready.\n');
} catch {
  process.stderr.write('LangGraph checkpointer setup failed. Check the direct Postgres URL and database permissions.\n');
  process.exitCode = 1;
} finally {
  await closePostgresCheckpoints();
}
