import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ProfileError } from "@/lib/career-profile/http";
import type { AIProviderId } from "./catalog";

export function canStoreAIKeys() {
  return Boolean(process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET);
}

function encryptionKey() {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new ProfileError(503, "AI_ENCRYPTION_UNAVAILABLE");
  return createHash("sha256").update("cvcomet:ai-keys:v1:" + secret).digest();
}

export function encryptAIKey(value: string, provider: AIProviderId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(provider));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptAIKey(value: string, provider: AIProviderId) {
  try {
    const [version, iv, tag, data, extra] = value.split(".");
    if (version !== "v1" || !iv || !tag || !data || extra) throw new Error("Invalid ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(provider));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch { throw new ProfileError(503, "AI_KEY_UNREADABLE"); }
}
