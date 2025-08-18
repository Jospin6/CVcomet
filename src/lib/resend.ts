import { Resend } from "resend";
import { EmailTemplate } from "@/components/email-template";

const resend = new Resend(process.env.RESEND_API_KEY);


export async function sendVerificationEmail(email: string, code: string) {
  await resend.emails.send({
    from: "no-reply@cvcomet.com",
    to: email,
    subject: "Confirmez votre email",
    react: EmailTemplate({ code }),
  });
}