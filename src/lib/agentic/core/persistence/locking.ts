import { createHash } from "node:crypto";
import { AgenticError } from "../errors.ts";

export type LockClient = {
  query: (query: string, values: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  release: (destroy?: boolean) => void;
};
export type LockPool = { connect: () => Promise<LockClient> };

/** Use the signed 64-bit SHA-256 prefix as the PostgreSQL advisory-lock key. */
export function advisoryLockKey(threadId: string): string {
  const hash = createHash("sha256").update(threadId).digest();
  return hash.readBigInt64BE(0).toString();
}

/**
 * Locks an entire mission attempt across server instances. Fails fast if the
 * same thread is already executing. Advisory locks require a session client.
 * Only checkpoints/read-only demo workflows use this in stage 03.
 */
export async function withPgThreadLock<T>(pool: LockPool, threadId: string, work: () => Promise<T>): Promise<T> {
  let client: LockClient;
  try {
    client = await pool.connect();
  } catch {
    throw new AgenticError("AGENT_CHECKPOINT_UNAVAILABLE", 503);
  }
  const key = advisoryLockKey(threadId);
  let acquired = false;
  let healthy = true;
  try {
    const result = await client.query("SELECT pg_try_advisory_lock($1::bigint) AS acquired", [key]);
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) throw new AgenticError("AGENT_THREAD_BUSY", 409);
    return await work();
  } catch (error) {
    if (error instanceof AgenticError) throw error;
    // The result of a graph node may have its own safe error code.
    throw new AgenticError("AGENT_CHECKPOINT_UNAVAILABLE", 503);
  } finally {
    if (acquired) {
      try {
        const result = await client.query("SELECT pg_advisory_unlock($1::bigint) AS released", [key]);
        if (result.rows[0]?.released !== true) healthy = false;
      } catch { healthy = false; }
    }
    client.release(!healthy);
  }
}
