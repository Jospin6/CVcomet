const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {createHash} = require('node:crypto');
const file = path.resolve(__dirname, '../src/app/api/find-jobs/for-you/route.ts');

function loadRoute(run) {
  const schema = {default(){return this;},strict(){return this;},parse(input){return input;}};
  const jobs = ['a','b','c'].map(id=>({id,title:'Frontend Engineer',sourceUrl:`https://example.org/${id}`,
    publishedAt:'2026-11-01T10:00:00Z',description:'Build React TypeScript applications for clients.'}));
  const preferences = {cvId:'cv-owner', title:'Frontend Engineer',countries:[],postedWithin:'any',seniorities:[],contracts:[],workplaces:[],minimumAnnualUsd:null,visaSponsorship:false};
  const cv = {id:'cv-owner',revision:4,title:'Frontend Engineer',summary:['Experience with React'],skills:[{hardskills:'React'}],experiences:[{title:'Frontend Engineer',description:['Built apps']}],projects:[],educations:[],certifications:[]};
  const prisma = {cv:{findFirst:async()=>cv},user:{findUnique:async()=>({})}};
  const Response = {json:(body,options)=>({body,headers:options?.headers})};
  const mocks = {
    'node:crypto':{createHash}, 'next/server':{NextResponse:Response},'zod':{z:{object:()=>schema,boolean:()=>schema,enum:()=>schema}},
    '../../../../../prisma/prisma':{__esModule:true,default:prisma},
    '@/lib/auth':{getSessionUser:async()=>({id:'actor-A'})},
    '@/lib/career-profile/http':{
      ProfileError:class ProfileError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}},
      profileErrorResponse:error=>({error:error?.message}),
      profileJson:async()=>({preferences,save:false,language:'en'}),
    },
    '@/lib/resume-editor':{normalizeEditorResume:()=>cv},
    '@/lib/find-jobs/service':{getJobsPool:async()=>({jobs,warnings:[],limited:false})},
    '@/lib/find-jobs/for-you':{
      defaultMatchingPreferences:preferences,matchingPreferencesSchema:schema,resumeEvidence:()=> 'Experience with React TypeScript and applications',
    },
    '@/lib/agentic/agents/job-discovery/agent/job-discovery.agent':{runJobDiscoveryAgent:run},
    '@/lib/agentic/agents/job-discovery/tools/context.tool':{candidateFromResume:()=>({targetJobTitle:'Frontend Engineer'})},
    '@/lib/agentic/agents/job-discovery/tools/filter.tool':{strictDiscoveryFilter: jobs=>({filtered:jobs})},
    '@/lib/agentic/agents/job-discovery/tools/rank.tool':{shortlistRelevantJobs:jobs=>jobs,DISCOVERY_RESULTS_LIMIT:5},
    '@/lib/career-profile/schema':{defaultJobPreferences:{},jobPreferencesSchema:{catch:()=>schema}},
    '@/lib/career-profile/countries':{residenceCountries:()=>[]},
  };
  const content = fs.readFileSync(file,'utf8');
  const code = ts.transpileModule(content,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const mod = {exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{
    Buffer,Array,Object,Number,Date,Set,Map,String,JSON,Promise,console,
    AbortController,AbortSignal,
  })(id=>{if(id in mocks)return mocks[id];throw Error('Unexpected import '+id);},mod,mod.exports);
  return mod.exports;
}

test('the HTTP route preserves partial scores and never re-invokes the graph after completion',async()=>{
  let graphRuns=0;
  const route = loadRoute(async ({deps}) => {
    graphRuns++;
    const map=deps.previousVerifiedMatches;
    if(graphRuns===1){
      assert.equal(map.size,0);
      return {jobs:[{id:'a',match:{score:76,matched:[],missing:[],explanation:'Evidence'}},
                    {id:'b',match:{score:null,matched:[],missing:[],explanation:'Not checked'}}],
        verifiedCount:1,deepMatchCount:2,warningCode:'AI_FAILED',countries:[],warnings:[],matchingStatus:'partial',totalConsidered:3};
    }
    assert.equal(map.get('a').score,76);
    assert.equal(map.has('b'),false);
    return {jobs:[{id:'a',match:{score:76,matched:[],missing:[],explanation:'Evidence'}},
                  {id:'b',match:{score:81,matched:[],missing:[],explanation:'Evidence'}}],
      verifiedCount:2,deepMatchCount:2,warningCode:null,countries:[],warnings:[],matchingStatus:'verified',totalConsidered:3};
  });
  const req={signal:new AbortController().signal};
  const first=await route.POST(req);
  const second=await route.POST(req);
  const third=await route.POST(req);
  assert.equal(first.body.verifiedCount,1);
  assert.equal(second.body.verifiedCount,2);
  assert.equal(third.body.cached,true);
  assert.equal(graphRuns,2);
  assert.equal(second.headers['Cache-Control'],'private, no-store');
});
