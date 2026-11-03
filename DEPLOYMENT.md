# Deployment, backup and restore

## Local and private by default

No hosted Site, public URL, paid service or domain is created. Run on your own machine for initial use. PostgreSQL and the optional Docker mapping bind to loopback. The local development server also binds to 127.0.0.1. A phone cannot reach that loopback address directly: for actual iPhone access, deploy behind an authenticated HTTPS endpoint on a trusted network/VPN. Configure the exact externally used origin; do not expose the Next.js development server directly to the internet.

## Standard Node/PostgreSQL deployment

1. Use a maintained Node 22+ installation and PostgreSQL 16+. Create a dedicated database and a migration/owner role through your database administrator. Store credentials in the host's secret manager or protected environment configuration, never in browser variables or Git.
2. Restore or create your production database with `DEMO_MODE=false`. Apply `pnpm db:generate` and `pnpm db:migrate` with the migration-role URL. Bootstrap the initial account through `pnpm admin:create` in an interactive trusted terminal.
3. Use a different, non-owner runtime database role. Grant schema usage, SELECT/INSERT/UPDATE on business tables and DELETE only on Session/LoginAttempt. Do not grant CREATE, TRUNCATE, trigger modification, or broad DELETE. The migration's immutable-row triggers block posted bill/credit/audit changes and preserve payment/sale postings. Keep the migration/backup credentials out of the web runtime.
4. Provision an absolute `UPLOAD_DIR` outside `public/`, the project checkout, and the reverse proxy's document root, with permissions 0700 for the app user. Mount persistent storage. Uploaded blobs are private and must never be served directly by a web server.
5. Configure `DATABASE_URL`, `APP_ORIGIN=https://your-private-host.example`, `COOKIE_SECURE=true`, `UPLOAD_DIR` and `DEMO_MODE=false`. Do not prefix secrets with NEXT_PUBLIC_. The origin must match the visitor's URL exactly. Default currency is AED and dates use Asia/Dubai.
6. Install the locked dependencies, run unit/integration checks against a separate test database, then `pnpm build`. Run `pnpm start` under a supervised OS service as a non-root user. It listens on 127.0.0.1:3000; put a maintained HTTPS reverse proxy in front. Forward the correct host headers and limit request sizes to 11 MB at the proxy. Apply sensible ingress rate limits and restrict access to your VPN/private audience.
7. Verify sign-in, sign-out, private document access, a backup restore and all financial invariants on native PostgreSQL before entering live records. Set up monitoring for disk space, failed backups, database availability and upload failures.

Production sign-in refuses COOKIE_SECURE=false. Local development uses false on loopback HTTP. The security policy allows Next.js inline bootstrapping but blocks framing, external script origins, objects and cross-origin form submissions. Every API read/write independently checks administrator authorization; hiding navigation is not the security boundary.

## Backup

Back up both PostgreSQL and private uploads. Database metadata alone does not contain the file contents.

1. Stop writes (brief maintenance or stop the app service) to obtain a consistent database/upload pair.
2. Run `pg_dump` in custom format for the Keitora database using trusted backup tooling. Supply authentication through a protected `.pgpass`/secret manager, not command-line passwords.
3. Copy/archive the complete private upload directory while retaining restrictive permissions. Record the database migration version, application commit/version and capture time in Asia/Dubai/UTC.
4. Encrypt backups, store them outside the web host, restrict access, and set retention appropriate to your business obligations. Test restores regularly. Do not commit backups or upload directories to Git.
5. Restart writes and verify normal access. Automating/scheduling this process is not implemented.

## Restore drill

1. Create a new isolated empty PostgreSQL database; do not overwrite the live database to test a backup.
2. Restore the custom-format dump using `pg_restore`. Restore the upload directory into a new private volume. Restore schema ownership/grants using the database administrator's process.
3. Point a separate app instance to the restored database/files. Apply only migrations newer than the dump, using the migration role.
4. Revoke all restored sessions (`DELETE FROM "Session"` under trusted database administration). Rotate passwords via the secure CLI if recovery involves a security incident.
5. Sign in and compare known vehicle counts, supplier/customer balances, sales, credits, verified payments and attachment hashes with the captured backup checks. Confirm a file cannot be fetched while signed out.
6. Only after the restored instance passes verification should you plan a production cutover. Keep the previous database/file pair until reconciliation is complete.

## Upgrade/rollback

Take a paired backup first. Review migrations before applying them. Deploy application code only after required migrations succeed. Do not edit applied SQL migration files. Prefer forward corrective migrations; schema rollback requires a reviewed restore/cutover, not deleting ledger rows. Posted-data corrections belong in credit/reversal workflows. Existing credentials and demo data are not included in the source archive.
