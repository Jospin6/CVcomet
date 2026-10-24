# CVComet 2.0 — Phase 00 / Lot 00.3

**Date:** 2026-10-24  
**Status:** Changes implemented locally. Release remains **blocked** until full installation, build, real database validation, and security regression testing.

## Scope of this lot

- Prevent account email takeover through ordinary profile writes, in both `PUT /api/users/[id]` and the advanced career-profile service. Account email remains uneditable in these profile screens until a dedicated, verified email-change flow is implemented. A separate career contact email belongs inside CV documents, not the authentication email.
- Protect template uploads using bounded multipart reads (including missing `Content-Length`), 2 MiB max file size, MIME/signature checks for PNG/JPEG/WebP, validation of name/type/style/markets, and consistent error codes.
- Stop returning binary template images in JSON list/detail responses. `GET /api/avatar?id=...` supplies bitmap previews with a detected Content-Type, `nosniff`, and bounded public caching; invalid legacy previews return 415. Redux template type now makes legacy `templateFile` optional for compatibility.
- Strengthen account template selection: authenticated same-user only, URL/body ID consistency, valid template type, response allowlisting, 4 KiB JSON limit. This avoids returning sensitive `User` columns.
- Restrict template-plan updates to validated roles/plans, with a bounded JSON body, ID consistency, and a metadata-only response.
- Limit `POST` request sizes for legacy login/signup/verification/resend/confirm endpoints, and for Stripe checkout and cancellation requests. Note that this is per-request input bounding, **not** distributed rate limiting.
- Fix the legacy `SubscribeButton` to invoke the existing checkout contract `{ plan: "PRO" }` instead of the older client-side price ID contract.
- Only the authenticated subscriber can request subscription cancellation. Continue to use Stripe webhooks for authoritative account status.

## Modified-data compatibility and design decisions

- The main sign-in email is now read-only in the basic user editor and career profile; the API returns `409 EMAIL_CHANGE_REQUIRES_VERIFICATION` for an attempt to change it. This is an intentional security boundary until a complete verified address-change journey exists.
- The `Template` JSON response no longer contains `templateFile` binary bytes. The existing image component already requests `/api/avatar?id=<id>`.
- Template previews from legacy database records that are not PNG/JPEG/WebP or have malformed signatures may now show `UNSUPPORTED_PREVIEW`; re-export them using a supported format.
- New template previews must be PNG/JPEG/WebP and <=2 MiB. The upload form displays this constraint.
- Template selection endpoints return only the selected ID and color setting, not an entire `User` object. The existing Redux thunk only depends on successful completion.
- The subscription cancellation endpoint now returns `{ scheduled: true }` instead of a plain text message; the legacy thunk does not parse the response shape. Verify all UI notices in staging.
- No new schema changes or migrations are introduced in this lot. The cumulative delivery retains **both earlier migrations** unchanged.

## Local validation performed

- `npm run test:security-guards`: **14/14 passing**. 9 are the Phase 00.1/00.2 policy tests; 5 added in this lot, including pure image/email checks and static source guards. These are NOT full HTTP/DB integration tests.
- TypeScript syntactic transpilation of **326 TS/TSX files** using the installed TypeScript compiler: **0 syntax diagnostics**. This cannot validate runtime dependencies or all semantic types.
- `npm run typecheck`: **unable to complete meaningfully** because the supplied project has no `node_modules`. TypeScript reports missing Next.js, React, Prisma and other dependencies. Run `npm install`, `npx prisma generate`, then retry on a local/staging machine.
- Full Next build, database migrations, real Stripe/Resend calls, concurrency and browser flows: **not executed**.

## To validate in staging (required before production)

1. Back up your PostgreSQL database and source tree. Apply the first two Phase 00 migrations in order, then `npx prisma generate`.
2. `npm install && npm run test:security-guards && npm run typecheck && npm test && npm run build`.
3. Confirm user sign-in/signup, one-time email codes, and correct session handling.
4. Confirm a normal profile update succeeds, an attempted email change is rejected, and the career profile remains consistent.
5. Confirm template upload/image rendering/listing, type selection, admin plan updates, and that passwords/tokens and binary previews are absent from JSON responses.
6. Check paid subscription checkout/portal/cancellation flows against Stripe test mode and webhook replay/order before production.
7. Test the full Prisma schema and quota windows against real PostgreSQL, including simultaneous requests from multiple instances and period rollover.
8. Review all remaining sensitive APIs (not just the subset modified here), same-site/CSRF protection, distributed rate limits, and account deletion cascades.

## Remaining before closing Phase 00

- Real database integration/E2E checks, migrations, typecheck, lint, build, and browser smoke tests.
- Distributed IP / anonymous abuse protection; CSRF/origin review and audit of remaining non-AI endpoints.
- Stripe webhook replay/idempotency and fraud controls; more thorough email-change + confirmation workflow.
- Provider cost ledgers, alerting, and scheduled cleanup of AI quota window rows.

**Cumulative ZIP contract:** The delivered archive contains the union of new/modified files from Phase 00.1, 00.2, and 00.3 in their original paths. No unchanged source files or build artifacts such as `tsconfig.tsbuildinfo` are included.
