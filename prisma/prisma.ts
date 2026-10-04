// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // A global var declaration is required to augment globalThis for the development singleton.
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export default prisma;
