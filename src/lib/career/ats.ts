import { normalizeEditorResume } from "@/lib/resume-editor";
import { atsClaimedSkills, atsEvidence, atsWorkEvidence, containsAtsTerm, normalizeAtsText, ongoingAtsDate, parseAtsDate, visibleAtsResume } from "./ats-text";
import type { AtsAnalysis, AtsCheck, AtsEvidence, AtsIssue, AtsJobMatch, PdfAudit, SemanticReview } from "./ats-types";
export type { AtsAnalysis, AtsCheck, AtsEvidence, AtsIssue } from "./ats-types";

type Options = { document?: PdfAudit; semantic?: SemanticReview; jobMatch?: AtsJobMatch; now?: Date };
const round = (n: number) => Math.round(n * 10) / 10;

/** The 100-point content rubric is a product rubric, never an ATS acceptance probability.
 * Unassessed semantic criteria remain null and prevent a complete content score.
 * PDF parsing and job matching are independently assessed and never averaged into it. */
export function analyzeResume(input: Record<string, unknown>, keywords: string[] = [], language: "fr" | "en" = "en", options: Options = {}): AtsAnalysis {
  const original = normalizeEditorResume(input), resume = visibleAtsResume(original);
  const t = (fr: string, en: string) => language === "fr" ? fr : en;
  const evidence = atsEvidence(resume), work = atsWorkEvidence(resume);
  const issues: AtsIssue[] = [], checks: AtsCheck[] = [], strengths: string[] = [];
  const add = (issue: Omit<AtsIssue, "id" | "category" | "evidence"> & { id?: string; evidence?: AtsEvidence[] }) => issues.push({ id: issue.id ?? `content-${issues.length}`, category: "CONTENT", evidence: issue.evidence ?? [], ...issue });
  const check = (id: string, label: string, weight: number, fraction: number | null, reason: string, sources: AtsEvidence[] = []) => {
    checks.push({ id, label, weight, earned: fraction === null ? null : round(weight * Math.max(0, Math.min(1, fraction))), status: fraction === null ? "NOT_ASSESSED" : fraction >= 1 ? "PASS" : fraction <= 0 ? "FAIL" : "PARTIAL", reason, evidence: sources });
  };
  const source = (field: string) => evidence.filter(item => item.field === field);
  const namedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.contact.email.trim());
  const identity = [Boolean(resume.contact.name.trim()), namedEmail];
  check("identity", t("Identification et contact", "Identification and contact"), 10, identity.filter(Boolean).length / 2, t("Nom et adresse e-mail au format valide dans le document.", "Name and correctly formatted email in the document."), evidence.filter(item => item.field === "contact.name" || item.field === "contact.email"));
  if (!identity[0]) add({ severity: "critical", title: t("Ajoutez votre nom", "Add your name"), reason: t("Le nom du candidat est vide.", "The candidate name is empty."), suggestion: t("Renseignez votre nom dans le document.", "Enter your name in the document."), field: "contact.name" });
  if (!namedEmail) add({ severity: "critical", title: t("Vérifiez votre adresse e-mail", "Check your email address"), reason: t("L’adresse e-mail est absente ou son format est invalide.", "The email address is missing or has an invalid format."), suggestion: t("Renseignez une adresse professionnelle valide.", "Enter a valid professional email address."), field: "contact.email", evidence: source("contact.email") });

  const hasWork = resume.experiences.some(entry => entry.description.some(line => line.trim())) || resume.projects.some(entry => entry.description.trim());
  const summary = resume.summary.join(" ").trim();
  const sections = [Boolean(resume.title.trim()), Boolean(summary), hasWork, resume.skills.some(entry => entry.hardskills.trim() || entry.tools.trim())];
  check("structure", t("Structure exploitable", "Usable structure"), 10, sections.filter(Boolean).length / sections.length, t("Titre, présentation, réalisations et compétences visibles. Un employeur prestigieux ne rapporte aucun point supplémentaire.", "Visible headline, introduction, achievements and skills. Employer prestige earns no extra points."), evidence.filter(item => item.field === "title" || item.field.startsWith("summary.")));
  if (!sections[0]) add({ severity: "warning", title: t("Précisez le poste visé", "Add a job headline"), reason: t("Le titre professionnel est vide.", "The professional headline is empty."), suggestion: t("Choisissez un intitulé fidèle à votre parcours.", "Choose a headline supported by your background."), field: "title" });
  if (!summary) add({ severity: "info", title: t("Présentez votre profil", "Introduce your profile"), reason: t("Aucune présentation visible ne relie votre parcours au poste visé.", "No visible introduction connects your background with the target role."), suggestion: t("Résumez votre spécialité et les preuves les plus pertinentes de votre parcours.", "Summarize your specialty and the most relevant evidence from your background."), field: "summary.0" });
  if (!hasWork) add({ severity: "critical", title: t("Décrivez vos contributions", "Describe your contributions"), reason: t("Aucune description visible d’expérience ou de projet ne permet d’évaluer votre travail.", "No visible work or project description makes it possible to assess your contribution."), suggestion: t("Décrivez une mission, un stage ou un projet réel : action, contexte, méthode et résultat.", "Describe an actual role, internship or project: action, context, method and outcome."), field: resume.projects.length ? "projects.0.description" : "experiences.0.description" });

  // Demonstration comes from work/project context, never from repeating a skills list.
  const skills = atsClaimedSkills(resume);
  const skillReview = options.semantic?.status === "COMPLETE" ? options.semantic.skillEvidence : undefined;
  const supported = skills.filter(item => skillReview?.some(review => normalizeAtsText(review.skill) === normalizeAtsText(item.term) && review.status === "DEMONSTRATED"));
  const partialSkills = skillReview?.filter(item => item.status === "PARTIAL").length ?? 0;
  check("demonstrated-skills", t("Compétences étayées par des réalisations", "Skills supported by work evidence"), 20, !skills.length ? 0 : skillReview ? (supported.length + partialSkills * .5) / skills.length : null,
    skills.length && !skillReview ? t("La mise en contexte des compétences attend la relecture ; leur simple présence ne suffit pas.", "Skill attribution awaits contextual review; merely finding the words is insufficient.") : t(`${supported.length} compétence(s) sur ${skills.length} sont étayées par un contexte d’expérience ou de projet ; ${partialSkills} le sont partiellement. Les preuves restent déclaratives, pas une validation de maîtrise.`, `${supported.length} of ${skills.length} skills have supporting work or project context; ${partialSkills} have partial support. Evidence remains self-reported, not verified proficiency.`), skillReview?.flatMap(item => item.evidence).slice(0, 12));
  if (!skills.length) add({ severity: "warning", title: t("Détaillez vos compétences", "Describe your skills"), reason: t("Aucune compétence technique ou aucun outil visible n’est renseigné.", "No visible technical skills or tools are provided."), suggestion: t("Indiquez les compétences réellement utilisées et expliquez leur application dans vos projets ou expériences.", "List skills you actually use and explain their application in work or projects."), field: "skills.0.hardskills" });
  else if (skillReview && supported.length < skills.length) {
    const unsupported = skills.filter(skill => !supported.includes(skill));
    add({ severity: unsupported.length === skills.length ? "critical" : "warning", title: t("Appuyez vos compétences par des exemples", "Support your skills with examples"), reason: t(`Compétences citées sans contexte de réalisation repéré : ${unsupported.map(item => item.term).join(", ")}.`, `Skills listed without detected work context: ${unsupported.map(item => item.term).join(", ")}.`), suggestion: t("Précisez dans une réalisation quand et comment vous avez utilisé ces outils. Répéter la liste ne démontre pas leur maîtrise.", "Explain when and how you used these tools in an actual achievement. Repeating the list does not demonstrate proficiency."), field: work[0]?.field ?? "projects.0.description", evidence: unsupported.flatMap(item => source(item.field)).filter((item, index, all) => all.findIndex(other => other.field === item.field) === index) });
  }

  const dateChecks: boolean[] = [], now = (options.now ?? new Date()).getTime();
  for (const section of ["experiences", "educations"] as const) resume[section].forEach((entry, index) => {
    const path = `${section}.${index}`;
    if (!Object.values(entry).flat().some(value => value.trim())) return;
    const titleKey = section === "experiences" ? "title" : "degree", organizationKey = section === "experiences" ? "company" : "school";
    const record = entry as unknown as Record<string, string | string[]>;
    for (const key of [titleKey, organizationKey]) {
      const ok = Boolean(String(record[key]).trim()); dateChecks.push(ok);
      if (!ok) add({ severity: "warning", title: t("Complétez cette entrée", "Complete this entry"), reason: t(`Le champ ${key} est vide.`, `The ${key} field is empty.`), suggestion: t("Ajoutez l’intitulé ou l’organisme réel pour rendre l’entrée identifiable.", "Add the actual title or organization so this entry can be identified."), field: `${path}.${key}` });
    }
    const start = parseAtsDate(entry.start), end = parseAtsDate(entry.end), ongoing = ongoingAtsDate(entry.end);
    const startValid = Boolean(start && start.start <= now), endValid = Boolean((end && start && end.end >= start.start) || ongoing && section === "experiences");
    dateChecks.push(startValid, endValid);
    if (!startValid || !endValid) add({ severity: start && end && end.end < start.start ? "critical" : "warning", title: t("Vérifiez les dates de cette entrée", "Check the dates of this entry"), reason: t("Une date est absente, non reconnue, future au début du parcours ou dans un ordre incohérent.", "A date is missing, unrecognized, starts in the future or is in an inconsistent order."), suggestion: t("Indiquez des dates cohérentes (année, mois/année ou date complète). Pour un poste actuel, écrivez explicitement « en cours ».", "Use consistent dates (year, month/year or full date). For a current role, explicitly enter “Present”."), field: `${path}.${!startValid ? "start" : "end"}`, evidence: [...source(`${path}.start`), ...source(`${path}.end`)] });
  });
  resume.projects.forEach((entry, index) => {
    if (!Object.values(entry).some(value => value.trim())) return;
    const identified = Boolean(entry.title.trim()); dateChecks.push(identified);
    if (!identified) add({ severity: "warning", title: t("Nommez ce projet", "Name this project"), reason: t("Le projet n’a pas d’intitulé identifiable.", "The project has no identifiable title."), suggestion: t("Donnez un nom descriptif au projet réel présenté.", "Give the actual project a descriptive name."), field: `projects.${index}.title` });
  });
  check("chronology", t("Entrées et chronologie vérifiables", "Identifiable entries and chronology"), 10, dateChecks.length ? dateChecks.filter(Boolean).length / dateChecks.length : 0, t("Organismes, intitulés et dates cohérentes. La durée courte d’une mission, l’absence de diplôme ou un trou de carrière ne sont pas des motifs automatiques de pénalité.", "Identifiable organizations, titles and consistent dates. Short assignments, no degree or career gaps are not automatically penalized."), evidence.filter(item => /\.(start|end)$/.test(item.field)).slice(0, 12));

  for (const item of work.filter(item => item.field.endsWith(".description"))) {
    const words = item.quote.split(/\s+/).length;
    if (words < 5 || /^(?:an? (?:application|app|project|website|tool) to |une? (?:application|outil|site|projet) pour )/i.test(item.quote)) add({ severity: words < 5 ? "critical" : "warning", title: t("Précisez votre contribution", "Make your contribution specific"), reason: t("Cette description très succincte présente une tâche ou une intention sans détailler la contribution.", "This brief description states a task or intention without detailing the contribution."), suggestion: t("Précisez ce que vous avez fait, avec quels outils, pour quel besoin et avec quel résultat observable. Un résultat qualitatif est utile ; inventer un chiffre ne l’est pas.", "Explain what you did, the tools used, the problem and the observed outcome. Qualitative outcomes are useful; invented numbers are not."), field: item.field, evidence: [item] });
  }
  const placeholders = evidence.filter(item => /\b(?:lorem ipsum|todo|tbd|your (?:name|email|company)|votre (?:nom|entreprise)|insert (?:text|here))\b/i.test(item.quote));
  for (const item of placeholders) add({ severity: "critical", title: t("Remplacez le texte provisoire", "Replace placeholder text"), reason: t("Un texte de modèle est encore présent.", "Template placeholder text remains in the document."), suggestion: t("Remplacez-le par vos informations réelles ou supprimez le champ.", "Replace it with your actual information or remove the field."), field: item.field, evidence: [item] });
  const descriptions = evidence.filter(item => /\.(description)$/.test(item.field));
  const seen = new Set<string>();
  for (const item of descriptions) {
    const normalized = normalizeAtsText(item.quote);
    if (seen.has(normalized)) add({ severity: "warning", title: t("Évitez les descriptions dupliquées", "Avoid duplicate descriptions"), reason: t("La même description apparaît dans plusieurs entrées.", "The same description appears in several entries."), suggestion: t("Décrivez la contribution propre à chaque expérience ou projet.", "Describe the specific contribution of each role or project."), field: item.field, evidence: [item] });
    seen.add(normalized);
  }
  const semantic = options.semantic;
  for (const criterion of [{ id: "specificity", weight: 25, label: t("Substance des réalisations", "Substance of achievements") }, { id: "positioning", weight: 15, label: t("Cohérence du positionnement", "Positioning supported by evidence") }, { id: "writing", weight: 10, label: t("Clarté et qualité rédactionnelle", "Clarity and writing quality") }] as const) {
    const assessed = semantic?.status === "COMPLETE" ? semantic.criteria.find(item => item.id === criterion.id) : undefined;
    check(criterion.id, criterion.label, criterion.weight, assessed ? assessed.rating / 4 : null, assessed?.reason ?? t("Relecture contextuelle non effectuée ; aucun point n’est attribué par défaut.", "Contextual review has not been performed; no points are awarded by default."), assessed?.evidence);
  }
  if (semantic?.status === "COMPLETE") issues.push(...semantic.issues);
  const assessedWeight = checks.filter(item => item.earned !== null).reduce((sum, item) => sum + item.weight, 0);
  const earned = round(checks.reduce((sum, item) => sum + (item.earned ?? 0), 0));
  const hasContent = evidence.some(item => !item.field.startsWith("contact."));
  let contentScore = assessedWeight === 100 ? Math.round(earned) : null;
  const limits: { max: number; reason: string }[] = [];
  if (!hasWork) limits.push({ max: 39, reason: t("Aucune contribution pratique n’est décrite.", "No practical contribution is described.") });
  if (placeholders.length) limits.push({ max: 39, reason: t("Du texte provisoire est encore présent.", "Placeholder text remains in the document.") });
  if (!hasContent) limits.push({ max: 0, reason: t("Aucun contenu professionnel visible.", "No visible professional content.") });
  if (contentScore !== null) for (const limit of limits) contentScore = Math.min(contentScore, limit.max);
  for (const item of checks.filter(item => item.status === "PASS")) strengths.push(`${item.label} : ${item.reason}`);

  const terms = [...new Map(keywords.map(term => [normalizeAtsText(term), term.trim()])).values()].filter(Boolean);
  const text = evidence.map(item => item.quote).join("\n");
  const matched = terms.filter(term => containsAtsTerm(text, term)), missing = terms.filter(term => !containsAtsTerm(text, term));
  if (missing.length) add({ severity: "info", title: t("Vérifiez les mots-clés du poste", "Review the job keywords"), reason: t(`Termes non repérés : ${missing.join(", ")}.`, `Terms not found: ${missing.join(", ")}.`), suggestion: t("Ajoutez un terme uniquement si une expérience réelle permet de l’étayer. Cette recherche de mots n’est pas un score d’adéquation au poste.", "Add a term only when your actual background supports it. This term search is not a job match score."), field: work[0]?.field ?? "skills.0.hardskills" });
  const technical = options.document ?? { status: "NOT_PROVIDED" as const, score: null, pages: 0, bytes: 0, extractedCharacters: 0, text: "", recovery: null, smallTextRatio: 0, spacedHeadings: [], checks: [], issues: [] };
  issues.push(...technical.issues);
  const priority = { critical: 0, warning: 1, info: 2 };
  const unique = issues.filter((item, index, all) => all.findIndex(other => other.category === item.category && other.field === item.field && normalizeAtsText(other.title) === normalizeAtsText(item.title)) === index);
  unique.sort((a, b) => priority[a.severity] - priority[b.severity]);
  return { version: 2, rubricVersion: "2026-10-ats-v2", overallScore: null, content: { score: contentScore, assessedWeight, totalWeight: 100, earned, checks, limits }, technical, review: { status: semantic?.status ?? "UNAVAILABLE", ...(semantic?.error ? { error: semantic.error } : {}) }, jobMatch: options.jobMatch ?? { status: "NOT_PROVIDED", score: null, requirements: [] }, keywords: { matched, missing, status: terms.length ? "CHECKED" : "NOT_PROVIDED" }, strengths, issues: unique };
}

// Preserve the richer report inside the existing JSON column. Old array-based
// analyses are explicitly marked legacy by the API and never reused as v2 scores.
export function storedAtsReport(value: unknown): AtsAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as { kind?: string; report?: AtsAnalysis };
  return envelope.kind === "ATS_REPORT_V2" && envelope.report?.version === 2 ? envelope.report : null;
}
export function atsStorageScores(report: AtsAnalysis) {
  const value = (id: string) => { const c = report.content.checks.find(item => item.id === id); return c?.earned === null || !c ? 0 : Math.round(c.earned / c.weight * 100); };
  return { overallScore: report.content.score ?? 0, structureScore: value("structure"), formattingScore: report.technical.score ?? 0, readabilityScore: report.technical.score ?? 0, contactScore: value("identity"), experienceScore: value("specificity"), skillsScore: value("demonstrated-skills"), keywordScore: report.jobMatch.score ?? 0, impactScore: value("specificity"), grammarScore: value("writing") };
}
