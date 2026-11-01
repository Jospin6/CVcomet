const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./agentic-stage14-fixtures.cjs');

function zodStub(){
  const chain={uuid(){return this},enum(){return this},trim(){return this},min(){return this},max(){return this},int(){return this},strict(){return this},parse(value){return value}};
  return {z:{object:()=>chain,string:()=>chain,number:()=>chain,array:()=>chain,enum:()=>chain,literal:()=>chain}};
}
function setup(){
  const id='bbbbbbbb-1111-4111-8111-aaaaaaaaaaaa';
  const roomName=`cvcomet-screening-${id}`;
  const row={id,userId:'owner',applicationId:'app',status:'VOICE_ACTIVE',
    configuration:{consent:true,roomName,language:'fr',jobTitle:'Ingénieur',company:'Test',
      jobDescription:'API',resumeText:'CV'}};
  const effects={claims:0,commits:0,transcripts:[],evalCalls:0,preparations:0};
  const table={
    async findUnique(){return {...row}},
    async updateMany({where,data}){
      const accepted=Array.isArray(where.status?.in) ? where.status.in.includes(row.status) : row.status===where.status;
      if(!accepted)return {count:0};
      if(data.status==='VOICE_EVALUATING')effects.claims++;
      else effects.commits++;
      Object.assign(row,data);
      return {count:1};
    },
  };
  const prisma={interviewSession:table,$transaction:async(fn)=>fn({
    interviewSession:table,interviewMessage:{async createMany({data}){effects.transcripts.push(...data)}}
  })};
  const mockReport={kind:'AI_SCREENING',status:'evaluated',dimensions:{cvConsistency:80,jobRelevance:80,
    communication:80,motivation:80,experience:80,professionalism:80},overallScore:80,
    answers:2,evidence:[],strengths:[],improvements:[],recommendedAction:'Practice',summary:'Good',
    disclaimer:'Practice feedback only; not a hiring prediction.'};
  const module=load('src/lib/career/screening.ts',{
    '../../../prisma/prisma':{default:prisma},'zod':zodStub(),
    'ai':{generateObject:async()=>({object:{}})},'@/lib/ai/model':{getAIModel:async()=>null},
    '@/lib/career-profile/ai':{reserveProfileAI:async()=>{}},
    '@/lib/career-profile/http':{ProfileError:class ProfileError extends Error{constructor(status,code){super(code);this.code=code;this.status=status}}},
    './screening-policy':{countUsableAnswers:turns=>turns.filter(t=>t.role==='user'&&t.text.trim().length>3).length},
    '@/lib/agentic/agents/interview-voice/agent/interview-voice.agent':{
      runVoicePreparationAgent:async({actorId,input})=>{effects.preparations++;assert.equal(actorId,'owner');return {...input,instructions:'verified',openingInstructions:'hello'}},
      runVoiceEvaluationAgent:async()=>{effects.evalCalls++;await new Promise(resolve=>setTimeout(resolve,5));return mockReport},
    },
    '@/lib/agentic/agents/interview-voice/tools/validation.tool':{
      unavailableVoiceReport:()=>({kind:'AI_SCREENING',status:'unavailable',overallScore:null,dimensions:null,answers:0})},
    '@/lib/agentic/agents/interview-voice/prompts/voice.prompt':{buildVoiceEvaluationPrompt:()=>({system:'',prompt:''})},
  });
  return {module,effects,row,id,roomName};
}

test('stage14 worker context cannot start after call has entered evaluation',async()=>{
  const {module,row,id,effects}=setup();
  const result=await module.getScreeningForWorker(id);
  assert.equal(result.sessionId,id);assert.equal(effects.preparations,1);
  row.status='VOICE_EVALUATING';
  await assert.rejects(module.getScreeningForWorker(id),e=>e.code==='SCREENING_NOT_ACTIVE');
});

test('stage14 independent concurrent finalization callbacks pay once and save transcript once',async()=>{
  const {module,effects,id,roomName,row}=setup();
  const payload={sessionId:id,roomName,turns:[
    {role:'user',text:'I built the service'}, {role:'assistant',text:'What next?'},
    {role:'user',text:'I shipped the backend'}]};
  const [first,second]=await Promise.all([module.completeScreening(payload),module.completeScreening(payload)]);
  assert.equal(first.status,'completed');assert.equal(second.status,'processing');
  assert.equal(effects.claims,1);assert.equal(effects.evalCalls,1);
  assert.equal(effects.commits,1);assert.equal(effects.transcripts.length,3);
  assert.equal(row.status,'COMPLETED');
  const replay=await module.completeScreening(payload);
  assert.equal(replay.status,'COMPLETED');assert.equal(effects.transcripts.length,3);
});

test('stage14 wrong room or consent cannot claim evaluation and persist anything',async()=>{
  const {module,row,id,effects}=setup();
  const turns=[{role:'user',text:'I built it'},{role:'user',text:'I tested it'}];
  await assert.rejects(module.completeScreening({sessionId:id,roomName:'another-room',turns}),e=>e.code==='SCREENING_ROOM_MISMATCH');
  assert.equal(effects.claims,0);
  row.configuration.consent=false;
  await assert.rejects(module.completeScreening({sessionId:id,roomName:row.configuration.roomName,turns}),e=>e.code==='SCREENING_ROOM_MISMATCH');
  assert.equal(effects.commits,0);
});
