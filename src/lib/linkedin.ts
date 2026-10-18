export const MAX_LINKEDIN_TEXT = 120000;

// Accept only personal LinkedIn profile URLs. Tracking parameters never reach
// the import provider, and user input is never used as a fetch destination.
export function normalizeLinkedInUrl(value: string): string | null {
  const source = value.trim();
  if (!source || source.length > 2048 || /\s/.test(source)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(source) ? source : `https://${source}`);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^(?:(?:www|[a-z]{2})\.)?linkedin\.com$/i.test(url.hostname)) return null;
    const match = /^\/in\/([^/]+)\/?$/.exec(url.pathname);
    if (!match) return null;
    const identifier = decodeURIComponent(match[1]);
    if (!/^[\p{L}\p{N}_-]{1,100}$/u.test(identifier)) return null;
    return `https://www.linkedin.com/in/${encodeURIComponent(identifier)}/`;
  } catch { return null; }
}
