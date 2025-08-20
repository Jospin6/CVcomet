"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function useCurrentUser() {
  const [loading, setLoading] = useState(true);
  const { data: session } = authClient.useSession()

  return { user: session?.user, loading };
}
