import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allowedBrowserOrigins, originRejectionReason } from '../src/lib/security/origin-policy.ts';
import { inspectReleaseSource } from './release-source-audit.cjs';

const prod = { NODE_ENV: 'production', BETTER_AUTH_URL: 'https://cvcomet.example', NEXT_PUBLIC_APP_URL: 'https://cvcomet.example' };
const request = (origin, extras = {}) => ({ url: 'https://cvcomet.example/api/career/v1/missions', headers: new Headers({ ...(origin ? { origin } : {}), ...extras }) });

test('production origins exclude HTTP, opaque URLs, credentials and unconfigured hosts', () => {
  const result = allowedBrowserOrigins({ ...prod, CVCOMET_ALLOWED_ORIGINS: 'http://bad.example, javascript:evil, file:///secret,https://preview.example,https://bad:pass@spoof.example' }, request(null).url);
  assert.deepEqual([...result].sort(), ['https://cvcomet.example', 'https://preview.example']);
  for (const untrusted of ['null', 'http://cvcomet.example', 'https://other.example', 'https://cvcomet.example/path', 'https://cvcomet.example/', 'javascript:evil']) {
    assert.equal(originRejectionReason(request(untrusted), prod), 'UNTRUSTED_ORIGIN', untrusted);
  }
  assert.equal(originRejectionReason(request('https://cvcomet.example'), prod), null);
  assert.equal(originRejectionReason(request(null, { cookie: 'session=secret' }), prod), 'ORIGIN_REQUIRED');
  assert.equal(originRejectionReason(request('https://cvcomet.example', { 'sec-fetch-site': 'cross-site' }), prod), 'UNTRUSTED_ORIGIN');
});

test('local HTTP is supported for development only', () => {
  const dev = { NODE_ENV: 'development', BETTER_AUTH_URL: 'http://localhost:3000' };
  assert.equal(originRejectionReason({ url: 'http://localhost:3000/api/test', headers: new Headers({ origin: 'http://localhost:3000' }) }, dev), null);
  assert.equal(allowedBrowserOrigins(prod, 'http://localhost:3000').has('http://localhost:3000'), false);
});

test('Career OS read endpoints, mutations and security invariants pass the release audit', () => {
  const result = inspectReleaseSource(new URL('..', import.meta.url));
  assert.equal(result.failures.length, 0, JSON.stringify(result.failures));
  assert.ok(result.careerRouteFiles >= 15);
  assert.equal(result.externalActionEnabled, false);
  assert.equal(result.missingMigrations.length, 0);
});

test('no external action in the approved packet path', () => {
  const packet = readFileSync(new URL('../src/lib/career-os/application-packet-service.ts', import.meta.url), 'utf8');
  const agent = readFileSync(new URL('../src/lib/career-os/agent-service.ts', import.meta.url), 'utf8');
  assert.match(packet, /submissionPerformed: false, externalEmailSent: false/);
  assert.match(agent, /NEVER invent degrees/);
});
