// Facade kept for backward compatibility: the sim is split into player.ts (one body vs the level)
// and entities.ts (players vs players, enemies, levers, plates, doors, rooms, stepWorld).
export * from './player';
export * from './entities';
