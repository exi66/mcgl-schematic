# mcgl-shcematica-viewer — notes for the agent

Static web viewer for Minecraft Galaxy (MCGL) MCEdit `.schematic` files. View only, no editing.
User-facing docs: `README.md`. Open work: `TODO.md`. UI text and docs are in Russian.

## Commands

```
pnpm dev                  # vite (runs build:icons first)
pnpm test                 # vitest: test/**/*.test.ts
pnpm typecheck            # tsc -b
pnpm build                # tsc -b && vite build → dist/ (runs build:icons first)
pnpm build:icons          # scripts/build-icons.ts → public/assets/fx-icons.png
pnpm make:test-schematic  # scripts/test-scene.ts → test/fixtures/ + public/examples/all-blocks.schematic
```

Check every change with `pnpm typecheck && pnpm test && pnpm build`; for anything visual also look at it in the
browser (Playwright): `?url=./examples/all-blocks.schematic`, the dev build exposes the viewer as
`window.__viewer`.

## Rules

- **Self-contained.** The game client and server may be read to learn mechanics, but the repo must not reference
  them (no absolute paths, no imports, no links in docs). Every resource used is copied in. Paths to the client
  and server sources are not stored here — ask the user.
- **Faithful to the game client.** Rendering is ported from the client's code (RenderBlocks, block classes,
  texture FX, XML models), not invented. When adding a block, find its class in the client: texture per side and
  meta, render type, bounds, connections. Write down where a behaviour came from in a comment.
- **Atlas** `public/assets/terrain.png` is the client's `terrain.png` from `original.jar`, copied as is. Slot →
  pixel: `src/render/atlas.ts` (two 16×32 halves). Animated slots are generated at runtime
  (`src/render/texfx.ts`, ported non-HD texture effects); never use the client's `custom_*` HD files.
- **Names** shown to the user come from the game's item info (`src/blocks/iteminfo.json`, generated from the
  client's `ahiteminf.ini`, format `id|meta|name|description`).
- Commit only when asked. Tags `v*` deploy to GitHub Pages (`.github/workflows/pages.yml`).

## Layout

```
src/schematic/   NBT reader/writer, .schematic parsing (pure TS)
src/blocks/      pool.ts — block table (id → render kind, textures, model, pass); iteminfo — game names
src/render/      mesher.ts (geometry per block kind), faces.ts (client face/UV code), model.ts (XML models),
                 transport.ts (transport pipes, port of render type 130), texfx.ts (animated tiles),
                 viewer.ts (three.js scene, cameras, picking, slicing), explore.ts (first person), overlays.ts
src/ui/          React components (shadcn style, Radix primitives, Tailwind v4, Geist Mono from the preset)
src/app/         loading, URL state, material list export (Markdown / forum BBCode)
scripts/         test scene and icon generation (run with tsx)
public/assets/   terrain.png, fx-icons.png (generated), models/<name>/<last part>.xml|png (client layout)
```

## Adding a block

1. Find the block class in the client: texture slots per side/meta (`getBlockTextureFromSideAndMetadata`),
   render type, opacity, bounds; for models — the client's model table (id → model per meta).
2. Add it to `src/blocks/pool.ts` (`def({...})`). New shapes go to `src/render/mesher.ts` as a render kind.
3. Models: copy `<model>.xml` and `.png` into `public/assets/models/<name>/`; `MODEL_NAMES` picks them up.
4. Add its meaningful metas to `variants()` in `scripts/test-scene.ts`, run `pnpm make:test-schematic`,
   check it in the browser.

## Conventions

- Sides as in the game: 0 bottom, 1 top, 2 −Z, 3 +Z, 4 −X, 5 +X. Block index `(y * length + z) * width + x`.
- Never mirror the scene: plan view is a rotation (screen up = −X, left = +Z).
- Blocks without tile entity data (schematics exported by the game have none) are drawn as the client draws
  them without it; connections that the client stores there (transport pipes) are derived from neighbours.
- UI: shadcn style, radius 0, Geist Mono everywhere; keyboard focus via the global `:focus-visible` rule.
