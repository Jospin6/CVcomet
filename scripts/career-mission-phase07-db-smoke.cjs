/** Optional destructive staging smoke test. NEVER run against production. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
if (process.env.ALLOW_MISSION_DB_TEST !== '1' || !process.env.CVCOMET_MISSION_TEST_DATABASE_URL) {
  console.error('Refusing DB test: set ALLOW_MISSION_DB_TEST=1 and CVCOMET_MISSION_TEST_DATABASE_URL (disposable PostgreSQL).');
  process.exit(2);
}
if (!/^postgres(?:ql)?:\/\//.test(process.env.CVCOMET_MISSION_TEST_DATABASE_URL)) process.exit(2);
process.env.DATABASE_URL = process.env.CVCOMET_MISSION_TEST_DATABASE_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.CVCOMET_MISSION_TEST_DATABASE_URL;
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const ids = [randomUUID(), randomUUID()];
async function main() {
  const token = randomUUID().replace(/-/g, '');
  try {
    await db.user.createMany({ data: ids.map((id,i) => ({id,email:`mission-smoke-${i}-${token}@example.invalid`})) });
    const mission = await db.careerMission.create({data:{userId:ids[0],title:'Smoke mission'}});
    assert.equal(await db.careerMission.count({where:{id:mission.id,userId:ids[1]}}),0);
    const key=randomUUID(), leaseToken=randomUUID();
    const run=await db.careerMissionRun.create({data:{missionId:mission.id,userId:ids[0],requestKey:key,
      question:'Review my resume',leaseToken,leaseUntil:new Date(Date.now()+60000)}});
    assert.equal((await db.careerMission.updateMany({where:{id:mission.id,userId:ids[0],activeRunId:null},data:{activeRunId:run.id}})).count,1);
    assert.equal((await db.careerMission.updateMany({where:{id:mission.id,userId:ids[1],activeRunId:run.id},data:{activeRunId:null}})).count,0);
    assert.equal((await db.careerMissionRun.updateMany({where:{id:run.id,userId:ids[1],leaseToken},data:{status:'COMPLETED'}})).count,0);
    assert.equal((await db.careerMissionRun.updateMany({where:{id:run.id,userId:ids[0],leaseToken,status:'RUNNING'},data:{status:'COMPLETED',answer:'Ready'}})).count,1);
    assert.equal((await db.careerMissionRun.updateMany({where:{id:run.id,userId:ids[0],leaseToken,status:'RUNNING'},data:{status:'COMPLETED'}})).count,0);
    const approval=await db.careerMissionApproval.create({data:{missionId:mission.id,userId:ids[0], action:'DRAFT_RESUME_CHANGES', payloadHash:'a'.repeat(64),summary:'Review a suggested change',expiresAt:new Date(Date.now()+60000)}});
    assert.equal((await db.careerMissionApproval.updateMany({where:{id:approval.id,userId:ids[1],status:'PENDING'},data:{status:'APPROVED'}})).count,0);
    assert.equal((await db.careerMissionApproval.updateMany({where:{id:approval.id,userId:ids[0],status:'PENDING'},data:{status:'APPROVED'}})).count,1);
    assert.equal((await db.careerMissionApproval.updateMany({where:{id:approval.id,userId:ids[0],status:'PENDING'},data:{status:'REJECTED'}})).count,0);
    await db.careerMission.delete({where:{id:mission.id}});
    assert.equal(await db.careerMissionRun.count({where:{missionId:mission.id}}),0);
    assert.equal(await db.careerMissionApproval.count({where:{missionId:mission.id}}),0);
    console.log('Phase07 staging DB smoke OK: ownership, locking, replay CAS, approval CAS, cascade');
  } finally {
    await db.user.deleteMany({where:{id:{in:ids}}});
    await db.$disconnect();
  }
}
main().catch(e => {console.error('Mission staging DB smoke FAILED:',e?.name||'Error');process.exitCode=1});
