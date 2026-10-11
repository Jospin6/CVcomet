import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse } from "@/lib/career-profile/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const document = await prisma.uploadedResume.findFirst({ where: { id, userId: user.id } });
    if (!document) throw new ProfileError(404, "NOT_FOUND");
    const download = new URL(req.url).searchParams.get("download") === "1";
    const disposition = download || document.mimeType !== "application/pdf" ? "attachment" : "inline";
    const filename = encodeURIComponent(document.name).replace(/['()]/g, character => "%" + character.charCodeAt(0).toString(16));
    return new NextResponse(new Uint8Array(document.content), { headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors 'self'",
    } });
  } catch (error) { return profileErrorResponse(error); }
}

export async function DELETE(_: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const deleted = await prisma.uploadedResume.deleteMany({ where: { id, userId: user.id } });
    if (!deleted.count) throw new ProfileError(404, "NOT_FOUND");
    return new NextResponse(null, { status: 204 });
  } catch (error) { return profileErrorResponse(error); }
}
