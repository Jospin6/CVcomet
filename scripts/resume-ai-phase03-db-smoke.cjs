/* Read-only staging check. Requires installed dependencies, migrations, and a real test database. */
if (process.env.ALLOW_RESUME_AI_DB_TEST !== '1') {
  console.error('Refusing to run without ALLOW_RESUME_AI_DB_TEST=1');
  process.exit(2);
}
const url = process.env.CVCOMET_RESUME_AI_TEST_DATABASE_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url) || !/(stage|staging|test)/i.test(new URL(url).pathname)) {
  console.error('Provide CVCOMET_RESUME_AI_TEST_DATABASE_URL for a staging/test-only database');
  process.exit(2);
}
process.env.DATABASE_URL = url;
process.env.DATABASE_URL_UNPOOLED = url;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({datasources:{db:{url}}});
(async () => {
  const present = await prisma.$queryRaw`SELECT to_regclass('public."ResumeAIProposal"')::text AS relation`;
  if (!present[0]?.relation) throw Error('PHASE03_MIGRATION_MISSING');
  const [proposals, facts] = await Promise.all([
    prisma.resumeAIProposal.findMany({take:1, select:{id:true,cvId:true,userId:true,status:true,baseRevision:true}}),
    prisma.careerEvidence.findMany({take:1,select:{id:true,userId:true,status:true,revision:true}}),
  ]);
  console.info(JSON.stringify({ok:true, tested:'read-only Prisma schema and table resolution', retrieved:{proposalRows:proposals.length,evidenceRows:facts.length}}));
})().catch(error=>{console.error('phase03 staging smoke failed',error?.name||'UnknownError');process.exitCode=1})
  .finally(()=>prisma.$disconnect());
