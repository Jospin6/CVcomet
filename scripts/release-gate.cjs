#!/usr/bin/env node
/**
 * CVComet release verification. No hidden skip can certify production:
 *  --local checks local code and regressions, reports LOCAL_ONLY.
 *  --staging requires a fully installed, configured app, a staging URL and
 *            database, checks build/migrations and anonymous HTTP isolation.
 * A passing staging gate does not replace manual payment/AI/UX/UAT sign-off.
 * Never prints environment variable values or server responses.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectReleaseSource } = require('./release-source-audit.cjs');

const root = path.resolve(__dirname, '..');
const staging = process.argv.includes('--staging');
const local = process.argv.includes('--local');
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
if ((!staging && !local) || (staging && local)) {
  console.error('Usage: node scripts/release-gate.cjs --local|--staging [--output=/safe/path/report.json]');
  process.exit(2);
}
const report = {
  scope: staging ? 'STAGING_AUTOMATED_CHECKS' : 'LOCAL_CODE_CHECKS',
  certifiedForProduction: false,
  executedAt: new Date().toISOString(),
  checks: [],
  blockers: [],
  limitations: [
    'Human assessment of generated CV and cover letter accuracy still required',
    'Stripe checkout/webhooks and provider AI output require explicitly reviewed end-to-end test runs',
    'Multi-device responsive accessibility and data protection/legal sign-off require separate review',
  ],
};
const add = (name, result, detail) => report.checks.push({ name, result, ...(detail ? { detail } : {}) });
function run(name, command, args, timeoutMs = 180000) {
  const result = spawnSync(command, args, { cwd: root, env: process.env, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 });
  const ok = result.status === 0 && !result.error;
  add(name, ok ? 'PASS' : 'FAIL', result.error?.code === 'ETIMEDOUT' ? 'timeout' : ok ? undefined : 'process_exit_nonzero');
  if (!ok) report.blockers.push(name);
  return ok;
}
function prerequisite(label, ok) {
  add(label, ok ? 'PASS' : 'BLOCKED');
  if (!ok) report.blockers.push(label);
  return ok;
}
function writeReport() {
  const output = outputArg?.slice('--output='.length);
  if (output) {
    const filepath = path.resolve(output);
    // Do not overwrite application source, env files or secrets via this utility.
    if (filepath.startsWith(path.join(root, 'src') + path.sep) || /(?:^|\/)\.env(?:\.|$)/.test(filepath)) {
      console.error('Invalid report destination'); process.exit(2);
    }
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
  for (const item of report.checks) console.log(`${item.result.padEnd(7)} ${item.name}`);
  console.log(`STATUS: ${report.blockers.length ? 'BLOCKED' : staging ? 'STAGING_CHECKS_PASSED_NOT_PRODUCTION_CERTIFIED' : 'LOCAL_CHECKS_PASSED_NOT_PRODUCTION_CERTIFIED'}`);
  console.log(`BLOCKERS: ${report.blockers.length} | scope: ${report.scope}`);
}
async function main() {
  const source = inspectReleaseSource(root);
  add('source_security_and_route_invariants', source.failures.length === 0 ? 'PASS' : 'FAIL', `${source.careerRouteFiles} career API routes; ${source.expectedMigrations} migrations inspected`);
  if (source.failures.length) report.blockers.push(...source.failures);
  for (const warning of source.warnings) add(warning, 'NOT_VERIFIED');
  const testOk = run('unit_regressions_phases_00_to_13', 'npm', ['run', 'test:cvcomet:baseline']);
  const finalTestsOk = run('phase_14_security_release_tests', 'npm', ['run', 'test:phase14']);
  const syntaxOk = run('typescript_tsx_parse_only', 'npm', ['run', 'check:syntax']);
  if (staging) {
    const required = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'NEXT_PUBLIC_APP_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRO_PRICE_ID', 'STRIPE_CAREER_PRO_PRICE_ID'];
    const envOk = prerequisite('required_environment_configuration', required.every(v => Boolean(process.env[v])));
    const lock = prerequisite('reproducible_dependency_lockfile', ['package-lock.json','npm-shrinkwrap.json','yarn.lock','pnpm-lock.yaml'].some(file => fs.existsSync(path.join(root, file))));
    const deps = prerequisite('installed_dependencies', fs.existsSync(path.join(root,'node_modules')));
    if (lock && deps && envOk && testOk && finalTestsOk && syntaxOk) {
      run('prisma_schema_validate', 'npm', ['exec', '--', 'prisma', 'validate']);
      run('database_migration_status', 'npm', ['exec', '--', 'prisma', 'migrate', 'status']);
      run('typescript_semantic_check', 'npm', ['run', 'typecheck']);
      run('nextjs_production_build', 'npm', ['run', 'build'], 240000);
    } else {
      for (const name of ['prisma_schema_validate','database_migration_status','typescript_semantic_check','nextjs_production_build']) add(name, 'NOT_RUN', 'prerequisites_missing_or_tests_failed');
    }
    const rawUrl = process.env.CVCOMET_STAGING_URL;
    let url;
    try { url = rawUrl ? new URL(rawUrl) : undefined; } catch { /* invalid */ }
    // Do not make HTTP requests to localhost, private networks or non-HTTPS hosts.
    const safe = !!url && url.protocol === 'https:' && !url.username && !url.password && !/^(localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(url.hostname);
    prerequisite('public_https_staging_url', safe);
    if (safe) {
      for (const [name, endpoint, status] of [
        ['anonymous_liveness_only','/api/health',200],
        ['unauthenticated_tool_access_denied','/api/career/v1/tools',401],
        ['unauthenticated_missions_access_denied','/api/career/v1/missions',401],
        ['unauthenticated_evidence_access_denied','/api/career/v1/evidence',401],
      ]) {
        try {
          const response = await fetch(new URL(endpoint, url.origin), { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'Cache-Control': 'no-cache' } });
          const ok = response.status === status && (name !== 'anonymous_liveness_only' || (await response.json())?.check === 'liveness_only');
          add(name, ok ? 'PASS' : 'FAIL');
          if (!ok) report.blockers.push(name);
        } catch {
          add(name, 'FAIL', 'request_failed'); report.blockers.push(name);
        }
      }
    } else {
      for (const name of ['anonymous_liveness_only','unauthenticated_tool_access_denied','unauthenticated_missions_access_denied','unauthenticated_evidence_access_denied']) add(name, 'NOT_RUN');
    }
  }
  writeReport();
  process.exitCode = report.blockers.length ? 1 : 0;
}
main().catch(() => { report.blockers.push('unexpected_release_gate_failure'); writeReport(); process.exitCode = 1; });
