// Read-only schema smoke check. Never creates test accounts or documents.
require('@next/env').loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const nonexistentId = '00000000-0000-4000-8000-000000000000';
(async () => {
  await db.$transaction([
    db.jobOpportunity.findFirst({ where: { id: nonexistentId }, select: { sourceType: true, sourceName: true, originalText: true, analysis: true, documentDrafts: true } }),
    db.jobMatch.findFirst({ where: { id: nonexistentId }, select: { overallScore: true, fingerprint: true, result: true, tailoring: true, tailoredCv: { select: { id: true } } } }),
  ]);
  console.log('Job analyzer database columns and resume relation are readable. No records were written.');
})().catch(error => {
  console.error('Job analyzer database check failed:', error.code || error.name);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
