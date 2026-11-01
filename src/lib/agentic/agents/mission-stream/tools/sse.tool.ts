import type { CareerProgressKind } from "./events.tool";
import { PROGRESS_KINDS } from "./events.tool";

export type PublicProgressEvent = Readonly<{
  id: string; kind: string; step?: string; code?: string; at: string;
}>;
/** SSE frames are serialized here so no untrusted object can become a header/event name. */
export function progressFrame(event: PublicProgressEvent): string {
  if (!PROGRESS_KINDS.includes(event.kind as CareerProgressKind) || !/^\d{1,24}$/.test(event.id)) {
    throw new Error("INVALID_PROGRESS_EVENT");
  }
  return `id: ${event.id}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
}
export function simpleFrame(kind: "progress.error" | "progress.waiting", code?: "RUN_NOT_FOUND" | "PROGRESS_UNAVAILABLE"): string {
  return `event: ${kind}\ndata: ${JSON.stringify(code ? { code } : { status: "WAITING" })}\n\n`;
}
export function parseCursor(header: string | null): bigint {
  if (!header || !/^\d{1,24}$/.test(header)) return BigInt(0);
  const cursor = BigInt(header);
  return cursor <= BigInt("9223372036854775807") ? cursor : BigInt(0);
}
