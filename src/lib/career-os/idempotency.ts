/**
 * Contracts for future durable side effects. Do NOT equate validating a key to
 * idempotency: the actual write path must first claim (owner,key,request hash)
 * atomically in PostgreSQL and persist its result before any replay can succeed.
 */
import { CareerContractError } from "./contracts.ts";

export function parseIdempotencyKey(value: string | null): string {
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value)) {
    throw new CareerContractError(400, "INVALID_IDEMPOTENCY_KEY");
  }
  return value;
}

/** Compare claims without returning the original request or secrets. */
export function assertSameIdempotentRequest(originalHash: string, incomingHash: string): void {
  if (!/^[a-f0-9]{64}$/i.test(originalHash) || !/^[a-f0-9]{64}$/i.test(incomingHash)) {
    throw new CareerContractError(400, "INVALID_OPERATION_FINGERPRINT");
  }
  if (originalHash !== incomingHash) throw new CareerContractError(409, "IDEMPOTENCY_CONFLICT");
}
