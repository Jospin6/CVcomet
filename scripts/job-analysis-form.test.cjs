const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const loadSource = require('./source-loader.cjs');

const text = 'Frontend Developer. React and TypeScript are required. Build accessible interfaces and collaborate with the product team to deliver reliable software.';
const cvId = '22222222-2222-4222-8222-222222222222';
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return [node.props?.children].flat(Infinity).map(child => find(child, predicate)).find(Boolean);
}

// Exercise the real overview and shared hook with isolated React state and mocked APIs.
// No database, AI provider or authentication credentials are needed.
function overview(language = 'en') {
  const slots = [], routes = [];
  let cursor = 0;
  const load = loadSource({
    react: {
      ...require('react'),
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
      },
      useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
      useEffect() {},
    },
    'react-i18next': { useTranslation: () => ({ t: key => key, i18n: { resolvedLanguage: language } }) },
    'next/navigation': { useRouter: () => ({ push: url => routes.push(url) }) },
    'react-redux': { useDispatch: () => () => {}, useSelector: () => null },
    '@/redux/user/userSlice': { fetchUser() {}, selectUser() {} },
    '@/hooks/useCurrentUser': { useCurrentUser: () => ({ user: null }) },
    '@/components/resumes/resume-library': { ResumeCards() {}, useResumeLibrary: () => ({ documents: [], loading: false, error: '', reload() {} }) },
    '@/components/career/data-state': { useApi: () => ({ data: [{ id: cvId, title: 'My resume' }], error: '', loading: false, reload: async () => {} }) },
  });
  const ui = load('src/components/career/job-analysis-form.tsx');
  const Overview = load('src/app/page.tsx').default;
  return {
    routes,
    render() {
      cursor = 0;
      const tree = Overview();
      const hero = find(tree, node => node.type === 'section' && node.props['aria-labelledby'] === 'overview-job-title');
      assert.ok(hero, 'The overview has a next-step section');
      const form = find(hero, node => node.type === ui.JobAnalysisForm);
      assert.ok(form, 'The actual analysis form is inside the next-step section');
      return form.props.form;
    },
  };
}

test('overview creates the analysis before navigating with its returned ID and prevents duplicate submissions', async t => {
  const app = overview('fr'), calls = [];
  let finish;
  t.mock.method(global, 'fetch', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Promise(resolve => { finish = resolve; });
  });
  let form = app.render();
  assert.equal(form.ready, false);
  await form.analyze();
  assert.equal(calls.length, 0);
  form.changeText(text); form.setConfirmed(true); form.setCvId(cvId);
  form = app.render();
  const pending = form.analyze();
  await form.analyze();
  assert.equal(calls.length, 1);
  assert.equal(app.render().busy, 'analyze');
  assert.deepEqual(app.routes, []);
  assert.equal(calls[0].url, '/api/job-match');
  assert.deepEqual(calls[0].body, { text, source: { type: 'TEXT', originalText: text }, confirmed: true, cvId, language: 'fr' });
  const id = randomUUID();
  finish(response({ id }, 201)); await pending;
  assert.deepEqual(app.routes, ['/dashboard/job-match?analysis=' + id]);
});

test('failed analysis preserves the text, stays on overview and can retry with a new returned ID', async t => {
  const app = overview();
  t.mock.method(global, 'fetch', async () => response({ error: 'AI_UNAVAILABLE' }, 503));
  let form = app.render(); form.changeText(text); form.setConfirmed(true);
  await app.render().analyze();
  form = app.render();
  assert.equal(form.error, 'AI_UNAVAILABLE'); assert.equal(form.text, text);
  assert.deepEqual(app.routes, []);
  const id = randomUUID();
  global.fetch = async () => response({ id });
  await form.analyze();
  assert.deepEqual(app.routes, ['/dashboard/job-match?analysis=' + id]);
});

test('URL and PDF imports remain reviewable and preserve source metadata when analyzed', async t => {
  const app = overview(), calls = [], url = 'https://example.com/jobs/frontend';
  const source = { type: 'URL', url, originalText: text };
  t.mock.method(global, 'fetch', async (endpoint, options) => {
    calls.push({ endpoint, options });
    return response(endpoint.endsWith('/extract') ? { text, source } : { id: randomUUID() });
  });
  app.render().setUrl(url);
  await app.render().extract();
  let form = app.render();
  assert.equal(form.text, text); assert.equal(form.confirmed, false);
  assert.equal(form.ready, false); assert.deepEqual(app.routes, []);
  assert.deepEqual(JSON.parse(calls[0].options.body), { url });
  form.setConfirmed(true); form = app.render();
  await form.analyze();
  assert.deepEqual(JSON.parse(calls[1].options.body).source, source);
  await app.render().extract(new File(['%PDF-fixture'], 'job.pdf', { type: 'application/pdf' }));
  assert.equal(calls[2].options.body.get('file').name, 'job.pdf');
  assert.equal(app.render().confirmed, false);
  const count = calls.length;
  await app.render().extract({ size: 9 * 1024 * 1024 });
  assert.equal(calls.length, count); assert.equal(app.render().error, 'TOO_LARGE');
  app.render().changeText('Too short'); app.render().setConfirmed(true);
  assert.equal(app.render().ready, false);
});
