require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.jobBoard.updateMany({ where: { status: 'TEMPORARILY_UNAVAILABLE' }, data: { nextCheckAt: new Date(0) } })
  .then(result => process.stdout.write(`Queued ${result.count} boards for retry.\n`))
  .catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
