/* Run daily with production credentials after migration 20261024150000. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const now = new Date();
  const [auth, quotas, webhooks, staleResumeProposals] = await prisma.$transaction([
    prisma.authThrottleWindow.deleteMany({ where: { resetsAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } } }),
    prisma.aiQuotaWindow.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 400 * 24 * 60 * 60_000) } } }),
    prisma.billingWebhookEvent.deleteMany({ where: { processedAt: { lt: new Date(now.getTime() - 400 * 24 * 60 * 60_000) } } }),
    // Keep 30 days for troubleshooting, then erase model-authored proposals and snapshots.
    prisma.resumeAIProposal.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60_000) } } }),
  ]);
  console.info(JSON.stringify({ removed: { auth: auth.count, quota: quotas.count, webhookReceipts: webhooks.count, expiredResumeProposals: staleResumeProposals.count } }));
}
main().catch(error => { console.error('security maintenance failed', error?.name || 'unknown'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
