import { SERVER_PORT } from '@sbh/protocol';
import { createGameServer } from './server';

const port = Number(process.env.PORT ?? SERVER_PORT);
const server = await createGameServer({ port });
console.log(`sbh server listening on :${server.port}`);

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
