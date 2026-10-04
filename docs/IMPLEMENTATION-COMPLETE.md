# CVcomet — Career Platform implementation

## Preserved
- Existing Next.js App Router, Prisma/PostgreSQL, JWT auth, Redux state, Radix/Tailwind UI, i18n, Gemini AI SDK generation, React-PDF templates and existing Stripe flow.
- `Cv` remains the resume model; no duplicate Resume model was introduced.
- `User` + Experience/Education/Project/Certification remain the Career Profile source.
- Ivory/deep-green light/dark design from phases 0–2 remains the visual foundation.

## Implemented
1. Design shell/navigation: all career modules now have live routes.
2. Career Profile/onboarding: preserved existing completed Phase 2 implementation.
3. Resume workspace: personal resume listing, ownership-protected editor, A4 preview, save and factual AI summary proposal.
4. Resume history foundation: `ResumeVersion`, snapshot before edits/restores, version list/restore APIs; existing template/PDF system preserved.
5. Resume AI Copilot endpoint: improve/shorten/professional/grammar/ATS actions with strict no-invention system rule.
6. ATS Checker: persisted, explainable readiness estimate with score breakdown and recommendations.
7. Job Match: job description parsing, persisted JobOpportunity/JobMatch, matched/missing/unverified skills and explainable score.
8. Tailoring: safe before/after proposal endpoint that only highlights skills already found in the resume.
9. Cover Letter + application email: existing structured cover-letter generator preserved; new factual email generator/UI added.
10. Applications: CRUD, statuses, responsive cards and conversion analytics data.
11. Interview Coach: HR/behavioral/technical/leadership sessions, persisted messages, transparent coaching estimate.
12. Career Assistant: Gemini-backed assistant grounded in confirmed Career Profile + recent applications.
13. Stripe: Free/Pro/Career Pro checkout, webhook sync, Subscription model, customer portal, centralized feature entitlement foundation, AIUsage model.
14. Analytics + portfolio + i18n foundation: analytics dashboard; opt-in public portfolio with slug; existing FR/EN architecture preserved.
15. Production surface: Features/Pricing pages, private-route robots exclusions, package/config restoration, environment documentation and migration.

## New persistent models
ResumeVersion, AtsAnalysis, JobOpportunity, JobMatch, JobApplication, InterviewSession, InterviewMessage, AIUsage, Subscription.

## Verification performed in sandbox
- Local import resolver: 0 broken `@/` imports.
- Relative import resolver: 0 broken relative imports.
- TypeScript parser reached the project without syntax failures in the added code, but dependency typechecking could not complete because the uploaded archive omitted package.json/node_modules and sandbox npm network installation timed out.

## Required local verification
Run, in order:

```bash
npm install
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev
npm run typecheck
npm run build
npm run dev
```

If this is an existing production database, first back it up and use your deployment migration process (`npx prisma migrate deploy`) rather than reset.
