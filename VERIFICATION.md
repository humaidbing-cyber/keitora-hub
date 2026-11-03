# Verification — 1 November 2026

## Passed

- Production Next.js build (Turbopack), including strict TypeScript validation and all API routes.
- 18 automated unit tests across exact integer-fils arithmetic, rounding, refunds/credits, unpaid/partial balances, safe vehicle onboarding and Dubai-midnight payable aging.
- 34 real Prisma/database service assertions in a freshly migrated isolated schema. Coverage: unpaid vehicle purchases, costs regardless of payment, sold revenue/profit, unearned deposits, Japan Pool exclusion, partial supplier payments, idempotency, duplicate reference rejection, customer refunds/reversals, supplier/customer credits, payment over-allocation, simultaneous verification, owner-movement exclusion from profit, future-payment verification rejection, monthly-to-lifetime reconciliation, immutable postings/audit and personal-account reconciliation.
- 31 HTTP assertions against the compiled application: unauthenticated denial, same-origin enforcement, sign-in, secure HttpOnly SameSite cookies, persistence after re-read, malformed/duplicate requests, private upload/download, content-type forgery rejection, verified-only cash export, vehicle import preview versus confirmation, and sign-out/session revocation.
- 4 additional HTTP authorization checks: reserved STAFF denied data reads, exports and mutations; expired sessions denied.
- Browser sign-in, desktop dashboard, inventory navigation, vehicle-entry dialog, customer creation and archive through the UI, iPhone-width layout (390 × 844), no page-wide horizontal overflow and mobile navigation. The closed mobile drawer is hidden from focus/screen-reader navigation. Source financials were not exposed to an unauthenticated browser.
- Actual supplied logo included as the primary asset; black lettering preserved. All seeded financial records clearly labeled fictional. The real nine vehicle identities/amounts were not invented.

## Environment and limits

The execution sandbox blocks native PostgreSQL shared-memory syscalls (`shmget: Operation not permitted`). For local verification only, PostgreSQL SQL/migrations/Prisma were run through PGlite 0.5.13 (PostgreSQL in WebAssembly) and its official loopback socket adapter 0.2.16. Production application code uses standard PostgreSQL and Prisma, not a browser database. PGlite was an external QA tool, not a delivered application dependency.

The simultaneous-verification test issued both requests together and only one succeeded. PGlite serializes/multiplexes connections; this is not a substitute for testing PostgreSQL's native Serializable isolation and deadlock behavior under load. Run the included integration suite on native PostgreSQL before production use. No real bank data or transactions were used.

Native filesystem watchers also failed inside the sandbox. The compiled production server was used for browser/HTTP checks; the production build itself completed successfully. The delivered default build uses Turbopack and a scoped tracing root. No hosted/public deployment, backup operation, restore drill, real iPhone-device test, or external penetration test was performed.

Screenshots are illustrative captures of fictional demo records, not evidence of real business balances. The archive excludes test credentials, local database files, private uploads, dependency folders and build output. No default administrator password is supplied.

## Still required before production use

Follow README known limits and DEPLOYMENT.md. Provision native PostgreSQL and a private HTTPS service with persistent private storage; run the native integration suite; bootstrap the administrator locally; exercise and reconcile the actual onboarding workflow; perform a paired database/file backup and restore drill. Employee permissions, schedule revisions, sale cancellations/price increases and other explicitly listed follow-up workflows are incomplete.
