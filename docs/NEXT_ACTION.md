# SBH: next action / autonomous continuation file

Updated: 2026-09-30. Any session (including the scheduled task) starts HERE, then `docs/ART_NORTH_STAR.md`, `DECISIONS.md` (accepted decisions log), and `docs/design/GAME_DESIGN_DOCUMENT.md` once it exists. Claude acts as head of development and delegates to sub-agents with disjoint file ownership. Update this file before ending any session.

## Standing rules

- Anthony's intent: long-term passion project; no feature too big, no addition too small. Keep extensible; keep `DECISIONS.md` and provenance current.
- Look: Super Mario World essence (bold, chunky, cheerful, stout humanoids, dark outlines, flat shading) with 100% original designs. No cubes. Judge art against `docs/ART_NORTH_STAR.md`.
- Originals only. Never copy Nintendo/other designs. No promises about launch dates, prices, reward amounts, raid sizes, monetization terms. No real-money gambling. No "Bacon"/"Spaceman" game branding. Don't import the other projects' rules.
- Never commit secrets. `apps/server/data/` (waitlist emails) must never be committed or published.
- Verify before claiming done: `npx vitest run`, `npx tsc --noEmit -p tsconfig.json`, and a real browser check for visual changes. Report failures honestly.
- Commit with author `baconspaceman` and the noreply email (not a personal email) and the Claude Co-Authored-By trailer.
- Shell: Windows; use PowerShell 7 syntax or Git Bash. Blender 5.1: `C:\Program Files\Blender Foundation\Blender 5.1\blender.exe` (headless). Python 3.11 with Pillow/numpy: `C:\Program Files\Python311\python.exe`.

## State at last update

Done and committed: shared deterministic sim (`packages/sim`, slopes/pads/stomp/push, 23 tests), protocol, authoritative ws server + waitlist HTTP endpoint (21 tests), PixiJS client with prediction/reconciliation/interpolation (verified live with 2 clients), marketing site `apps/site` (gameplay reel replays the real sim), decisions/open-questions/mounts docs, art north star.

In flight when this was written (check `git status` and each folder; agents may have finished or been cut off, so re-inspect and continue gaps):
1. Character art (`packages/art/src/characters`): layered humanoid paper-doll creator data (`CharacterLook`, options, compose), enemies, 4 mounts (frog, dinosaur, flying dinosaur, cheetah), effects, pixel font.
2. World art (`packages/art/src/world`): meadow + caverns tilesets, autotile, props, parallax backgrounds.
3. Blender pipeline (`tools/blender`, `packages/art/assets/blender`): time-of-day backgrounds (dawn/day/sunset/night) and pre-rendered props.
4. Research DONE: recommendation E+ (hand-authored final, Blender as helper) adopted as working plan; see DECISIONS.md. Owner questions pending.
5. Master GDD (`docs/design/`): unified design doc incl. skill tree/abilities/mounts/gear, consistency audit, decision queue.

## PUBLISHED (2026-09-30)

Public repo: https://github.com/baconspaceman/super-boundhaven (single clean root commit; author uses the GitHub no-reply email). Pages: https://baconspaceman.github.io/super-boundhaven/ (site), `/docs/` (docs portal), `/play/` (client; creator works offline, no hosted game server yet). `git push` to `main` auto-deploys via `.github/workflows/pages.yml` (runs tests first). The pre-publish audit (`node tools/audit/prepublish.mjs`) must show 0 FAIL before every push. The full private development history lives OUTSIDE the repo in `../sbh-private-history-2026-09-30.bundle` (contains old local paths and private-project mentions; never push it). License: none chosen, so all rights reserved; ask Anthony if he wants an open-source license.
The project is ongoing and open-ended: keep iterating on the roadmap below; republish after meaningful milestones.

## Decisions Anthony made on 2026-10-01 (UTC rollover; late 9/30 PT) — see DECISIONS.md

No wolf mount; challenging-but-fair, mounts easy to obtain; crouch + action buttons yes; skill points AND mastery-by-use with free respecs; raid size 8; front-facing creator faces to be tried; no third-party assets; rest of the 15-question queue delegated to Claude; open-source license applied (MIT code, CC BY-NC-SA 4.0 art/content/docs; name/logo reserved) and pushed. Controller support required (XInput/Xbox + other pads) for Anthony and all players.
In flight (agents): (1) docs/decisions alignment, (2) Milestone 3 sim layer: crouch/action inputs, checkpoints, enemies, pickups, switches/doors, 'Twin Plates' co-op room, protocol v3, (3) controller support in apps/client (gamepad layer, remap UI, glyphs, rumble, pad-debug overlay).
TODO after they land: client integration of M3 entities/crouch/action rendering with the existing art (enemies, shards, doors, plates, checkpoint flags, HUD), hero face front view in creator, restart server on 8080 after sim changes, re-run audit, push; real-controller test by Anthony via `?pad=debug`.

## Milestone 3 status (2026-10-01)

Done and committed: crouch/action inputs, one-way platforms, spikes, checkpoints, shards, enemies, levers, plates, doors, 'Twin Plates' co-op room (`SBH_LEVEL=coopRoom` for the server), protocol v3, controller support, gameplay-object art, client integration with HUD/prompts/enemy sprites. 241 tests pass.
Known issues / next polish: no dedicated hero crouch frame (uses land squash), lever art low contrast, idle flag too grey, ACTION prompt overlaps name tag, enemy hitbox 14px vs bigger sprite, spikes read too white, open-gate frame abstract; stomp kills not predicted (50 ms hitch). One-off Windows vitest worker crash (exit 3221226505) seen once under heavy load; not reproducible in 4 reruns — re-check if it recurs.
Next milestones: front-facing hero face/portrait in creator, 8-player raid prototype room, mount prototype (frog) as proposal-labelled, hosting research for online play, real-controller test by Anthony via `?pad=debug`.

## Waiting on Anthony (do NOT ask until he says everything is done)

Anthony said (2026-09-30): he will provide these once everything is completely done, so keep building and do not nag: monetization model/prices/supporter terms/community-goal promises; early-player and download rewards and launch dates; casino mechanics beyond no-real-money-gambling; login provider, privacy, age band, chat posture (default stays quick-chat only); moderation policy and terms of service for uploaded levels; final title + legal clearance; character and currency names; whether to keep CC BY-NC-SA art once monetization is approved. Work around them with placeholders and the delegated defaults in DECISIONS.md.

## Progress log (2026-09-30, later)

Committed: world art (meadow / meadow_sunset / caverns) rendered in the client with region switcher; layered humanoid character system + enemies + 4 mounts + effects + font (packages/art/src/characters); Blender time-of-day backgrounds (dawn/day/sunset/night, 9 layers each) and 20 pre-rendered props (packages/art/assets/blender, manifest in packages/art/src/blender); Blender-to-2D research (hand-authored layers remain the final look); master GDD.
In flight: character creator + look netcode + SpritePlayerView (agent a70f136ae7ea1a924 owns protocol/server/client); world-art fixes (autotile thickness under walls, pad landing squash, `./world` subpath export).
TODO next: hook Blender time-of-day scenes into the client (`?tod=dawn|day|sunset|night`, blender props), use enemies/effects/mounts from packages/art in client (mount gameplay is a later proposal-only milestone), refresh the site with real art and GDD audit fixes (three overpromising spots), clean stale docs (README/OPEN_QUESTIONS/CLAUDE_HANDOFF say no implementation), then pre-publish audit + public GitHub.

## Remaining plan (in order)

1. **Review** each agent's output myself (open preview PNGs, run tests/typecheck); send revision rounds until it passes the north star. Commit per area.
2. **Integrate art into the game client** (`apps/client`): tilesets + autotile, parallax backgrounds (time-of-day selectable), props, animated humanoid players with the new art, name font; keep sim hitbox rules; add animation state from sim state (idle/walk/run/skid/jump/fall/land/stomp).
3. **Character creator screen** on the join page: live animated preview, randomize, save look in localStorage; extend `packages/protocol` (join carries `encodeLook` string; snapshots/players carry look) and `apps/server` (validate via `validateLook`, relay to peers); tests.
4. **Swap the site** (`apps/site`) to the real art (hero, regions, reel) and update copy to match the GDD consistency audit.
5. **Align docs** with the GDD decision queue; update `DECISIONS.md` only with Anthony-accepted items.
6. **Mount prototype** (frog first) per `docs/design/MOUNTS_AND_EXPLORATION.md` only after steps 1-3 and only as a proposal-labelled prototype unless Anthony accepted the mechanics.
7. **DONE (see PUBLISHED above) — public GitHub presence (Anthony authorized on 2026-09-30: "make me a GitHub page for all of this, detailed out with everything, for me to always have it. Open the GitHub page to the public also.")** Do this only when steps 1-5 are done and tests pass:
   - Pre-publish audit: no secrets/tokens/.env files, no waitlist data, no personal email in files or git history (rewrite local unpublished history to the noreply author if needed), no ROMs/third-party copyrighted assets, license statement for assets/code (ask Anthony which license if not recorded; default to "all rights reserved" notice + no license file until he chooses), art provenance note, remove inert placeholder claims.
   - Create a public repo under `baconspaceman` named `super-boundhaven` with `gh`, push, enable GitHub Pages (GitHub Actions workflow building `apps/site` + a docs portal page listing GDD, decisions, art gallery/previews, roadmap, tech docs, prototype screenshots/GIFs). Pages must not promise dates/prices/rewards and must label proposals vs confirmed.
   - Report the public URLs to Anthony.

## Continuation protocol (usage limits)

Anthony wants work to keep going whenever usage comes back. A scheduled task (`sbh-autonomous-continue`) (fires at 4:12 PM, 9:12 PM, 2:12 AM, 7:12 AM, 12:12 PM local, just after Anthon's usage reset at 4:10 PM and each 5-hour window) starts fresh sessions that read this file and continue the next unfinished step. Each run: inspect state, pick the next unfinished step, delegate/do it, verify, commit, update this file, then stop. When every step above is done (including the public GitHub step), disable the scheduled task and tell Anthony.

## 2026-10-06 update (cloud session)

Done: action prompt moved above the name tag; enemy hitbox now 16x16 (was 12x14); `raidRoom` ("Eight Gates", 8-player prototype, proposal-labelled, see `docs/design/RAID_ROOM.md`) with sim + server tests (248 tests pass).
Still open polish: dedicated hero crouch frame, lever/flag/spike/open-gate art contrast, stomp-kill prediction (50 ms hitch). Next: real 8-person playtest, front-facing creator face, frog mount proposal, hosting research, real-controller test (`?pad=debug`).

## 2026-10-06 (later): ground pound + big buttons

Done: DOWN-in-air ground pound, 2-tile big buttons lit for 3 s, `buttons` door links (all lit at once), `poundRoom` "Slam Dunk", protocol v4, art (button, pound poses), regenerated `world_objects_*` atlases (this also ships the earlier lever/flag/spike/open-gate art). See `docs/design/GROUND_POUND.md`. Open: buttons in the raid room, rumble on slam, real-player tuning of the 3 s window.
