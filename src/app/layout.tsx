import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CVcomet - Create a Professional Resume with AI",
    template: "%s | CVcomet",
  },
  description:
    "Generate your professional resume and cover letter using AI with CVcomet. Fast, easy, and modern CV creation.",
  keywords: [
    "CVcomet",
    "resume builder",
    "AI CV",
    "cover letter",
    "cover letter generator",
    "CV generator",
    "job application",
  ],
  authors: [
    { name: "CVcomet Team", url: "https://smartcv-landingpage.vercel.app" },
  ],
  creator: "CVcomet",
  publisher: "CVcomet",
  metadataBase: new URL("https://www.cvcomet.com"),
  alternates: {
    canonical: "https://www.cvcomet.com",
  },
  openGraph: {
    title: "CVcomet - Create a Professional Resume with AI",
    description:
      "Create a modern, standout resume with CVcomet's AI-powered CV generator.",
    url: "https://www.cvcomet.com",
    siteName: "CVcomet",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CVcomet - Create a Professional Resume with AI",
    description: "Build your CV with CVcomet's AI resume generator.",
    creator: "@SmartCV",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [cookieStore, requestHeaders] = await Promise.all([
    cookies(),
    headers(),
  ]);
  const savedLanguage = cookieStore.get("i18next")?.value;
  const preferredLanguage =
    savedLanguage || requestHeaders.get("accept-language") || "en";
  const initialLanguage = preferredLanguage.toLowerCase().startsWith("fr")
    ? "fr"
    : "en";
  return (
    <html lang={initialLanguage} suppressHydrationWarning>
      <body>
        <AppProviders initialLanguage={initialLanguage}>
          {children}
        </AppProviders>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-NEY0HEKQYN"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
        >{`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-NEY0HEKQYN');`}</Script>
      </body>
    </html>
  );
}
