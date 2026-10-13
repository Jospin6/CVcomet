/* Reconcile an existing database without replaying destructive historical migrations. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });

if (!process.argv.includes("--apply")) {
  console.log("Review prisma/database-upgrade.sql, then run node scripts/upgrade-database.cjs --apply.");
  process.exit(0);
}

const prismaCLI = path.resolve("node_modules/prisma/build/index.js");
function prisma(args) {
  return execFileSync(process.execPath, [prismaCLI, ...args], {
    cwd: process.cwd(), encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
}
const diffArgs = ["migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--script"];
const normalize = value => value.replace(/\r\n/g, "\n").trim();
const emptyDiff = value => !normalize(value) || normalize(value) === "-- This is an empty migration.";

async function main() {
  const sql = fs.readFileSync("prisma/database-upgrade.sql", "utf8");
  if (/\bDROP\b|\bALTER\s+COLUMN\b|^\s*(DELETE|TRUNCATE|UPDATE|INSERT)\b/im.test(sql)) {
    throw new Error("Upgrade refused: only additions are permitted.");
  }
  const currentDiff = prisma(diffArgs);
  if (!emptyDiff(currentDiff) && normalize(currentDiff) !== normalize(sql)) {
    throw new Error("Database changed since review. Regenerate and review the SQL before applying it.");
  }

  const db = new PrismaClient();
  try {
    if (!emptyDiff(currentDiff)) {
      const tables = await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
      console.log("Applying reviewed additions in a transaction.");
      await db.$transaction(async tx => {
        const counts = new Map();
        for (const { tablename } of tables) {
          const quoted = '"' + tablename.replaceAll('"', '""') + '"';
          const [{ count }] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::text AS count FROM ${quoted}`);
          counts.set(tablename, count);
        }
        for (const statement of sql.split(";").map(value => value.trim()).filter(Boolean)) {
          await tx.$executeRawUnsafe(statement);
        }
        for (const [table, before] of counts) {
          const quoted = '"' + table.replaceAll('"', '""') + '"';
          const [{ count }] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::text AS count FROM ${quoted}`);
          if (count !== before) throw new Error("Existing row count changed; rolling back.");
        }
      }, { maxWait: 10000, timeout: 120000 });
      console.log("Schema additions applied; existing row counts preserved.");
    }
    if (!emptyDiff(prisma(diffArgs))) throw new Error("Schema verification failed; migration history was not changed.");

    const applied = await db.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    const names = new Set(applied.map(row => row.migration_name));
    await db.$disconnect();
    // The complete current schema is now present. Baseline historical steps with Prisma's official command.
    for (const name of fs.readdirSync("prisma/migrations").filter(name => fs.existsSync(path.join("prisma/migrations", name, "migration.sql"))).sort()) {
      if (!names.has(name)) {
        prisma(["migrate", "resolve", "--applied", name]);
        console.log("Recorded migration: " + name);
      }
    }
    console.log("Database matches the project schema and migration history.");
  } finally {
    await db.$disconnect();
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
