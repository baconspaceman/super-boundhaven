// Names, claims and accounts (no third-party services; one JSON file on the server, never committed).
//
//  - A name is held by at most one owner. Names are compared by `nameKey`: lower case with only letters and digits,
//    so "Bacon Spaceman", "bacon_spaceman" and "BACONSPACEMAN" are the same name (no look-alike impersonation).
//  - Guests: joining with a free name claims it for GUEST_CLAIM_MS (7 days). The claim is proved by a secret token the
//    browser keeps. It lapses after 7 days unless the owner renews it (/renew); once lapsed the name is free for anyone.
//  - Accounts: /register <email> <password> turns a claim into a permanent account (scrypt-hashed password). Joining
//    with that name then needs the password. Emails are stored but NOT yet verified: there is no mail service.
//  - The admin (developer) name is reserved. It only works once a password has been configured (SBH_ADMIN_PASSWORD or
//    the admin-account script); until then nobody can use the name.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GUEST_CLAIM_MS, type ClaimInfo, type Role } from '@sbh/protocol';

/** Lower case, letters and digits only. Empty = not claimable. */
export function nameKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface Account {
  name: string;
  email: string;
  emailVerified: boolean;
  salt: string;
  hash: string;
  created: number;
  role: Role;
}
interface Claim {
  name: string;
  secret: string; // sha256 hex of the claim token
  expiresAt: number;
}
interface Ban {
  until: number | null;
  reason: string;
}
interface Stored {
  version: 1;
  accounts: Record<string, Account>;
  claims: Record<string, Claim>;
  bans: Record<string, Ban>;
}

export type AuthResult =
  | { ok: true; name: string; role: Role; claim: ClaimInfo | null; claimToken?: string; key: string }
  | { ok: false; error: string; failed: boolean };

export interface AccountStoreOptions {
  file?: string | null; // null = memory only
  adminName?: string;
  adminPassword?: string;
  now?: () => number;
}

const MAX_ACCOUNTS_PER_EMAIL = 3;
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

function hashPassword(pass: string, salt: string): string {
  return scryptSync(pass.normalize('NFKC'), salt, 32).toString('hex');
}

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

export class AccountStore {
  readonly adminKey: string;
  private data: Stored = { version: 1, accounts: {}, claims: {}, bans: {} };
  private now: () => number;

  constructor(private opts: AccountStoreOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.adminKey = nameKey(opts.adminName ?? 'baconspaceman');
    if (opts.file) {
      try {
        const raw = JSON.parse(readFileSync(opts.file, 'utf8')) as Stored;
        if (raw && raw.version === 1) this.data = { version: 1, accounts: raw.accounts ?? {}, claims: raw.claims ?? {}, bans: raw.bans ?? {} };
      } catch {
        /* first run, or unreadable: start empty */
      }
    }
    if (opts.adminPassword) this.setAdminPassword(opts.adminName ?? 'baconspaceman', opts.adminPassword);
  }

  /** Create or replace the admin account's password (used at start-up from the environment, or by the admin script). */
  setAdminPassword(displayName: string, pass: string): void {
    const salt = randomBytes(16).toString('hex');
    this.data.accounts[this.adminKey] = {
      name: displayName,
      email: '',
      emailVerified: false,
      salt,
      hash: hashPassword(pass, salt),
      created: this.data.accounts[this.adminKey]?.created ?? this.now(),
      role: 'admin',
    };
    this.save();
  }

  hasAdmin(): boolean {
    return this.data.accounts[this.adminKey]?.role === 'admin';
  }

  private save(): void {
    const file = this.opts.file;
    if (!file) return;
    try {
      mkdirSync(dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
      renameSync(tmp, file);
      try {
        chmodSync(file, 0o600);
      } catch {
        /* not supported on this platform */
      }
    } catch {
      /* a read-only disk must not crash the game server; the in-memory state still works */
    }
  }

  /** Drop lapsed claims and bans. Cheap; call hourly and before lookups. */
  purge(): void {
    const t = this.now();
    let changed = false;
    for (const k of Object.keys(this.data.claims)) {
      if (this.data.claims[k].expiresAt <= t) {
        delete this.data.claims[k];
        changed = true;
      }
    }
    for (const k of Object.keys(this.data.bans)) {
      const u = this.data.bans[k].until;
      if (u !== null && u <= t) {
        delete this.data.bans[k];
        changed = true;
      }
    }
    if (changed) this.save();
  }

  /** Decide whether `name` may be used by whoever presents this password / claim token, creating a guest claim if free. */
  authorize(name: string, pass?: string, claimToken?: string): AuthResult {
    const key = nameKey(name);
    if (!key) return { ok: false, error: 'Pick a name with at least one letter or number.', failed: false };
    this.purge();
    const ban = this.data.bans[key];
    if (ban) return { ok: false, error: `This name is banned${ban.reason ? `: ${ban.reason}` : ''}.`, failed: false };

    const acct = this.data.accounts[key];
    if (acct) {
      if (typeof pass !== 'string' || pass.length === 0) {
        return { ok: false, error: acct.role === 'admin' ? 'This name is reserved for the developer account. Enter its password.' : 'This name is registered. Enter its password to use it.', failed: false };
      }
      if (pass.length > 128 || !sameHex(hashPassword(pass, acct.salt), acct.hash)) return { ok: false, error: 'Wrong password for that name.', failed: true };
      return { ok: true, name: acct.name, role: acct.role, claim: { kind: 'account', expiresAt: null }, key };
    }
    if (key === this.adminKey) return { ok: false, error: 'This name is reserved.', failed: false };

    const claim = this.data.claims[key];
    if (claim) {
      if (typeof claimToken === 'string' && claimToken.length > 0 && sameHex(sha256(claimToken), claim.secret)) {
        return { ok: true, name: claim.name, role: 'player', claim: { kind: 'guest', expiresAt: claim.expiresAt }, key };
      }
      return { ok: false, error: 'That name is taken. Pick another, or log in with its password.', failed: false };
    }
    const token = randomBytes(24).toString('hex');
    const expiresAt = this.now() + GUEST_CLAIM_MS;
    this.data.claims[key] = { name, secret: sha256(token), expiresAt };
    this.save();
    return { ok: true, name, role: 'player', claim: { kind: 'guest', expiresAt }, claimToken: token, key };
  }

  /** Current claim on a key (accounts first), for /whoami and the account message. */
  claimOf(key: string): ClaimInfo | null {
    if (this.data.accounts[key]) return { kind: 'account', expiresAt: null };
    const c = this.data.claims[key];
    return c ? { kind: 'guest', expiresAt: c.expiresAt } : null;
  }

  /** Extend a guest claim to a fresh 7 days. */
  renew(key: string): ClaimInfo | string {
    if (this.data.accounts[key]) return 'Your name is on an account: it never expires.';
    const c = this.data.claims[key];
    if (!c || c.expiresAt <= this.now()) return 'You do not hold a claim on this name.';
    c.expiresAt = this.now() + GUEST_CLAIM_MS;
    this.save();
    return { kind: 'guest', expiresAt: c.expiresAt };
  }

  /** Turn the caller's guest claim into a permanent account. */
  register(key: string, email: string, pass: string): ClaimInfo | string {
    if (this.data.accounts[key]) return 'This name is already registered.';
    const claim = this.data.claims[key];
    if (!claim || claim.expiresAt <= this.now()) return 'Join with this name first, then register it.';
    const e = email.trim().toLowerCase();
    if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'That does not look like an email address.';
    if (pass.length < 8) return 'Use a password of at least 8 characters.';
    if (pass.length > 128) return 'That password is too long (128 characters at most).';
    const owned = Object.values(this.data.accounts).filter((a) => a.email === e).length;
    if (owned >= MAX_ACCOUNTS_PER_EMAIL) return `That email already has ${MAX_ACCOUNTS_PER_EMAIL} names.`;
    const salt = randomBytes(16).toString('hex');
    this.data.accounts[key] = { name: claim.name, email: e, emailVerified: false, salt, hash: hashPassword(pass, salt), created: this.now(), role: 'player' };
    delete this.data.claims[key];
    this.save();
    return { kind: 'account', expiresAt: null };
  }

  /** Admin: let a name go (guest claim or non-admin account). */
  release(key: string): boolean {
    if (key === this.adminKey) return false;
    const had = !!this.data.claims[key] || !!this.data.accounts[key];
    delete this.data.claims[key];
    delete this.data.accounts[key];
    if (had) this.save();
    return had;
  }

  ban(key: string, hours: number | null, reason: string): boolean {
    if (!key || key === this.adminKey) return false;
    this.data.bans[key] = { until: hours === null ? null : this.now() + hours * 3_600_000, reason: reason.slice(0, 80) };
    this.save();
    return true;
  }

  unban(key: string): boolean {
    const had = !!this.data.bans[key];
    delete this.data.bans[key];
    if (had) this.save();
    return had;
  }

  isBanned(key: string): boolean {
    this.purge();
    return !!this.data.bans[key];
  }
}
