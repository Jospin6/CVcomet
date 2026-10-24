/** Interview Coach 2.0: pure policies, intentionally independent from Prisma and AI providers. */
export type CoachLanguage = "fr" | "en";
export type CoachQuestion = { question: string; suggestedAnswer: string; focus: string };
export type CoachRubric = { relevance: number; specificity: number; structure: number; clarity: number };
export type CoachFeedback = {
  status: "evaluated" | "unavailable";
  score: number | null;
  criteria: CoachRubric | null;
  strength: string;
  improvement: string;
  nextExercise: string;
  evidenceQuote: string;
  disclaimer: string;
};
export const COACH_DISCLAIMER = "Évaluation pédagogique et indicative, jamais une prédiction d'embauche.";
const themes: Array<[string, string, string, string]> = [
  ["Présentez votre parcours et expliquez pourquoi ce poste vous intéresse.", "Introduce your background and explain why this role interests you.", "motivation", "Décrivez uniquement votre parcours réel."],
  ["Parlez d'un problème complexe que vous avez résolu personnellement.", "Describe a difficult problem you personally solved.", "problem_solving", "Expliquez le contexte, votre action et le résultat réel."],
  ["Racontez une collaboration difficile et la manière dont vous l'avez menée.", "Describe a challenging collaboration and how you handled it.", "collaboration", "Précisez votre rôle et ce que vous avez appris."],
  ["Décrivez un échec ou une erreur et ce que vous en avez tiré.", "Tell me about a mistake and what you learned from it.", "learning", "Évitez d'inventer des résultats ou d'accuser des collègues."],
  ["Donnez un exemple de priorité concurrente et expliquez votre décision.", "Give an example of competing priorities and explain your decision.", "prioritization", "Montrez vos critères de choix et leurs conséquences."],
  ["Expliquez comment vous avez appris une compétence nécessaire à un projet.", "Explain how you learned a skill required for a project.", "adaptability", "Citez une expérience concrète et vérifiable."],
  ["Présentez une situation où vous avez reçu une critique constructive.", "Describe a time you received constructive feedback.", "feedback", "Distinguez votre réaction de l'évolution observée."],
  ["Expliquez une décision prise avec des informations incomplètes.", "Describe a decision you made with incomplete information.", "judgment", "Exposez les risques, options et vérifications."],
  ["Comment mesureriez-vous votre réussite pendant les 30 premiers jours ?", "How would you measure success in the first 30 days?", "planning", "Proposez des étapes réalistes plutôt que des promesses."],
  ["Quelle question poseriez-vous au recruteur sur les attentes du poste ?", "What would you ask the recruiter about the role's expectations?", "curiosity", "Montrez votre intérêt pour les objectifs réels du poste."],
  ["Parlez d'un changement inattendu qui a affecté votre travail.", "Describe an unexpected change that affected your work.", "resilience", "Expliquez votre adaptation et ce que vous savez réellement."],
  ["Décrivez une initiative que vous avez prise sans demande explicite.", "Describe an initiative you took without being asked.", "initiative", "Distinguez votre contribution des résultats de l'équipe."],
  ["Expliquez comment vous vérifiez la qualité de votre travail.", "Explain how you verify the quality of your work.", "quality", "Donnez un exemple concret de vérification."],
  ["Décrivez une situation où vous avez dû expliquer un sujet technique simplement.", "Describe explaining a technical topic to a nontechnical person.", "communication", "Structurez votre message et ses effets observables."],
  ["Présentez une décision éthique ou une question de confidentialité.", "Describe an ethical decision or privacy issue you encountered.", "ethics", "Ne révélez aucune donnée privée de tiers."],
  ["Parlez d'une amélioration que vous proposeriez dans votre domaine.", "Describe an improvement you would propose in your field.", "initiative", "Expliquez comment vous en valideriez les résultats."],
  ["Racontez comment vous avez géré des délais serrés.", "Describe how you handled a tight deadline.", "time_management", "Distinguez vos décisions des circonstances."],
  ["Comment réagissez-vous face à une exigence que vous ne maîtrisez pas ?", "How do you respond to a requirement you do not yet know?", "honesty", "Reconnaissez honnêtement les limites et votre plan d'apprentissage."],
  ["Décrivez une réalisation dont vous êtes fier et votre contribution exacte.", "Describe an achievement you are proud of and your exact contribution.", "impact", "N'utilisez que des chiffres réellement connus."],
  ["Pourquoi seriez-vous un bon collaborateur pour cette équipe ?", "Why would you be a good collaborator on this team?", "teamwork", "Appuyez votre réponse sur des exemples, pas des affirmations invérifiables."],
];
export function fallbackQuestions(count: number, language: CoachLanguage = "fr"): CoachQuestion[] {
  const n = Math.max(1, Math.min(20, Math.floor(count)));
  return themes.slice(0, n).map(([fr, en, focus, tip]) => ({
    question: language === "fr" ? fr : en,
    suggestedAnswer: language === "fr" ? tip : "Use a real example, your own actions, and a verifiable result. Never invent evidence.",
    focus,
  }));
}
export function boundedQuestions(value: unknown, count: number, language: CoachLanguage): CoachQuestion[] {
  const original = Array.isArray(value) ? value : [];
  const allowed = original.filter((item): item is CoachQuestion => !!item && typeof item.question === "string" && item.question.trim().length >= 5 && item.question.length <= 500 && typeof item.focus === "string" && typeof item.suggestedAnswer === "string" && item.suggestedAnswer.length <= 1500);
  const unique = new Set<string>();
  const result = allowed.filter(item => {
    const key = item.question.trim().toLocaleLowerCase();
    if (unique.has(key)) return false;
    unique.add(key); return true;
  }).slice(0, count);
  for (const fallback of fallbackQuestions(20, language)) {
    if (result.length >= count) break;
    const key = fallback.question.trim().toLocaleLowerCase();
    if (!unique.has(key)) { result.push(fallback); unique.add(key); }
  }
  return result;
}
function points(value: number): number { return Number.isInteger(value) && value >= 0 && value <= 4 ? value : NaN; }
export function rubricScore(rubric: CoachRubric): number {
  if (Object.values(rubric).some(x => !Number.isFinite(points(x)))) throw new Error("INVALID_INTERVIEW_RUBRIC");
  return Math.round((rubric.relevance * 0.35 + rubric.specificity * 0.25 + rubric.structure * 0.2 + rubric.clarity * 0.2) * 25);
}
export function safeEvidenceQuote(quote: string, answer: string): string {
  const q = quote.trim().replace(/\s+/g, " ");
  if (!q || q.length > 160 || !answer.toLocaleLowerCase().replace(/\s+/g," ").includes(q.toLocaleLowerCase())) return "";
  return q;
}
export function ungradedFeedback(language: CoachLanguage): CoachFeedback {
  return {status:"unavailable", score:null, criteria:null, strength:"", improvement: language === "fr" ? "Évaluation IA indisponible. Votre réponse a été enregistrée sans note." : "AI evaluation is unavailable. Your answer was saved without a score.", nextExercise: language === "fr" ? "Réessayez avec une situation, votre action et un résultat réel." : "Practice with a real situation, your action and an actual result.", evidenceQuote:"", disclaimer:COACH_DISCLAIMER};
}
export function summarizeInterview(feedback: Array<{score: number | null; feedback: CoachFeedback | null}>, language: CoachLanguage) {
  const scored = feedback.filter((x): x is {score:number;feedback:CoachFeedback} => typeof x.score === "number" && !!x.feedback && x.feedback.status === "evaluated" && !!x.feedback.criteria);
  const total = feedback.length;
  const overall = scored.length ? Math.round(scored.reduce((s,x)=>s+x.score,0)/scored.length) : null;
  const avg = (key:keyof CoachRubric) => scored.length ? Math.round(scored.reduce((s,x)=>s+(x.feedback.criteria?.[key] ?? 0),0)/scored.length*25) : null;
  const dimensions = {relevance:avg("relevance"),specificity:avg("specificity"),structure:avg("structure"),clarity:avg("clarity")};
  const improvements = [...new Set(scored.map(x => x.feedback.improvement).filter(Boolean))].slice(0,3);
  const exercises = [...new Set(scored.map(x => x.feedback.nextExercise).filter(Boolean))].slice(0,3);
  return {
    summary: language === "fr" ? COACH_DISCLAIMER : "Educational coaching only; not a prediction of hiring outcomes.",
    answers:total, evaluatedAnswers:scored.length, ungradedAnswers:total-scored.length,
    overallScore:overall, dimensions,
    strengths: [...new Set(scored.filter(x=>x.score>=70).map(x=>x.feedback.strength).filter(Boolean))].slice(0,3),
    improvements:improvements.length ? improvements : [language === "fr" ? "Préparez une réponse à partir d'un événement réel." : "Prepare an answer using a real event."],
    exercises:exercises.length ? exercises : [language === "fr" ? "Décrivez une situation, votre action et un résultat réel." : "Describe a situation, your action and a real result."],
  };
}
