require('dotenv').config();
const loadSource = require('./source-loader.cjs');
const limit = Math.min(50, Math.max(1, Number(process.argv[2] || 20)));
const { discoverAndSync } = loadSource({})('src/lib/find-jobs/discovery.ts');
discoverAndSync(limit).then(result => {
  process.stdout.write(JSON.stringify({ discovered: result.discovered, processed: result.processed, syncedJobs: result.syncedJobs, boards: result.results.map(item => ({ provider: item.board.provider, slug: item.board.slug, status: item.status, jobs: item.jobs })) }, null, 2) + '\n');
}).catch(error => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
