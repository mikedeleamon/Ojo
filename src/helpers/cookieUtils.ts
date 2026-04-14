export interface CookieCheckResult {
  totalLength: number;
  cookiesCount: number;
  oversizedKeys: string[]; 
}

/**
 * Detect oversized cookies in the browser.
 * Returns a CookieCheckResult when a problem is found, otherwise null.
 *
 * This is a heuristic — server header limits vary. Default thresholds are
 * conservative: total cookie header > 4096 bytes or any individual cookie > 2048 bytes.
 */
export function detectOversizedCookies(
  maxTotal = 4096,
  maxPerCookie = 2048,
): CookieCheckResult | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;

  const raw = document.cookie || '';
  const cookies = raw ? raw.split(';').map((c) => c.trim()) : [];
  const totalLength = raw.length;
  const oversizedKeys: string[] = [];

  for (const c of cookies) {
    if (c.length > maxPerCookie) {
      const key = c.split('=')[0] || c;
      oversizedKeys.push(key);
    }
  }

  if (totalLength > maxTotal || oversizedKeys.length > 0) {
    return { totalLength, cookiesCount: cookies.length, oversizedKeys };
  }

  return null;
}

export default detectOversizedCookies;
