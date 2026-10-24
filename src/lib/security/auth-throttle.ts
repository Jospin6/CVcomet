import { createHmac } from "node:crypto";
import prisma from "../../../prisma/prisma";
import { ProfileError } from "@/lib/career-profile/http";

export type AuthThrottleAction = "LOGIN" | "SIGNUP" | "EMAIL_RESEND" | "EMAIL_CONFIRM" | "AUTH_PROVIDER";

export const AUTH_THROTTLE_RULES: Record<AuthThrottleAction, { max: number; windowMs: number }> = {
  LOGIN: { max: 10, windowMs: 15 * 60_000 },
  SIGNUP: { max: 5, windowMs: 60 * 60_000 },
  EMAIL_RESEND: { max: 6, windowMs: 60 * 60_000 },
  EMAIL_CONFIRM: { max: 12, windowMs: 15 * 60_000 },
  AUTH_PROVIDER: { max: 12, windowMs: 15 * 60_000 },
};

// No email or IP address is stored in the throttle table.
export function throttleIdentifier(secret: string, action: AuthThrottleAction, kind: "email" | "ip", value: string) {
  return createHmac("sha256", secret).update(`${action}:${kind}:${value.trim().toLowerCase()}`).digest("hex");
}

function trustedClientIp(request: Request) {
  // Only turn this on when your reverse proxy strips externally supplied X-Real-IP.
  return process.env.CVCOMET_TRUST_PROXY_IP_HEADERS === "true"
    ? request.headers.get("x-real-ip")?.trim().slice(0, 64) || null : null;
}

export async function enforceAuthThrottle(request: Request, action: AuthThrottleAction, email?: string | null) {
  const secret = process.env.AUTH_THROTTLE_HASH_SECRET || process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 24) throw new ProfileError(503, "AUTH_THROTTLE_UNAVAILABLE");
  const rule = AUTH_THROTTLE_RULES[action];
  const identifiers: Array<{ kind: "email" | "ip"; value: string }> = [];
  const ip = trustedClientIp(request);
  if (ip) identifiers.push({ kind: "ip", value: ip });
  if (email && email.trim()) identifiers.push({ kind: "email", value: email });
  // Unknown identity can only be throttled at the trusted edge. Do not use a
  // shared anonymous key here: that would let one attacker block every user.
  if (!identifiers.length) return;
  for (const { kind, value } of identifiers) {
    const now = new Date();
    const key = throttleIdentifier(secret, action, kind, value);
    await prisma.authThrottleWindow.upsert({
      where: { key },
      create: { key, attempts: 0, resetsAt: new Date(now.getTime() + rule.windowMs) },
      update: {},
    });
    await prisma.authThrottleWindow.updateMany({
      where: { key, resetsAt: { lte: now } },
      data: { attempts: 0, resetsAt: new Date(now.getTime() + rule.windowMs) },
    });
    const allowed = await prisma.authThrottleWindow.updateMany({
      where: { key, attempts: { lt: rule.max } },
      data: { attempts: { increment: 1 } },
    });
    if (allowed.count !== 1) throw new ProfileError(429, "AUTH_RATE_LIMIT");
  }
}
