# KEITORA HUB — first-version architecture

A local-first deployment (not offline browser storage): Next.js App Router + TypeScript, Tailwind, PostgreSQL 16+ and Prisma 6. All records live in PostgreSQL; files live outside public/ on a persistent private volume. No browser credentials or financial calculations.

## Trust boundary

Server route handlers authenticate opaque database-backed sessions, check the administrator role on every read/write, validate input with Zod, and reject cross-origin mutations. Session tokens are random, stored only as hashes, expire after 12 hours, and use HttpOnly/SameSite cookies (Secure on HTTPS). Login throttling is database-backed. Staff roles exist but are denied financial access until granular permissions are implemented. No self-registration. Bootstrap administrators through an interactive CLI. Audit events accompany mutations in the same transaction.

## Data model

- User → Session; LoginAttempt for throttling.
- Party: supplier or customer. Supplier group distinguishes Japan, import partner, local.
- Vehicle: unique business ID and optional unique chassis; Japan Pool is unowned and excluded from liabilities. Operational transitions do not create financial records.
- Bill: immutable confirmed supplier obligation, optionally attributable to a vehicle; AED integer fils plus original-currency amount and a manually confirmed AED conversion. Purchase bills require commitment. No estimates become bills automatically.
- Sale: agreed customer amount and exact installment amounts; AGREED deposits are unearned. SOLD recognizes revenue/cost of sales; DELIVERED is separate. Price corrections use immutable credit adjustments.
- Payment: positive integer fils, unique reference and idempotency key, separate verification, allocation, account and reconciliation. Supplier payments require a bill; receipts/refunds require a sale. Verified refunds reduce net receipts. A reversal preserves the original record and audit history.
- Adjustment: nonnegative credit against a bill or sale with a reason. Over-refunds and overpayments rejected; credits cannot reduce a bill below payments. Customer credits can temporarily produce a refund obligation.
- Document: randomized storage key, type/size checked, authenticated download, attachment disposition, no public URLs.
- Audit: append-only application log with actor, action and payload. Settings: editable shipping estimate, categories, payment plans, VAT policy note.

## Accounting boundaries

Integer fils / BigInt for all arithmetic. Exact decimal parsing at the input boundary; serialization uses decimal integer strings. Confirmed direct costs include unpaid bills minus credits. Receivables = agreement minus credits minus verified net receipts. Supplier payables = bills minus credits minus verified net payments. Gross realized margin recognizes all direct costs of SOLD/DELIVERED vehicles. Business expenses are recognized when confirmed, independently of payment. Cash movement includes only verified recorded payments; owner movements never affect profit. Personal-account movements are separately identifiable and require reconciliation. Cash is movement, not a claimed bank balance. No tax-accounting claims or assumed VAT treatment.

## Implementation sequence

1. Schema/migration and arithmetic invariants.
2. Authentication, authorized transactional services, private documents, immutable postings.
3. Responsive dashboard, CRUD, payments, Japan pool, reports, onboarding and settings.
4. Unit/integration tests, production build, local browser verification, deployment/restore instructions.

The nine known UAE vehicles (including two sold) are onboarding context only, never fabricated rows. Demo seeding is opt-in and requires an empty database and explicit DEMO_MODE=true. It uses unmistakably fictional identifiers.
