import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";

export async function POST(request: Request) {
  const { email, code } = await request.json();

  // 1. Trouver l'utilisateur
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json(
      { error: "Email non trouvé" },
      { status: 404 }
    );
  }

  // 2. Vérifier si le code correspond
  if (!user.verificationCode || typeof code !== "string" || user.verificationCode !== code) {
    return NextResponse.json(
      { error: "Code invalide" },
      { status: 400 }
    );
  }

  // 3. Marquer l'email comme vérifié
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true, verificationCode: null },
  });

  return NextResponse.json({ success: true });
}
