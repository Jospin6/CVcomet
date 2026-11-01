/**
 * Run from a trusted cron/worker host (for example every hour).
 * Close orphaned voice sessions after 45 minutes without activity, without
 * inventing a transcript or grade. Requires Prisma client and DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient();
try {
  const cutoff = new Date(Date.now() - 45 * 60_000);
  const result = await prisma.interviewSession.updateMany({
    where: {
      status: { in: ['VOICE_ACTIVE', 'VOICE_ENDING', 'VOICE_EVALUATING'] },
      updatedAt: { lt: cutoff },
      configuration: { path: ['mode'], equals: 'AI_SCREENING_VOICE' },
    },
    data: {
      status: 'VOICE_UNGRADED', overallScore: null,
      report: {
        kind: 'AI_SCREENING', status: 'unavailable', reason: 'FINALIZATION_NOT_RECEIVED',
        dimensions: null, overallScore: null, answers: 0, evidence: [],
        summary: 'Voice transcript/final report unavailable after call interruption.',
        strengths: [], improvements: [], recommendedAction: '',
        disclaimer: 'Practice feedback only; not a hiring prediction.',
      },
    },
  });
  console.log(`Reconciled ${result.count} stale voice session(s).`);
} finally {
  await prisma.$disconnect();
}
