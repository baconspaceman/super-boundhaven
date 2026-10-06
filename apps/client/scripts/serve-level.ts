// Dev launcher: run the game server on a chosen level (the stock server entry has no level option yet).
//   npx tsx apps/client/scripts/serve-level.ts coopRoom        (PORT env optional, default 8080)
import { SERVER_PORT } from '@sbh/protocol';
import { createGameServer } from '../../server/src/server';

const levelName = process.argv[2] ?? process.env.SBH_LEVEL ?? 'coopRoom';
const port = Number(process.env.PORT ?? SERVER_PORT);
const server = await createGameServer({ port, levelName, accountsFile: process.env.SBH_ACCOUNTS_FILE || null });
console.log(`sbh server listening on :${server.port} level=${levelName}`);
const shutdown = (): void => void server.close().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
