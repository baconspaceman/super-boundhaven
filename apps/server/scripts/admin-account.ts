// Create or reset the developer account's password in the server's accounts file (never committed: apps/server/data/).
//
//   npm run admin -w @sbh/server                 generates a strong random password and prints it once
//   npm run admin -w @sbh/server -- "my password"  uses the one you give (16+ characters recommended)
//
// Alternative with no file: start the server with SBH_ADMIN_PASSWORD=<password> and it sets the account at start-up.
// Environment: SBH_ADMIN_NAME (default baconspaceman), SBH_ACCOUNTS_FILE (default apps/server/data/accounts.json).
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccountStore } from '../src/accounts';

const name = process.env.SBH_ADMIN_NAME || 'baconspaceman';
const file = process.env.SBH_ACCOUNTS_FILE || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'accounts.json');
const given = process.argv[2];
if (given !== undefined && given.length < 12) {
  console.error('Use a password of at least 12 characters (the developer account can do anything).');
  process.exit(1);
}
const password = given ?? randomBytes(15).toString('base64url');
new AccountStore({ file, adminName: name, adminPassword: password });
console.log(`Developer account "${name}" is set in ${file}`);
if (given === undefined) {
  console.log(`Password (shown once, save it now): ${password}`);
}
console.log('Join the game with that name and password, then press ` for the developer console.');
