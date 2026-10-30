import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path,'utf8');

test('data has explicit provenance, owner cascade, unique profile origin, indexes and confirmed timestamp', () => {
  const schema = read('prisma/schema.prisma');
  const sql = read('prisma/migrations/20261024170000_career_evidence_vault/migration.sql');
  assert.match(schema, /model CareerEvidence \{/);
  assert.match(schema, /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(schema, /@@unique\(\[userId, sourceKey\]\)/);
  assert.match(sql, /"CareerEvidence_confirmed_timestamp"/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /CREATE UNIQUE INDEX/);
});
test('legacy vault routes are authenticated but retired and cannot accept new writes', () => {
  for (const path of [
    'src/app/api/career/v1/evidence/route.ts',
    'src/app/api/career/v1/evidence/[id]/route.ts',
    'src/app/api/career/v1/evidence/import-profile/route.ts',
  ]) {
    const route = read(path);
    assert.match(route, /getSessionUser\(\)/);
    assert.match(route, /assertTrustedWriteOrigin\(req\)/);
    assert.match(route, /FEATURE_RETIRED_USE_CAREER_PROFILE/);
    assert.match(route, /410/);
    assert.doesNotMatch(route, /createEvidence|importProfileEvidence|transitionEvidence|deleteEvidence/);
  }
});
test('historical vault data and proposal safety checks remain intact, but the agent reads the profile', () => {
  const registry = read('src/lib/career-os/tool-registry.ts');
  const contract = read('src/lib/career-os/contracts.ts');
  assert.match(registry, /getCareerProfile\(actor\.id\)/);
  assert.doesNotMatch(registry, /listConfirmedEvidenceForAgent|prisma\.careerEvidence/);
  assert.doesNotMatch(contract, /list_my_confirmed_evidence/);
  for (const file of ['src/lib/cover-letter-ai/proposal-service.ts','src/lib/resume-ai/proposal-service.ts']) {
    const service = read(file);
    assert.match(service,/evidenceRevisions/);
    assert.match(service,/EVIDENCE_CHANGED/);
  }
});

test('strict schemas forbid user-provided source or status and bound string lengths', () => {
  const s = read('src/lib/career-evidence/schema.ts');
  assert.match(s, /newEvidenceSchema = z\.object/);
  assert.match(s, /evidenceEditSchema = z\.object/);
  assert.match(s, /\.max\(1600\)/);
  assert.match(s, /\.max\(50\)/);
  assert.match(s, /\.strict\(\)/);
  const create = s.slice(s.indexOf('newEvidenceSchema'),s.indexOf('evidenceEditSchema'));
  assert.doesNotMatch(create, /status:|source:|userId:/);
});
test('vault is absent from navigation and old bookmarks redirect to the profile', () => {
  const navigation = read('src/components/shell/navigation.ts');
  const redirect = read('src/app/dashboard/evidence/page.tsx');
  const agent = read('src/app/dashboard/assistant/page.tsx');
  assert.doesNotMatch(navigation, /dashboard\/evidence/);
  assert.match(redirect, /redirect\("\/dashboard\/profile"\)/);
  assert.doesNotMatch(agent, /dashboard\/evidence/);
});
