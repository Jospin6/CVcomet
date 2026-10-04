"use client";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { createAppI18n, type AppLanguage } from "@/lib/i18n/i18n";

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: AppLanguage;
}) {
  const [instance] = useState(() => createAppI18n(initialLanguage));
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
