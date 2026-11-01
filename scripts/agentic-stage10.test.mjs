import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const root = 'src/lib/agentic/agents/job-match/';
const components = [
 'agent/state.ts', 'agent/graph.ts', 'agent/job-match.agent.ts',
 'nodes/plan.node.ts', 'nodes/extract.node.ts', 'nodes/compare.node.ts',
 'nodes/verify.node.ts', 'nodes/prioritize.node.ts', 'nodes/assemble.node.ts',
 'tools/plan.tool.ts', 'tools/extract.tool.ts', 'tools/compare.tool.ts',
 'tools/verify.tool.ts', 'tools/resume-actions.tool.ts',
 'prompts/improvements.prompt.ts',
];
test('stage10: four isolated agent layers are present and implemented', () => {
 for (const path of components) assert.ok(existsSync(new URL(`../${root}${path}`, import.meta.url)), `${path} missing`);
 const graph=read(root+'agent/graph.ts');
 assert.match(graph,/StateGraph\(JobMatchAgentState\)/);
 for(const node of ['plan','extract','compare','verify','prioritize','assemble']) assert.ok(graph.includes(`.addNode("${node}"`));
 for(const edge of ['"plan", "extract"','"extract", "compare"','"compare", "verify"','"verify", "prioritize"','"prioritize", "assemble"']) assert.ok(graph.includes(edge));
 assert.doesNotMatch(graph,/\.addNode\("save"/i);
});
test('stage10: job match API keeps ownership, feature check, quota, cache and transaction', () => {
 const route=read('src/app/api/job-match/route.ts');
 for (const code of ['requireUser()', 'requireFeature(user.id, "JOB_MATCH")', 'userId: user.id', 'conversation: { userId: user.id }', 'reserveProfileAI(user.id, "JOB_ANALYSIS")', 'validateSavedJobAnalysis', 'runJobMatchAgent(', 'prisma.$transaction', 'jobMatch.create', 'fingerprint', 'version: 3']) assert.ok(route.includes(code), `Missing: ${code}`);
 assert.doesNotMatch(route, /await matchJob\(|await analyzeJobDescription\(/);
});
test('stage10: deterministic score, source grounding, no fabricated edits', () => {
 const compare=read(root+'tools/compare.tool.ts');
 const verify=read(root+'tools/verify.tool.ts');
 const plan=read(root+'tools/resume-actions.tool.ts');
 assert.match(compare,/matchJob\(input.profile, analysis, input.resume\)/);
 assert.match(verify,/validateJobAnalysis\(analysis, input.description\)/);
 assert.match(verify,/careerEvidence\(input.profile, input.resume\)/);
 assert.match(verify,/JSON.stringify\(result.requirements\)/);
 assert.match(plan,/requiresApproval: true/);
 assert.match(plan,/REVIEW_GAP/);
 assert.doesNotMatch(plan,/\.update\(|\.create\(|\.save\(|generateObject|generateText/);
});
test('stage10: report preserves the four tabs and explicit user approval', () => {
 const report=read('src/components/career/job-match-report.tsx');
 const page=read('src/app/dashboard/job-match/page.tsx');
 for(const label of ['overview','improvements','requirements','prepare']) assert.ok(report.includes(`value: "${label}"`));
 assert.ok(report.includes('match.resumePlan'));
 assert.ok(report.includes('onTailor'));
 assert.match(page, /action: "ACCEPT", matchId: result.id/);
 assert.match(page, /action: "REJECT"/);
});
