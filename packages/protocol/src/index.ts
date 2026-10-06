import type { PlayerState } from '@sbh/sim';
import type { NetWorld } from './world';

export const PROTOCOL_VERSION = 4; // v4: ground pound state on players, big buttons in the world snapshot
export const SERVER_PORT = 8080;
export const SNAPSHOT_EVERY = 3; // ticks (20 Hz at 60 Hz tick)
export const MAX_NAME = 16;
/** Every Nth snapshot is a full world-state frame for everyone (1 Hz at the defaults): self-healing, like looks. */
export const SNAPSHOT_FULL_EVERY = 20;
/** Every Nth snapshot carries each player's `look` as a self-healing fallback (1 Hz at the defaults). */
export const SNAPSHOT_LOOK_EVERY = 20;

export type ClientMsg =
  | { t: 'join'; name: string; token?: string; look?: string }
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
  | { t: 'welcome'; id: number; token: string; tick: number; level: string; look: string; v: number }
  | { t: 'snap'; tick: number; players: NetPlayer[]; world?: NetWorld }
  | { t: 'look'; id: number; look: string } // appearance of one player (join, change, or roster backfill)
  | { t: 'pong'; ts: number }
  | { t: 'error'; message: string };

export * from './look';
export * from './world';
