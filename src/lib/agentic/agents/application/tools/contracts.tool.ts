/** Inputs have been read from resources already authorized by the owning API/service. */
export type ApplicationLanguage = "fr" | "en";
export type ApplicationEmail = { subject: string; body: string };

/** No applicant data other than a signer name is necessary to assemble the conservative first draft. */
export type ApplicationPacketInput = {
  language: ApplicationLanguage;
  jobTitle: string;
  company: string | null;
  signer: string | null;
};

/** Self-reported career facts are NOT verified employment records. */
export type ApplicationSuggestionInput = ApplicationPacketInput & {
  description: string;
  profileFacts: string[];
  technicalTerms: string[];
};

export type ApplicationSuggestionDependencies = {
  generateEmail: (input: ApplicationSuggestionInput, signal: AbortSignal) => Promise<ApplicationEmail>;
  /** Must be the server's existing factual guard; no model-generated verdict is trusted. */
  verifyFacts: (email: ApplicationEmail, input: ApplicationSuggestionInput) => void;
};
