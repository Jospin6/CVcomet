import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { sendVerificationEmail } from "@/lib/resend";

export async function POST(request: Request) {
  const { email } = await request.json();

  // 1. Vérifier si l'utilisateur existe déjà
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json(
      { error: "Email non trouvé" },
      { status: 404 }
    );
  }

  // 2. Générer un code aléatoire (6 chiffres)
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // 3. Mettre à jour l'utilisateur avec le code
  await prisma.user.update({
    where: { email },
    data: { verificationCode },
  });

  // 4. Envoyer l'email
  await sendVerificationEmail(email, verificationCode);

  return NextResponse.json({ success: true });
}