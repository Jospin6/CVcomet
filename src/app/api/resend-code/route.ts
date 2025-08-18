// app/api/resend-code/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { Resend } from "resend";
import { generateVerifyCode } from "@/lib/utils";
import { EmailTemplate } from "@/components/email-template";
import { sendVerificationEmail } from "@/lib/resend";

// Instancie ton client Resend (ou Nodemailer si tu préfères)
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { message: "Email requis" },
        { status: 400 }
      );
    }

    // Vérifie si l'utilisateur existe
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { message: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Génère un nouveau code
    const verifyCode = generateVerifyCode();

    // Mets à jour l'utilisateur avec le nouveau code
    await prisma.user.update({
      where: { email },
      data: { verificationCode: verifyCode },
    });

    // Envoie l'email avec Resend
    await sendVerificationEmail(email, verifyCode);

    return NextResponse.json({ message: "Code renvoyé avec succès" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur serveur" },
      { status: 500 }
    );
  }
}
