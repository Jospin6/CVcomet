"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import {
  documentLanguages,
  getMarketPolicy,
  targetMarkets,
  type DocumentLanguage,
  type TargetMarket,
} from "@/lib/career-localization/markets";

/** Minimal market controls: selecting a market never rewrites candidate facts. */
export function CareerMarketPanel({
  country,
  language,
  fr,
  disabled = false,
  onCountry,
  onLanguage,
}: {
  country: TargetMarket;
  language: DocumentLanguage;
  fr: boolean;
  disabled?: boolean;
  onCountry: (value: TargetMarket) => void;
  onLanguage: (value: DocumentLanguage) => void;
}) {
  return (
    <section className="space-y-3" aria-label={translateCentral(fr ? "fr" : "en", "uiText.components_resumes_career_market_panel.text001")}>
      <label className="block">
        <span className="studio-panel-label">{translateCentral(fr ? "fr" : "en", "uiText.components_resumes_career_market_panel.text002")}</span>
        <select
          className="h-9 w-full rounded-md border bg-background px-2 text-xs"
          value={country}
          disabled={disabled}
          onChange={(event) => onCountry(event.target.value as TargetMarket)}
        >
          {targetMarkets.map((market) => (
            <option key={market} value={market}>
              {fr ? getMarketPolicy(market).labelFr : getMarketPolicy(market).label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="studio-panel-label">
          {translateCentral(fr ? "fr" : "en", "uiText.components_resumes_career_market_panel.text003")}
        </span>
        <select
          className="h-9 w-full rounded-md border bg-background px-2 text-xs"
          value={language}
          disabled={disabled}
          onChange={(event) => onLanguage(event.target.value as DocumentLanguage)}
        >
          {documentLanguages.map((value) => (
            <option key={value} value={value}>
              {value === "auto" ? (translateCentral(fr ? "fr" : "en", "uiText.components_resumes_career_market_panel.text004"))
                : value === "fr" ? "Français"
                : value === "de" ? "Deutsch" : "English"}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
