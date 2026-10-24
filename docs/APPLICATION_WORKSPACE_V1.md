# CVComet — UX Refinement 01: Application-first workspace

Date: 2026-10-24
Scope: incremental refactor based on stages 00–14, NOT a rewrite of the site.

## Design direction

Keep the existing green/ivory palette, light/dark themes, and sidebar. Reduce visual hierarchy in the main area; show the next actionable item and recent applications first. Put optional analytics and creation tools behind disclosure rather than displaying all components at once. Use compact buttons, motion that conveys meaning, and `prefers-reduced-motion` support.

References researched (inspiration, not assets reused):
- Huntr application packets: https://help.huntr.co/en/articles/14367332-application-hub-and-packets
- Teal job guidance by stage: https://help.tealhq.com/en/articles/9530119-job-tracker-guidance
- Teal application tracker: https://www.tealhq.com/tools/job-tracker
- Dribbble: https://dribbble.com/shots/17699644-Jobhuntly-Applicant-Dashboard
- Dribbble: https://dribbble.com/shots/27089818--AI-SaaS-Dashboard-UI-Chat-Based-Job-Board-Coaching-App-Design
- Linear design refresh: https://linear.app/now/behind-the-latest-design-refresh

## Implemented

1. **Overview** (`/`): shorter welcome section, three existing real-value counters, one next step, four recent application rows, advanced actions/analysis/resume previews collapsed by default. Existing functions are still accessible.
2. **Applications** (`/dashboard/applications`): compact searchable list, stage filters, creation form on demand, proper small buttons and responsive layout. Each row opens the detailed application.
3. **Application workspace** (`/dashboard/applications/[id]`): application-level status and stage timeline, overview, linked CV/cover letter, analyzed job, latest match, packet, interview preparation, follow-ups, notes and status activity. Existing specialized editors are opened through contextual deep links.
4. **Ownership checks**: PATCH of a linked resume, letter or job checks its actual owner server-side, not the client-side provided user ID. GET hides a job associated with another owner. An analyzed job can now create an application without requiring a separate manual title/company payload.
5. **Deep links**: Job Match points to the application workspace; packet preparation accepts an authorized `jobId` and `cvId` from the link; interview preparation loads authorized application context via `applicationId`.
6. **Visual motion**: small enter and hover motion; reduced motion honored.
7. **QA**: baseline tests 191/191, release phase14 4/4, UX-specific 6/6; syntax parsed successfully. These are static/unit tests, not staging validation.

## Safety & state

- "Ready" packet does not mean "sent"; no automatic employer submission or email is added.
- Existing Prisma relations are reused; no database migration is added in this iteration.
- A job match score is an indicative compatibility estimate, not an official ATS decision.
- Newly added data association checks are scoped to the logged-in owner.
- The user's existing sidebar and theme variables are unchanged.

## What remains for a true end-to-end experience

- Offer ingestion directly inside application details (today a user links an already analyzed offer).
- Embedded editors for CV and cover letter with automatic navigation back to the original application; currently linked editors are separate pages.
- Dedicated packet listing/filtering per application when several packets exist, rather than just a latest packet link.
- Contact management, reminders completion and external calendar integration (currently internal saved reminders only).
- One-click job-context agent thread with permanent links to a specific application and strict tool authorization.
- Comprehensive internationalized copy in all newly edited surfaces (French-first prototype), keyboard arrow operation for tabs, user usability tests and browser device tests.

## Staging checklist

1. Install dependencies from a lockfile, run `npx prisma generate`, `npm run typecheck`, `npm run build`.
2. Apply already existing migrations in staging, no new migration here.
3. Account A must be unable to retrieve/link account B's application, job, CV, cover letter or interview.
4. Create a job match; save it as an application; open its new detail page; verify job, CV, and match reference.
5. Create a manual application; link existing job, CV, letter; create a reminder; update notes/status; refresh and confirm persistence.
6. Open packet generation from the application; verify the correct job and CV are preselected, but no email is sent.
7. Open interview preparation from the application; verify the job title and authorized description are loaded, interview is attached to application after saving.
8. Test phone widths, keyboard, themes, screen reader and reduced-motion.
9. Confirm missing/failed APIs never masquerade as zero or a successful action.

## ZIP contract

Archive contains all paths created/modified relative to the **original** CVComet source from phases 00 through this UX increment, with each at its latest version. No unchanged original files, node_modules, caches, secrets or generated artefacts. Files removed from the original (if any) should be recorded in the manifest; this increment does not intentionally delete source files.
