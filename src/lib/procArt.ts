/**
 * Procedural art: derive distinct character + biome appearances from the
 * single base sprite/texture set, using deterministic CSS filters.
 * Same seed + entity -> same look (GIF animation is preserved).
 */

import { hashSeed, mulberry32 } from "./rng";
import type { NarrativeMode } from "./amalgam";
import type { NodeKind } from "./world";

export type CharLook = {
  filter: string;
  flip: boolean;
};

/** A stable look for a given entity id within a seed. */
export function characterLook(seed: string, entityId: string): CharLook {
  const rng = mulberry32(hashSeed(`${seed}::${entityId}`));
  const hue = Math.floor(rng() * 360);
  const sat = (0.7 + rng() * 1.1).toFixed(2);
  const bright = (0.8 + rng() * 0.5).toFixed(2);
  const contrast = (0.9 + rng() * 0.4).toFixed(2);
  const flip = rng() > 0.5;
  return {
    filter: `hue-rotate(${hue}deg) saturate(${sat}) brightness(${bright}) contrast(${contrast})`,
    flip,
  };
}

/** Player look stays close to the base art (subtle tint only). */
export function playerLook(seed: string): CharLook {
  const rng = mulberry32(hashSeed(`${seed}::player`));
  const hue = Math.floor(rng() * 40) - 20;
  return {
    filter: `hue-rotate(${hue}deg) saturate(1.05) brightness(1) contrast(1.05)`,
    flip: false,
  };
}

/** Node markers get a hue family by kind. */
export function nodeHue(kind: NodeKind): number {
  if (kind === "character") return 30; // warm
  if (kind === "object") return 280; // violet
  return 140; // location -> green
}

/** Biome color grade for the floor canvas, driven by narrative mode. */
export function biomeGrade(mode: NarrativeMode): {
  tint: string; // rgba overlay
  filter: string; // canvas filter applied while drawing tiles
} {
  if (mode === "integration")
    return { tint: "rgba(255, 214, 140, 0.16)", filter: "saturate(1.15) brightness(1.05)" };
  if (mode === "rupture")
    return { tint: "rgba(40, 60, 120, 0.34)", filter: "saturate(0.6) brightness(0.7) contrast(1.1)" };
  return { tint: "rgba(120, 110, 130, 0.18)", filter: "saturate(0.85) brightness(0.9)" };
}
