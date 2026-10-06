import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER_PORT } from '@sbh/protocol';
import { createGameServer } from './server';

const port = Number(process.env.PORT ?? SERVER_PORT);
// SBH_LEVEL picks the sim level by name (e.g. SBH_LEVEL=coopRoom); unset keeps the default playground.
const levelName = process.env.SBH_LEVEL || undefined;
// Names, claims, accounts and bans live in one file that is never committed (apps/server/data/ is git-ignored).
const accountsFile = process.env.SBH_ACCOUNTS_FILE || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'accounts.json');
const server = await createGameServer({ port, levelName, accountsFile });
if (!server.accounts.hasAdmin()) {
  console.warn(
    'sbh: no developer password is set, so the reserved developer name cannot log in. Start with SBH_ADMIN_PASSWORD=<a long password> (optionally SBH_ADMIN_NAME, default baconspaceman).',
  );
}
console.log(`sbh server listening on :${server.port}${levelName ? ` level=${levelName}` : ''}`);

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
