import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** These codes are for CVComet's legacy email verification endpoints, not Better Auth tokens. */
export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;

export function normalizeVerificationEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isValidVerificationCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export function generateVerificationCode(): string {
  return randomInt(0, 10 ** VERIFICATION_CODE_LENGTH).toString().padStart(VERIFICATION_CODE_LENGTH, "0");
}

export function getVerificationSecret(): string {
  const secret = process.env.EMAIL_VERIFICATION_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Set EMAIL_VERIFICATION_SECRET (at least 32 characters) or a strong BETTER_AUTH_SECRET");
  }
  return secret;
}

/** HMAC protects the six-digit code against offline dictionary attacks after a DB-only compromise. */
export function hashVerificationCode(email: string, code: string): string {
  return createHmac("sha256", getVerificationSecret())
    .update(`cvcomet:email-verify:v1:${email}:${code}`)
    .digest("hex");
}

export function matchesVerificationCode(expectedHash: string, email: string, code: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  if (!isValidVerificationCode(code)) return false;
  const actualHash = hashVerificationCode(email, code);
  return timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(actualHash, "hex"));
}
