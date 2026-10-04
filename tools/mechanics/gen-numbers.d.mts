export const OUT_REL: string;
export const HEADER: string;
/** Regenerates the numbers document and the registry of every tag a doc may quote. Deterministic. */
export function buildNumbers(): { markdown: string; tags: Map<string, string> };
/** Reads a repo-relative file as UTF-8 with LF line endings. */
export function read(rel: string): string;
export function outPath(): string;
