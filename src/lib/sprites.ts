/**
 * Sprite + media URLs resolved from CDN asset pointers.
 * The base character art is loaded once; procArt.ts derives every
 * character variant from these eight directions via CSS filters.
 */

import walkN from "@/assets/sprites/walk/n.gif.asset.json";
import walkNE from "@/assets/sprites/walk/ne.gif.asset.json";
import walkE from "@/assets/sprites/walk/e.gif.asset.json";
import walkSE from "@/assets/sprites/walk/se.gif.asset.json";
import walkS from "@/assets/sprites/walk/s.gif.asset.json";
import walkSW from "@/assets/sprites/walk/sw.gif.asset.json";
import walkW from "@/assets/sprites/walk/w.gif.asset.json";
import walkNW from "@/assets/sprites/walk/nw.gif.asset.json";

import idleN from "@/assets/sprites/idle/n.gif.asset.json";
import idleNE from "@/assets/sprites/idle/ne.gif.asset.json";
import idleE from "@/assets/sprites/idle/e.gif.asset.json";
import idleSE from "@/assets/sprites/idle/se.gif.asset.json";
import idleS from "@/assets/sprites/idle/s.gif.asset.json";
import idleSW from "@/assets/sprites/idle/sw.gif.asset.json";
import idleW from "@/assets/sprites/idle/w.gif.asset.json";
import idleNW from "@/assets/sprites/idle/nw.gif.asset.json";

import floor from "@/assets/floor.jpg.asset.json";
import cursor from "@/assets/cursor.webp.asset.json";
import click from "@/assets/click.mp3.asset.json";
import ambient from "@/assets/ambient.mp3.asset.json";
import menuBg from "@/assets/menu-bg.gif.asset.json";

export type Dir8 = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export const WALK: Record<Dir8, string> = {
  n: walkN.url,
  ne: walkNE.url,
  e: walkE.url,
  se: walkSE.url,
  s: walkS.url,
  sw: walkSW.url,
  w: walkW.url,
  nw: walkNW.url,
};

export const IDLE: Record<Dir8, string> = {
  n: idleN.url,
  ne: idleNE.url,
  e: idleE.url,
  se: idleSE.url,
  s: idleS.url,
  sw: idleSW.url,
  w: idleW.url,
  nw: idleNW.url,
};

export const MEDIA = {
  floor: floor.url,
  cursor: cursor.url,
  click: click.url,
  ambient: ambient.url,
  menuBg: menuBg.url,
};

/** Convert a movement vector to one of 8 facing directions. */
export function vecToDir(dx: number, dy: number, fallback: Dir8 = "s"): Dir8 {
  if (dx === 0 && dy === 0) return fallback;
  const ang = Math.atan2(dy, dx); // y down
  const deg = (ang * 180) / Math.PI;
  // 0 = east, 90 = south, etc.
  const sectors: { dir: Dir8; center: number }[] = [
    { dir: "e", center: 0 },
    { dir: "se", center: 45 },
    { dir: "s", center: 90 },
    { dir: "sw", center: 135 },
    { dir: "w", center: 180 },
    { dir: "w", center: -180 },
    { dir: "nw", center: -135 },
    { dir: "n", center: -90 },
    { dir: "ne", center: -45 },
  ];
  let best = sectors[0];
  let bestD = 999;
  for (const s of sectors) {
    const d = Math.abs(deg - s.center);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best.dir;
}
