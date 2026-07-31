import prisma from "../../prisma/prisma";
import { verifyPassword } from "@/lib/password";

// Import an old password only after its owner has successfully verified it.
export async function prepareLegacyCredential(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { Account: true },
  });
  if (!user || user.Account.some(account => account.providerId === "credential")) return;

  const legacyPassword = user.password || user.Account.find(account => account.providerId === "credentials")?.password;
  if (!legacyPassword || !(await verifyPassword({ hash: legacyPassword, password }))) return;

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
    create: { userId: user.id, providerId: "credential", accountId: user.id, password: legacyPassword },
    update: {},
  });
}
