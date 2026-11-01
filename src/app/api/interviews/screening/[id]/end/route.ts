import { NextResponse } from "next/server";
import { LiveKitAPI } from "livekit-server-sdk";
import prisma from "../../../../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";

export const runtime = "nodejs";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const session = await prisma.interviewSession.findFirst({ where: { id, userId: user.id } });
    if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const config = session.configuration as { roomName?: string } | null;
    if (["VOICE_ACTIVE", "VOICE_EVALUATING"].includes(session.status)) {
      if (session.status === "VOICE_ACTIVE") {
        await prisma.interviewSession.updateMany({ where: { id, userId: user.id, status: "VOICE_ACTIVE" }, data: { status: "VOICE_ENDING" } });
      }
      if (config?.roomName && process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
        const api = new LiveKitAPI({ host: process.env.LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), apiKey: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET });
        try { await api.room.deleteRoom(config.roomName); } catch { /* Room may already be closed. */ }
      }
    }
    return NextResponse.json({ status: "ending" });
  } catch (error) { return apiError(error); }
}
