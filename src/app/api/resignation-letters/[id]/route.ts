import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  ProfileError,
  profileErrorResponse,
  profileJson,
} from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

const updateInput = z.object({
  title: z.string().trim().min(1).max(160),
  recipient: z.string().trim().max(250),
  company: z.string().trim().max(250),
  subject: z.string().trim().max(250),
  body: z.string().max(20000),
  signature: z.string().trim().max(250),
  letterDate: z.string().datetime(),
  revision: z.number().int().min(0),
}).strict();

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const document = await prisma.resignationLetter.findFirst({
      where: { id, userId: user.id },
    });
    if (!document) throw new ProfileError(404, "NOT_FOUND");
    return NextResponse.json(document, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertTrustedWriteOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const data = updateInput.parse(await profileJson(request, 30000));
    const { revision, letterDate, ...fields } = data;
    const result = await prisma.resignationLetter.updateMany({
      where: { id, userId: user.id, revision },
      data: {
        ...fields,
        letterDate: new Date(letterDate),
        revision: { increment: 1 },
      },
    });
    if (!result.count) throw new ProfileError(409, "CONFLICT_OR_NOT_FOUND");
    const saved = await prisma.resignationLetter.findFirst({
      where: { id, userId: user.id },
    });
    return NextResponse.json(saved, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertTrustedWriteOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const result = await prisma.resignationLetter.deleteMany({
      where: { id, userId: user.id },
    });
    if (!result.count) throw new ProfileError(404, "NOT_FOUND");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return profileErrorResponse(error);
  }
}
