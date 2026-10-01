import type { PlayerState } from '@sbh/sim';

export const PROTOCOL_VERSION = 2;
export const SERVER_PORT = 8080;
export const SNAPSHOT_EVERY = 3; // ticks (20 Hz at 60 Hz tick)
export const MAX_NAME = 16;
/** Every Nth snapshot carries each player's `look` as a self-healing fallback (1 Hz at the defaults). */
export const SNAPSHOT_LOOK_EVERY = 20;

export type ClientMsg =
  | { t: 'join'; name: string; token?: string; look?: string }
  | { t: 'setLook'; look: string }
  | { t: 'input'; seq: number; buttons: number }
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
  | { t: 'snap'; tick: number; players: NetPlayer[] }
  | { t: 'look'; id: number; look: string } // appearance of one player (join, change, or roster backfill)
  | { t: 'pong'; ts: number }
  | { t: 'error'; message: string };

export * from './look';
