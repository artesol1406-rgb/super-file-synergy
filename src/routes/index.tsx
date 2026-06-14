import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { IntroAnimation } from "@/components/IntroAnimation";
import { WorldCanvas } from "@/components/WorldCanvas";
import { MEDIA, vecToDir, type Dir8 } from "@/lib/sprites";
import {
  ARCANA,
  coherence,
  createState,
  modeOf,
  proceduralEvent,
  step,
  summarizeForPrompt,
  type AmalgamState,
  type GameAction,
  type StepResult,
} from "@/lib/amalgam";
import { generateMap, generateWorld, type GameMap, type PlaceNode, type World } from "@/lib/world";
import {
  downloadBytes,
  exportMemoryPdf,
  importMemoryPdf,
  type SavedMessage,
} from "@/lib/saveGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AMALGAM — a procedurally generated narrative world" },
      {
        name: "description",
        content:
          "Name a universe and walk a procedurally generated world whose map, mood and people reflect what you carry within.",
      },
    ],
  }),
  component: App,
});

type Screen = "menu" | "seed" | "play" | "options";

const ACTION_KEYWORDS: Record<GameAction, string[]> = {
  fight: ["fight", "attack", "strike", "kill", "break", "smash", "hit"],
  flee: ["flee", "run", "hide", "escape", "avoid", "retreat"],
  meditate: ["meditate", "rest", "breathe", "pray", "still", "wait", "listen"],
  talk: ["talk", "speak", "ask", "say", "tell", "greet", "call"],
  explore: ["explore", "search", "look", "go", "walk", "enter", "open", "take"],
};

function detectAction(text: string): GameAction {
  const t = text.toLowerCase();
  for (const a of ["fight", "flee", "meditate", "talk"] as GameAction[]) {
    if (ACTION_KEYWORDS[a].some((k) => t.includes(k))) return a;
  }
  return "explore";
}

let _uid = 0;
const uid = () => `m${Date.now()}_${_uid++}`;

function App() {
  const [introDone, setIntroDone] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("amalgam_intro") === "1";
  });
  const [screen, setScreen] = useState<Screen>("menu");

  const [seedInput, setSeedInput] = useState("");
  const [world, setWorld] = useState<World | null>(null);
  const [amalgam, setAmalgam] = useState<AmalgamState | null>(null);
  const [map, setMap] = useState<GameMap | null>(null);
  const [player, setPlayer] = useState({ x: 12, y: 12 });
  const [facing, setFacing] = useState<Dir8>("s");
  const [moving, setMoving] = useState(false);
  const [res, setRes] = useState<StepResult | null>(null);

  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionText, setActionText] = useState("");
  const [showMirror, setShowMirror] = useState(false);
  const [musicOn, setMusicOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const clickRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const moveLock = useRef(0);
  const moveStopT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishIntro = () => {
    sessionStorage.setItem("amalgam_intro", "1");
    setIntroDone(true);
  };

  const click = useCallback(() => {
    try {
      if (!clickRef.current) {
        clickRef.current = new Audio(MEDIA.click);
        clickRef.current.volume = 0.4;
      }
      const a = clickRef.current.cloneNode() as HTMLAudioElement;
      a.volume = 0.4;
      void a.play().catch(() => {});
    } catch {}
  }, []);

  // music toggle
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (musicOn) void a.play().catch(() => {});
    else a.pause();
  }, [musicOn]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, busy]);

  function startGame(w: World, st?: AmalgamState, spawn?: { x: number; y: number }, msgs?: SavedMessage[]) {
    const state = st ?? createState(w.seed);
    const firstRes = step(state, "explore");
    const m = generateMap(w, firstRes.state, firstRes.mode);
    setWorld(w);
    setAmalgam(firstRes.state);
    setRes(firstRes);
    setMap(m);
    setPlayer(spawn ?? m.spawn);
    setFacing("s");
    setMessages(
      msgs ?? [
        {
          id: uid(),
          role: "assistant",
          text:
            `*${w.tone}.*\n\nYou open your eyes in **${w.locations[0]}**. The world of *${w.title}* unfolds around you — ${w.locations.slice(1).join(", ")} wait somewhere beyond. Move with the arrows or the pad, and step close to what glows to reach into it.\n\nWhat do you do?`,
        },
      ],
    );
    setScreen("play");
  }

  function newGame() {
    const w = generateWorld(seedInput.trim() || "an open mythic world");
    startGame(w);
  }

  // ── narration turn ──
  const narrate = useCallback(
    async (actionLabel: string, group: GameAction, node?: PlaceNode) => {
      if (!amalgam || !world || busy) return;
      setBusy(true);

      const stepRes = step(amalgam, group);
      setAmalgam(stepRes.state);
      setRes(stepRes);
      // regenerate biome grade only (keep same map layout but mode may shift visuals)
      if (node && map) {
        setMap({ ...map, nodes: map.nodes.map((n) => (n.id === node.id ? { ...n, visited: true } : n)) });
      }

      const userMsg: SavedMessage = { id: uid(), role: "user", text: actionLabel };
      const asstId = uid();
      setMessages((prev) => [...prev, userMsg, { id: asstId, role: "assistant", text: "" }]);

      const compass = summarizeForPrompt(stepRes, world);
      const skeleton = proceduralEvent(stepRes, world, group);
      const convo = [...messages, userMsg]
        .filter((m) => m.text.trim())
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.text }));

      try {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: convo, world, compass, skeleton }),
        });
        if (!resp.ok || !resp.body) throw new Error("offline");
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, text: acc } : m)));
        }
        if (!acc.trim()) throw new Error("empty");
      } catch {
        // offline / error → procedural fallback
        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, text: skeleton } : m)));
      } finally {
        setBusy(false);
      }
    },
    [amalgam, world, busy, messages, map],
  );

  function onEnterNode(node: PlaceNode) {
    click();
    const verb =
      node.kind === "character" ? "talk" : node.kind === "object" ? "explore" : "explore";
    const label =
      node.kind === "character"
        ? `You approach ${node.label} and speak.`
        : node.kind === "object"
          ? `You reach for ${node.label}.`
          : `You enter ${node.label}.`;
    narrate(label, verb as GameAction, node);
  }

  function submitAction() {
    const t = actionText.trim();
    if (!t) return;
    click();
    narrate(t, detectAction(t));
    setActionText("");
  }

  function quickAction(a: GameAction) {
    click();
    const labels: Record<GameAction, string> = {
      explore: "You explore your surroundings.",
      talk: "You call out, seeking a voice in the world.",
      fight: "You ready yourself and strike at what stands before you.",
      flee: "You turn and pull away from the moment.",
      meditate: "You go still and breathe, letting the world settle.",
    };
    narrate(labels[a], a);
  }

  // ── movement (grid) ──
  const move = useCallback(
    (dx: number, dy: number) => {
      if (!map) return;
      const now = performance.now();
      if (now - moveLock.current < 110) return;
      moveLock.current = now;
      setFacing(vecToDir(dx, dy, facing));
      setMoving(true);
      if (moveStopT.current) clearTimeout(moveStopT.current);
      moveStopT.current = setTimeout(() => setMoving(false), 220);
      setPlayer((p) => {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) return p;
        if (map.tiles[ny][nx] === 1) return p;
        return { x: nx, y: ny };
      });
    },
    [map, facing],
  );

  useEffect(() => {
    if (screen !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) { move(0, -1); e.preventDefault(); }
      else if (["arrowdown", "s"].includes(k)) { move(0, 1); e.preventDefault(); }
      else if (["arrowleft", "a"].includes(k)) { move(-1, 0); e.preventDefault(); }
      else if (["arrowright", "d"].includes(k)) { move(1, 0); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, busy, move]);

  async function saveGame() {
    if (!world || !amalgam) return;
    click();
    const bytes = await exportMemoryPdf({
      version: 2,
      savedAt: new Date().toISOString(),
      seed: world.seed,
      world,
      amalgam,
      player,
      messages,
    });
    downloadBytes(bytes, `amalgam-${world.seed.slice(0, 18).replace(/\s+/g, "-") || "memory"}.pdf`);
  }

  async function loadGame(file: File) {
    try {
      const s = await importMemoryPdf(file);
      const r = step(s.amalgam, "explore");
      const m = generateMap(s.world, s.amalgam, r.mode);
      setWorld(s.world);
      setAmalgam(s.amalgam);
      setRes(r);
      setMap(m);
      setPlayer(s.player ?? m.spawn);
      setMessages(s.messages);
      setScreen("play");
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const cursorStyle = { cursor: `url(${MEDIA.cursor}) 4 4, auto` } as const;

  // ── render ──
  if (!introDone) return <IntroAnimation onDone={finishIntro} />;

  return (
    <div className="min-h-screen w-full text-foreground" style={cursorStyle}>
      <audio ref={audioRef} src={MEDIA.ambient} loop preload="none" />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && loadGame(e.target.files[0])}
      />

      {screen === "menu" && (
        <MenuScreen
          onSingle={() => { click(); setMusicOn(true); setScreen("seed"); }}
          onOptions={() => { click(); setScreen("options"); }}
          onLoad={() => { click(); fileRef.current?.click(); }}
        />
      )}

      {screen === "options" && (
        <OptionsScreen
          musicOn={musicOn}
          setMusicOn={(v) => { click(); setMusicOn(v); }}
          showMirror={showMirror}
          setShowMirror={(v) => { click(); setShowMirror(v); }}
          onBack={() => { click(); setScreen("menu"); }}
        />
      )}

      {screen === "seed" && (
        <SeedScreen
          value={seedInput}
          setValue={setSeedInput}
          onStart={() => { click(); newGame(); }}
          onBack={() => { click(); setScreen("menu"); }}
        />
      )}

      {screen === "play" && world && map && res && (
        <PlayScreen
          world={world}
          map={map}
          res={res}
          player={player}
          facing={facing}
          moving={moving}
          messages={messages}
          busy={busy}
          actionText={actionText}
          setActionText={setActionText}
          submitAction={submitAction}
          quickAction={quickAction}
          onEnterNode={onEnterNode}
          move={move}
          logRef={logRef}
          showMirror={showMirror}
          onSave={saveGame}
          onMenu={() => { click(); setScreen("menu"); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────── Menu ───────────────────────────────

function MenuScreen({ onSingle, onOptions, onLoad }: { onSingle: () => void; onOptions: () => void; onLoad: () => void }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: `url(${MEDIA.menuBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-background/70" />
      <div className="menu-scanlines pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <h1 className="font-pixel text-3xl tracking-tight text-primary glow-ember candle-flicker">AMALGAM</h1>
        <p className="mt-4 text-center text-sm text-muted-foreground text-serif">
          Name a universe. Walk a world that mirrors you.
        </p>

        <nav className="mt-10 flex w-full flex-col gap-3">
          <PixelButton onClick={onSingle}>Singleplayer</PixelButton>
          <PixelButton disabled>
            Multiplayer
            <span className="ml-2 rounded bg-accent/80 px-1.5 py-0.5 text-[8px] text-accent-foreground">Soon</span>
          </PixelButton>
          <PixelButton onClick={onLoad}>Load Memory</PixelButton>
          <PixelButton onClick={onOptions}>Options</PixelButton>
        </nav>

        <footer className="mt-12 text-center font-pixel text-[8px] leading-relaxed text-muted-foreground/70">
          Procedurally generated · Amalgam Engine
        </footer>
      </div>
    </div>
  );
}

function PixelButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "font-pixel text-[11px] uppercase tracking-wide",
        "w-full rounded-md border-2 border-primary/60 bg-card/80 px-4 py-3 text-foreground",
        "transition-all hover:border-primary hover:bg-primary/15 hover:text-primary active:translate-y-0.5",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-card/80 disabled:hover:text-foreground",
      )}
    >
      <span className="flex items-center justify-center">{children}</span>
    </button>
  );
}

// ─────────────────────────────── Seed ───────────────────────────────

const SUGGESTIONS = ["Harry Potter, Hogwarts", "Narnia, the wardrobe", "Lord of the Rings", "A neon city ruled by talking clocks"];

function SeedScreen({ value, setValue, onStart, onBack }: { value: string; setValue: (v: string) => void; onStart: () => void; onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md scroll-panel rounded-xl border border-border p-6">
        <h2 className="font-pixel text-base text-primary">Name a universe</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Type any world — an existing story or one you invent. AMALGAM grows the map, the places and the people from your seed.
        </p>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onStart()}
          placeholder="e.g. a drowned city of glass and bells"
          className="mt-5 bg-input/60"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setValue(s)}
              className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
          <Button onClick={onStart} className="flex-1">Enter the world</Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── Options ─────────────────────────────

function OptionsScreen({
  musicOn, setMusicOn, showMirror, setShowMirror, onBack,
}: {
  musicOn: boolean; setMusicOn: (v: boolean) => void; showMirror: boolean; setShowMirror: (v: boolean) => void; onBack: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md scroll-panel rounded-xl border border-border p-6">
        <h2 className="font-pixel text-base text-primary">Options</h2>
        <Toggle label="Ambient music" on={musicOn} set={setMusicOn} />
        <Toggle label="Show the Inner Mirror (debug)" on={showMirror} set={setShowMirror} />
        <p className="mt-2 text-xs text-muted-foreground">
          The Inner Mirror reveals the hidden engine state. The world is meant to be felt, not read — leave it off for the true experience.
        </p>
        <Button onClick={onBack} className="mt-6 w-full">Back</Button>
      </div>
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className="mt-4 flex w-full items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
      <span className="text-sm">{label}</span>
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

// ─────────────────────────────── Play ───────────────────────────────

function PlayScreen(props: {
  world: World;
  map: GameMap;
  res: StepResult;
  player: { x: number; y: number };
  facing: Dir8;
  moving: boolean;
  messages: SavedMessage[];
  busy: boolean;
  actionText: string;
  setActionText: (v: string) => void;
  submitAction: () => void;
  quickAction: (a: GameAction) => void;
  onEnterNode: (n: PlaceNode) => void;
  move: (dx: number, dy: number) => void;
  logRef: React.RefObject<HTMLDivElement | null>;
  showMirror: boolean;
  onSave: () => void;
  onMenu: () => void;
}) {
  const { world, map, res, player, facing, moving, messages, busy, showMirror } = props;
  const coh = coherence(res.state);

  return (
    <div className="flex min-h-screen flex-col">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card/70 px-3 py-2 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate font-pixel text-[10px] text-primary">{world.title}</h1>
          <p className="truncate text-[10px] text-muted-foreground">{world.tone}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={props.onSave} className="rounded border border-border bg-secondary/40 px-2 py-1 text-[10px] hover:border-primary hover:text-primary">Save</button>
          <button onClick={props.onMenu} className="rounded border border-border bg-secondary/40 px-2 py-1 text-[10px] hover:border-primary hover:text-primary">Menu</button>
        </div>
      </header>

      {/* world view */}
      <div className="relative h-[42vh] min-h-[260px] w-full border-b border-border">
        <WorldCanvas
          map={map}
          seed={world.seed}
          mode={res.mode}
          player={player}
          facing={facing}
          moving={moving}
          onEnterNode={props.onEnterNode}
        />
        {/* D-pad */}
        <DPad onMove={props.move} />
        {showMirror && <InnerMirror res={res} coh={coh} />}
      </div>

      {/* narrative log */}
      <div ref={props.logRef} className="prose-tavern flex-1 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("mb-4", m.role === "user" && "opacity-80")}>
            {m.role === "user" ? (
              <p className="text-sm italic text-muted-foreground">▸ {m.text}</p>
            ) : (
              <div className="text-[15px] leading-relaxed text-foreground">
                <ReactMarkdown>{m.text || (busy ? "…" : "")}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">the world is shaping…</p>}
      </div>

      {/* action bar */}
      <div className="border-t border-border bg-card/70 px-3 py-2 backdrop-blur">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(["explore", "talk", "fight", "flee", "meditate"] as GameAction[]).map((a) => (
            <button
              key={a}
              disabled={busy}
              onClick={() => props.quickAction(a)}
              className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs capitalize text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40"
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={props.actionText}
            onChange={(e) => props.setActionText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.submitAction()}
            placeholder="Do something…"
            disabled={busy}
            className="bg-input/60"
          />
          <Button onClick={props.submitAction} disabled={busy || !props.actionText.trim()}>Act</Button>
        </div>
      </div>
    </div>
  );
}

function DPad({ onMove }: { onMove: (dx: number, dy: number) => void }) {
  const btn = "flex h-10 w-10 items-center justify-center rounded-md border border-primary/50 bg-card/80 text-primary active:bg-primary/25 select-none";
  const hold = (dx: number, dy: number) => {
    onMove(dx, dy);
  };
  return (
    <div className="absolute bottom-3 right-3 grid grid-cols-3 grid-rows-3 gap-1 opacity-90">
      <span />
      <button className={btn} onPointerDown={() => hold(0, -1)}>▲</button>
      <span />
      <button className={btn} onPointerDown={() => hold(-1, 0)}>◀</button>
      <span />
      <button className={btn} onPointerDown={() => hold(1, 0)}>▶</button>
      <span />
      <button className={btn} onPointerDown={() => hold(0, 1)}>▼</button>
      <span />
    </div>
  );
}

function InnerMirror({ res, coh }: { res: StepResult; coh: number }) {
  const s = res.state;
  return (
    <div className="absolute left-3 top-3 w-44 rounded-lg border border-border bg-background/85 p-2 text-[10px] text-muted-foreground backdrop-blur">
      <div className="mb-1 font-pixel text-[8px] text-primary">INNER MIRROR</div>
      <Row k="Mode" v={res.mode} />
      <Row k="Coherence" v={`${(coh * 100).toFixed(0)}%`} />
      <Row k="Stage" v={res.stage} />
      <Row k="Destiny" v={ARCANA[s.lifeArcana]} />
      <Row k="Current" v={ARCANA[res.active]} />
      <div className="mt-1 flex gap-0.5">
        {s.cp.map((c, i) => (
          <div key={i} className="h-8 flex-1 rounded-sm bg-secondary/50">
            <div className="w-full rounded-sm bg-primary/70" style={{ height: `${c * 100}%`, marginTop: `${(1 - c) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{k}</span>
      <span className="truncate text-right text-foreground">{v}</span>
    </div>
  );
}
