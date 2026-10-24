/* Read-only staging contract check. Never defaults to a production database. */
if (process.env.ALLOW_COVER_LETTER_AI_DB_TEST !== '1') {
  console.error('Set ALLOW_COVER_LETTER_AI_DB_TEST=1 to opt into staging-only smoke test'); process.exit(2);
}
const url = process.env.CVCOMET_COVER_LETTER_AI_TEST_DATABASE_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url) || !/(stage|staging|test)/i.test(new URL(url).pathname)) {
  console.error('Provide a staging/test-only CVCOMET_COVER_LETTER_AI_TEST_DATABASE_URL'); process.exit(2);
}
process.env.DATABASE_URL = url;
process.env.DATABASE_URL_UNPOOLED = url;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({datasources:{db:{url}}});
(async () => {
  const found = await prisma.$queryRaw`SELECT to_regclass('public."CoverLetterAIProposal"')::text AS relation`;
  if (!found[0]?.relation) throw Error('PHASE04_MIGRATION_MISSING');
  const [proposals, evidence] = await Promise.all([
    prisma.coverLetterAIProposal.findMany({ take: 1, select: {id:true,userId:true,letterId:true,status:true,baseRevision:true} }),
    prisma.careerEvidence.findMany({take: 1, select: {id:true,userId:true,status:true,revision:true}}),
  ]);
  console.info(JSON.stringify({ok:true, readOnly:true, proposalRows:proposals.length, evidenceRows:evidence.length}));
})().catch(e => {console.error('staging smoke failed',e?.name||'Unknown'); process.exitCode=1})
.finally(()=>prisma.$disconnect());
