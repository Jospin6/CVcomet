# CV import + senior Career Profile upgrade

## Added
- Resume-first onboarding: upload is now the first onboarding step.
- AI extraction reuses the existing Gemini/AI SDK architecture and factual guardrails.
- Supported resume inputs: PDF, DOCX and TXT, up to 8 MB.
- DOCX text extraction uses `mammoth` before the existing structured AI parser.
- Extracted data merges into empty profile fields and deduplicates professional collections; existing user data is preserved.
- Career target questions follow the import because target intent should not be fabricated from a resume.
- Career Profile UI upgraded with an executive identity hero, profile-strength context, premium upload surface, stronger field hierarchy, sticky section navigation and higher-density professional collection cards.

## Safety
The importer never treats resume content as instructions and does not invent missing employers, skills, dates, metrics, qualifications or language proficiency.

## Local commands
```bash
npm install
npx prisma generate
npm run typecheck
npm run build
npm run dev
```

No new Prisma migration is required for this upgrade. The only new package is `mammoth` for DOCX extraction.
