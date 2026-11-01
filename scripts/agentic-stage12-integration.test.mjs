import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));

async function runtime() {
  try {
    const agent=await import('../src/lib/agentic/agents/career-map/agent/career-map.agent.ts');
    return agent.runCareerMapAgent;
  } catch(error) {
    if(error?.code==='ERR_MODULE_NOT_FOUND'||error?.code==='MODULE_NOT_FOUND')
      assert.fail('Install npm dependencies before REAL LangGraph integration tests.');
    throw error;
  }
}
const preference={targetRoles:['Backend Engineer'],interests:[],workMode:'REMOTE',goal:'ADVANCEMENT',
 balance:'BALANCED',identity:'SPECIALIST',income:'COMFORTABLE',qualities:[],positions:6};
const profile={name:'Candidate',headline:'Software Engineer',skills:'TypeScript, Node.js, REST APIs, SQL',
 experienceLevel:'PROFESSIONAL',targetJobTitle:'Backend Engineer',targetIndustry:'Technology',
 experiences:[{title:'Engineer',description:'Built PostgreSQL services and testing.'}],
 projects:[],certifications:[]};

test('stage12 REAL LangGraph: deterministic career map, grounded evidence, action-only plan',async()=>{
 const run=await runtime();
 const result=await run({actorId:'user-12',input:{profile,cv:null,preferences:preference}});
 assert.equal(result.graph.nodes.length,6);
 assert.equal(result.graph.nodes[0].id,'backend-engineer');
 assert.equal(result.graph.methodology,'catalog-skill-overlap');
 assert.equal(result.graph.nodes[0].compatibility,Math.round(
   100*result.graph.nodes[0].acquired.length/6));
 assert.ok(result.graph.nodes.every(node=>node.plan.every(s=>node.missing.some(g=>s.id===`${node.id}-${g}`))));
 assert.ok(result.graph.nodes[0].evidence.find(x=>x.skill==='node')?.sources.includes('profile.skills'));
});

test('stage12 REAL LangGraph: CV skill evidence is isolated and preferences cannot invent it',async()=>{
 const run=await runtime();
 const input={profile:{...profile,skills:'',experiences:[]},cv:null,preferences:{...preference,targetRoles:['AI Engineer']}};
 const noResume=await run({actorId:'user-12',input});
 assert.equal(noResume.graph.nodes[0].id,'ai-engineer');
 assert.equal(noResume.graph.nodes[0].compatibility,0);
 const cv={id:'owned-by-server',title:'Resume',skills:{hard:['Python','RAG']},
   experiences:[],projects:[],educations:[],certifications:[],languages:[]};
 const withResume=await run({actorId:'user-12',input:{...input,cv}});
 assert.ok(withResume.graph.nodes[0].acquired.includes('python'));
 assert.ok(withResume.graph.nodes[0].acquired.includes('rag'));
 assert.equal(withResume.snapshot.skillSource,'profile-and-selected-resume');
});

test('stage12 REAL LangGraph: unauthenticated actor, invalid preferences and cancellation fail closed',async()=>{
 const run=await runtime();
 const base={profile,cv:null,preferences:preference};
 await assert.rejects(run({actorId:'',input:base}),error=>error.code==='AGENT_INVALID_IDENTITY');
 await assert.rejects(run({actorId:'user-12',input:{...base,preferences:{...preference,positions:100}}}),
  error=>error.code==='AGENT_MODEL_INPUT_INVALID');
 const ctl=new AbortController();ctl.abort();
 await assert.rejects(run({actorId:'user-12',input:base,signal:ctl.signal}));
});
