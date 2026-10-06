import type { PlayerState } from '@sbh/sim';
import type { NetWorld } from './world';

export const PROTOCOL_VERSION = 5; // v5: accounts, name claims, console commands (v4: ground pound, big buttons)
export const SERVER_PORT = 8080;
export const SNAPSHOT_EVERY = 3; // ticks (20 Hz at 60 Hz tick)
export const MAX_NAME = 16;
/** Every Nth snapshot is a full world-state frame for everyone (1 Hz at the defaults): self-healing, like looks. */
export const SNAPSHOT_FULL_EVERY = 20;
/** Every Nth snapshot carries each player's `look` as a self-healing fallback (1 Hz at the defaults). */
export const SNAPSHOT_LOOK_EVERY = 20;

/** How long a guest's claim on a name lasts after it is made or renewed (accounts with an email keep their name for good). */
export const GUEST_CLAIM_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_COMMAND = 400;

export type Role = 'player' | 'admin';
/** The caller's hold on their name. `expiresAt` is a unix ms timestamp, null for a permanent account. */
export interface ClaimInfo {
  kind: 'guest' | 'account';
  expiresAt: number | null;
}

export type ClientMsg =
  | { t: 'join'; name: string; token?: string; look?: string; claim?: string; pass?: string }
  | { t: 'cmd'; line: string } // console command: /help /whoami /register /renew, plus developer commands for admins
  | { t: 'setLook'; look: string }
  | { t: 'input'; seq: number; buttons: number } // buttons: 6-bit BTN mask (server masks with BTN_MASK)
  | { t: 'ping'; ts: number };

export interface NetPlayer {
  id: number;
  name: string;
  ack: number; // last input seq the server applied for this player
  connected: boolean;
  state: PlayerState;
  /** encodeLook() code. Only present on 1 Hz fallback snapshots; the `look` message is the primary channel. */
  look?: string;
}

export type ServerMsg =
  | { t: 'welcome'; id: number; token: string; tick: number; level: string; look: string; v: number; name?: string; role?: Role; claim?: ClaimInfo | null; claimToken?: string }
  | { t: 'info'; lines: string[] } // console output / announcements
  | { t: 'account'; role: Role; claim: ClaimInfo | null } // role or claim changed (register, renew)
  | { t: 'snap'; tick: number; players: NetPlayer[]; world?: NetWorld }
  | { t: 'look'; id: number; look: string } // appearance of one player (join, change, or roster backfill)
  | { t: 'pong'; ts: number }
  | { t: 'error'; message: string };

export * from './look';
export * from './world';
