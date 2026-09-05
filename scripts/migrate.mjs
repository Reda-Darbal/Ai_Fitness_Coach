/**
 * Applies db/migrations/*.sql in filename order, once each.
 *
 *   npm run db:migrate           apply pending migrations
 *   npm run db:migrate -- --list show status without applying
 *
 * Uses node-postgres over TCP rather than the serverless HTTP driver, because
 * migration files contain multiple statements and function bodies.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "db", "migrations");

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("placeholder")) {
  console.error(
    "\n  DATABASE_URL is not set (or is still a placeholder).\n" +
      "  Create a Neon project and put its connection string in .env.local\n",
  );
  process.exit(1);
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString });
await client.connect();

await client.query(`
  create table if not exists public._migrations (
    name        text primary key,
    checksum    text not null,
    applied_at  timestamptz not null default now()
  );
`);

const { rows: applied } = await client.query(
  "select name, checksum from public._migrations",
);
const appliedByName = new Map(applied.map((r) => [r.name, r.checksum]));

const listOnly = process.argv.includes("--list");
let ran = 0;

for (const name of files) {
  const body = readFileSync(join(dir, name), "utf8");
  const checksum = createHash("sha256").update(body).digest("hex").slice(0, 16);
  const previous = appliedByName.get(name);

  if (previous) {
    // A changed migration means the file and the database disagree — say so
    // rather than silently skipping.
    const status = previous === checksum ? "applied" : "APPLIED BUT FILE CHANGED";
    console.log(`  ${name.padEnd(34)} ${status}`);
    continue;
  }

  if (listOnly) {
    console.log(`  ${name.padEnd(34)} pending`);
    continue;
  }

  try {
    await client.query("begin");
    await client.query(body);
    await client.query(
      "insert into public._migrations (name, checksum) values ($1, $2)",
      [name, checksum],
    );
    await client.query("commit");
    console.log(`  ${name.padEnd(34)} applied`);
    ran += 1;
  } catch (error) {
    await client.query("rollback");
    console.error(`\n  ${name} failed:\n  ${error.message}\n`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log(
  listOnly ? "" : `\n  ${ran} migration${ran === 1 ? "" : "s"} applied.\n`,
);
