import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function DELETE() {
  return auth.api.signOut({ headers: await headers(), asResponse: true });
}
