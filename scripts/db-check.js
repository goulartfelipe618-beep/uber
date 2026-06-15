const pg = require("../services/core-node/node_modules/pg");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");

const dsn =
  process.env.PG_DSN ??
  "postgresql://postgres.scpwlhfqlfkvudkkzvaf:436543534gerherh@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

const client = new pg.Client({ connectionString: dsn, ssl: { rejectUnauthorized: false } });

async function main() {
  const cmd = process.argv[2] ?? "list";
  await client.connect();

  if (cmd === "list") {
    const res = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    console.log(res.rows.map((r) => r.tablename).join("\n") || "(empty)");
    return;
  }

  if (cmd === "migrate") {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = await client.query("SELECT filename FROM schema_migrations ORDER BY filename");
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    const dir = join(root, "infra", "postgres");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`skip ${file}`);
        continue;
      }

      const sql = readFileSync(join(dir, file), "utf8");
      console.log(`apply ${file}...`);
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        console.log(`ok ${file}`);
      } catch (err) {
        console.error(`fail ${file}:`, err.message);
        throw err;
      }
    }
    return;
  }

  console.error("Usage: node db-check.js [list|migrate]");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
