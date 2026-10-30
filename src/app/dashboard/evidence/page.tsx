import { redirect } from "next/navigation";

// Preserve old bookmarks, but the standalone Evidence Vault is retired.
export default function Page() {
  redirect("/dashboard/profile");
}
