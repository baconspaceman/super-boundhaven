<!-- core:start -->
# Audio direction [PROPOSAL; no audio exists yet]

Nothing in this file is accepted canon except the licensing posture: **original only** (Anthony, 2026-09-30: strictly original assets, no third-party assets), and music, like art and docs, is released under CC BY-NC-SA 4.0 with the name and logo reserved. The repository contains no audio code or files today.

**Direction.** A cheerful, bold, 16-bit-era chip-and-sampler sound: bright square, pulse, triangle and noise voices plus small sampled instruments (bells, marimba, bass, strings, hand percussion) that evoke the console era without copying any existing score. Each region has one clear mood and instrument palette (matching the "one world, one mood" rule). Melody first: short, memorable loops that stay pleasant after an hour of retrying. Tempos 90 to 150 BPM for traversal, 70 to 100 for exploration and caves, 130 to 170 for pressure rooms. Time of day changes arrangement (dawn soft, day full, sunset warm, night sparse), not the tune.

**SFX vocabulary.** Short, crisp, readable cues for every verb: jump, land, skid, bounce pad, stomp, hurt, respawn, shard, checkpoint, lever, plate down, gate open, spike, mount summon, mount ability, powerup, secret found, UI move, UI confirm, UI back. Sounds are consistent across regions so players learn them once.

**Mix rules.** Gameplay-critical cues sit above music; music ducks briefly under important cues; independent music and effects volume plus mute; no sound is required to solve anything; every informative sound has a visual twin; avoid harsh high frequencies and sudden loudness; loops must not fatigue (no grating mid-range).

**Licensing and provenance.** All music and effects original. Record provenance for every file (author, tool, date, source files). No samples ripped from games, no soundalike scores, no AI-generated audio of unknown license. Any third-party licensed audio would contradict the strict-original decision and needs Anthony's explicit approval.
<!-- core:end -->

# 1. Principles

1. **Original.** Composed for SBH. Era-flavored, not era-copied: avoid recognizable motifs from any existing game.
2. **Readable.** Sound supports play; it never hides information. Every informative cue has a visual counterpart (`UX_AND_ACCESSIBILITY.md`).
3. **Friendly.** No grim drones; spooky regions are spooky-cute.
4. **Sustainable.** Players retry hard sections many times; music and cues must not annoy.
5. **Extensible.** Instrument palettes and cue families are data-driven so new regions, mounts and powerups can add sounds without changing the mix.
6. **Honest status.** Audio is Planned (no code in `apps/client`).

# 2. Sonic identity

| Element | Direction |
|---|---|
| Era flavor | 16-bit console: pulse and square leads, triangle bass, noise percussion, plus small sampled bells and strings; light reverb |
| Harmony | Mostly major and mixolydian for cheer; minor-flavored in caves, haven shadows and manor, always resolved warmly |
| Rhythm | Bouncy, off-beat accents echoing bounce pads and stomps |
| Signature motif | A short rising two-note "bound" figure (the coil) that can appear in any region's theme |
| Voice | No spoken voice. Characters use short non-verbal blips if any; cat NPCs use a stylized "meow" sample in the late update (original recording or synth) |
| Dynamics | Compressed, gentle; avoid loud-quiet extremes |

# 3. Music per region [PROPOSAL]

Tempo ranges are starting suggestions.

| Region | Instrumentation | Tempo | Mood notes |
|---|---|---|---|
| Sunny Grassland | Bright pulse lead, bouncy triangle bass, glockenspiel, soft hand claps | 110 to 130 | Welcoming; day, sunset (warmer, slower) and night (sparse, music-box) arrangements share a tune |
| Crystal Caves | Sampled bells and chimes, soft pad, sparse bass, delay | 70 to 95 | Quiet, glowing; leaves space for precision play |
| Clockwork Factory | Tight percussion, ticks, brass-synth stabs, syncopated bass | 120 to 150 | Rhythm that matches rhythm rooms; loops must align with hazard timing only if hazards are cued visually too |
| Canopy Jungle | Marimba, wood blocks, flute-like lead, shakers | 100 to 125 | Playful and lush |
| Sunken Pirate Cove | Concertina-style lead, plucked bass, low-pass underwater filter | 90 to 115 | Adventurous; underwater variant muffled |
| Cloudtop Isles | Airy pads, bright arpeggios, harp-like pluck | 100 to 120 | Open and vertigo-friendly |
| Ember Depths | Low brass-synth, driving pulse, crackle noise | 130 to 160 | Intense but not grim |
| Stormbreak Island | Rolling toms, strings, rain noise bed | 110 to 140 | Thunder is a mood cue, always paired with a visual warning |
| Hollow Manor | Celesta, pizzicato, music-box melody, soft choir pad | 80 to 110 | Spooky-cute |
| Orbit Gardens | Shimmering pads, slow arps, soft pings, low-gravity feel | 80 to 105 | Wonder |
| Mossy Bayou | Slow slide-guitar-flavored lead (synth), upright-style bass, frog chorus | 70 to 95 | Cozy fog |
| Sugar Summit | Toy piano, music box, kazoo-bright lead, bouncy bass | 120 to 150 | Whimsy, very friendly |
| Sunbaked Sands | Hand-percussion, plucked strings, reedy lead, long reverb | 90 to 120 | Wide, sunny |
| Neon Bazaar City | Jazz-flavored bass, electric piano, bright brass-synth, clock-tower chime | 100 to 130 | Social; ambient crowd murmur layer |

Also needed [PROPOSAL]: title and creator theme (friendly and short), pause menu (muted), mount themes (short stingers), puzzle boss themes (build with progress), raid themes (tense but readable, phase-by-phase), victory fanfare, secret-found jingle, casino theme (late update; playful, never predatory).

Time of day arrangements: dawn (soft, high), day (full), sunset (warm, slower), night (sparse, lullaby-like).

# 4. SFX vocabulary [PROPOSAL]

Short, readable, consistent. Pitch families map to function: rising pitch = good or power-up; falling = harm or close; mid = neutral UI.

| Cue | Description | Notes |
|---|---|---|
| Walk and run steps | Soft taps per surface (grass, stone, wood, sand) | Very quiet; off in noisy rooms |
| Skid | Short scrape | Matches the skid pose |
| Jump | Quick upward blip; height variation small | Slightly higher for held jump |
| Land | Soft thump; harder for hard land | Matches land squash |
| Bounce pad | Springy boing, pitch rises when held-jump boost | The signature sound; coil motif |
| Stomp (on player or enemy) | Punchy pop plus star twinkle | Different pitch for player vs enemy |
| Hurt | Short descending blip, not harsh | Never shaming |
| Respawn | Poof plus soft chime | Matches respawn poof |
| Shard collect | Bright crystalline ping, rising | Pitch can rise with chained shards (small) |
| Checkpoint | Two-note chime plus flag flutter | |
| Lever pull | Chunky click-clack | One-shot; reset lever has a distinct tone |
| Pressure plate down | Low click plus rising glow hum | Hum loops while held |
| Plate up | Short release | Matches the raised plate |
| Gate open | Rising stone or metal slide plus chime | Cyan = done; matches visual |
| Gate close | Falling slide | Never when a player is inside |
| Timer lever tick | Soft ticking that speeds up near the end | Must also have the visual ring |
| Spike | Quick zap | Danger cue |
| Door linger warning | Soft pulsing tone | Telegraph that it will close |
| Mount summon in/out | Poof with cheerful rising/falling note | Per-mount flavor |
| Mount ability | Frog charge-and-hop; dino stomp; flyer flap whoosh; cheetah dash whoosh | Distinct per mount |
| Powerup pick up and use | Bright rising arpeggio; use gives short sparkle | One per powerup family |
| Secret found | Gentle shimmer jingle | Rewarding but not loud |
| UI move/confirm/back | Tiny ticks | Quiet; consistent with menus |
| Co-op sync success | Satisfying chord | Multiple players hear the same |
| Raid phase clear | Short fanfare | |
| Cat meow (late update) | Stylized meow | Original recording or synth only |

# 5. Mix rules

1. **Priority:** critical gameplay cues above music; music ducks 3 to 6 dB for about 300 ms under key cues (stomp, gate open).
2. **Loudness:** target a gentle, even level; no sudden jumps; a global limiter prevents clipping; loudness of cues relative to music consistent across regions.
3. **Frequency:** avoid harsh highs; reserve a distinct band for critical cues so they cut through music; keep sub-bass modest for laptop speakers.
4. **Spatial:** minimal; optional left-right pan for other players' cues, limited at distance; never rely on spatial cues alone.
5. **Player count:** with eight raid players, other players' footsteps and cues are heavily reduced; own cues remain clear; group-critical cues (sync countdown, gate open) are always audible.
6. **Settings:** independent music and effects sliders, mute all, and a "dynamic range" option; captions or visual indicators for important sounds.
7. **Loops:** seamless, no pops; tracks long enough not to repeat obviously inside a typical retry cycle; transitions between regions crossfade.
8. **Silence is a tool:** caves and night allow sparse moments.
9. **Safety:** no sudden loud stingers; no high-pitched whines; photosensitive-adjacent: no strobing audio-visual sync.
10. **Web constraints:** keep downloads small; stream long music after the first interaction; respect autoplay policy (start audio after the first input).

# 6. Licensing, provenance and rules

| Rule | Detail |
|---|---|
| Original only | Composed and produced for SBH. No samples from games, films or sound libraries unless the license is explicitly compatible AND Anthony approves (it would contradict the strict-original decision, so default is no) |
| Soundalikes | Forbidden: no recreating existing scores or jingles |
| AI-generated audio | Only if the tool's terms permit the project's licensing and output provenance is recorded; flag for Anthony first |
| Provenance record | Every audio file has an entry: filename, author, tool and version, date, source project files, license (CC BY-NC-SA 4.0 for music and effects released by the project), notes. Store alongside `PLACEMENT_AND_PROVENANCE.md`-style records |
| Contributors | Any accepted audio contribution keeps the same license as the files it changes (see `CONTRIBUTING.md`); code and art contributions are not being accepted yet |
| Third-party tools | Open-source or properly licensed tools only; record versions |
| Names | No audio file or track named after another game's music |
| Streaming and social | Posting clips with project music is fine under the project license; third-party music is never added to project clips |
| Monetization interplay | Music is under BY-NC-SA today; revisit with Anthony before any monetization (O7) |

# 7. Production plan [PROPOSAL, phased]

1. **Phase A (first audio):** UI sounds, jump, land, bounce, stomp, shard, checkpoint, lever, plate, gate, hurt; one Grassland loop. Web Audio implementation with autoplay-safe start and a mute toggle.
2. **Phase B:** Caves and Factory loops; time-of-day arrangements; mix settings.
3. **Phase C:** mount sounds and themes with the first mount; powerup cues.
4. **Phase D:** raid and puzzle boss music; sync cues.
5. **Phase E:** remaining regions; cat and casino audio in the late update.

Each phase follows the same gate: tone guide fits, accessibility twin exists, provenance recorded, Anthony-approved if it affects public identity.

# 8. Open questions (Anthony)

* Who composes (in-house, collaborator, AI-assisted with provenance)? (O15)
* Is a recognizable "bound" motif approved as a signature? (proposal)
* Any appetite for a small number of properly licensed tracks, or strictly original? Current canon: strictly original.
* Whether to publish a soundtrack under CC BY-NC-SA.
