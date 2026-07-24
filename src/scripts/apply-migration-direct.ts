import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";

// One-off helper: applies prisma/migrations/*/migration.sql directly over a
// plain `pg` connection, and records it in Prisma's own `_prisma_migrations`
// bookkeeping table - the same table `prisma migrate dev` maintains itself.
// This exists ONLY because this sandbox's network allowlist blocks
// binaries.prisma.sh, so the Prisma CLI's schema-engine binary can't be
// downloaded here. On a normal machine with full internet access, just use
// `npx prisma migrate dev` - this script becomes unnecessary once that works.

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

async function main() {
  const dirs = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((d) => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory())
    .sort();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `);

  for (const dir of dirs) {
    const alreadyApplied = await client.query(
      `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NOT NULL`,
      [dir]
    );
    if ((alreadyApplied.rowCount ?? 0) > 0) {
      console.log(`  skip (already applied): ${dir}`);
      continue;
    }

    const sqlPath = path.join(MIGRATIONS_DIR, dir, "migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    const id = crypto.randomUUID();

    console.log(`  applying: ${dir} ...`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
         VALUES ($1, $2, now(), $3, now(), 1)`,
        [id, checksum, dir]
      );
      await client.query("COMMIT");
      console.log(`  done: ${dir}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.end();
  console.log("\nAll migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
