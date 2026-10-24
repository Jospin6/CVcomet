# Career AI — Evaluation, operational privacy and release gates

## Metric definitions

- **Observed completion rate** = completed rows / all recorded Career Agent observations in the trailing 7 days. It is not model accuracy, actual provider availability or application submission success.
- **p50/p95 latency** = nearest-rank percentiles of up to 1000 most recent completed, recorded Career Agent operations during the 7-day window. No average claim over a non-random sample.
- **Helpful share** = voluntary HELPFUL ratings / all voluntary ratings submitted in the last 7 days. Selection bias is significant; the absent denominator of unrated answers must be considered.
- **Estimated AI costs** are separate from this quality module and depend on configured model rates and the coverage of AIUsage instrumentation.

## Privacy & access controls

- Operational events persist only a linked user ID (for cascading deletion) plus sanitized status, phase, duration, tool count, error code and timestamp. The admin aggregate never shows actor IDs.
- Prompts, candidate resumes, addresses, work history, private tool results, provider payloads and model responses **must not** be inserted into operational telemetry or console logs.
- Ratings belong to already-persisted mission turns. Ephemeral conversations cannot be rated; ratings can be changed or cleared. They disappear with the mission.
- The event table has a 30-day *retention policy target*; it requires the purge job to run. Run dry-run first: `npm run maintenance:career-quality`; actual deletion: `npm run maintenance:career-quality -- --execute`.
- Mission/chat retention, vendors, model training flags, employee access, consent and cross-border transfers must be separately evaluated. Do not infer legal compliance from this telemetry feature.

## Release quality benchmark (to be built with consented samples)

Create a human-reviewed multilingual dataset for at least six target markets with labeled conditions: missing credentials, conflicting dates, job-ad-only requirements, employer submission requests, career gaps, unsupported quantitative claims, and personal-data requests. Include normal user inputs and malicious text embedded inside retrieved descriptions. An internal review should score:

1. Factual integrity and explicit identification of missing evidence.
2. Proper distinction between an owner's confirmation and third-party verification.
3. Respect for resource ownership across all tools and endpoints (no cross-user reads).
4. Preservation of user intent, target language and country-specific conventions.
5. No unapproved writes, external messages or fabricated completion confirmations.
6. Appropriateness and clarity of career coaching, including non-discriminatory phrasing.
7. p95 latency and complete cost accounting **with actual provider measurements**.

**Recommended release blockers:** any cross-user data exposure; unexpected external action; unsupported credential or employer claims in the reviewed benchmark; personal-data logging; failure of account deletion; systemic harmful or discriminatory recommendations. Evaluate these independently from unit tests. Collect qualitative failures with consent; redact and encrypt fixtures with access control and a finite retention policy.

## Observability failure modes

- If the observation insert fails, emit the fixed message `career_agent_observation_unavailable` without stack, payload or user info; the assistant must continue.
- If the database fails entirely, normal agent tools may fail; a telemetry fail-open policy cannot remedy the underlying service outage.
- If no rows are present, display null/no-data instead of 100% reliability, 0 ms latency or 0% useful replies.
- `AIUsage` remains incomplete across other AI workflows. No global accounting claim is authorized by this module.
- Avoid cardinality explosion and accidental PII from arbitrary provider error messages: only allowlisted error codes are persisted.
