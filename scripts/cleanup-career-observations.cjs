#!/usr/bin/env node
/** Operational telemetry retention. Default is preview: --execute required to delete. */
const { PrismaClient } = require('@prisma/client');
const execute = process.argv.includes('--execute');
const days = 30; // fixed retention ceiling; never silently extend user-linked telemetry
const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const db = new PrismaClient();
(async () => {
  if (!execute) {
    console.log(JSON.stringify({ action: 'preview', table: 'CareerAgentObservation', retainDays: days, before: before.toISOString(),
      eligible: await db.careerAgentObservation.count({ where: { createdAt: { lt: before } } }) }));
    return;
  }
  const result = await db.careerAgentObservation.deleteMany({ where: { createdAt: { lt: before } } });
  console.log(JSON.stringify({ action: 'purged', table: 'CareerAgentObservation', count: result.count, retainDays: days }));
})().catch(() => { console.error('Quality retention job failed; inspect DB connectivity and migrations.'); process.exitCode = 1; })
  .finally(() => db.$disconnect());
