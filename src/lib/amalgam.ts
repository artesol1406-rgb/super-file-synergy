/**
 * AMALGAM ENGINE V8 — faithful TypeScript port of the PDF "Narrative Core".
 *
 * Structural silence: this state is NEVER shown to the player as numbers.
 * It is an invisible compass that steers what the world collapses toward.
 *
 * State:
 *  - CP: 7-channel temperament vector (0..1), seeded from the universe seed.
 *  - K : karmic memory matrix (7x7), nudged by APR toward global coherence 0.5.
 *  - T : tension tensor (7x7), |CP[i]-CP[j]| modulated by K.
 *  - life arcana: the player's fixed destiny (derived from the seed).
 *  - active arcana / hero stage: evolve each step.
 */

import { hashSeed, mulberry32, type Rng } from "./rng";

export const CP_CHANNELS = [
  "Survival",
  "Desire",
  "Will",
  "Heart",
  "Voice",
  "Vision",
  "Spirit",
] as const;

// 22 major arcana (0..21)
export const ARCANA = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Justice",
  "The Hermit",
  "Wheel of Fortune",
  "Strength",
  "The Hanged Man",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
] as const;

export const OPPOSITES: Record<string, string> = {
  "The Fool": "The World",
  "The Magician": "The Moon",
  "The High Priestess": "The Sun",
  "The Empress": "The Tower",
  "The Emperor": "The Devil",
  "The Hierophant": "Death",
  "The Lovers": "Judgement",
  "The Chariot": "The Hanged Man",
  Justice: "Strength",
  "The Hermit": "Wheel of Fortune",
  "Wheel of Fortune": "The Hermit",
  Strength: "Justice",
  "The Hanged Man": "The Chariot",
  Death: "The Hierophant",
  Temperance: "The Star",
  "The Devil": "The Emperor",
  "The Tower": "The Empress",
  "The Star": "Temperance",
  "The Moon": "The Magician",
  "The Sun": "The High Priestess",
  Judgement: "The Lovers",
  "The World": "The Fool",
};

// 32 personality signatures (16 polar L/E pairs)
export const PERSONALITY_32: Record<string, string> = {
  P1_L: "structural control",
  P1_E: "control anxiety",
  P2_L: "order",
  P2_E: "trust in flow",
  P3_L: "expansion",
  P3_E: "contraction",
  P4_L: "light",
  P4_E: "shadow",
  P5_L: "connection",
  P5_E: "isolation",
  P6_L: "action",
  P6_E: "reaction",
  P7_L: "creation",
  P7_E: "dissolution",
  P8_L: "memory",
  P8_E: "forgetting",
  P9_L: "the word",
  P9_E: "silence",
  P10_L: "form",
  P10_E: "void",
  P11_L: "center",
  P11_E: "periphery",
  P12_L: "time",
  P12_E: "eternity",
  P13_L: "life",
  P13_E: "death",
  P14_L: "wisdom",
  P14_E: "madness",
  P15_L: "power",
  P15_E: "service",
  P16_L: "identity",
  P16_E: "dissolution of identity",
};

export const HERO_STAGES = [
  "Ordinary world",
  "Call to adventure",
  "Refusal of the call",
  "Meeting the mentor",
  "Crossing the threshold",
  "Tests, allies, enemies",
  "Approach",
  "The ordeal",
  "The reward",
  "The road back",
  "Resurrection",
  "Return with the elixir",
] as const;

export type NarrativeMode = "integration" | "rupture" | "latent";

export type AmalgamState = {
  version: 8;
  seed: string;
  cp: number[]; // 7
  K: number[][]; // 7x7 karmic memory
  T: number[][]; // 7x7 tension
  step: number;
  lifeArcana: number; // fixed destiny 0..21
};

export const ACTIONS = ["explore", "talk", "fight", "flee", "meditate"] as const;
export type GameAction = (typeof ACTIONS)[number];

const FORCE: Record<string, number> = {
  explore: 0.05,
  talk: 0.02,
  fight: -0.1,
  flee: -0.05,
  meditate: 0.1,
  default: 0,
};

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

function mean(a: number[]): number {
  return a.reduce((x, y) => x + y, 0) / a.length;
}
function variance(a: number[]): number {
  const m = mean(a);
  return a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length;
}

function zeros(n: number): number[][] {
  return Array.from({ length: n }, () => new Array(n).fill(0));
}

/** Reduce a number to a single 0..21 arcana index (theosophical reduction). */
export function lifeArcana(num: number): number {
  let n = Math.abs(Math.floor(num));
  while (n > 21) {
    n = String(n)
      .split("")
      .reduce((acc, d) => acc + Number(d), 0);
  }
  return n;
}

/** Create the initial state from a universe seed (no birthdate needed). */
export function createState(seed: string): AmalgamState {
  const rng: Rng = mulberry32(hashSeed(seed || "void"));
  const cp = Array.from({ length: 7 }, () => clamp(0.25 + rng() * 0.5));
  const h = hashSeed(seed || "void");
  return {
    version: 8,
    seed,
    cp,
    K: zeros(7),
    T: zeros(7),
    step: 0,
    lifeArcana: lifeArcana(h % 100),
  };
}

/** Variance-minimizing flow: pull each channel toward the mean (coherence drive). */
function flow(cp: number[]): number[] {
  const m = mean(cp);
  return cp.map((v) => (m - v) * 0.18);
}

/** channels that a given action energizes most */
const ACTION_CHANNELS: Record<string, number[]> = {
  explore: [5, 1], // Vision, Desire
  talk: [4, 3], // Voice, Heart
  fight: [2, 0], // Will, Survival
  flee: [0, 6], // Survival, Spirit
  meditate: [6, 5], // Spirit, Vision
};

export function coherence(state: AmalgamState): number {
  return clamp(1 - variance(state.cp));
}

export function modeOf(coh: number): NarrativeMode {
  if (coh > 0.6) return "integration";
  if (coh < 0.4) return "rupture";
  return "latent";
}

export function heroStage(step: number): string {
  return HERO_STAGES[step % HERO_STAGES.length];
}

/** active arcana derived from the live CP mean (for scene flavor) */
export function activeArcana(state: AmalgamState): number {
  return Math.floor(mean(state.cp) * 21.999);
}

export function signatureOf(cp: number[]): { key: string; value: string } {
  const keys = Object.keys(PERSONALITY_32);
  const idx = Math.min(keys.length - 1, Math.floor(mean(cp) * (keys.length - 1)));
  const key = keys[idx];
  return { key, value: PERSONALITY_32[key] };
}

function tensionTensor(state: AmalgamState): number[][] {
  const { cp, K } = state;
  const T = zeros(7);
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 7; j++) T[i][j] = Math.abs(cp[i] - cp[j]) * (1 + K[i][j]);
  return T;
}

function aprUpdate(state: AmalgamState, target = 0.5): number[][] {
  const cur = 1 - variance(state.cp);
  const err = target - cur;
  return state.K.map((row) => row.map((k) => clamp(k + 0.01 * err)));
}

export type StepResult = {
  state: AmalgamState;
  mode: NarrativeMode;
  coherence: number;
  stage: string;
  active: number;
};

/** Advance one cycle from the player's action. Returns a NEW state. */
export function step(prev: AmalgamState, action: string): StepResult {
  const a = action.toLowerCase();
  const force = a in FORCE ? FORCE[a] : FORCE.default;
  const fl = flow(prev.cp);
  const channels = ACTION_CHANNELS[a] ?? [];

  const cp = prev.cp.map((v, i) => {
    const emphasis = channels.includes(i) ? force * 1.6 : force * 0.4;
    return clamp(v + fl[i] + emphasis);
  });

  const K = aprUpdate({ ...prev, cp });
  const next: AmalgamState = {
    ...prev,
    cp,
    K,
    step: prev.step + 1,
  };
  next.T = tensionTensor(next);

  const coh = coherence(next);
  return {
    state: next,
    mode: modeOf(coh),
    coherence: coh,
    stage: heroStage(next.step),
    active: activeArcana(next),
  };
}

const MODE_TONE: Record<NarrativeMode, string> = {
  integration:
    "Tone: harmony and flow. Doors open, allies appear, the air feels clear. Reward small courage.",
  rupture:
    "Tone: conflict and fracture. The ground is unsteady, shadows lengthen, what was certain cracks. Do not punish — reflect and amplify the pattern.",
  latent:
    "Tone: latent tension, ambiguous. Neither open nor closed; something waits beneath the surface.",
};

/**
 * Invisible compass injected into the AI system prompt.
 * Never reveals the engine; only steers the scene.
 */
export function summarizeForPrompt(
  res: StepResult,
  world?: { tone?: string; locations?: string[]; characters?: string[]; objects?: string[] },
): string {
  const s = res.state;
  const life = ARCANA[s.lifeArcana];
  const active = ARCANA[res.active];
  const opp = OPPOSITES[active] ?? "The Fool";
  const sig = signatureOf(s.cp);
  return `# Hidden compass (AMALGAM — INVISIBLE, never name it in the fiction)
Use this only to decide what the scene collapses toward. Never mention numbers, arcana, tension, coherence, channels or "your inner world". The world is the only language.

- Hero stage: ${res.stage}
- Narrative mode: ${res.mode}. ${MODE_TONE[res.mode]}
- Destiny (fixed): ${life} — let it haunt the story as fate, a scar, a guiding star.
- Active current: ${active} (its shadow-opposite is ${opp}). Let this color the scene, embodied as place, weather, creature or object — never named.
- Disposition: ${sig.value}.
${world?.tone ? `- Literary tone of this universe: ${world.tone}.` : ""}
${world?.locations?.length ? `- Emblematic places: ${world.locations.join(", ")}.` : ""}
${world?.characters?.length ? `- Key figures: ${world.characters.join(", ")}.` : ""}
${world?.objects?.length ? `- Objects of tension: ${world.objects.join(", ")}.` : ""}`;
}

/** Offline fallback narration — a procedural template skeleton. */
export function proceduralEvent(
  res: StepResult,
  world: { tone?: string; locations?: string[]; characters?: string[]; objects?: string[] },
  action: string,
): string {
  const loc = world.locations?.[res.state.step % (world.locations?.length || 1)] ?? "the crossing";
  const chr = world.characters?.[(res.state.step + 1) % (world.characters?.length || 1)] ?? "a stranger";
  const obj = world.objects?.[(res.state.step + 2) % (world.objects?.length || 1)] ?? "an old key";
  const verb =
    {
      explore: "You press deeper into",
      talk: "You turn your words toward",
      fight: "You raise your hand against",
      flee: "You pull away from",
      meditate: "You go still within",
    }[action.toLowerCase()] ?? "You move through";

  const moodLine =
    res.mode === "integration"
      ? "A strange ease settles over everything; the way seems to want you through."
      : res.mode === "rupture"
        ? "The air turns heavy and the edges of things refuse to hold still."
        : "Something hangs unspoken, neither welcome nor warning.";

  return `${verb} ${loc}. ${moodLine} Near ${obj}, the shape of ${chr} waits at the rim of your attention.\n\nWhat do you do?`;
}
