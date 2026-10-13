import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { getAIAdminView } from "@/lib/ai/config";
import { AISettingsPanel } from "@/components/admin/ai-settings";

export const dynamic = "force-dynamic";
export default async function AIAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/unauthorized");
  return <AISettingsPanel initial={await getAIAdminView()} />;
}
