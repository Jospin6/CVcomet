import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const root='src/lib/agentic/agents/job-discovery/';
const files=[
 'agent/job-discovery.agent.ts','agent/graph.ts','agent/state.ts',
 'nodes/context.node.ts','nodes/discover.node.ts','nodes/filter.node.ts',
 'nodes/rank.node.ts','nodes/match.node.ts','nodes/assemble.node.ts',
 'tools/contracts.tool.ts','tools/context.tool.ts','tools/discover.tool.ts',
 'tools/filter.tool.ts','tools/rank.tool.ts','tools/match.tool.ts',
 'prompts/discovery.prompt.ts',
];
test('stage11: LangGraph job discovery has isolated four-layer implementation',()=>{
 for (const p of files) assert.ok(existsSync(new URL('../'+root+p,import.meta.url)),p);
 const graph=read(root+'agent/graph.ts');
 assert.match(graph,/StateGraph\(JobDiscoveryState\)/);
 for (const node of ['context','discover','filter','rank','match','assemble'])
   assert.ok(graph.includes(`.addNode("${node}"`),node);
 for(const edge of ['"context", "discover"','"discover", "filter"','"filter", "rank"',
   '"rank", "match"','"match", "assemble"']) assert.ok(graph.includes(edge),edge);
 assert.doesNotMatch(graph,/\.addNode\("(?:save|apply|publish|send)"/i);
});
test('stage11: route enforces authenticated CV ownership and quotas in safe adapter',()=>{
 const route=read('src/app/api/find-jobs/for-you/route.ts');
 const adapter=read(root+'tools/match.tool.ts');
 assert.match(route,/getSessionUser\(\)/);
 assert.match(route,/conversation:\s*\{ userId: user\.id \}/);
 assert.match(route,/runJobDiscoveryAgent\(\{/);
 assert.match(route,/save:\s*z\.boolean\(\)\.default\(true\)/);
 assert.match(route,/getJobsPool\(""\)/);
 assert.match(route,/createHash\("sha256"\)\.update\(job\.description\)/);
 assert.match(adapter,/reserveProfileAI\(userId, "JOB_ANALYSIS"\)/);
 assert.match(adapter,/runJobMatchAgent\(\{/);
 assert.match(adapter,/profile:\s*emptyProfile/);
 assert.doesNotMatch(route,/generateObject|verifiedMatchScore|rankJobs\(/);
});
test('stage11: no fictitious offers, no heuristic match %, no write tool',()=>{
 const discovery=read(root+'tools/discover.tool.ts');
 const ranking=read(root+'tools/rank.tool.ts');
 const match=read(root+'nodes/match.node.ts');
 assert.match(discovery,/getJobsPool/);
 assert.match(discovery,/validExternalJob\(job\)/);
 assert.match(discovery,/u\.protocol === "https:"/);
 assert.match(ranking,/\.filter\(item => item\.match\.relevant\s*\|\|/);
 assert.match(ranking,/match: _heuristic/);
 assert.match(match,/Promise\.all\(/);
 assert.match(match,/unresolvedDiscoveryMatch/);
 assert.doesNotMatch(match,/\.create\(|\.update\(|\.delete\(|generateObject/);
});
test('stage11: Jobs for You retains CV selection, filters and explicit application path',()=>{
 const component=read('src/components/jobs/jobs-for-you.tsx');
 const page=read('src/app/dashboard/find-jobs/page.tsx');
 assert.match(component,/\/api\/find-jobs\/for-you/);
 assert.match(component,/verifiedCount/);
 assert.match(component,/deepMatchCount/);
 assert.match(component,/setPicker\(true\)/);
 assert.match(page,/\/api\/applications/);
 assert.match(page,/reopenExisting: true/);
 assert.match(page,/onPrepare/);
});
