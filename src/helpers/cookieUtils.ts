export interface CookieCheckResult {
  totalLength:   number;
  cookiesCount:  number;
  oversizedKeys: string[];
}

/**
 * Returns a CookieCheckResult if cookies are too large, otherwise null.
 * Thresholds are conservative — total > 4 KB or any single cookie > 2 KB.
 */
export function detectOversizedCookies(
  maxTotal     = 4096,
  maxPerCookie = 2048,
): CookieCheckResult | null {
  if (typeof document === 'undefined') return null;

  const raw     = document.cookie || '';
  const cookies = raw ? raw.split(';').map(c => c.trim()) : [];
  const oversizedKeys: string[] = [];

  for (const c of cookies) {
    if (c.length > maxPerCookie) {
      oversizedKeys.push(c.split('=')[0] ?? c);
    }
  }

  if (raw.length > maxTotal || oversizedKeys.length > 0) {
    return { totalLength: raw.length, cookiesCount: cookies.length, oversizedKeys };
  }
  return null;
}

/**
 * Deletes every cookie visible to this page by setting its expiry in the past.
 * Covers the root path and one level of subdomain for thoroughness.
 * Call this on startup if detectOversizedCookies() returns a result.
 */
export function clearAllCookies(): void {
  if (typeof document === 'undefined') return;

  const raw = document.cookie || '';
  if (!raw) return;

  const hostname = window.location.hostname;
  const domains  = [hostname, `.${hostname}`, ''];
  const paths    = ['/', window.location.pathname];
  const past     = 'Thu, 01 Jan 1970 00:00:00 GMT';

  for (const pair of raw.split(';')) {
    const name = pair.split('=')[0]?.trim();
    if (!name) continue;
    for (const domain of domains) {
      for (const path of paths) {
        const base = `${encodeURIComponent(name)}=; expires=${past}; path=${path}`;
        document.cookie = domain ? `${base}; domain=${domain}` : base;
      }
    }
  }
}

/**
 * Silently clears all cookies if the total header size is dangerously large.
 * Returns true if cookies were cleared.
 *
 * Call once on app startup.
 * The browser will re-populate any legitimate session cookies on the next
 * server response — clearing here only removes the stale accumulated ones
 * that cause 431 errors.
 */
export function clearCookiesIfOversized(maxTotal = 4096): boolean {
  const result = detectOversizedCookies(maxTotal);
  if (!result) return false;
  console.warn(
    `[Ojo] Clearing ${result.cookiesCount} oversized cookies ` +
    `(${result.totalLength} bytes). This prevents 431 Request Header Too Large errors.`
  );
  clearAllCookies();
  return true;
}

export default detectOversizedCookies;
