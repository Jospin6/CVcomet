const {read,load}=require('./agentic-stage17-fixtures.cjs');
const prefix='src/lib/agentic/agents/mission-stream/';
const kinds=load(prefix+'tools/events.tool.ts');
const sse=load(prefix+'tools/sse.tool.ts',{'./events.tool':kinds});
class CareerContractError extends Error {
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
function createDB(){
  const events=[];
  let run={id:'run-alice',userId:'alice',missionId:'mission-1',requestKey:'req-1',status:'RUNNING',attempt:1,
    leaseUntil:new Date(Date.now()+60_000),errorCode:null};
  const db={
    careerMission:{async findFirst({where}){return where.id==='mission-1'&&where.userId==='alice'?{id:'mission-1'}:null;}},
    careerMissionRun:{async findFirst({where}){if(!run||where.userId!==run.userId||where.missionId!==run.missionId||where.requestKey!==run.requestKey)return null;return {...run};}},
    careerMissionProgressEvent:{
      async create({data}){const e={...data,id:BigInt(events.length+1),createdAt:new Date()};events.push(e);return e;},
      async findMany({where,orderBy,take}){return events.filter(e=>e.userId===where.userId&&e.missionId===where.missionId&&e.runId===where.runId&&e.attempt===where.attempt&&e.id>where.id.gt)
        .sort((a,b)=>a.id>b.id?1:-1).slice(0,take).map(e=>({...e}));},
    },
  };
  return {db,events,setRun:patch=>{run={...run,...patch}}};
}
function service(db){
  const persist=load(prefix+'nodes/persist.node.ts',{'../../../../../../prisma/prisma':{default:db},'../tools/events.tool':kinds});
  const replay=load(prefix+'nodes/replay.node.ts',{'../../../../../../prisma/prisma':{default:db},'@/lib/career-os/contracts':{CareerContractError},'../tools/events.tool':kinds});
  return {persist,replay};
}
module.exports={read,load,prefix,kinds,sse,createDB,service,CareerContractError};
