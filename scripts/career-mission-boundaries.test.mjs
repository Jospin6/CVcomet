import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const root = 'src/app/api/career/v1/missions';

test('mission schema has foreign-key cascades, unique replay keys and durable approval audit', () => {
  const schema=read('prisma/schema.prisma'), sql=read('prisma/migrations/20261024230000_career_missions/migration.sql');
  for (const model of ['CareerMission','CareerMissionRun','CareerMissionApproval']) {
    assert.match(schema,new RegExp(`model ${model} \\{`));
    assert.ok(sql.includes(`CREATE TABLE "${model}"`));
  }
  assert.ok(schema.includes('@@unique([missionId, requestKey])'));
  assert.ok(schema.includes('activeRunId String?'));
  assert.ok(schema.includes('leaseToken  String'));
  assert.ok(sql.includes('ON DELETE CASCADE'));
  assert.ok(schema.includes('careerMissions CareerMission[]'));
});
test('all mission mutations require server-side session, same-origin guard and strict payloads', () => {
  for (const route of [`${root}/route.ts`,`${root}/[id]/route.ts`,`${root}/[id]/runs/route.ts`,`${root}/[id]/approvals/[approvalId]/route.ts`]) {
    const text=read(route);
    assert.ok(text.includes('getSessionUser()'),route);
    assert.ok(text.includes('assertTrustedWriteOrigin(req)'),route);
    assert.ok(text.includes('withCareerHttp('),route);
    assert.ok(text.includes('.strict()'),route);
    assert.ok(!text.includes('userId: body.userId'),route);
  }
});
test('agent remains read-only, preserving quotas and using bounded untrusted history', () => {
  const source=read('src/lib/career-os/agent-service.ts');
  assert.ok(source.includes('conversationHistory: history'));
  assert.ok(source.includes('prior conversation turns'));
  assert.equal(source.match(/reserveProfileAI\(actor.id, "CAREER_ASSISTANT"\)/g)?.length,2);
  assert.ok(!source.includes('submit_application('));
});
test('mission service gates every lookup on actor identity and uses CAS locks for durable runs', () => {
  const source=read('src/lib/career-os/mission-service.ts');
  for (const marker of ['where: { id: missionId, userId: actor.id }','status: "COMPLETED"',
    'leaseToken: claim.leaseToken','activeRunId: null', 'requestKey', 'MISSION_INTERRUPTED',
    'assertSameMissionRequest', 'digestAction(action, payload)', 'mission: { userId: actor.id, status: "ACTIVE" }',
    'actionExecuted: false', 'status: "APPROVED"', 'status: "CONSUMED"'])
    assert.ok(source.includes(marker),marker);
  assert.ok(!source.includes('deleteMany({ where: {}'));
  assert.ok(!source.includes('toolResults:'));
});
test('user-only approval decision never creates an arbitrary permission or calls a write tool', () => {
  const route=read(`${root}/[id]/approvals/[approvalId]/route.ts`);
  assert.ok(route.includes('decideCareerApproval'));
  assert.ok(!route.includes('proposeCareerApproval'));
  assert.ok(!route.includes('consumeCareerApproval'));
  assert.ok(!route.includes('send_application_email'));
});
test('dashboard opts in to persistence and supports resume, archive and deletion', () => {
  const ui=read('src/app/dashboard/assistant/page.tsx');
  for (const marker of ['/api/career/v1/missions', 'requestKey', 'crypto.randomUUID()',
    'Conversation temporaire', 'Créer une mission', 'archive', 'restore', 'delete', 'Réessayer avec le même identifiant',
    'decideApproval', 'actionExecuted']) {
    if(marker==='actionExecuted') assert.ok(!ui.includes(marker));
    else assert.ok(ui.includes(marker),marker);
  }
  assert.ok(ui.includes('/api/assistant')); // stateless fallback explicitly maintained
});
