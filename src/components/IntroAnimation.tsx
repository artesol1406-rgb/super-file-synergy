import { useEffect, useRef, useState } from "react";

/**
 * Intro animation — Sacred geometry → Hourglass logo.
 *
 * Sequence:
 *  1. Scattered lines vibrate.
 *  2. Lines settle into triangles.
 *  3. Triangles round out until they become circles.
 *  4. The circles spiral inward into the Flower of Life.
 *  5. The whole flower collapses into a single grain of sand at the
 *     neck of an hourglass whose flasks bear Alpha (α) and Omega (ω).
 *
 * Pure canvas art piece — colors are literal here on purpose.
 */

const GOLD = "232, 188, 104";
const EMBER = "204, 104, 52";
const PARCH = "238, 218, 176";

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);
  const [fading, setFading] = useState(false);
  const [titleIn, setTitleIn] = useState(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    window.setTimeout(onDone, 750);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let W = 0;
    let H = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Flower of Life: 19 hex-lattice points ──
    const hex: { q: number; r: number }[] = [];
    for (let q = -2; q <= 2; q++) {
      for (let r = -2; r <= 2; r++) {
        const hd = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
        if (hd <= 2) hex.push({ q, r });
      }
    }

    const units = hex.map((h) => ({
      h,
      scatterAng: Math.random() * Math.PI * 2,
      scatterDist: 0.32 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI,
      lineLenF: 0.6 + Math.random() * 0.8,
    }));

    const start = performance.now();
    const DUR = 8200;

    const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
    const smooth = (t: number) => {
      const c = clamp01(t);
      return c * c * (3 - 2 * c);
    };
    const seg = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

    const rotatePt = (x: number, y: number, ox: number, oy: number, a: number) => {
      const dx = x - ox;
      const dy = y - oy;
      return {
        x: ox + dx * Math.cos(a) - dy * Math.sin(a),
        y: oy + dx * Math.sin(a) + dy * Math.cos(a),
      };
    };

    function roundedPoly(
      g: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      R: number,
      sides: number,
      round: number,
      rot: number,
    ) {
      const steps = 90;
      const inner = Math.cos(Math.PI / sides);
      g.beginPath();
      for (let s = 0; s <= steps; s++) {
        const th = (s / steps) * Math.PI * 2;
        const seg2 = (2 * Math.PI) / sides;
        const a = (((th - rot) % seg2) + seg2) % seg2;
        const polyR = (R * inner) / Math.cos(a - Math.PI / sides);
        const rr = polyR * (1 - round) + R * round;
        const x = cx + rr * Math.cos(th);
        const y = cy + rr * Math.sin(th);
        if (s === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    }

    function drawHourglass(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, alpha: number) {
      const halfW = s * 0.72;
      const halfH = s;
      g.save();
      g.globalAlpha = alpha;
      g.lineJoin = "round";
      g.lineCap = "round";

      // glow
      g.shadowColor = `rgba(${EMBER}, 0.55)`;
      g.shadowBlur = 34;

      // glass triangles (top points down to neck, bottom points up)
      g.strokeStyle = `rgba(${GOLD}, 0.95)`;
      g.lineWidth = 3;

      g.beginPath();
      g.moveTo(cx - halfW, cy - halfH);
      g.lineTo(cx + halfW, cy - halfH);
      g.lineTo(cx, cy);
      g.closePath();
      g.stroke();

      g.beginPath();
      g.moveTo(cx - halfW, cy + halfH);
      g.lineTo(cx + halfW, cy + halfH);
      g.lineTo(cx, cy);
      g.closePath();
      g.stroke();

      // glass fill
      g.shadowBlur = 0;
      const grad = g.createLinearGradient(0, cy - halfH, 0, cy + halfH);
      grad.addColorStop(0, `rgba(${GOLD}, 0.10)`);
      grad.addColorStop(0.5, `rgba(${EMBER}, 0.05)`);
      grad.addColorStop(1, `rgba(${GOLD}, 0.10)`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx - halfW, cy - halfH);
      g.lineTo(cx + halfW, cy - halfH);
      g.lineTo(cx, cy);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx - halfW, cy + halfH);
      g.lineTo(cx + halfW, cy + halfH);
      g.lineTo(cx, cy);
      g.closePath();
      g.fill();

      // caps + posts
      g.strokeStyle = `rgba(${GOLD}, 0.95)`;
      g.lineWidth = 6;
      const capW = halfW * 1.18;
      g.beginPath();
      g.moveTo(cx - capW, cy - halfH);
      g.lineTo(cx + capW, cy - halfH);
      g.moveTo(cx - capW, cy + halfH);
      g.lineTo(cx + capW, cy + halfH);
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = `rgba(${GOLD}, 0.65)`;
      g.beginPath();
      g.moveTo(cx - capW * 0.92, cy - halfH);
      g.lineTo(cx - capW * 0.92, cy + halfH);
      g.moveTo(cx + capW * 0.92, cy - halfH);
      g.lineTo(cx + capW * 0.92, cy + halfH);
      g.stroke();

      // sand pile at bottom
      g.fillStyle = `rgba(${PARCH}, 0.85)`;
      g.beginPath();
      g.moveTo(cx - halfW * 0.62, cy + halfH);
      g.lineTo(cx + halfW * 0.62, cy + halfH);
      g.lineTo(cx, cy + halfH * 0.5);
      g.closePath();
      g.fill();

      // Alpha (top) and Omega (bottom)
      g.shadowColor = `rgba(${GOLD}, 0.6)`;
      g.shadowBlur = 16;
      g.fillStyle = `rgba(${PARCH}, 0.95)`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `${Math.round(s * 0.5)}px 'EB Garamond', Georgia, serif`;
      g.fillText("\u03B1", cx, cy - halfH * 0.5);
      g.fillText("\u03C9", cx, cy + halfH * 0.55);

      g.restore();
    }

    const frame = (now: number) => {
      const p = clamp01((now - start) / DUR);

      ctx.clearRect(0, 0, W, H);
      // backdrop vignette
      const vg = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, Math.max(W, H) * 0.7);
      vg.addColorStop(0, "rgba(28, 22, 14, 1)");
      vg.addColorStop(1, "rgba(12, 9, 6, 1)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H * 0.46;
      const R = Math.min(W, H) * 0.07;
      const spread = Math.min(W, H) * 0.42;

      const triFade = seg(p, 0.16, 0.3);
      const shapeRound = seg(p, 0.3, 0.5);
      const spiralT = seg(p, 0.46, 0.66);
      const glow = seg(p, 0.6, 0.72);
      const zoomT = seg(p, 0.72, 0.98);
      const hourglassT = seg(p, 0.74, 0.96);

      // Zoom transform: collapse the flower into the hourglass neck.
      ctx.save();
      if (zoomT > 0) {
        const zoom = 1 - zoomT * (1 - 0.012);
        const neckX = W / 2;
        const neckY = H * 0.5;
        ctx.translate(neckX, neckY);
        ctx.scale(zoom, zoom);
        ctx.translate(-cx, -cy);
      }

      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const sx = cx + Math.cos(u.scatterAng) * u.scatterDist * spread;
        const sy = cy + Math.sin(u.scatterAng) * u.scatterDist * spread;

        const d = R;
        const tx = cx + d * (u.h.q + u.h.r / 2);
        const ty = cy + d * ((Math.sqrt(3) / 2) * u.h.r);

        let bx = sx + (tx - sx) * spiralT;
        let by = sy + (ty - sy) * spiralT;
        const turn = (1 - spiralT) * Math.PI * 1.7;
        if (turn > 0.0001) {
          const rp = rotatePt(bx, by, cx, cy, turn);
          bx = rp.x;
          by = rp.y;
        }

        const vibAmp = (1 - seg(p, 0.3, 0.48)) * 7;
        bx += Math.sin(now * 0.02 + u.phase) * vibAmp;
        by += Math.cos(now * 0.017 + u.phase * 1.3) * vibAmp;

        // line phase
        if (triFade < 0.99) {
          const L = R * 1.3 * u.lineLenF;
          const a = u.rot + Math.sin(now * 0.003 + u.phase) * 0.35;
          ctx.globalAlpha = (1 - triFade) * 0.9;
          ctx.strokeStyle = `rgba(${GOLD}, 1)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - Math.cos(a) * L * 0.5, by - Math.sin(a) * L * 0.5);
          ctx.lineTo(bx + Math.cos(a) * L * 0.5, by + Math.sin(a) * L * 0.5);
          ctx.stroke();
        }

        // shape phase: triangle → circle
        if (triFade > 0.01) {
          ctx.globalAlpha = triFade;
          ctx.shadowColor = `rgba(${EMBER}, ${0.6 * glow})`;
          ctx.shadowBlur = 22 * glow;
          ctx.strokeStyle = `rgba(${GOLD}, ${0.85})`;
          ctx.lineWidth = 1.6;
          roundedPoly(ctx, bx, by, R, 3, shapeRound, u.rot * (1 - shapeRound));
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      if (hourglassT > 0) {
        drawHourglass(ctx, W / 2, H * 0.5, Math.min(W, H) * 0.16, hourglassT);
      }

      if (p > 0.86 && !titleIn) setTitleIn(true);

      if (p >= 1) {
        finish();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden bg-background transition-opacity duration-700 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div
        className={`absolute inset-x-0 bottom-[14%] flex flex-col items-center transition-all duration-1000 ${
          titleIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <h1 className="text-display text-3xl sm:text-5xl text-primary glow-ember tracking-wide">
          The Mirror-Keeper
        </h1>
        <p className="mt-2 text-xs sm:text-sm italic text-muted-foreground">
          From Alpha to Omega — the world reflects what you carry within.
        </p>
      </div>

      <button
        onClick={finish}
        className="absolute bottom-6 right-6 text-[11px] uppercase tracking-widest text-muted-foreground/70 hover:text-primary transition-colors"
      >
        Skip ›
      </button>
    </div>
  );
}
