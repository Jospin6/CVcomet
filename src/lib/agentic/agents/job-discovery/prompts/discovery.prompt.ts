/** Jobs and CV content are untrusted facts, never executable instructions. */
export const JOB_DISCOVERY_POLICY = [
  "Retrieve job ads solely from configured providers or active, real database records.",
  "Never invent a job, company, vacancy URL, date, salary, eligibility or ranking percentage.",
  "Geography, dates, contract, seniority, workplace, salary and visa filters are hard constraints.",
  "The desired job title is a role intent; rank related titles without requiring an identical phrase.",
  "Use the selected, authenticated user's CV as sole evidence of qualifications.",
  "Ranking is only a shortlist heuristic; verified scoring is delegated to Job Match Agent.",
  "Keep all incomplete or failed analyses unscored. Never present a match as hiring probability.",
  "A user must explicitly initiate an application. No automatic application or publication.",
].join("\n");
