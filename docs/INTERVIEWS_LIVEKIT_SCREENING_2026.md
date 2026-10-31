# CVComet 2.0 — Interviews & AI Screening Call

This patch replaces the `/dashboard/interviews` page with a small-card gallery and a modal for Basic / Personalized interview preparation. It also adds a **LiveKit WebRTC voice call simulation** that uses an existing application (CV, job description, and recruiting company name/context).

## 1. Install after merging the files

From the CVComet project root, run:

```powershell
npm install
npx prisma generate
npm run typecheck
```

The modified `package.json` declares `livekit-client`, `@livekit/components-react`, `@livekit/components-styles`, `livekit-server-sdk`, `@livekit/agents`, and `@livekit/agents-plugin-openai`.

**There is no Prisma schema change or migration.** Screening calls are saved in the existing `InterviewSession` and `InterviewMessage` tables. Text feedback uses the existing AI SDK and provider configuration. Model API calls cost money and use existing AI quota controls.

## 2. Environment configuration — configure yourself

Do not put secrets in a browser-visible `NEXT_PUBLIC_*` variable.

App server (Next.js):

```env
LIVEKIT_URL=wss://YOUR_LIVEKIT_HOST
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
CVCOMET_VOICE_WORKER_SECRET=LONG_RANDOM_SECRET_SHARED_WITH_WORKER
```

Worker host (separate Node process, e.g. VPS):

```env
LIVEKIT_URL=wss://YOUR_LIVEKIT_HOST
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
CVCOMET_INTERNAL_URL=https://YOUR_PUBLIC_CVCOMET_APP_OR_REACHABLE_INTERNAL_ORIGIN
CVCOMET_VOICE_WORKER_SECRET=SAME_LONG_RANDOM_SECRET
```

`CVCOMET_INTERNAL_URL` must be reachable *from the worker*, and must use HTTPS outside localhost. Do not point it at an internal Next.js URL that the worker cannot reach. The worker-secret endpoints are protected by constant-time Bearer-token comparison, not by user cookies.

Run the worker in **a separate long-running process** (not as a Vercel serverless function):

```powershell
npm run worker:screening:dev
```

For a production process supervisor:

```powershell
npm run worker:screening
```

The registered LiveKit **agent name must be `cvcomet-screening`**, matching the explicit dispatch from the Next.js API. LiveKit service credentials and the OpenAI API key must both be valid. Restart the Next.js server after adding environment variables.

## 3. User experience

- **Basic:** title and seniority (Junior / Mid / Senior). 20 questions, current app language. No CV required.
- **Personalized:** role + seniority + a visually selected CV. Optionally choose an application with its existing CV and job description. The job description is loaded from the server and does not need to be pasted again.
- **Saved interviews:** compact cards; select to read prepared questions, answer or review a saved report.
- **AI Screening Call:** choose an owned application with a CV and job description, give explicit consent to storing a text transcript and report, then start. The worker fetches an immutable CV/job snapshot securely. It conducts one spoken question at a time, listens, follows up, and ends with coaching feedback. No outgoing phone number or PSTN/SIP call is placed; this is a real-time voice simulation inside CVComet.

## 4. Privacy, authorization, safety

- Every candidate API is authenticated. A new call requires ownership of both the application and the CV, and an associated job description.
- The worker receives only an opaque session ID from dispatch; the CV/job/company context is obtained over a protected internal API.
- Room participant tokens are short-lived and scoped to a single opaque room. LiveKit API secrets never go to the browser.
- The app only persists text transcripts and coaching reports after explicit opt-in. The worker does not create audio recordings or enable LiveKit egress. **Check your LiveKit/cloud provider's own observability and retention settings separately**; provider-side logs or recordings are governed independently.
- The company context includes its actual name, location, and the application’s existing job description. There is **no automatic external company research** and no fabricated company information.
- The AI evaluates CV consistency, job relevance, communication, motivation, experience and professionalism. Scores describe practice responses, not actual hiring chances. If transcripts are insufficient or the evaluator is unavailable, scores remain **null** rather than invented.
- Do not auto-send applications. Do not ask for legally protected personal characteristics. Scores must never be used to decide who gets hired.

## 5. Verification checklist

1. Log in and visit `/dashboard/interviews` — new interview cards appear.
2. Create a **Basic** interview, check that exactly 20 questions are prepared in the app language.
3. Create a **Personalized** interview using a CV or existing application; ensure its questions reflect that CV and job, not an unrelated profile.
4. Select a stored interview and check that the text practice still starts, records answers, finishes and shows the existing evaluation.
5. Start an **AI Screening Call** using a completed application. Rejecting consent must prevent start. Missing CV/job description must prevent start.
6. Check that a valid LiveKit room is joined and the AI asks a single question then follows up naturally. Check the mic mute/unmute and hang-up.
7. After hanging up, the stored interview should update to completed or ungraded, with no fictional score, and the transcript/history is accessible only to its owner.
8. Test with no worker online: the API should return a clear `VOICE_AGENT_UNAVAILABLE` error, not a fake success.
9. Test a disconnected call and the second attempt after finishing.
10. Run `node --experimental-strip-types --test scripts/interviews-screening-2026.test.mjs scripts/interview-coach-phase10.test.mjs scripts/interview-coach-boundaries-phase10.test.mjs`, then `npm run typecheck` and `npm run build` after dependencies are installed.

## 6. Deployment notes

- Screening uses OpenAI Realtime through LiveKit Agents (`@livekit/agents-plugin-openai`); the browser talks only to LiveKit and the Next.js token API.
- For reliability, run the worker via a process manager (PM2/systemd) on an always-on host.
- The first test must use live Neon, LiveKit, the configured OpenAI key, and a browser microphone permission. These integrations **have not been exercised in this artifact environment**.
- Recovery from abnormal worker termination and report retries should be added to your operational monitoring before production; a session left in `VOICE_ENDING` does not receive a fabricated report.
