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
test('every evidence route gets current actor from trusted session and blocks cross-origin mutations', () => {
  for (const p of ['src/app/api/career/v1/evidence/route.ts','src/app/api/career/v1/evidence/[id]/route.ts',
    'src/app/api/career/v1/evidence/import-profile/route.ts']) {
    const code = read(p);
    assert.match(code, /getSessionUser\(\)/);
    assert.match(code, /withCareerHttp\(/);
    assert.match(code, /assertTrustedWriteOrigin\(req\)/);
    assert.match(code, /profileJson\(req, (?:4 \* 1024|1024)\)/);
    assert.doesNotMatch(code, /(?:body|query|input)\.(?:userId|ownerId)/);
  }
});
test('all reads and writes enforce userId in DB predicates with CAS updates', () => {
  const s = read('src/lib/career-evidence/service.ts');
  assert.match(s, /where: \{ userId, status: "CONFIRMED" \}/);
  assert.match(s, /where: \{ id, userId, revision: input\.revision, status: current\.status \}/);
  assert.match(s, /deleteMany\(\{ where: \{ userId, id, revision \} \}\)/);
  assert.match(s, /where: \{ id, userId \}/);
  assert.match(s, /source: "MANUAL", sourceKey: null/);
  assert.match(s, /source: "PROFILE_IMPORT"/);
  assert.match(s, /status: "DRAFT"/);
  assert.doesNotMatch(s, /\$executeRawUnsafe|\$queryRawUnsafe/);
});
test('agent tool exposes confirmed-only facts, while previous tools stay available', () => {
  const contract = read('src/lib/career-os/contracts.ts');
  const registry = read('src/lib/career-os/tool-registry.ts');
  assert.match(contract, /"list_my_confirmed_evidence"/);
  assert.match(registry, /listConfirmedEvidenceForAgent\(actor\.id, limit\)/);
  assert.match(registry, /get_my_profile/);
  assert.match(registry, /list_my_applications/);
  assert.doesNotMatch(registry, /prisma\.careerEvidence\.findMany/);
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
test('UI is reachable through navigation, supports explicit approvals and translations', () => {
  const nav = read('src/components/shell/navigation.ts');
  const ui = read('src/components/career-evidence/evidence-vault-page.tsx');
  assert.match(nav, /dashboard\/evidence/);
  for (const action of ['confirm', 'reject', 'revoke', 'DELETE', 'import-profile']) assert.ok(ui.includes(action));
  for (const language of ['en','fr']) {
    const t = JSON.parse(read(`public/locales/${language}/common.json`));
    assert.ok(t.shell.evidenceVault);
    assert.ok(t.evidence.privacy);
  }
});
