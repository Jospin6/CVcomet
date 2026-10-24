import type { Metadata } from "next";
import { EvidenceVaultPage } from "@/components/career-evidence/evidence-vault-page";
export const metadata: Metadata = {
  title: "Career Evidence Vault | CVComet",
  robots: { index: false, follow: false },
};
export default function Page() { return <EvidenceVaultPage />; }
