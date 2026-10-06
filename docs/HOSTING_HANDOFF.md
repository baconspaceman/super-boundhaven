# Hosting handoff (for Codex or anyone setting up the public game server)

Goal: run the SBH game server somewhere always-on so the public `/play/` page can join it, with the developer account `baconspaceman` working. Everything below is already implemented in the repo; this is only the setup. Written 2026-10-06 (accounts and admin: see `ACCOUNTS_AND_ADMIN.md`).

## 1. Merge first
Pull request `claude/sweet-keller-6yaeuh` must be merged into `main`. The Pages site only rebuilds from `main`.

## 2. Run the server
Needs Node 24+ and a machine that stays on (small VPS, Fly.io, Render, Railway, ...).

```
git clone https://github.com/baconspaceman/super-boundhaven && cd super-boundhaven
npm ci
SBH_ADMIN_PASSWORD='<long random password, 16+ characters>' \
SBH_LEVEL=poundRoom \
PORT=8080 \
npm start -w @sbh/server
```

Environment variables:
| Variable | Meaning |
|---|---|
| `SBH_ADMIN_PASSWORD` | Password for the developer account. Required, or the name `baconspaceman` stays unusable. Pick it yourself; never commit it. |
| `SBH_ADMIN_NAME` | Developer name (default `baconspaceman`). |
| `SBH_LEVEL` | `playground` (default), `coopRoom` (2-4), `raidRoom` (6-8), `poundRoom` (2-4). One level per server process. |
| `PORT` | Listen port (default 8080). |
| `SBH_ACCOUNTS_FILE` | Where names, accounts and bans are saved (default `apps/server/data/accounts.json`). **Keep this on a persistent disk and back it up**: losing it frees every name. |
| `SBH_ALLOWED_ORIGINS` | CORS allowlist for the waitlist form (comma separated), optional. |

Run it under a process manager (systemd, pm2, or the host's own) so it restarts on crash. Several levels = several processes on different ports.

## 3. HTTPS / wss
The Pages site is https, so browsers only allow a secure WebSocket (`wss://`). Put the server behind a reverse proxy or the host's TLS (Caddy, nginx, Cloudflare, Fly/Render built-in TLS) and forward WebSocket upgrades to the port above. The server itself speaks plain `ws://`.

## 4. Point the public page at it
GitHub repo > Settings > Secrets and variables > Actions > **Variables** > new variable `SBH_SERVER_URL` = `wss://your-server-host` (no path). Then push to `main` or run the "Deploy site and docs to GitHub Pages" workflow by hand. `/play/` will now join that server.

## 5. Check it works
- Open `https://baconspaceman.github.io/super-boundhaven/play/`, enter `baconspaceman` plus the password, and press the backquote key (`` ` ``) to open the console; `/whoami` should say developer.
- A wrong password must be refused; a second person using any other name should claim it for 7 days (`/renew` extends it).
- From a normal player, `/give shard 5` must answer "Unknown command".

## Do not
- Commit `apps/server/data/` (git-ignored) or any password.
- Expose the server without TLS to the https site.
- Delete `accounts.json` on redeploys.

## Known limits
No email verification or password reset yet; no flying/noclip or spawn commands; only shards exist as items; one level per process; the protocol version is 5 (old pages show a "reload" message against a newer server).
