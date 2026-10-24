/** Destructive smoke test. Run ONLY on an isolated, disposable staging/test database. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const connection = process.env.DATABASE_URL || '';
if (process.env.NODE_ENV !== 'test' || process.env.CVCOMET_DB_TEST_ALLOW_WRITES !== 'true' || !/test|staging|localhost/i.test(connection)) {
  console.error('REFUSED: use an isolated test DB, NODE_ENV=test, CVCOMET_DB_TEST_ALLOW_WRITES=true, and a DB URL containing test/staging/localhost.');
  process.exit(2);
}
const prisma = new PrismaClient();
async function main() {
  const id = randomUUID();
  let userCreated = false;
  try {
    await prisma.user.create({ data: { id, email: `phase00+${id}@example.invalid` } });
    userCreated = true;
    const conversation = await prisma.conversation.create({ data: { userId: id, content: 'smoke' } });
    await Promise.all([
      prisma.message.create({ data: { conversationId: conversation.id, role: 'user', content: 'smoke' } }),
      prisma.experience.create({ data: { userId: id, title: 'Tester', company: 'Test', location: 'Test', start: '2025' } }),
      prisma.project.create({ data: { userId: id, title: 'Smoke' } }),
      prisma.coverLetter.create({ data: { conversationId: conversation.id, recipientName: 'Test', recipientTitle: 'Test', introduction: 'Hello', body: 'Test' } }),
      prisma.cv.create({ data: { conversationId: conversation.id, title: 'Smoke', summary: [] } }),
    ]);
    const limiterKey = `smoke:${id}`;
    await prisma.authThrottleWindow.create({ data: { key: limiterKey, resetsAt: new Date(Date.now() + 60_000) } });
    const successes = await Promise.all(Array.from({ length: 20 }, () => prisma.authThrottleWindow.updateMany({
      where: { key: limiterKey, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } },
    })));
    assert.equal(successes.filter(result => result.count === 1).length, 5, 'rate limiter must be atomic');
    assert.equal((await prisma.authThrottleWindow.findUnique({ where: { key: limiterKey } })).attempts, 5);
    await prisma.authThrottleWindow.delete({ where: { key: limiterKey } });
    await prisma.user.delete({ where: { id } });
    userCreated = false;
    assert.equal(await prisma.conversation.count({ where: { id: conversation.id } }), 0);
    assert.equal(await prisma.message.count({ where: { conversationId: conversation.id } }), 0);
    assert.equal(await prisma.cv.count({ where: { conversationId: conversation.id } }), 0);
    assert.equal(await prisma.coverLetter.count({ where: { conversationId: conversation.id } }), 0);
    console.info('PASS: isolated DB rate-limit concurrency and account ownership cascades');
  } finally {
    if (userCreated) console.error('Test user retained for manual cleanup after failure:', id);
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error('Database smoke failed', error?.name || 'unknown'); process.exitCode = 1; });
