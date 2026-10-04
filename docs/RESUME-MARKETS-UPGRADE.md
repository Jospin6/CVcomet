# Resume markets & template personalization

CVcomet now separates the candidate's location from the hiring market. The onboarding stores a target market and an optional acquisition source. The selected market is part of the Career Profile context used by the existing AI pipeline.

Supported market families: US/Canada, UK/Ireland, Europe, Africa/International. These are product profiles, not claims that every country inside a region follows identical rules. Country/job tailoring remains authoritative.

Templates can declare compatible markets, a style family, whether they are customizable, and allowed accent colors. An empty markets array means universal. The template gallery defaults to the user's onboarding market, supports market filtering, and keeps CV and cover-letter color preferences separately.

Database migration: `20261004150000_resume_markets`.
