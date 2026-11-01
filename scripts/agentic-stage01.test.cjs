/** CVComet LangGraph migration: non-destructive step 01 baseline contracts.
 * These checks do not require network access, a database or installed AI SDKs.
 * They do NOT certify that any LangGraph workflow is operational.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const text = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const inventory = JSON.parse(text('docs/agentic/01_inventory.json'));
const packageJson = JSON.parse(text('package.json'));

test('the migration baseline is explicit and versioned', () => {
  assert.equal(inventory.baselineArchive, 'cvcomet(3).zip');
  assert.match(inventory.baselineSha256, /^[a-f0-9]{64}$/);
  assert.equal(inventory.completedStep, 1);
});

test('all twelve AI/domain modules map to existing source files', () => {
  assert.equal(inventory.modules.length, 12);
  for (const module of inventory.modules) {
    assert.match(module.id, /^[a-z-]+$/);
    assert.ok(module.step >= 6 && module.step <= 17);
    for (const file of [module.service, module.entry]) {
      assert.ok(fs.statSync(path.join(root, file)).isFile(), `${module.id}: ${file}`);
    }
  }
});

test('dependencies are declared but the previously reported graph files are absent from the baseline', () => {
  assert.ok(packageJson.dependencies['@langchain/langgraph']);
  assert.ok(packageJson.dependencies['@langchain/core']);
  assert.deepEqual(inventory.existingGraphFiles, []);
  for (const file of inventory.missingPreviouslyReportedGraphFiles) {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} was not in the original ZIP`);
  }
});

test('authorization and explicit document approvals remain part of the baseline', () => {
  for (const file of inventory.criticalGuardFiles) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing guard: ${file}`);
  }
  assert.match(text('src/lib/career-os/policy.ts'), /actor\.id\s*!==\s*ownerId/);
  assert.match(text('src/lib/career-os/tool-registry.ts'), /authorizeCareerTool/);
  assert.match(text('src/lib/resume-ai/proposal-service.ts'), /PROPOSAL_EXPIRED_OR_STALE/);
  assert.match(text('src/lib/cover-letter-ai/proposal-service.ts'), /PROPOSAL_EXPIRED_OR_STALE/);
});

test('job analysis retains source validation and user ownership boundaries', () => {
  const route = text('src/app/api/job-match/route.ts');
  assert.match(route, /requireUser\(/);
  assert.match(route, /requireFeature\(/);
  assert.match(route, /fingerprint/);
  assert.match(route, /userId:\s*user\.id/);
  // Stage 10 migrated the call from the route into the authenticated LangGraph.
  assert.match(route, /runJobMatchAgent\(/);
  assert.match(text('src/lib/agentic/agents/job-match/tools/compare.tool.ts'), /matchJob\(input.profile, analysis, input.resume\)/);
});
