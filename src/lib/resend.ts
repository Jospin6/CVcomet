import { Resend } from "resend";

export async function sendVerificationEmail(email: string, code: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("Email delivery is not configured");
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Verify your CVcomet email",
    text: `Your CVcomet verification code is ${code}.`,
  });
  if (error) throw new Error("Unable to send verification email");
}
