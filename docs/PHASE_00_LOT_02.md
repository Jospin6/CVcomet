# CVComet 2.0 — Phase 00 / Lot 00.2

**Status:** Implemented in the working tree; local pure-policy tests passed. PostgreSQL end-to-end tests and build are not confirmed.

## Implemented

- All discovered user-facing provider workflows reserve one quota BEFORE sending a request to the provider, including paid accounts and title generation.
- Limits are applied per UTC day (existing `User.generationCount`), per UTC hour (request count) and per UTC month (workload credits).
- All three counters update in one PostgreSQL transaction; a rejected reservation rolls back all writes. Multiple server instances use the same table, rather than separate in-memory counters.
- Limits are finite for Free, Pro, Career Pro; legacy paid subscribers without a Subscription row fall back to Pro. The existing `userPlan` behavior was preserved.
- Main LLM calls bound output tokens/retries/timeouts. AI assistant and conversation title POSTs validate bounded JSON payloads.
- Paid accounts are no longer exempt from rate and daily caps. Failures after reservation consume quota (anti-abuse; intentional).
- Subscription cancellation/status transitions take effect on the next reservation read.
- Localized error codes distinguish daily/hourly/monthly limits in the job-analysis flow.
- `GET /api/ai/limits` reports only the current authenticated user's limits/remaining quota, with a private no-store response.

## Defaults, adjustable in server environment

| Plan | Daily operations | Hourly operations | Monthly workload credits |
|---|---:|---:|---:|
| FREE | 20 | 8 | 250 |
| PRO | 120 | 30 | 2000 |
| CAREER_PRO | 240 | 50 | 5500 |

Environment overrides: `AI_QUOTA_<PLAN>_DAILY`, `AI_QUOTA_<PLAN>_HOURLY`, `AI_QUOTA_<PLAN>_MONTHLY_CREDITS` (where `<PLAN>` is `FREE`, `PRO` or `CAREER_PRO`). Overrides must be positive integers within a protective ceiling; invalid values fall back to defaults. Values are policy defaults, **not an approved pricing promise**.

### Important distinction

**Workload credits are NOT dollar charges.** A title costs one internal credit; resume, job, cover letter and ATS operations cost 2–7 depending on typical complexity. Actual model/token pricing, provider charges, credit refunds, invoicing, and real spend caps require a separate provider usage ledger. Do not claim dollar-budget enforcement from this implementation. The existing `AIUsage` table continues to capture token usage for some paths, not all.

## Installation

1. Back up the existing database.
2. Apply the **previous** Phase 00.1 migration first (if not already done), then `20261024120000_ai_quota_windows`.
3. Run `npx prisma generate` to expose `prisma.aiQuotaWindow`.
4. Review quotas relative to actual pricing before changing plan defaults.
5. In a staging environment, test concurrent requests from multiple application instances, quota rollover at UTC hour/day/month boundaries, downgrade/upgrade, and provider failures.
6. Test all premium/free UI flows, especially title generation for conversation creation and the interview-preparation error handling.
7. Run `npm run test:ai-quotas`, `npm run test:email-verification`, `npm run typecheck`, `npm test`, and `npm run build` after installing dependencies.

## Pending for later Phase 00 hardening

- PostgreSQL integration / E2E tests for atomic contention, migration, account deletion and plan changes.
- Accurate per-provider/token USD costs and completion reconciliation; idempotent per-request trace ledger (Phase 13).
- IP/device anti-abuse on auth/email and other non-AI endpoints, plus distributed unauthenticated rate limits.
- Capped request bytes across remaining non-IA APIs, CSRF review, security header audit, error-code translations across every screen.
- Thorough provenance approvals for AI edits (Phase 03/04), and comprehensive monitoring / audit log.
- Old quota counters for paid users now increment; update any existing UI that assumes paid is unlimited.
- `AiQuotaWindow` cleanup/retention job is required before operating at scale; preserving old records cannot bypass rate limits.

## Delivery contract

Each delivery ZIP contains **only the union of created/modified files** from Phase 00.1 through the current stage, with original relative paths preserved. Deletions (if any) must be described separately because ZIP cannot remove files.
