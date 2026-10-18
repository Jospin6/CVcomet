// Real headless-browser extraction. --fixture uses in-memory public HTTP
// responses; a URL checks that public posting without AI or database access.
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const loadSource = require('./source-loader.cjs');
const fixture = process.argv[2] === '--fixture';
const url = fixture ? 'https://example.com/jobs/frontend' : process.argv[2];
assert.ok(url, 'Pass --fixture or a public job URL');
const requests = [];
const description = 'Build accessible React and TypeScript applications with the product team. Design reliable APIs, write automated tests, review code and help maintain a fast, inclusive user experience for our customers.';
const responses = {
  '/jobs/frontend': { type: 'text/html', body: '<title>Careers</title><div id="root"></div><script src="/app.js"></script>' },
  '/app.js': { type: 'application/javascript', body: `
    fetch('http://127.0.0.1/private').catch(() => {});
    fetch('/side-effect', { method: 'POST', body: '{}' }).catch(() => {});
    new WebSocket('ws://127.0.0.1:8080/private');
    fetch('/job-data').then(r => r.json()).then(job => setTimeout(() => {
      document.title = 'Careers';
      document.querySelector('#root').innerHTML = '<main><h1>' + job.title + '</h1><p>' + job.description + '</p></main>';
    }, 300));
  ` },
  '/job-data': { type: 'application/json', body: JSON.stringify({ title: 'Frontend Developer', description }) },
};
const request = (target, options, callback) => {
  const req = new EventEmitter();
  req.end = () => queueMicrotask(() => {
    requests.push(target.toString());
    assert.equal(target.hostname, 'example.com', 'No private request reaches the transport');
    options.lookup(target.hostname, { all: true }, (error, addresses) => {
      assert.ifError(error); assert.equal(addresses[0].address, '93.184.216.34');
    });
    const resource = responses[target.pathname];
    assert.ok(resource, 'Only expected read requests reach the transport: ' + target.pathname);
    const response = new PassThrough(); response.statusCode = 200;
    response.headers = { 'content-type': resource.type };
    callback(response); queueMicrotask(() => response.end(resource.body));
  });
  return req;
};
const load = loadSource({
  'server-only': {},
  ...(fixture ? {
    'node:dns/promises': { lookup: async () => [{ address: '93.184.216.34', family: 4 }] },
    'node:http': { request }, 'node:https': { request },
  } : {}),
});
load('src/lib/career/job-scraper.ts').scrapeJobUrl(url).then(job => {
  assert.ok(job.description.length >= 180);
  if (fixture) {
    assert.equal(job.source, 'rendered-html'); assert.equal(job.title, 'Frontend Developer');
    assert.ok(job.description.includes(description));
    assert.ok(requests.some(request => request.endsWith('/app.js')));
    assert.ok(requests.some(request => request.endsWith('/job-data')));
  }
  console.log(JSON.stringify({ url: job.url, title: job.title, company: job.company, source: job.source, characters: job.description.length, preview: job.description.slice(0, 500), ...(fixture ? { requests, privateAndWriteRequestsBlocked: true } : {}) }, null, 2));
}).catch(error => { console.error(JSON.stringify({ code: error.code, message: error.message })); process.exitCode = 1; });
