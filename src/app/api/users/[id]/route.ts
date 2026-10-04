import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { profileDataSchema } from "@/lib/career-profile/schema";
import { profileJson, profileErrorResponse } from "@/lib/career-profile/http";
import { canAccessUser, getSessionUser, sanitizeUser } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  if (!canAccessUser(session, id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      Experience: true,
      Education: true,
      Project: true,
      certifications: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json(sanitizeUser(user));
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  if (!canAccessUser(session, id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = profileDataSchema.pick({ name: true, email: true, phone: true, languages: true, address: true, linkedin: true, portfolio: true, github: true, skills: true }).partial().parse(await profileJson(req));
  } catch (error) { return profileErrorResponse(error); }
  const {
    name,
    email,
    phone,
    languages,
    address,
    linkedin,
    portfolio,
    github,
    skills,
  } = body;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        profileRevision: { increment: 1 },
        name,
        phone,
        address,
        languages,
        github,
        email,
        linkedin,
        portfolio,
        skills,
      },
    });

    return NextResponse.json(sanitizeUser(updatedUser), { status: 200 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ message: "Email already exists" }, { status: 409 });
    }

    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  if (!canAccessUser(session, id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.message.deleteMany({
      where: {
        conversation: {
          userId: id,
        },
      },
    }),
    prisma.cv.deleteMany({
      where: {
        conversation: {
          userId: id,
        },
      },
    }),
    prisma.coverLetter.deleteMany({
      where: {
        conversation: {
          userId: id,
        },
      },
    }),
    prisma.conversation.deleteMany({ where: { userId: id } }),
    prisma.experience.deleteMany({ where: { userId: id } }),
    prisma.education.deleteMany({ where: { userId: id } }),
    prisma.project.deleteMany({ where: { userId: id } }),
    prisma.certification.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ message: "User deleted" }, { status: 200 });
}
