/**
 * Motor Amalgam V11 (simplificado) — Gramática de coherencia.
 *
 * Estado del observador Ψ: 7 chakras (activación / bloqueo / coherencia),
 * coherencia global, tensión (τ), energía de curvatura (E_curv),
 * rigidez dinámica (κ) y suerte (L).
 *
 * Vive en el cliente, evoluciona por turno según la acción del jugador y se
 * envía al Guardián como brújula INVISIBLE (Ley de Espejo Total): el mundo
 * refleja Ψ sin que la mecánica se nombre jamás dentro de la ficción.
 */

export type Chakra = {
  /** C1..C7 */
  key: string;
  name: string;
  /** lo que despierta este centro, en una palabra */
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
  curvature: number; // E_curv acumulada (>=0)
  kappa: number; // rigidez 0.1..1
  luck: number; // L 0..1
  cycle: number;
  highTensionStreak: number;
  lowCurvatureStreak: number;
  lastGroup: string | null;
};

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

const CHAKRA_DEFS: Omit<Chakra, "activation" | "block" | "coherence">[] = [
  { key: "C1", name: "Raíz", aspect: "supervivencia" },
  { key: "C2", name: "Sacro", aspect: "deseo" },
  { key: "C3", name: "Plexo Solar", aspect: "voluntad" },
  { key: "C4", name: "Corazón", aspect: "empatía" },
  { key: "C5", name: "Garganta", aspect: "expresión" },
  { key: "C6", name: "Tercer Ojo", aspect: "introspección" },
  { key: "C7", name: "Corona", aspect: "trascendencia" },
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
  | "fuerza"
  | "calma"
  | "empatia"
  | "expresion"
  | "deseo"
  | "negacion"
  | "introspeccion";

const KEYWORDS: Record<Group, string[]> = {
  fuerza: [
    "atac", "golpe", "forz", "domin", "control", "romp", "mat", "destru", "lucha", "pele",
    "empuj", "grit de guerra", "attack", "force", "control", "break", "kill", "fight", "strike", "smash",
  ],
  calma: [
    "medit", "observ", "respir", "esper", "suelt", "descans", "calm", "rend", "contempl", "quiet",
    "paus", "meditate", "observe", "breathe", "rest", "wait", "release", "watch", "still",
  ],
  empatia: [
    "ayud", "abraz", "escuch", "consuel", "perdon", "am ", "amar", "amo", "cuid", "acompañ", "salv", "protej",
    "help", "hug", "listen", "comfort", "forgive", "love", "care", "protect", "save",
  ],
  expresion: [
    "dec", "habl", "confies", "confes", "grit", "cant", "cuent", "declar", "pregunt", "respond",
    "speak", "say", "sing", "shout", "ask", "tell", "confess",
  ],
  deseo: [
    "dese", "toc", "bes", "foll", "sexo", "com", "beb", "abr la boc", "saborea", "acarici", "seduc",
    "desire", "kiss", "touch", "fuck", "eat", "drink", "taste", "seduce",
  ],
  negacion: [
    "huy", "huir", "escond", "nieg", "negar", "ignor", "mient", "mentir", "evit", "rehus", "retroced", "abandon",
    "flee", "hide", "deny", "ignore", "lie", "avoid", "retreat", "abandon",
  ],
  introspeccion: [
    "piens", "pens", "recuerd", "sueñ", "imagin", "mir dentro", "reflexion", "record", "dud",
    "think", "remember", "dream", "imagine", "reflect", "doubt",
  ],
};

function detectGroup(action: string): Group {
  const n = normalize(action);
  let best: Group = "introspeccion";
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

// índice de chakra por clave (0-based)
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
 * Avanza el estado un ciclo según la acción del jugador.
 */
export function stepPsi(prev: Psi, action: string, _mode: string): StepResult {
  const group = detectGroup(action);
  const before = prev.chakras.map((c) => c.activation);
  let chakras = prev.chakras.map((c) => ({ ...c }));

  const repeat = prev.lastGroup === group;
  const noise = () => (Math.random() - 0.5) * 0.06;

  switch (group) {
    case "fuerza":
      chakras[idx("C3")] = bump(chakras[idx("C3")], 0.16, 0.02, -0.04);
      chakras[idx("C6")] = bump(chakras[idx("C6")], -0.08, 0.04, -0.03);
      chakras[idx("C1")] = bump(chakras[idx("C1")], 0.06, 0, 0);
      break;
    case "calma":
      chakras[idx("C6")] = bump(chakras[idx("C6")], 0.1, -0.05, 0.06);
      chakras[idx("C7")] = bump(chakras[idx("C7")], 0.1, -0.05, 0.06);
      chakras = chakras.map((c) => bump(c, 0, -0.03, 0.02));
      break;
    case "empatia":
      chakras[idx("C4")] = bump(chakras[idx("C4")], 0.16, -0.04, 0.06);
      chakras[idx("C2")] = bump(chakras[idx("C2")], 0.05, 0, 0.02);
      break;
    case "expresion":
      chakras[idx("C5")] = bump(chakras[idx("C5")], 0.16, -0.06, 0.05);
      break;
    case "deseo":
      chakras[idx("C2")] = bump(chakras[idx("C2")], 0.16, -0.02, 0.02);
      chakras[idx("C1")] = bump(chakras[idx("C1")], 0.05, 0, 0);
      break;
    case "negacion":
      chakras = chakras.map((c) => bump(c, -0.02, 0.07, -0.05));
      break;
    case "introspeccion":
      chakras[idx("C6")] = bump(chakras[idx("C6")], 0.12, -0.02, 0.05);
      break;
  }

  // ── rigidez κ: se ablanda con la calma, se endurece con la repetición ──
  let kappa = prev.kappa;
  if (group === "calma") kappa = clamp(kappa - 0.05, 0.1, 1);
  if (repeat) kappa = clamp(kappa + 0.1, 0.1, 1);

  // ── métricas derivadas ──
  const acts = chakras.map((c) => c.activation);
  const meanAct = acts.reduce((a, b) => a + b, 0) / acts.length;
  const variance = acts.reduce((a, b) => a + (b - meanAct) ** 2, 0) / acts.length;
  const balance = clamp(1 - variance * 4); // varianza baja => balance alto
  const meanCoh = chakras.reduce((a, c) => a + c.coherence, 0) / chakras.length;
  const meanBlock = chakras.reduce((a, c) => a + c.block, 0) / chakras.length;

  const coherence = clamp(meanCoh * 0.55 + balance * 0.45 - meanBlock * 0.25 + noise());
  const tension = clamp(meanBlock * 0.55 + (1 - balance) * 0.45);
  const luck = clamp(coherence * 0.7 + balance * 0.3 + noise());

  // ── energía de curvatura: tensión histórica acumulada (escala κ) ──
  const delta = before.reduce((a, b, i) => a + Math.abs(b - acts[i]), 0);
  const curvStep = delta * (0.5 + kappa);
  const curvature = prev.curvature + curvStep;

  // ── rachas para eventos correctivos ──
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

  // tono de renderizado según coherencia (Addendum: lenguaje de renderizado)
  if (psi.coherence > 0.66) {
    d.push("Tono del mundo: abierto, fluido, resonante, claro. Hay poca fricción; el mundo responde con apertura.");
  } else if (psi.coherence < 0.4) {
    d.push("Tono del mundo: pesado, denso, cerrado, opaco. Las cosas cuestan más, los caminos se estrechan.");
  } else {
    d.push("Tono del mundo: variable y ambiguo; ni del todo abierto ni del todo cerrado.");
  }

  // suerte L
  if (psi.luck > 0.66) d.push("La suerte está abierta: permite una sincronicidad afortunada (un recurso, una apertura, un aliado fortuito).");
  else if (psi.luck < 0.35) d.push("La suerte está cerrada: las casualidades no favorecen; lo que podía salir bien se tuerce.");

  // evento correctivo por tensión sostenida
  if (psi.highTensionStreak >= 3) {
    d.push("SISTEMA CORRECTIVO: la tensión persiste. Deja que un obstáculo o un patrón se repita, que el entorno se vuelva más denso, presionando con suavidad hacia el cambio. No castigues; refleja y amplifica. Nunca expliques por qué.");
  }

  // ruido fértil por curvatura plana
  if (psi.lowCurvatureStreak >= 4) {
    d.push("RUIDO FÉRTIL: el camino se ha vuelto demasiado plano. Introduce un elemento de sorpresa que reintroduzca movimiento: un encuentro inesperado, una grieta en lo previsible. Sin violencia gratuita.");
  }

  // chakra dominante / más bloqueado como atractor simbólico
  const dom = [...psi.chakras].sort((a, b) => b.activation - a.activation)[0];
  const blocked = [...psi.chakras].sort((a, b) => b.block - a.block)[0];
  d.push(`Centro encendido: ${dom.name} (${dom.aspect}). Deja que la escena vibre con ese aspecto, encarnado como lugar, criatura, clima u objeto — nunca nombrado.`);
  if (blocked.block > 0.45) {
    d.push(`Centro bloqueado: ${blocked.name} (${blocked.aspect}). Que el mundo roce esa herida sin señalarla.`);
  }

  return d;
}

/**
 * Bloque en español que se inyecta en el system prompt del Guardián.
 * Es una brújula INVISIBLE: guía la escena, jamás se menciona en la ficción.
 */
export function summarizeForPrompt(psi: Psi, directives: string[]): string {
  return `# Brújula interna del jugador (Amalgam — INVISIBLE, jamás nombrar en la ficción)
Este es el estado de coherencia (Ψ) del jugador en este instante. Úsalo SOLO para decidir hacia qué colapsa la escena: qué aparece, con qué densidad, con qué suerte. Nunca menciones chakras, coherencia, tensión, energía, fórmulas ni "tu interior". El mundo es el único lenguaje: firelight, acero, niebla, sangre, piel.

- Coherencia global: ${(psi.coherence * 100).toFixed(0)}%
- Tensión (τ): ${(psi.tension * 100).toFixed(0)}%
- Suerte (L): ${(psi.luck * 100).toFixed(0)}%
- Rigidez (κ): ${psi.kappa.toFixed(2)} ${psi.kappa > 0.7 ? "(rígido, le cuesta fluir)" : psi.kappa < 0.35 ? "(flexible, fluye)" : ""}

Directivas de manifestación para este turno:
${directives.map((x) => `- ${x}`).join("\n")}`;
}

/** Nota poética breve para el panel visible "Espejo Interior". */
export function poeticNote(psi: Psi): string {
  if (psi.coherence > 0.7) return "Las aguas internas están quietas; el mundo te responde sin resistencia.";
  if (psi.tension > 0.7) return "Algo se tensa por dentro; el mundo se vuelve denso a tu alrededor.";
  if (psi.luck > 0.7) return "Hay sincronicidad en el aire: las puertas se abren solas.";
  if (psi.coherence < 0.4) return "Hay niebla en el centro; los caminos se estrechan hasta que cambies.";
  return "El espejo oscila, buscando su forma.";
}
