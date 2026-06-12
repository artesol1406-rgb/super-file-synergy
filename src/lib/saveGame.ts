import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Psi } from "./amalgam";

export type SavedMessage = { id: string; role: "user" | "assistant"; text: string };

export type SaveState = {
  version: 1;
  savedAt: string;
  character: any;
  messages: SavedMessage[];
  amalgam?: Psi;
};

const MARKER_OPEN = "<<<GUARDIAN-DEL-ESPEJO-SAVE-V1>>>";
const MARKER_CLOSE = "<<<END-SAVE>>>";

function toBase64(str: string): string {
  if (typeof window === "undefined") return Buffer.from(str, "utf-8").toString("base64");
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(b64: string): string {
  if (typeof window === "undefined") return Buffer.from(b64, "base64").toString("utf-8");
  return decodeURIComponent(escape(atob(b64)));
}

export async function exportMemoryPdf(state: SaveState): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const margin = 56;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxWidth = pageWidth - margin * 2;
  const ink = rgb(0.12, 0.08, 0.04);
  const muted = rgb(0.38, 0.3, 0.2);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function newPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  function wrap(text: string, f: typeof font, size: number): string[] {
    const out: string[] = [];
    for (const para of text.split(/\n/)) {
      if (!para.trim()) {
        out.push("");
        continue;
      }
      const words = para.split(/\s+/);
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > maxWidth) {
          if (line) out.push(line);
          line = w;
        } else line = test;
      }
      if (line) out.push(line);
    }
    return out;
  }

  function drawLines(lines: string[], f: typeof font, size: number, color = ink, gap = 4) {
    for (const ln of lines) {
      if (y < margin + size) newPage();
      page.drawText(sanitize(ln), { x: margin, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  }

  // pdf-lib StandardFonts (WinAnsi) no soporta todos los glifos; saneamos lo más común.
  function sanitize(s: string): string {
    return s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-");
  }

  // Título
  drawLines(["El Guardián del Espejo"], bold, 24, ink, 6);
  drawLines([`Una memoria de ${state.character?.name ?? "la viajera"}`], italic, 12, muted, 4);
  drawLines([`Sellada el ${new Date(state.savedAt).toLocaleString()}`], italic, 9, muted, 14);

  // Ficha de personaje
  drawLines(["El personaje"], bold, 14, ink, 6);
  const c = state.character ?? {};
  const sheet = [
    `Nombre: ${c.name ?? ""}`,
    `Universo: ${c.universe ?? ""}`,
    `Raza: ${c.race ?? ""}`,
    `Clase: ${c.className ?? ""}`,
    `Modo: ${c.mode ?? ""}`,
    c.traits ? `Rasgos: ${c.traits}` : "",
    c.shadowSeed ? `Semilla: ${c.shadowSeed}` : "",
  ].filter(Boolean);
  for (const line of sheet) drawLines(wrap(line, font, 11), font, 11, ink, 3);

  if (c.companions?.length) {
    y -= 6;
    drawLines(["Compañía"], bold, 12, ink, 4);
    for (const k of c.companions) {
      drawLines(wrap(`- ${k.name}${k.description ? " — " + k.description : ""}`, font, 11), font, 11, ink, 3);
    }
  }

  y -= 12;
  drawLines(["La historia hasta ahora"], bold, 14, ink, 6);

  for (const m of state.messages) {
    if (!m.text.trim()) continue;
    const label = m.role === "user" ? `${c.name ?? "Tú"}:` : "El Guardián:";
    drawLines([label], bold, 10, muted, 3);
    drawLines(
      wrap(m.text, m.role === "assistant" ? font : italic, 11),
      m.role === "assistant" ? font : italic,
      11,
      ink,
      3,
    );
    y -= 6;
  }

  // Datos de reanudación: en metadatos Y como marcador visible (parseo robusto)
  const json = JSON.stringify(state);
  const b64 = toBase64(json);

  pdf.setTitle(`El Guardián del Espejo — ${c.name ?? "memoria"}`);
  pdf.setAuthor(c.name ?? "viajera");
  pdf.setSubject("guardian-del-espejo-save-v1");
  pdf.setKeywords([MARKER_OPEN + b64 + MARKER_CLOSE]);

  newPage();
  drawLines(["— datos de reanudación —"], italic, 9, muted, 4);
  const chunks = b64.match(/.{1,90}/g) ?? [];
  drawLines([MARKER_OPEN], font, 6, muted, 2);
  for (const ch of chunks) drawLines([ch], font, 6, muted, 1);
  drawLines([MARKER_CLOSE], font, 6, muted, 2);

  return await pdf.save();
}

export async function importMemoryPdf(file: File): Promise<SaveState> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const keywords = pdf.getKeywords() ?? "";
    const m = keywords.match(new RegExp(MARKER_OPEN + "([A-Za-z0-9+/=]+)" + MARKER_CLOSE));
    if (m) {
      const state = JSON.parse(fromBase64(m[1])) as SaveState;
      if (state.version === 1) return state;
    }
  } catch {}
  const text = new TextDecoder("latin1").decode(bytes);
  const re = new RegExp(MARKER_OPEN + "([\\s\\S]*?)" + MARKER_CLOSE);
  const match = text.match(re);
  if (match) {
    const b64 = match[1].replace(/[^A-Za-z0-9+/=]/g, "");
    const state = JSON.parse(fromBase64(b64)) as SaveState;
    if (state.version === 1) return state;
  }
  throw new Error("Este PDF no contiene una memoria de El Guardián del Espejo.");
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
