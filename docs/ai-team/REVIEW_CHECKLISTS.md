# Review Checklists

<!-- core:start -->
**How to use.** Copy the checklist that matches the change into the PR description or handoff note and tick each box honestly. An unticked box needs a written reason. If a change spans types (for example a new enemy touches sim, protocol, art, client and docs), use every relevant list.

**Always-on gates (every change).** `npm run typecheck` and `npm test` pass (quote the counts); no secrets, personal emails, local paths, `apps/server/data/` or scratch files; commit identity is `baconspaceman` with the GitHub no-reply email; public text has no dates, prices, rewards or monetization terms; status labels are honest (Playable prototype / Planned / Later / Concept); the change is original (no Nintendo or other third-party material); docs and handoff updated; known issues listed, not hidden.

**Lists below.** Art/asset PR; copy/public-text PR; gameplay/sim PR; netcode/protocol PR; client UI PR; docs PR; release/publish; "safe to merge?" for second-lead PRs; "needs Anthony" triggers.

**Needs Anthony (stop, do not decide).** Money (prices, monetization, Steam fees, paid services), accounts and credentials, any public post or announcement, legal (final title, trademark, privacy, ToS, DMCA, age band, moderation), license changes or third-party material, upgrading a PROPOSAL to confirmed, new named characters/currency, and anything irreversible (force-push, history rewrite, deletion, publishing the private history bundle, rotating published keys). Batch questions; keep working on unblocked tasks.

**Merge bar.** CI green (`ci.yml`: typecheck, tests, `build:pages`, `linkcheck`), a second pair of eyes for anything touching sim, protocol, licenses or public text, and `npm run audit` at 0 FAIL before anything reaches `main`.
<!-- core:end -->

Related: [`IMAGE_GUIDE.md`](IMAGE_GUIDE.md), [`ENGINEERING_RUNBOOK.md`](ENGINEERING_RUNBOOK.md), [`ASSET_PIPELINES.md`](ASSET_PIPELINES.md), [`CHARTER`](CHARTER.md), [`PROTOCOL`](PROTOCOL.md), [`WORKSTREAMS`](WORKSTREAMS.md), [`README`](README.md), [`docs/mechanics/`](../mechanics/), [`docs/bible/`](../bible/), [`docs/ROADMAP.md`](../ROADMAP.md).

---

## 0. Always-on checklist (paste into every PR)

```
- [ ] npm run typecheck passes
- [ ] npm test passes (counts: __ files / __ tests)
- [ ] If docs/site/assets/links changed: npm run build:pages && npm run linkcheck pass (PowerShell)
- [ ] No secrets / tokens / personal emails / C:\Users paths / apps/server/data / scratch files (_*.png, tools/_x.mjs)
- [ ] Commit author is baconspaceman <223162605+baconspaceman@users.noreply.github.com>
- [ ] No dates, prices, reward amounts, monetization terms, raid-size promises in public text
- [ ] Labels honest: Playable prototype / Planned / Later / Concept; PROPOSAL stays PROPOSAL
- [ ] Original work only; no Nintendo/third-party material; provenance noted if new asset class
- [ ] Docs updated; handoff (docs/NEXT_ACTION.md) updated; known issues listed
- [ ] Nothing here is on the "needs Anthony" list (or it is parked and flagged)
```

---

## 1. Art / asset PR

```
Scope
- [ ] Source changed in packages/art/src or tools/blender (not hand-edited PNG/JSON)
- [ ] Generated outputs rebuilt and committed with the source (run-world / run-characters / build:art / build:blender)
- [ ] git diff --stat of assets shows only expected files (no non-determinism churn)
- [ ] No scratch outputs committed (_gallery.png, _zoom.png, _quick.png, tools/blender/_work)

North star (docs/ART_NORTH_STAR.md)
- [ ] Bold, cheerful, instantly readable; silhouette unmistakable at 256x224
- [ ] Chunky shapes, no noise, no stray pixels, no anti-aliasing, no gradients
- [ ] Dark hue-matched outline (not pure black); deepest ink #2b2350; sel-out respected
- [ ] Flat 3-tone shading, light top-left, warm highlights / cool shadows, ramps hue-shifted
- [ ] <=15 colors + transparent per sprite layer; tilesets exactly 16 colors
- [ ] Characters humanoid, 24x32, stout (2-3 heads), no cubes; eyes bold 2x3
- [ ] 16x16 tile grid; tile ids identical across meadow / meadow_sunset / caverns
- [ ] Dithering only in sky/haze bands; none on characters or tiles
- [ ] Playfield higher contrast than background; solid things look solid, decoration soft and solid:false
- [ ] Interaction colors: gold = needs action, cyan = done/powered, coral = lever/hazard
- [ ] One pixel scale everywhere; integer scaling only; no blurry upscales

Off-brand scan
- [ ] No muddy face (eye/brow/mouth readable at 1x)
- [ ] No glossy 3D look, no specular gradients
- [ ] No low-contrast hazard or interaction prop (spikes, levers, flags, gates)
- [ ] No background louder than the playfield; caverns not unreadably dark
- [ ] Checked on all regions and times of day affected (meadow, meadow_sunset, caverns, dawn/day/sunset/night)

Originality / IP
- [ ] Silhouette test passed (does not read as an existing character/enemy/object)
- [ ] Signature-element test passed (no red cap + mustache, green saddled dino, eyes-on-hills, ? block, shell/mushroom enemy, green pipe plant)
- [ ] Reverse-check done and recorded (searched description + palette; no near match)
- [ ] No third-party inputs: no downloaded models, textures, HDRIs, brushes, reference images, music, mocap
- [ ] Names (creatures, items, regions) checked for conflicts; no final character/currency names invented
- [ ] Provenance line added (PLACEMENT_AND_PROVENANCE.md or PR text): tool, seed, date, checks done
- [ ] AI-generated imagery NOT used as final art (any exception approved by Anthony)

License
- [ ] New content lives under a path covered by LICENSE-ASSETS.md (CC BY-NC-SA 4.0); new top-level folder added to the list
- [ ] No license text changed (that is Anthony's call)

Verification
- [ ] Previews opened at 1x and 3x and judged (characters_preview*, world_preview*, world_objects_*, blender/preview_*)
- [ ] python tools/blender/check.py passes (if Blender art)
- [ ] Client run with ?region=/?tod=; co-op room checked if objects changed
- [ ] Site assets re-synced (apps/site/src/assets) or "known gap: not synced" stated
- [ ] Screenshots / og.png refresh decision recorded (see IMAGE_GUIDE (g))
```

---

## 2. Copy / public-text PR (site, README, docs portal copy, patch notes, social drafts)

```
Voice
- [ ] Plain, warm, honest; short sentences; verbs first; no hype words (revolutionary, ultimate, AAA, next-gen, best)
- [ ] No emoji; sentence-case headings; no exclamation chains
- [ ] Says what exists today; "early prototype" is stated where claims appear
- [ ] Inspirations mentioned only as "inspiration and craft reference"; no "like Mario" comparisons or smears

Promises
- [ ] No launch dates, seasons, "coming soon"
- [ ] No prices, "free forever", Steam fee targets, funding goals
- [ ] No reward amounts (1,000 downloads gift, million-player reward), drop rates, giveaways
- [ ] No monetization terms; no loot boxes or real-money gambling mechanics mentioned as features
- [ ] No claim of a hosted server (none exists; Pages build is offline prototype)
- [ ] Raid size/co-op size stated only as design intent

Accuracy and labels
- [ ] Every feature has an honest label (Playable prototype / Planned / Later / Concept / confirmed-direction chip)
- [ ] README status table, site chips, GDD tags and DECISIONS.md agree
- [ ] Numbers (tests, options, regions) re-verified or removed
- [ ] Alt text on every image; contrast and focus not broken (site)
- [ ] No "Bacon" / "Spaceman" branding; "Super" kept; "working title" language intact

Names and legal
- [ ] No final-title / trademark claim; unaffiliated language intact (NOTICE.md)
- [ ] No privacy, ToS, moderation or DMCA statement invented (needs Anthony)
- [ ] License statements unchanged and consistent (MIT code, CC BY-NC-SA 4.0 art/content/docs; name/logo reserved)

Posting
- [ ] Social/announcement text is a DRAFT file only; Anthony approves and posts
- [ ] Screenshots used come from the procedure in IMAGE_GUIDE (f): 768x672, no debug HUD, no real names
- [ ] build:pages + linkcheck pass
```

---

## 3. Gameplay / sim PR (`packages/sim`, mechanics)

```
- [ ] Implements a mechanics doc (docs/mechanics/) or an accepted decision; PROPOSAL work is labelled proposal
- [ ] Deterministic: no Math.random, Date, performance.now, timers, I/O, DOM/Node APIs; iteration order stable
- [ ] Time measured in ticks (60 Hz); constants in config.ts; no magic numbers in logic
- [ ] Pure function of (level, state, input) where it must be predicted client-side
- [ ] New rule has unit tests with bots (packages/sim/test); edge cases: edges of level, simultaneous players, disconnect (away), reset
- [ ] Feel changes (MOVEMENT / RULES) re-checked by playing: jump arcs, coyote time, jump buffer, slopes, pads, stomp
- [ ] Difficulty measured against docs/design/DIFFICULTY_PHILOSOPHY.md; mounts never made hard to obtain
- [ ] No hard-lock: required gates have a loaner/alternate route; instant retry, checkpoints
- [ ] Server-owned vs predicted split documented (enemy stomps, levers, plates, doors are server-only)
- [ ] Protocol impact assessed (see section 4)
- [ ] Site reel clips still pass verifyClip (apps/site/src/clips.ts); watch the reel
- [ ] Level changes: solvability bot test, glyph legend in level.ts respected, registered in registry.ts
- [ ] Anything about economy, gear power, trading, monetization stays design-only (needs Anthony)
```

---

## 4. Netcode / protocol PR

```
- [ ] PROTOCOL_VERSION bumped if any message/field added, removed, renamed, or its meaning/encoding changed
- [ ] Version assertions updated (packages/protocol/test/world.test.ts, apps/server/test/look.test.ts)
- [ ] docs/NETCODE.md updated (title version, message tables, bandwidth numbers if changed)
- [ ] Server validates all new input; never throws on client data; frames <= 1 KB (ws maxPayload)
- [ ] Rate limiting / token buckets for any client-triggered broadcast
- [ ] Delta + full-frame self-healing preserved (full on join/re-attach, every 20th, reset)
- [ ] Reconnect path tested (token re-attach, stale sessionStorage, grace period 10 s, away flag)
- [ ] Prediction scope unchanged or deliberately extended and documented; reconciliation tested
- [ ] Tested with ?lag=120&loss=5 and 2+ tabs; no rubber-banding regressions
- [ ] Lockstep deploy noted (client does not check welcome.v today; known gap)
- [ ] Look codes: CharacterLook.v / encodeLook stable, old codes still decode
- [ ] Bandwidth cost estimated for 8-player room (design target) and noted
- [ ] No personal data added to any message; no free-text chat (quick-chat only is the interim default)
- [ ] Site reel and client both still compile and run against the changed types
```

---

## 5. Client UI PR (`apps/client`: creator, HUD, menus, controls, rendering)

```
- [ ] Works with keyboard AND gamepad (focus order, A/B/Start, bumpers/triggers per docs/CONTROLS.md); no mouse-only paths
- [ ] Remap/settings stored under sbh.* localStorage keys with versioned schema; all storage in try/catch; works if storage blocked
- [ ] Accessible: roles/aria on dialogs, tablists, steppers, radiogroups; visible focus; text contrast
- [ ] Pixel look preserved: nearest-neighbour, integer scaling, pixel font, no smoothing, no soft shadows
- [ ] UI colors from the token set; gold/cyan/coral semantics respected
- [ ] No debug text left on by default (F1 HUD toggles); ?pad=debug only on request
- [ ] No third-party requests, fonts or analytics added
- [ ] Prompt/tag overlaps checked (known: ACTION prompt vs name tag)
- [ ] Verified in a real browser at 768x672 and a larger window; also with ?raf=timer for headless
- [ ] Unit tests added for any pure logic (motion, scene-logic, bindings)
- [ ] docs/CONTROLS.md and docs/CHARACTER_CREATOR.md updated when behavior changed
- [ ] Screenshots refreshed if the visible UI changed (IMAGE_GUIDE (f))
```

---

## 6. Docs PR

```
- [ ] Facts verified against the code/tree (paths exist, commands run, numbers current)
- [ ] Proposals tagged [PROPOSAL]/[OPEN]; only Anthony's words or acceptance make [CONFIRMED]
- [ ] DECISIONS.md changed only for Anthony-accepted items (date, rationale, status)
- [ ] OPEN_QUESTIONS.md / owner-only queue not "resolved" by delegation without logging
- [ ] No promises (dates, prices, rewards, monetization)
- [ ] Links relative and valid; npm run build:docs / build:pages and npm run linkcheck pass
- [ ] New top-level doc added to docs/PUBLIC_DOCS_INDEX.md and README doc table if public
- [ ] ai-team docs keep their "core" marker block at 150-400 words and self-contained (the AI-bundle tool concatenates them; never write the literal marker comments in body text)
- [ ] No local paths, private project names, emails in public docs
- [ ] Stale statements fixed on sight (for example docs/NEXT_ACTION.md "License: none chosen" is outdated)
```

---

## 7. Release / publish checklist

```
Pre-flight (clean checkout of the exact commit)
- [ ] git status clean; no apps/server/data, .env*, scratch files
- [ ] npm ci
- [ ] npm run typecheck
- [ ] npm test   (record: __ files / __ tests)
- [ ] npm run build:pages   (PowerShell; base /super-boundhaven/)
- [ ] npm run linkcheck
- [ ] npm run audit   -> FAIL findings: 0 (WARNs reviewed; any path/email WARN investigated)
- [ ] tools/audit/REPORT.md regenerated and consistent (commit it or revert it deliberately)
- [ ] npm audit (dependencies) reviewed
- [ ] Commit identity = no-reply; no personal email anywhere in history (audit history scan passed)
- [ ] Private history bundle NOT referenced, copied or pushed

Content
- [ ] Image guide (IMAGE_GUIDE) public-face sync done: site vs README vs DECISIONS vs GDD
- [ ] Screenshots + og.png current (or consciously deferred)
- [ ] Site assets re-synced from packages/art/assets
- [ ] Status labels honest; no promises; no hosted-server claim
- [ ] Licenses and NOTICE unchanged (or Anthony approved the change)

Ship
- [ ] Pushed to a branch; ci.yml green
- [ ] Merged to main (Anthony's push or approved merge); pages.yml green
- [ ] Verified live: site, /play/ (creator), /docs/ (search, art page), shots gallery, og image (200)
- [ ] docs/NEXT_ACTION.md + handoff files updated with what shipped
- [ ] Any announcement is a DRAFT for Anthony (not posted)

Rollback ready
- [ ] Know the last good SHA; git revert plan (never force-push main without Anthony)
```

---

## 8. "Safe to merge?" for second-lead PRs

For PRs authored by another AI (Codex, Grokbot, Kimi, a Claude session) acting as a second lead. The reviewer is a *different* agent from the author. Score each item Yes/No; any "No" blocks.

```
Provenance of the change
- [ ] Author states scope, files touched, and what was NOT touched
- [ ] Only files in the author's workstream (docs/ai-team/WORKSTREAMS.md) were edited, or overlap was coordinated
- [ ] No edits to protected files without Anthony: LICENSE*, NOTICE.md, DECISIONS.md "accepted" entries, ART_NORTH_STAR.md, .github/workflows/*, tools/audit/prepublish.mjs, package.json deps (unless that is the task)

Evidence
- [ ] Reviewer re-ran npm run typecheck and npm test locally (not trusting the author's output)
- [ ] CI green on the PR
- [ ] For visual/net changes, reviewer opened it in a browser
- [ ] The diff was read, not just the summary (generated assets spot-checked, not rubber-stamped)

Safety
- [ ] No secrets, tokens, personal emails, local paths, waitlist data, ROMs/third-party assets
- [ ] No new network calls, trackers, third-party fonts/scripts
- [ ] No new dependencies, or dependency review done (license, audit, size)
- [ ] No history rewrite, force-push, branch deletion
- [ ] No change that publishes, posts, or changes repo/Pages settings

Consistency
- [ ] Determinism, protocol-version, and docs rules respected (sections 3-4)
- [ ] Art and copy checklists (1-2) completed if applicable
- [ ] No upgrade of PROPOSAL to confirmed; no new promises

Decision
- [ ] SAFE: merge; or CHANGES REQUESTED with exact items; or NEEDS ANTHONY with the question and a recommendation
```

Reviewer rules: do not merge your own PR; do not approve what you cannot verify; if CI cannot cover it (rendering, feel, netcode), someone must run it. Merge strategy: squash or merge with a clean message and the correct co-author trailer; never rewrite shared history. Contributions from outside parties are **not accepted yet** (`CONTRIBUTING.md`).

---

## 9. "Needs Anthony" triggers

Stop. Write a short note: `NEEDS ANTHONY: <what>. Options: A / B. Recommendation: X. Blocked: <work>.` Continue unblocked work. Anthony asked not to be nagged until everything is done, so batch these.

| Trigger | Examples |
|---|---|
| **Money** | prices, monetization, supporter tiers, funding goals, Steam fees, paying for tools/hosting/domains, spending API credits at scale |
| **Accounts and credentials** | creating or linking accounts, login providers, GitHub org/repo/Pages settings, OAuth grants, API keys/tokens (never paste them), social accounts, domains |
| **Public posts** | any social post, announcement, release note on an external platform, community messages, replies in Anthony's name, enabling public discussions |
| **Legal** | final title and trademark clearance, privacy policy, terms of service, age band, chat posture, DMCA/takedown, moderation policy, anything about someone else's IP |
| **License** | any LICENSE/NOTICE/LICENSE-ASSETS change, relicensing, adding third-party code/assets, accepting external contributions, CC BY-NC-SA vs monetization question |
| **Design truth** | turning PROPOSAL/OPEN into CONFIRMED, changing the art north star, new mounts (no wolf), final character/currency names, casino/cat-lore mechanics beyond "no real-money gambling, non-cashable tokens, no loot boxes", reward promises |
| **Irreversible** | force-push, history rewrite/purge, deleting branches/tags/releases/repo, rotating a published key, deleting data, publishing or moving the private history bundle, making private things public |
| **Conflict** | two owner statements disagree, or a rule here disagrees with `DECISIONS.md`: quote both and wait |
| **Personal data** | waitlist emails, user data, anything that could identify a person, any retention/export decision |
| **Scope shock** | a change that would shift the Milestone plan, the stack (engine/hosting), or the human-led principle |

If a task seems to require a trigger above, the safe default is to **do the drafting/prep work, label it a draft, and park the action**.
