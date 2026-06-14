/**
 * Procedural world + map generation.
 * generateWorld: symbolic structure from a seed (locations / characters / objects / tone).
 * generateMap: a deterministic tile grid + place nodes, reproducible per seed.
 */

import { rngFromSeed, randInt, pick, type Rng } from "./rng";
import type { AmalgamState, NarrativeMode } from "./amalgam";

export type World = {
  seed: string;
  title: string;
  tone: string;
  locations: string[];
  characters: string[];
  objects: string[];
};

const GENERIC_LOCATIONS = [
  "the Hollow Crossing",
  "the Sunken Library",
  "the Ash Garden",
  "the Mirror Gate",
  "the Whispering Market",
  "the Drowned Cathedral",
  "the Hanging Bridges",
  "the Glass Wastes",
  "the Lantern Wood",
  "the Forgotten Stair",
];
const GENERIC_CHARACTERS = [
  "the Keeper of small debts",
  "a child who never blinks",
  "the wandering cartographer",
  "the masked confessor",
  "a soldier with no war",
  "the woman made of bells",
  "the hermit of the well",
  "a twin you never had",
];
const GENERIC_OBJECTS = [
  "a key that fits no door",
  "a mirror that lies",
  "a letter sealed in wax",
  "a blade that hums",
  "a coin worn smooth",
  "a lantern with green flame",
  "a map of a city that burned",
];

type Lexicon = { tone: string; locations: string[]; characters: string[]; objects: string[] };

const IP_LIBRARY: { match: RegExp; lex: Lexicon }[] = [
  {
    match: /harry|potter|hogwarts|wizard|magic/i,
    lex: {
      tone: "dark British wonder",
      locations: ["the Forbidden Forest", "the Great Hall", "the Astronomy Tower", "Diagon Alley"],
      characters: ["a grave headmaster", "a loyal red-haired friend", "a clever bookish ally", "a pale enemy"],
      objects: ["a humming wand", "an old locket", "a worn map of corridors"],
    },
  },
  {
    match: /narnia|aslan|witch|wardrobe/i,
    lex: {
      tone: "epic, childlike myth",
      locations: ["the Wardrobe", "the Lamp-post", "Cair Paravel", "the Frozen River"],
      characters: ["a great lion", "a faun with a parcel", "a pale queen", "a talking beaver"],
      objects: ["a silver dagger", "a horn that calls aid", "a vial of cordial"],
    },
  },
  {
    match: /ring|tolkien|hobbit|middle|mordor/i,
    lex: {
      tone: "high heroic dread",
      locations: ["the Green Hills", "the Mines below", "the White City", "the Black Gate"],
      characters: ["a grey wandering wizard", "a sworn ranger", "a small brave bearer", "a fallen steward"],
      objects: ["a plain golden ring", "a shard of a sword", "a phial of starlight"],
    },
  },
  {
    match: /cyber|neon|chrome|net|2077|blade/i,
    lex: {
      tone: "neon-soaked noir",
      locations: ["the Rain Market", "the Server Cathedral", "the Rooftop Sprawl", "the Black Clinic"],
      characters: ["a burned-out fixer", "an AI in a dead body", "a corp enforcer", "a street oracle"],
      objects: ["a cracked neural shard", "a chrome pistol", "a stolen access key"],
    },
  },
];

export function generateWorld(seedRaw: string): World {
  const seed = (seedRaw || "an open mythic world").trim();
  const rng = rngFromSeed(seed);
  const found = IP_LIBRARY.find((e) => e.match.test(seed));

  let tone: string;
  let locPool: string[];
  let chrPool: string[];
  let objPool: string[];
  if (found) {
    ({ tone, locations: locPool, characters: chrPool, objects: objPool } = found.lex);
  } else {
    tone = /dark|grim|gothic/i.test(seed)
      ? "gothic dread"
      : /bright|hope|joy/i.test(seed)
        ? "luminous wonder"
        : "mysterious and neutral";
    locPool = GENERIC_LOCATIONS;
    chrPool = GENERIC_CHARACTERS;
    objPool = GENERIC_OBJECTS;
  }

  const take = (pool: string[], n: number): string[] => {
    const copy = [...pool];
    const out: string[] = [];
    for (let i = 0; i < n && copy.length; i++) {
      out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    }
    return out;
  };

  return {
    seed,
    title: seed.length > 42 ? seed.slice(0, 42) + "…" : seed,
    tone,
    locations: take(locPool, 3),
    characters: take(chrPool, 3),
    objects: take(objPool, 3),
  };
}

// ── Map ──────────────────────────────────────────────────────────────

export type Tile = 0 | 1; // 0 floor, 1 wall
export type NodeKind = "location" | "character" | "object";
export type PlaceNode = {
  id: string;
  kind: NodeKind;
  label: string;
  x: number; // tile coords
  y: number;
  visited: boolean;
};

export type GameMap = {
  w: number;
  h: number;
  tiles: Tile[][];
  nodes: PlaceNode[];
  spawn: { x: number; y: number };
};

function biomeFromMode(mode: NarrativeMode): { density: number } {
  // rupture -> denser/mazier, integration -> open
  if (mode === "rupture") return { density: 0.16 };
  if (mode === "integration") return { density: 0.05 };
  return { density: 0.1 };
}

export function generateMap(world: World, state: AmalgamState, mode: NarrativeMode): GameMap {
  const rng: Rng = rngFromSeed(world.seed + ":map");
  const w = 24;
  const h = 24;
  const { density } = biomeFromMode(mode);

  const tiles: Tile[][] = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return 1 as Tile;
      return (rng() < density ? 1 : 0) as Tile;
    }),
  );

  // carve a clear spawn area in the center
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  for (let y = cy - 2; y <= cy + 2; y++)
    for (let x = cx - 2; x <= cx + 2; x++) tiles[y][x] = 0;

  const nodes: PlaceNode[] = [];
  const placeNode = (kind: NodeKind, label: string, i: number) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = randInt(rng, 2, w - 3);
      const y = randInt(rng, 2, h - 3);
      if (tiles[y][x] === 1) continue;
      if (Math.abs(x - cx) < 3 && Math.abs(y - cy) < 3) continue;
      if (nodes.some((n) => Math.abs(n.x - x) < 3 && Math.abs(n.y - y) < 3)) continue;
      tiles[y][x] = 0;
      nodes.push({ id: `${kind}-${i}`, kind, label, x, y, visited: false });
      return;
    }
  };

  world.locations.forEach((l, i) => placeNode("location", l, i));
  world.characters.forEach((c, i) => placeNode("character", c, i));
  world.objects.forEach((o, i) => placeNode("object", o, i));

  return { w, h, tiles, nodes, spawn: { x: cx, y: cy } };
}
