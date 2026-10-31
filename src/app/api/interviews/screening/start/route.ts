import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { AccessToken, LiveKitAPI } from "livekit-server-sdk";
import prisma from "../../../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { getOwnedScreeningContext, screeningStartInput } from "@/lib/career/screening";
import { ProfileError } from "@/lib/career-profile/http";
import { reserveProfileAI } from "@/lib/career-profile/ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = screeningStartInput.parse(await req.json());
    const url = process.env.LIVEKIT_URL;
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret || !process.env.CVCOMET_VOICE_WORKER_SECRET) {
      throw new ProfileError(503, "LIVEKIT_NOT_CONFIGURED");
    }
    const context = await getOwnedScreeningContext(user.id, input.applicationId);
    const active = await prisma.interviewSession.findFirst({
      where: { userId: user.id, status: "VOICE_ACTIVE", createdAt: { gt: new Date(Date.now() - 30 * 60_000) } },
      select: { id: true },
    });
    if (active) throw new ProfileError(409, "SCREENING_ALREADY_ACTIVE");

    await reserveProfileAI(user.id, "INTERVIEW_PREPARATION");

    const sessionId = randomUUID();
    const roomName = `cvcomet-screening-${sessionId}`;
    await prisma.interviewSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        applicationId: input.applicationId,
        type: "HR",
        title: `AI Screening · ${context.jobTitle}`,
        status: "VOICE_ACTIVE",
        configuration: {
          mode: "AI_SCREENING_VOICE", roomName,
          language: input.language, consent: true,
          cvId: context.cvId, jobId: context.application.jobId,
          company: context.company,
          jobTitle: context.jobTitle,
          location: context.application.job?.location || "",
          jobDescription: context.jobDescription,
          resumeText: context.resumeText,
        },
      },
    });
    try {
      const api = new LiveKitAPI({ host: url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), apiKey: key, secret });
      await api.agentDispatch.createDispatch(roomName, "cvcomet-screening", { metadata: JSON.stringify({ sessionId }) });
      const token = new AccessToken(key, secret, { identity: `candidate-${randomUUID()}`, ttl: "30m" });
      token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: false });
      return NextResponse.json({ sessionId, token: await token.toJwt(), serverUrl: url });
    } catch {
      await prisma.interviewSession.update({ where: { id: sessionId }, data: { status: "VOICE_UNAVAILABLE" } });
      throw new ProfileError(503, "VOICE_AGENT_UNAVAILABLE");
    }
  } catch (error) { return apiError(error); }
}
