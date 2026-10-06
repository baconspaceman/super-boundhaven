// Remembers the secret that proves this browser owns a guest name. Stored per name (letters and digits only, lower
// case: the same rule the server uses). Losing it just means the name is up for grabs once the 7 days lapse.
const PREFIX = 'sbh.claim.';

/** Same normalisation as the server's nameKey. */
export const claimKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function getClaim(name: string): string | undefined {
  const k = claimKey(name);
  if (!k) return undefined;
  try {
    return localStorage.getItem(PREFIX + k) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveClaim(name: string, token: string): void {
  const k = claimKey(name);
  if (!k) return;
  try {
    localStorage.setItem(PREFIX + k, token);
  } catch {
    /* storage unavailable: the claim still works for this tab's session */
  }
}
