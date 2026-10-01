import type { Level } from '../level';
import { COOP_ROOM } from './coopRoom';
import { PLAYGROUND } from './playground';

export const DEFAULT_LEVEL = PLAYGROUND.name;

/** Every level the server can host and the client can load, keyed by `Level.name` (sent in `welcome`). */
export const LEVELS: Readonly<Record<string, Level>> = {
  [PLAYGROUND.name]: PLAYGROUND,
  [COOP_ROOM.name]: COOP_ROOM,
};

export function getLevel(name: string): Level | undefined {
  return Object.prototype.hasOwnProperty.call(LEVELS, name) ? LEVELS[name] : undefined;
}
