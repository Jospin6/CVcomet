import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planForStripePrice, stripeSubscriptionStatus, subscriptionBlocksDeletion } from '../src/lib/security/stripe-billing.ts';
import { originRejectionReason } from '../src/lib/security/origin-policy.ts';

const file = path => readFileSync(path, 'utf8');

test('Stripe grants only mapped prices, never unknown IDs or missing config', () => {
  const env = { STRIPE_PRO_PRICE_ID: 'price_pro', STRIPE_CAREER_PRO_PRICE_ID: 'price_career' };
  assert.equal(planForStripePrice('price_pro', env), 'PRO');
  assert.equal(planForStripePrice('price_career', env), 'CAREER_PRO');
  assert.equal(planForStripePrice('price_free', env), null);
  assert.equal(planForStripePrice('price_pro', {}), null);
  assert.equal(planForStripePrice('', env), null);
});

test('Stripe status mapping does not grant benefits for past_due or incomplete', () => {
  assert.equal(stripeSubscriptionStatus('active'), 'ACTIVE');
  assert.equal(stripeSubscriptionStatus('trialing'), 'TRIALING');
  assert.equal(stripeSubscriptionStatus('past_due'), 'PAST_DUE');
  assert.equal(stripeSubscriptionStatus('unpaid'), 'INACTIVE');
  assert.equal(stripeSubscriptionStatus('canceled'), 'CANCELED');
});

test('subscription deletion policy rejects billable and end-of-term active subscriptions', () => {
  assert.equal(subscriptionBlocksDeletion('ACTIVE', 'active'), true);
  assert.equal(subscriptionBlocksDeletion('TRIALING', 'trialing'), true);
  assert.equal(subscriptionBlocksDeletion('CANCELED', 'canceled'), false);
  assert.equal(subscriptionBlocksDeletion(null, 'incomplete_expired'), false);
  assert.equal(subscriptionBlocksDeletion(null, 'past_due'), true);
});

test('webhook authenticates raw bytes and keeps replay receipts and authoritative Stripe states', () => {
  const source = file('src/app/api/webhooks/route.ts');
  assert.match(source, /stripe\.webhooks\.constructEvent\(raw, signature,/);
  assert.match(source, /stripe\.subscriptions\.retrieve\(subId\)/);
  assert.match(source, /tx\.billingWebhookEvent\.findUnique/);
  assert.match(source, /tx\.billingWebhookEvent\.create/);
  assert.match(source, /lastStripeEventCreated/);
  assert.match(source, /planForStripePrice\(/);
  assert.match(source, /checkout\.client_reference_id !== userId/);
  assert.match(source, /Unknown billing configuration/);
});

test('authentication rate limiter uses atomic persisted counters and no raw identifiers', () => {
  const source = file('src/lib/security/auth-throttle.ts');
  assert.match(source, /createHmac\("sha256"/);
  assert.match(source, /prisma\.authThrottleWindow\.upsert/);
  assert.match(source, /prisma\.authThrottleWindow\.updateMany/);
  assert.match(source, /attempts: \{ lt: rule\.max \}/);
  for (const endpoint of ['login', 'signup', 'verify-email', 'resend-code', 'confirm-email']) {
    assert.match(file(`src/app/api/${endpoint}/route.ts`), /enforceAuthThrottle\(/);
  }
  assert.match(file('src/app/api/auth/[...all]/route.ts'), /enforceAuthThrottle\(/);
});

test('signed payment and cookie mutations apply origin checks', () => {
  for (const name of ['stripe/checkout', 'stripe/cancel-subscription', 'billing/portal', 'users/[id]']) {
    assert.match(file(`src/app/api/${name}/route.ts`), /assertTrustedWriteOrigin\(/);
  }
  assert.match(file('src/lib/ai/admin-http.ts'), /assertTrustedWriteOrigin\(/);
});

test('account deletion never permits admin cross-account deletion or accidental paid deletion', () => {
  const source = file('src/app/api/users/[id]/route.ts');
  assert.match(source, /session\.id !== id/);
  assert.match(source, /subscriptions\.retrieve\(stripeId\)/);
  assert.match(source, /SUBSCRIPTION_STILL_BILLABLE/);
  assert.match(source, /prisma\.user\.delete\(\{ where: \{ id \} \}\)/);
});

test('database migration and Prisma model include all account-deletion cascades', () => {
  const sql = file('prisma/migrations/20261024150000_security_phase00_final/migration.sql');
  const schema = file('prisma/schema.prisma');
  for (const relation of ['Conversation_userId', 'Cv_conversationId', 'CoverLetter_conversationId', 'Message_conversationId', 'Experience_userId', 'Education_userId', 'Project_userId', 'Certification_userId']) {
    assert.match(sql, new RegExp(`${relation}_fkey`));
  }
  assert.equal((sql.match(/ON DELETE CASCADE/g)||[]).length, 8);
  for (const model of ['BillingWebhookEvent', 'AuthThrottleWindow']) assert.match(schema, new RegExp(`model ${model} \\{`));
});

test('maintenance removes expired auth counters without prematurely dropping replay ledger', () => {
  const source = file('scripts/cleanup-security-windows.cjs');
  assert.match(source, /authThrottleWindow\.deleteMany/);
  assert.match(source, /aiQuotaWindow\.deleteMany/);
  assert.match(source, /billingWebhookEvent\.deleteMany/);
  assert.match(source, /400 \* 24/);
});

test('Edge origin policy rejects forged origins and absent browser Origin headers in production', () => {
  const env = { NODE_ENV: 'production', BETTER_AUTH_URL: 'https://cvcomet.example', NEXT_PUBLIC_APP_URL: 'https://cvcomet.example' };
  const req = (headers) => ({ url: 'https://cvcomet.example/api/login', headers: new Headers(headers) });
  assert.equal(originRejectionReason(req({ origin: 'https://cvcomet.example', cookie: 'token=x' }), env), null);
  assert.equal(originRejectionReason(req({ origin: 'https://attacker.example', cookie: 'token=x' }), env), 'UNTRUSTED_ORIGIN');
  assert.equal(originRejectionReason(req({ 'sec-fetch-site': 'cross-site', origin: 'https://cvcomet.example' }), env), 'UNTRUSTED_ORIGIN');
  assert.equal(originRejectionReason(req({ cookie: 'token=x' }), env), 'ORIGIN_REQUIRED');
  assert.equal(originRejectionReason(req({}), env), null); // authenticated cookie-less trusted server calls are still possible
  assert.equal(originRejectionReason(req({ origin: 'https://preview.example' }), { ...env, CVCOMET_ALLOWED_ORIGINS: 'https://preview.example' }), null);
});

test('middleware covers every API mutation but exempts only signed webhooks and trusted cron', () => {
  const source = file('src/middleware.ts');
  assert.match(source, /matcher: \["\/api\/:path\*"\]/);
  assert.match(source, /originRejectionReason\(/);
  assert.match(source, /\/api\/webhooks/);
  assert.match(source, /\/api\/internal\/job-boards\/sync/);
});
