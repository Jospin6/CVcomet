import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const certification = await prisma.certification.findUnique({
    where: { id },
  });

  if (!certification) {
    return NextResponse.json({ message: "Certification not found" }, { status: 404 });
  }

  if (!canAccessUser(session, certification.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(certification);
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();
  const { name, organization, date, userId, description } = await req.json();

  const certification = await prisma.certification.findUnique({
    where: { id },
  });

  if (!certification) {
    return NextResponse.json({ message: "Certification not found" }, { status: 404 });
  }

  if (!canAccessUser(session, certification.userId) || !canAccessUser(session, userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const updatedCertification = await prisma.certification.update({
    where: { id },
    data: { name, organization, date, userId, description },
  });

  return NextResponse.json(updatedCertification);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const certification = await prisma.certification.findUnique({
    where: { id },
  });

  if (!certification) {
    return NextResponse.json({ message: "Certification not found" }, { status: 404 });
  }

  if (!canAccessUser(session, certification.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.certification.delete({ where: { id } });
  return NextResponse.json({ message: "Certification deleted" });
}
