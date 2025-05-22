import type { Metadata } from "next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import "./globals.css";
import { ReduxProvider } from "@/redux/provider";
import { AccountNav } from "@/components/navbar/accountNav";
import { LanguageProviderWrapper } from "@/components/LanguageProviderWrapper";
import { Toaster } from '@/components/ui/sonner' 

export const metadata: Metadata = {
  title: {
    default: "CVcomet - Create a Professional Resume with AI",
    template: "%s | CVcomet",
  },
  description: "Generate your professional resume and cover letter using AI with CVcomet. Fast, easy, and modern CV creation.",
  keywords: ["CVcomet", "resume builder", "AI CV", "cover letter", "CV generator", "job application"],
  authors: [{ name: "CVcomet Team", url: "https://smartcv-landingpage.vercel.app" }],
  creator: "CVcomet",
  publisher: "CVcomet",
  metadataBase: new URL("https://smartcv-landingpage.vercel.app"),
  alternates: {
    canonical: "https://smartcv-landingpage.vercel.app",
  },
  openGraph: {
    title: "CVcomet - Create a Professional Resume with AI",
    description: "Create a modern, standout resume with CVcomet's AI-powered CV generator.",
    url: "https://smartcv-landingpage.vercel.app",
    siteName: "CVcomet",
    images: [
      {
        url: "https://smartcv-landingpage.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "CVcomet - Create a Professional Resume with AI",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CVcomet - Create a Professional Resume with AI",
    description: "Build your CV with CVcomet's AI resume generator.",
    images: ["https://smartcv-landingpage.vercel.app/og-image.png"],
    creator: "@SmartCV",
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
                  <Toaster richColors position="bottom-right" />
                </div>
              </main>
            </SidebarProvider>
          </LanguageProviderWrapper>
        </ReduxProvider>
      </body>
    </html>

  );
}
