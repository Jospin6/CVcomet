/** Dependency-free origin policy shared by route handlers and Edge middleware.
 * Only explicit HTTP(S) origins may be trusted. Never trust opaque/null origins.
 */
export function allowedBrowserOrigins(env: {
  NODE_ENV?: string;
  BETTER_AUTH_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  CVCOMET_ALLOWED_ORIGINS?: string;
}, requestUrl: string) {
  const configured = [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL, ...(env.CVCOMET_ALLOWED_ORIGINS || "").split(",")]
    .filter((item): item is string => Boolean(item?.trim()))
    .flatMap(item => {
      try {
        const address = new URL(item.trim());
        // Production origins must use TLS. Even an explicitly configured
        // file:/javascript:/data: or http: URL cannot loosen this policy.
        if (address.protocol !== "https:" && !(env.NODE_ENV !== "production" && address.protocol === "http:")) return [];
        if (address.username || address.password || address.origin === "null") return [];
        return [address.origin];
      } catch { return []; }
    });
  const trusted = new Set(configured);
  if (env.NODE_ENV !== "production") {
    try {
      const current = new URL(requestUrl);
      if (current.protocol === "http:" || current.protocol === "https:") trusted.add(current.origin);
    } catch { /* Invalid request URLs must not become trusted origins. */ }
  }
  return trusted;
}

export function originRejectionReason(req: Pick<Request, "url" | "headers">,
  env: Parameters<typeof allowedBrowserOrigins>[0]): "UNTRUSTED_ORIGIN" | "ORIGIN_REQUIRED" | null {
  if (req.headers.get("sec-fetch-site") === "cross-site") return "UNTRUSTED_ORIGIN";
  const origin = req.headers.get("origin");
  if (origin) {
    // Reject opaque/invalid origins as well as URLs with paths or credentials.
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin || parsed.origin === "null") return "UNTRUSTED_ORIGIN";
    } catch { return "UNTRUSTED_ORIGIN"; }
    return allowedBrowserOrigins(env, req.url).has(origin) ? null : "UNTRUSTED_ORIGIN";
  }
  if (env.NODE_ENV === "production" && req.headers.has("cookie")) return "ORIGIN_REQUIRED";
  return null;
}
