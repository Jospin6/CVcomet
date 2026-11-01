const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file, mocks={}){
  const src=fs.readFileSync(path.join(root,file),'utf8');
  const code=ts.transpileModule(src,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};
  const resolve=id=>{
    if(id in mocks)return mocks[id];
    throw Error(`Unexpected import ${id} by ${file}`);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{
    URL,AbortController,AbortSignal,Date,Map,Set,Promise,Number,String,Math,RegExp,console,
  })(resolve,module,module.exports);
  return module.exports;
}
const rank=load('src/lib/find-jobs/ranking.ts');
const candidate=load('src/lib/agentic/agents/job-discovery/tools/context.tool.ts');
const shortlist=load('src/lib/agentic/agents/job-discovery/tools/rank.tool.ts',{
  '@/lib/find-jobs/ranking':rank,
});
const discover=load('src/lib/agentic/agents/job-discovery/tools/discover.tool.ts',{
  '@/lib/find-jobs/service':{getJobsPool:async()=>({jobs:[],warnings:[]})},
});
const profiles=load('src/lib/find-jobs/facets.ts');
// Use a schema-building shim only to load the ACTUAL legacy filter function;
// preferences are complete plain data and are not parsed in these tool tests.
const fakeSchema=new Proxy({parse:x=>x},{get:(obj,key)=>obj[key]||(()=>fakeSchema)});
const z=new Proxy({}, {get:()=>()=>fakeSchema});
const legacy=load('src/lib/find-jobs/for-you.ts',{zod:{z},'./facets':profiles});
const filtering=load('src/lib/agentic/agents/job-discovery/tools/filter.tool.ts',{
  '@/lib/find-jobs/for-you':legacy,
  '@/lib/find-jobs/facets':profiles,
});
const matcher=load('src/lib/agentic/agents/job-discovery/tools/match.tool.ts',{
  '@/lib/career-profile/schema':{emptyProfile:(email)=>({email,skills:'',experiences:[]})},
  '@/lib/ai/model':{getAIModel:async()=>true},
  '@/lib/career-profile/ai':{reserveProfileAI:async()=>true},
  '@/lib/agentic/agents/job-match/agent/job-match.agent':{runJobMatchAgent:async()=>({match:{overallScore:75}})},
  '@/lib/career/job-schema':{jobTextSchema:{safeParse:(text)=>({success:text.length>=100&&text.length<=50000})}},
});
const assemble=load('src/lib/agentic/agents/job-discovery/nodes/assemble.node.ts');
const matchNode=load('src/lib/agentic/agents/job-discovery/nodes/match.node.ts',{
  '@/lib/career-profile/http':{profileAIError:(e)=>({code:e?.code||'AI_FAILED'})},
  '../tools/match.tool':matcher,
  '../tools/rank.tool':shortlist,
});
const pref={cvId:'11111111-1111-4111-8111-111111111111',title:'Frontend Developer',countries:[],
  postedWithin:'any',contracts:[],seniorities:[],workplaces:[],minimumAnnualUsd:null,visaSponsorship:false};
const resume={title:'Frontend Developer',skills:[{hardskills:'React TypeScript',softskills:'',tools:''}],
 experiences:[{title:'Frontend Developer',description:['React TS']}],summary:['Software developer']};
const job=(id,overrides={})=>({id,provider:'REMOTIVE',externalId:id,
 title:'Frontend React Developer',company:'Company '+id,
 description:'We seek a frontend developer with React and TypeScript experience for accessible applications and testing.',
 sourceUrl:`https://example.org/jobs/${id}`,applyUrl:`https://example.org/apply/${id}`,
 eligibleCountries:[],skills:['React','TypeScript'],location:'Worldwide',remote:true,
 contractType:'full-time',seniority:'mid',publishedAt:'2026-10-25T12:00:00Z',expiresAt:null,
 logoUrl:null,salaryMin:null,salaryMax:null,currency:null,attribution:'',...overrides});

test('stage11 live tools: only sourced https jobs survive and links deduplicate',()=>{
 const result=discover.trustedJobPool({jobs:[job('a'),job('b',{sourceUrl:'javascript:alert(1)'}),
   job('c',{company:''}),job('d',{applyUrl:'http://unsafe.org'}),job('e',{sourceUrl:'https://user:pass@example.org/e'}),
   job('dup',{sourceUrl:'https://example.org/jobs/a'})],warnings:['service warning']});
 assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].id,'a');
 assert.equal(result.warnings.length,1);
});
test('stage11 live tools: resume and selected role control ranking; no heuristic score leaks',()=>{
 const p=candidate.candidateFromResume(resume,pref);
 assert.equal(p.targetJobTitle,'Frontend Developer');
 assert.match(p.skills,/React TypeScript/);
 const jobs=[job('a'),job('irrelevant',{title:'General Dentist',description:'Dental dental oral examination tooth clinic',skills:[] })];
 const selected=shortlist.shortlistRelevantJobs(jobs,p);
 assert.equal(selected.length,1);assert.equal(selected[0].id,'a');
 assert.equal('match' in selected[0],false);
});
test('stage11 real filter: country, remote, published period, salary, visa are strict',()=>{
 const good=job('a',{location:'United States',eligibleCountries:['US'],currency:'USD',salaryMax:110000,
  description:'We seek React developers. Visa sponsorship provided. Annual salary: USD 110000. Reliable opening and well-described requirements.'});
 const other=job('b',{eligibleCountries:['GB'],location:'United Kingdom',remote:false});
 let p={...pref,countries:['US'],workplaces:['remote'],visaSponsorship:true,minimumAnnualUsd:90000};
 assert.deepEqual([...filtering.strictDiscoveryFilter([good,other],p).filtered].map(x=>x.id),['a']);
 p={...p,postedWithin:'day'};
 assert.equal(filtering.strictDiscoveryFilter([good],p,new Date('2026-10-31T12:00:00Z').getTime()).filtered.length,0);
 assert.equal(filtering.strictDiscoveryFilter([other],{...pref,countries:['US']}).filtered.length,0);
});
test('stage11 actual adapter: no artificial score from invalid/unverified Job Match result',()=>{
 const requirements=[{title:'React',status:'DEMONSTRATED'},{title:'C++',status:'NOT_DEMONSTRATED'}];
 assert.equal(matcher.verifiedDiscoveryMatch({overallScore:null,version:1,source:'PROFILE_AND_RESUME',requirements},'fr').score,null);
 assert.equal(matcher.verifiedDiscoveryMatch({overallScore:121,version:1,source:'PROFILE_AND_RESUME',requirements},'fr').score,null);
 const result=matcher.verifiedDiscoveryMatch({overallScore:75,version:1,source:'PROFILE_AND_RESUME',requirements,evaluatedCount:2,unverifiedCount:0},'en');
 assert.equal(result.score,75);assert.deepEqual([...result.matched],['React']);assert.deepEqual([...result.missing],['C++']);
});
test('stage11 actual graph node: deep match only top three, with explicit unscored remainder',async()=>{
 let quota=0,calls=[];
 const deps={authorizeDeepMatch:async()=>{quota++},match:async(job,cv)=>{
   calls.push(job.id);assert.equal(cv,resume);
   return {overallScore:80,version:1,source:'PROFILE_AND_RESUME',
    requirements:[],evaluatedCount:2,unverifiedCount:0};
 }};
 const scope={identity:{access:{kind:'authenticated',actorId:'user-A'}},budget:{signal:new AbortController().signal}};
 const input={resume,language:'en'};
 const jobs=Array.from({length:5},(_,i)=>job('j'+i));
 const result=await matchNode.createMatchJobsNode(deps,scope)({input,shortlist:jobs});
 assert.equal(quota,1);assert.deepEqual(calls,['j0','j1','j2']);
 assert.equal(result.checked.length,5);assert.equal(result.verifiedCount,3);
 assert.equal(result.checked[4].match.score,null);
 const final=assemble.assembleDiscoveryNode({...result,pool:{warnings:[]},shortlist:jobs,
  filtered:jobs,countries:[]}).result;
 assert.equal(final.matchingStatus,'partial');assert.equal(final.jobs.length,5);
});
test('stage11 actual graph node: quota rejection and partial model outage never fabricate a %',async()=>{
 const scope={identity:{access:{kind:'authenticated',actorId:'user-A'}},budget:{signal:new AbortController().signal}};
 const base={input:{resume,language:'fr'},shortlist:[job('a'),job('b')]};
 const rejected=await matchNode.createMatchJobsNode({authorizeDeepMatch:async()=>{
   throw {code:'AI_LIMIT'};
 }},scope)(base);
 assert.equal(rejected.warningCode,'AI_LIMIT');assert.ok(rejected.checked.every(j=>j.match.score===null));
 let quota=0;
 const partial=await matchNode.createMatchJobsNode({authorizeDeepMatch:async()=>{quota++},match:async(job)=>{
   if(job.id==='b')throw Error('Provider offline');
   return {overallScore:69,version:1,source:'PROFILE_AND_RESUME',requirements:[],evaluatedCount:2,unverifiedCount:0};
 }},scope)(base);
 assert.equal(quota,1);assert.equal(partial.verifiedCount,1);
 assert.equal(partial.checked[1].match.score,null);assert.equal(partial.warningCode,'AI_FAILED');
});
test('stage11 actual graph node: no real jobs does not consume an AI quota',async()=>{
 let calls=0;
 const scope={identity:{access:{kind:'authenticated',actorId:'user-A'}},budget:{signal:new AbortController().signal}};
 const result=await matchNode.createMatchJobsNode({authorizeDeepMatch:async()=>{calls++}},scope)({input:{resume,language:'en'},shortlist:[]});
 assert.equal(calls,0);assert.deepEqual([...result.checked],[]);
 assert.equal(assemble.assembleDiscoveryNode({...result,pool:{warnings:[]},filtered:[],countries:[]}).result.reason,'NO_MATCHING_OFFERS');
});
