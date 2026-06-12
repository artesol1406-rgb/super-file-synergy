import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import d20Url from "@/assets/d20.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { streamImage } from "@/lib/streamImage";
import { cn } from "@/lib/utils";
import {
  createPsi,
  poeticNote,
  stepPsi,
  summarizeForPrompt,
  type Psi,
} from "@/lib/amalgam";
import {
  downloadBytes,
  exportMemoryPdf,
  importMemoryPdf,
  type SavedMessage,
} from "@/lib/saveGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "El Guardián del Espejo — RPG narrativo de sombra con IA" },
      {
        name: "description",
        content:
          "Un RPG narrativo donde cada criatura, ruina y extraño es un espejo de lo que llevas dentro. Guiado por un motor de coherencia Amalgam y narrado por IA.",
      },
      { property: "og:title", content: "El Guardián del Espejo" },
      {
        property: "og:description",
        content:
          "RPG narrativo de trabajo de sombra: el mundo refleja tu estado interior. Motor Amalgam + narración con IA.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: MirrorKeeper,
});

type Mode = "exploration" | "combat" | "dialogue";

const MODE_LABELS: Record<Mode, string> = {
  exploration: "Exploración",
  combat: "Combate",
  dialogue: "Diálogo",
};

type Companion = { name: string; description: string };

type Character = {
  name: string;
  universe: string;
  race: string;
  className: string;
  shadowSeed: string;
  traits: string;
  mode: Mode;
  companions: Companion[];
};

const RACES = [
  { name: "Humano", whisper: "el espejo familiar" },
  { name: "Elfo", whisper: "la parte que observa desde lejos" },
  { name: "Enano", whisper: "la parte que resiste bajo tierra" },
  { name: "Tiefling", whisper: "la parte que fue llamada equivocada" },
  { name: "Autómata", whisper: "la parte que aprendió a ser útil" },
  { name: "Cambiaformas", whisper: "la parte a la que nunca se le permitió elegir" },
];

const CLASSES = [
  { name: "Guerrero", whisper: "el que aprendió a pelear primero" },
  { name: "Mago", whisper: "el que lee lo que otros no ven" },
  { name: "Pícaro", whisper: "el que sobrevive escondiéndose" },
  { name: "Sanador", whisper: "el que cuida en lugar de ser cuidado" },
  { name: "Bardo", whisper: "el que convierte la herida en canción" },
  { name: "Errante", whisper: "el que nunca se quedó" },
];

const SEED_PROMPT =
  "¿Qué peso ha cargado tu personaje que nadie conoce?";

function MirrorKeeper() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [resumed, setResumed] = useState<SavedMessage[] | null>(null);
  const [resumedPsi, setResumedPsi] = useState<Psi | null>(null);

  function begin(c: Character, messages: SavedMessage[] | null = null, psi: Psi | null = null) {
    setCharacter(c);
    setResumed(messages);
    setResumedPsi(psi);
  }
  function reset() {
    setCharacter(null);
    setResumed(null);
    setResumedPsi(null);
  }

  return character ? (
    <Play
      character={character}
      setCharacter={setCharacter}
      resumed={resumed}
      resumedPsi={resumedPsi}
      onReset={reset}
    />
  ) : (
    <Creation onBegin={(c) => begin(c, null, null)} onResume={(c, m, p) => begin(c, m, p)} />
  );
}

/* ────────────── CREACIÓN DE PERSONAJE ────────────── */

function Creation({
  onBegin,
  onResume,
}: {
  onBegin: (c: Character) => void;
  onResume: (c: Character, m: SavedMessage[], p: Psi | null) => void;
}) {
  const [name, setName] = useState("");
  const [universe, setUniverse] = useState("");
  const [race, setRace] = useState("");
  const [className, setClassName] = useState("");
  const [shadowSeed, setShadowSeed] = useState("");
  const [traits, setTraits] = useState("");
  const [mode, setMode] = useState<Mode>("exploration");
  const [resumeErr, setResumeErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResumeErr(null);
    try {
      const state = await importMemoryPdf(f);
      onResume(state.character as Character, state.messages, state.amalgam ?? null);
    } catch (err) {
      setResumeErr(err instanceof Error ? err.message : String(err));
    } finally {
      e.target.value = "";
    }
  }

  const canBegin = name && race && className;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl scroll-panel rounded-lg border border-border p-8 sm:p-12 candle-flicker">
        <header className="text-center mb-8">
          <img
            src={d20Url}
            alt=""
            width={1024}
            height={1024}
            className="mx-auto w-16 h-16 mb-4 opacity-90 drop-shadow-[0_0_18px_oklch(0.62_0.18_40/0.6)]"
          />
          <h1 className="text-display text-4xl sm:text-5xl text-primary glow-ember">El Guardián del Espejo</h1>
          <p className="mt-3 text-muted-foreground italic max-w-lg mx-auto">
            Un RPG de mesa donde cada monstruo, ruina y extraño es un espejo de lo que llevas dentro.
            El Guardián habla con franqueza. Nunca juzga. Nunca filtra. Solo escucha, y tira los dados.
          </p>
        </header>

        {/* Reanudar */}
        <div className="mb-8 rounded-md border border-border bg-card/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-display text-xs uppercase tracking-widest text-primary">Reanudar una memoria</p>
            <p className="text-xs text-muted-foreground italic mt-1">
              Abre un PDF de memoria que descargaste antes. Solo tu propio PDF reanuda tu historia: nadie puede
              continuar la partida de otra persona.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={handlePdf} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              Cargar PDF
            </Button>
          </div>
        </div>
        {resumeErr && <p className="text-destructive text-xs italic mb-4 -mt-4">{resumeErr}</p>}

        <Section label="I. Nómbrate">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="El nombre al que responde tu personaje"
            className="bg-input/60"
          />
        </Section>

        <Section label="II. El mundo al que despiertas">
          <Input
            value={universe}
            onChange={(e) => setUniverse(e.target.value)}
            placeholder="p. ej. reino de ceniza, ciudad-templo de neón, bosque ahogado..."
            className="bg-input/60"
          />
        </Section>

        <Section label="III. Raza — la forma en que te muestras">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {RACES.map((r) => (
              <ChipButton key={r.name} active={race === r.name} onClick={() => setRace(r.name)}>
                <span className="text-display text-base">{r.name}</span>
                <span className="block text-[10px] mt-0.5 opacity-70 italic normal-case">{r.whisper}</span>
              </ChipButton>
            ))}
          </div>
        </Section>

        <Section label="IV. Clase — cómo aprendiste a encontrar el mundo">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CLASSES.map((c) => (
              <ChipButton key={c.name} active={className === c.name} onClick={() => setClassName(c.name)}>
                <span className="text-display text-base">{c.name}</span>
                <span className="block text-[10px] mt-0.5 opacity-70 italic normal-case">{c.whisper}</span>
              </ChipButton>
            ))}
          </div>
        </Section>

        <Section
          label="V. Rasgos — escribe a tu personaje con honestidad"
          hint="Hábitos, cicatrices, contradicciones, deseos, voz. Lo que sea. El Guardián no se inmutará ni suavizará."
        >
          <Textarea
            value={traits}
            onChange={(e) => setTraits(e.target.value)}
            placeholder="p. ej. rápido para la furia pero lento para irse. Duerme con un cuchillo. Ama a quien no debería. Ríe en los funerales. Miente sobre su nombre."
            rows={4}
            className="bg-input/60 resize-none"
          />
        </Section>

        <Section label="VI. Modo por defecto">
          <div className="grid grid-cols-3 gap-2">
            {(["exploration", "combat", "dialogue"] as Mode[]).map((m) => (
              <ChipButton key={m} active={mode === m} onClick={() => setMode(m)}>
                <span className="text-display text-base">{MODE_LABELS[m]}</span>
              </ChipButton>
            ))}
          </div>
        </Section>

        <Section label="VII. Una semilla para el Guardián (opcional)" hint={SEED_PROMPT}>
          <Textarea
            value={shadowSeed}
            onChange={(e) => setShadowSeed(e.target.value)}
            placeholder="Lo que escribas aquí, el mundo te lo devolverá como espejo — sin juicio, sin suavizar."
            rows={4}
            className="bg-input/60 resize-none"
          />
        </Section>

        <div className="mt-10 flex justify-center">
          <Button
            disabled={!canBegin}
            onClick={() => onBegin({ name, universe, race, className, shadowSeed, traits, mode, companions: [] })}
            className="text-display text-lg px-8 py-6 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:brightness-110 shadow-[0_0_30px_oklch(0.62_0.18_40/0.4)] disabled:opacity-40 disabled:shadow-none"
          >
            Abrir la puerta
          </Button>
        </div>
      </div>
    </main>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-display text-sm tracking-widest text-primary uppercase mb-1">{label}</h2>
      {hint && <p className="text-xs italic text-muted-foreground mb-2">{hint}</p>}
      {children}
    </section>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-md border text-left transition-all",
        active
          ? "border-primary bg-primary/15 text-primary shadow-[inset_0_0_20px_oklch(0.62_0.18_40/0.25)]"
          : "border-border bg-card/40 text-foreground/85 hover:border-primary/60 hover:bg-card/70",
      )}
    >
      {children}
    </button>
  );
}

/* ────────────── JUEGO ────────────── */

function Play({
  character,
  setCharacter,
  resumed,
  resumedPsi,
  onReset,
}: {
  character: Character;
  setCharacter: (c: Character) => void;
  resumed: SavedMessage[] | null;
  resumedPsi: Psi | null;
  onReset: () => void;
}) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const initialMessages: UIMessage[] = useMemo(() => {
    if (resumed && resumed.length) {
      return resumed.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text", text: m.text }],
      })) as UIMessage[];
    }
    return [
      {
        id: "opener",
        role: "user",
        parts: [
          {
            type: "text",
            text: `Comienza la escena inicial para ${character.name}. Modo: ${character.mode}.`,
          },
        ],
      } as UIMessage,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estado del motor Amalgam (Ψ)
  const psiRef = useRef<Psi>(resumedPsi ?? createPsi());
  const [psi, setPsi] = useState<Psi>(psiRef.current);

  const { messages, sendMessage, status, error } = useChat({
    id: character.name,
    messages: initialMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentOpener = useRef(!!(resumed && resumed.length));

  const characterRef = useRef(character);
  characterRef.current = character;

  function sendToKeeper(text: string, nextPsi: Psi, directives: string[]) {
    const amalgam = summarizeForPrompt(nextPsi, directives);
    sendMessage(
      { text },
      { body: { character: characterRef.current, amalgam } },
    );
  }

  useEffect(() => {
    if (!sentOpener.current && messages.length === 1) {
      sentOpener.current = true;
      // Apertura: usamos el estado base sin pasos previos.
      const amalgam = summarizeForPrompt(psiRef.current, []);
      sendMessage(
        { text: `Comienza la escena inicial para ${character.name}. Modo: ${character.mode}.` },
        { body: { character: characterRef.current, amalgam } },
      );
    }
  }, [messages.length, sendMessage, character.name, character.mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const visible = messages.filter((m) => m.id !== "opener");

  async function downloadMemory() {
    setSaving(true);
    try {
      const saved: SavedMessage[] = visible.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        text: m.parts.map((p) => (p.type === "text" ? p.text : "")).join(""),
      }));
      const bytes = await exportMemoryPdf({
        version: 1,
        savedAt: new Date().toISOString(),
        character,
        messages: saved,
        amalgam: psiRef.current,
      });
      const slug = (character.name || "memoria").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      downloadBytes(bytes, `guardian-del-espejo-${slug}.pdf`);
    } finally {
      setSaving(false);
    }
  }

  const busy = status === "submitted" || status === "streaming";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    // Avanza el motor Amalgam con la acción del jugador.
    const { psi: next, directives } = stepPsi(psiRef.current, text, character.mode);
    psiRef.current = next;
    setPsi(next);
    sendToKeeper(text, next, directives);
    setInput("");
  }

  function setMode(mode: Mode) {
    setCharacter({ ...character, mode });
  }

  function addCompanion(c: Companion) {
    setCharacter({ ...character, companions: [...character.companions, c] });
  }

  function removeCompanion(name: string) {
    setCharacter({ ...character, companions: character.companions.filter((k) => k.name !== name) });
  }

  const lastAssistant = [...visible].reverse().find((m) => m.role === "assistant");
  const sceneText = lastAssistant
    ? lastAssistant.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim()
    : "";

  return (
    <main className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1fr_320px] gap-4 px-4 py-6 max-w-7xl mx-auto">
      <div className="flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src={d20Url} alt="" width={1024} height={1024} className="w-10 h-10 candle-flicker shrink-0" />
            <div className="min-w-0">
              <h1 className="text-display text-xl text-primary leading-tight truncate">{character.name}</h1>
              <p className="text-xs text-muted-foreground italic truncate">
                {character.race} {character.className}
                {character.universe && <> · {character.universe}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadMemory}
              disabled={saving || visible.length === 0}
              className="text-muted-foreground hover:text-primary text-xs uppercase tracking-wider"
              title="Descarga un PDF de memoria para reanudar más tarde"
            >
              {saving ? "Sellando…" : "Guardar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground hover:text-primary text-xs uppercase tracking-wider"
            >
              Nueva
            </Button>
          </div>
        </header>

        {/* Selector de modo */}
        <div className="flex gap-2 mb-4">
          {(["exploration", "combat", "dialogue"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "text-xs uppercase tracking-widest text-display px-3 py-1.5 rounded border transition-all",
                character.mode === m
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Visualizador de escena */}
        <SceneVisualizer scene={sceneText} character={character} streaming={busy} />

        {/* Chat */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scroll-panel rounded-lg border border-border p-6 space-y-6 min-h-[40vh] mt-4"
        >
          {visible.length === 0 && (
            <p className="text-center text-muted-foreground italic text-sm py-8">El Guardián toma aliento…</p>
          )}
          {visible.map((m) => (
            <Message key={m.id} message={m} />
          ))}
          {busy && visible.at(-1)?.role !== "assistant" && (
            <p className="text-primary text-sm italic animate-pulse">El Guardián considera…</p>
          )}
          {error && <p className="text-destructive text-sm italic">El espejo se nubló. {error.message}</p>}
        </div>

        <form onSubmit={submit} className="mt-4 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder={
              character.mode === "combat"
                ? "Tu turno. (atacar, defender, hablar, huir…)"
                : character.mode === "dialogue"
                ? "¿Qué dices?"
                : "¿Qué haces? (Enter para actuar, Shift+Enter para nueva línea)"
            }
            rows={2}
            disabled={busy}
            className="bg-input/60 border-border resize-none flex-1"
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            className="text-display bg-gradient-to-b from-primary to-accent text-primary-foreground hover:brightness-110 self-stretch px-6"
          >
            {character.mode === "combat" ? "Golpear" : character.mode === "dialogue" ? "Hablar" : "Actuar"}
          </Button>
        </form>
        <p className="text-[10px] text-center text-muted-foreground/60 mt-2 italic">
          El Guardián nunca juzga. Sin filtros. Sin suavizar. Lo que emerja es bienvenido.
        </p>
      </div>

      {/* ─── BARRA LATERAL ─── */}
      <aside className="space-y-4 lg:sticky lg:top-6 self-start">
        <MirrorPanel psi={psi} />
        <PartyPanel character={character} onAdd={addCompanion} onRemove={removeCompanion} />
      </aside>
    </main>
  );
}

/* ────────────── ESPEJO INTERIOR (Amalgam) ────────────── */

function Meter({ label, value, tone = "primary" }: { label: string; value: number; tone?: "primary" | "tension" }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-card/70 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", tone === "tension" ? "bg-destructive/80" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MirrorPanel({ psi }: { psi: Psi }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="scroll-panel rounded-lg border border-border p-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-display text-primary uppercase tracking-widest text-xs"
      >
        <span>Espejo interior</span>
        <span className="text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      {!open && (
        <p className="text-[11px] italic text-muted-foreground mt-2">{poeticNote(psi)}</p>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-[11px] italic text-muted-foreground">{poeticNote(psi)}</p>

          <div className="space-y-2">
            <Meter label="Coherencia" value={psi.coherence} />
            <Meter label="Tensión" value={psi.tension} tone="tension" />
            <Meter label="Suerte" value={psi.luck} />
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Centros (chakras)</p>
            {psi.chakras.map((ch) => (
              <div key={ch.key}>
                <div className="flex justify-between text-[10px] text-foreground/80 mb-0.5">
                  <span>
                    {ch.name} <span className="text-muted-foreground italic">· {ch.aspect}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-card/70 overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-primary/90 transition-all duration-700"
                    style={{ width: `${Math.round(ch.activation * 100)}%` }}
                  />
                  <div
                    className="absolute top-0 right-0 h-full bg-destructive/50"
                    style={{ width: `${Math.round(ch.block * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/70 italic">
            El motor guía la narración en silencio. El mundo refleja tu estado sin nombrarlo.
          </p>
        </div>
      )}
    </div>
  );
}

/* ────────────── VISUALIZADOR DE ESCENA ────────────── */

function SceneVisualizer({ scene, character, streaming }: { scene: string; character: Character; streaming: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lastRendered = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const stableScene = streaming ? "" : scene;

  useEffect(() => {
    if (!stableScene || stableScene === lastRendered.current) return;
    lastRendered.current = stableScene;
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    setLoading(true);
    setIsFinal(false);
    setErr(null);
    streamImage(
      "/api/scene-image",
      {
        scene: stableScene,
        universe: character.universe,
        character: `${character.name}, ${character.race} ${character.className}`,
      },
      (dataUrl, final) => {
        setSrc(dataUrl);
        if (final) {
          setIsFinal(true);
          setLoading(false);
        }
      },
      ctrl.signal,
    ).catch((e) => {
      if (ctrl.signal.aborted) return;
      setErr(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [stableScene, character.universe, character.name, character.race, character.className]);

  return (
    <div className="scroll-panel rounded-lg border border-border overflow-hidden aspect-video relative">
      {src ? (
        <img
          src={src}
          alt="La escena tal como la ve el Guardián del Espejo"
          className={cn(
            "w-full h-full object-cover transition-all duration-500",
            isFinal ? "blur-0" : "blur-md scale-105",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground italic text-sm">
          {loading ? "El espejo se está formando…" : "El Guardián aún no te ha mostrado la escena."}
        </div>
      )}
      {loading && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-widest text-primary bg-background/70 px-2 py-1 rounded border border-border">
          revelando
        </div>
      )}
      {err && (
        <div className="absolute bottom-2 left-2 text-[10px] text-destructive bg-background/80 px-2 py-1 rounded">
          {err}
        </div>
      )}
    </div>
  );
}

/* ────────────── PANEL DE COMPAÑÍA ────────────── */

function PartyPanel({
  character,
  onAdd,
  onRemove,
}: {
  character: Character;
  onAdd: (c: Companion) => void;
  onRemove: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  function add() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), description: description.trim() });
    setName("");
    setDescription("");
  }

  return (
    <div className="scroll-panel rounded-lg border border-border p-4">
      <h2 className="text-display text-primary uppercase tracking-widest text-xs mb-3">Tu compañía</h2>

      <div className="space-y-2 mb-4">
        {character.companions.length === 0 && (
          <p className="text-xs italic text-muted-foreground">Por ahora caminas solo.</p>
        )}
        {character.companions.map((k) => (
          <div key={k.name} className="border border-border rounded bg-card/40">
            <div className="flex items-center justify-between p-2">
              <button onClick={() => setOpen(open === k.name ? null : k.name)} className="text-left flex-1 min-w-0">
                <div className="text-display text-sm text-primary truncate">{k.name}</div>
                {k.description && (
                  <div className="text-[10px] text-muted-foreground italic truncate">{k.description}</div>
                )}
              </button>
              <button
                onClick={() => {
                  onRemove(k.name);
                  if (open === k.name) setOpen(null);
                }}
                className="text-xs text-muted-foreground hover:text-destructive px-2"
                title="Dejar la compañía"
              >
                ×
              </button>
            </div>
            {open === k.name && <CompanionChat companion={k} character={character} />}
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-display text-muted-foreground">Añadir compañero</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="bg-input/60 h-8 text-sm"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="¿Quiénes son? Voz, cicatrices, lo que quieren. (con honestidad)"
          rows={2}
          className="bg-input/60 text-sm resize-none"
        />
        <Button size="sm" onClick={add} disabled={!name.trim()} className="w-full text-display">
          Llevar a la compañía
        </Button>
      </div>
    </div>
  );
}

/* ────────────── CHAT DE COMPAÑERO ────────────── */

function CompanionChat({ companion, character }: { companion: Companion; character: Character }) {
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    const next = [...history, { role: "user" as const, content: text }];
    setHistory(next);
    setInput("");
    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companion,
          character: { name: character.name, universe: character.universe },
          message: text,
          history,
        }),
      });
      const { reply } = (await res.json()) as { reply: string };
      setHistory([...next, { role: "assistant", content: reply }]);
    } catch {
      setHistory([...next, { role: "assistant", content: "(no dicen nada — la línea se cortó)" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-border p-2 space-y-2 bg-background/40">
      <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
        {history.length === 0 && (
          <p className="italic text-muted-foreground">Habla con {companion.name}. Con franqueza.</p>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={cn(
              "rounded px-2 py-1",
              m.role === "user"
                ? "bg-secondary/60 text-secondary-foreground ml-4"
                : "bg-card/70 text-foreground mr-4 italic",
            )}
          >
            <span className="text-[9px] uppercase tracking-widest opacity-50 mr-1">
              {m.role === "user" ? character.name : companion.name}
            </span>
            {m.content}
          </div>
        ))}
        {busy && <p className="text-primary italic text-xs animate-pulse">…</p>}
      </div>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Díselo a ${companion.name}…`}
          className="bg-input/60 h-8 text-xs"
          disabled={busy}
        />
        <Button size="sm" onClick={send} disabled={busy || !input.trim()} className="h-8 text-xs px-3">
          Decir
        </Button>
      </div>
    </div>
  );
}

/* ────────────── MENSAJE ────────────── */

function Message({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-md bg-secondary text-secondary-foreground px-4 py-2 border border-border/60 text-sm">
          {text}
        </div>
      </div>
    );
  }
  return (
    <article className="prose-tavern text-foreground/95 text-[15px]">
      <ReactMarkdown>{text}</ReactMarkdown>
    </article>
  );
}
