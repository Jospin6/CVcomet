import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  profileErrorResponse,
  profileJson,
  ProfileError,
} from "@/lib/career-profile/http";

const input = z.object({
  externalId: z.string().min(1).max(300),
  provider: z.string().min(1).max(40),
  title: z.string().min(1).max(300),
  company: z.string().max(300),
  location: z.string().max(300).nullable(),
  description: z.string().max(30000),
  sourceUrl: z.string().url().max(2048),
  skills: z.array(z.string().max(100)).max(100),
  logoUrl: z.string().url().max(2048).nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  eligibleCountries: z.array(z.string().max(120)).max(100).optional(),
  remote: z.boolean().nullable().optional(),
  contractType: z.string().max(120).nullable().optional(),
}).strict();

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const jobs = await prisma.jobOpportunity.findMany({
      where: { userId: user.id, sourceType: "FIND_JOB" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(jobs);
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const body = input.parse(await profileJson(req));
    const metadata = {
      externalId: body.externalId,
      provider: body.provider,
      logoUrl: body.logoUrl?.startsWith("https://") ? body.logoUrl : null,
      publishedAt: body.publishedAt || null,
      eligibleCountries: body.eligibleCountries || [],
      remote: body.remote ?? null,
      contractType: body.contractType || null,
    };

    const existing = await prisma.jobOpportunity.findFirst({
      where: { userId: user.id, sourceUrl: body.sourceUrl },
    });
    if (existing) {
      // Preserve legacy analysis for already-saved jobs; do not overwrite
      // their associated application or candidate-generated annotations.
      return NextResponse.json(existing);
    }

    const saved = await prisma.jobOpportunity.create({
      data: {
        userId: user.id,
        title: body.title,
        company: body.company,
        location: body.location,
        description: body.description,
        requiredSkills: body.skills,
        sourceUrl: body.sourceUrl,
        sourceType: "FIND_JOB",
        sourceName: body.provider,
        originalText: body.description,
        analysis: metadata,
      },
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new ProfileError(400, "VALIDATION");
    const result = await prisma.jobOpportunity.deleteMany({
      where: { id, userId: user.id, sourceType: "FIND_JOB" },
    });
    return result.count
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch (error) {
    return profileErrorResponse(error);
  }
}
