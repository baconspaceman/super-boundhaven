// Look validation shared by server and client. @sbh/art's package `exports` only exposes the root
// (world art), so the character modules are reached by relative path (browser-safe, no node:* imports).
import { DEFAULT_LOOK, DEV_ONLY, DEV_SIGNATURE_LOOK, decodeLook, encodeLook, randomLook, sanitizeLook, stripDevItems, usesDevItems, validateLook } from '../../art/src/characters/look';
import type { CharacterLook } from '../../art/src/characters/look';

export const MAX_LOOK_CODE = 32;

/** Decode an untrusted look code. Returns the canonical code, or null if missing/malformed/out of range. */
export function parseLookCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length < 2 || raw.length > MAX_LOOK_CODE) return null;
  const look = decodeLook(raw);
  if (!look || validateLook(look).length > 0) return null;
  return encodeLook(sanitizeLook(look));
}

/** Deterministic fallback look for a player id. */
export function defaultLookCode(id: number): string {
  return encodeLook(randomLook(id));
}

/** The same look code with developer-only pieces removed (a no-op when it has none). Input must be a canonical code. */
export function stripDevCode(code: string): string {
  const look = decodeLook(code);
  return look && usesDevItems(look) ? encodeLook(stripDevItems(look)) : code;
}

export { DEFAULT_LOOK, DEV_SIGNATURE_LOOK, DEV_ONLY, decodeLook, encodeLook, randomLook, sanitizeLook, stripDevItems, usesDevItems, validateLook };
export type { CharacterLook };
