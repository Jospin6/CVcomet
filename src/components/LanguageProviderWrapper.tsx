"use client";
import type { ReactNode } from "react";
import type { AppLanguage } from "@/lib/i18n/i18n";
import { LanguageProvider } from "./LanguageProvider";

export function LanguageProviderWrapper({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage: AppLanguage;
}) {
  return (
    <LanguageProvider initialLanguage={initialLanguage}>
      {children}
    </LanguageProvider>
  );
}
