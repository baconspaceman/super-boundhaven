# Super BoundHaven: difficulty philosophy

Status 2026-09-30. Tags: **[CONFIRMED]** = Anthony's own words; **[ACCEPTED-DELEGATED]** = Claude's design, delegated by Anthony, revisable any time. Targets below are internal design goals, not public promises.

## 1. The owner statement **[CONFIRMED]**

Anthony: "I want things to be challenging, but when it's too challenging, don't make it too difficult." Specifically, **getting mounts must not be too difficult.**

Reading: challenge is the point of the game (pillar P1, "movement is the skill"), but there is a ceiling on friction. When a piece of content is hard, the answer is to make the *hardest* part optional, or to add an assist, never to make everyone pay for it.

## 2. Pillars

| # | Pillar | Tag |
|---|---|---|
| D1 | **Challenging but fair.** Every failure should be readable: the player can say what they did wrong. No invisible requirements, no unreadable hazards. | CONFIRMED |
| D2 | **Mounts are approachable.** A mount is obtainable with moderate effort by an average player: a short, friendly, non-punishing questline per mount. No brutal gates, never behind raids, never sold, never in the skill tree. | CONFIRMED |
| D3 | **The hardest content is optional.** Raids, Kaizo-style trials, hard bonus challenges and mastery chases live in optional and endgame tiers. The required path stays clearable by an average player. | ACCEPTED-DELEGATED |
| D4 | **Retry is cheap.** Instant retry, short rewind distance, no punitive loss, no lives. | ACCEPTED-DELEGATED |
| D5 | **Assists exist, honestly labelled.** Optional assist settings let more players finish; they never hide inside leaderboards. | ACCEPTED-DELEGATED |
| D6 | **Skill ceiling stays high.** Easing never removes the top end: optional hard variants and Classic boards keep the ceiling. | CONFIRMED (brief, P1) |
| D7 | **Gear and mounts ease, never replace.** Required routes stay base-clearable; mounts have loaner or alternate routes (gate rule G1). | CONFIRMED (brief) |

## 3. Content tiers and target completion rates **[ACCEPTED-DELEGATED]**

"Average player" = median of playtesters who play platformers occasionally, not experts. Rates are over players who *attempt* the content, after finishing earlier tiers, within the stated window.

| Tier | Content | Target | Notes |
|---|---|---|---|
| T0 Onboarding | First hour: grassland moves, first pit, first wall | at least 95% clear in the first session; median 3 or fewer attempts per obstacle | Teaches base moveset |
| T1 Required path | Critical-path levels and gates | at least 90% clear within 2 sessions; median 5 or fewer attempts per checkpoint segment | Always base-clearable; loaner/alternate present |
| T2 Mount questlines | Getting each of the four mounts | at least 90% finish within about 45 minutes of active play; median 3 or fewer attempts per segment; no single segment above 10 median attempts | Friendly, solo-doable, no timers harsher than the base moveset, no consumables or trades needed |
| T3 Optional bonus | Secrets, optional rooms, mount cosmetic/bonus challenges | 50 to 70% eventually; effort welcome | Clearly marked optional on the map legend (G6) |
| T4 Hard optional | Hard trials, co-op dungeons (3 to 5) | 20 to 40% of those who try, within a week | Required team size, base-clearable as a team |
| T5 Raids / Kaizo | 8-player raids, hardest trials | 1 to 10% of those who try; no floor | Optional and endgame; no content or mount gated behind them |

Alarm thresholds: if T0 to T2 completion falls below target by more than 5 points, or a segment's median attempts exceed 2x target, the segment is a defect and gets retuned or gets an assist, before shipping.

## 4. Mount acquisition difficulty rules **[CONFIRMED principle, ACCEPTED-DELEGATED design]**

1. One short questline per mount in its home region (about 3 stages, about 15 to 45 minutes total).
2. Solo-doable by an average player with the base moveset only; no raid, no co-op requirement, no grinding, no purchase, no trade.
3. Checkpoint before every stage and between obstacles; instant retry.
4. Clear hints from the questgiver and map; "stuck" nudges (see section 6).
5. Hard optional extras per mount (bonus time trial, alternate coat colors, a title) are cosmetic or recognition-only and clearly optional.
6. A required mount gate on the critical path always has a loaner or an alternate route, so a player who has not yet earned the mount is never blocked.
7. Frog arrives early (starter region), matching the confirmed frog gate.

## 5. Assist options **[ACCEPTED-DELEGATED]**

All assists are off by default, toggled in settings, and **mark the run "Assisted"**; assisted runs are excluded from Classic and Standard leaderboards but fully count for progression, mounts and story.

| Assist | Effect |
|---|---|
| Extra checkpoints | Denser checkpoint spacing on required levels |
| Wider forgiveness | Optional extra coyote/buffer frames beyond the shared base (base values stay for everyone on ranked boards) |
| Slower threats | Pursuer and timed hazards run 15 to 30% slower (not in raids or events) |
| Telegraph boost | Larger/longer hazard warnings and landing shadow (the Ledge Sense readout) |
| Practice mode | Replay a segment in a loop with ghost and slow-motion |
| Guided hints | Opt-in hints after repeated failure; stuck detection offers the nearest solution (Pathfinder's Promise behaviour) |
| Skip-after-N-fails | Optional prompt after about 10 failed attempts on a mount-questline or required segment: offer a simplified variant (extra platform, longer window), never a free skip of raid content |

Assist options are never sold and never required. They do not change physics in multiplayer rooms for other players; in co-op each player's assist applies only to personal conveniences (hints, checkpoints), not shared sync windows.

## 6. Checkpoint philosophy **[ACCEPTED-DELEGATED]**

- A failure should cost about 30 seconds or less of replay on required content (about 60 seconds in hard optional content).
- Checkpoint before each distinct challenge and after each mount-questline stage; never mid-air or in a doomed state.
- Retry is instant (target under 1 second to control).
- No lives, no currency loss, no item loss on failure.
- Raids and dungeons checkpoint by segment; a wipe returns to the start of the segment; disconnect rules in GDD 7.4.
- Rare long levels may offer a one-use "second wind" checkpoint beside tough rooms.

## 7. How "challenging but not too difficult" is measured **[ACCEPTED-DELEGATED]**

Metrics per level/segment: attempts to clear (median, p90), time to clear, clear rate by skill band, quit-after-failure rate, "stuck" button presses, assist adoption, and replay/return rate. Prototype telemetry is local and consented; no per-player tracking beyond consent.

Playtest protocol:
1. Recruit 6 to 10 testers per round across three skill bands: novice, average, expert (at least 2 per band).
2. Give no hints beyond in-game ones; observe the first 30 minutes, then solo session notes.
3. Record the metrics above for each tier; compare against the section 3 targets.
4. Post-session questions (1 to 5 scales): "was it fair?", "did it feel too hard?", "did you want to quit?", "did you understand why you failed?"
5. Decision rule: below target on T0 to T2 means retune before moving on (add checkpoint, shorten, add hint, add assist); T3 to T5 may fail targets without shipping defects, but must be clearly optional.
6. Re-run after each retune; track results in `docs/research/` or a playtest log file.

Mount questlines have a dedicated gate: no mount ships until at least 9 of 10 average-band testers finish it without help inside the T2 window.

## 8. Relationship to other docs

- Pillars P2 and P8 in GDD section 1.2; failure and checkpoints in GDD 8.5 and 7.4; mount acquisition in `MOUNTS_AND_EXPLORATION.md` and GDD 5.3; skill-model fairness in `SKILL_TREE_AND_ABILITIES.md`.
- Anything here may be revised by Anthony at any time.
