#!/usr/bin/env node
/** Final deploy preflight. Local checks never claim production or vendor certification.
 * Reports only pass/fail metadata; no URL, connection string or env value is printed. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const staging = process.argv.includes('--staging');
const reportArg = process.argv.find(a=>a.startsWith('--report='));
const has = file => fs.existsSync(path.join(root,file));
const checks = [];
const check = (key, ok, description) => checks.push({key,status:ok?'PASS':'BLOCKED',detail:description});

check('package_lock', has('package-lock.json'),
  'A reviewed npm lockfile must exist before npm ci and deterministic deployments.');
check('installed_langgraph', has('node_modules/@langchain/langgraph/package.json'),
  'LangGraph dependencies must be installed for real graph integration.');
check('generated_prisma_client', has('node_modules/.prisma/client/index.js'),
  'Prisma Client must be generated from the current schema.');
for(const [stage,dir] of [
 ['17','20261031230000_career_agent_memory'],
 ['18','20261101001500_career_mission_progress_stream'],
 ['19','20261101003500_agentic_quality_indexes'],
 ['20','20261101010000_agentic_career_rollout_metrics'],
]) check('migration_'+stage, has(`prisma/migrations/${dir}/migration.sql`),
  'Review and apply the migration on staging before application deploy.');
check('rollout_control',has('src/lib/agentic/core/policies/career-rollout.ts')&&has('src/lib/career-os/legacy-agent-service.ts'),
  'Rollback and graph routing code are packaged.');
check('stage20_unit_suite',has('scripts/agentic-stage20-unit.test.mjs'),
  'Run npm run test:agentic:stage20 in CI.');
const mode = (process.env.CVCOMET_CAREER_AGENT_ENGINE || 'graph').trim().toLowerCase();
check('valid_rollout_mode',['legacy','graph','rollout'].includes(mode),
  'Only legacy, graph or rollout are accepted; unknown modes select legacy.');
if(mode==='rollout'){
 const raw=process.env.CVCOMET_CAREER_AGENT_ROLLOUT_PERCENT || '0';
 check('valid_rollout_percent',/^(?:100|\d{1,2})(?:\.\d{1,2})?$/.test(raw) && Number(raw)<=100,
   'A valid rollout percentage must be configured at deployment time.');
}
if(staging){
 const tasks=[['local_regressions','eval:agentic:local'],
   ['real_graph_regressions','eval:agentic:staging']];
 for(const [key,script] of tasks){
  if(!has('node_modules/@langchain/langgraph/package.json')) {
   check(key,false,'Graph runtime dependencies absent; integration cannot be certified.');
   continue;
  }
  const result=spawnSync('npm',['run',script],{cwd:root,encoding:'utf8',timeout:12*60*1000,maxBuffer:2*1024*1024});
  check(key,result.status===0 && !result.error,'Run actual automated suites on staging; stdout and stderr are never included in the report.');
 }
}
// Even a full automated pass does not validate staging DB ownership, LiveKit,
// real model groundedness, provider billing and human-approved production signoff.
const report={scope:staging?'STAGING_AUTOMATED_PREFLIGHT':'LOCAL_RELEASE_PREFLIGHT',
 generatedAt:new Date().toISOString(),productionCertified:false,
 automatedChecksPassed:checks.every(x=>x.status==='PASS'),
 decision:checks.some(x=>x.status==='BLOCKED')?'BLOCKED':'MANUAL_STAGING_SIGNOFF_REQUIRED',
 checks,manualGates:[
  'Prisma migrations actually applied to Neon staging and rollback rehearsed',
  'Read/write property isolation verified using two distinct authenticated staging accounts',
  'No unapproved external actions or fabricated candidate evidence (multilingual real-provider tests)',
  'Voice interviews verified end-to-end with LiveKit, consent and failure recovery',
  'Graph-vs-legacy cohorts meet operational thresholds with at least 30 completed samples each',
  'Real model and provider errors, memory revocation, concurrent requests and SSE replay exercised',
  'Provider costs reconciled and vulnerability/secret scan reviewed',
  'Human release approval recorded after staging build and canary review',
 ],
 note:'This is a preflight evidence report, not a certificate of production readiness.'};
if(reportArg){
 const destination=path.resolve(reportArg.slice('--report='.length));
 if(!destination.endsWith('.json') || destination.startsWith(path.join(root,'src')+path.sep)
    || /(?:^|[/\\])\.env(?:\.|$)/.test(destination)) process.exit(2);
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
if(report.decision==='BLOCKED')process.exitCode=1;
