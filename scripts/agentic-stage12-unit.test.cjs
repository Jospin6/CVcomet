const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const base = 'src/lib/agentic/agents/career-map/';
const loader = (relative, deps={}) => {
  const file=path.join(root,relative);
  const js=ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const module={exports:{}};
  const requireMock=id=>{if(Object.hasOwn(deps,id))return deps[id];throw Error(`Unexpected dependency ${id} in ${relative}`);};
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{
    console,AbortController,AbortSignal,Date,Map,Set,WeakSet,Promise,Error,
  })(requireMock,module,module.exports);
  return module.exports;
};
const catalog=loader(base+'tools/catalog.tool.ts');
const evidence=loader(base+'tools/evidence.tool.ts');
const rank=loader(base+'tools/rank.tool.ts',{'./catalog.tool':catalog,'./evidence.tool':evidence});
const roadmap=loader(base+'tools/roadmap.tool.ts',{'./catalog.tool':catalog});
const verify=loader(base+'tools/verify.tool.ts',{'./catalog.tool':catalog});
const preferences={targetRoles:[],interests:[],workMode:'ANY',goal:'EXPLORATION',
  balance:'BALANCED',identity:'SPECIALIST',income:'COMFORTABLE',qualities:[],positions:9};
const profile=(patch={})=>({name:'Test Candidate',headline:'Senior AI Engineer',
  skills:'React, TypeScript, Python', targetJobTitle:'AI Solutions Architect',targetIndustry:'Technology',
  experienceLevel:'SENIOR',experiences:[{title:'Developer',description:'Built services using SQL and PostgreSQL.'}],
  projects:[{title:'Data project',description:'Experimented with machine learning using Python'}],
  certifications:[],...patch});
const cv=(patch={})=>({id:'cv-owned',title:'Resume A',skills:{hardskills:['Docker','Kubernetes']},
  experiences:[{title:'React developer',description:['Implemented cloud monitoring and Git workflows']}],
  projects:[{title:'Project Node',description:'Used API and Node.js'}],certifications:[],educations:[],languages:[],...patch});
const plain=x=>JSON.parse(JSON.stringify(x));

test('stage12 only explicit skill and professional evidence counts, not target title/headline',()=>{
  const src=evidence.extractCareerEvidence(profile({skills:'',experiences:[],projects:[],certifications:[]}),null);
  assert.equal(src.length,0);
  const roles=rank.rankCareerRoles(src,{...preferences,targetRoles:['AI Engineer']});
  const ai=roles.find(x=>x.roleId==='ai-engineer');
  assert.ok(ai);assert.equal(ai.acquired.length,0);
  assert.equal(ai.priority,20);
});

test('stage12 source labels trace skills from the selected owned CV and profile',()=>{
  const sources=evidence.extractCareerEvidence(profile(),cv());
  const r=rank.rankCareerRoles(sources,{...preferences,targetRoles:['DevOps Engineer']});
  const devops=r.find(x=>x.roleId==='devops-engineer');
  assert.ok(devops);assert.ok(devops.acquired.includes('docker'));
  assert.ok(devops.acquired.includes('kubernetes'));
  assert.ok(devops.evidence.find(x=>x.skill==='docker').sources.includes('resume.skills'));
  assert.ok(sources.some(x=>x.source==='resume.experiences'));
  assert.ok(!sources.some(x=>x.text.includes('Senior AI Engineer')));
});

test('stage12 no partial word / negated competence / untrusted CV titles as evidence',()=>{
  assert.equal(evidence.evidenceMentionsSkill('I said something earlier','ai'),false);
  assert.equal(evidence.evidenceMentionsSkill('No experience with Python','python'),false);
  assert.equal(evidence.evidenceMentionsSkill('No experience with Python. Later built Python tools','python'),true);
  assert.equal(evidence.evidenceMentionsSkill('Worked with React Native','react'),true);
  assert.equal(evidence.evidenceMentionsSkill('PyTorch pipeline','python'),false);
  const v={experiences:[{title:'Docker Kubernetes',company:'React API',description:'general experience'}]};
  const out=evidence.flattenCandidateText(v.experiences,'description');
  assert.deepEqual(plain(out),['general experience']);
});

test('stage12 deterministic compatibility, explanation, edges and verifiable roadmap',()=>{
  const r=rank.rankCareerRoles(evidence.extractCareerEvidence(profile(),cv()),preferences);
  const graph=roadmap.makeCareerMapGraph(r);
  assert.equal(graph.nodes.length,9);assert.equal(graph.edges.length,9);
  assert.equal(graph.version,2);assert.equal(graph.methodology,'catalog-skill-overlap');
  assert.equal(verify.verifyCareerMapGraph(graph),true);
  const each=graph.nodes[0];
  assert.equal(each.compatibility,Math.round(each.acquired.length*100/(each.acquired.length+each.missing.length)));
  assert.ok(each.plan.every(x=>each.missing.some(skill=>x.id===`${each.id}-${skill}`)));
  assert.match(graph.disclaimer,/not a hiring probability/);
});

test('stage12 rejects tampered score, orphan edges and invented skills',()=>{
  const graph=roadmap.makeCareerMapGraph(rank.rankCareerRoles(
    evidence.extractCareerEvidence(profile(),cv()),preferences));
  assert.throws(()=>verify.verifyCareerMapGraph({...graph,nodes:[{...graph.nodes[0],compatibility:99},...graph.nodes.slice(1)]}));
  assert.throws(()=>verify.verifyCareerMapGraph({...graph,edges:[{from:'profile',to:'unrelated'},...graph.edges.slice(1)]}));
  assert.throws(()=>verify.verifyCareerMapGraph({...graph,nodes:[{...graph.nodes[0],acquired:['fictional-skill']},...graph.nodes.slice(1)]}));
});

test('stage12 respects 4..12 roles without filling with fictitious career suggestions',()=>{
  for(const positions of [4,9,12]) {
    const graph=roadmap.makeCareerMapGraph(rank.rankCareerRoles([], {...preferences,positions}));
    assert.equal(graph.nodes.length,positions);
    assert.ok(graph.nodes.every(x=>x.compatibility===0));
    assert.equal(verify.verifyCareerMapGraph(graph),true);
  }
});

const fakeZ = new Proxy({}, {get:(_,key)=>{
  if(['object','array','string','number','enum'].includes(key))return () => chain;
  return undefined;
}});
const chain=new Proxy({parse:x=>x}, {get:(obj,key)=>obj[key]||(()=>chain)});
const ProfileError=class ProfileError extends Error { constructor(status,code){super(code);this.status=status;this.code=code;} };
let graphShouldFail=false;
const fakeAgent={runCareerMapAgent:async()=>{
 if(graphShouldFail) throw Object.assign(new Error('graph unavailable'),{code:'AGENT_RUN_FAILED'});
 return {graph:roadmap.makeCareerMapGraph(rank.rankCareerRoles([],preferences)),
 snapshot:{name:'Test',headline:'',experienceLevel:'',sourceCvTitle:null,skillSource:'profile'}};
}};
const prismaCalls=[];
let ownedCv=cv(),mapRecord=null;
const prisma={
  cv:{findFirst:async args=>{prismaCalls.push(['cv',plain(args)]);return ownedCv;}},
  careerMap:{create:async args=>{prismaCalls.push(['save',plain(args)]);return {id:'map-created',...args.data};},
    findFirst:async args=>{prismaCalls.push(['map',plain(args)]);return mapRecord;}},
  careerGoal:{upsert:async args=>{prismaCalls.push(['goal',plain(args)]);return args;}},
};
const svc=loader('src/lib/career-map/service.ts',{
  'zod':{z:fakeZ},'../../../prisma/prisma':{default:prisma},
  '@/lib/career-profile/service':{getCareerProfile:async()=>profile()},
  '@/lib/career-profile/http':{ProfileError},
  '@/lib/agentic/agents/career-map/agent/career-map.agent':fakeAgent,
  '@/lib/agentic/agents/career-map/tools/catalog.tool':catalog,
  '@/lib/agentic/agents/career-map/tools/preferences.tool':{preferenceSchema:chain},
  '@/lib/agentic/agents/career-map/tools/evidence.tool': evidence,
  '@/lib/agentic/agents/career-map/tools/rank.tool': rank,
  '@/lib/agentic/agents/career-map/tools/roadmap.tool': roadmap,
  '@/lib/agentic/agents/career-map/tools/verify.tool': verify,
});

test('stage12 existing createMap route contract invokes graph after selected CV ownership lookup',async()=>{
  prismaCalls.length=0;ownedCv=cv();
  const result=await svc.createMap('actor-1',{cvId:'owned-cv-id',preferences});
  assert.equal(result.id,'map-created');
  const cvCall=prismaCalls.find(x=>x[0]==='cv')[1];
  assert.equal(cvCall.where.conversation.userId,'actor-1');
  assert.equal(cvCall.where.id,'owned-cv-id');
  const save=prismaCalls.find(x=>x[0]==='save')[1];
  assert.equal(save.data.userId,'actor-1');assert.equal(save.data.cvId,'cv-owned');
  assert.equal(save.data.graph.nodes.length,9);
});

test('stage12 rejects a CV the user does not own before any graph persistence',async()=>{
  prismaCalls.length=0;ownedCv=null;
  await assert.rejects(svc.createMap('actor-1',{cvId:'foreign-cv',preferences}),{code:'CV_NOT_FOUND'});
  assert.equal(prismaCalls.filter(x=>x[0]==='save').length,0);
  ownedCv=cv();
});

test('stage12 saves goals only for nodes on an owned map with known plan steps',async()=>{
  const graph=roadmap.makeCareerMapGraph(rank.rankCareerRoles([],preferences));
  const role=graph.nodes[0];mapRecord={graph};prismaCalls.length=0;
  await svc.createGoal('actor-1',{roleId:role.id,mapId:'owned-map',completedStepIds:[role.plan[0].id]});
  const lookup=prismaCalls.find(x=>x[0]==='map')[1];
  assert.equal(lookup.where.userId,'actor-1');
  const payload=prismaCalls.find(x=>x[0]==='goal')[1];
  assert.equal(payload.create.plan.length,role.plan.length);
  assert.deepEqual(payload.create.completedStepIds,[role.plan[0].id]);
  assert.equal(payload.update.careerMapId,'owned-map');
});

test('stage12 rejects goals for absent map, absent role, fabricated progress',async()=>{
  const graph=roadmap.makeCareerMapGraph(rank.rankCareerRoles([],preferences));
  const role=graph.nodes[0];mapRecord=null;
  await assert.rejects(svc.createGoal('actor-1',{roleId:role.id,mapId:'missing'}),{code:'MAP_NOT_FOUND'});
  mapRecord={graph};
  await assert.rejects(svc.createGoal('actor-1',{roleId:'unknown',mapId:'owned-map'}),{code:'UNKNOWN_ROLE'});
  const outsider=catalog.roleCatalog.find(x=>!graph.nodes.some(n=>n.id===x.id));
  await assert.rejects(svc.createGoal('actor-1',{roleId:outsider.id,mapId:'owned-map'}),{code:'ROLE_NOT_IN_MAP'});
  await assert.rejects(svc.createGoal('actor-1',{roleId:role.id,mapId:'owned-map',completedStepIds:['injected']}),{code:'INVALID_GOAL_PROGRESS'});
  await assert.rejects(svc.createGoal('actor-1',{roleId:role.id,mapId:'owned-map',completedStepIds:[role.plan[0].id,role.plan[0].id]}),{code:'INVALID_GOAL_PROGRESS'});
});

test('stage12 saving an existing goal without progress update does not erase completed steps',async()=>{
  const graph=roadmap.makeCareerMapGraph(rank.rankCareerRoles([],preferences));
  const role=graph.nodes[0];mapRecord={graph};prismaCalls.length=0;
  await svc.createGoal('actor-1',{roleId:role.id,mapId:'owned-map'});
  const payload=prismaCalls.find(x=>x[0]==='goal')[1];
  assert.equal(Object.hasOwn(payload.update,'completedStepIds'),false);
});

test('Career Map safely computes the same catalog result when LangGraph execution fails',async()=>{
 const before=prismaCalls.length;
 graphShouldFail=true;
 try {
   const generated=await svc.createMap('actor-1',{cvId:null,preferences});
   assert.equal(generated.graph.nodes.length,preferences.positions);
   assert.equal(generated.graph.version,2);
   assert.equal(verify.verifyCareerMapGraph(generated.graph),true);
   assert.equal(generated.profile.skillSource,'profile');
   assert.equal(prismaCalls.slice(before).filter(x=>x[0]==='save').length,1);
 } finally {graphShouldFail=false;}
});

test('Career Map never uses the fallback when the request is cancelled',async()=>{
 const previous=prismaCalls.filter(x=>x[0]==='save').length;
 const controller=new AbortController();
 controller.abort();
 graphShouldFail=true;
 try {
  await assert.rejects(svc.createMap('actor-1',{cvId:null,preferences},controller.signal),{code:'AGENT_RUN_FAILED'});
  assert.equal(prismaCalls.filter(x=>x[0]==='save').length,previous);
 } finally {graphShouldFail=false;}
});
