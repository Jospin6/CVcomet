import { NextResponse } from "next/server";
import { LiveKitAPI } from "livekit-server-sdk";
import prisma from "../../../../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { ProfileError } from "@/lib/career-profile/http";

export const runtime = "nodejs";

/**
 * Hanging up is a cancellation, not a request to generate a report.
 * Only an explicit "finish" action may authorize a worker evaluation.
 * Status transitions happen BEFORE the remote room is deleted, so a worker
 * callback racing with disconnection cannot evaluate a cancelled call.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const raw: unknown = await req.json().catch(() => ({}));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ProfileError(400, "VALIDATION");
    }
    const action = "action" in raw ? raw.action : "cancel";
    if (action !== "cancel" && action !== "finish") {
      throw new ProfileError(400, "VALIDATION");
    }

    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true, configuration: true },
    });
    if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const cfg = session.configuration as { mode?: string; roomName?: string } | null;
    if (cfg?.mode !== "AI_SCREENING_VOICE") {
      throw new ProfileError(409, "NOT_A_SCREENING_CALL");
    }

    const allowed = action === "cancel"
      ? ["VOICE_ACTIVE", "VOICE_ENDING", "VOICE_EVALUATING"]
      : ["VOICE_ACTIVE"];
    await prisma.interviewSession.updateMany({
      where: { id, userId: user.id, status: { in: allowed } },
      data: action === "cancel"
        ? { status: "VOICE_CANCELLED", overallScore: null }
        : { status: "VOICE_ENDING" },
    });

    const current = await prisma.interviewSession.findFirst({
      where: { id, userId: user.id }, select: { status: true },
    });
    // A valid finishing attempt, or a cancellation, should disconnect the room.
    // Repeated requests are safe. Never tear down an already completed interview.
    if (cfg.roomName && ["VOICE_CANCELLED", "VOICE_ENDING"].includes(current?.status ?? "") &&
        process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
      const api = new LiveKitAPI({
        host: process.env.LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
        apiKey: process.env.LIVEKIT_API_KEY,
        secret: process.env.LIVEKIT_API_SECRET,
      });
      try {
        await api.room.deleteRoom(cfg.roomName);
      } catch (error) {
        // A missing room is normal after a failed connection or a repeated hang-up.
        // The DB status still prevents any later transcript/report generation.
        console.warn("Screening room cleanup did not complete", error instanceof Error ? error.name : "UNKNOWN");
      }
    }
    return NextResponse.json({ status: current?.status ?? session.status }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) { return apiError(error); }
}
