/** Dependency-free, source-level release invariants. These checks are NOT
 * equivalent to running a server with a database and a real AI provider. */
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

function inspectReleaseSource(rootInput = path.resolve(__dirname, '..')) {
  const root = rootInput instanceof URL ? fileURLToPath(rootInput) : rootInput;
  const failures = [];
  const warnings = [];
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  const present = relative => fs.existsSync(path.join(root, relative));
  const routes = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name === 'route.ts') routes.push(file);
    }
  }
  walk(path.join(root, 'src', 'app', 'api', 'career', 'v1'));
  if (routes.length < 15) failures.push('career_api_surface_incomplete');
  for (const absolute of routes) {
    const relative = path.relative(root, absolute);
    const code = fs.readFileSync(absolute, 'utf8');
    if (!/getSessionUser\s*\(/.test(code)) failures.push(`actor_auth_missing:${relative}`);
    if (/export async function (POST|PUT|PATCH|DELETE)\s*\(/.test(code) && !code.includes('assertTrustedWriteOrigin(')) {
      failures.push(`write_origin_guard_missing:${relative}`);
    }
    if (!code.includes('withCareerHttp(')) failures.push(`career_envelope_missing:${relative}`);
  }
  const contracts = read('src/lib/career-os/contracts.ts');
  const externalActionEnabled = /effect:\s*['"](?:external|sensitive_write)['"],\s*available:\s*true/.test(contracts);
  if (externalActionEnabled) failures.push('external_ai_tool_enabled');
  if (!contracts.includes('CAREER_API_VERSION = "v1"')) failures.push('contract_version_drift');
  const engine = read('src/lib/career-os/agent-engine.ts');
  if (!engine.includes('AGENT_MAX_READS = 3') || !engine.includes('validateAgentCalls(')) failures.push('agent_execution_limit_missing');
  const policy = read('src/lib/security/origin-policy.ts');
  if (!policy.includes('ORIGIN_REQUIRED') || !policy.includes('UNTRUSTED_ORIGIN')) failures.push('browser_origin_policy_missing');
  const packets = read('src/lib/career-os/application-packet-service.ts');
  if (!packets.includes('submissionPerformed: false, externalEmailSent: false')) failures.push('packet_submission_claim_not_explicitly_false');
  const migrations = [
    '20261024100000_email_verification_hardening', '20261024120000_ai_quota_windows',
    '20261024150000_security_phase00_final', '20261024170000_career_evidence_vault',
    '20261024190000_resume_ai_proposals', '20261024210000_cover_letter_ai_proposals',
    '20261024230000_career_missions', '20261025010000_career_application_packets',
    '20261025030000_career_quality',
  ];
  const missingMigrations = migrations.filter(name => !present(`prisma/migrations/${name}/migration.sql`));
  for (const migration of missingMigrations) failures.push(`migration_missing:${migration}`);
  for (const screen of ['assistant','resumes','cover-letters','application-agent','evidence','interviews','job-match']) {
    if (!present(`src/app/dashboard/${screen}/page.tsx`) && screen !== 'resumes') failures.push(`dashboard_screen_missing:${screen}`);
  }
  const pkg = JSON.parse(read('package.json'));
  for (let stage = 0; stage <= 13; stage++) {
    const name = stage.toString().padStart(2, '0');
    if (!pkg.scripts?.[`test:phase${name}`]) failures.push(`regression_suite_missing:${name}`);
  }
  if (!present('package-lock.json') && !present('npm-shrinkwrap.json') && !present('pnpm-lock.yaml') && !present('yarn.lock')) {
    warnings.push('dependency_lockfile_missing_reproducible_install_not_verified');
  }
  if (!present('node_modules')) warnings.push('dependencies_not_installed_build_not_verified');
  const accidentalSecrets = fs.readdirSync(root).filter(name => /^\.env(?:\.|$)/.test(name) && name !== '.env.example');
  if (accidentalSecrets.length) warnings.push('local_environment_file_present_exclude_from_release_archive');
  return { careerRouteFiles: routes.length, expectedMigrations: migrations.length, missingMigrations,
    externalActionEnabled, failures, warnings };
}
module.exports = { inspectReleaseSource };
