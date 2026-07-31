import bcrypt from "bcryptjs";
import { hashPassword as hashBetterAuthPassword, verifyPassword as verifyBetterAuthPassword } from "better-auth/crypto";

export const hashPassword = hashBetterAuthPassword;

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  if (/^\$2[aby]\$/.test(hash)) {
    return bcrypt.compare(password, hash);
  }
  return verifyBetterAuthPassword({ hash, password });
}
