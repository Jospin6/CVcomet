/** Fixed, non-generative editing guidance: never ask another agent to add facts
 * merely because a job posting asks for them. */
export const RESUME_ACTION_WORDING = {
  fr: {
    SELECT_RESUME: "Sélectionner un CV avant toute adaptation.",
    BRING_PROFILE_EVIDENCE: "Proposer d'intégrer cette preuve déjà présente dans le profil, sans ajouter de faits.",
    REINFORCE_CV: "Clarifier la preuve existante dans le CV avec un exemple réel, après validation.",
    VERIFY_FACTS: "Vérifier ce critère et la preuve avant de proposer une modification.",
    REVIEW_GAP: "Ne pas présenter ce critère comme acquis sans preuve ; demander une information réelle.",
  },
  en: {
    SELECT_RESUME: "Select a resume before tailoring.",
    BRING_PROFILE_EVIDENCE: "Propose bringing existing profile evidence into the resume without adding facts.",
    REINFORCE_CV: "Clarify existing resume evidence using a genuine example, subject to review.",
    VERIFY_FACTS: "Verify this requirement and the evidence before proposing an edit.",
    REVIEW_GAP: "Do not claim this requirement without evidence; request a real fact first.",
  },
} as const;
