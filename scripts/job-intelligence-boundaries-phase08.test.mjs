import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('persisted analysis extends legacy version 1 without destructively changing scores or fingerprinting', () => {
  const match = read('src/lib/career/job-match.ts');
  assert.match(match, /const baseline: MatchResult = \{ version: 1/);
  assert.match(match, /intelligence: buildJobIntelligence\(job, baseline\)/);
  const route = read('src/app/api/job-match/route.ts');
  assert.match(route, /where: \{ id, userId: user\.id \}/);
  assert.match(route, /where: \{ fingerprint \}/);
  assert.match(route, /result: result as unknown as Prisma\.InputJsonValue/);
});

test('saved match agent tool is explicitly owner-scoped, read-only, and has input allowlist', () => {
  const registry = read('src/lib/career-os/tool-registry.ts');
  const contracts = read('src/lib/career-os/contracts.ts');
  const policy = read('src/lib/career-os/policy.ts');
  assert.match(registry, /matchById = z\.object\(\{ matchId: z\.string\(\)\.uuid\(\) \}\)\.strict\(\)/);
  assert.match(registry, /where: \{ id: matchId, userId: actor\.id \}/);
  assert.match(registry, /isReadableMatchSnapshot\(raw\)/);
  assert.match(contracts, /get_my_job_match_insights[\s\S]*effect: "read", available: true/);
  assert.match(policy, /actor\.id !== ownerId/);
  assert.doesNotMatch(registry, /sendMail\(|submitApplication\(/);
});

test('dashboard keeps existing approval-based editing workflow and renders action evidence', () => {
  const screen = read('src/app/dashboard/job-match/page.tsx');
  const panel = read('src/components/career/job-intelligence-panel.tsx');
  assert.match(screen, /JobIntelligencePanel intelligence=/);
  assert.match(screen, /buildJobIntelligence\(analysis, match/);
  assert.match(screen, /action: "ACCEPT", matchId: result\.id/);
  assert.match(panel, /action\.postingQuote/);
  assert.match(panel, /action\.candidateSources/);
  assert.match(panel, /role="note"/);
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML/);
});

test('agent sees only concise recommendations and never full CV or job description', () => {
  const registry = read('src/lib/career-os/tool-registry.ts');
  const beginning = registry.indexOf('case "get_my_job_match_insights"');
  const end = registry.indexOf('case "list_my_applications"', beginning);
  const branch = registry.slice(beginning, end);
  assert.ok(beginning > 0 && end > beginning);
  assert.match(branch, /nextActions: insights\.actions\.filter/);
  assert.match(branch, /\.slice\(0, 5\)/);
  assert.doesNotMatch(branch, /description: true|contact: true|email: true/);
  const agent = read('src/lib/career-os/agent-service.ts');
  assert.match(agent, /NEVER an ATS pass rate/);
  assert.match(agent, /Never guess a match ID/);
});
