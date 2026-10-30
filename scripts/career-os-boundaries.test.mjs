import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = file => readFileSync(file, 'utf8');

test('API read execution gets actor only from server session and has strict body cap', () => {
  const code = src('src/app/api/career/v1/tools/route.ts');
  assert.match(code, /getSessionUser\(\)/);
  assert.match(code, /assertTrustedWriteOrigin\(req\)/);
  assert.match(code, /profileJson\(req, 8 \* 1024\)/);
  assert.match(code, /toolRequestSchema\.parse/);
  assert.match(code, /executeCareerReadTool\(actor, body\.tool, body\.input\)/);
  assert.doesNotMatch(code, /body\.(?:userId|ownerId|approved|role)/);
});

test('each read tool is owner-filtered within the database query', () => {
  const code = src('src/lib/career-os/tool-registry.ts');
  assert.match(code, /conversation: \{ userId: actor\.id \}/);
  assert.match(code, /where: \{ id: resumeId, conversation: \{ userId: actor\.id \} \}/);
  assert.match(code, /where: \{ userId: actor\.id \}/);
  assert.match(code, /z\.object\(\{\}\)\.strict\(\)/);
  assert.match(code, /getCareerProfile\(actor\.id\)/);
  assert.doesNotMatch(code, /listConfirmedEvidenceForAgent|careerEvidence\.findMany/);
  assert.match(code, /\.max\(30\)/);
  assert.doesNotMatch(code, /prisma\.(?:user|account|session)\.findMany/);
});

test('envelope has stable data and redacted errors, with request correlation', () => {
  const code = src('src/lib/career-os/http.ts');
  assert.match(code, /careerEnvelope\(trace\.requestId, data\)/);
  assert.match(code, /"Cache-Control": "private, no-store"/);
  assert.match(code, /"X-CVComet-Request-ID"/);
  assert.match(code, /error: \{ code \}/);
  assert.doesNotMatch(code, /error\.message|error\.stack|JSON\.stringify\(error\)/);
});

test('planned side effect tools are not connected to any mutation adapter', () => {
  const policy = src('src/lib/career-os/policy.ts');
  const registry = src('src/lib/career-os/tool-registry.ts');
  assert.match(policy, /ACTION_NOT_ENABLED/);
  assert.doesNotMatch(registry, /prisma\.\w+\.(?:create|update|delete|upsert)\(/);
  assert.doesNotMatch(registry, /fetch\(/);
});

test('prior phase00 security regression tests remain configured', () => {
  const pkg = JSON.parse(src('package.json'));
  assert.match(pkg.scripts['test:cvcomet:baseline'], /test:phase00/);
  assert.match(pkg.scripts['test:cvcomet:baseline'], /test:phase01/);
});
