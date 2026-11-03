# KEITORA HUB

A working private management application for Keitora Projects. Next.js 16, React 19, TypeScript, Tailwind 4, PostgreSQL and Prisma 6. The supplied KEI TORA PROJECTS PNG is included unchanged; CSS crops its whitespace for the navigation logo.

**First working version, not a certified accounting or tax system.** No real customer details, vehicle identities, or financial amounts are pre-populated. The nine known UAE vehicles (two sold, awaiting delivery) are onboarding context only. All sample records are explicitly fictional and opt-in.

## What works

- Administrator sign-in, server-side authorization, opaque hashed sessions, login throttling, revocation, origin checks and private APIs.
- Responsive dashboard with accrual-style profit, confirmed costs, verified cash movement, supplier payables, customer receivables, refund obligations and unearned deposits.
- Vehicle and contact creation/editing/search/filtering; archive unused records instead of deleting history. Unique vehicle IDs and chassis; acquisition modes; separate Japan Pool; status progression; separate sale/delivery dates.
- Confirmed supplier bills and itemized direct/business costs, original currency plus manually confirmed AED amount, due dates, partial/full/unpaid balances and aging by supplier group.
- Sale agreements with as-is/customized classification, exact 60/40, 50/30/20 or custom installment percentages and dates. The last installment absorbs rounding in fils.
- Separate pending payments, verification, supplier allocations, customer receipts/refunds, owner movements, personal-account business reconciliation, explicit reversals and credit adjustments.
- Private PDF/photo uploads with bounded streaming, magic-byte type detection, randomized storage, authenticated viewing/downloading and no public URLs.
- Vehicle profitability, sales-type comparison, monthly activity, supplier/customer balances, verified-only cash report and CSV exports. Full payment exports include status for reconciliation.
- Safe vehicle JSON import with preview and all-or-nothing confirmation, duplicate checks and no automatic financial posting.
- Editable shipping estimates, categories, payment plans and VAT policy note. Recent audit view/export. Database constraints and immutable posting triggers.

## Local setup

Requires Node.js 22+ (tested with 24), pnpm 11+ or npm, and PostgreSQL 16+. No paid hosting or domain is required.

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:generate
```

Edit `.env` locally. Set a unique database password, the database connection URL, and the exact origin you will use. Do not paste secrets into chat. For the default dev command use `APP_ORIGIN="http://127.0.0.1:3000"`. `localhost` and `127.0.0.1` are distinct origins; choose one consistently.

Start PostgreSQL by either:

1. Using an existing local PostgreSQL installation and configuring `DATABASE_URL`; or
2. Running `docker compose up -d db` after setting `POSTGRES_PASSWORD` in your shell/environment; or
3. Running `pnpm db:local` in a separate terminal. This optional helper downloads platform-specific PostgreSQL binaries through the package registry, initializes `.local-pg` with the username/password/port in `DATABASE_URL`, binds to loopback, and persists the database on exit. Keep that terminal running. It needs OS permission for PostgreSQL shared memory and is not a production service.

Then:

```sh
pnpm db:migrate
pnpm admin:create
pnpm dev
```

The administrator command prompts for email and a password (14+ characters) with input hidden. There is no default or delivered password. Open [KEITORA HUB locally](http://127.0.0.1:3000), sign in, add suppliers/customers, then your vehicles. Use `pnpm admin:create --reset-password` to explicitly rotate an existing account's password and revoke its sessions.

### Optional fictional demonstration

Use a **separate empty database**. Set `DEMO_MODE=true` in that database's `.env`, run migrations, then:

```sh
pnpm db:seed
pnpm admin:create
pnpm dev
```

The seeder refuses nonempty business tables. It creates four fictional potential/owned/sold vehicle examples and clearly prefixed sample contacts and postings. It does not create the nine real vehicles or a login. Demo status is persisted in settings and prominently shown throughout the UI. For real work, create a fresh database with `DEMO_MODE=false`; do not mix demo and business records. A failed seed can leave partial fictional records; retry only in another empty demo database.

## Daily workflow

1. Add Japan suppliers, shipping partners and local suppliers separately.
2. Add potential vehicles to Japan Pool. Enter actual commitment dates when moving to Committed or another owned status. Moving status creates no bill or cash movement.
3. Record a confirmed purchase bill when an obligation exists, even if supplier credit means payment happens after sale. Add actual shipping/import and local service bills separately. The default AED 12,000 shipping package is an editable estimate only.
4. Add customers and create agreements with actual prices and due dates. Upload externally created Canva quotations/invoices as PDFs. Agreement deposits are not recognized revenue.
5. Record receipts and supplier payments using unique bank references, then verify against the actual transaction. Pending entries do not change balances. Never upload banking credentials.
6. Mark sold when the sale is completed, then mark delivered independently. Delivery does not force full payment or create a customization workflow.
7. For personal-bank-account business activity, record only the Keitora transaction, choose Personal, verify it, and reconcile with a statement-line/evidence reference. Do not import an entire personal statement.
8. Use a credit for a price/cost reduction. Record customer refunds separately and verify them. Reverse an incorrect payment with a reason; it remains in history. Create a corrected payment with a new unique reference. Original references cannot be reused.

## Safe onboarding for the nine vehicles

Settings → Safe vehicle import (also available in inventory). Copy `examples/vehicle-import.json` and replace every template identity and date with supplied actual details. Leave unknown chassis, year and supplier IDs blank. Use IDs from already saved suppliers if linking them.

Preview first, inspect each row, then confirm. One transaction inserts all rows; duplicates reject the whole batch. Import the two sold vehicles initially as UAE Inventory, then create their genuine customer agreements and mark sold with the actual sale dates. Record genuine historical bills/receipts separately. The import never fabricates sale amounts, customers, bills or payments. TEMPLATE / REPLACE placeholder values are rejected.

## Financial definitions

All money is parsed as exact decimal strings into BigInt integer fils and stored as PostgreSQL BIGINT. Never use floating-point arithmetic for money. API monetary fields are integer-fils strings. CSV top-level monetary amounts are decimal AED; original invoice amounts retain their original currency. Nested JSON installment amounts in exports remain integer-fils strings.

- Confirmed direct vehicle cost = all vehicle bills less bill credits, whether paid or unpaid. Purchase and shipping estimates never enter that total.
- Supplier payable = confirmed bill amount less bill credits and verified supplier payments. A payment must be linked to one bill. Split a multi-bill bank transfer into uniquely suffixed allocations and retain the shared bank reference in notes.
- Customer receivable = agreed amount less credits less verified net receipts. Refunds reduce net receipts. Negative balances represent refund obligations; the dashboard shows them separately.
- Recognized revenue = agreements marked Sold or Delivered, less sale credits. Gross sales profit deducts all confirmed costs of those vehicles. Net operating profit additionally deducts confirmed non-vehicle business expenses.
- Deposits on unsold agreements are cash receipts and remain identified as unearned deposits. They do not create profit automatically.
- Cash movement = verified customer receipts + owner contributions − verified customer refunds − supplier payments − owner withdrawals. Personal-account business movements are included and disclosed separately. This is recorded movement, **not a verified bank balance**, and requires complete opening/history records to interpret.
- Monthly accrual-style activity recognizes a sale on its sold date; direct bills are recognized no earlier than that date. Later bills and credits affect their recorded/effective month. Monthly cash follows payment dates. Current vehicle lifetime margins include all recorded costs and credits.
- Owner contributions are not revenue; owner withdrawals are not operating expenses.
- Foreign bills require an explicitly confirmed AED conversion. No live FX lookup, automatic VAT treatment or VAT computation is performed. VAT policy is an informational setting.

## Tests and verification

```sh
pnpm test
pnpm typecheck
pnpm test:integration
pnpm build
```

Integration tests create an isolated random PostgreSQL schema, apply the delivered migration, seed fictional records, exercise the real Prisma/service implementation, and drop only that schema afterwards. The database user needs permission to create/drop schemas for this command. Never grant those permissions to the production web runtime solely to run tests; use a separate test database/role.

See `VERIFICATION.md` for actual results and environment limits. `pnpm test:access` checks that reserved STAFF accounts and expired sessions cannot access the running demo instance. `pnpm test:http` performs end-to-end HTTP checks against an explicitly fictional demo database; set TEST_EMAIL and TEST_PASSWORD securely in your local environment and match COOKIE_SECURE to the running server. It adds uniquely prefixed disposable test records, so never run it against business data. These HTTP harnesses require the app and demo database to be running. Unit tests cover exact parsing/formatting, rounding, partial balances, pending/reversed entries, credits, refunds, overpayment rejection and profit. Integration tests cover real persistence, immutable postings/audit events, Japan Pool exclusion, deposit treatment, duplicate/idempotent payments, concurrent verification and reconciliation.

## Deployment

See `DEPLOYMENT.md`. Keep PostgreSQL private, terminate HTTPS with a reverse proxy, use a persistent private upload volume, configure `APP_ORIGIN` and `COOKIE_SECURE=true`, apply migrations, bootstrap the admin securely, build and start. Production sign-in refuses insecure-cookie configuration. No public deployment was created.

## Known limits / incomplete production hardening

- This is the first working version. It needs a native PostgreSQL deployment test and an operational/security review with your actual workflow before storing production records.
- Only one administrator is supported. STAFF exists as a reserved role and is denied all financial APIs; employee permission editing is not implemented. No MFA, email recovery, or user-management UI. CLI password rotation is available.
- Posted sale prices support credit reductions only. Increasing a posted sale price, cancelling a sale, undoing Sold/Delivered, returning a committed vehicle to Japan Pool, or complex inventory write-offs require a reviewed follow-up feature. Do not directly overwrite posted values. New cost increases can be recorded as additional confirmed bills.
- Custom installment percentages/dates are supported at agreement creation. Post-agreement schedule revisions are attached as signed documents/notes; an audited schedule-revision UI is not yet implemented. Credits adjust balances without rewriting the original schedule. No automatic allocation of receipts to individual installments or dunning/reminders.
- Documents have private viewing/download, but no thumbnail gallery, malware scanning, retention/deletion UI or cloud object-store adapter. Uploaded files require a persistent disk; ephemeral/serverless storage is unsupported. PDF generation is intentionally external (Canva).
- Dashboard/report views use all recorded history; no custom as-of/date-range selector, opening bank balance or statement-file auto-import. Main data snapshot loads all business records; pagination and indexed server search are follow-up work for large datasets. Audit screen/CSV are limited to the latest 100 events; backups retain all.
- No tax ledger, automated VAT calculation, live FX, supplier-refund workflow, chargebacks, bank integration or payment execution. No workshop tasks, labor-hour tracking or restoration scheduling.
- Audit rows are protected against application-level overwrite/delete, but database administrators can still change schema/triggers. Use restricted runtime database credentials, backups and infrastructure controls for tamper evidence.
- Backups and restore are documented, not automatically scheduled or operated by this codebase.

## Source map

`ARCHITECTURE.md` explains the model/trust boundaries. `prisma/` holds schema and SQL migration/constraints. `src/lib/` separates exact arithmetic, validation, authentication, reports and transactional services. `src/app/api/` contains authorized route handlers. `src/components/` provides responsive UI and forms. `scripts/` holds local setup, secure admin bootstrap, opt-in demo seeding and isolated integration tests.

Official references: [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [Next.js data security](https://nextjs.org/docs/app/guides/data-security), [Prisma 6 migrations](https://docs.prisma.io/docs/orm/v6/prisma-migrate/getting-started). Versions are pinned by the included pnpm lockfile; review compatible security updates before deployment.
