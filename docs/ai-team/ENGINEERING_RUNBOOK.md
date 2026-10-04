# Engineering Runbook

<!-- core:start -->
**Stack.** TypeScript monorepo (npm workspaces: `packages/{sim,protocol,art}`, `apps/{server,client,site}`), Node 24, Vite + PixiJS 8 client, Node + `ws` server (60 Hz sim, 20 Hz snapshots), Vitest (17 files, 241 tests), docs portal built by `tools/docs-site`.

**Daily commands.** `npm install`; `npm run dev` (server :8080 + client :5173); `npm run dev -w @sbh/site` (site :5174); `npm test`; `npm run typecheck`; `npm run build:pages` (site + `/play/` + `/docs/` into `apps/site/dist`, base `/super-boundhaven/`); `npm run linkcheck`; `npm run audit`; art: `npm run build:art -w @sbh/art`, `npm run build:blender -w @sbh/art` (needs Blender 5.1). Server level: `SBH_LEVEL=coopRoom`. Client flags: `?region=`, `?tod=`, `?name=`, `?look=`, `?lag=&loss=`, `?server=`, `?raf=timer`, `?pad=debug`.

**Definition of done.** `npm test` and `npm run typecheck` green; real browser check for any visual or netcode change; docs updated (incl. `docs/NETCODE.md` for protocol, `DECISIONS.md` only for Anthony-accepted items); no secrets, personal emails or local paths; `npm run audit` shows 0 FAIL before any push; handoff updated.

**Rules that must never break.** `packages/sim` is deterministic (no `Math.random`, `Date`, wall clock, I/O; same code runs on client, server and the site reel). Protocol changes bump `PROTOCOL_VERSION` and update `docs/NETCODE.md`. Never commit `apps/server/data/` (waitlist emails). Git identity is `baconspaceman` with the GitHub no-reply email. The private history bundle lives outside the repo and is never pushed. Push to `main` auto-deploys GitHub Pages after tests pass.

**Know the gaps.** The client does not check `welcome.v`; `apps/site/src/assets` is a manual copy with no re-copy script; no automated visual/e2e tests; `og:image` is a relative path; `docs/NEXT_ACTION.md` has a stale license sentence. Fix or flag, do not hide.
<!-- core:end -->

Related: [`CHARTER`](CHARTER.md), [`PROTOCOL`](PROTOCOL.md), [`WORKSTREAMS`](WORKSTREAMS.md), [`README`](README.md); [`IMAGE_GUIDE.md`](IMAGE_GUIDE.md), [`REVIEW_CHECKLISTS.md`](REVIEW_CHECKLISTS.md), [`ASSET_PIPELINES.md`](ASSET_PIPELINES.md); [`docs/mechanics/`](../mechanics/), [`docs/bible/`](../bible/), [`docs/ROADMAP.md`](../ROADMAP.md).

Verified against the tree on 2026-10-04 (commit `cff9c4c` + uncommitted doc edits; `npm test` = 17 files / 241 tests passing; `npm audit` = 0 vulnerabilities).

---

## 1. Repo map and architecture

```
super-boundhaven/
  package.json            root scripts + npm workspaces (packages/*, apps/*)
  tsconfig.json           strict; includes packages/*/{src,test}, apps/*/{src,test}
  packages/
    sim/        @sbh/sim       deterministic movement + level data + world (entities, doors, enemies)
      src/ config.ts player.ts step.ts entities.ts level.ts types.ts levels/{playground,coopRoom,registry}.ts
    protocol/   @sbh/protocol  wire types, PROTOCOL_VERSION (=3), SERVER_PORT (8080), look validation, world delta encoder
      src/ index.ts look.ts world.ts
    art/        @sbh/art       TS pixel generators, characters/world/objects, built PNG+JSON (committed), Blender outputs
      src/ core.ts png.ts characters/* world/* blender/{manifest.ts,index.ts}
      scripts/ build-art.ts build-characters.ts build-world.ts run-world.ts run-characters.ts gallery*.ts preview.ts quick.ts zoom.ts
      assets/ *.png *.json (generated, committed) + blender/ + blender-characters/
  apps/
    server/     @sbh/server    authoritative ws server (60 Hz, 20 Hz snapshots) + waitlist HTTP endpoint
      src/ index.ts server.ts waitlist.ts   data/ (gitignored)
    client/     @sbh/client    Vite + PixiJS: prediction, reconciliation, interpolation, creator, HUD, gamepad
      src/ main.ts game.ts net.ts render.ts creator.ts input.ts gamepad.ts bindings.ts motion.ts player-view.ts
           world-art.ts world-objects.ts object-atlas.ts tod-art.ts enemy-view.ts scene-logic.ts hud.ts ...
      scripts/serve-level.ts
    site/       @sbh/site      marketing site (Vite, no framework); reel replays the real sim
      src/ main.ts content.ts reel.ts clips.ts hero.ts showcase.ts art.ts assets.ts waitlist.ts world.ts styles.css
      src/assets/  COPY of selected packages/art/assets (see ASSET_PIPELINES.md)
      public/ og.png shots/
  tools/
    audit/prepublish.mjs   read-only pre-publish audit; writes tools/audit/REPORT.md
    docs-site/ build.mjs pages.mjs serve.mjs linkcheck.mjs
    blender/   build.ps1 + scenes/ pixelize.py pack_sprites.py preview.py gen_manifest.py check.py ...
    blender-character/     character Blender experiments (spike, not the shipping look)
  docs/        art, design, netcode, research, specs (+ ai-team, bible, mechanics, ROADMAP being added)
  .github/workflows/ ci.yml pages.yml     .github/ISSUE_TEMPLATE/
```

### Dependency direction (keep it acyclic)

`sim` depends on nothing. `protocol` depends on `sim` (declared) and reaches into `art` by **relative path** (`packages/protocol/src/look.ts` imports `../../art/src/characters/look`; not declared in `package.json`, a known smell). `art` depends on nothing in the repo. `server` uses `sim` + `protocol`. `client` uses `sim` + `protocol` and imports art **files** directly from `packages/art/assets` via `import.meta.glob`. `site` uses `sim` (reel) and has its own copy of art. Never import `apps/*` from `packages/*`.

### Runtime shape

- Server: `tsx` runs TypeScript directly. `createGameServer({ levelName?, maxPlayers? })`; `levelName` is a key of `LEVELS` in `packages/sim/src/levels/registry.ts` (`playground` default, `coopRoom`).
- Client: predicts only its own player against static tiles plus the synced door state; replays on reconciliation; interpolates remote players. Details: [`docs/NETCODE.md`](../NETCODE.md).
- Same movement code on client, server and in the site's gameplay reel (`apps/site/src/clips.ts` verifies the scripted input tracks against the sim).
- Static Pages build has **no game server**: the `/play/` client works offline (creator only) because `VITE_SERVER_URL` is empty in production.

---

## 2. Setup

Requires Node 24 (CI uses 24) and npm. No database, no Docker.

```powershell
git clone https://github.com/baconspaceman/super-boundhaven.git
cd super-boundhaven
npm install          # CI uses npm ci
npm test             # expect 17 files, 241 tests
npm run typecheck
```

Blender work additionally needs Blender 5.1 (`C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`) and system Python 3.11 with Pillow and numpy (`C:\Program Files\Python311\python.exe`); both paths are the defaults in `tools/blender/build.ps1` and can be overridden with `-Blender` / `-Python`. Rendered PNGs are committed, so only art changes need Blender.

**Shell notes (Windows).** Use PowerShell 7. In **Git Bash**, setting `VITE_BASE=/super-boundhaven/ npm run ...` gets the path mangled by MSYS conversion (observed: output became `/Program Files/Git/super-boundhaven/`). In Git Bash use `MSYS_NO_PATHCONV=1`, or use PowerShell: `$env:VITE_BASE='/super-boundhaven/'; npm run build:site`. `npm run build:pages` itself sets the base internally, so prefer it.

---

## 3. Every script and tool command

### Root `package.json` scripts

| Command | What it does |
|---|---|
| `npm run dev` | `concurrently` runs `dev:server` (tsx watch `apps/server/src/index.ts`, port 8080) and `dev:client` (Vite, port 5173, strict) |
| `npm run dev:server` / `dev:client` | each half alone |
| `npm run dev -w @sbh/site` | marketing site on :5174 (`--strictPort`); `npm run preview -w @sbh/site` serves a built site on :5174 |
| `npm test` | `vitest run` over all workspaces (no vitest config file; default discovery) |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` |
| `npm run build:site` | Vite build of `apps/site` into `apps/site/dist` (base from `VITE_BASE`, default `/`) |
| `npm run build:client` | Vite build of `apps/client` |
| `npm run build:docs` | `node tools/docs-site/build.mjs [--out dir]` converts every root `*.md` and `docs/**` to HTML, builds search index and art gallery. Default out `apps/site/dist/docs` |
| `npm run build:pages` | `node tools/docs-site/pages.mjs`: builds site (base `/super-boundhaven/`, `VITE_PLAY_URL=./play/`), the client into `apps/site/dist/play` (`VITE_CLIENT_BASE=<base>play/`, `VITE_SERVER_URL=''`) and the docs portal. Base comes from `VITE_BASE` (default `/super-boundhaven/`) |
| `npm run serve:pages` | `node tools/docs-site/serve.mjs [dir] [prefix] [port]`, default `apps/site/dist`, `/super-boundhaven/`, `4173` |
| `npm run linkcheck` | `node tools/docs-site/linkcheck.mjs [dir] [prefix]` verifies every href/src/srcset/CSS url in built HTML resolves. Run after `build:pages` |
| `npm run audit` | `node tools/audit/prepublish.mjs [--no-history]` (see section 6). **Writes `tools/audit/REPORT.md`** (tracked file) |

There is **no `docs:*` script group**; the docs commands are `build:docs`, `build:pages`, `serve:pages`, `linkcheck`.

### Workspace scripts

| Command | What it does |
|---|---|
| `npm run build:art -w @sbh/art` | `tsx scripts/build-art.ts`: regenerates characters + world art into `packages/art/assets/` |
| `npm run build:blender -w @sbh/art` | `pwsh -NoProfile -File ../../tools/blender/build.ps1` (about 100 s) |
| `npm run dev/start -w @sbh/server` | `tsx watch` / `tsx src/index.ts` (`PORT`, `SBH_LEVEL`, `SBH_WAITLIST_FILE` env vars) |
| `npx tsx apps/client/scripts/serve-level.ts coopRoom` | start a server on a chosen level (default `coopRoom`, port from `PORT` or 8080) |
| `npx tsx packages/art/scripts/run-world.ts` | world art only (tiles, props, objects, backgrounds, previews) |
| `npx tsx packages/art/scripts/run-characters.ts` | character art only |
| `npx tsx packages/art/scripts/gallery-run.ts [options] [frame]` | option gallery sheet to `assets/_gallery.png` (dev, scratch) |
| `npx tsx packages/art/scripts/zoom.ts <look#> <frame...>` | zoomed frames to `assets/_zoom.png` (dev, scratch) |
| `npx tsx packages/art/scripts/quick.ts [mount]` | mount contact sheet to `assets/_quick.png` (dev, scratch) |
| `npx vitest run packages/art/src/blender` | the Blender manifest/file checks |
| `python tools/blender/check.py [--assets dir]` | pixel sanity checks (exit 1 on fail) |
| `pwsh tools/blender/build.ps1 [-Tods sunset,day] [-SkipSprites] [-Blender p] [-Python p]` | Blender rebuild |
| `bash tools/blender/run_tod.sh <tod>` | dev loop for one scene |
| `pwsh tools/blender-character/run.ps1` | **regenerates** `packages/art/assets/blender-characters/` (experiment; deletes `_raw` first) |

The `_gallery.png`, `_zoom.png`, `_quick.png` outputs are scratch files; do not commit them.

### Ports

| Port | Service |
|---|---|
| 8080 | game server (`SERVER_PORT` in `@sbh/protocol`); WebSocket plus waitlist HTTP `/api/waitlist` |
| 5173 | game client (Vite dev, strict) |
| 5174 | marketing site (dev and preview, strict) |
| 4173 | `serve:pages` local Pages mirror |

`.claude/launch.json` defines `sbh-server` (npm run dev:server, 8080) and `sbh-client` (npm run dev:client, 5173) for the Claude preview tooling.

### Client query flags (all verified in `apps/client/src/main.ts`)

| Flag | Effect |
|---|---|
| `?name=Bob` | auto-join as Bob (skips creator). With `look=<code>` is a test auto-join |
| `?look=<code>` | override stored look; ignored if invalid |
| `?region=meadow\|meadow_sunset\|caverns` | start region |
| `?tod=dawn\|day\|sunset\|night` | start time of day (also picks a matching region) |
| `?server=ws://host:port` | server URL (priority: `?server=` > `VITE_SERVER_URL` > dev default `ws://<host>:8080`) |
| `?lag=120&loss=5` | simulate latency (ms) and packet loss (%) |
| `?raf=timer` | drive the loop from `setTimeout` (headless/hidden panes where `requestAnimationFrame` is paused). Also honored by the site reel |
| `?pad=debug` | gamepad debug overlay |

Debug keys: `[` `]` cycle region, `,` `.` cycle time of day, F1 toggles the debug HUD, C opens the creator. Stored state: `localStorage` keys `sbh.name`, `sbh.look`, `sbh.controls`; a live `sessionStorage` token re-attaches the old session (so a stale name/look can persist during tests; use a fresh tab).

### Server env vars

| Var | Meaning |
|---|---|
| `PORT` | listen port (default 8080) |
| `SBH_LEVEL` | `LEVELS` key, for example `coopRoom`; unknown names throw at start |
| `SBH_WAITLIST_FILE` | override waitlist file; default `apps/server/data/waitlist.jsonl` (gitignored) |

---

## 4. Test strategy

`npm test` = Vitest, **17 files, 241 tests** (2026-10-04, about 14 s).

| Area | Files (count of `it`/`test`) | Covers |
|---|---|---|
| Sim | `packages/sim/test/{sim (28), m3 (31), coop (14)}.test.ts` plus `bots.ts` helper | movement, slopes, pads, stomp/push, crouch/one-way, spikes, checkpoints, shards, enemies, levers, plates, doors, Twin Plates co-op room |
| Protocol | `packages/protocol/test/world.test.ts` (4) | world delta/full encoding, `PROTOCOL_VERSION` is 3 |
| Server | `apps/server/test/{server (10), look (8), coop (6), waitlist (12)}.test.ts` | join/input/snapshot, look sync, rate limit, reconnect, co-op world sync, waitlist validation and storage |
| Art | `packages/art/test/{characters (9), world (16), objects (4)}.test.ts`, `packages/art/src/blender/manifest.test.ts (3)` | palette limits, connected-piece checks, atlas bounds, manifest vs files |
| Client (logic only, no DOM or GPU) | `apps/client/test/{input-bindings (15), input-gamepad (17), input-misc (12), motion (8), scene-logic (25)}.test.ts` + `fakepad.ts` | bindings, remap conflicts, gamepad normalization, animation state machine, door/lever/flag visuals |

**Not covered (know this):** rendering (`render.ts`, Pixi), the creator UI (`creator.ts`), HUD, `net.ts` client networking and reconciliation end-to-end, the site (`apps/site`, including the reel and waitlist form), `tools/docs-site`, any visual regression, any cross-browser or real-network test. Those are verified by `build:pages` + `linkcheck`, plus manual browser checks.

**Flaky-test note.** One Windows-only vitest worker crash (exit code `3221226505`) was observed once under heavy load; not reproduced in 4 reruns (`docs/NEXT_ACTION.md`). If it recurs: rerun once, then `npx vitest run --pool=forks` or `--no-file-parallelism` to isolate, and record it. Server tests open real WebSocket connections (`ws`); if they fail with `EADDRINUSE`, look for a stray process holding a port before suspecting code.

**Writing tests.** Put sim logic in `packages/sim/test`, using the helper bots. Anything you can test purely (no DOM) must have a unit test. For new levels see section 8. Test names should state the behavior, not the function.

**Test expectation drift.** A few tests hard-code facts (for example `expect(welcome.v).toBe(3)` in `apps/server/test/look.test.ts`, `PROTOCOL_VERSION` is 3 in `packages/protocol/test/world.test.ts`). When bumping those versions, update both.

---

## 5. CI

Two workflows in `.github/workflows/`.

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` "CI" | `pull_request`, and `push` to any branch except `main` | checkout, Node 24 with npm cache, `npm ci`, `npm run typecheck`, `npm test`, `npm run build:pages` (`VITE_BASE=/super-boundhaven/`), `npm run linkcheck`. `contents: read` only |
| `pages.yml` "Deploy site and docs to GitHub Pages" | `push` to `main`, `workflow_dispatch` | build job: `npm ci`, `npm test`, `npm run typecheck`, `npm run build:pages`, `npm run linkcheck`, `configure-pages`, `upload-pages-artifact` (path `apps/site/dist`); deploy job: `deploy-pages` into environment `github-pages`. Concurrency group `pages`, no cancel-in-progress |

Notes:
- The **prepublish audit is not in CI.** It must be run by a human or agent before every push to `main` (section 6). Consider adding it (see risks in the report).
- Blender is not available in CI; committed PNGs are the source of truth for the build.
- Check run status: `gh run list --limit 5` and `gh run view <id> --log-failed` (gh is authenticated for `baconspaceman`).

---

## 6. Release and deploy procedure (GitHub Pages)

There is no manual release artifact: **pushing to `main` deploys**. Pages URLs: site `https://baconspaceman.github.io/super-boundhaven/`, docs `/docs/`, prototype `/play/`.

Pre-flight (all must pass, from a clean checkout of the commit to be pushed):

1. `git status` clean of unintended files (no `apps/server/data/`, `.env*`, scratch `_*.png`, `tools/_x.mjs`-style temp files).
2. `npm ci && npm run typecheck && npm test`.
3. `npm run build:pages` then `npm run linkcheck` (use PowerShell; see shell notes).
4. **`npm run audit` must report `FAIL findings: 0`.** It scans tracked plus untracked-not-ignored files, and (unless `--no-history`) every commit for: secret/token/key patterns, `.env` files, files over 5 MB, personal e-mail addresses (author/committer identities must be GitHub no-reply), `apps/server/data/` ever added, `node_modules`/`dist` in history, ROM/ISO/archive extensions, absolute local Windows paths and keyword mentions. WARNs are reviewed, not ignored: last report had 0 FAIL and 13 WARN (keyword mentions such as `private key` in a type definition, `secret` in design docs; a Windows-path or email WARN needs a real look).
   - Running the audit rewrites the tracked `tools/audit/REPORT.md`. Include that updated report in the release commit or `git checkout -- tools/audit/REPORT.md` afterwards, but do not leave it half-updated.
   - Use `--no-history` only for quick iteration, never for the pre-push run.
5. Content review: public text, status labels and screenshots per `IMAGE_GUIDE.md` and `REVIEW_CHECKLISTS.md`.
6. Commit with author `baconspaceman <223162605+baconspaceman@users.noreply.github.com>` (verify `git config user.name` / `user.email`) and the required co-author trailer.
7. Push to a branch first and let `ci.yml` pass. Merge to `main` only when green (second-lead PRs: see checklist). Direct pushes to `main` by Anthony are fine.
8. After the deploy: open the three URLs, check the hero, `/play/` creator, `/docs/` search, the shots gallery, and the og image (`curl -I <site>/og.png` should be 200). `gh run list` shows the Pages job.
9. Record in `docs/NEXT_ACTION.md` (and the handoff files required by the workspace protocol) what shipped.

**Anything that publishes new kinds of content, posts, announces, changes repo visibility/settings, or changes licensing is a needs-Anthony action.**

### Rollback

`git revert <sha>` and push (preferred, auditable). Pages redeploys the previous good content. Never force-push `main` without Anthony.

---

## 7. Privacy hygiene and history rules

- **Never commit** `apps/server/data/` (waitlist emails; gitignored), `.env*`, tokens, `*.jsonl` waitlist exports, personal emails, local absolute paths (anything under a Windows user home folder), ROMs/ISOs/emulator files.
- Use the GitHub no-reply identity for all commits: `baconspaceman` / `223162605+baconspaceman@users.noreply.github.com`. Never Anthony's personal email, in files, commit messages or tags.
- **History.** The public repo has a single clean root lineage (commit count is small; the audit scanned 8 commits at last run). The **full private development history is a git bundle outside the repo** (`../sbh-private-history-2026-09-30.bundle`, relative to the repo, per `docs/NEXT_ACTION.md`). It contains old local paths and private-project mentions and is **never pushed or copied into the repo**. Do not run `git fetch` from it into this repo.
- Do not rewrite public history without Anthony. A rewrite of local-only unpublished commits (for author fix-ups) before the first push is fine.
- No analytics, trackers, third-party fonts or CDN scripts on the site or portal (stated promise in `README.md` and `NOTICE.md`); the waitlist form has no backend in the published build.
- Sanitize anything you paste into issues, docs or PRs: strip paths, hostnames and emails.
- Public docs must not name Anthony's other private projects.

---

## 8. Dependencies: how to update

Current direct deps: `@types/node`, `concurrently`, `marked`, `tsx`, `typescript`, `vitest` (root dev); `pixi.js` and `vite` (client); `ws` (server). Versions are caret ranges; `package-lock.json` is committed.

Procedure for a bump:

1. `npm outdated` and `npm audit` (0 vulnerabilities on 2026-10-04).
2. One dependency (or one tight family) per PR. Read the changelog; note breaking changes. Check license compatibility (MIT repo; do not introduce copyleft or non-commercial deps).
3. `npm install <pkg>@<version> -w <workspace>`; commit lockfile.
4. `npm run typecheck && npm test && npm run build:pages && npm run linkcheck`; run the client and a 2-tab session; check the creator and a gamepad flow if `pixi.js` or `vite` changed.
5. For `pixi.js`: verify nearest-neighbour scaling still holds (no smoothing), the pixel look is unchanged, and screenshots match.
6. For `typescript`: the repo is on a very new major (7.x); check the types package and `tsx` compatibility.
7. For `ws`/`vite`/`marked`: re-run `npm audit` and rebuild the docs portal; compare portal output visually.
8. Security fixes: `npm audit fix` only after reading what changes; never `--force` without review.
9. Never add a dependency that makes network requests at runtime or phones home.

---

## 9. The determinism rule for `packages/sim`

`@sbh/sim` is the single source of truth for movement and world state. It runs identically in the browser (prediction), the Node server (authority) and the site reel.

Rules:
- **No** `Math.random`, `Date.now`, `performance.now`, timers, I/O, `process`, DOM or Node APIs. (Verified 2026-10-04: no such calls in `packages/sim/src`.) Time is the integer tick; `TICK_RATE = 60`.
- Randomness, if ever needed, comes from a seeded PRNG in state.
- Iteration order must be deterministic (arrays, not `Set`/`Map` iteration where order matters; ids are assigned in reading order).
- Same inputs on the same state give the same outputs, bit for bit, on both ends. The sim uses plain JS doubles (not fixed-point); that is acceptable while client and server both run JS. If a non-JS runtime must share the sim, revisit (logged in `DECISIONS.md`).
- Any tuning change goes through `packages/sim/src/config.ts` (`MOVEMENT`, `RULES`); changing it changes feel, so re-tune site reel clips (`verifyClip`) and re-check the difficulty targets in `docs/design/DIFFICULTY_PHILOSOPHY.md`.
- Pure functions of `(level, state, input)` are predicted on the client; server-owned things (enemy stomps, levers, plates, doors) are not predicted.
- Add a test with a bot (`packages/sim/test/bots.ts`) for every new rule.

Mechanics design lives in [`docs/mechanics/`](../mechanics/); implement against it, do not invent rules in code.

---

## 10. Protocol versioning and migration

- `PROTOCOL_VERSION` (currently **3**) is in `packages/protocol/src/index.ts`. The server sends it in `welcome.v`.
- **Known gap:** the client does not compare `welcome.v` to its own version and no server rejects an old client. Until that is added, a protocol change is a **lockstep deploy** of client and server. Add a mismatch check when the first hosted server exists.
- Bump the version when you add/remove/rename a message or field, change a field's meaning, or change quantization/encoding.
- Changes that are strictly additive and optional (new optional field the old side ignores) may skip a bump but still need docs and tests.
- Wire format is JSON; max frame 1 KB (`ws` `maxPayload`; larger frames close the socket). Keep `PlayerState` growth in check: about 260 bytes per player per snapshot already.
- **Look codes** have their own versioning: `CharacterLook.v` (`1`) and a leading `1` in the encoded string. Adding options is safe while the bit width is unchanged; if a count crosses a power of two, `encodeLook` codes change, so bump `CharacterLook.v` per `look.ts` rules and keep the old decoder. Never change the meaning of an existing option index; append new ones.
- Migration steps: (1) update types in `packages/protocol/src`; (2) update `apps/server/src/server.ts`; (3) update `apps/client/src/net.ts`/`game.ts`; (4) update `docs/NETCODE.md` (version in the title, message tables); (5) update the version assertions in `packages/protocol/test/world.test.ts` and `apps/server/test/look.test.ts`; (6) verify with 2 clients including a reconnect with a stale `sessionStorage` token; (7) site reel if sim state shape changed.
- Server validates everything; it never throws on client data (look parsing returns canonical or falls back).

---

## 11. Step-by-step recipes

Always: read the mechanics and bible docs first ([`docs/mechanics/`](../mechanics/), [`docs/bible/`](../bible/)), keep a PROPOSAL labelled until Anthony accepts, and finish with the definition of done (section 14).

### 11.1 Add a level

1. **Sim.** Create `packages/sim/src/levels/<name>.ts` exporting a `Level` (tile rows with glyphs from the legend in `packages/sim/src/level.ts`: `.` empty, `#` solid, `B` bounce, `/ \` slopes, `-` one-way, `^` spike, `D` door; markers `S C o l p e z k` parsed into entity lists, ids in reading order). Level height is exactly 224 px (14 tiles) for the overworld; the co-op room is 16 tiles tall.
2. Register it in `packages/sim/src/levels/registry.ts` (`LEVELS[NAME.name]`).
3. **Tests.** Add `packages/sim/test/<name>.test.ts`: solvability with a bot (a clear path exists), checkpoint/respawn, any door link rules, and `room.maxPlayers`.
4. **Server.** `SBH_LEVEL=<name>` already works; no code change. Add a test in `apps/server/test` if it has dynamic state.
5. **Client.** The client uses `welcome.level` and `getLevel`. Pick the region/art via the existing region switch (`world-art.ts`). Strip `-`, `^` and `D` before `autotile()` (`autotile` treats every non-`.` glyph as ground; see `objectsScene` in `packages/art/scripts/build-world.ts`).
6. **Art.** If the level needs a new region, see 11.5. If not, only previews might change.
7. **Docs.** Add the level to `docs/design/` or `docs/mechanics/` as appropriate and to `docs/NETCODE.md` server options; update `README.md` status only if playable.
8. `npm test`, `npm run typecheck`, play it with 2 tabs.

### 11.2 Add an enemy

1. **Design** in the bible/mechanics docs: name, behavior, stompable?, hitbox, palette identity, silhouette (originality check, `IMAGE_GUIDE.md`).
2. **Sim.** Add a marker glyph (and `kind` number) in `packages/sim/src/level.ts` (`EnemyDef.kind`: 0 walker, 1 flyer, 2 spiky walker today); behavior in `packages/sim/src/entities.ts` (`stepWorld`); keep it deterministic and tick-based. Add tests (patrol, stomp, hurt, reset).
3. **Protocol.** Enemies ride in `snap.world.enemies: [id, x, y, flags][]`. A new kind needs no new field if it only changes `kind` (kind is level data); changing the tuple shape bumps `PROTOCOL_VERSION`.
4. **Art.** Add animations to `ENEMY_ANIMS` in `packages/art/src/characters/enemies.ts` plus palette entry in `ENEMY_PALETTES`; rebuild (`run-characters.ts`); review `characters_preview_creatures.png`.
5. **Client.** Map kind to sprite/anim in `apps/client/src/enemy-view.ts`.
6. **Docs/tests.** Update `docs/ART_DIRECTION.md` enemy list, mechanics docs; add art tests if they enumerate enemies.
7. Verify hitbox vs sprite size (a known issue: enemy hitbox 14 px vs bigger sprite).

### 11.3 Add an object (door, plate, lever, switch, hazard)

1. **Sim** glyph/marker in `level.ts`, state in `entities.ts`, link rules in `DoorLink`; tests (including multi-player and disconnect `away` rules).
2. **Protocol.** New dynamic state goes in `NetWorld` (`packages/protocol/src/world.ts`) as an optional delta field; bump version if the shape changes; `WorldEncoder.full/delta`.
3. **Art.** Add frames in `packages/art/src/world/objects.ts` for all three regions (accent hexes identical: gold/cyan/coral); update the `OBJECTS` anim table; rebuild with `run-world.ts`; check `world_objects_preview.png`.
4. **Client.** Draw in `apps/client/src/world-objects.ts` (frame names `obj/...`; fallback primitives exist); add logic helpers to `scene-logic.ts` with unit tests.
5. **Docs.** `docs/ART_OBJECTS.md` and mechanics doc.

### 11.4 Add a character option (hair, hat, top, etc.)

Per `docs/CHARACTER_CREATOR.md`: add art in `packages/art/src/characters/parts_*.ts`, add the name in `OPTION_NAMES` (`look.ts`); counts flow automatically. If a count crosses a power of two, `encodeLook` changes (bump `CharacterLook.v`, keep old decode). New animation: add to `HERO_ANIMS`, map in `motion.ts`. Run `run-characters.ts`, check `characters_preview_options.png`, update catalog counts in the docs. Tests: `packages/art/test/characters.test.ts`.

### 11.5 Add a region

1. Art: palette and tileset in `packages/art/src/world/` (`styles.ts`, `tileset.ts`, `tiles.ts`, `backgrounds.ts`, `props.ts`, `decor.ts`, `objects.ts`); tile ids must match the existing three tilesets exactly; 16 colors; a distinct mood color.
2. Register the region id in `RegionId`/`BgSet` types and the client region list (`apps/client/src/world-art.ts`), plus time-of-day mapping in `tod-art.ts` if applicable.
3. Rebuild with `run-world.ts`; review previews; run world/object tests.
4. Site: add real region data to `apps/site/src/content.ts` (`REAL_REGIONS`), copy new art to `apps/site/src/assets` (known gap; see `ASSET_PIPELINES.md`), update the viewer, alt text and chips (status label rules).
5. Docs: `docs/ART_WORLD.md` table, README status table.

### 11.6 Add a game option or setting (controls, accessibility, difficulty)

Client settings live in `localStorage` under `sbh.*` keys with a schema version (see `sbh.controls`, `docs/CONTROLS.md`); every access is wrapped in try/catch and the game must work when storage is blocked. Add UI in `controls-ui.ts`/pause menu with full keyboard and gamepad navigation (`ui-nav.ts`). If it affects the sim, it must be a shared config applied identically on client and server (not a client-only toggle) and tests updated. Update `docs/CONTROLS.md`.

### 11.7 Add a message or server feature

See section 10 (protocol), plus rate limiting (token bucket pattern in look handling), validation that never throws, max frame 1 KB, tests in `apps/server/test`.

---

## 12. Incident response

### Broken Pages deploy
1. `gh run list --workflow pages.yml --limit 5`, `gh run view <id> --log-failed`.
2. Reproduce locally: `npm ci`, `npm test`, `npm run typecheck`, `npm run build:pages`, `npm run linkcheck` (PowerShell).
3. Common causes: broken link or missing image (linkcheck output names the page), test failure on Linux, renamed asset the site imports (`import.meta.glob` assumes files exist; `assetUrl` throws `missing art asset`), wrong base path, Node version drift (CI pins 24).
4. If prod is broken and the fix is not quick: `git revert` the offending commit and push. Re-run via `workflow_dispatch` if needed.
5. Post a short note in the handoff.

### Leaked secret (token, key, email list, personal data)
1. **Treat as compromised immediately.** Do not paste the secret anywhere.
2. **Tell Anthony now** (needs-Anthony: accounts and irreversible). Rotate or revoke the secret at the provider first; rotation matters more than history purge.
3. Remove it from the working tree and push the fix (stops further spread but does not clean history).
4. History purge (only with Anthony's explicit go-ahead; it rewrites public history and force-pushes): create a fresh clone, `git filter-repo --path <file> --invert-paths` (or `--replace-text`), verify with `npm run audit` (history scan) and `git log --all -S<fragment>`, force-push to `main`, ask GitHub support to purge cached views/forks if needed, and re-check Pages. Note that clones and forks may already hold the old data.
5. If waitlist emails leaked: that is personal data; notify Anthony so he can decide on disclosure.
6. Add or tighten an audit pattern so it fails next time.

### Crashed or stuck game server
1. Reproduce with `npm run dev:server`; check the stack trace (the server must not throw on client data; every message path is validated).
2. Sessions are kept `graceMs` (10 s default) for token re-attach; a restart drops everyone (tokens are in-memory). Restart is safe; there is no persistence yet.
3. If a malformed message crashed it, add a regression test in `apps/server/test` that sends the exact bytes.
4. After sim changes, always restart the server (the long-running `tsx watch` may be stale if an agent edited the sim).
5. Port in use: another instance on 8080; find and stop it before restarting.

### Desync / "rubber banding" bug triage
1. Reproduce with `?lag=120&loss=5` and 2 tabs; enable the debug HUD (F1).
2. Decide whether the divergence is **prediction vs authority** (client mispredicts a server-owned thing: door, lever, enemy, other player's push) or a **real nondeterminism** (same inputs, different result).
3. For nondeterminism: record the input sequence from the client and replay it in `packages/sim` with a unit test against both a fresh sim and the server's; look for iteration-order, float-ordering, reliance on wall time, or state not included in `PlayerState`.
4. For prediction scope: remember prediction covers only own player vs static tiles plus `view.dynamic` doors; door timing can lag by about RTT (a small correction is normal; `SNAP_ERR_PX` governs snap vs smooth).
5. Add a failing test first, then fix. Update `docs/NETCODE.md` if the contract changes.

### Gamepad or controls bug
Reproduce with `?pad=debug`; remember browsers report different `mapping`; non-standard tables are in `gamepad.ts` (`normalizeLegacy`); add a case to `apps/client/test/input-gamepad.test.ts` using `fakepad.ts`.

### Art asset corrupted or wrong
`git log -- packages/art/assets/<file>` then restore or regenerate from source (assets are deterministic). Never hand-edit generated PNG/JSON.

---

## 13. Backup and recovery

- **Source of truth:** the public repo `github.com/baconspaceman/super-boundhaven` (clone it; `git clone --mirror` for a full backup).
- **Local working copy:** the folder where this repo is checked out (the path is deliberately not recorded in the public repo). It also contains **untracked or uncommitted work** at times; run `git status` before declaring anything safe.
- **Private full history:** `../sbh-private-history-2026-09-30.bundle` (outside the repo). Keep it backed up outside the repo; never push it or merge it.
- **Waitlist data:** `apps/server/data/waitlist.jsonl` exists only locally if a local server wrote it; it is gitignored and has no backup. Back up deliberately, privately, or delete; never commit.
- **Generated art is reproducible** from source (`packages/art`, `tools/blender`) with fixed seeds; committed PNGs are a convenience cache and the site's copy.
- **Recovery drill:** fresh clone, `npm ci`, `npm test`, `npm run build:pages`, `npm run linkcheck`. If this fails on a clean clone, something relies on untracked files; fix that first.
- Back up `~/.claude`, workspace handoff files (`shared-ai-space/`) and the `docs/NEXT_ACTION.md` handoff when finishing a session.

---

## 14. Definition of done (any change)

- [ ] Scope matches the task; no unrelated edits; nothing outside owned files without coordination.
- [ ] `npm run typecheck` and `npm test` pass (state counts); new behavior has tests.
- [ ] `npm run build:pages` and `npm run linkcheck` pass if docs, site, assets or links changed.
- [ ] Visual or netcode change verified in a real browser (2 tabs for multiplayer; `?raf=timer` in headless).
- [ ] Determinism intact for `packages/sim`; protocol version and docs updated when the wire changed.
- [ ] Art follows `IMAGE_GUIDE.md` and passes the north star; generated assets regenerated, not hand-edited; site copy updated (or gap flagged).
- [ ] Docs updated; status labels honest; no promises (dates, prices, rewards, monetization); proposals still labelled proposals.
- [ ] No secrets, personal emails, local paths, `apps/server/data/`; commit identity is the no-reply.
- [ ] `npm run audit` shows 0 FAIL if anything is going to be pushed to `main`.
- [ ] Handoff updated (`docs/NEXT_ACTION.md`, workspace handoff files per `CLAUDE.md` session-end protocol), including known issues you did not fix.
- [ ] Anything on the needs-Anthony list is parked, not decided.
