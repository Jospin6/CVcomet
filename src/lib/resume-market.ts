export const resumeMarkets = ["US_CANADA", "UK_IRELAND", "EUROPE", "AFRICA_INTERNATIONAL"] as const;
export type ResumeMarket = (typeof resumeMarkets)[number];

export const referralSources = ["GOOGLE", "LINKEDIN", "TIKTOK", "INSTAGRAM", "YOUTUBE", "FRIEND", "SCHOOL", "OTHER"] as const;
export type ReferralSource = (typeof referralSources)[number];

export type MarketProfile = {
  id: ResumeMarket; label: string; shortLabel: string; description: string; documentName: string;
  guidance: string[]; avoid: string[]; coverLetter: string; defaultAccent: string;
};

export const marketProfiles: Record<ResumeMarket, MarketProfile> = {
  US_CANADA: {
    id: "US_CANADA", label: "United States & Canada", shortLabel: "US / Canada", documentName: "Resume",
    description: "Concise, achievement-led and ATS-friendly for North American applications.",
    guidance: ["Prioritize measurable impact and relevant experience", "Use a clean reverse-chronological structure", "Keep personal data minimal"],
    avoid: ["Photo by default", "Age, marital status or sensitive personal details"],
    coverLetter: "Direct, tailored and evidence-led, normally focused on fit, impact and motivation.", defaultAccent: "#173F35",
  },
  UK_IRELAND: {
    id: "UK_IRELAND", label: "United Kingdom & Ireland", shortLabel: "UK / Ireland", documentName: "CV",
    description: "Clear professional CV with a focused profile, evidence and job-relevant history.",
    guidance: ["Lead with a concise professional profile", "Tailor skills and evidence to the vacancy", "Use clear headings and reverse chronology"],
    avoid: ["Age/date of birth", "Marital status or nationality by default"],
    coverLetter: "Professional UK-style letter connecting your evidence directly to the role requirements.", defaultAccent: "#173F35",
  },
  EUROPE: {
    id: "EUROPE", label: "Europe", shortLabel: "Europe", documentName: "CV",
    description: "Flexible European CV family, including clean continental and Europass-inspired structures.",
    guidance: ["Adapt the CV to the destination country and vacancy", "Keep education, languages and mobility easy to scan", "Offer Europass-compatible structure when useful"],
    avoid: ["Assuming one rule applies to every European country", "Adding sensitive details unless appropriate and intentional"],
    coverLetter: "Structured motivation letter adapted to the destination country, employer and language.", defaultAccent: "#1E4B8F",
  },
  AFRICA_INTERNATIONAL: {
    id: "AFRICA_INTERNATIONAL", label: "Africa & International", shortLabel: "Africa / International", documentName: "CV",
    description: "Professional international CV adaptable to African local markets, NGOs, multinationals and cross-border roles.",
    guidance: ["Choose the destination employer/country rules over the candidate's residence", "Make languages, certifications and relevant context easy to find", "Use a modern ATS-safe structure for multinational applications"],
    avoid: ["Treating Africa as one hiring market", "Adding photo or personal details automatically"],
    coverLetter: "Adaptable professional letter for local employers, NGOs, international organisations and multinationals.", defaultAccent: "#1D5B45",
  },
};

export function getMarketProfile(value?: string | null) {
  return value && value in marketProfiles ? marketProfiles[value as ResumeMarket] : null;
}
