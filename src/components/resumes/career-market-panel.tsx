"use client";
import { documentLanguages, getMarketPolicy, targetMarkets, type DocumentLanguage, type TargetMarket } from "@/lib/career-localization/markets";

/** Advisory controls: changing a country never inserts facts, photos or personal details. */
export function CareerMarketPanel({ country, language, fr, disabled = false, onCountry, onLanguage }: {
  country: TargetMarket; language: DocumentLanguage; fr: boolean; disabled?: boolean;
  onCountry: (value: TargetMarket) => void; onLanguage: (value: DocumentLanguage) => void;
}) {
  const policy = getMarketPolicy(country);
  return <section className="space-y-2 rounded-lg border bg-muted/20 p-3" aria-label={fr ? "Adaptation internationale" : "International application settings"}>
    <h3 className="text-xs font-semibold">{fr ? "Pays de candidature" : "Target country"}</h3>
    <label className="block text-[11px]">
      <span className="sr-only">{fr ? "Marché cible" : "Target market"}</span>
      <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs" value={country} disabled={disabled} onChange={event => onCountry(event.target.value as TargetMarket)}>
        {targetMarkets.map(market => <option key={market} value={market}>{fr ? getMarketPolicy(market).labelFr : getMarketPolicy(market).label}</option>)}
      </select>
    </label>
    <label className="block text-[11px]">
      <span className="block font-medium">{fr ? "Langue souhaitée du document" : "Preferred document language"}</span>
      <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs" value={language} disabled={disabled} onChange={event => onLanguage(event.target.value as DocumentLanguage)}>
        {documentLanguages.map(value => <option key={value} value={value}>{value === "auto" ? (fr ? "Conseillée pour le marché" : "Recommended for market") : value === "fr" ? "Français" : value === "de" ? "Deutsch" : "English"}</option>)}
      </select>
    </label>
    <div className="text-[11px] leading-5 text-muted-foreground">
      <p>{fr ? "Format papier suggéré" : "Suggested page format"}: <strong>{policy.paper}</strong>. {fr ? "Photo" : "Photo"}: {policy.photo === "avoid" ? (fr ? "à éviter" : "avoid") : (fr ? "facultative" : "optional")}.</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">{(fr ? policy.guidanceFr : policy.guidanceEn).map(note => <li key={note}>{note}</li>)}</ul>
      <p className="mt-2">{fr ? "Conseils indicatifs, non obligations légales. Les consignes de l'employeur priment. La sélection ne modifie pas le contenu professionnel." : "Advisory guidance, not legal requirements. Follow the employer's instructions. Selection does not rewrite candidate facts."}</p>
      {policy.sources.length > 0 && <p className="mt-2">{fr ? "Sources" : "Sources"}: {policy.sources.map((url, index) => <span key={url}>{index > 0 ? " · " : ""}<a className="underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer">{index + 1}</a></span>)}</p>}
      {policy.sourceQuality === "editorial" && <p>{fr ? "Recommandations éditoriales à confirmer localement." : "Editorial guidance; check local conventions."}</p>}
    </div>
  </section>;
}
