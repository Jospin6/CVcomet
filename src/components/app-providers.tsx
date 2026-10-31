"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { ReduxProvider } from "@/redux/provider";
import { LanguageProviderWrapper } from "@/components/LanguageProviderWrapper";
import { AppShell } from "@/components/shell/app-shell";

export function AppProviders({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: "en" | "fr";
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">
        <ReduxProvider>
          <LanguageProviderWrapper initialLanguage={initialLanguage}>
            <AppShell>{children}</AppShell>
          </LanguageProviderWrapper>
        </ReduxProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
