# Names, accounts and the developer account

There is no login provider yet, so SBH keeps its own small name system on the game server. Decided with Bacon Spaceman on 2026-10-06: names can be taken; registering with an email keeps a name for good; unregistered names must be renewed every 7 days.

## Names
- Joining with a name that nobody holds **claims** it. Your browser keeps a secret token that proves the claim; nobody else can use the name while it is held.
- Names are compared by letters and digits only, lower case: `Bacon Spaceman`, `bacon_spaceman` and `BACONSPACEMAN` are one name, so nobody can pose as someone with a look-alike.
- A guest claim lasts **7 days**. Type `/renew` in the console to extend it by 7 days. If it lapses, the name is free for anyone, and you simply claim it again (if it is still free).
- `/register <email> <password>` makes the name permanent. From then on, joining with it asks for the password. Passwords are hashed with scrypt and never stored or logged in plain text. At most 3 names per email.
- Emails are **not verified** yet (there is no mail service), so there is no password reset by email. Pick a password you can keep.
- Wrong passwords are rate-limited per address (8 per 10 minutes).

## The developer account
The name `baconspaceman` (change with `SBH_ADMIN_NAME`) is reserved and has the **developer** role. Nobody can use the name until a password is set; there is no default password in the code or the repository.

Set the password one of two ways (never commit it):
1. Start the server with `SBH_ADMIN_PASSWORD="a long password"`; the account is created or updated at start-up.
2. Or run `npm run admin -w @sbh/server` (generates and prints a strong password once) or `npm run admin -w @sbh/server -- "your own password"`. This writes the hashed account to `apps/server/data/accounts.json`, which is git-ignored.

Join with the name and password on the character screen, then press `` ` `` (backquote) to open the console.

### Developer commands
`/help` lists them. All run on the server; the role comes from the server's own record, so a modified client cannot grant itself anything.

| Command | Does |
|---|---|
| `/who`, `/items` | players with positions; what can be given |
| `/give <item> <n> [player]` | add items (today only `shard`; gear, mounts and powerups join the list when they exist) |
| `/tp <x> <y> [player]`, `/tp <player> [who]`, `/cp <n> [player]` | teleport to coordinates, a player or a checkpoint |
| `/god [on/off]` | no damage |
| `/doors open/close <id/all>`, `/buttons light <id/all>`, `/levers on/off <id/all>` | force puzzle parts |
| `/kill enemies`, `/reset` | defeat every enemy; reset the room |
| `/announce <text>` | message to everyone |
| `/kick`, `/ban <name> [hours] [reason]`, `/unban`, `/free <name>` | moderation and releasing names |

Not built yet: flying/noclip, spawning enemies, changing level without a restart (use `SBH_LEVEL`), an item catalogue beyond shards.

## Where the data lives
`apps/server/data/accounts.json` (override with `SBH_ACCOUNTS_FILE`), file mode 600, git-ignored. Back it up; losing it frees every name.

## Going live
GitHub Pages can only host the static site and the offline creator, not the WebSocket game server. To make the public `/play/` page join a real server:
1. Run the server somewhere that keeps a Node process alive (a small VPS, Fly.io, Render, Railway, ...): `SBH_ADMIN_PASSWORD=... SBH_LEVEL=poundRoom npm start -w @sbh/server`, with a persistent disk for `apps/server/data/`.
2. Put it behind HTTPS so it speaks `wss://` (the Pages site is https, browsers block plain `ws://` from it).
3. In the GitHub repo, add a Variable `SBH_SERVER_URL` = `wss://your-server`; the next push to `main` rebuilds `/play/` pointing at it.

## Saved looks
Accounts (the developer account and registered players) keep their character look on the server: the saved look wins when you log in (the creator's pick is used only the first time). Guests are not saved. Developer-only pieces are stripped from non-developers. See `docs/CHARACTER_CREATOR.md`.
