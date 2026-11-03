import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { ProfileError, profileFormData, profileJson } from "@/lib/career-profile/http";
import { readLetterBytes, readLetterFromUrl } from "@/lib/career/ats-letter-input";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    await requireUser();
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const { url } = z.object({ url: z.string().url().max(2048) }).strict().parse(await profileJson(req));
      return NextResponse.json({ text: await readLetterFromUrl(url) }, { headers: { "Cache-Control": "no-store" } });
    }
    const form = await profileFormData(req, 3 * 1024 * 1024 + 64 * 1024);
    const file = form.get("file");
    if (!(file instanceof File)) throw new ProfileError(400, "LETTER_FILE_REQUIRED");
    return NextResponse.json({ text: await readLetterBytes(Buffer.from(await file.arrayBuffer()), file.type, file.name) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
