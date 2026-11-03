import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname))
    throw new Error("Local database helper only accepts loopback hosts.");
  const databaseDir = path.resolve(".local-pg");
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: Number(url.port || 5432),
    persistent: true,
    initdbFlags: ["--no-locale", "--encoding=UTF8"],
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1", "-k", "/tmp"],
    onLog: () => {},
    onError: () => {},
  });
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  const name = url.pathname.slice(1);
  const client = pg.getPgClient("postgres");
  await client.connect();
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (!result.rowCount) await pg.createDatabase(name);
  await client.end();
  console.log(
    "Local PostgreSQL ready on 127.0.0.1:" +
      url.port +
      ". Keep this terminal running. Ctrl+C stops it safely.",
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await new Promise(() => {});
}
main().catch(() => {
  console.error(
    "Could not start local PostgreSQL. Check .env, the port, and .local-pg permissions.",
  );
  process.exit(1);
});
