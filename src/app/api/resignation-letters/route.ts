import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");

    const documents = await prisma.resignationLetter.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        recipient: true,
        company: true,
        subject: true,
        body: true,
        letterDate: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return NextResponse.json(documents, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");

    const created = await prisma.resignationLetter.create({
      data: {
        userId: user.id,
        title: "Resignation letter",
      },
      select: { id: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return profileErrorResponse(error);
  }
}
