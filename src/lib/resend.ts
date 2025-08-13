import { Resend } from "resend";
import { EmailTemplate } from "@/components/email-template";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, token: string) {
  await resend.emails.send({
    from: "no-reply@votredomaine.com",
    to: email,
    subject: "Confirmez votre email",
    react: EmailTemplate({ token }),
  });
}