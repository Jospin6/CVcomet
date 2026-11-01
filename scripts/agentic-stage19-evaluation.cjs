#!/usr/bin/env node
/** Repeatable *local regression* benchmark across CVComet LangGraph stages.
 * Never reads or stores prompts, resumes, candidate identifiers or responses.
 * Passing a test is not proof that live-model answers are grounded or fair. */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const staging = process.argv.includes('--staging');
const outputArg = process.argv.find(a => a.startsWith('--output='));
const groups = [
  ['foundation_and_identity', 'node', ['--test','scripts/agentic-stage01.test.cjs']],
  ['graph_and_approvals', 'node', ['--experimental-strip-types','--test','scripts/agentic-stage02.test.mjs']],
  ...Array.from({length:16}, (_,i) => {
    const stage = String(i+3).padStart(2,'0');
    const title = ({'03':'durability','04':'tools_and_approvals','05':'privacy_context','06':'profile',
      '07':'resume','08':'cover_letter','09':'ats','10':'job_match','11':'job_discovery',
      '12':'career_map','13':'interview_text','14':'interview_voice','15':'application',
      '16':'supervisor','17':'consent_memory','18':'streaming_recovery'})[stage];
    return [title,'npm',['run',`test:agentic:stage${stage}`]];
  }),
  ['stage19_observation','npm',['run','test:agentic:stage19']],
  ['stage20_progressive_rollout','npm',['run','test:agentic:stage20']],
  ['security_regressions','npm',['run','test:security-guards']],
  ['previous_cvcomet_regressions','npm',['run','test:cvcomet:baseline']],
  ['typescript_syntax_only','npm',['run','check:syntax']],
];
if (staging) {
  // No omitted integration gates in staging. These require real installed dependencies.
  const integrationStages = ['04','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20'];
  for (const stage of integrationStages) groups.push([`real_runtime_${stage}`,'npm',['run',`test:agentic:stage${stage}:integration`]]);
  groups.push(['semantic_typecheck','npm',['run','typecheck']], ['production_build','npm',['run','build']]);
}
const report = {
  scope: staging ? 'STAGING_AUTOMATED_REGRESSIONS' : 'LOCAL_UNIT_AND_CONTRACT_REGRESSIONS',
  executedAt: new Date().toISOString(),
  productionCertified: false,
  limitations: [
    'Unit test pass rate does not measure model groundedness, fairness or job outcomes.',
    'Offline fixtures do not prove absence of unauthorized access in a deployed system.',
    'Provider recovery, live Neon/LiveKit and human-reviewed multilingual prompts require separate staging sign-off.',
  ],
  groups: [], totalTests: 0, passedTests: 0, failedTests: 0, decision: 'BLOCKED',
};
for (const [name,command,args] of groups) {
  const result = spawnSync(command,args, { cwd:root, encoding:'utf8', timeout:180000, maxBuffer:3*1024*1024 });
  // Only test framework counters are included. Stderr/stdout may hold private values; never copy them.
  const output = result.stdout || '';
  const counts = [...output.matchAll(/^# (tests|pass|fail) (\d+)\s*$/gm)];
  const sumCount = key => { const matches=counts.filter(item=>item[1]===key); return matches.length ? matches.reduce((sum,item)=>sum+Number(item[2]),0) : null; };
  const tests = sumCount('tests'), passed = sumCount('pass'), failed = sumCount('fail');
  const ok = result.status === 0 && !result.error && (name === 'typescript_syntax_only' || (tests !== null && passed !== null && failed === 0 && passed === tests));
  report.groups.push({ name, status: ok ? 'PASS' : 'FAIL', tests, passed, failed,
    cause: ok ? null : result.error?.code === 'ETIMEDOUT' ? 'timeout' : 'failed_or_missing_counters' });
  if (tests !== null && passed !== null && failed !== null) {
    report.totalTests += tests; report.passedTests += passed; report.failedTests += failed;
  }
  process.stdout.write(`${ok?'PASS':'FAIL'} ${name}: ${tests === null ? 'no test counters' : `${passed}/${tests}`}\n`);
}
report.decision = report.groups.every(row => row.status === 'PASS') ? 'LOCAL_TESTS_PASS_NOT_PRODUCTION_CERTIFIED' : 'BLOCKED';
if (outputArg) {
  const filepath=path.resolve(outputArg.slice('--output='.length));
  if (!filepath.endsWith('.json') || filepath.startsWith(path.join(root,'src')+path.sep) ||
      /(?:^|[/\\])\.env(?:\.|$)/.test(filepath)) {
    console.error('Invalid report destination'); process.exit(2);
  }
  fs.mkdirSync(path.dirname(filepath),{recursive:true});
  fs.writeFileSync(filepath,JSON.stringify(report,null,2)+'\n');
}
console.log(`${report.decision} | counted ${report.passedTests}/${report.totalTests} passing tests; no model-accuracy inference`);
if (report.decision==='BLOCKED') process.exitCode=1;
