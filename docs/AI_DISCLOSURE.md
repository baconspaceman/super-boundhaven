# How Super BoundHaven is made: human-directed, AI-assisted

**Super BoundHaven (SBH) is created by Anthony ([`baconspaceman`](https://github.com/baconspaceman)).**
It is **human-directed and AI-assisted**: Anthony sets the vision and makes the decisions, and AI tools do a large share of the typing, drawing code and testing.

## Who does what

| | Role |
|---|---|
| **Anthony (baconspaceman)** | Owner and director. Chooses what the game is, decides every design question, accepts or rejects every proposal, playtests, and owns the project, its name and its publishing. |
| **Claude (Anthropic)** | The main AI assistant and, in practice, the head of day-to-day engineering: writes and reviews code, art-generation code, tests and docs, and checks its own work with tests and real browser runs. |
| **OpenAI Codex** | AI coding assistant used for earlier work and additional implementation. |
| **Grok (xAI)** | AI assistant used for additional help. |

AI tools are tools. They do not own, direct or decide anything about the project.

## What "AI-assisted" means here

- A person decides what gets built. Proposals from the AI stay labelled **proposal** until Anthony accepts them (see [DECISIONS.md](../DECISIONS.md)).
- AI-written work is checked by an automated test suite, type-checking, and runs in a real browser before it is called done. Known gaps are written down honestly.
- Art is produced by code in this repository (and a procedural Blender pipeline), not copied from other games. No third-party game assets, ROMs or code are included.
- Commits are authored as `baconspaceman`. Commits with substantial AI work carry a `Co-Authored-By:` line naming the assistant, so the history shows it.

## Why we say it

Open-source projects increasingly disclose AI help, usually with the wording "AI-assisted" (for example the `Assisted-by:` convention). We use "human-directed, AI-assisted" because it is accurate on both halves: a person leads, and AI does much of the work.

## A note on rights

Copyright law on AI-generated material differs by country, and in some places parts made without enough human authorship may not be protected. The licenses in this repository (MIT for code; CC BY-NC-SA 4.0 for art, content and docs) apply to everything the owner is able to license. This is not legal advice.

One-line credit you can reuse: *Created by Anthony (baconspaceman). Human-directed, AI-assisted: built with Claude (Anthropic), OpenAI Codex and Grok (xAI).*
