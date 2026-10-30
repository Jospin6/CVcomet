import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { z } from "zod";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { profileJson } from "@/lib/career-profile/http";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse } from "@/lib/career-profile/http";

/** Document library: list only cover letters belonging to the signed-in user. */
export async function GET() {
  try {
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");

    const letters = await prisma.coverLetter.findMany({
      where: { conversation: { userId: actor.id } },
      select: {
        id: true,
        senderName: true,
        companyName: true,
        positionTitle: true,
        introduction: true,
        body: true,
        conclusion: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return NextResponse.json(letters, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

const createInput = z.object({
  applicationId: z.string().uuid().optional(),
}).strict();

/** Create a real empty editable letter, without requiring an existing CV. */
export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");
    const body = createInput.parse(await profileJson(request, 1024));
    const application = body.applicationId
      ? await prisma.jobApplication.findFirst({
          where: { id: body.applicationId, userId: actor.id },
        })
      : null;
    if (body.applicationId && !application) {
      throw new ProfileError(404, "APPLICATION_NOT_FOUND");
    }

    const created = await prisma.$transaction(async (tx) => {
      const letter = await tx.coverLetter.create({
        data: {
          recipientName: "",
          recipientTitle: "",
          introduction: "",
          body: "",
          companyName: application?.company || "",
          positionTitle: application?.jobTitle || "",
          conversation: {
            create: {
              userId: actor.id,
              title: "Cover letter",
              content: "Blank editable cover letter",
            },
          },
        },
        select: { id: true, updatedAt: true },
      });
      if (application) {
        await tx.jobApplication.update({
          where: { id: application.id },
          data: {
            coverLetterId: letter.id,
            coverLetterSnapshot: {
              id: letter.id,
              updatedAt: letter.updatedAt.toISOString(),
            },
          },
        });
      }
      return letter;
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return profileErrorResponse(error);
  }
}
