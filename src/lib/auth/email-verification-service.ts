import prisma from "../../../prisma/prisma";
import { sendVerificationEmail } from "@/lib/resend";
import {
  generateVerificationCode,
  getVerificationSecret,
  hashVerificationCode,
  matchesVerificationCode,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_MAX_ATTEMPTS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "./email-verification-code";

/**
 * Issues the same generic response for unknown, verified and temporarily throttled addresses.
 * This prevents account enumeration and uses a conditional DB write to enforce per-address cooldown.
 * An edge/IP rate limiter is still required against large-scale abuse across many email addresses.
 */
export async function requestEmailVerification(email: string): Promise<void> {
  // Configuration checks must run before looking up the address, to avoid account enumeration.
  getVerificationSecret();
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("Email delivery is not configured");
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user || user.emailVerified) return;

  const now = new Date();
  const code = generateVerificationCode();
  const hash = hashVerificationCode(user.email, code);
  const claimed = await prisma.user.updateMany({
    where: {
      id: user.id,
      emailVerified: false,
      OR: [
        { verificationCodeSentAt: null },
        { verificationCodeSentAt: { lte: new Date(now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS) } },
      ],
    },
    data: {
      verificationCode: hash,
      verificationCodeSentAt: now,
      verificationCodeExpiresAt: new Date(now.getTime() + VERIFICATION_CODE_TTL_MS),
      verificationCodeAttempts: 0,
    },
  });
  if (claimed.count !== 1) return;

  try {
    await sendVerificationEmail(user.email, code);
  } catch (error) {
    // Do not leak whether an email address belongs to an account through response differences.
    // Keep the cooldown to avoid a failing email provider being repeatedly invoked.
    console.error("email-verification: email delivery failed", error instanceof Error ? error.name : "unknown");
  }
}

/** An atomic attempt claim prevents concurrent requests from bypassing the five-attempt limit. */
export async function confirmEmailVerification(email: string, code: string): Promise<boolean> {
  getVerificationSecret();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true, verificationCode: true },
  });
  if (!user || user.emailVerified || !user.verificationCode) return false;

  const attempt = await prisma.user.updateMany({
    where: {
      id: user.id,
      emailVerified: false,
      verificationCode: user.verificationCode,
      verificationCodeExpiresAt: { gt: new Date() },
      verificationCodeAttempts: { lt: VERIFICATION_MAX_ATTEMPTS },
    },
    data: { verificationCodeAttempts: { increment: 1 } },
  });
  if (attempt.count !== 1) return false;
  if (!matchesVerificationCode(user.verificationCode, user.email, code)) return false;

  const accepted = await prisma.user.updateMany({
    where: {
      id: user.id,
      emailVerified: false,
      verificationCode: user.verificationCode,
      verificationCodeExpiresAt: { gt: new Date() },
    },
    data: {
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationCodeAttempts: 0,
    },
  });
  return accepted.count === 1;
}
