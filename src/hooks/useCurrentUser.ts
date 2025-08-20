"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";

export function useCurrentUser() {
  const [loading, setLoading] = useState(true);
  const { data: session } = authClient.useSession()

  return { user: session?.user, loading };
}
