<!-- core:start -->
**P1 Polish and the small shared region (M1 sign-off, M2 exit, M3 polish).** Goal: turn the working prototype into something Anthony can sign off on feel and legibility, and prove coherent shared motion under bad networks. Scope: fix the known M3 art/UX issues (no hero crouch frame, low-contrast lever, grey idle flag, ACTION prompt overlapping the name tag, 14 px enemy hitbox vs larger sprite, spikes too white, abstract open-gate frame), predict stomp kills client-side (50 ms hitch today), front-facing hero face in the creator, a latency/jitter/loss test envelope with reconnect behaviour, a feel-tuning doc, and bringing docs and the public site in line with the code. Entry: P0 done (it is). Exit: Anthony playtest sign-off on feel (including a real-controller test via `?pad=debug`), automated envelope tests green at agreed latencies, no known legibility issue left open, README/site/GDD status matches code. Dependencies: none upstream; unblocks P2 and P4. Risks: feel is subjective (needs Anthony's hands); prediction changes can regress determinism. Leads: Claude (art, feel, client), Codex (envelope tests, flaky-test triage), Grokbot (bots drive the envelope). Size: M overall.
<!-- core:end -->

# P1 Polish and small shared region

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-010 | Hero crouch frame (currently reuses land squash) | Next | Claude | S | Distinct crouch frame for all creator looks; art test covers it; viewed in browser |
| RM-011 | Legibility pass: lever contrast, idle flag colour, spikes not-white, open-gate frame readable | Next | Claude | S | Before/after screenshots against `docs/ART_NORTH_STAR.md`; no new palette violations |
| RM-012 | ACTION prompt must not overlap name tag | Next | Claude | S | Layout test in `scene-logic`/`action-prompt`; screenshot at 2 zoom levels |
| RM-013 | Enemy hitbox (14 px) vs sprite size mismatch decision and fix | Next | Claude | S | Either sprite or hitbox changed; sim tests updated; stomp feel unchanged or better |
| RM-014 | Client prediction of stomp kills (removes ~50 ms hitch) | Next | Codex (design review Claude) | M | Predicted kill reconciles cleanly on a server veto; motion tests incl. mispredict case |
| RM-015 | Front-facing hero face/portrait in creator (Anthony: "we'll see how that looks") | Next | Claude | M | Preview shows front/three-quarter face; side-view face unchanged in gameplay; Anthony visual verdict recorded |
| RM-016 | Real-controller test by Anthony (`?pad=debug`) | Next | Anthony | S | Verdict logged in handoff; remap fixes filed if any |
| RM-017 | M2 test envelope: latency/jitter/loss matrix, reconnect with token, N clients coherent motion | Next | Codex + Grokbot | M | Scripted runs at defined RTT/loss grid; no state corruption; report committed |
| RM-018 | Triage the one-off Windows vitest worker crash (exit 3221226505) | Next | Codex | S | Reproduced or closed with notes; if recurs, pin `pool`/threads option |
| RM-019 | Truth sync of README status table, site roadmap chips, DESIGN_BRIEF, NEXT_ACTION header (see contradictions list in the PM report and `ROADMAP.md` section 2) | Next | Claude | S | All status claims match code; `npm run linkcheck` and `npm run audit` clean |
| RM-020 | Feel tuning doc and Anthony playtest sign-off for M1 | Next | Claude | S | `docs/` tuning note lists every constant in `packages/sim/src/config.ts` with intent |
| RM-021 | Small shared region content: a real, authored level in meadow (not just the playground) | Later | Claude | M | Level in `packages/sim/src/levels/`, registered, solvable, art-complete, ghost-run test |

Exit checklist: RM-010..013, 015 shipped; RM-014 shipped or consciously deferred in `DECISIONS.md`; RM-016/017/020 evidence recorded; RM-019 done.
