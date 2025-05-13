import type { Metadata } from "next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import "./globals.css";
import { ReduxProvider } from "@/redux/provider";
import { AccountNav } from "@/components/navbar/accountNav";
import { LanguageProviderWrapper } from "@/components/LanguageProviderWrapper";

export const metadata: Metadata = {
  title: {
    default: "SmartCV - Create a Professional Resume with AI",
    template: "%s | SmartCV",
  },
  description: "Generate your professional resume and cover letter using AI with SmartCV. Fast, easy, and modern CV creation.",
  keywords: ["SmartCV", "resume builder", "AI CV", "cover letter", "CV generator", "job application"],
  authors: [{ name: "SmartCV Team", url: "https://smartcv-landingpage.vercel.app" }],
  creator: "SmartCV",
  publisher: "SmartCV",
  metadataBase: new URL("https://smartcv-landingpage.vercel.app"),
  alternates: {
    canonical: "https://smartcv-landingpage.vercel.app",
  },
  openGraph: {
    title: "SmartCV - Create a Professional Resume with AI",
    description: "Create a modern, standout resume with SmartCV's AI-powered CV generator.",
    url: "https://smartcv-landingpage.vercel.app",
    siteName: "SmartCV",
    images: [
      {
        url: "https://smartcv-landingpage.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "SmartCV - Create a Professional Resume with AI",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SmartCV - Create a Professional Resume with AI",
    description: "Build your CV with SmartCV's AI resume generator.",
    images: ["https://smartcv-landingpage.vercel.app/og-image.png"],
    creator: "@SmartCV",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
  modal
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode
}>) {
  return (
    <html>
      
      <body className="overflow-x-hidden">
        <ReduxProvider>
          <LanguageProviderWrapper>
            <SidebarProvider className="">
              <AppSidebar />
              <main className="w-full bg-[#282828]">
                <div className="w-full flex justify-between items-center h-10 px-3">
                  <SidebarTrigger className="text-white" />
                  <AccountNav />
                </div>
                <div className="w-10/12 m-auto">
                  {children}
                  {modal}
                </div>
              </main>
            </SidebarProvider>
          </LanguageProviderWrapper>
        </ReduxProvider>
      </body>
    </html>

  );
}
