import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { assertMissionRequestKey } from "@/lib/career-os/mission-policy";
import { assertProgressMissionOwner, readMissionProgress } from "@/lib/agentic/agents/mission-stream/nodes/replay.node";
import { parseCursor, progressFrame, simpleFrame } from "@/lib/agentic/agents/mission-stream/tools/sse.tool";
import { isTerminalProgress } from "@/lib/agentic/agents/mission-stream/tools/events.tool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const query = z.object({ requestKey: z.string().uuid() }).strict();
const encoder = new TextEncoder();
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** One authenticated, scoped GET stream per tracked mission attempt. Supports Last-Event-ID replay. */
export async function GET(req: Request, ctx: Context) {
  const actor = await getSessionUser();
  if (!actor) return withCareerHttp("mission.progress.unauthorized", async () => { throw new CareerContractError(401, "UNAUTHORIZED"); });
  const id = z.string().uuid().safeParse((await ctx.params).id);
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!id.success || !parsed.success) return withCareerHttp("mission.progress.invalid", async () => { throw new CareerContractError(400, "VALIDATION"); });
  const requestKey = assertMissionRequestKey(parsed.data.requestKey);
  // Must validate ownership before opening the stream; unknown mission IDs must not be observable.
  try { await assertProgressMissionOwner(actor.id, id.data); }
  catch (error) { return withCareerHttp("mission.progress.denied", async () => { throw error; }); }

  const began = Date.now();
  let closed = false;
  let cursor = parseCursor(req.headers.get("last-event-id"));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (line: string) => { if (!closed) controller.enqueue(encoder.encode(line)); };
      const watch = async () => {
        let found = false;
        let lastPing = Date.now();
        let terminalSeen = false;
        let finishSeenAt = 0;
        try {
          while (!closed && !req.signal.aborted && Date.now() - began < 52_000) {
            const snapshot = await readMissionProgress(actor.id, id.data, requestKey, cursor);
            if (snapshot.found) {
              found = true;
              for (const event of snapshot.events) {
                write(progressFrame(event));
                cursor = BigInt(event.id);
                if (isTerminalProgress(event.kind)) terminalSeen = true;
              }
              if (snapshot.expired) {
                write('event: mission.failed\ndata: {"kind":"mission.failed","code":"MISSION_INTERRUPTED"}\n\n');
                break;
              }
              if (terminalSeen) break;
              if (snapshot.status !== "RUNNING") {
                if (!finishSeenAt) finishSeenAt = Date.now();
                if (Date.now() - finishSeenAt > 3_000) break; // final event was unavailable
              }
            } else if (Date.now() - began > 12_000) {
              write(simpleFrame("progress.error", "RUN_NOT_FOUND"));
              break;
            }
            if (!found && Date.now() - lastPing > 4_000) {
              write(simpleFrame("progress.waiting"));
              lastPing = Date.now();
            }
            if (Date.now() - lastPing > 8_000) { write(": keepalive\n\n"); lastPing = Date.now(); }
            await delay(1_200);
          }
        } catch {
          if (!closed && !req.signal.aborted) write(simpleFrame("progress.error", "PROGRESS_UNAVAILABLE"));
        } finally {
          if (!closed) { closed = true; controller.close(); }
        }
      };
      void watch();
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { status: 200, headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "private, no-store, no-transform",
    "X-Accel-Buffering": "no",
    "X-Content-Type-Options": "nosniff",
  } });
}
