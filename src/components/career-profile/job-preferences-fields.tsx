"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { residenceCountries } from "@/lib/career-profile/countries";
import type { JobPreferences } from "@/lib/career-profile/schema";

type Props = {
  value: JobPreferences;
  onChange: (value: JobPreferences) => void;
};

const industries = [
  "Accounting / Finance",
  "Administrative",
  "Art / Design",
  "Business / Sales",
  "Construction",
  "Education",
  "Engineering",
  "Food Production",
  "Healthcare",
  "Hospitality / Tourism",
  "Human Resources",
  "Information Technology",
  "Legal",
  "Logistics / Transport",
  "Manufacturing",
  "Marketing / Communications",
  "Media / Entertainment",
  "Science / Research",
  "Software Engineering",
  "Other",
];

const seniorityOptions = [
  ["entry", "Entry", "Débutant"],
  ["junior", "Junior", "Junior"],
  ["mid", "Mid", "Intermédiaire"],
  ["senior", "Senior", "Senior"],
  ["lead", "Lead", "Expert"],
] as const;

const employmentOptions = [
  ["full-time", "Full-Time", "Temps plein"],
  ["part-time", "Part-Time", "Temps partiel"],
  ["freelance", "Freelance", "Freelance"],
  ["internship", "Internship", "Stage"],
] as const;

const salaryRates = [
  ["hourly", "Hourly", "Horaire"],
  ["monthly", "Monthly", "Mensuel"],
  ["yearly", "Yearly", "Annuel"],
] as const;

const labelClass = "block text-xs font-medium text-foreground";
const fieldClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 " +
  "text-sm outline-none focus-visible:border-ring " +
  "focus-visible:ring-2 focus-visible:ring-ring/25";

export function JobPreferencesFields({ value, onChange }: Props) {
  const { i18n } = useTranslation();
  const french = i18n.resolvedLanguage?.startsWith("fr") || false;
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countries = useMemo(
    () => residenceCountries(french ? "fr" : "en"),
    [french],
  );
  const selectedCountry = countries.find(
    (entry) => entry.code === value.residenceCountry,
  );
  const filteredCountries = countries.filter((entry) =>
    entry.name.toLocaleLowerCase().includes(countrySearch.toLocaleLowerCase()),
  );

  const change = <K extends keyof JobPreferences>(
    key: K,
    next: JobPreferences[K],
  ) => onChange({ ...value, [key]: next });

  return (
    <div className="max-w-2xl space-y-7">
      <h2 className="text-base font-semibold">
        {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text001")}
      </h2>

      <div className="space-y-2">
        <label htmlFor="profile-job-industry" className={labelClass}>
          {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text002")}
        </label>
        <select
          id="profile-job-industry"
          value={value.industry}
          onChange={(event) => change("industry", event.target.value)}
          className={fieldClass}
        >
          <option value="">{translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text003")}</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>{industry}</option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>
          {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text004")}
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {seniorityOptions.map(([key, en, fr]) => (
            <label key={key} className="flex cursor-pointer flex-col items-center gap-2">
              <input
                type="radio"
                name="profile-job-seniority"
                checked={value.seniority === key}
                onChange={() => change("seniority", key)}
                className="size-4 accent-primary"
              />
              <span className="text-xs">{french ? fr : en}</span>
            </label>
          ))}
          <label className="flex cursor-pointer flex-col items-center gap-2">
            <input
              type="radio"
              name="profile-job-seniority"
              checked={!value.seniority}
              onChange={() => change("seniority", "")}
              className="size-4 accent-primary"
            />
            <span className="text-xs">{translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text005")}</span>
          </label>
        </div>
      </fieldset>

      <div className="relative space-y-2">
        <label id="residence-label" className={labelClass}>
          {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text006")}
        </label>
        <button
          type="button"
          aria-labelledby="residence-label"
          aria-expanded={countryOpen}
          aria-controls="residence-options"
          onClick={() => setCountryOpen((open) => !open)}
          className={fieldClass + " flex items-center justify-between text-left"}
        >
          <span>{selectedCountry?.name || (translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text007"))}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
        {countryOpen && (
          <div
            id="residence-options"
            className="absolute z-30 w-full rounded-lg border bg-popover p-2 shadow-lg"
          >
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                autoFocus
                aria-label={translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text008")}
                value={countrySearch}
                onChange={(event) => setCountrySearch(event.target.value)}
                className="h-9 pl-8"
              />
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              <button
                type="button"
                className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                onClick={() => { change("residenceCountry", ""); setCountryOpen(false); }}
              >
                {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text009")}
              </button>
              {filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    change("residenceCountry", country.code);
                    setCountryOpen(false);
                    setCountrySearch("");
                  }}
                >
                  {country.name}
                  {value.residenceCountry === country.code && <Check className="size-4" />}
                </button>
              ))}
              {!filteredCountries.length && (
                <p className="p-2 text-xs text-muted-foreground">
                  {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text010")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>
          {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text011")}
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {employmentOptions.map(([key, en, fr]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={value.employmentTypes.includes(key)}
                onChange={(event) => change(
                  "employmentTypes",
                  event.target.checked
                    ? [...value.employmentTypes, key]
                    : value.employmentTypes.filter((item) => item !== key),
                )}
              />
              {french ? fr : en}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={labelClass}>
          {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text012")}
        </legend>
        <div className="flex flex-wrap gap-6">
          {salaryRates.map(([key, en, fr]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="radio"
                name="profile-salary-rate"
                checked={value.salaryRate === key}
                onChange={() => change("salaryRate", key)}
                className="size-4 accent-primary"
              />
              {french ? fr : en}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="profile-salary-min" className={labelClass}>
          {translateCentral(french ? "fr" : "en", "uiText.components_career_profile_job_preferences_fields.text013")}
        </label>
        <div className="relative">
          <Input
            id="profile-salary-min"
            type="number"
            min={0}
            max={100000000}
            step={1}
            value={value.minimumSalary ?? ""}
            placeholder="0"
            onChange={(event) => {
              const number = Number(event.target.value);
              change("minimumSalary", event.target.value === "" ? null :
                Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : null);
            }}
            className="h-9 pr-32"
          />
          <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">
            USD / {value.salaryRate === "hourly" ? "hour" :
              value.salaryRate === "monthly" ? "month" : "year"}
          </span>
        </div>
      </div>
    </div>
  );
}
