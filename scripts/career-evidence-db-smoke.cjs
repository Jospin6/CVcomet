/** Isolated STAGING database smoke test. NEVER run against production. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
if (process.env.ALLOW_EVIDENCE_DB_TEST !== '1' || !process.env.CVCOMET_EVIDENCE_TEST_DATABASE_URL) {
  console.error('Refusing DB test. Set ALLOW_EVIDENCE_DB_TEST=1 and CVCOMET_EVIDENCE_TEST_DATABASE_URL to a disposable staging DB.');
  process.exit(2);
}
if (!/^(?:postgresql|postgres):\/\//.test(process.env.CVCOMET_EVIDENCE_TEST_DATABASE_URL)) {
  console.error('Invalid staging database URL');
  process.exit(2);
}
process.env.DATABASE_URL = process.env.CVCOMET_EVIDENCE_TEST_DATABASE_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.CVCOMET_EVIDENCE_TEST_DATABASE_URL;
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const ids = [randomUUID(), randomUUID()];

async function main() {
  const token = randomUUID().replace(/-/g,'');
  try {
    await db.user.createMany({ data: ids.map((id,index) => ({ id, email: `evidence-stage-${index}-${token}@example.invalid` })) });
    const a = await db.careerEvidence.create({ data: { userId: ids[0], kind:'SKILL', statement:'Go', source:'MANUAL' } });
    assert.equal(a.status, 'DRAFT');
    assert.equal((await db.careerEvidence.count({ where: {userId:ids[1], id:a.id} })), 0);
    const foreign = await db.careerEvidence.updateMany({ where: {id:a.id,userId:ids[1],revision:0}, data:{status:'CONFIRMED',confirmedAt:new Date()} });
    assert.equal(foreign.count, 0);
    const approved = await db.careerEvidence.updateMany({ where: {id:a.id,userId:ids[0],revision:0,status:'DRAFT'},
      data:{status:'CONFIRMED',confirmedAt:new Date(),revision:{increment:1}} });
    assert.equal(approved.count,1);
    const stale = await db.careerEvidence.updateMany({ where: {id:a.id,userId:ids[0],revision:0}, data:{statement:'Stale'} });
    assert.equal(stale.count,0);
    assert.equal((await db.careerEvidence.count({where:{userId:ids[0],status:'CONFIRMED'}})),1);
    const revoked = await db.careerEvidence.updateMany({ where: {id:a.id,userId:ids[0],revision:1,status:'CONFIRMED'},
      data:{status:'REVOKED',revokedAt:new Date(),revision:{increment:1}} });
    assert.equal(revoked.count,1);
    assert.equal((await db.careerEvidence.count({where:{userId:ids[0],status:'CONFIRMED'}})),0);
    const source = `profile:skill:${token}`;
    const rows = { userId:ids[0],kind:'SKILL',statement:'TypeScript',source:'PROFILE_IMPORT',status:'DRAFT',sourceKey:source };
    assert.equal((await db.careerEvidence.createMany({data:[rows],skipDuplicates:true})).count,1);
    assert.equal((await db.careerEvidence.createMany({data:[rows],skipDuplicates:true})).count,0);
    console.log('Career evidence DB staging smoke: OK (ownership, optimistic version, confirmation, revoke, dedup)');
  } finally {
    await db.careerEvidence.deleteMany({where:{userId:{in:ids}}});
    await db.user.deleteMany({where:{id:{in:ids}}});
    await db.$disconnect();
  }
}
main().catch(error => { console.error('Career evidence staging DB smoke failed', error?.name || 'Error'); process.exitCode = 1; });
