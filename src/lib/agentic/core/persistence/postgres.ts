import pg from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgenticError } from "../errors.ts";
import { readCheckpointDatabaseConfig } from "./config.ts";
import { withPgThreadLock } from "./locking.ts";

export type PostgresPersistence = Readonly<{
  checkpointer: PostgresSaver;
  withThreadLock: <T>(threadId: string, work: () => Promise<T>) => Promise<T>;
}>;

type Resources = Readonly<{ pool: pg.Pool; saver: PostgresSaver; service: PostgresPersistence }>;
let resources: Resources | undefined;

/** Lazy, bounded pool shared by checkpoint writes and per-thread advisory locks.
 * Never call from an Edge route; pg uses Node TCP/TLS sockets.
 */
function getResources(): Resources {
  if (resources) return resources;
  if (process.env.NEXT_RUNTIME === "edge") {
    throw new AgenticError("AGENT_CHECKPOINT_UNAVAILABLE", 503);
  }
  const config = readCheckpointDatabaseConfig();
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    max: config.maxConnections,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });
  // A pool-level error must not become an unhandled Node EventEmitter error.
  pool.on("error", () => { /* do not log connection strings or secrets */ });
  const saver = new PostgresSaver(pool);
  // Reserve two connections for checkpoint reads/writes even when missions run
  // concurrently. Otherwise all clients could hold advisory locks and deadlock.
  const maxRunning = config.maxConnections - 2;
  let running = 0;
  const service: PostgresPersistence = {
    checkpointer: saver,
    async withThreadLock(threadId, work) {
      if (running >= maxRunning) throw new AgenticError("AGENT_CHECKPOINT_BUSY", 429);
      running += 1;
      try {
        return await withPgThreadLock(pool, threadId, work);
      } finally {
        running -= 1;
      }
    },
  };
  resources = { pool, saver, service };
  return resources;
}

export function getPostgresPersistence(): PostgresPersistence {
  return getResources().service;
}

/** Explicit deployment/maintenance command, NOT automatic DDL in HTTP requests. */
export async function setupPostgresCheckpoints(): Promise<void> {
  try {
    await getResources().saver.setup();
  } catch {
    throw new AgenticError("AGENT_CHECKPOINT_UNAVAILABLE", 503);
  }
}

/** Used by maintenance scripts and controlled shutdown only. */
export async function closePostgresCheckpoints(): Promise<void> {
  const current = resources;
  resources = undefined;
  if (current) await current.pool.end();
}
