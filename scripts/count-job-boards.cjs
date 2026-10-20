require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([
  prisma.jobBoard.groupBy({ by: ['provider', 'status'], _count: true }),
  prisma.externalJob.groupBy({ by: ['provider'], where: { active: true }, _count: true }),
  prisma.jobBoard.findMany({ select: { provider: true, slug: true, status: true, lastError: true }, take: 20 }),
]).then(([boards, jobs, details]) => process.stdout.write(JSON.stringify({ boards, jobs, details }, null, 2) + '\n'))
  .catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
