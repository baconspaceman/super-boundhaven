<!-- core:start -->
**P10 Scale, full MMO and live operations.** Goal: the long horizon: a persistent shared world at real concurrency with several raid tiers and healthy live operations. Scope: load tests with bot swarms (single room to many rooms to sharded clusters), measured channel caps, multi-region latency and matchmaking, the shared overworld with channels plus instances, multiple raids and hard-tier content, live-ops tooling (event calendar tooling with no committed dates, seasons are a later decision), incident response runbooks, and privacy compliance workflows (export, deletion). Entry: P3 (instances, persistence, observability), P2 raid prototype, P5/P6 content. Exit: published capacity numbers from real tests (not guesses), a rehearsed incident runbook, bot-swarm regression in CI nightly or manual trigger. Open-ended by design: "no feature too big". Risks: cost (all spending is Anthony's decision), architecture limits of a JSON/Node server. Leads: Codex (sharding, infra), Grokbot (swarms, live-ops automation, dashboards), Claude (content, overworld design). Size: XL and ongoing.
<!-- core:end -->

# P10 Scale and live ops

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-160 | Load tests: bot swarms 16 / 100 / 1000+ (needs multi-process until RM-033) | Later | Grokbot | L | Reports per tier; bottleneck named; no unbounded memory growth |
| RM-161 | Sharding and multi-process room hosting | Later | Codex | XL | Rooms spread across processes; deploy plan Anthony approves |
| RM-162 | Cross-region latency, region selection and matchmaking | Later | Codex | L | Measured RTT table; matchmaking policy doc |
| RM-163 | Live-ops tooling: event calendar tooling (no dates promised), automated digests | Later | Grokbot | M | Drafts only; Anthony schedules/publishes |
| RM-164 | Shared overworld with channels plus instances | Later | Claude + Codex | XL | Join/leave channel, cap measured, persistence of position/zone |
| RM-165 | Raid tier content (more raids, harder tiers, size 8 cap) | Later | Claude | XL | Each raid: bot-clear, human playtest, segment checkpoints |
| RM-166 | Incident response runbooks and post-incident template | Later | Codex + Grokbot | M | Tabletop drill completed |
| RM-167 | Privacy compliance workflows: data export and deletion | Blocked (posture: Anthony) | Codex | L | Verified on test accounts; policy text from Anthony |
