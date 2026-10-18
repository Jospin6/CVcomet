const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadSource = require('./source-loader.cjs');

function renderer({ waitError, waiting, requests = [], resourceError } = {}) {
  const launches = [], contexts = [], loaded = [];
  let closed = 0, handler;
  const frame = {};
  const page = {
    mainFrame: () => frame,
    goto: async url => {
      for (const item of [{ url, type: 'document' }, ...requests]) {
        const request = { url: () => item.url, method: () => item.method || 'GET', resourceType: () => item.type || 'fetch', isNavigationRequest: () => item.type === 'document', frame: () => frame, redirectedFrom: () => null, headers: () => ({}) };
        await handler({ request: () => request, abort: async () => {}, fulfill: async () => {} });
      }
    },
    waitForFunction: async () => { if (waiting) await waiting; if (waitError) throw waitError; },
    content: async () => '<main>A publicly rendered job description.</main>',
    url: () => 'https://example.com/job',
  };
  const context = { route: async (_, callback) => { handler = callback; }, routeWebSocket: async () => {}, newPage: async () => page, on() {} };
  const browser = { newContext: async options => { contexts.push(options); return context; }, close: async () => { closed++; } };
  const load = loadSource({
    'server-only': {},
    'node:fs': { existsSync: () => true },
    playwright: { chromium: { executablePath: () => '/browser/chromium', launch: async options => { launches.push(options); return browser; } } },
  });
  const { JobScrapeError } = load('src/lib/career/job-scrape-error.ts');
  const { renderJobPage } = load('src/lib/career/job-renderer.ts');
  return {
    launches, contexts, loaded, get closed() { return closed; },
    run: signal => renderJobPage('https://example.com/job', async (url, headers, resourceSignal) => {
      loaded.push({ url, signal: resourceSignal });
      if (resourceError) throw new JobScrapeError(400, resourceError, 'Private destination');
      return { status: 200, headers: { 'content-type': 'text/html' }, body: '<main>Public content</main>' };
    }, signal || new AbortController().signal),
  };
}

test('renderer uses an isolated browser, loads read resources and closes on success', async () => {
  const app = renderer({ requests: [{ url: 'https://example.com/app.js', type: 'script' }, { url: 'https://example.com/submit', method: 'POST' }, { url: 'https://example.com/image.png', type: 'image' }] });
  const result = await app.run();
  assert.equal(result.url, 'https://example.com/job'); assert.equal(app.closed, 1);
  assert.deepEqual(app.loaded.map(item => item.url), ['https://example.com/job', 'https://example.com/app.js']);
  assert.equal(app.launches[0].chromiumSandbox, true); assert.ok(app.launches[0].proxy.server);
  assert.equal(app.contexts[0].serviceWorkers, 'block'); assert.equal(app.contexts[0].acceptDownloads, false);
  assert.ok(app.loaded.every(item => item.signal.aborted), 'All pending resource work is cancelled on completion');
});

test('renderer closes on timeout and preserves errors from validated document requests', async () => {
  const timeout = Object.assign(new Error('Page did not load'), { name: 'TimeoutError' });
  const timedOut = renderer({ waitError: timeout });
  await assert.rejects(timedOut.run(), error => error.code === 'RENDER_TIMEOUT');
  assert.equal(timedOut.closed, 1);
  const failure = renderer({ resourceError: 'PRIVATE_ADDRESS' });
  await assert.rejects(failure.run(), error => error.code === 'PRIVATE_ADDRESS');
  assert.equal(failure.closed, 1);
});

test('renderer bounds concurrent browsers and recovers capacity after completion', async () => {
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const app = renderer({ waiting });
  const first = app.run(), second = app.run();
  await assert.rejects(app.run(), error => error.code === 'RENDER_BUSY');
  finish(); await Promise.all([first, second]);
  await app.run(); assert.equal(app.closed, 3);
});
