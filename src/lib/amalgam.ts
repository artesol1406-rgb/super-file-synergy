/**
 * Amalgam Engine V11 (simplified) — a grammar of coherence.
 *
 * Observer state Ψ: 7 chakras (activation / block / coherence),
 * global coherence, tension (τ), curvature energy (E_curv),
 * dynamic rigidity (κ) and luck (L).
 *
 * It lives on the client, evolves each turn from the player's action and is
 * sent to the Keeper as an INVISIBLE compass (Law of Total Mirror): the world
 * reflects Ψ without the mechanic ever being named inside the fiction.
 */

export type Chakra = {
  /** C1..C7 */
  key: string;
  name: string;
  /** what this center awakens, in one word */
  aspect: string;
  activation: number; // 0..1
  block: number; // 0..1
  coherence: number; // 0..1
};

export type Psi = {
  version: 1;
  chakras: Chakra[];
  coherence: number; // 0..1 global
  tension: number; // τ 0..1
  curvature: number; // E_curv accumulated (>=0)
  kappa: number; // rigidity 0.1..1
  luck: number; // L 0..1
  cycle: number;
  highTensionStreak: number;
  lowCurvatureStreak: number;
  lastGroup: string | null;
};

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

const CHAKRA_DEFS: Omit<Chakra, "activation" | "block" | "coherence">[] = [
  { key: "C1", name: "Root", aspect: "survival" },
  { key: "C2", name: "Sacral", aspect: "desire" },
  { key: "C3", name: "Solar Plexus", aspect: "will" },
  { key: "C4", name: "Heart", aspect: "empathy" },
  { key: "C5", name: "Throat", aspect: "expression" },
  { key: "C6", name: "Third Eye", aspect: "insight" },
  { key: "C7", name: "Crown", aspect: "transcendence" },
];

export function createPsi(): Psi {
  return {
    version: 1,
    chakras: CHAKRA_DEFS.map((c) => ({ ...c, activation: 0.42, block: 0.12, coherence: 0.5 })),
    coherence: 0.5,
    tension: 0.25,
    curvature: 0,
    kappa: 0.5,
    luck: 0.5,
    cycle: 0,
    highTensionStreak: 0,
    lowCurvatureStreak: 0,
    lastGroup: null,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

type Group =
  | "force"
  | "calm"
  | "empathy"
  | "expression"
  | "desire"
  | "denial"
  | "introspection";

const KEYWORDS: Record<Group, string[]> = {
  force: [
    "attack", "force", "control", "break", "kill", "fight", "strike", "smash", "dominate", "crush",
    "atac", "golpe", "forz", "domin", "romp", "mat", "destru", "lucha", "pele", "empuj",
  ],
  calm: [
    "meditate", "observe", "breathe", "rest", "wait", "release", "watch", "still", "pause", "calm",
    "medit", "observ", "respir", "esper", "suelt", "descans", "rend", "contempl", "quiet",
  ],
  empathy: [
    "help", "hug", "listen", "comfort", "forgive", "love", "care", "protect", "save", "tend",
    "ayud", "abraz", "escuch", "consuel", "perdon", "amar", "amo", "cuid", "acompañ", "salv", "protej",
  ],
  expression: [
    "speak", "say", "sing", "shout", "ask", "tell", "confess", "declare", "answer", "scream",
    "dec", "habl", "confies", "confes", "grit", "cant", "cuent", "declar", "pregunt", "respond",
  ],
  desire: [
    "desire", "kiss", "touch", "fuck", "eat", "drink", "taste", "seduce", "crave", "caress",
    "dese", "toc", "bes", "foll", "sexo", "com", "beb", "saborea", "acarici", "seduc",
  ],
  denial: [
    "flee", "hide", "deny", "ignore", "lie", "avoid", "retreat", "abandon", "run", "refuse",
    "huy", "huir", "escond", "nieg", "negar", "ignor", "mient", "mentir", "evit", "rehus", "retroced", "abandon",
  ],
  introspection: [
    "think", "remember", "dream", "imagine", "reflect", "doubt", "wonder", "ponder",
    "piens", "pens", "recuerd", "sueñ", "imagin", "reflexion", "record", "dud",
  ],
};

function detectGroup(action: string): Group {
  const n = normalize(action);
  let best: Group = "introspection";
  let bestScore = 0;
  (Object.keys(KEYWORDS) as Group[]).forEach((g) => {
    const score = KEYWORDS[g].reduce((acc, kw) => (n.includes(normalize(kw)) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      best = g;
      bestScore = score;
    }
  });
  return best;
}

// chakra index by key (0-based)
const idx = (key: string) => CHAKRA_DEFS.findIndex((c) => c.key === key);

function bump(ch: Chakra, dAct: number, dBlock: number, dCoh: number): Chakra {
  return {
    ...ch,
    activation: clamp(ch.activation + dAct),
    block: clamp(ch.block + dBlock),
    coherence: clamp(ch.coherence + dCoh),
  };
}

export type StepResult = { psi: Psi; directives: string[] };

/**
 * Advance the state by one cycle from the player's action.
 */
export function stepPsi(prev: Psi, action: string, _mode: string): StepResult {
  const group = detectGroup(action);
  const before = prev.chakras.map((c) => c.activation);
  let chakras = prev.chakras.map((c) => ({ ...c }));

  const repeat = prev.lastGroup === group;
  const noise = () => (Math.random() - 0.5) * 0.06;

  switch (group) {
    case "force":
      chakras[idx("C3")] = bump(chakras[idx("C3")], 0.16, 0.02, -0.04);
      chakras[idx("C6")] = bump(chakras[idx("C6")], -0.08, 0.04, -0.03);
      chakras[idx("C1")] = bump(chakras[idx("C1")], 0.06, 0, 0);
      break;
    case "calm":
      chakras[idx("C6")] = bump(chakras[idx("C6")], 0.1, -0.05, 0.06);
      chakras[idx("C7")] = bump(chakras[idx("C7")], 0.1, -0.05, 0.06);
      chakras = chakras.map((c) => bump(c, 0, -0.03, 0.02));
      break;
    case "empathy":
      chakras[idx("C4")] = bump(chakras[idx("C4")], 0.16, -0.04, 0.06);
      chakras[idx("C2")] = bump(chakras[idx("C2")], 0.05, 0, 0.02);
      break;
    case "expression":
      chakras[idx("C5")] = bump(chakras[idx("C5")], 0.16, -0.06, 0.05);
      break;
    case "desire":
      chakras[idx("C2")] = bump(chakras[idx("C2")], 0.16, -0.02, 0.02);
      chakras[idx("C1")] = bump(chakras[idx("C1")], 0.05, 0, 0);
      break;
    case "denial":
      chakras = chakras.map((c) => bump(c, -0.02, 0.07, -0.05));
      break;
    case "introspection":
      chakras[idx("C6")] = bump(chakras[idx("C6")], 0.12, -0.02, 0.05);
      break;
  }

  // ── rigidity κ: softens with calm, hardens with repetition ──
  let kappa = prev.kappa;
  if (group === "calm") kappa = clamp(kappa - 0.05, 0.1, 1);
  if (repeat) kappa = clamp(kappa + 0.1, 0.1, 1);

  // ── derived metrics ──
  const acts = chakras.map((c) => c.activation);
  const meanAct = acts.reduce((a, b) => a + b, 0) / acts.length;
  const variance = acts.reduce((a, b) => a + (b - meanAct) ** 2, 0) / acts.length;
  const balance = clamp(1 - variance * 4); // low variance => high balance
  const meanCoh = chakras.reduce((a, c) => a + c.coherence, 0) / chakras.length;
  const meanBlock = chakras.reduce((a, c) => a + c.block, 0) / chakras.length;

  const coherence = clamp(meanCoh * 0.55 + balance * 0.45 - meanBlock * 0.25 + noise());
  const tension = clamp(meanBlock * 0.55 + (1 - balance) * 0.45);
  const luck = clamp(coherence * 0.7 + balance * 0.3 + noise());

  // ── curvature energy: accumulated historical tension (scaled by κ) ──
  const delta = before.reduce((a, b, i) => a + Math.abs(b - acts[i]), 0);
  const curvStep = delta * (0.5 + kappa);
  const curvature = prev.curvature + curvStep;

  // ── streaks for corrective events ──
  const highTensionStreak = tension > 0.7 ? prev.highTensionStreak + 1 : 0;
  const lowCurvatureStreak = curvStep < 0.04 ? prev.lowCurvatureStreak + 1 : 0;

  const psi: Psi = {
    ...prev,
    chakras,
    coherence,
    tension,
    curvature,
    kappa,
    luck,
    cycle: prev.cycle + 1,
    highTensionStreak,
    lowCurvatureStreak,
    lastGroup: group,
  };

  return { psi, directives: buildDirectives(psi) };
}

function buildDirectives(psi: Psi): string[] {
  const d: string[] = [];

  // render tone by coherence (Addendum: rendering language)
  if (psi.coherence > 0.66) {
    d.push("World tone: open, flowing, resonant, clear. Little friction; the world answers with openness.");
  } else if (psi.coherence < 0.4) {
    d.push("World tone: heavy, dense, closed, opaque. Things cost more, paths narrow.");
  } else {
    d.push("World tone: variable and ambiguous; neither fully open nor fully closed.");
  }

  // luck L
  if (psi.luck > 0.66) d.push("Luck is open: allow a fortunate synchronicity (a resource, an opening, a chance ally).");
  else if (psi.luck < 0.35) d.push("Luck is closed: coincidence does not favor; what could go well goes awry.");

  // corrective event from sustained tension
  if (psi.highTensionStreak >= 3) {
    d.push("CORRECTIVE SYSTEM: tension persists. Let an obstacle or pattern recur, let the surroundings grow denser, pressing gently toward change. Do not punish; reflect and amplify. Never explain why.");
  }

  // fertile noise from flat curvature
  if (psi.lowCurvatureStreak >= 4) {
    d.push("FERTILE NOISE: the path has gone too flat. Introduce an element of surprise that reintroduces movement: an unexpected encounter, a crack in the predictable. No gratuitous violence.");
  }

  // dominant / most-blocked chakra as symbolic attractor
  const dom = [...psi.chakras].sort((a, b) => b.activation - a.activation)[0];
  const blocked = [...psi.chakras].sort((a, b) => b.block - a.block)[0];
  d.push(`Lit center: ${dom.name} (${dom.aspect}). Let the scene vibrate with that aspect, embodied as place, creature, weather or object — never named.`);
  if (blocked.block > 0.45) {
    d.push(`Blocked center: ${blocked.name} (${blocked.aspect}). Let the world brush that wound without pointing at it.`);
  }

  return d;
}

/**
 * English block injected into the Keeper's system prompt.
 * It is an INVISIBLE compass: it steers the scene, never mentioned in the fiction.
 */
export function summarizeForPrompt(psi: Psi, directives: string[]): string {
  return `# Player's inner compass (Amalgam — INVISIBLE, never name it in the fiction)
This is the player's coherence state (Ψ) right now. Use it ONLY to decide what the scene collapses toward: what appears, with what density, with what luck. Never mention chakras, coherence, tension, energy, formulas, or "your inner world". The world is the only language: firelight, steel, fog, blood, skin.

- Global coherence: ${(psi.coherence * 100).toFixed(0)}%
- Tension (τ): ${(psi.tension * 100).toFixed(0)}%
- Luck (L): ${(psi.luck * 100).toFixed(0)}%
- Rigidity (κ): ${psi.kappa.toFixed(2)} ${psi.kappa > 0.7 ? "(rigid, struggles to flow)" : psi.kappa < 0.35 ? "(flexible, flows)" : ""}

Manifestation directives for this turn:
${directives.map((x) => `- ${x}`).join("\n")}`;
}

/** Short poetic note for the visible "Inner Mirror" panel. */
export function poeticNote(psi: Psi): string {
  if (psi.coherence > 0.7) return "The inner waters are still; the world answers without resistance.";
  if (psi.tension > 0.7) return "Something tightens within; the world grows dense around you.";
  if (psi.luck > 0.7) return "There is synchronicity in the air: doors open on their own.";
  if (psi.coherence < 0.4) return "There is fog at the center; the paths narrow until you change.";
  return "The mirror wavers, seeking its shape.";
}
