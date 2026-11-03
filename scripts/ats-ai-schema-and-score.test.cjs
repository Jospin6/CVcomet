const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const base = path.join(__dirname, '..');
function load(file) {
  const source = fs.readFileSync(path.join(base, file), 'utf8');
  const compiled = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require(name) { throw Error('Unexpected dependency: ' + name); } }, { filename: file });
  return module.exports;
}
const { normalizeAtsReviewShape } = load('src/lib/agentic/agents/ats/tools/normalize-review.tool.ts');
const { atsDisplayScore } = load('src/lib/career/ats-display-score.ts');

test('Repairs provider JSON shape with aliases, null optional proposals, string ratings and lowercase enums', () => {
  const raw = {
    skill_evidence: [{ term: 'TypeScript', status: 'unsupported', sources: null, extra: 'ignored' }],
    contributions: [{ field: 'projects.0.description', action_quote: 'Created website', method_quote: null, outcome_quote: null, outcome_type: 'task_only' }],
    criteria: { specificity: { score: '0', explanation: 'Insufficient detail in the document', sources: null }, positioning: { rating: 0, reason: 'No supported positioning yet', evidence: [] }, writing: { rating: 0, reason: 'Text not evaluated', evidence: [] } },
    recommendations: [{ field: 'projects.0.description', severity: 'WARNING', title: 'Expand details', reason: 'The item needs more information', action: 'Add the real contribution details', quote: 'Created website', proposedText: null }],
  };
  const result = normalizeAtsReviewShape(raw);
  assert.equal(result.criteria.length, 3);
  assert.equal(result.criteria[0].rating, 0);
  assert.equal(result.skillEvidence[0].status, 'UNSUPPORTED');
  assert.equal(result.contributions[0].methodQuote, '');
  assert.equal(result.issues[0].severity, 'warning');
  assert.equal(result.issues[0].proposedText, '');
  assert.equal(result.skillEvidence[0].extra, undefined);
});

test('Never invents positive ratings, missing citations or contributions', () => {
  const result = normalizeAtsReviewShape({ criteria: [{ id: 'writing', rating: 3, reason: 'Nice writing' }], issues: [] });
  assert.equal(result.criteria[0].evidence, undefined);
  assert.equal(result.contributions, undefined);
  assert.equal(result.skillEvidence, undefined);
});

test('Complete content score remains the same and job score is independent', () => {
  const report = { content: { score: 73, checks: [] }, jobMatch: { status: 'NOT_PROVIDED', score: null } };
  assert.equal(atsDisplayScore(report).score, 73);
  assert.equal(atsDisplayScore(report).kind, 'content');
  assert.equal(atsDisplayScore({ ...report, jobMatch: { status: 'COMPLETE', score: 61 } }).score, 61);
});

test('When AI review is unavailable, score is based only on actually evaluated weighted checks', () => {
  const report = { content: { score: null, earned: 25, assessedWeight: 30,
    checks: [ { weight: 10, earned: 10 }, { weight: 10, earned: 5 }, { weight: 10, earned: 10 }, { weight: 20, earned: null }, { weight: 50, earned: null } ] },
    jobMatch: { status: 'NOT_PROVIDED', score: null } };
  assert.deepEqual(JSON.parse(JSON.stringify(atsDisplayScore(report))), { score: 83, kind: 'verified', assessedWeight: 30 });
  assert.equal(report.content.score, null);
});

test('Zero assessed checks never produces a fabricated score', () => {
  const report = { content: { score: null, checks: [{ weight: 40, earned: null }] }, jobMatch: { status: 'UNAVAILABLE', score: null } };
  assert.equal(atsDisplayScore(report).score, null);
});

test('ATS graph is sequential, with no parallel state join', () => {
  const source = fs.readFileSync(path.join(base, 'src/lib/agentic/agents/ats/agent/graph.ts'), 'utf8');
  assert.match(source, /\.addEdge\("review", "job-match"\)/);
  assert.match(source, /\.addEdge\("job-match", "assemble"\)/);
  assert.doesNotMatch(source, /\.addEdge\(\["review", "job-match"\]/);
});

test('Result header does not render generic Partial / Resume checks available copy', () => {
  const source = fs.readFileSync(path.join(base, 'src/components/resumes/resume-ats-panel.tsx'), 'utf8');
  assert.doesNotMatch(source, /Resume checks available|objective checks completed|Available checks are shown/);
  assert.match(source, /atsDisplayScore\(analysis\)/);
  assert.match(source, /numericScore\(headlineScore\)/);
});

test('LangGraph node names are distinct from Annotation state channels', () => {
  const graph = fs.readFileSync(path.join(base, 'src/lib/agentic/agents/ats/agent/graph.ts'), 'utf8');
  const state = fs.readFileSync(path.join(base, 'src/lib/agentic/agents/ats/agent/state.ts'), 'utf8');
  const nodeNames = [...graph.matchAll(/\.addNode\("([^"]+)"/g)].map(match => match[1]);
  const channels = [...state.matchAll(/^  ([A-Za-z]+): Annotation</gm)].map(match => match[1]);
  assert.equal(nodeNames.length, 6);
  assert.equal(new Set(nodeNames).size, nodeNames.length);
  assert.deepEqual(nodeNames.filter(node => channels.includes(node)), []);
  assert.ok(nodeNames.includes('plan-analysis'));
  assert.ok(nodeNames.includes('prepare-model'));
});

test('Graph compiles and completes all six nodes in an isolated LangGraph-compatible harness', async () => {
  const sourceFile = 'src/lib/agentic/agents/ats/agent/graph.ts';
  const source = fs.readFileSync(path.join(base, sourceFile), 'utf8');
  const compiled = ts.transpileModule(source, { fileName: sourceFile, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const channels = { input: true, plan: true, model: true, modelError: true, semantic: true, jobMatch: true, report: true, verified: true };
  class StateGraphHarness {
    constructor(state) { this.channels = state; this.nodes = new Map(); this.edges = new Map(); }
    addNode(name, fn) {
      if (name in this.channels) throw Error('Node collides with state channel: ' + name);
      this.nodes.set(name, fn); return this;
    }
    addEdge(source, destination) { this.edges.set(source, destination); return this; }
    compile() {
      const graph = this;
      return { async invoke(initial) {
        const state = { ...initial }; let next = graph.edges.get('__start__');
        while (next && next !== '__end__') {
          Object.assign(state, await graph.nodes.get(next)(state)); next = graph.edges.get(next);
        }
        return state;
      } };
    }
  }
  const spy = [];
  const mocks = {
    '@langchain/langgraph': { StateGraph: StateGraphHarness, START: '__start__', END: '__end__' },
    '../../../core/nodes/traced-node.ts': { tracedNode: (_scope, name, fn) => state => { spy.push(name); return fn(state); } },
    './state': { AtsAgentState: channels },
    '../nodes/plan.node': { atsPlanNode: () => ({ plan: { visible: {} } }) },
    '../nodes/model.node': { createAtsModelNode: () => () => ({ model: { id: 'test' } }) },
    '../nodes/review.node': { createAtsReviewNode: () => () => ({ semantic: { status: 'COMPLETE' } }) },
    '../nodes/job-match.node': { createAtsJobMatchNode: () => () => ({ jobMatch: { status: 'NOT_PROVIDED' } }) },
    '../nodes/assemble.node': { atsAssembleNode: () => ({ report: { version: 2 } }) },
    '../nodes/verify.node': { atsVerifyNode: () => ({ verified: true }) },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require(name) {
    if (!(name in mocks)) throw Error('Unexpected import ' + name);
    return mocks[name];
  } }, { filename: sourceFile });
  const graph = module.exports.createAtsAgentGraph({});
  const result = await graph.invoke({ input: {} });
  assert.equal(result.verified, true);
  assert.equal(result.report.version, 2);
  assert.deepEqual(spy, ['ats.plan', 'ats.model', 'ats.review', 'ats.job-match', 'ats.assemble', 'ats.verify']);
});
