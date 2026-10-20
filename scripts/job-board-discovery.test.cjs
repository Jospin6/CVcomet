const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadSource = require('./source-loader.cjs');
const load = loadSource({ '../../../prisma/prisma': {}, '@/prisma/prisma': {} });
const { extractBoardUrl, verifyBoard } = load('src/lib/find-jobs/discovery.ts');

test('extracts only supported Greenhouse and Lever board URLs', () => {
  assert.deepEqual(extractBoardUrl('https://boards.greenhouse.io/Acme/jobs/123?x=1'), { provider: 'GREENHOUSE', region: 'GLOBAL', slug: 'acme', source: 'catalog_url' });
  assert.deepEqual(extractBoardUrl('https://job-boards.greenhouse.io/acme'), { provider: 'GREENHOUSE', region: 'GLOBAL', slug: 'acme', source: 'catalog_url' });
  assert.deepEqual(extractBoardUrl('https://jobs.lever.co/foo/123'), { provider: 'LEVER', region: 'GLOBAL', slug: 'foo', source: 'catalog_url' });
  assert.deepEqual(extractBoardUrl('https://jobs.eu.lever.co/foo'), { provider: 'LEVER', region: 'EU', slug: 'foo', source: 'catalog_url' });
  assert.equal(extractBoardUrl('https://evil.example/boards.greenhouse.io/acme'), null);
  assert.equal(extractBoardUrl('https://boards.greenhouse.io/a%2Fb'), null);
});

test('validates active and empty public boards without following redirects', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async () => new Response(JSON.stringify({ jobs: [{ id: 1, title: 'Engineer', absolute_url: 'https://boards.greenhouse.io/acme/jobs/1', content: '<b>Build</b>', location: { name: 'Remote' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  assert.equal((await verifyBoard({ provider: 'GREENHOUSE', region: 'GLOBAL', slug: 'acme', source: 'test' })).activeJobs, 1);
  global.fetch = async () => new Response(JSON.stringify([]), { status: 200 });
  assert.equal((await verifyBoard({ provider: 'LEVER', region: 'GLOBAL', slug: 'empty', source: 'test' })).activeJobs, 0);
  global.fetch = async () => new Response('', { status: 302, headers: { location: 'https://evil.example' } });
  await assert.rejects(verifyBoard({ provider: 'LEVER', region: 'GLOBAL', slug: 'redirect', source: 'test' }), /REDIRECT_REJECTED/);
});

test('reports missing boards and rate limits distinctly', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async () => new Response('', { status: 404 });
  await assert.rejects(verifyBoard({ provider: 'GREENHOUSE', region: 'GLOBAL', slug: 'missing', source: 'test' }), /NOT_FOUND/);
  global.fetch = async () => new Response('', { status: 429, headers: { 'retry-after': '60' } });
  await assert.rejects(verifyBoard({ provider: 'LEVER', region: 'GLOBAL', slug: 'limited', source: 'test' }), /RATE_LIMIT:60/);
});
