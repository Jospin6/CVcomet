"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { residenceCountries } from "@/lib/career-profile/countries";
import {
  careerGoals,
  experienceLevels,
  harmonizeCareerDirection,
  workModes,
  type JobPreferences,
  type ProfileData,
} from "@/lib/career-profile/schema";

// The profile owns one Career Direction section. Its extra fields continue
// to use jobPreferences in storage so old settings and Jobs for You still work.
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
] as const;

const contracts = [
  ["full-time", "Full-time", "Temps plein"],
  ["part-time", "Part-time", "Temps partiel"],
  ["freelance", "Freelance", "Freelance"],
  ["internship", "Internship", "Stage"],
] as const;

const salaryRates = [
  ["hourly", "Hourly", "Horaire"],
  ["monthly", "Monthly", "Mensuel"],
  ["yearly", "Yearly", "Annuel"],
] as const;

const labelClass = "block text-xs font-medium text-foreground";
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 " +
  "text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

export function IndustrySelect({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const french = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const isLegacyValue = Boolean(value && !industries.includes(
    value as (typeof industries)[number],
  ));

  return (
    <div className="space-y-1.5">
      <label htmlFor="career-direction-industry" className={labelClass}>
        {t("career.fields.targetIndustry")}{required && " *"}
      </label>
      <select
        id="career-direction-industry"
        className={selectClass}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {french ? "Choisir un secteur" : "Select industry"}
        </option>
        {isLegacyValue && <option value={value}>{value}</option>}
        {industries.map((industry) => (
          <option key={industry} value={industry}>{industry}</option>
        ))}
      </select>
    </div>
  );
}

type CountryPickerProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  mode: "code" | "name";
  required?: boolean;
};

export function CountryPicker({
  id,
  value,
  onChange,
  mode,
  required = false,
}: CountryPickerProps) {
  const { t, i18n } = useTranslation();
  const french = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const locale = french ? "fr" : "en";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const localized = useMemo(() => residenceCountries(locale), [locale]);
  const english = useMemo(() => residenceCountries("en"), []);

  // targetCountry historically stores a country name. Keep that contract:
  // codes are used only for the distinct residenceCountry preference.
  const canonicalName = (code: string) =>
    english.find((item) => item.code === code)?.name || code;
  const selected = localized.find((country) =>
    value.toLocaleLowerCase() === country.code.toLocaleLowerCase() ||
    value.toLocaleLowerCase() === country.name.toLocaleLowerCase() ||
    value.toLocaleLowerCase() === canonicalName(country.code).toLocaleLowerCase(),
  );
  const visible = localized.filter((country) => {
    const query = search.toLocaleLowerCase().trim();
    return !query ||
      country.name.toLocaleLowerCase().includes(query) ||
      canonicalName(country.code).toLocaleLowerCase().includes(query) ||
      country.code.toLocaleLowerCase().includes(query);
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const label = mode === "code"
    ? french ? "Pays de résidence" : "Area of residence"
    : t("career.fields.targetCountry");

  return (
    <div className="relative space-y-1.5" ref={root}>
      <label id={`${id}-label`} className={labelClass}>
        {label}{required && " *"}
      </label>
      <button
        type="button"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        className={selectClass + " flex items-center justify-between gap-2 text-left"}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span className="truncate">
          {selected?.name || value ||
            (french ? "Choisir un pays" : "Select country")}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div
          id={`${id}-options`}
          className="absolute z-30 w-full rounded-lg border bg-popover p-2 shadow-lg"
        >
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              autoFocus
              aria-label={french ? "Rechercher un pays" : "Search countries"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
              className="h-9 pl-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {!required && (
              <button
                type="button"
                className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setSearch("");
                }}
              >
                {french ? "Non précisé" : "Not specified"}
              </button>
            )}
            {visible.map((country) => (
              <button
                type="button"
                key={country.code}
                className={
                  "flex w-full items-center justify-between rounded " +
                  "px-2 py-2 text-left text-sm hover:bg-muted"
                }
                onClick={() => {
                  onChange(mode === "code"
                    ? country.code : canonicalName(country.code));
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span>{country.name}</span>
                {selected?.code === country.code && (
                  <Check className="size-4" />
                )}
              </button>
            ))}
            {!visible.length && (
              <p className="p-2 text-xs text-muted-foreground">
                {french ? "Aucun pays trouvé" : "No countries found"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CareerDirectionFields({
  profile,
  onChange,
}: {
  profile: ProfileData;
  onChange: (profile: ProfileData) => void;
}) {
  const { t, i18n } = useTranslation();
  const french = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const preferences = profile.jobPreferences;

  const update = (
    fields: Partial<ProfileData>,
    extra: Partial<JobPreferences> = {},
  ) => onChange(harmonizeCareerDirection({
    ...profile,
    ...fields,
    jobPreferences: { ...preferences, ...extra },
  }));

  const positions = Array.from(new Set([
    profile.targetJobTitle,
    ...profile.experiences.map((item) => item.title),
  ].map((title) => title.trim()).filter(Boolean)));

  return (
    <div className="max-w-3xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="career-direction-goal" className={labelClass}>
            {t("career.fields.careerGoal")}
          </label>
          <select
            id="career-direction-goal"
            className={selectClass}
            value={profile.careerGoal}
            onChange={(event) => update({
              careerGoal: event.target.value as ProfileData["careerGoal"],
            })}
          >
            <option value="">{t("career.choose")}</option>
            {careerGoals.map((goal) => (
              <option value={goal} key={goal}>
                {t(`career.options.${goal}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="career-direction-level" className={labelClass}>
            {t("career.fields.experienceLevel")}
          </label>
          <select
            id="career-direction-level"
            className={selectClass}
            value={profile.experienceLevel}
            onChange={(event) => update({
              experienceLevel: event.target.value as ProfileData["experienceLevel"],
            }, { seniority: "" })}
          >
            <option value="">{t("career.choose")}</option>
            {experienceLevels.map((level) => (
              <option value={level} key={level}>
                {t(`career.options.${level}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="career-direction-job-title" className={labelClass}>
            {t("career.fields.targetJobTitle")}
          </label>
          <Input
            id="career-direction-job-title"
            list="career-direction-positions"
            value={profile.targetJobTitle}
            onChange={(event) => update({ targetJobTitle: event.target.value })}
            placeholder={french ? "Poste recherché" : "Target job title"}
            maxLength={200}
            className="h-9"
          />
          <datalist id="career-direction-positions">
            {positions.map((position) => (
              <option key={position} value={position} />
            ))}
          </datalist>
        </div>

        <IndustrySelect
          value={profile.targetIndustry}
          onChange={(value) => update({ targetIndustry: value }, { industry: value })}
        />

        <CountryPicker
          id="career-direction-target-country"
          value={profile.targetCountry}
          onChange={(value) => update({ targetCountry: value })}
          mode="name"
        />

        <div className="space-y-1.5">
          <label htmlFor="career-direction-work-mode" className={labelClass}>
            {t("career.fields.preferredWorkMode")}
          </label>
          <select
            id="career-direction-work-mode"
            className={selectClass}
            value={profile.preferredWorkMode}
            onChange={(event) => update({
              preferredWorkMode:
                event.target.value as ProfileData["preferredWorkMode"],
            })}
          >
            <option value="">{t("career.choose")}</option>
            {workModes.map((mode) => (
              <option key={mode} value={mode}>
                {t(`career.options.${mode}`)}
              </option>
            ))}
          </select>
        </div>

        <CountryPicker
          id="career-direction-residence"
          value={preferences.residenceCountry}
          onChange={(value) => update({}, { residenceCountry: value })}
          mode="code"
        />
      </div>

      <fieldset className="space-y-2 border-t pt-4">
        <legend className="text-xs font-medium">
          {french ? "Type d'emploi" : "Employment type"}
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {contracts.map(([key, en, fr]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={preferences.employmentTypes.includes(key)}
                onChange={(event) => update({}, {
                  employmentTypes: event.target.checked
                    ? [...preferences.employmentTypes, key]
                    : preferences.employmentTypes.filter((item) => item !== key),
                })}
              />
              {french ? fr : en}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="career-direction-salary-rate" className={labelClass}>
            {french ? "Période salariale" : "Salary rate"}
          </label>
          <select
            id="career-direction-salary-rate"
            className={selectClass}
            value={preferences.salaryRate}
            onChange={(event) => update({}, {
              salaryRate: event.target.value as JobPreferences["salaryRate"],
            })}
          >
            {salaryRates.map(([key, en, fr]) => (
              <option key={key} value={key}>{french ? fr : en}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="career-direction-min-salary" className={labelClass}>
            {french ? "Salaire minimum (USD)" : "Minimum salary (USD)"}
          </label>
          <Input
            id="career-direction-min-salary"
            type="number"
            min={0}
            max={100000000}
            step={1}
            value={preferences.minimumSalary ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              const number = Number(raw);
              update({}, {
                minimumSalary: raw === "" ? null : Number.isFinite(number)
                  ? Math.max(0, Math.min(100000000, Math.trunc(number)))
                  : null,
              });
            }}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}
