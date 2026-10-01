# Licensing of Super BoundHaven

Super BoundHaven uses two licenses so the code can be reused freely while the game's creative identity stays protected from being sold as-is by others.

## 1. Source code: MIT (`LICENSE`)

Covers the software: TypeScript/JavaScript/Python/PowerShell source, build scripts, tests, configuration and workflows. Specifically:

- `packages/sim/**`, `packages/protocol/**`, `apps/server/**`, `apps/client/src/**`, `apps/site/src/**/*.ts` and `*.css`, `apps/*/` configs
- `packages/art/src/core.ts`, `packages/art/src/png.ts`, `packages/art/scripts/**` and `packages/art/test/**` (the pixel-art toolkit and build scripts)
- `tools/**` (Blender pipeline scripts, docs-site builder, audit tool, pixelizer)
- `.github/**`, `package.json`, `tsconfig.json`, `vitest`/`vite` configs

## 2. Creative content: CC BY-NC-SA 4.0 (`LICENSE-ASSETS.txt`)

Covers the game's creative content: you may share and adapt it with attribution, **not for commercial use**, and adaptations must use the same license.

- All generated or authored art and data: `packages/art/assets/**` (sprite sheets, atlases, backgrounds, previews), the pixel-art definition modules `packages/art/src/characters/**`, `packages/art/src/world/**`, `packages/art/src/blender/**`, `apps/site/public/**`, `apps/site/src/assets/**`
- Character, creature, mount, region, item and level designs, game lore and story, names of in-game things, music/sound when added
- Documentation and design documents: `docs/**`, `DESIGN_BRIEF.md`, `DECISIONS.md`, `OPEN_QUESTIONS.md`, `CLAUDE_HANDOFF.md`, `PLACEMENT_AND_PROVENANCE.md`, and the written content of `README.md`

Attribution: credit "Super BoundHaven" with a link to https://github.com/baconspaceman/super-boundhaven and indicate changes.

## 3. Names and logos

The name "Super BoundHaven", its logo and branding are not licensed for use as the name of a derivative product (the licenses above grant no trademark rights). You may say your project is "based on" or "inspired by" Super BoundHaven.

## 4. Third parties

Build and runtime dependencies are open-source packages under their own licenses (see `package-lock.json`). Super Mario World and other game names appear only as inspiration or craft references; those trademarks belong to their owners and SBH is unaffiliated. No third-party game assets, code or ROMs are included.

## 5. Contributions

If contributions are accepted in future, they are licensed under the same terms as the files they modify (MIT for code, CC BY-NC-SA 4.0 for content).

The owner may change the licensing of future versions; versions already published remain under the license they were published with.
