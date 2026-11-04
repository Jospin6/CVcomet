const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch {
  ts = require(path.join(cp.execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript'));
}
const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/app/api/find-jobs/for-you/route.ts'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/components/jobs/jobs-for-you.tsx'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'prisma/migrations/20261103150000_reconcile_job_recommendation_preferences/migration.sql'), 'utf8');
const sourceFile = ts.createSourceFile('route.ts', route, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
assert.equal(sourceFile.parseDiagnostics.length, 0, 'route TS parse errors');
const names = ['getPreferenceStore', 'preferenceErrorCode', 'isPreferenceSchemaError', 'readSavedPreference', 'savePreference'];
const bodies = names.map(name => {
  const node = sourceFile.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, `Missing function ${name}`);
  return node.getText(sourceFile);
});
const compiled = ts.transpileModule(`const prisma = globalThis.prisma;\n${bodies.join('\n')}\nmodule.exports = { ${names.join(', ')} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function harness(prisma) {
  const context = { prisma, module: { exports: {} }, console };
  context.globalThis = context;
  vm.runInNewContext(compiled, context);
  return context.module.exports;
}
const prefs = { cvId: 'cv-1', title: '', countries: [] };

test('stale Prisma client: parameterized raw SQL reads and writes without a delegate', async () => {
  let selectUser = null;
  let saveUser = null;
  let stored = null;
  const h = harness({
    $queryRaw: async (parts, userId) => {
      assert.match(parts.join('?'), /FROM public\."JobRecommendationPreference"/);
      selectUser = userId;
      return [{ filters: prefs }];
    },
    $executeRaw: async (parts, userId, filters) => {
      assert.match(parts.join('?'), /ON CONFLICT \("userId"\)/);
      saveUser = userId;
      stored = JSON.parse(filters);
      return 1;
    },
  });
  assert.equal((await h.readSavedPreference('user-1')).filters.cvId, 'cv-1');
  await h.savePreference('user-1', prefs);
  assert.equal(selectUser, 'user-1');
  assert.equal(saveUser, 'user-1');
  assert.equal(stored.cvId, 'cv-1');
});

test('working Prisma delegate is used without raw queries', async () => {
  let found = 0;
  let upserts = 0;
  const h = harness({
    jobRecommendationPreference: {
      findUnique: async ({where}) => { assert.equal(where.userId, 'u2'); found++; return {filters: prefs}; },
      upsert: async ({where,create,update}) => { assert.equal(where.userId, 'u2'); assert.equal(create.userId, 'u2'); assert.equal(update.filters.cvId, 'cv-1'); upserts++; },
    },
    $queryRaw: () => { throw Error('raw query should not run'); },
    $executeRaw: () => { throw Error('raw command should not run'); },
  });
  await h.readSavedPreference('u2');
  await h.savePreference('u2', prefs);
  assert.equal(found, 1);
  assert.equal(upserts, 1);
});

test('schema mapping error in delegate falls back to SQL (does not fake migration error)', async () => {
  let reads = 0;
  let writes = 0;
  const h = harness({
    jobRecommendationPreference: {
      findUnique: async () => { throw {code:'P2021'}; },
      upsert: async () => { throw {code:'P2022'}; },
    },
    $queryRaw: async () => { reads++; return [{filters: prefs}]; },
    $executeRaw: async () => { writes++; return 1; },
  });
  await h.readSavedPreference('u3');
  await h.savePreference('u3', prefs);
  assert.equal(reads, 1);
  assert.equal(writes, 1);
});

test('genuine missing table is classified, but unrelated connection errors are not masked', async () => {
  const h = harness({
    $queryRaw: async () => { throw {code: 'P2010', meta: {code: '42P01'}}; },
  });
  assert.equal(h.isPreferenceSchemaError({code: 'P2010', meta:{code:'42P01'}}), true);
  assert.equal(h.isPreferenceSchemaError({code: 'P2010', meta:{code:'42703'}}), true);
  assert.equal(h.isPreferenceSchemaError({code: 'P2010', meta:{code:'42P10'}}), true);
  assert.equal(h.isPreferenceSchemaError({code: 'P1001'}), false);
  assert.equal(h.preferenceErrorCode({code:'P2010',meta:{code:'42P01'}}), 'P2010/42P01');
  await assert.rejects(() => h.readSavedPreference('u4'), e => e.code === 'P2010');
  const bad = harness({ $queryRaw: async () => { throw {code: 'P1001'}; } });
  await assert.rejects(() => bad.readSavedPreference('u4'), e => e.code === 'P1001');
});

test('API and UI do not claim an unapplied migration after migrate status is up to date', () => {
  assert.doesNotMatch(route, /warningCode: "PRISMA_MIGRATION_REQUIRED"|preferenceWarning = "PRISMA_MIGRATION_REQUIRED"/);
  assert.match(route, /PREFERENCES_NOT_PERSISTED/);
  assert.match(route, /preferences-reconciled-v2/);
  assert.doesNotMatch(ui, /The Jobs for You preferences migration is missing\. Run prisma migrate deploy\./);
  assert.match(ui, /PREFERENCES_NOT_PERSISTED/);
  assert.match(route, /runJobDiscoveryAgent\(\{/);
});

test('reconciliation migration is additive, repeatable and preserves existing preferences', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\."JobRecommendationPreference"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "filters" JSONB/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP\(3\)/);
  assert.match(sql, /FOREIGN KEY \("userId"\)/);
  assert.match(sql, /ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.doesNotMatch(sql, /\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  assert.match(sql, /WHERE "filters" IS NULL/);
});
