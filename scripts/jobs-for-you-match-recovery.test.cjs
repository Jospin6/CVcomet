const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, mocks = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, {
    fileName: relative,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const requireMock = (id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency ${id} in ${relative}`);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    console: {warn:()=>{},error:()=>{},log:()=>{}},
    AbortController, AbortSignal, Promise, Map, Set, Number, String,
    Math, RegExp, Date, Array, Object,
  })(requireMock, mod, mod.exports);
  return mod.exports;
}

const matchAdapter = load('src/lib/agentic/agents/job-discovery/tools/match.tool.ts', {
  '@/lib/career-profile/schema': {emptyProfile: () => ({})},
  '@/lib/ai/model': {getAIModel: async () => true},
  '@/lib/career-profile/ai': {reserveProfileAI: async () => {}},
  '@/lib/agentic/agents/job-match/agent/job-match.agent': {runJobMatchAgent: async () => ({match:{}})},
  '@/lib/career/job-schema': {jobTextSchema: {safeParse: value => ({success: value.length >= 100})}},
});
const node = load('src/lib/agentic/agents/job-discovery/nodes/match.node.ts', {
  '@/lib/career-profile/http': {profileAIError: error => ({code: error?.code || 'AI_FAILED'})},
  '../tools/match.tool': matchAdapter,
  '../tools/rank.tool': {DEEP_MATCH_LIMIT: 3},
});
const assemble = load('src/lib/agentic/agents/job-discovery/nodes/assemble.node.ts');
const resume = { title:'Software Engineer' };
const sampleJob = id => ({
  id, title: 'Software Engineer', company: 'Example',
  sourceUrl: `https://example.org/jobs/${id}`, description: 'Build software with TypeScript and React, write maintainable production applications, collaborate with engineers and product teams. ',
});
const scope = {
  identity: {access: {kind:'authenticated',actorId:'actor-123'}},
  budget: {signal: new AbortController().signal},
};
const input = {resume, language:'en'};
const matched = score => ({overallScore:score, version:1, source:'PROFILE_AND_RESUME',
  requirements:[{title:'React',status:'DEMONSTRATED'}],evaluatedCount:1,unverifiedCount:0});

test('an evaluation error preserves all offers and other verified scores', async () => {
  const jobs = [sampleJob('a'),sampleJob('b'),sampleJob('c'),sampleJob('d')];
  let quota = 0;
  const calls = [];
  const deps = {
    authorizeDeepMatch: async () => {quota++;},
    match: async job => {calls.push(job.id); if(job.id === 'b') throw {code:'AI_FAILED'}; return matched(job.id==='a'?80:69);},
  };
  const value = await node.createMatchJobsNode(deps, scope)({input,shortlist:jobs,outsideFilters:false});
  assert.equal(value.checked.length,4);
  assert.deepEqual(value.checked.map(j=>j.match.score),[80,null,69,null]);
  assert.equal(value.warningCode,'AI_FAILED');
  assert.equal(value.verifiedCount,2);
  assert.equal(value.deepMatchCount,3);
  assert.equal(quota,1);
  assert.deepEqual(calls,['a','b','c']);
  const response = assemble.assembleDiscoveryNode({...value,pool:{jobs,warnings:[]},countries:[],shortlist:jobs}).result;
  assert.equal(response.jobs.length,4);
  assert.equal(response.matchingStatus,'partial');
});

test('explicit retry only evaluates previously failed eligible offers',async () => {
  const jobs=[sampleJob('a'),sampleJob('b'),sampleJob('c')];
  let calls=[]; let quota=0;
  const first=await node.createMatchJobsNode({
    authorizeDeepMatch: async()=>{quota++;},
    match: async job => {calls.push(job.id); if(job.id==='b')throw {code:'AI_FAILED'};return matched(72);},
  },scope)({input,shortlist:jobs});
  assert.deepEqual(calls,['a','b','c']);
  assert.equal(first.verifiedCount,2);
  calls=[];
  const previousVerifiedMatches=new Map(first.checked.filter(job=>job.match.score!==null).map(job=>[job.id,job.match]));
  const second=await node.createMatchJobsNode({
    previousVerifiedMatches,
    authorizeDeepMatch:async()=>{quota++;},
    match:async job=>{calls.push(job.id);return matched(90);},
  },scope)({input,shortlist:jobs});
  assert.deepEqual(calls,['b']);
  assert.deepEqual(second.checked.map(job=>job.match.score),[72,90,72]);
  assert.equal(second.verifiedCount,3);
  assert.equal(second.warningCode,null);
  assert.equal(quota,2); // each actual retry reserves quota once

  // Once complete, repeating the same request never calls the model or quota.
  const completeCache=new Map(second.checked.map(job=>[job.id,job.match]));
  const last=await node.createMatchJobsNode({
    previousVerifiedMatches:completeCache,
    authorizeDeepMatch:async()=>{quota++;},
    match:async()=>{throw Error('Unexpected duplicate model request');},
  },scope)({input,shortlist:jobs});
  assert.equal(last.verifiedCount,3);
  assert.equal(quota,2);
});

test('rate limits stop adding new calls but keep existing scores', async()=>{
  const jobs=[sampleJob('a'),sampleJob('b'),sampleJob('c')];
  const calls=[];
  const result=await node.createMatchJobsNode({
    authorizeDeepMatch:async()=>{},
    match:async job=>{
      calls.push(job.id);
      if(job.id==='a')throw {code:'AI_RATE_LIMIT'};
      if(job.id==='b')return matched(85);
      throw Error('Should not call job c after provider-wide rate limit');
    },
  },scope)({input,shortlist:jobs});
  assert.deepEqual(calls,['a','b']);
  assert.equal(result.checked[1].match.score,85);
  assert.equal(result.checked[0].match.score,null);
  assert.equal(result.checked[2].match.score,null);
});

test('a non-verifiable result never creates a fictional percentage',async()=>{
  const jobs=[sampleJob('a')];
  const result=await node.createMatchJobsNode({
    authorizeDeepMatch:async()=>{},
    match:async()=>matched(null),
  },scope)({input,shortlist:jobs});
  assert.equal(result.checked[0].match.score,null);
  assert.equal(result.warningCode,'AI_INVALID_RESPONSE');
});

test('a failed quota check does not destroy cached scores',async()=>{
  const jobs=[sampleJob('a'),sampleJob('b')];
  const score=matchAdapter.verifiedDiscoveryMatch(matched(77),'en');
  const result=await node.createMatchJobsNode({
    previousVerifiedMatches:new Map([['a',score]]),
    authorizeDeepMatch:async()=>{throw {code:'AI_LIMIT'};},
    match:async()=>{throw Error('Must not evaluate on denied quota');},
  },scope)({input,shortlist:jobs});
  assert.equal(result.checked[0].match.score,77);
  assert.equal(result.checked[1].match.score,null);
  assert.equal(result.warningCode,'AI_LIMIT');
});

test('API reuses partial scores only for same server-derived fingerprint and does not trust client scores',()=>{
  const source=fs.readFileSync(path.join(root,'src/app/api/find-jobs/for-you/route.ts'),'utf8');
  assert.match(source,/previousVerifiedMatches: new Map/);
  assert.match(source,/version: 12, actor: user\.id/);
  assert.match(source,/createHash\("sha256"\)\.update\(job\.description\)/);
  assert.match(source,/complete \? 10 : 3/);
  assert.match(source,/previous\.result\.verifiedCount === previous\.result\.deepMatchCount/);
  assert.doesNotMatch(source,/req\.json\(\)\.previousVerifiedMatches/);
});

test('with real offers, optional AI failures do not become global warning banners',()=>{
  const source=fs.readFileSync(path.join(root,'src/components/jobs/jobs-for-you.tsx'),'utf8');
  assert.match(source,/data\.jobs\?\.length && optionalMatchWarnings\.has\(data\.warningCode\)/);
  assert.match(source,/retryScores: "Retry unscored offers"/);
  assert.match(source,/deepMatchCount > verifiedCount/);
  assert.match(source,/job\.match\.score !== null/);
});

test('invalid job extraction schema receives one controlled correction attempt',()=>{
  const source=fs.readFileSync(path.join(root,'src/lib/career/job-match.ts'),'utf8');
  assert.match(source,/"ZodError"/);
  assert.match(source,/attempt > 0 \|\| abortSignal\.aborted/);
  assert.match(source,/"AI_INVALID_RESPONSE"/);
});
