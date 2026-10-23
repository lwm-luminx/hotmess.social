// Draws Hot Mess posters on a canvas: the slogan, drawn artwork (never photos of people), the wordmark and a QR code.
// The look is the late-night Hot Mess one (neon, glitter, riso, stickers), not the AudienceKit design system.

import qrcode from 'qrcode-generator';
import { jpegPdf } from './pdf';
import { posterWords, sloganById, SLOGANS, type ArtKind, type Slogan } from './slogans';

export type FormatKey = 'letter' | 'print' | 'post' | 'story' | 'tv';
export type StyleKey = 'neon' | 'glitter' | 'riso' | 'sticker';
export type QRMode = 'download' | 'event' | 'none';

export interface PosterEvent {
  night: string;
  venue: string;
  when: string;
  link: string;
}

export interface PosterOptions {
  slogan: string;
  format: FormatKey;
  style: StyleKey;
  art: ArtKind | 'auto';
  qr: QRMode;
  event: PosterEvent;
}

interface Format {
  w: number;
  h: number;
  label: string;
  sub: string;
  /** Multiplier from the layout size to the exported pixels. */
  exportScale: number;
  /** Page size in points for the PDF. */
  page: [number, number];
}

export const DOWNLOAD_URL = 'https://hotmess.social/download';

export const FORMATS: Record<FormatKey, Format> = {
  letter: { w: 850, h: 1100, label: 'Letter print', sub: '8.5 × 11 in · A4', exportScale: 3, page: [612, 792] },
  print: { w: 1100, h: 1700, label: 'Board print', sub: '11 × 17 in · A3', exportScale: 2, page: [792, 1224] },
  post: { w: 1080, h: 1080, label: 'Instagram post', sub: '1:1', exportScale: 1, page: [810, 810] },
  story: { w: 1080, h: 1920, label: 'Instagram story', sub: '9:16', exportScale: 1, page: [810, 1440] },
  tv: { w: 1920, h: 1080, label: 'Venue TV', sub: '16:9 screen', exportScale: 1, page: [1440, 810] },
};

export function exportSize(format: FormatKey): string {
  const f = FORMATS[format];
  return `${f.w * f.exportScale} × ${f.h * f.exportScale} px`;
}

const DISPLAY = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const HAND = '"Caveat Brush", "Marker Felt", cursive';
const BODY = 'Archivo, "Helvetica Neue", Arial, sans-serif';
const TAU = Math.PI * 2;

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;
interface Box { x: number; y: number; w: number; h: number }
interface Layout { art: Box; text: Box; footer: Box }
interface Palette { main: string; second: string; metal: string; line: string; hi: string; leaf: string; page: string; shade: string }
interface FitWord { text: string; accent: boolean; w: number; x: number }
interface FitLine { words: FitWord[]; w: number }
interface Fit { size: number; lh: number; lines: FitLine[]; th: number; y0: number }

/** Fonts the posters draw with. The page declares them with @font-face. */
export function loadPosterFonts(): Promise<unknown> {
  return Promise.all([
    document.fonts.load(`900 40px "Big Shoulders Display"`),
    document.fonts.load(`40px "Caveat Brush"`),
    document.fonts.load('800 20px Archivo'),
    document.fonts.load('600 20px Archivo'),
    document.fonts.load('400 20px Archivo'),
  ]).catch(() => undefined);
}

function rng(seed: string): Rand {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function sparkle(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
}

/* ---------- artwork, centred on 0,0 with radius r ---------- */

const ART: Record<ArtKind, (ctx: Ctx, r: number, P: Palette, R: Rand) => void> = {
  disco(ctx, r, P, R) {
    ctx.strokeStyle = P.metal; ctx.lineWidth = r * 0.03;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -r * 1.35); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, P.hi); g.addColorStop(1, P.metal); ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    const rows = 11, th = (2 * r) / rows;
    for (let i = 0; i < rows; i++) {
      const y = -r + i * th, yc = y + th / 2, hw = Math.sqrt(Math.max(0, r * r - yc * yc));
      const cols = Math.max(2, Math.round((2 * hw) / th)), tw = (2 * hw) / cols;
      for (let j = 0; j < cols; j++) {
        const p = R();
        ctx.fillStyle = p < 0.18 ? P.main : p < 0.3 ? P.second : p < 0.45 ? P.hi : P.metal;
        ctx.globalAlpha = 0.55 + R() * 0.45;
        ctx.fillRect(-hw + j * tw + tw * 0.06, y + th * 0.06, tw * 0.88, th * 0.88);
      }
    }
    ctx.globalAlpha = 1;
    const sh = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.05);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, P.shade); ctx.fillStyle = sh; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.restore();
    ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    sparkle(ctx, -r * 0.42, -r * 0.45, r * 0.26, P.hi);
    sparkle(ctx, r * 0.82, -r * 0.78, r * 0.16, P.second);
    sparkle(ctx, -r * 0.95, r * 0.62, r * 0.12, P.main);
  },
  peach(ctx, r, P) {
    ctx.beginPath(); ctx.moveTo(0, r * 0.95);
    ctx.bezierCurveTo(-r * 1.25, r * 0.75, -r * 1.15, -r * 0.8, -r * 0.05, -r * 0.62);
    ctx.quadraticCurveTo(0, -r * 0.5, r * 0.05, -r * 0.62);
    ctx.bezierCurveTo(r * 1.15, -r * 0.8, r * 1.25, r * 0.75, 0, r * 0.95); ctx.closePath();
    const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, P.second); g.addColorStop(1, P.main);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.04; ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.55; ctx.lineWidth = r * 0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.52); ctx.quadraticCurveTo(-r * 0.28, r * 0.1, -r * 0.04, r * 0.8); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = P.hi; ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.12, r * 0.16, r * 0.28, -0.3, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(r * 0.1, -r * 0.62); ctx.rotate(-0.6);
    ctx.fillStyle = P.leaf; ctx.beginPath(); ctx.ellipse(r * 0.36, 0, r * 0.38, r * 0.15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.025; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.66, 0); ctx.stroke(); ctx.restore();
  },
  lips(ctx, r, P) {
    ctx.rotate(-0.18);
    ctx.fillStyle = P.main;
    ctx.beginPath(); ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r * 0.7, -r * 0.3, -r * 0.45, -r * 0.62, -r * 0.22, -r * 0.55);
    ctx.quadraticCurveTo(-r * 0.08, -r * 0.5, 0, -r * 0.36);
    ctx.quadraticCurveTo(r * 0.08, -r * 0.5, r * 0.22, -r * 0.55);
    ctx.bezierCurveTo(r * 0.45, -r * 0.62, r * 0.7, -r * 0.3, r, 0);
    ctx.bezierCurveTo(r * 0.5, -r * 0.02, r * 0.25, r * 0.08, 0, r * 0.03);
    ctx.bezierCurveTo(-r * 0.25, r * 0.08, -r * 0.5, -r * 0.02, -r, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.96, r * 0.04);
    ctx.bezierCurveTo(-r * 0.5, r * 0.12, -r * 0.25, r * 0.18, 0, r * 0.13);
    ctx.bezierCurveTo(r * 0.25, r * 0.18, r * 0.5, r * 0.12, r * 0.96, r * 0.04);
    ctx.bezierCurveTo(r * 0.7, r * 0.58, r * 0.35, r * 0.74, 0, r * 0.74);
    ctx.bezierCurveTo(-r * 0.35, r * 0.74, -r * 0.7, r * 0.58, -r * 0.96, r * 0.04); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.28; ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.02; ctx.lineCap = 'round';
    for (let i = -6; i <= 6; i++) { const x = i * r * 0.12; ctx.beginPath(); ctx.moveTo(x, r * 0.2); ctx.lineTo(x * 1.05, r * 0.6 - Math.abs(i) * r * 0.04); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = P.hi;
    ctx.beginPath(); ctx.ellipse(-r * 0.3, r * 0.42, r * 0.16, r * 0.06, -0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.3, -r * 0.38, r * 0.12, r * 0.045, 0.2, 0, TAU); ctx.fill(); ctx.restore();
  },
  mic(ctx, r, P) {
    ctx.rotate(0.45);
    ctx.strokeStyle = P.metal; ctx.lineWidth = r * 0.045; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, r * 0.98); ctx.bezierCurveTo(r * 0.1, r * 1.3, -r * 0.55, r * 1.25, -r * 0.45, r * 0.9); ctx.stroke();
    ctx.fillStyle = P.main; ctx.beginPath();
    ctx.moveTo(-r * 0.17, -r * 0.08); ctx.lineTo(r * 0.17, -r * 0.08); ctx.lineTo(r * 0.1, r); ctx.lineTo(-r * 0.1, r); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.03; ctx.stroke();
    ctx.fillStyle = P.second; rr(ctx, -r * 0.23, -r * 0.2, r * 0.46, r * 0.16, r * 0.04); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(0, -r * 0.52, r * 0.38, 0, TAU); ctx.fillStyle = P.metal; ctx.fill(); ctx.clip();
    ctx.globalAlpha = 0.4; ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.02;
    for (let k = -8; k <= 8; k++) {
      ctx.beginPath(); ctx.moveTo(k * r * 0.09 - r * 0.5, -r * 1.1); ctx.lineTo(k * r * 0.09 + r * 0.5, r * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k * r * 0.09 + r * 0.5, -r * 1.1); ctx.lineTo(k * r * 0.09 - r * 0.5, r * 0.1); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.arc(0, -r * 0.52, r * 0.38, 0, TAU); ctx.stroke();
    sparkle(ctx, -r * 0.15, -r * 0.68, r * 0.14, P.hi);
  },
  harness(ctx, r, P) {
    for (const a of [-2.25, -0.89, 0, Math.PI]) {
      ctx.save(); ctx.rotate(a);
      ctx.fillStyle = P.main; rr(ctx, r * 0.2, -r * 0.1, r * 0.82, r * 0.2, r * 0.05); ctx.fill();
      ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.02; ctx.stroke();
      ctx.setLineDash([r * 0.05, r * 0.04]); ctx.strokeStyle = P.hi; ctx.lineWidth = r * 0.014;
      for (const y of [-r * 0.06, r * 0.06]) { ctx.beginPath(); ctx.moveTo(r * 0.26, y); ctx.lineTo(r * 0.98, y); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.strokeStyle = P.metal; ctx.lineWidth = r * 0.035; ctx.strokeRect(r * 0.6, -r * 0.14, r * 0.11, r * 0.28);
      ctx.fillStyle = P.metal;
      for (const x of [r * 0.4, r * 0.9]) { ctx.beginPath(); ctx.arc(x, 0, r * 0.035, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.strokeStyle = P.metal; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, TAU); ctx.stroke();
    ctx.strokeStyle = P.hi; ctx.lineWidth = r * 0.028; ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 3.6, 5.2); ctx.stroke();
  },
  hymnal(ctx, r, P) {
    ctx.rotate(-0.16);
    const bw = r * 1.15, bh = r * 1.5;
    ctx.fillStyle = P.page; rr(ctx, -bw / 2 + r * 0.07, -bh / 2 + r * 0.05, bw, bh, r * 0.05); ctx.fill();
    ctx.fillStyle = P.second; ctx.beginPath();
    ctx.moveTo(bw * 0.18, bh / 2 - r * 0.05); ctx.lineTo(bw * 0.18, bh / 2 + r * 0.3); ctx.lineTo(bw * 0.24, bh / 2 + r * 0.24);
    ctx.lineTo(bw * 0.3, bh / 2 + r * 0.3); ctx.lineTo(bw * 0.3, bh / 2 - r * 0.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.main; rr(ctx, -bw / 2, -bh / 2, bw, bh, r * 0.06); ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = r * 0.03; ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = P.line; ctx.fillRect(-bw / 2, -bh / 2, r * 0.14, bh); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = P.hi; ctx.lineWidth = r * 0.02; rr(ctx, -bw / 2 + r * 0.22, -bh / 2 + r * 0.1, bw - r * 0.32, bh - r * 0.2, r * 0.03); ctx.stroke(); ctx.restore();
    ctx.fillStyle = P.hi; ctx.textAlign = 'center'; ctx.font = `900 ${r * 0.26}px ${DISPLAY}`;
    ctx.fillText('HYMNS', r * 0.07, -bh * 0.14);
    sparkle(ctx, r * 0.07, bh * 0.12, r * 0.14, P.second);
    ctx.textAlign = 'left';
    const note = (x: number, y: number, s: number) => {
      ctx.fillStyle = P.second; ctx.strokeStyle = P.second; ctx.lineWidth = s * 0.12;
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.32, s * 0.22, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + s * 0.28, y); ctx.lineTo(x + s * 0.28, y - s * 1.1); ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.8, x + s * 0.62, y - s * 0.45); ctx.stroke();
    };
    note(bw * 0.78, -bh * 0.35, r * 0.3); note(bw * 0.95, -bh * 0.02, r * 0.22);
  },
};

/* ---------- looks ---------- */

let grain: HTMLCanvasElement | null = null;
function grainPattern(ctx: Ctx): CanvasPattern | string {
  if (!grain) {
    grain = document.createElement('canvas'); grain.width = grain.height = 160;
    const g = grain.getContext('2d');
    if (!g) return 'transparent';
    const d = g.createImageData(160, 160), R = rng('grain');
    for (let i = 0; i < d.data.length; i += 4) { const v = 150 + R() * 105; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  return ctx.createPattern(grain, 'repeat') ?? 'transparent';
}

function eachWord(fit: Fit, box: Box, fn: (w: FitWord, x: number, y: number) => void) {
  fit.lines.forEach((ln, i) => {
    const base = fit.y0 + i * fit.lh + fit.size * 0.8;
    for (const w of ln.words) fn(w, box.x + w.x, base);
  });
}

function firstAccent(fit: Fit, box: Box): { x: number; y: number; w: number } | null {
  for (let i = 0; i < fit.lines.length; i++) {
    const ws = fit.lines[i].words.filter((w) => w.accent);
    if (ws.length) {
      const a = ws[0], b = ws[ws.length - 1];
      return { x: box.x + a.x, y: fit.y0 + i * fit.lh + fit.size * 0.8, w: b.x + b.w - a.x };
    }
  }
  return null;
}

function underline(ctx: Ctx, x: number, y: number, w: number, s: number, color: string, R: Rand) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = s * 0.15;
  for (let pass = 0; pass < 2; pass++) {
    const yy = y + s * (0.14 + pass * 0.09), x0 = x - s * 0.04, x1 = x + w * (pass ? 0.8 : 1.04);
    ctx.beginPath(); ctx.moveTo(x0 + pass * s * 0.1, yy);
    for (let k = 1; k <= 4; k++) {
      const px = x0 + ((x1 - x0) * k) / 4;
      ctx.quadraticCurveTo(px - (x1 - x0) / 8, yy + (R() - 0.5) * s * 0.1, px, yy + (R() - 0.5) * s * 0.05);
    }
    ctx.stroke();
  }
  ctx.restore();
}

interface Look {
  label: string;
  /** Footer text. */
  ink: string;
  /** The hand-lettered wordmark. */
  mark: string;
  markGlow?: boolean;
  lineHeight: number;
  art: Palette;
  artGlow?: boolean;
  artBlend?: GlobalCompositeOperation;
  sticker?: boolean;
  bg(ctx: Ctx, w: number, h: number, u: number, R: Rand, L: Layout): void;
  text(ctx: Ctx, fit: Fit, box: Box, u: number, R: Rand): void;
  overlay?(ctx: Ctx, w: number, h: number): void;
}

const STICKER_COLOURS = ['#ffe600', '#ff4fa3', '#33e1ff', '#b6ff3b'];

export const LOOKS: Record<StyleKey, Look> = {
  neon: {
    label: 'Neon', ink: '#fff1fb', mark: '#ff2e9a', markGlow: true, lineHeight: 0.94, artGlow: true,
    art: { main: '#ff2e9a', second: '#27e6ff', metal: '#d9d6ff', line: '#ffffff', hi: '#ffffff', leaf: '#39ff88', page: '#ffe6f4', shade: 'rgba(12,8,20,.55)' },
    bg(ctx, w, h, u) {
      ctx.fillStyle = '#0c0814'; ctx.fillRect(0, 0, w, h);
      const g1 = ctx.createRadialGradient(w * 0.85, h * 0.08, 0, w * 0.85, h * 0.08, Math.max(w, h) * 0.6);
      g1.addColorStop(0, 'rgba(255,46,154,.32)'); g1.addColorStop(1, 'rgba(255,46,154,0)'); ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(w * 0.08, h * 0.95, 0, w * 0.08, h * 0.95, Math.max(w, h) * 0.55);
      g2.addColorStop(0, 'rgba(39,230,255,.22)'); g2.addColorStop(1, 'rgba(39,230,255,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      for (let y = u; y < h; y += 2.2 * u) for (let x = u; x < w; x += 2.2 * u) { ctx.beginPath(); ctx.arc(x, y, 0.18 * u, 0, TAU); ctx.fill(); }
      ctx.save(); ctx.strokeStyle = '#ff2e9a'; ctx.lineWidth = 0.45 * u; ctx.shadowColor = '#ff2e9a'; ctx.shadowBlur = 2 * u; ctx.globalAlpha = 0.8;
      rr(ctx, 2.6 * u, 2.6 * u, w - 5.2 * u, h - 5.2 * u, 2 * u); ctx.stroke(); ctx.restore();
    },
    text(ctx, fit, box, _u, R) {
      eachWord(fit, box, (w, x, y) => {
        const c = w.accent ? '#27e6ff' : '#ff2e9a';
        ctx.shadowColor = c; ctx.shadowBlur = fit.size * 0.2; ctx.fillStyle = c; ctx.fillText(w.text, x, y);
        ctx.shadowBlur = fit.size * 0.05; ctx.fillStyle = w.accent ? '#e9fdff' : '#ffe9f5'; ctx.fillText(w.text, x, y);
      });
      ctx.shadowBlur = 0;
      const a = firstAccent(fit, box); if (a) underline(ctx, a.x, a.y, a.w, fit.size, '#ffd23f', R);
    },
  },
  glitter: {
    label: 'Glitter', ink: '#fff3d0', mark: '#ffe08a', markGlow: true, lineHeight: 0.94,
    art: { main: '#ff5fc8', second: '#ffc94d', metal: '#efe6ff', line: '#2a0d33', hi: '#ffffff', leaf: '#7cf2c5', page: '#fff6e0', shade: 'rgba(42,13,51,.5)' },
    bg(ctx, w, h, u, R) {
      const g = ctx.createLinearGradient(0, 0, w * 0.4, h); g.addColorStop(0, '#3a0c3f'); g.addColorStop(0.55, '#1a0b2e'); g.addColorStop(1, '#0d0820');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const n = Math.round(((w * h) / (u * u)) * 0.35), cols = ['#ffe08a', '#ff5fc8', '#9effff', '#ffffff'];
      for (let i = 0; i < n; i++) {
        ctx.globalAlpha = 0.15 + R() * 0.6; ctx.fillStyle = cols[(R() * 4) | 0];
        const s = (0.08 + R() * 0.28) * u; ctx.fillRect(R() * w, R() * h, s, s);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 14; i++) sparkle(ctx, R() * w, R() * h, (0.6 + R() * 1.4) * u, 'rgba(255,255,255,.8)');
    },
    text(ctx, fit, box, u, R) {
      const g = ctx.createLinearGradient(0, fit.y0, 0, fit.y0 + fit.th);
      g.addColorStop(0, '#fff7d9'); g.addColorStop(0.45, '#ffd166'); g.addColorStop(1, '#ff8fd0');
      eachWord(fit, box, (w, x, y) => {
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowOffsetY = fit.size * 0.05; ctx.shadowBlur = fit.size * 0.06;
        ctx.fillStyle = w.accent ? '#ff5fc8' : g; ctx.fillText(w.text, x, y);
      });
      ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;
      for (let i = 0; i < 16; i++) sparkle(ctx, box.x + R() * box.w, fit.y0 + R() * fit.th, (0.4 + R()) * u, '#ffffff');
      const a = firstAccent(fit, box); if (a) underline(ctx, a.x, a.y, a.w, fit.size, '#9effff', R);
    },
  },
  riso: {
    label: 'Riso', ink: '#1f3cff', mark: '#ff3d7f', lineHeight: 0.94, artBlend: 'multiply',
    art: { main: '#ff3d7f', second: '#ffb000', metal: '#9fb0ff', line: '#1f3cff', hi: '#ffffff', leaf: '#1f3cff', page: '#f7f0de', shade: 'rgba(31,60,255,.35)' },
    bg(ctx, w, h, u, _R, L) {
      ctx.fillStyle = '#f2ead8'; ctx.fillRect(0, 0, w, h);
      const a = L.art, cx = a.x + a.w / 2, cy = a.y + a.h / 2, rad = Math.min(a.w, a.h) * 0.58;
      ctx.fillStyle = '#ffb000';
      for (let y = cy - rad; y < cy + rad; y += 1.3 * u) for (let x = cx - rad; x < cx + rad; x += 1.3 * u) {
        const d = Math.hypot(x - cx, y - cy) / rad; if (d > 1) continue;
        ctx.beginPath(); ctx.arc(x, y, 0.55 * u * (1 - d * 0.7), 0, TAU); ctx.fill();
      }
    },
    text(ctx, fit, box) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      eachWord(fit, box, (w, x, y) => { ctx.fillStyle = '#ff3d7f'; ctx.fillText(w.text, x + fit.size * 0.035, y + fit.size * 0.03); });
      eachWord(fit, box, (w, x, y) => {
        if (w.accent) { ctx.fillStyle = '#ffb000'; ctx.fillText(w.text, x - fit.size * 0.02, y - fit.size * 0.015); }
        else { ctx.fillStyle = '#1f3cff'; ctx.fillText(w.text, x, y); }
      });
      ctx.restore();
    },
    overlay(ctx, w, h) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.22; ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, 0, w, h); ctx.restore();
    },
  },
  sticker: {
    label: 'Sticker', ink: '#ffffff', mark: '#ff4fa3', lineHeight: 1.06, sticker: true,
    art: { main: '#ff4fa3', second: '#ffe600', metal: '#d8d8e4', line: '#111111', hi: '#ffffff', leaf: '#b6ff3b', page: '#ffffff', shade: 'rgba(0,0,0,.35)' },
    bg(ctx, w, h, u, R, L) {
      ctx.fillStyle = '#141114'; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.globalAlpha = 0.14; ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = 0.5 * u; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); let x = R() * w, y = R() * h; ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 18 * u; y += (R() - 0.5) * 18 * u; ctx.quadraticCurveTo(x + (R() - 0.5) * 10 * u, y + (R() - 0.5) * 10 * u, x, y); }
        ctx.stroke();
      }
      ctx.restore();
      const a = L.art; ctx.save(); ctx.translate(a.x + a.w / 2, a.y + a.h / 2); ctx.rotate((R() - 0.5) * 0.06);
      ctx.fillStyle = '#26202b'; ctx.beginPath();
      const pw = a.w * 0.52, ph = a.h * 0.5; ctx.moveTo(-pw, -ph);
      for (let k = 0; k <= 10; k++) ctx.lineTo(-pw + (2 * pw * k) / 10, -ph + (R() - 0.5) * u);
      for (let k = 0; k <= 10; k++) ctx.lineTo(pw + (R() - 0.5) * u, -ph + (2 * ph * k) / 10);
      for (let k = 0; k <= 10; k++) ctx.lineTo(pw - (2 * pw * k) / 10, ph + (R() - 0.5) * u);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(245,240,208,.55)';
      for (const [x, y, r] of [[-pw, -ph, -0.7], [pw, -ph, 0.7], [-pw, ph, 0.7], [pw, ph, -0.7]]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.fillRect(-4 * u, -1.1 * u, 8 * u, 2.2 * u); ctx.restore();
      }
      ctx.restore();
      for (let i = 0; i < 9; i++) sparkle(ctx, R() * w, R() * h, (0.8 + R() * 1.6) * u, STICKER_COLOURS[i % 4]);
    },
    text(ctx, fit, box, _u, R) {
      fit.lines.forEach((ln, i) => {
        const base = fit.y0 + i * fit.lh + fit.size * 0.8, pad = fit.size * 0.12;
        const cx = box.x + ln.w / 2, cy = base - fit.size * 0.34;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate((i % 2 ? 1 : -1) * 0.02 + (R() - 0.5) * 0.02); ctx.translate(-cx, -cy);
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowOffsetY = fit.size * 0.05; ctx.shadowBlur = fit.size * 0.06;
        ctx.fillStyle = STICKER_COLOURS[i % 4]; ctx.fillRect(box.x - pad, base - fit.size * 0.86, ln.w + pad * 2, fit.size);
        ctx.shadowColor = 'transparent';
        for (const w of ln.words) {
          const wx = box.x + w.x;
          if (w.accent) { ctx.lineJoin = 'round'; ctx.strokeStyle = '#111111'; ctx.lineWidth = fit.size * 0.08; ctx.strokeText(w.text, wx, base); ctx.fillStyle = '#ffffff'; ctx.fillText(w.text, wx, base); }
          else { ctx.fillStyle = '#111111'; ctx.fillText(w.text, wx, base); }
        }
        ctx.restore();
      });
    },
  },
};

/* ---------- type ---------- */

function fitText(ctx: Ctx, slogan: Slogan, box: Box, u: number, lineHeight: number): Fit {
  const words = posterWords(slogan.text);
  let last: Omit<Fit, 'y0'> | null = null;
  for (let s = Math.min(box.h, 26 * u); s >= 2 * u; s *= 0.96) {
    ctx.font = `900 ${s}px ${DISPLAY}`;
    const space = ctx.measureText(' ').width * 1.1;
    const lines: FitLine[] = [];
    let cur: FitWord[] = [], cw = 0, fits = true;
    for (const t of words) {
      const tw = ctx.measureText(t.text).width;
      if (tw > box.w) { fits = false; break; }
      const nw = cur.length ? cw + space + tw : tw;
      if (nw > box.w && cur.length) { lines.push({ words: cur, w: cw }); cur = [{ ...t, w: tw, x: 0 }]; cw = tw; }
      else { cur.push({ ...t, w: tw, x: cur.length ? cw + space : 0 }); cw = nw; }
    }
    if (!fits) continue;
    lines.push({ words: cur, w: cw });
    const lh = s * lineHeight, th = (lines.length - 1) * lh + s * 0.86;
    last = { size: s, lh, lines, th };
    if (th <= box.h) break;
  }
  if (!last) last = { size: 2 * u, lh: 2 * u, lines: [], th: 0 };
  return { ...last, y0: box.y + (box.h - last.th) / 2 };
}

function fitFont(ctx: Ctx, weight: number, size: number, family: string, text: string, maxW: number) {
  let s = size; ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 4) { s *= 0.94; ctx.font = `${weight} ${s}px ${family}`; }
}

/* ---------- layout and render ---------- */

function layout(format: FormatKey, w: number, h: number, u: number, qr: boolean): Layout {
  const m = 6 * u, fh = qr ? 19 * u : 12 * u;
  if (format === 'tv') {
    return {
      art: { x: m, y: m, w: w * 0.34, h: h - 2 * m },
      text: { x: w * 0.4, y: m + 2 * u, w: w * 0.6 - m, h: h - 2 * m - fh - 6 * u },
      footer: { x: w * 0.4, y: h - m - fh, w: w * 0.6 - m, h: fh },
    };
  }
  const ah = h * (format === 'post' ? 0.27 : 0.31);
  return {
    art: { x: m, y: m, w: w - 2 * m, h: ah },
    text: { x: m, y: m + ah + 3 * u, w: w - 2 * m, h: h - 2 * m - ah - fh - 7 * u },
    footer: { x: m, y: h - m - fh, w: w - 2 * m, h: fh },
  };
}

function placeArts(n: number, b: Box): { x: number; y: number; r: number }[] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (n === 1) return [{ x: cx, y: cy, r: Math.min(b.w * 0.36, b.h * 0.4) }];
  if (b.w >= b.h) {
    const r = Math.min(b.w * 0.22, b.h * 0.38);
    return [{ x: b.x + b.w * 0.33, y: cy + b.h * 0.05, r }, { x: b.x + b.w * 0.69, y: cy - b.h * 0.05, r: r * 0.85 }];
  }
  const r = Math.min(b.w * 0.36, b.h * 0.2);
  return [{ x: cx - b.w * 0.08, y: b.y + b.h * 0.3, r }, { x: cx + b.w * 0.1, y: b.y + b.h * 0.72, r: r * 0.85 }];
}

function drawQR(ctx: Ctx, text: string, x: number, y: number, size: number, u: number) {
  ctx.fillStyle = '#ffffff'; rr(ctx, x, y, size, size, 0.8 * u); ctx.fill();
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), pad = 2, cell = size / (n + pad * 2);
  ctx.fillStyle = '#120d16';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (q.isDark(r, c)) ctx.fillRect(x + (c + pad) * cell, y + (r + pad) * cell, cell * 1.03, cell * 1.03);
  }
}

/** The QR code's target, or null for none. An event without a link falls back to the download page. */
export function qrTarget(o: PosterOptions): string | null {
  if (o.qr === 'none') return null;
  if (o.qr === 'event') return o.event.link.trim() || DOWNLOAD_URL;
  return DOWNLOAD_URL;
}

function drawFooter(ctx: Ctx, f: Box, S: Look, u: number, o: PosterOptions) {
  ctx.save(); ctx.translate(f.x, f.y + f.h - 3.6 * u); ctx.rotate(-0.07);
  ctx.font = `${8 * u}px ${HAND}`; ctx.fillStyle = S.mark;
  if (S.markGlow) { ctx.shadowColor = S.mark; ctx.shadowBlur = 1.6 * u; }
  ctx.fillText('hot mess', 0, 0); ctx.restore();
  ctx.font = `600 ${1.7 * u}px ${BODY}`; ctx.fillStyle = S.ink; ctx.globalAlpha = 0.85;
  ctx.fillText('hotmess.social · find your night', f.x, f.y + f.h - 0.3 * u); ctx.globalAlpha = 1;

  const target = qrTarget(o);
  if (!target) return;
  const q = Math.min(f.h, 17 * u), qx = f.x + f.w - q, qy = f.y + f.h - q;
  drawQR(ctx, target, qx, qy, q, u);
  const tx = qx - 2.4 * u, maxW = tx - (f.x + 30 * u);
  const lines: [number, number, string, string, number][] = o.qr === 'event'
    ? [[900, 4.6, DISPLAY, o.event.night.toUpperCase(), 4.4], [800, 2.3, BODY, o.event.venue, 8.4], [400, 2.1, BODY, o.event.when, 11.6]]
    : [[900, 4.6, DISPLAY, 'GET HOT MESS', 4.4], [800, 2.3, BODY, 'Free on iPhone and Android', 8.4], [400, 2.1, BODY, 'Find your people tonight', 11.6]];
  ctx.textAlign = 'right'; ctx.fillStyle = S.ink;
  for (const [weight, size, family, text, y] of lines) {
    fitFont(ctx, weight, size * u, family, text, maxW);
    ctx.fillText(text, tx, qy + y * u);
  }
  ctx.globalAlpha = 0.7; ctx.font = `600 ${1.5 * u}px ${BODY}`;
  ctx.fillText(o.qr === 'event' ? 'Scan to open it in Hot Mess →' : 'Scan to download →', tx, qy + q - 0.4 * u);
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

export function renderPoster(canvas: HTMLCanvasElement, o: PosterOptions, scale: number) {
  const F = FORMATS[o.format], S = LOOKS[o.style], slogan = sloganById(o.slogan) ?? SLOGANS[0];
  canvas.width = Math.round(F.w * scale); canvas.height = Math.round(F.h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save(); ctx.scale(scale, scale);
  const w = F.w, h = F.h, u = Math.min(w, h) / 100, R = rng(slogan.id + o.style + o.format);
  const L = layout(o.format, w, h, u, qrTarget(o) !== null);
  S.bg(ctx, w, h, u, R, L);

  const arts = o.art === 'auto' ? slogan.art : [o.art];
  placeArts(arts.length, L.art).forEach((p, i) => {
    ctx.save(); ctx.translate(p.x, p.y);
    if (S.sticker) {
      ctx.save(); ctx.rotate((R() - 0.5) * 0.3); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowOffsetY = p.r * 0.06; ctx.shadowBlur = p.r * 0.1;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, p.r * 1.2, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (S.artBlend) ctx.globalCompositeOperation = S.artBlend;
    if (S.artGlow) { ctx.shadowColor = S.art.main; ctx.shadowBlur = p.r * 0.2; }
    ART[arts[i]](ctx, p.r * (S.sticker ? 0.9 : 1), S.art, R);
    ctx.restore();
  });

  const fit = fitText(ctx, slogan, L.text, u, S.lineHeight);
  ctx.font = `900 ${fit.size}px ${DISPLAY}`; ctx.textBaseline = 'alphabetic';
  S.text(ctx, fit, L.text, u, R);
  if (slogan.footnote) {
    ctx.font = `600 ${2 * u}px ${BODY}`; ctx.fillStyle = S.ink; ctx.globalAlpha = 0.9;
    ctx.fillText(slogan.footnote, L.text.x, Math.min(fit.y0 + fit.th + 4 * u, L.footer.y - u)); ctx.globalAlpha = 1;
  }
  drawFooter(ctx, L.footer, S, u, o);
  S.overlay?.(ctx, w, h);
  ctx.restore();
}

/* ---------- export ---------- */

function exportCanvas(o: PosterOptions): HTMLCanvasElement {
  const c = document.createElement('canvas');
  renderPoster(c, o, FORMATS[o.format].exportScale);
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('The poster could not be encoded.'))), type, quality));
}

export function posterFilename(o: PosterOptions, ext: 'png' | 'pdf'): string {
  return `hot-mess-${o.slogan}-${o.format}-${o.style}.${ext}`;
}

export function exportPng(o: PosterOptions): Promise<Blob> {
  return toBlob(exportCanvas(o), 'image/png');
}

export async function exportPdf(o: PosterOptions): Promise<Blob> {
  const c = exportCanvas(o);
  const jpeg = new Uint8Array(await (await toBlob(c, 'image/jpeg', 0.94)).arrayBuffer());
  const [pw, ph] = FORMATS[o.format].page;
  return new Blob([jpegPdf(jpeg, c.width, c.height, pw, ph)], { type: 'application/pdf' });
}
