import { AgenticError } from "../errors.ts";

const readPoolMax = (value: string | undefined): number => {
  if (value === undefined || value === "") return 4;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 3 || n > 10) {
    throw new AgenticError("AGENT_CHECKPOINT_CONFIG_INVALID", 500);
  }
  return n;
};

export type CheckpointDatabaseConfig = Readonly<{
  connectionString: string;
  maxConnections: number;
}>;

/**
 * Requires a real TCP PostgreSQL endpoint, not the Neon HTTP driver or an
 * unverified pooler. No fallback to DATABASE_URL: Prisma's URL may be pooled.
 * Reads existing DATABASE_URL_UNPOOLED if no dedicated setting is provided.
 */
export function readCheckpointDatabaseConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): CheckpointDatabaseConfig {
  const connectionString = env.AGENTIC_CHECKPOINT_DATABASE_URL || env.DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new AgenticError("AGENT_CHECKPOINT_NOT_CONFIGURED", 503);
  try {
    const url = new URL(connectionString);
    if (!(["postgresql:", "postgres:"].includes(url.protocol)) || !url.hostname ||
        !url.username || !url.pathname || url.pathname === "/") {
      throw new Error("bad connection URL");
    }
  } catch {
    throw new AgenticError("AGENT_CHECKPOINT_CONFIG_INVALID", 500);
  }
  return { connectionString, maxConnections: readPoolMax(env.AGENTIC_CHECKPOINT_POOL_MAX) };
}
