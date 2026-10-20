# ATS diagnostic, version 2

The checker reports three separate results. There is no universal ATS percentage,
predicted acceptance probability, or average of unrelated scores.

## PDF inspection

The editor sends the bytes of the same PDF component and page layout used for
download. An existing PDF can be selected instead. The server extracts its actual
text and geometry, checks visible-field recovery, fragmented section headings,
character integrity, possible column interleaving, text size and off-page text.
The extracted text is available beside the resume. No file means “not assessed.”
An image-only document is reported as requiring OCR, not successfully parsed.

The technical index uses a documented internal rubric: text extraction 30,
field recovery 30, character integrity 10, heading readability 10, reading order
10 and text reading comfort 10. A size/layout warning is a risk indicator, not
proof that every recruiting system will reject the document. Text size is a
human readability check. Missing critical fields are reported individually.

Greenhouse documents parsing problems with letter-spaced words, image resumes,
columns and unclear sections. That is evidence for investigating these risks,
not a calibration dataset for a universal score:
[Greenhouse parsing guidance](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse).

## Content rubric

| Criterion | Points | Evidence required |
| --- | ---: | --- |
| Identification/contact | 10 | Visible name and correctly formatted email |
| Usable structure | 10 | Headline, introduction, practical work and technical skills |
| Demonstrated skills | 20 | Skills connected to the methods quoted in work/project descriptions |
| Entry integrity/chronology | 10 | Identifiable organizations/titles and valid, ordered dates |
| Substance of contributions | 25 | Quoted personal action, method and explicitly observed outcome |
| Supported positioning | 15 | Headline compared with actual practical contributions |
| Clarity/writing | 10 | Contextual review of the actual professional prose |

Skill attribution and the last three criteria use the configured AI provider;
the last three have an explicit 0–4 rubric. Each contextual assessment must cite
exact, existing, visible fields.
Every nonempty work/project description must have an attribution identifying
its action, method and outcome, or explicitly recording that each is absent.
Every listed skill also receives an attribution to practical description
evidence, including semantic equivalents rather than literal keyword matching.
Higher contribution bands require observed outcomes, including qualitative
outcomes; dates, technology versions and isolated numbers do not earn points.
Unsupported quotations invalidate the review. Rewrites adding new numerical
claims or links are discarded and accepted rewrites still require user approval.
Invalid schema or quotations receive at most one correction attempt within the
same 45-second deadline; continued failure leaves the content score unknown.

Unassessed criteria remain null. If contextual review fails or the quota is
exhausted, there is no complete content score. The UI retains completed checks
and explicitly reports the assessed portion. Empty work and placeholder text
also prevent a high content classification. Skills-list length, employer/school
prestige, identity, nationality, employment gaps and short assignments do not
provide quality bonuses. Projects and internships can supply practical evidence.
Project-only portfolios are assessed on their identifiable projects without
requiring an employer, a degree or date fields the project editor does not offer.

This rubric is a transparent product assessment, not externally calibrated
predictive performance or verification that a candidate's claims are true.

## Job alignment

No job posting means no job alignment score. The existing job analyzer extracts
explicit requirements and verbatim source evidence. Matching uses the visible
resume only; central profile facts and hidden sections cannot fill omissions.
The editor lists the user's saved JobOpportunity records, searchable by role
or company with pagination. Labels combine the role and employer, for example
“Chief AI Officer at Meta.” A new posting saved from the checker requires a
nonempty title and remains available for later assessments. Saving does not
invoke AI. Existing analysis imports retain a source excerpt if no role title
was extracted.

ATS requests reference a saved job by ID. Ownership is checked before PDF/AI
processing, and the server loads the description itself. Each report retains
the selected job ID, title, company and revision timestamp. Changing the target
marks the displayed report outdated; the target and current description also
participate in cache keys. Valid saved requirement citations can be reused;
invalid or older citations require a new extraction against the stored text.
Opening the checker loads the job catalog without starting AI. The user chooses
the target and starts the assessment explicitly. A valid saved requirement
analysis remains usable for job alignment if AI content review is unavailable.
For generated resumes, the posting from the initial generation conversation
is preselected. New generations save that posting; older generated CVs can
recover it from their original conversation and generated CV message. An
adapted copy uses its explicit tailoring relationship. Recent comparisons
and unrelated postings never become generation defaults. Imported and scratch
resumes remain unselected when no source exists. An explicit user choice,
including a general assessment without a posting, takes precedence over a
late source lookup and is preserved when reopening the checker.
Technical skills listed without practical context remain “needs verification.”
Required, preferred and mentioned criteria have weights 3, 1 and 0.25.
Demonstrated criteria earn full weight, partial evidence half weight and absent
evidence none. Uncertain criteria produce a lower/upper range and prevent a
complete point score; removing uncertainty from the denominator must never
inflate a displayed score.

## Storage and verification

The existing JSON `issues` column stores a versioned `ATS_REPORT_V2` envelope.
API responses expose its report, not the storage envelope. Legacy arrays are
identified as legacy and their old percentages are not displayed or averaged
into current analytics. Ownership is checked before PDF/AI processing. Identical
completed requests reuse a fingerprinted report, and concurrent identical
requests share one assessment and quota reservation.

Run `node --test scripts/ats.test.cjs` for scoring, evidence, PDF, SDK, ownership,
history and concurrency regression tests. Run `npm run check:resume-ats-ui` with
a local dev server for desktop/mobile tests using real PDF generation/extraction
and isolated authentication/AI fixtures. These tests do not call a paid model.
