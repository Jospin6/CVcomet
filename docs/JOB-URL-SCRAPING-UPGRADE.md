# Job URL Intelligence upgrade

Job Match is now URL-only. The user pastes a public job-posting URL; CVcomet retrieves and cleans the page server-side, extracts structured `JobPosting` JSON-LD when available, falls back to readable HTML, then uses the existing Gemini abstraction to structure the requirements before calculating the match.

## Security
- HTTP/HTTPS only
- credentials in URLs rejected
- localhost, `.local`, private, loopback and link-local addresses rejected
- DNS is resolved before every request/redirect
- redirects are manually revalidated (max 4)
- 12s request timeout
- 2.5 MB response cap
- HTML/XHTML only
- remote JavaScript is never executed
- page content is explicitly treated as untrusted data by the AI layer

## Product behavior
The manual job-description textarea was removed from `/dashboard/job-match`. `JobOpportunity.sourceUrl` stores the final public URL and `JobOpportunity.description` stores the extracted text, so downstream tailoring, cover letters, applications and interviews keep using the existing data model.

Some job boards require authentication, render all content client-side, or block automated requests. CVcomet returns a clear error in those cases and recommends the employer's public careers page. It does not fabricate missing job content.

## Dependencies
No new npm dependency is required for this upgrade.
