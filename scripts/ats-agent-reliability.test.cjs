const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  }});
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, AbortController, AbortSignal,
    console, setTimeout, clearTimeout,
    require: name => name in mocks ? mocks[name] : name.startsWith('node:') ? require(name) : (() => { throw Error('Unexpected import ' + name); })(),
  }, { filename: file });
  return module.exports;
}

const parser = load('src/lib/agentic/agents/ats/tools/parse-json.tool.ts');

test('ATS JSON extractor accepts exact JSON, fenced JSON and leading prose but never executes text', () => {
  const sample = '{"text":"a \\u007b brace and \\u007d brace", "nested":{"ok":true}}';
  for (const variant of [sample, '```json\n' + sample + '\n```', 'Here is the JSON:\n' + sample + '\nDone.']) {
    const result = parser.parseAtsJsonObject(variant);
    assert.equal(result.nested.ok, true);
  }
  assert.throws(() => parser.parseAtsJsonObject('__proto__: evil'), /ATS_JSON_RESPONSE_INVALID/);
  assert.throws(() => parser.parseAtsJsonObject('a'.repeat(120001)), /ATS_JSON_RESPONSE_INVALID/);
});

function fixture({ failure = 'early', started = [], values = {}, reportError = false } = {}) {
  const counters = { model: 0, review: 0, job: 0, verified: 0 };
  class AgenticError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
  const semantic = { status: 'COMPLETE', criteria: [], issues: [] };
  const jobMatch = { status: 'NOT_PROVIDED', score: null, requirements: [] };
  const report = { version: 2, rubricVersion: '2026-10-ats-v2', overallScore: null,
    review: { status: 'COMPLETE' }, jobMatch, content: { score: 50 }, diagnostics: [] };
  const mocks = {
    '../../../core/errors.ts': { AgenticError },
    '../../../core/execution/runner.ts': {
      runAgentGraph: async ({ createGraph }) => {
        const graph = createGraph({});
        for (const step of started) graph.progress.started.add(step);
        Object.assign(graph.progress.values, values);
        if (failure === 'success') return { verified: true, report };
        throw new AgenticError(failure === 'deadline' ? 'AGENT_DEADLINE_EXCEEDED' : 'AGENT_RUN_FAILED', 502);
      },
    },
    '@/lib/resume-editor': { resumeContentSchema: { parse: item => item } },
    './graph': { createAtsAgentGraph: (_scope, _deps, progress) => ({ progress }) },
    '../tools/plan.tool': { planAtsAnalysis: input => ({ visible: input.resume, jobMode: 'none', savedAnalysis: null }) },
    '../tools/analysis.tool': {
      prepareAtsModel: async () => { counters.model++; return { model: { name: 'fake' }, modelError: null }; },
      runAtsEvidenceReview: async () => { counters.review++; return semantic; },
      runAtsJobMatch: async () => { counters.job++; return jobMatch; },
    },
    '../tools/assemble.tool': { assembleAtsReport: (_input, _visible, sem, job) => ({ ...report,
      review: { status: sem.status }, jobMatch: job }) },
    '../tools/verify.tool': { verifyAtsReport: () => {
      counters.verified++;
      if (reportError) throw Error('ATS_INVALID_REPORT');
    } },
  };
  return { run: load('src/lib/agentic/agents/ats/agent/ats.agent.ts', mocks).runAtsAgent,
    counters, semantic, jobMatch, report };
}
const base = { actorId: 'user-1', input: { resume: { title: 'Engineer' }, language: 'en' } };

test('working graph preserves report and never calls fallback tools', async () => {
  const { run, counters } = fixture({ failure: 'success' });
  const report = await run(base);
  assert.equal(report.review.status, 'COMPLETE');
  assert.equal(counters.model, 0);
  assert.equal(counters.review, 0);
});

test('early LangGraph failure recovers using one model, one review, one job check', async () => {
  const { run, counters } = fixture();
  const report = await run(base);
  assert.equal(report.review.status, 'COMPLETE');
  assert.equal(counters.model, 1);
  assert.equal(counters.review, 1);
  assert.equal(counters.job, 1);
  assert.equal(counters.verified, 1);
  assert.equal(report.diagnostics.length, 0);
});

test('graph reuses model result instead of acquiring or billing a second model', async () => {
  const { run, counters } = fixture({ started: ['plan', 'model'], values: { model: { name: 'already-acquired' } } });
  const report = await run(base);
  assert.equal(report.review.status, 'COMPLETE');
  assert.equal(counters.model, 0);
  assert.equal(counters.review, 1);
});

test('unfinished review is not called twice and is transparently unassessed', async () => {
  const { run, counters } = fixture({ started: ['model', 'review'], values: { model: { name: 'already-acquired' } } });
  const report = await run(base);
  assert.equal(report.review.status, 'UNAVAILABLE');
  assert.equal(counters.model, 0);
  assert.equal(counters.review, 0);
  assert.deepEqual(Array.from(report.diagnostics), ['ATS_ENGINE_UNAVAILABLE']);
});

test('deadline fallback never makes a second provider call', async () => {
  const { run, counters } = fixture({ failure: 'deadline' });
  const report = await run(base);
  assert.equal(report.review.status, 'UNAVAILABLE');
  assert.equal(counters.model, 0);
  assert.equal(counters.review, 0);
});

test('cancellation and invalid actor cannot bypass access controls', async () => {
  const { run, counters } = fixture();
  await assert.rejects(run({ ...base, actorId: '' }), /AGENT_INVALID_IDENTITY/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(run({ ...base, signal: controller.signal }), /AGENT_CANCELLED/);
  assert.equal(counters.model, 0);
});

test('recovery still rejects reports that violate the ATS rubric', async () => {
  const { run } = fixture({ reportError: true });
  await assert.rejects(run(base), /ATS_INVALID_REPORT/);
});

test('ATS UI has no empty 100-point headline and avoids false complete labels', () => {
  const ui = fs.readFileSync(path.join(root, 'src/components/resumes/resume-ats-panel.tsx'), 'utf8');
  assert.doesNotMatch(ui, /Resume checks available/);
  assert.match(ui, /atsDisplayScore\(analysis\)/);
  assert.doesNotMatch(ui, /: partial \?/);
  assert.match(ui, /const headlineScore = displayScore\?\.score/);
  assert.match(ui, /\.filter\(row => row\.score !== null/);
});

test('ATS uses provider-independent text generation and strict post-validation', () => {
  const review = fs.readFileSync(path.join(root, 'src/lib/career/ats-review.ts'), 'utf8');
  const analysis = fs.readFileSync(path.join(root, 'src/lib/agentic/agents/ats/tools/analysis.tool.ts'), 'utf8');
  assert.match(review, /await generateText/);
  assert.match(review, /return validateAtsReview\(object, resume, language\)/);
  assert.match(analysis, /await getAIModel\(\)/);
  assert.doesNotMatch(analysis, /structuredOutputs:\s*true/);
});

function fakeZod() {
  class Schema {
    min() { return this; } max() { return this; } strict() { return this; }
    int() { return this; } length() { return this; }
    parse(value) { return value; }
    safeParse(value) { return { success: true, data: value }; }
  }
  return { z: { object: () => new Schema(), array: () => new Schema(), string: () => new Schema(),
    number: () => new Schema(), unknown: () => new Schema(), enum: () => new Schema(), ZodError: class ZodError extends Error {} } };
}
function atsReviewFixture(texts) {
  const entries = [...texts];
  const calls = [];
  const workField = 'experiences.0.description';
  const quote = 'Built React services with TypeScript and enabled team members to resolve issues.';
  class ProfileError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
  const zod = fakeZod();
  const review = load('src/lib/career/ats-review.ts', {
    ai: { generateText: async options => { calls.push(options); return { text: entries.shift() }; } },
    zod,
    '@/lib/agentic/agents/ats/prompts/review.prompt': {
      atsEvidenceReviewSystemPrompt: () => 'Factual audit',
      atsEvidenceReviewUserPrompt: input => JSON.stringify(input),
    },
    '@/lib/agentic/agents/ats/tools/parse-json.tool': parser,
    '@/lib/agentic/agents/ats/tools/normalize-review.tool': load('src/lib/agentic/agents/ats/tools/normalize-review.tool.ts'),
    '@/lib/career-profile/http': { ProfileError },
    './ats-text': {
      atsEvidence: () => [{ field: 'title', quote: 'Frontend engineer' }, { field: workField, quote }],
      atsWorkEvidence: () => [{ field: workField, quote }],
      atsClaimedSkills: () => [],
      normalizeAtsText: text => text.toLowerCase(),
    },
  });
  const valid = { contributions: [{ field: workField, actionQuote: 'Built', methodQuote: 'React',
    outcomeQuote: 'enabled team members to resolve issues', outcomeType: 'OBSERVED' }],
    skillEvidence: [],
    criteria: [
      { id: 'specificity', rating: 3, reason: 'The resume contains concrete practical contribution evidence.', evidence: [{ field: workField, quote: 'Built React services' }] },
      { id: 'positioning', rating: 3, reason: 'The headline is supported by a practical engineering role.', evidence: [{ field: 'title', quote: 'Frontend engineer' }, { field: workField, quote: 'Built React services' }] },
      { id: 'writing', rating: 3, reason: 'Practical wording and concrete details are present in the resume.', evidence: [{ field: workField, quote: 'Built React services' }] },
    ], issues: [] };
  return { review, calls, valid, resume: { title: 'Frontend engineer' } };
}

test('ATS review executes text model and validates the exact original resume quotes', async () => {
  const example = atsReviewFixture([]);
  const generated = JSON.stringify(example.valid);
  const context = atsReviewFixture(['```json\n' + generated + '\n```']);
  const result = await context.review.reviewAtsContent(context.resume, 'en', {}, undefined);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.criteria.length, 3);
  assert.equal(context.calls.length, 1);
  assert.equal(context.calls[0].maxRetries, 0);
});

test('ATS review repairs unsupported source quotation once, without accepting invented facts', async () => {
  const example = atsReviewFixture([]);
  const unsafe = JSON.parse(JSON.stringify(example.valid));
  unsafe.contributions[0].methodQuote = 'Kubernetes expertise that was never listed';
  const context = atsReviewFixture([JSON.stringify(unsafe), JSON.stringify(example.valid)]);
  const result = await context.review.reviewAtsContent(context.resume, 'en', {}, undefined);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(context.calls.length, 2);
  const correction = JSON.parse(context.calls[1].prompt).correction;
  assert.ok(correction.reason.includes('verbatim'));
});

test('ATS review fails explicitly when two model responses invent unsupported evidence', async () => {
  const example = atsReviewFixture([]);
  const unsafe = JSON.parse(JSON.stringify(example.valid));
  unsafe.contributions[0].methodQuote = 'Nonexistent expertise';
  const context = atsReviewFixture([JSON.stringify(unsafe), JSON.stringify(unsafe)]);
  await assert.rejects(context.review.reviewAtsContent(context.resume, 'en', {}, undefined), /AI_UNSUPPORTED_EVIDENCE/);
  assert.equal(context.calls.length, 2);
});

test('ATS job extraction works with text-only models and validates source requirements', async () => {
  const calls = [];
  const source = 'We are seeking a full-time software engineer with practical experience in TypeScript and React for our customer platform. This is an onsite role in Paris, France. Previous professional project delivery is required.';
  const result = { title: 'software engineer', summary: 'Software engineering role', requirements: [
    { id: 'r1', title: 'TypeScript', category: 'TECHNICAL', priority: 'REQUIRED',
      evidence: 'practical experience in TypeScript and React', ambiguity: '', terms: ['TypeScript'] },
  ] };
  const extractor = load('src/lib/agentic/agents/ats/tools/job-extraction.tool.ts', {
    ai: { generateText: async options => { calls.push(options); return { text: JSON.stringify(result) }; } },
    zod: fakeZod(),
    '@/lib/agentic/agents/job-match/prompts/extract.prompt': { JOB_MATCH_EXTRACTION_POLICY: 'Only source quotes' },
    '@/lib/career-profile/ai': { factualRules: 'Do not invent qualifications' },
    '@/lib/career-profile/http': { ProfileError: class ProfileError extends Error { constructor(status, code) { super(code); this.code = code; } } },
    '@/lib/career/job-match': { validateJobAnalysis: (value, description) => {
      assert.ok(description.includes(value.requirements[0].evidence));
      return value;
    } },
    '@/lib/career/job-schema': { jobAnalysisSchema: { parse: value => value } },
    './parse-json.tool': parser,
  });
  const job = await extractor.extractAtsJobRequirements(source, 'en', {});
  assert.equal(job.requirements[0].title, 'TypeScript');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].maxRetries, 0);
});

test('ATS job extraction rejects a job description shorter than 100 characters before a model call', async () => {
  const extractor = load('src/lib/agentic/agents/ats/tools/job-extraction.tool.ts', {
    ai: { generateText: () => { throw Error('Must not call provider'); } },
    zod: fakeZod(),
    '@/lib/agentic/agents/job-match/prompts/extract.prompt': { JOB_MATCH_EXTRACTION_POLICY: 'Source only' },
    '@/lib/career-profile/ai': { factualRules: '' },
    '@/lib/career-profile/http': { ProfileError: class ProfileError extends Error { constructor(status, code) { super(code); this.code = code; } } },
    '@/lib/career/job-match': { validateJobAnalysis: value => value },
    '@/lib/career/job-schema': { jobAnalysisSchema: { parse: value => value } },
    './parse-json.tool': parser,
  });
  await assert.rejects(extractor.extractAtsJobRequirements('Short job', 'en', {}), /JOB_DESCRIPTION_REQUIRED/);
});
