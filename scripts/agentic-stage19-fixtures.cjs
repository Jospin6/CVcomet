const {read,load}=require('./agentic-stage17-fixtures.cjs');
const base='src/lib/agentic/agents/evaluation/';
const metrics=load(base+'tools/metrics.tool.ts');
const policy=load(base+'tools/policy.tool.ts');
const now=new Date('2026-11-01T00:00:00.000Z');
const from=new Date(now.getTime()-7*86400000);
function evidence({completed=48,failed=2,p95=32000,missionCompleted=48,missionFailed=2,tracked=40,priced=40,lease=0}={}) {
 const total=completed+failed;
 return {
  career:{ scope:'career_agent_only',from:from.toISOString(),until:now.toISOString(),total,completed,failed,
   observedSuccessRate:total?Math.round(completed/total*1000)/10:null,
   latencyMs:{p50:12500,p95,sampledCompleted:completed,totalCompleted:completed,sampleCap:1000},
   errors:[{code:'AGENT_FAILED',count:failed}],
   feedback:{helpful:5,notHelpful:2,total:7,positiveShare:71.4,note:'Voluntary feedback'},
   excluded:['unrated_answers'],note:'Operational sample only'},
  runStatuses:[{key:'COMPLETED',count:missionCompleted},{key:'FAILED',count:missionFailed}],
  progressEvents:[{key:'tool.started',count:12},{key:'tool.completed',count:11},{key:'tool.failed',count:1}],
  expiredRunningLeases:lease,
  aiUsage:{trackedCalls:tracked,pricedCalls:priced,inputTokens:500,outputTokens:200,
   estimatedUSD:tracked===priced&&tracked?'0.082000':null},
 };
}
module.exports={read,load,base,metrics,policy,now,from,evidence};
