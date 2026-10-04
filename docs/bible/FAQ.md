<!-- core:start -->
# FAQ for contributors and AI collaborators

Quick authoritative answers to the questions people and AIs ask most. Each answer names who decides. "Anthony" is the owner and final authority. "Lead" is Claude (head of development, maintainer of canon). "Second leads" are Codex and Grokbot, who propose and review. This file never overrides `DECISIONS.md`.

Fastest rules of thumb. Everything must be original; no third-party sprites, music, code or mocap; other games are only craft inspiration. No wolf mount. Raids are eight players, co-op rooms two to four. Mounts are easy to get and never sold. No paid power, no real-money gambling, no loot boxes. Never promise dates, prices or rewards. Keep "Super" in the name; no Bacon or Spaceman branding. The base moveset must make required content possible. Hard content is optional. Label every claim CONFIRMED, ACCEPTED-DELEGATED, PROPOSAL or OPEN. Money, legal, safety and public-promise questions always go to Anthony. Public posting on behalf of the project needs Anthony's approval. When unsure, write a labelled proposal and ask.

Where to look next: `CANON_REGISTER.md` for facts, `CHANGE_PROTOCOL.md` for the on-canon checklist, `SYSTEMS_STATUS.md` for what is built.
<!-- core:end -->

# Content and canon

**1. Can I add a wolf mount?**
No. Anthony confirmed the roster is exactly frog, dinosaur, flying dinosaur and cheetah; no wolf is planned. More animals may come later, but any new mount starts as a labelled proposal approved by Anthony (`CHARACTERS_AND_CREATURES.md` section 8.3). *Decides:* Anthony.

**2. Can I add a fifth mount (for example a turtle or a bat)?**
Only as a PROPOSAL with role, ability, gate use, fairness (loaner or alternate), friendly acquisition, original art and silhouette. Do not implement before approval. *Decides:* Anthony.

**3. Can I use this sprite pack, tileset or sound pack I found?**
No. Everything must be original; no third-party assets, even free ones, unless Anthony explicitly approves and the license is compatible (the current decision is strictly original). Record provenance for anything accepted. *Decides:* Anthony.

**4. Can I use AI-generated art, music or code?**
Code and docs: yes, as a verified AI collaborator, reviewed and tested (the project is built this way). Art and audio: only original work with recorded provenance; AI-generated assets of unclear license are not allowed without Anthony's approval. *Decides:* Anthony.

**5. Can I post this (screenshots, clips, docs) to social media?**
Sharing is welcome under the license: docs and art are CC BY-NC-SA 4.0 (share with attribution, non-commercial, share alike); code is MIT. Do not use the name or logo for derivative products or imply endorsement. Posting as the official project voice needs Anthony's approval. Use real footage, no fake trailers, no dates, prices or promises (`TONE_AND_VOICE.md`). *Decides:* Anthony for official posts.

**6. Can I reference Super Mario World (or Yoshi, Mario, Terraria, MapleStory)?**
Only as craft or feel inspiration in docs and conversation. Never copy characters, tiles, enemies, music, levels or signature motifs; avoid clone-adjacent designs (no red-capped plumber, no green saddle dinosaur, no eyes-on-hills, no question-block lookalike). Pop-culture cosmetics are subtle shape-language nods only, with rights review. *Decides:* Anthony (and the lead for reviews).

**7. Can I rename the game or drop "Super"?**
No. The name is "Super BoundHaven"; Anthony wants "Super" kept; it is provisional pending legal clearance. No Bacon or Spaceman branding. *Decides:* Anthony.

**8. Can I name the currency, the dog boss or the cat foremen?**
You may propose names in a labelled list (candidates are in `LORE_BIBLE.md`), but do not decide them. Use `<CURRENCY>` and `<DOG_BOSS>` placeholders. *Decides:* Anthony.

**9. Can I make the raid 6 players, or 10, or scalable?**
No. Raids are exactly eight (cap eight, no scaling down). Co-op rooms are two to four; dungeons three to five (delegated). *Decides:* Anthony.

**10. Can I make the game use lives or game-over screens?**
No. Failure is instant retry, checkpoints, no lives, no punitive loss. *Decides:* Anthony (delegated principle).

**11. Can mounts be sold, or gated behind raids or brutal content?**
No. Mounts are free, permanent, never sold, never in the skill tree, never behind raids or brutal content, and earned through friendly questlines. *Decides:* Anthony (confirmed principle).

**12. Can I add a paid power-up, pay-to-skip, or paid stats?**
No. No paid power. Monetization terms are undecided and are Anthony's alone. *Decides:* Anthony.

**13. Can I add a gacha, loot box or slot machine?**
No. No real-money gambling, no loot boxes, no paid randomness. The casino uses non-cashable tokens that are never bought with real money. *Decides:* Anthony.

**14. What does the "no real-money gambling" rule cover?**
Anything where real money (or items convertible to it) is wagered on a chance outcome. Skill-based mini-games with non-cashable, non-purchasable tokens are the only casino mechanic proposed, and even those need Anthony's approval. *Decides:* Anthony.

**15. Can I add pricing, a Patreon, supporter tiers or a funding goal to the site?**
No. Monetization, prices, supporter terms, funding targets and community-goal promises are undecided and private strategy. The site says exactly that. *Decides:* Anthony.

**16. Can I promise a launch date, a beta, or a giveaway (for example for the first 1,000 downloads)?**
No. No dates, prices, reward amounts or giveaways are ever promised. The brief's hypothetical milestones are not public. *Decides:* Anthony.

# Design and balance

**17. Can I change the movement numbers (jump height, run speed)?**
Tuning belongs in `packages/sim/src/config.ts` and the mechanics docs, with tests and a playtest. Coyote time and jump buffer are shared base feel. Final feel is Anthony's after playtest. Do not make movement stats purchasable. *Decides:* Anthony for feel; lead for implementation.

**18. Can I add a double jump, wall jump or dash to the base moveset?**
Not without a proposal. The base moveset is six inputs and a fixed list; extra moves are traits, mount abilities, powerups or gear and must pass the Movement Budget and ruleset checks. A base-move addition needs Anthony. *Decides:* Anthony.

**19. Can I add a new input button?**
No. Six inputs are confirmed. Extra functions use ACTION context or abilities. *Decides:* Anthony.

**20. Can I make solo players able to finish co-op rooms?**
No. Co-op must genuinely require coordination. Required counts leave a spare for disconnects but never allow a solo clear. *Decides:* Anthony (confirmed).

**21. Can a skill-tree node or gear make a required route trivial?**
No. Required routes are base-clearable; gear and nodes ease optional content and add alternate routes, bounded by the Movement Budget. *Decides:* Anthony (confirmed principle).

**22. Can I add a skill-point shop or sell respecs?**
No. Respecs are free and instant; points are never sold or traded. *Decides:* Anthony (confirmed).

**23. Can I add a new powerup?**
Yes as a proposal: name, effect, duration or charges, counterplay, fairness note per ruleset, art idea, and no clone-adjacent mechanics (no mushroom, cape flight, invincibility star, fire flower, tongue-eats-enemy). *Decides:* Anthony.

**24. Can I add a new region?**
Yes as a proposal using the checklist in `WORLD_BIBLE.md` section 5. Fourteen themes are confirmed; more can be proposed. *Decides:* Anthony.

**25. Can I add a new enemy?**
Yes as a proposal (silhouette, color identity, behavior, stompable or not, defeat frames). Selective enemies are the direction: challenge comes mostly from level design. *Decides:* Anthony.

**26. Can I make an enemy or boss follow a three-hit pattern?**
No. Puzzle bosses are the confirmed direction, not repetitive three-hit patterns. *Decides:* Anthony.

**27. Can I add a difficulty setting or easy mode?**
Not as a separate mode. Use assist options (off by default, labelled Assisted, excluded from ranked boards). The hardest content stays optional. *Decides:* Anthony (delegated).

**28. Can I add a pursuer or mirror variant to a level?**
Yes with a base-route proof for each variant and the combination matrix in `PROGRESSION_AND_CONTENT.md`. Never combine a pursuer with raid sync bosses. *Decides:* lead plus Anthony for new combinations.

**29. Can I add trading or a market?**
Direct atomic trade first, market later. Do not add real-money trading. *Decides:* Anthony (delegated sequence); anything with money needs Anthony.

# Art, audio and writing

**30. Can I use cubes, voxels or blocky characters?**
No. Characters are stout layered humanoids. No cubes or blocks as characters. *Decides:* Anthony (confirmed).

**31. Can I switch the art to a realistic, painterly or glossy pre-rendered look?**
No. The look is SMW-essence flat, chunky and cheerful with dark hue-matched outlines. Blender is a helper that must imitate hand-pixeled output. *Decides:* Anthony.

**32. Can I change the pixel scale or resolution?**
No. 256x224 native with integer scaling, 16x16 tiles; one pixel scale everywhere. *Decides:* Anthony.

**33. Can I add a new creator option (hat, hair, accessory)?**
Yes; see `CHARACTERS_AND_CREATURES.md` section 8.1. Mind the look-code bit width and bump the version if it changes. Keep it original. *Decides:* lead (small additions), Anthony (identity-defining ones).

**34. Can I add music or sound effects?**
Only original, with provenance, following `AUDIO_DIRECTION.md`. No audio exists yet. *Decides:* Anthony.

**35. Can I write NPC dialogue or lore?**
Yes as proposals following `TONE_AND_VOICE.md` and `LORE_BIBLE.md`; label PROPOSAL; keep it optional and cheerful. *Decides:* lead (small), Anthony (canon).

**36. What tone must public text have?**
Cheerful, bold, welcoming, never smug, honest about status. See `TONE_AND_VOICE.md`. *Decides:* lead.

# Engineering and process

**37. Can I change the tech stack (new engine, Godot, Unity, Rust server)?**
No. The stack is accepted: TypeScript, Vite and PixiJS, Node and `ws`, a shared deterministic sim. Revisit the number representation only if a non-JS runtime must share the sim. *Decides:* Anthony.

**38. Can I add third-party analytics, trackers, ads or external fonts?**
No. The sites make no third-party requests. Playtest telemetry must be local and consented. *Decides:* Anthony.

**39. Can I commit credentials, waitlist data or private business info?**
Never. `apps/server/data/` must never be committed or published; run `npm run audit` before pushing. Revenue strategy is private and not part of public docs. *Decides:* Anthony.

**40. Can I accept an outside pull request?**
Not yet; code contributions are not being accepted. Feedback via issues is welcome. *Decides:* Anthony.

**41. Can I commit or push to the repository?**
Follow your team agreement in `../ai-team/`; only the lead normally commits; authorship uses the project's no-reply identity; run tests, typecheck and the audit first. Do not push without the lead's go-ahead. *Decides:* lead.

**42. Who may change canon?**
Only Anthony or the lead, and only with a dated entry. Second leads propose via PR or issue. See `CHANGE_PROTOCOL.md`. *Decides:* Anthony and lead.

**43. How do I mark things in docs?**
Tag every claim [CONFIRMED], [ACCEPTED-DELEGATED], [PROPOSAL] or [OPEN]. Never promote a proposal to canon yourself. *Decides:* lead.

**44. What should I do when two docs disagree?**
Follow the precedence in `README.md` (decisions log, then this bible, then detail docs, then the site), record the conflict in `CANON_REGISTER.md` section 6, and propose the fix. *Decides:* lead.

**45. What should I do when I am unsure whether something is allowed?**
Run the checklist in `CHANGE_PROTOCOL.md`; if any answer is unclear, write a labelled proposal and ask Anthony through the lead. Never decide money, legal, safety or public-promise items. *Decides:* Anthony.

**46. Is mobile or touch support planned?**
Not a launch target (keyboard first, then gamepad). *Decides:* Anthony.

**47. Is the game finished? Can people play it online?**
No. It is a pre-alpha prototype; there is no hosted game server. Run it locally (see the README). *Decides:* n/a (fact).

**48. How big can a party or room be?**
Server `MAX_PLAYERS` is 16 per server in the prototype; co-op rooms are 2 to 4; raids exactly 8. Channel caps per region come from M2 tests. *Decides:* engineering measurement; Anthony for design intent.

**49. Where do exact numbers (speeds, caps, timers) live?**
In the sim (`packages/sim/src/config.ts`) and `../mechanics/`. The bible does not duplicate them. *Decides:* lead.

**50. Where do I record a decision Anthony just made?**
`DECISIONS.md` with date, rationale and status; then update the canon register and bump the bible version. *Decides:* lead.
