import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../../public/locales/en/common.json";
import fr from "../../../public/locales/fr/common.json";

export type AppLanguage = "en" | "fr";

// One instance per provider/request prevents language leaking between SSR requests.
// Resources and the initial language are identical on the server and the browser.
export function createAppI18n(language: AppLanguage) {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources: { en: { common: en }, fr: { common: fr } },
    lng: language,
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    defaultNS: "common",
    ns: ["common"],
    initImmediate: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}
