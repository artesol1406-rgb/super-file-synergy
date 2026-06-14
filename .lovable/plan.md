## Goal

Replace the current Mirror-Keeper RPG with a **procedurally generated game** (working title **AMALGAM** — easy to rename) that combines the **pixel-art source files from the uploaded zip** with the **Amalgam Engine V8 logic from the PDF**. It's **hybrid**: you walk a procedurally generated world AND read narrative panels. Story text is a **procedural skeleton elaborated by AI**, with an offline template fallback. The birthdate step is skipped — the arcana is derived from the universe seed.

Crucially, the base sprite and texture files are treated as **raw material**: the engine generates **recolored / re-arranged copies** of them to create distinct characters and varied world maps for each seed.

## What gets built

### 1. Source files → CDN
Upload the zip's media to Lovable CDN (keeps the repo light), referenced via `.asset.json` pointers:
- 8-direction sprite sets: `breathing-idle`, `walking`, `running`, `jumping` (the base character).
- `WoodenFloorTexture.jpg`, the pixel cursor, `click.mp3`, ambient `videoplayback.m4a`, large background `18683881.gif`.
- *Press Start 2P* font loaded in the root route.

### 2. Procedural asset variation — `src/lib/procArt.ts`
Generate **copies** of the base files instead of shipping many art files:
- **Characters**: from one base sprite set, derive distinct NPCs/the player by applying deterministic per-entity transforms (hue-rotate / saturation / brightness / contrast, optional flip) computed from the seed + the entity's arcana/personality signature. Each archetype (e.g. mentor, shadow, ally) gets a stable palette so the same seed reproduces the same cast. Applied as CSS filters on the animated sprite so GIF animation is preserved.
- **World maps / biomes**: tint and combine the floor texture + decor into per-region "biomes" (color grade driven by narrative mode — integration = warm/clear, rupture = cold/dense, latent = muted). Built on a `<canvas>` so tiles can be recolored and stamped.

### 3. Amalgam Engine V8 (faithful port) — `src/lib/amalgam.ts` (rewritten)
Port the PDF's math to TypeScript, keeping "structural silence" (never shown to player):
- `CP`: 7-channel temperament vector seeded deterministically from the universe seed.
- `update_cp` (variance-minimizing flow + external force), `tension_tensor` (7×7), `apr_update` (karmic memory K → coherence 0.5).
- Force map: `explore +0.05`, `fight -0.1`, `talk +0.02`, `flee -0.05`, `meditate +0.1`.
- `life_arcana` over the 22 arcana, `OPPOSITES` matrix, `PERSONALITY_32` signatures, 12 hero-journey stages.
- Mode from coherence: `>0.6` integration, `<0.4` rupture, else latent tension.
- `summarizeForPrompt(state)` (invisible AI compass) + `proceduralEvent(state, world)` (offline template text).

### 4. Procedural world — `src/lib/world.ts`
- `generateWorld(seed)`: 3 locations, 3 characters (archetypes), 3 tension-objects, literary tone from seed keywords (PDF heuristics + generic fallbacks for any IP).
- `generateMap(seed, state)`: deterministic tile grid + scattered **place nodes** (per location/character/object), biome color grade from the current mode. Seeded RNG → same seed reproduces the same map and cast.

### 5. Walkable world view — `src/components/WorldCanvas.tsx`
- Top-down renderer: tiled, biome-tinted floor, place-node markers, and the player drawn from a **procedurally recolored** sprite, swapping idle/walk by movement + 8-direction facing.
- WASD/arrow + on-screen D-pad (mobile-first, 432×812). Walk into / tap a nearby node → fires a turn. NPC nodes show their derived character sprite.

### 6. Narrative + turn loop — `src/routes/index.tsx` (rewritten)
- **Menu/lock screen** (pixel font, ambient music toggle, custom cursor): Singleplayer, Multiplayer (Coming Soon, disabled), Options. No app-name lock to "CloverTale".
- **New game**: prompt only for a **universe seed**; engine seeds CP + derives the life arcana, generates world, map, and the recolored cast.
- **Turn loop** each action (move-into-node or verb explore/talk/fight/flee/meditate):
  1. advance CP/T/K, mode, stage;
  2. build procedural skeleton from mode+arcana+stage+world;
  3. **hybrid narration** — POST `/api/chat` with skeleton + invisible compass for AI prose; on failure/offline, render the template.
- Optional hidden "Inner Mirror" debug panel (off by default — structural silence).

### 7. Backend narration — `src/routes/api/chat.ts` (updated)
System prompt rewritten to the Amalgam V8 contract: immersive narrative only; never name CP/tension/arcana; respect the seed universe's internal logic; reflect current mode/stage; end inviting a new action. Receives compass + skeleton. `companion.ts` / `scene-image.ts` kept.

### 8. Continuity (unchanged rule)
No "continue from memory" — a fresh launch always starts a new game. Keep optional **Save/Load Memory PDF** (now serializing V8 state) so a run resumes only from an uploaded file.

## Technical notes

```text
Menu ─"Singleplayer"─▶ Seed prompt ─▶ generateWorld + seed CP/arcana + procArt cast/biomes
        │                                              │
        ▼                                              ▼
  WorldCanvas (walk, recolored 8-dir sprite) ◀── generateMap(seed, state)
        │ enter node / action verb
        ▼
  amalgam step (CP→T→K, mode, stage) ─▶ proceduralEvent (skeleton)
        ├── online: POST /api/chat (skeleton + invisible compass) ─▶ AI prose
        └── offline/error: procedural template
```

- Deterministic seeded RNG (mulberry32 + string hash) → reproducible worlds, casts and maps per seed.
- Character/biome variety comes from **transforming the base files** (CSS filters for sprites, canvas recolor for tiles), not from new committed art.
- Big media + sprites served from CDN pointers, never committed as binaries.
- Engine is 100% client-side; server only receives the compass (no persistence), matching the no-DB architecture.
- Tailwind v4 tokens + pixel font; touch-first for the 432-wide preview, scaling up on desktop.

## Out of scope
Multiplayer (stays "Coming Soon"), the Store, accounts/database, and any reveal of the engine internals to the player.