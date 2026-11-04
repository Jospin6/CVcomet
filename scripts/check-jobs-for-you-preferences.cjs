/** Read-only diagnosis of the database actually targeted by the application.
 * No credentials, user IDs or saved filters are printed. */
const path = require('node:path');
const fs = require('node:fs');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const env = process.env.NODE_ENV || 'development';
for (const name of [`.env.${env}.local`, '.env.local', `.env.${env}`, '.env']) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const [row] = await prisma.$queryRaw`
    SELECT current_database() AS database,
           current_schema() AS schema,
           to_regclass('public."JobRecommendationPreference"')::text AS preference_table,
           (SELECT count(*)::int FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'JobRecommendationPreference'
              AND column_name IN ('userId', 'filters', 'updatedAt')) AS required_columns
  `;
  const hostOf = (value) => {
    try { return new URL(value).hostname; }
    catch { return null; }
  };
  const databaseHost = hostOf(process.env.DATABASE_URL);
  const migrationHost = hostOf(process.env.DATABASE_URL_UNPOOLED);
  const branchHost = (host) => host?.replace(/-pooler(?=\.)/, '');
  console.log('Jobs for You preference storage:', {
    databaseHost: databaseHost || 'not configured',
    migrationHost: migrationHost || 'not configured',
    database: row.database,
    schema: row.schema,
    tablePresent: row.preference_table !== null,
    requiredColumns: row.required_columns,
    delegateAvailable: typeof prisma.jobRecommendationPreference?.findUnique === 'function',
  });
  if (databaseHost && migrationHost && branchHost(databaseHost) !== branchHost(migrationHost)) {
    console.warn('Warning: application and migration URLs use different Neon endpoints. Check their branches.');
  }
  if (!row.preference_table || row.required_columns !== 3) {
    console.error('Schema drift detected. Review and apply the additive reconciliation migration.');
    process.exitCode = 2;
  }
}
main().catch(error => {
  console.error('Unable to verify preference storage:', error.code || error.name || 'UNKNOWN');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
