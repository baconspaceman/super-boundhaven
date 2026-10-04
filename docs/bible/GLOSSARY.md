<!-- core:start -->
# Glossary

Every term used in SBH design, code and docs, in one alphabetical list. Status tags follow the bible: CONFIRMED, ACCEPTED-DELEGATED, PROPOSAL, OPEN. "Built" means implemented in the repository today.

Key terms in one breath: **Bound Shard** is the cyan crystal collectible (working name). **Haven** is the shared world. **Twin Plates** is the built two-to-four-player co-op room. **Rulesets** Open, Standard and Classic decide which ability layers count (Classic is the normalized, unequipped leaderboard). The **Movement Budget** caps all movement bonuses from tree, gear and powerups. **L0 to L4** are ability layers (base move, trait, mount ability, powerup, gear). **Tiers T0 to T5** grade content difficulty and completion targets. **Gates** (mount, ability, switch, co-op, skill, knowledge) control Metroidvania progress and always have an alternate or loaner route. **Stomp-bounce** is the co-op primitive: standing on a player's head launches you. **Look code** is the 20-character string describing a character. **Mastery-by-use** and the **skill tree** both exist, with **free respecs**. **Assisted** marks runs that used assists and excludes them from ranked boards.

Use these terms consistently in code, docs, UI and copy. If you need a new term, propose it via `CHANGE_PROTOCOL.md`; do not invent synonyms.
<!-- core:end -->

# Terms

## A

| Term | Definition | Tag / source |
|---|---|---|
| **Accounts** | Planned persistence identity; provider undecided; guest play with later linking | ACCEPTED-DELEGATED scope; OPEN provider |
| **ACTION** | Sixth input, bit 32: pull levers now; summon or dismount mounts and use powerups later | CONFIRMED; Built (levers) |
| **Active keystone** | Tree keystone slotted for use; two slots in the proposal | PROPOSAL |
| **Anchor tether** | Proposed frog ability to grab anchor points (replaces the Yoshi-like tongue) | PROPOSAL |
| **Assist options** | Optional settings that ease challenge; off by default; mark runs Assisted | ACCEPTED-DELEGATED |
| **Assisted** | Run tag for runs using assists; excluded from Classic and Standard boards | ACCEPTED-DELEGATED |
| **Atomic trade** | Two-phase server transaction exchanging items so no side can cheat | ACCEPTED-DELEGATED |
| **Authoritative server** | Node and `ws` server that runs the real simulation and corrects clients | CONFIRMED; Built |
| **Away** | `PlayerState.away`: a disconnected body is inert while the session is held (10 s) | Built |

## B

| Term | Definition | Tag / source |
|---|---|---|
| **Base moveset (L0)** | What every player always has: run, jump, skid, stomp-bounce, crouch, action, etc. Must make required content possible | CONFIRMED |
| **Base-route proof** | A recorded input replay validated by the deterministic sim proving a level's required path is base-clearable | PROPOSAL |
| **Blender pipeline** | Procedural 3D to pixel pipeline for backdrops and props; a helper only | CONFIRMED allowed; ACCEPTED-DELEGATED role |
| **Bond** | Skill branch (co-op and support) | PROPOSAL |
| **Bound** | To leap; also to be tied together; haven greeting | PROPOSAL |
| **Bound Shard** | Cyan crystal collectible (working name); also lore motif | CONFIRMED (art); purpose OPEN |
| **Bounce pad** | `B` tile: spring pad, solid, launches (held jump boosts) | Built |
| **Bounce stack** | Chain of stomp-bounces lifting players over tall walls | CONFIRMED mechanic; PROPOSAL term |
| **Browser first** | Primary delivery platform; Steam later | CONFIRMED |
| **Buffer (jump buffer)** | 6-tick window to queue a jump; shared feel for everyone | ACCEPTED-DELEGATED; Built |

## C

| Term | Definition | Tag / source |
|---|---|---|
| **Channel** | One capped instance of a region's overworld | ACCEPTED-DELEGATED; cap OPEN |
| **Checkpoint (C)** | Flag that respawns you after a hurt or fall; per player in co-op rooms; shared by segment in raids | Built; ACCEPTED-DELEGATED |
| **Classic** | Ruleset: normalized unequipped leaderboard | ACCEPTED-DELEGATED |
| **Co-op room** | Challenge room for 2 to 4 players | CONFIRMED size |
| **Coil** | Spring-themed signature motif | CONFIRMED (art) |
| **Combo / modifier matrix** | Table of which level modifiers combine safely | PROPOSAL |
| **Coyote time** | 5-tick grace for jumping after leaving a ledge | ACCEPTED-DELEGATED; Built |
| **Creator (character)** | Layered humanoid customizer | CONFIRMED; Built |
| **Creator (level)** | Player who builds levels; the editor is Planned | CONFIRMED |
| **Crouch** | DOWN input; shrinks hitbox 28 to 16; drops through one-way platforms | CONFIRMED; Built |
| **Cross-play** | Browser and Steam players in one world | CONFIRMED intent; Planned |

## D to F

| Term | Definition | Tag / source |
|---|---|---|
| **Dinosaur** | Mount: sturdy ground bruiser; internal id `dino` | CONFIRMED |
| **Dungeon** | Co-op content for 3 to 5 players | ACCEPTED-DELEGATED |
| **Dynamic (door state)** | `world.dynamic[doorId]`: open or closed | Built |
| **Easter egg** | Hidden fun detail; echoes in lore | CONFIRMED |
| **Echo** | Hidden scene or secret left by earlier travelers | PROPOSAL |
| **Epoch** | Room-reset counter in snapshots | Built |
| **Event Tokens** | Event-only non-tradeable currency | PROPOSAL |
| **Footwork** | Skill branch (mobility and precision) | PROPOSAL |
| **Foreman** | Cat staff at the construction site | CONFIRMED lore; name PROPOSAL |
| **Frog** | Mount: bouncy amphibian | CONFIRMED |
| **Flying dinosaur** | Mount: airborne; internal id `drake` | CONFIRMED |

## G to H

| Term | Definition | Tag / source |
|---|---|---|
| **Gate** | An obstacle requiring a mount, ability, switch, co-op plates, skill or knowledge. Rules G1 to G9 | PROPOSAL; G1 to G9 ACCEPTED-DELEGATED |
| **G1** | Every required-path gate has an alternate or a loaner mount | ACCEPTED-DELEGATED |
| **Gear (L4)** | Worn equipment with bounded stats | CONFIRMED |
| **Ghost Replay** | Race your own best attempt | PROPOSAL |
| **Guided hints** | Opt-in hint assist after repeated failure | ACCEPTED-DELEGATED |
| **Haven** | The shared world; the project's world name in lore | PROPOSAL (lore) |
| **Haven Shard Ward** | Proposed powerup: absorbs one hit | PROPOSAL |
| **Hurt** | Touching an enemy, spike or falling in a pit: respawn at last checkpoint, 90 ticks invulnerability, no lives | Built |

## I to L

| Term | Definition | Tag / source |
|---|---|---|
| **Instance** | Ephemeral copy of content (dungeon, raid, race, level) | ACCEPTED-DELEGATED |
| **Keeper** | Mount trial NPC | PROPOSAL |
| **Kaizo** | Extremely hard hack-style difficulty; raid reference | CONFIRMED (brief) |
| **L0 to L4** | Ability layers: base move, trait, mount ability, powerup, gear effect | PROPOSAL |
| **Latch** | Far-side lever that holds a timed door open for the puller | Built |
| **Lever (l)** | Toggle or timed switch; ACTION pulls it | Built |
| **Level (sim)** | ASCII-tile level definition with parsed entities | Built |
| **Linger** | Ticks a door stays open after its condition lapses | Built |
| **Loadout** | Named build: tree spend, trait slots, keystones, gear | ACCEPTED-DELEGATED |
| **Loaner mount** | Mount lent by a level post for one section | PROPOSAL |
| **Look / Look code** | `CharacterLook`; 20-char base64url string | Built |

## M

| Term | Definition | Tag / source |
|---|---|---|
| **Maker** | Skill branch (creator and builder) | PROPOSAL |
| **Mastery Marks** | Progress earned by feats, advancing mastery tracks | PROPOSAL; model CONFIRMED |
| **Mastery-by-use** | Unlock perks by doing; half of the skill model | CONFIRMED |
| **Milestone (M1 to M14)** | Roadmap phases (priority, not dates) | PROPOSAL |
| **Mirror** | Level variant flipped horizontally | CONFIRMED desired |
| **Mount** | Rideable original animal; adds abilities, never replaces the base | CONFIRMED |
| **Mount policy** | `none`, `loaner` or `free` per level, raid or event | PROPOSAL |
| **Movement Budget** | Per-stat caps on all movement bonuses combined | ACCEPTED-DELEGATED principle |
| **MovementProfile** | Server-resolved per-player movement settings | PROPOSAL |

## N to P

| Term | Definition | Tag / source |
|---|---|---|
| **Neon Bazaar City** | Social and trade hub region | PROPOSAL name |
| **Open (ruleset)** | All ability layers allowed | ACCEPTED-DELEGATED |
| **One-way platform (-)** | Solid from above; crouch to drop through | Built |
| **Paper-doll** | Layered compositing of the humanoid | Built |
| **Pathfinder's Promise** | Stuck-nudge that highlights the nearest solution | PROPOSAL |
| **Plate (p)** | Pressure plate, held while a player stands on it | Built |
| **Powerup (L3)** | Consumable, temporary effect | CONFIRMED; concepts PROPOSAL |
| **Prediction** | Client simulates its own player immediately | CONFIRMED; Built |
| **Profile hash** | Hash of a resolved profile stored with leaderboard entries | PROPOSAL |
| **Protocol version** | Currently 3 | Built |
| **Purist Mark** | Tree keystone tagging unequipped runs | PROPOSAL |
| **Puzzle boss** | Boss won by solving, not three-hit patterns | CONFIRMED |
| **Pursuer** | Chasing hazard variant | CONFIRMED desired |

## Q to R

| Term | Definition | Tag / source |
|---|---|---|
| **Quick-chat** | Preset phrases and emotes; default chat posture | ACCEPTED-DELEGATED interim |
| **Raid** | Exactly 8 players, optional endgame | CONFIRMED |
| **Reconciliation** | Client corrects after server snapshots | CONFIRMED; Built |
| **Respec** | Free instant reassign of spends and slots | CONFIRMED |
| **Reset lever** | Lever that soft-resets a room | Built |
| **Retry** | Instant restart; no lives | ACCEPTED-DELEGATED |
| **Ruleset** | Open, Standard or Classic | ACCEPTED-DELEGATED |

## S to Z

| Term | Definition | Tag / source |
|---|---|---|
| **Secret** | Hidden content; `SecretDef` trigger, reveal, reward | CONFIRMED direction; PROPOSAL structure |
| **Segment checkpoint** | Shared checkpoint for raids and dungeons | ACCEPTED-DELEGATED |
| **Shard (shard pickup, `o`)** | In-level collectible; per player | Built |
| **Skill Points (SP)** | Tree currency from mastery tiers (name OPEN) | PROPOSAL / OPEN |
| **Skill tree** | Points-based half of the skill model | CONFIRMED |
| **Sproutling / Zipwing / Shardback** | The three enemy species | Built (art and sim) |
| **Stablemaster** | Skill branch (mount mastery) | PROPOSAL |
| **Standard** | Ruleset for default race boards (capped movement, level-provided pickups) | ACCEPTED-DELEGATED |
| **Steam** | Later platform; cross-play intended | CONFIRMED |
| **Stomp** | Landing on a player or stompable enemy to bounce | Built |
| **Stomp-bounce** | Launch from stomping a player (held-jump higher) | Built |
| **Sync window** | Authoritative window (about 8 to 12 ticks) for simultaneous actions | PROPOSAL |
| **Tether Ribbon** | Proposed co-op powerup | PROPOSAL |
| **Tiers T0 to T5** | Content difficulty tiers with completion targets | ACCEPTED-DELEGATED |
| **Time of day** | Dawn, day, sunset, night visual layer | Built (cosmetic) |
| **Tick** | One 60 Hz simulation step | Built |
| **Trait (L1) / Trait Slots** | Small permanent equippable perks and their slots | PROPOSAL |
| **Transmog** | Override a functional item's appearance | PROPOSAL |
| **Twin Plates** | The built co-op room `coopRoom` | Built |
| **Wayfinder** | Skill branch (explorer) | PROPOSAL |
| **Waypoint** | Fast-travel stone to visited places; never in instances | PROPOSAL |
| **Zone modifier** | Level-wide physics effect (low gravity, ice, water, wind) affecting everyone | PROPOSAL |

# Repository terms

| Term | Definition |
|---|---|
| `@sbh/sim` | Deterministic movement and level simulation (`packages/sim`) |
| `@sbh/protocol` | Wire types and look validation (`packages/protocol`) |
| `@sbh/art` | Sprite and tile generators, assets (`packages/art`) |
| Disjoint file ownership | Rule that each AI agent owns specific paths (see `../ai-team/`) |
| Provenance record | `PLACEMENT_AND_PROVENANCE.md`, the record of where assets came from |
| Core block | The `<!-- core:start -->` to `<!-- core:end -->` summary at the top of each bible file, concatenated by the bundle tool |
