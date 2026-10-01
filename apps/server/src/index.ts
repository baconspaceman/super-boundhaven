import { SERVER_PORT } from '@sbh/protocol';
import { createGameServer } from './server';

const port = Number(process.env.PORT ?? SERVER_PORT);
// SBH_LEVEL picks the sim level by name (e.g. SBH_LEVEL=coopRoom); unset keeps the default playground.
const levelName = process.env.SBH_LEVEL || undefined;
const server = await createGameServer({ port, levelName });
console.log(`sbh server listening on :${server.port}${levelName ? ` level=${levelName}` : ''}`);

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
