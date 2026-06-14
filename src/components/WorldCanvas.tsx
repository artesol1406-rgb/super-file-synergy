import { useEffect, useRef, useState } from "react";
import { IDLE, WALK, MEDIA, type Dir8 } from "@/lib/sprites";
import { playerLook, characterLook, nodeHue, biomeGrade } from "@/lib/procArt";
import type { GameMap, PlaceNode } from "@/lib/world";
import type { NarrativeMode } from "@/lib/amalgam";

const TS = 48; // tile size px

type Props = {
  map: GameMap;
  seed: string;
  mode: NarrativeMode;
  player: { x: number; y: number };
  facing: Dir8;
  moving: boolean;
  onEnterNode: (node: PlaceNode) => void;
};

export function WorldCanvas({ map, seed, mode, player, facing, moving, onEnterNode }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floorRef = useRef<HTMLImageElement | null>(null);
  const [size, setSize] = useState({ w: 360, h: 480 });
  const [floorReady, setFloorReady] = useState(false);

  // load floor texture once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      floorRef.current = img;
      setFloorReady(true);
    };
    img.src = MEDIA.floor;
  }, []);

  // track container size
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.max(240, Math.floor(r.width)), h: Math.max(320, Math.floor(r.height)) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const camX = player.x * TS + TS / 2 - size.w / 2;
  const camY = player.y * TS + TS / 2 - size.h / 2;

  // draw floor + walls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const grade = biomeGrade(mode);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = "#0c0a10";
    ctx.fillRect(0, 0, size.w, size.h);

    const startTx = Math.floor(camX / TS);
    const startTy = Math.floor(camY / TS);
    const endTx = Math.ceil((camX + size.w) / TS);
    const endTy = Math.ceil((camY + size.h) / TS);

    ctx.filter = grade.filter;
    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        if (ty < 0 || tx < 0 || ty >= map.h || tx >= map.w) continue;
        const sx = tx * TS - camX;
        const sy = ty * TS - camY;
        const tile = map.tiles[ty][tx];
        if (tile === 1) {
          ctx.filter = "none";
          ctx.fillStyle = mode === "rupture" ? "#1a1530" : "#241c14";
          ctx.fillRect(sx, sy, TS, TS);
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(sx, sy + TS - 6, TS, 6);
          ctx.filter = grade.filter;
        } else if (floorRef.current) {
          ctx.drawImage(floorRef.current, sx, sy, TS, TS);
        } else {
          ctx.fillStyle = "#3a2c1e";
          ctx.fillRect(sx, sy, TS, TS);
        }
      }
    }
    ctx.filter = "none";

    // biome tint overlay
    ctx.fillStyle = grade.tint;
    ctx.fillRect(0, 0, size.w, size.h);

    // soft vignette
    const grad = ctx.createRadialGradient(
      size.w / 2,
      size.h / 2,
      Math.min(size.w, size.h) / 4,
      size.w / 2,
      size.h / 2,
      Math.max(size.w, size.h) / 1.1,
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size.w, size.h);
  }, [map, mode, size, camX, camY, floorReady]);

  const pLook = playerLook(seed);
  const sprite = (moving ? WALK : IDLE)[facing];

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#0c0a10]">
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />

      {/* node overlays */}
      {map.nodes.map((n) => {
        const sx = n.x * TS - camX + TS / 2;
        const sy = n.y * TS - camY + TS / 2;
        if (sx < -60 || sy < -60 || sx > size.w + 60 || sy > size.h + 60) return null;
        const near = Math.abs(n.x - player.x) <= 1 && Math.abs(n.y - player.y) <= 1;
        const hue = nodeHue(n.kind);
        const look = characterLook(seed, n.id);
        return (
          <button
            key={n.id}
            onClick={() => near && onEnterNode(n)}
            style={{ left: sx, top: sy }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center focus:outline-none"
            aria-label={n.label}
          >
            {n.kind === "character" ? (
              <img
                src={IDLE.s}
                alt=""
                style={{
                  width: 40,
                  height: 40,
                  filter: look.filter,
                  transform: look.flip ? "scaleX(-1)" : undefined,
                  imageRendering: "pixelated",
                }}
                className={near ? "drop-shadow-[0_0_8px_rgba(255,220,150,0.9)]" : "opacity-90"}
              />
            ) : (
              <span
                style={{
                  background: `hsl(${hue} 70% 55%)`,
                  boxShadow: near ? `0 0 14px hsl(${hue} 80% 60%)` : `0 0 6px hsl(${hue} 60% 40%)`,
                }}
                className={`block h-4 w-4 rotate-45 rounded-[3px] ${n.visited ? "opacity-40" : ""} ${near ? "animate-pulse" : ""}`}
              />
            )}
            {near && (
              <span className="mt-1 max-w-[120px] truncate rounded bg-black/70 px-1.5 py-0.5 text-[8px] leading-tight text-amber-100">
                {n.label}
              </span>
            )}
          </button>
        );
      })}

      {/* player */}
      <img
        src={sprite}
        alt="you"
        style={{
          left: size.w / 2,
          top: size.h / 2,
          width: 44,
          height: 44,
          filter: pLook.filter,
          imageRendering: "pixelated",
        }}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]"
      />
    </div>
  );
}
