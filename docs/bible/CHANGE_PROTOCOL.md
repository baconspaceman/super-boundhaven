<!-- core:start -->
# Change protocol, versioning and the on-canon checklist

**Who changes canon.** Only Anthony (owner) or the lead (Claude, head of development) may change canon, and only with a dated entry. Canon means the CONFIRMED and ACCEPTED-DELEGATED rows in the canon register. Second leads (Codex, Grokbot) and contributors propose changes through a pull request or issue that uses the proposal template below; they never edit canon directly and never promote a proposal to canon. Money, legal exposure, real-world risk and public promises are decided by Anthony alone, never by delegation.

**How a change flows.** Propose (labelled PROPOSAL, with rationale, fairness and canon-conflict check) then review (lead, with second-lead review) then Anthony accepts, rejects or delegates, then the lead records the decision in `DECISIONS.md` (date, decision, rationale, status), updates `CANON_REGISTER.md` and any affected bible file and `SYSTEMS_STATUS.md`, and bumps the bible version with a changelog entry. The accepted-decisions log remains the authority; the bible follows it.

**Versioning.** The bible uses `bible vMAJOR.MINOR`. Major changes when a confirmed fact changes or the structure changes; minor changes for accepted additions, clarified wording, new proposals or status updates. Every bible file shares the version. The changelog at the end of this file is the only place that lists history.

**On-canon checklist.** Before adding or accepting anything, answer: Is it original? Does it respect the never-contradict list? Is every claim tagged? Does it keep required content base-clearable and mounts easy? Is it free of real-money gambling, paid power, dates, prices and promises? Does it fit tone, art, accessibility and audio rules? Is it extensible and phased? If any answer is "no" or unclear, it is off-canon until Anthony decides.

**Core blocks.** Every file starts with a 150 to 400 word `core` block; a bundle tool concatenates these for small-context AIs. Keep core blocks current in the same change as the body.
<!-- core:end -->

# 1. Roles

| Role | Who | Powers |
|---|---|---|
| **Owner** | Anthony (`baconspaceman`) | Final decision on every design, money, legal, safety and public-promise item; accepts or rejects proposals; may delegate |
| **Lead** | Claude (head of development) | Maintains the bible and `DECISIONS.md`; applies accepted changes; adopts documented recommendations when Anthony delegates; coordinates agents with disjoint file ownership |
| **Second leads** | Codex, Grokbot | Review, propose, implement assigned work; may flag canon conflicts; do not edit canon directly |
| **Contributors** | Humans and other AIs | Propose through issues; code contributions are not being accepted yet (`../../CONTRIBUTING.md`) |

Working agreements between AIs live in `../ai-team/`.

# 2. Tag semantics

| Tag | Meaning | Who may assign it |
|---|---|---|
| **[CONFIRMED]** | Anthony's own words or answers, with source and date | Lead, only citing Anthony's words |
| **[ACCEPTED-DELEGATED]** | Anthony said "I'll let you decide"; the lead adopted a documented recommendation; binding, revisable any time | Lead, recording the delegation |
| **[PROPOSAL]** | A suggestion awaiting Anthony | Anyone |
| **[OPEN]** | Unresolved; needs an answer | Anyone |
| **Built tags** | Implemented / Prototype / Art only / Planned / Not started / Proposal in `SYSTEMS_STATUS.md` | Whoever changes the code, verified by the lead |

Rule: never upgrade a tag without a source. A proposal accepted by silence is still a proposal.

# 3. Proposal template (PR or issue)

```
Title: [PROPOSAL] <short name>
Area: world | lore | characters | mounts | systems | audio | UX | process | other
Summary (2-3 sentences):
Why (which pillar or player need):
Details (numbers only if mechanics-level; link to ../mechanics/):
Fairness and base-moveset check:
Originality check (no third-party assets, no clone-adjacent design):
Canon conflict check (cite N-rules and D-rows):
Phasing (smallest useful slice, proof, exit test):
Art / audio / tone / accessibility notes:
Docs to update if accepted:
Open questions for Anthony:
Tags used for each claim:
```

# 4. Who decides what

| Change type | Decider | Process |
|---|---|---|
| Typos, links, formatting | Any contributor via the lead | Direct edit by the lead or approved PR |
| Status updates reflecting code (Built, Planned) | Lead | Update `SYSTEMS_STATUS.md` in the same change as the code |
| New proposals (powerup, region, creature, lore, audio idea) | Anyone proposes; Anthony accepts | Proposal template; lead records |
| Small canon additions (a new hat, hair style, a secret, a sound) | Lead, if it passes the checklist and conflicts with nothing | Dated note in the changelog |
| Canon changes (a confirmed fact, a delegated decision) | Anthony or the lead (with Anthony's awareness) | Dated entry in `DECISIONS.md`; register and bible updated; version bump |
| Anything involving money, legal, safety, privacy, moderation, public promises, titles, rights | Anthony only | Lead presents options and recommendation; wait for Anthony |
| License or branding changes | Anthony only | Dated entry; update `LICENSE*`, `NOTICE.md`, site footer |
| Pop-culture cosmetic nods | Anthony, after a rights review | Provenance entry |
| Tech stack changes | Anthony | Dated entry |

# 5. Is this on-canon? Checklist

Answer each question; one "no" or "unclear" means the item is not canon yet.

**Originality and legal**
- [ ] Original: no third-party assets, sprites, music, code, ROMs or mocap?
- [ ] No clone-adjacent design (no red-capped plumber, green saddle dinosaur, eyes-on-hills, question-block lookalike, mushroom or shell enemies, mushroom or cape or star or fire-flower powerups)?
- [ ] Other games only as craft inspiration, never as claims or assets?
- [ ] Name is "Super BoundHaven"; no Bacon or Spaceman; no names from Anthony's other projects?
- [ ] License terms respected (MIT code; CC BY-NC-SA 4.0 art, music, content and docs; name and logo reserved)?

**Fairness and design**
- [ ] Required content stays clearable with the base moveset (as a team for co-op)?
- [ ] No paid power; no real-money gambling; no loot boxes; no paid randomness?
- [ ] Mounts stay easy to get, free, permanent and never sold; roster unchanged (no wolf)?
- [ ] Raids are exactly eight; co-op rooms are two to four; six inputs?
- [ ] Failure is instant retry with checkpoints and no lives?
- [ ] Hardest content is optional; assists are honest and unsold?
- [ ] Movement bonuses stay inside the Movement Budget and ruleset masks?
- [ ] Gates have alternate or loaner routes and are telegraphed?

**Look, tone and access**
- [ ] SMW-essence look, original, no cubes, one pixel scale, dark hue-matched outlines?
- [ ] Voice is cheerful, bold, welcoming, never smug; plain language?
- [ ] Not color-only, not sound-only, not timing-only; keyboard and gamepad parity?

**Honesty and scope**
- [ ] No dates, prices, reward amounts, launch promises or hype?
- [ ] Status labels correct (Built / Planned / Proposal)?
- [ ] Extensible and phased with a smallest slice and an exit test?
- [ ] Every claim tagged; sources named?

**Safety and privacy**
- [ ] No secrets, waitlist data, private business info or personal data committed?
- [ ] Chat and safety posture respects the quick-chat default?

# 6. Updating the bible

1. Make the smallest correct edit in the right file; keep the file's core block current.
2. If a canon fact changes, update `CANON_REGISTER.md` (move rows between tables with date and source) and `DECISIONS.md`.
3. If a system's implementation status changes, update `SYSTEMS_STATUS.md` in the same change as the code.
4. Keep terminology consistent with `GLOSSARY.md`; add new terms there.
5. Cross-check links (`npm run linkcheck` builds the docs portal and verifies links).
6. Add a changelog entry (below) and bump the version.
7. For inconsistencies between documents, add them to `CANON_REGISTER.md` section 6, propose the fix and tag the owning agent.

Other agents own other doc trees (`../mechanics/`, `../ROADMAP.md`, `../ai-team/`). Link to them; do not duplicate or edit them from the bible.

# 7. Review cadence

* After every milestone: refresh `SYSTEMS_STATUS.md`, the first-hour and ladder tables in `PROGRESSION_AND_CONTENT.md`, and the "built today" notes in the core blocks.
* After every Anthony answer batch: update the registers and the open items list.
* Before any public announcement: check tone, honesty and the never-contradict list.

# 8. Changelog

| Version | Change |
|---|---|
| **bible v1.0** | Initial Design Bible. Consolidated the brief, decisions log, GDD and detail docs, art and control docs, netcode, creator, site copy and code facts into thirteen linked files. Added the canon register with a never-contradict list and nineteen documented inconsistencies, the world and lore bibles (lore and audio labelled PROPOSAL), characters and creatures, tone and voice, UX and accessibility, progression and content ladder, systems status table, glossary, FAQ and this protocol. No canon was changed. |
