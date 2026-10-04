<!-- core:start -->
# Tone, voice and copywriting guide

All in-game and public text (UI, tutorials, errors, toasts, patch notes, social posts, docs, store copy) shares one voice: **cheerful, bold, welcoming, never smug, and honest.** It sounds like a friendly player who loves precise platforming and wants you to have fun. It is bright and quick, with a little quirky humor (the cat staff are the model), never sarcastic about players, never grim, never hype.

**Rules.** Plain language, short sentences, active voice, concrete verbs (jump, bounce, ride, find). Say what exists today and what is planned; never promise dates, prices, rewards, raid rewards or monetization; never call something "final" or "launching". Label unbuilt things Planned, Later or Proposal. Failure is never blamed on the player: say what happened and what to do next. Errors are calm and fixable. Celebrate small wins. Co-op language is "together", "team", "bounce"; never "carry" as a compliment to one player. No shaming, no FOMO, no pressure to pay, no gambling language.

**Words to prefer.** bounce, bound, haven, together, shard, ride, explore, secret, retry, try again, nice, welcome, friend, coil. **Words to avoid.** grind (as a promise), noob, git gud, easy (as an insult), trash, scrub, "pay to skip", "limited time" pressure, "exclusive", "OP", real-money terms in lore, trademarked names of other games in player-facing text, "MMO killer", "revolutionary", "next-gen".

**Accessibility and localization.** Reading level around grade 6 to 8 for UI. One idea per line. Never rely on color or sound alone to convey meaning. Keep strings short, avoid idioms and puns that do not translate, avoid concatenated sentence fragments, leave room for 40 percent text growth, and keep all strings in one catalog when localization begins.

**Copy status.** The public site, README and docs already follow this voice; examples below are proposals for surfaces that do not exist yet.
<!-- core:end -->

# 1. Voice attributes

| Attribute | Means | Does not mean |
|---|---|---|
| Cheerful | Warm, bright, quick to celebrate | Constant exclamation points |
| Bold | Clear and confident statements | Boasting or superlatives |
| Welcoming | Newcomer-first; "you can do this" | Condescension |
| Never smug | We admit what is unfinished | Insider jokes that exclude |
| Honest | Plain status; Planned means planned | Hedging everything |
| Playful | Small quirks, cat-style asides | Memes that age badly, edgy humor |
| Inclusive | Gender-neutral, culturally neutral | Stereotypes |
| Precise | Names the action or control exactly | Vague "interact" language |

Anchor sentences from existing public copy (keep this register): "Bounce together. Master every jump." / "We would rather show you the real thing than fake one." / "Early and rough: a shared movement playground and a character creator. No launch date yet." / "Some walls need a friend."

# 2. Style rules

## 2.1 Mechanics of writing

* Sentence case in UI. Title Case only for proper names (Super BoundHaven, Sunny Grassland).
* Use the project name "Super BoundHaven" in full on first mention, "SBH" in dev or docs only. Never "Super Boundhaven" with lowercase h in public copy (the code and some docs use it in places; fix when touched).
* Numbers: digits for controls and counts, words for small numbers in prose. Use "eight players" for raids.
* No emoji in the game's official voice. (Chat and community channels are different; official posts use them rarely.)
* Avoid exclamation marks except for genuine celebration; at most one per message.
* Buttons are verbs: Play, Apply, Resume, Retry, Copy look code.
* Do not use "please" in every message; use it where something is asked of the player.
* Keyboard and gamepad references use the glyph or the player's own binding (the controller-aware token builders), never hard-coded "A button".

## 2.2 Honesty rules (hard)

1. Never state a date, price, reward amount, drop rate, giveaway or "coming soon" countdown. Allowed: "Planned", "Later", "being designed", "no date yet".
2. Never imply features exist that do not (see `SYSTEMS_STATUS.md`).
3. Never promise monetization terms. "Pricing and monetization have not been decided" is the approved answer.
4. Never imply real-money gambling. The casino is "a fictional story beat for a much later update".
5. Never claim affiliation with or endorsement by any other game or company.
6. Credits and attribution follow CC BY-NC-SA terms for shared assets.

## 2.3 Words

| Prefer | Avoid |
|---|---|
| bounce, bound, hop, leap | "jump scare", "yeet" |
| together, team, friends | "carry", "boost me" as shaming |
| try again, retry | "you failed", "game over" (no lives exist) |
| find, discover, uncover | "farm", "grind" |
| mount, ride | "pet", "summon beast" |
| shard | "gem" when you mean Bound Shard (gem is allowed for decor) |
| optional | "easy mode" for assists |
| assist options | "cheats" |
| challenge | "punish" (in marketing) |
| creator, builder | "modder" (unless meant) |
| planned, later, proposal | "coming soon", "launching", "soon" |

# 3. Microcopy examples [PROPOSAL unless an existing string is cited]

Existing strings in the prototype are cited with their source. Others are suggested wording.

## 3.1 Join and creator

| Surface | Copy |
|---|---|
| Creator title (existing) | "Create your hero" / "Change your look" |
| Name placeholder (existing) | "Your name" |
| Buttons (existing) | Play / Apply / Cancel |
| Randomize | "Shuffle look" (site) or "Randomize" (creator, existing) |
| Look code field | "Look code: paste to load, copy to share" |
| Name too long | "Names can be up to 16 characters." |
| Look code invalid | "That look code didn't work. Check it and try again." |
| Join screen subtitle | "Pick a look and a name, then jump in." |
| First-visit hint | "New here? Move with the arrow keys or A and D. Hold Space to jump higher." |
| Controls hint (existing mechanic) | Show the player's current bindings with glyphs |

## 3.2 In-game status, toasts and prompts

| Surface | Copy |
|---|---|
| Controller connected (existing) | "Controller connected: Xbox Controller" |
| Controller disconnected (existing) | "Controller disconnected: Xbox Controller" |
| Action prompt (existing mechanic) | "[glyph] Pull" over a lever (never "Press X to interact" in a literal key name) |
| Co-op room needs players (existing) | "NEEDS 2 PLAYERS" (pixel font). Friendlier alternative: "Wait for a friend" |
| Checkpoint | "Checkpoint!" |
| Shard collected | "+1 shard" |
| Hurt | No text; flash and respawn (no shaming) |
| Ledge-gate hint | "This door needs two players on the plates." |
| Mount unlocked | "Frog unlocked! Press [ACTION] to ride." |
| Secret found | "Secret found!" with a small sparkle |
| Server full (existing error: "server full") | "This room is full right now. Try again in a moment." |
| Reconnecting (existing banner: "Disconnected - reconnecting...") | "Lost connection. Reconnecting..." |
| Rate limited look change (existing: "look changes rate limited") | "Easy there! Try changing your look again in a second." |
| Bad look (existing: "bad look") | "That look isn't valid, so we kept your old one." |

## 3.3 Errors (pattern)

Pattern: **what happened + what it means + what to do.** Never blame the player; never expose stack traces or codes without a plain sentence; no all caps.

* "We couldn't reach the server. Your look is saved on this device. Check your connection and try again."
* "This room is full right now. Try again in a moment, or play in another room."
* "Your browser blocked storage, so your look won't be remembered next time. You can still play."

## 3.4 Tutorial hints

* Short, contextual, one at a time, dismissible, repeatable in settings.
* "Hold jump to go higher. Tap it for a small hop."
* "Run with Shift (or your controller's run button), then jump to clear wider gaps."
* "Bounce pads launch you higher if you hold jump."
* "Stomp on a friend's head to bounce. Hold jump for extra height."
* After repeated failure (opt-in hints): "Stuck? Here's a nudge." plus a tip (Guided Hints assist).
* Never use "easy", "simple" or "just".

## 3.5 Co-op and chat (quick-chat default)

Quick-chat wheel phrases (default; no free text) [PROPOSAL]: "Hi!", "Thanks!", "Nice bounce!", "Ready?", "Go!", "Wait here", "Need a bounce", "Good luck", "Oops, sorry!", "Let's try again". Pings: go, wait, switch, bounce here. Keep phrases kind and short; all localizable as full strings.

## 3.6 Patch notes (template)

> **Patch title: one plain sentence.**
> *New:* one-line bullets starting with a verb.
> *Improved:* bullets.
> *Fixed:* bullets (what was wrong, not blame).
> *Known issues:* honest list.
> *Not in this patch:* optional; keeps expectations honest.
> Thank-you line (short).

Example: "Bounce Pads Feel Better. New: pads now squash and spring. Improved: held-jump launch is easier to time. Fixed: a gap in the caves where you could stand inside a wall. Known issues: the lever art is still low contrast."

## 3.7 Social posts (template and examples)

* One image or short clip of real gameplay. No fake trailers.
* One sentence of what is new. One sentence of honest status. No dates or prices.
* "A new bounce, a new gap. Real prototype footage. Early and rough, always improving."
* "Two heroes, one six-tile wall, one living stepping stone. Co-op is the point."
* Never post unlicensed music or art; never imply endorsement by other studios; follow the posting rules in `FAQ.md`. Public posting on the project's behalf requires the owner's approval.

# 4. NPC voice [PROPOSAL]

| Character | Voice |
|---|---|
| Keepers (mount trial givers) | Encouraging and patient; "Take your time. Try again whenever you like." |
| Cat foremen | One clear sentence, then "meow", then a distraction; want payment in a silly way |
| Dog boss | Sincere, hospitable, a little confused about being a cat |
| Echo scenes | Short, warm, mysterious, one joke at most |
| System narrator | Neutral and kind; short |

# 5. Accessibility and plain-language rules

1. Aim for short sentences (about 15 words or fewer) and common words.
2. Use headings and lists in docs; one task per step in tutorials.
3. Do not encode meaning in color alone; pair with an icon or text (gold = needs action, cyan = done, coral = hazard or lever are colorblind-safe pairings only when each also has a shape or label; see `UX_AND_ACCESSIBILITY.md`).
4. Provide a text label or `aria-label` for every control; keep screen-reader names equal to visible names where possible ("Primary color: Crimson" style).
5. Avoid flashing text. Avoid timed text; allow a re-read (toasts are 2.5 seconds today; keep important info out of toasts or provide a log).
6. Use inclusive, neutral language. Avoid idioms like "hit the ground running".
7. Do not use "click" when the player may use a controller; use "select" or the glyph.
8. Provide captions for any spoken or musical cue that carries information.
9. Avoid all caps except the pixel-font status text.
10. Test with a screen reader pass on any new overlay (the creator and pause menu use dialog roles, tablists, spinbuttons and radiogroups).

# 6. Localization notes

* No localization exists yet; the voice must survive translation.
* Keep one string catalog (not scattered literals) when localization begins; use named placeholders, never concatenated fragments.
* Avoid puns unless there is a plain alternative. The cat "meow" bit is language-neutral by design.
* Pixel font (`characters_font`) covers a limited character set: plan for extended Latin and non-Latin glyph sets before localizing in-game text; the DOM UI uses system fonts.
* Allow 40 percent text growth; avoid fixed-width text boxes.
* Control glyph tokens must be driven by the player's actual bindings, not literal text.
* Date, number and currency formats follow the locale; never show real-currency prices until monetization is decided.
* Voice-to-text users: avoid homophone-fragile names; keep names plain (naming rules in `LORE_BIBLE.md`).

# 7. Review checklist for any new text

- [ ] On voice (cheerful, bold, welcoming, never smug).
- [ ] Honest: no dates, prices, rewards, promises; status labels correct.
- [ ] No third-party names used as claims; references only as inspiration.
- [ ] Plain language; fits 40 percent growth; no idioms.
- [ ] Does not shame, pressure or gamble.
- [ ] Accessible: not color-only, not sound-only, not click-only.
- [ ] Consistent glossary terms (`GLOSSARY.md`).
