import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 80 } },
    });
    return session
      ? NextResponse.json(session, { headers: { "cache-control": "no-store" } })
      : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true, createdAt: true },
    });
    if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (["VOICE_ACTIVE", "VOICE_ENDING"].includes(session.status)
      && session.createdAt.getTime() > Date.now() - 30 * 60_000) {
      return NextResponse.json({ error: "FINISH_VOICE_CALL_FIRST" }, { status: 409 });
    }
    await prisma.interviewSession.deleteMany({ where: { id, userId: user.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
