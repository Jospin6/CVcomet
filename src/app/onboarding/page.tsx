import type { Metadata } from "next";
import { CareerProfilePage } from "@/components/career-profile/career-profile-page";
export const metadata: Metadata = { title: "Onboarding | CVcomet", robots: { index: false, follow: false } };
export default function Page() { return <CareerProfilePage onboarding />; }
