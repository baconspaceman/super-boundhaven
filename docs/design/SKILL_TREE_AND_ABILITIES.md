# Super BoundHaven: abilities taxonomy and skill tree (detail)

Companion to `GAME_DESIGN_DOCUMENT.md` (sections 2, 3, 4, 6). Everything below is **[PROPOSAL]** unless tagged otherwise. The brief calls the skill tree **tentative**; nothing here is accepted until Anthony says so, and the final choice between the points tree (Model A) and mastery-by-use (Model B) stays **[OPEN]** (GDD decision queue item 1).

Badges: **[CONFIRMED]** = Anthony's own words (brief, decisions log); **[PROPOSAL]** = Claude's design suggestion; **[OPEN]** = unresolved.

Reference numbers come from `packages/sim/src/config.ts` (60 Hz, 16 px tiles, hitbox 12x16). Heights and distances are continuous-physics approximations derived from those values; verify against sim tests before tuning anything to them.

---

## 1. Hard rules the tree and abilities must obey

| # | Rule | Status | Source / reason |
|---|---|---|---|
| R1 | Hard content must be possible with the **base moveset** at exceptional skill. | **[CONFIRMED]** | DESIGN_BRIEF "Items, builds, and economy" |
| R2 | Gear/abilities add flair and meaningfully **ease** hard content; they do not replace skill. | **[CONFIRMED]** | DESIGN_BRIEF |
| R3 | Nothing purchasable with real money grants movement or ability power. | **[PROPOSAL]** (cosmetics-only is a recommendation, brief) | DECISIONS "Recommendations" |
| R4 | No node/gear/powerup may make a **required** route impossible without it. Required routes are base-clearable (with the team, for co-op). | **[PROPOSAL]** | extends R1 |
| R5 | Competitive play runs under an explicit **ruleset** (Open / Standard / Classic). Classic = base moveset only. | **[PROPOSAL]** (normalized leaderboards are a brief proposal) | brief, "proposals, not confirmed" |
| R6 | Every movement-affecting bonus is **capped** by the Movement Budget (section 5). | **[PROPOSAL]** | fairness |
| R7 | Mounts, abilities and gates are **never acquired from the tree or shop in a way that hard-locks progress**. | **[PROPOSAL]** | MOUNTS doc guardrail |
| R8 | All designs, names and effects are original. No mushrooms, capes/feathers, stars-as-invincibility, fire flowers, tongue-eats-enemy, etc. | **[CONFIRMED]** (originality) | brief + ART_NORTH_STAR |

---

## 2. Ability taxonomy (the five layers plus environment)

| Layer | What it is | Acquired by | Lifetime | Persistence | Competitive default |
|---|---|---|---|---|---|
| **L0 Base move** | Run, jump, stomp-bounce etc. Everyone, always. | Existing from first join | Permanent | none needed | Always on (all rulesets) |
| **L1 Trait** | Small permanent account-wide bonus or convenience (from the tree in Model A, or from mastery unlocks in Model B). | Points (A) or by-doing (B) | Permanent, swappable | account | Movement-affecting traits off in Classic |
| **L2 Mount ability** | Extra moves while mounted (frog super-hop, cheetah dash...). | Mount owned + summoned | While mounted | mount roster on account | Per-level/ruleset mount policy |
| **L3 Powerup** | Consumable, temporary (charges or seconds). | Found in levels, crafted, dropped, bought with earned currency | Seconds/charges | inventory count only | Off in Standard/Classic; fixed, level-provided pickups allowed in any ruleset |
| **L4 Gear effect** | Passive stat from worn equipment, bounded by budget. | Loot, crafting, trade | While worn | inventory/loadout | Off in Classic; capped in Standard |
| **Env (not an ability)** | Zone modifiers: low gravity, ice, water, wind. Affect everyone equally. | Level data | In zone | none | Always on (part of the level) |

### Stacking and conflict

```mermaid
flowchart LR
  B["L0 base MovementConfig"] --> T["L1 traits: additive % within budget"]
  T --> G["L4 gear: additive % within budget"]
  G --> C{"Budget clamp per stat"}
  C --> P["L3 powerup: temporary override layer (own cap)"]
  P --> M["L2 mount: swaps movement profile + adds ACTION move"]
  M --> Z["Env zone modifier (level)"]
  Z --> F["Final per-player MovementProfile (server-resolved)"]
```

1. **Resolve server-side** into one immutable `MovementProfile` per player per attempt. The sim's `stepPlayer(level, p, buttons, cfg)` already takes a `cfg`, so a per-player profile fits without new architecture.
2. **Within a layer**, percentage bonuses are additive, then clamped by the Movement Budget. **Across layers**, the order above applies; the final value is clamped by a hard per-stat ceiling.
3. **Conflicts:** same-stat powerups do not stack (refresh the longer timer, keep one). A mount replaces the body movement profile for the stats it defines (frog: jump arc; cheetah: speed) but traits/gear bonuses apply to mount stats only where listed. An active powerup that conflicts with a mount ability (e.g. glide on a flyer) is suspended, not stacked, while mounted (visible indicator).
4. **Ruleset mask:** the ruleset supplies a bitmask of allowed layers; the profile resolver zeroes disallowed layers. The match/attempt records the ruleset and profile hash so leaderboards can be audited.

### Rulesets [PROPOSAL]

| Ruleset | L1 traits | L3 powerups | L4 gear | L2 mount | Use |
|---|---|---|---|---|---|
| **Open** | all | all | all | per level | Casual overworld, raids, creator levels |
| **Standard** | non-movement + capped movement | level-provided only | capped | per level | Default race/time-attack board |
| **Classic** | non-movement only (map, ping, UI) | level-provided only | cosmetic only | level-provided loaner only | Normalized/unequipped leaderboard, "purist" runs |

---

## 3. Base moveset vs additions (what belongs where)

See GDD section 2 for the numbers. Summary of the **proposed growth of the base**:

| Move | State | Note |
|---|---|---|
| Walk/run, accel, skid, friction | **Exists in sim** | L0 |
| Variable jump, run-speed jump bonus, coyote (5 t), buffer (6 t) | **Exists in sim**; coyote/buffer adoption as permanent base is **[OPEN]** (handoff lists them as options) | L0 |
| Slopes, bounce pads, stomp-bounce, player push | **Exists in sim** | L0 |
| Crouch / drop through semi-solids (DOWN) | **[PROPOSAL]** new input | L0; semi-solids appear in the art north star |
| ACTION button (mount move, powerup use, interact) | **[PROPOSAL]** new input | used only by L2/L3 and interactables, never required for base-only routes |
| Swim / water movement | **[PROPOSAL]** | zone-provided, same for all |

---

## 4. Skill tree, Model A: Points tree [PROPOSAL, tentative per brief]

### 4.1 Design goals

1. Give **build identity and long-term goals** without touching the skill ceiling.
2. Most nodes are **utility, information, expression and co-op/creator convenience**, not raw movement stats.
3. Movement-stat nodes are few, small and capped, and **vanish in Classic**.
4. Explore/co-op/create are all valid ways to grow (no single grind path).

### 4.2 Structure

| Element | Rule |
|---|---|
| Branches | **Footwork** (Mobility/Precision), **Bond** (Co-op/Support), **Wayfinder** (Explorer/Metroidvania), **Maker** (Creator/Builder), **Stablemaster** (Mount Mastery) + cross-branch **X** nodes |
| Node types | **S** Stat (tiny, capped), **U** Utility (new convenience), **I** Info (UI/readouts), **K** Keystone (tradeoff/toggle), **C** Cosmetic/Title |
| Movement flag | **M** = affects movement/ability numbers (suppressed in Classic, capped in Standard). **N** = non-movement (always allowed) |
| Points | "Skill Points" (name **[OPEN]**). Earned only in-game by first-time feats: new discoveries, first clears, co-op completions, creator milestones, mastery challenges. **Never sold, never traded.** No numeric earn rate promised. |
| Supply vs cost | Full tree costs **76 SP** in the sample below; proposed long-run supply is deliberately **below** full cost (target ~75%) so choices matter. Numbers are placeholders **[OPEN]** |
| Respec | Free, instant, in any safe zone/hub; not allowed mid-attempt. Loadout is **snapshotted when an event attempt starts**. No currency sink (avoids respec economy). |
| Loadout | Up to N "active keystones" at once (N=2 proposal). Unlimited passive nodes once purchased. |
| Caps | Movement Budget (section 5). Diminishing returns: rank II of a stat node gives the same % but costs more; no third rank. |
| Prerequisites | Tree edges (node A requires B); some cross-branch nodes need 1 node from 2 branches. |
| What the tree may NOT do | Unlock mounts; gate required content; grant raid-only immunities; sell anything; add HP/invulnerability; bypass sync mechanics; change leaderboard-visible physics in Classic; grant stacking beyond budget; give info that makes hidden content trivially skipped for first-time explorers (secret hints are opt-in and local). |

### 4.3 Sample tree (38 nodes, 76 SP)

Cost = SP. "Req" = prerequisite node(s). Flag M/N as above. Numeric effects are starting points, verify in sim.

#### Footwork (Mobility / Precision)

| ID | Node | Type | Flag | Effect | Req | SP |
|---|---|---|---|---|---|---|
| F1 | Ledge Sense | I | N | Soft landing-shadow marker under your feet while airborne (toggle) | none | 1 |
| F2 | Ghost Replay | U | N | Race your own best attempt as a ghost in any level | F1 | 1 |
| F3 | Spring Legs I/II | S | M | +2.5% jump velocity per rank (total +5% ≈ +0.6 tile at full hold) | F1 | 2 + 2 |
| F4 | Sure Stride I/II | S | M | +2.5% run max per rank (total +5%) | F1 | 2 + 2 |
| F5 | Steady Air | S | M | +8% air acceleration | F3 | 2 |
| F6 | Bounce Sense | U | M | Held-jump window on pads and stomps starts 4 ticks early (more forgiving input, same heights) | F2 | 2 |
| F7 | Purist Mark | K | N | Toggle: all M nodes and gear movement stats off; run is auto-tagged "Purist" on boards; grants a badge cosmetic. Costs 1 to unlock. Exists to make self-normalized play rewarding | F1 | 1 |

#### Bond (Co-op / Support)

| ID | Node | Type | Flag | Effect | Req | SP |
|---|---|---|---|---|---|---|
| B1 | Ping Wheel | U | N | Contextual pings (go, wait, switch, bounce here) | none | 1 |
| B2 | Steady Base | S | M | Take 30% less downward push when stomped (easier to be a stable step) | B1 | 1 |
| B3 | Bounce Glow | I | N | Highlight on an ally when their stomp window lines up with yours | B1 | 1 |
| B4 | Anchor Grip | U | M | Hold ACTION: immovable by pushes for 1 s (cooldown 4 s) | B2 | 2 |
| B5 | Rally Call | U | N | Channel 3 s to return a fallen ally to your position (cooldown 60 s, not usable in Classic runs) | B3 | 3 |
| B6 | Hand-off | U | N | Pass one powerup to an adjacent ally | B1 | 2 |
| B7 | Countdown Call | U | N | Place a synchronized, server-timed countdown everyone in the party sees (helps sync mechanics; does not change windows) | B5 | 3 |

#### Wayfinder (Explorer / Metroidvania)

| ID | Node | Type | Flag | Effect | Req | SP |
|---|---|---|---|---|---|---|
| W1 | Cartographer's Eye | I | N | Larger auto-reveal radius on the map | none | 1 |
| W2 | Secret Sense | I | N | Subtle shimmer near secrets within ~6 tiles (toggle; default-on accessibility option planned independent of the tree, **[OPEN]**) | W1 | 1 |
| W3 | Trail Pins | U | N | Place up to 3 map pins | W1 | 1 |
| W4 | Haven Return | U | N | Fast-travel between **visited** waypoints (cooldown, not in instances) | W1 | 2 |
| W5 | Lantern Lore | I | N | Hollow Lantern powerup reveals twice the radius | W2 | 2 |
| W6 | Secret Ledger | I | N | Per-zone secret counters plus vague text hints | W2 | 1 |
| W7 | Pathfinder's Promise | K | N | If you are stuck at a mount/ability gate, the map highlights the nearest way to obtain the answer (mount source or alternate route). Anti-hard-lock safety net | W4 | 3 |

#### Maker (Creator / Builder)

| ID | Node | Type | Flag | Effect | Req | SP |
|---|---|---|---|---|---|---|
| K1 | Steady Hand | U | N | Deeper undo history, grid-snap presets | none | 1 |
| K2 | Stamp Library | U | N | Save/paste tile stamps | K1 | 1 |
| K3 | Playtest Ghosts | I | N | See anonymized tester ghosts in your draft levels | K1 | 2 |
| K4 | Validator Insight | I | N | Visualize the base-moveset route proof and failure hotspots | K2 | 2 |
| K5 | Scenery Sets | C | N | Extra decoration sets (cosmetic only; core tile palette is free for everyone) | K1 | 2 |
| K6 | Event Host | U | N | Host private race/time-attack lobbies on approved levels | K4 | 3 |
| K7 | Curator's Shelf | C | N | Pin 3 favorite levels on your profile | K1 | 1 |

#### Stablemaster (Mount Mastery)

Requires owning at least one mount for any node here to be useful; mount **acquisition is never in the tree**.

| ID | Node | Type | Flag | Effect | Req | SP |
|---|---|---|---|---|---|---|
| M1 | Stable Keys | S | M | Mount summon cooldown -15% | none | 2 |
| M2 | Quick Saddle | S | M | Faster mount-on/off animation (no extra invulnerability) | M1 | 1 |
| M3 | Stamina Reserve | S | M | +10% mount stamina (flyer, cheetah) | M1 | 2 |
| M4 | Long Reach | S | M | Frog tether reach +1 tile | M1 | 2 |
| M5 | Hardy Hide | S | M | Mount tolerates one more stun/bump before dismount (only if a mount-health model exists, **[OPEN]**) | M1 | 2 |
| M6 | Passenger Seat | U | M | Mount may carry one passenger (only if passengers are approved, **[OPEN]**) | M3 | 3 |
| M7 | Bonded Mount | K | M | Choose one bonded mount: its ability cooldown -20%, other mounts +15% | M3 | 3 |

#### Cross-branch (X)

| ID | Node | Type | Flag | Effect | Req | SP |
|---|---|---|---|---|---|---|
| X1 | Spare Loadout | U | N | Second saved loadout slot | F2 and W1 | 2 |
| X2 | Hybrid Stride | S | M | Powerup durations +10% (Open ruleset only) | F4 and M1 | 3 |
| X3 | Haven Sage | C | N | Capstone: title and aura cosmetic, no power | >= 3 nodes in each of 4 branches | 5 |

**Totals:** Footwork 15, Bond 13, Wayfinder 11, Maker 12, Stablemaster 15, X 10 = **76 SP**, 38 nodes.

---

## 5. Movement Budget (caps across tree + gear + powerups)

Applies to all sources combined. Values are starting proposals **[OPEN]**.

| Stat | Tree + gear cap (Open) | Standard | Classic | Powerup layer (Open only) | Hard ceiling |
|---|---|---|---|---|---|
| Jump velocity (height) | +10% (≈ +1.2 tile at the current ≈3.8-tile full hold) | +6% | 0 | +8% | +18% |
| Run max speed | +8% | +5% | 0 | +12% | +18% |
| Air acceleration | +15% | +8% | 0 | +20% | +30% |
| Bounce boost (pads/stomp) | +8% | +4% | 0 | +10% | +15% |
| Ground grip (friction/skid) | +20% | +10% | 0 | +30% | +40% |
| Mount stamina | +20% | +10% | 0 | n/a | +25% |
| Powerup duration | +15% | 0 | 0 | n/a | +15% |
| Coyote / buffer windows | 0 (assist setting, not a stat) | 0 | 0 | 0 | 0 |

Coyote time and jump buffering are **assist/feel settings shared by everyone**, not purchasable power, to keep fairness simple.

**Design-time gate margin:** level designers and the validator must treat required jumps as base-clearable with margin (e.g. required gap <= base run-jump distance minus a skill margin; the 6-tile co-op wall in the playground is deliberately *not* solo-clearable). Budget caps are sized so that a capped Open build clears optional challenges, never required routes, that base cannot.

---

## 6. Skill tree, Model B: Mastery-by-use (no points) [PROPOSAL, alternative]

Replace spend-and-refund with **unlock by doing**. Five tracks (same names as branches). Each has **Mastery Marks** unlocked once by feats (first discovery, first clears, co-op completions, mount trials, creator milestones). Unlocked **perks** are identical in effect to the N/I/U nodes above and to a *smaller* set of M stat perks. You then **equip** up to N perks into "Trait Slots" (N grows slowly, e.g. 3 to 5). No points, no respec economy: swap freely in safe zones.

| Dimension | Model A: Points tree | Model B: Mastery-by-use |
|---|---|---|
| Player fantasy | Plan a build, spend currency | Get better/explore and be rewarded with new tools |
| Fits Metroidvania exploration | Medium (points from discoveries) | **High** (unlock is the discovery) |
| Risk of "wrong" choice / regret | Medium, mitigated by free respec | **Low** |
| Grind / point-farming risk | Medium (need an earn rate) | Low-Medium (feats are one-time; must avoid checklist fatigue) |
| Balance complexity | High (prereq graph, caps, costs) | **Lower** (flat perks, slot limit is the knob) |
| Build diversity | High | Medium (slots limit; fewer numeric options) |
| Dev cost (first version) | Higher UI + persistence + graph | **Lower** |
| Competitive fairness | Needs budget + ruleset | Same, but fewer stat perks so easier |
| Onboarding | Tree screen can overwhelm new players | Gentle |
| Extensibility ("no addition too small") | Add nodes (graph growth) | Add feats/perks (flat list growth) |
| Ties to brief | "tentative skill tree" | Consistent with secrets/exploration emphasis |

**Recommendation [PROPOSAL, choice stays OPEN]:** start with **Model B** (mastery unlocks + a few Trait Slots). It reuses the same perk catalog above, is cheaper, less grindy, and kinder to fairness. Keep Model A's graph as an optional **later overlay** (the catalog is written so nodes map 1:1 to perks). Decide only after the movement/abilities milestone shows what perks players actually want.

---

## 7. Interactions cheat sheet

| Combination | Result |
|---|---|
| Tree/gear bonuses + mount | Apply only to mount stats explicitly listed (stamina, cooldown, reach); do not stack beyond mount ceiling |
| Powerup + mount ability | Conflicting powerups suspended while mounted; non-conflicting coexist |
| Powerup + powerup | One active timed movement powerup at a time; utility ones coexist |
| Gear + Purist Mark (F7) | Movement stats ignored while Purist is on |
| Classic ruleset | Only L0, non-movement L1, level-provided pickups, level-provided loaner mounts |
| Raids | Ruleset is Open unless the raid declares otherwise; raid declares mount policy (none/loaner/free) |
| Creator levels | Creator chooses allowed layers (mask) and can mark a level "Classic only" |
