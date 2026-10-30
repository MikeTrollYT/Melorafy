// Saca el color dominante de la portada y construye una paleta de la misma tonalidad
// con reglas fijas de contraste. Si la portada es gris o falla, devuelve null (paleta por defecto).

type Rgb = [number, number, number];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function luminance([r, g, b]: Rgb) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: Rgb, b: Rgb) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const css = (h: number, s: number, l: number, a = 1) =>
  `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}% / ${a})`;

// Sube la luminosidad hasta cumplir el contraste mínimo contra el fondo.
function lighten(h: number, s: number, l: number, bg: Rgb, min: number) {
  while (l < 0.96 && contrast(hslToRgb(h, s, l), bg) < min) l += 0.02;
  return l;
}

/** Reglas de la paleta (todo del mismo tono h):
 *  - Panel: oscuro (L 20%), saturación suave (28–45%).
 *  - Título: claro, contraste ≥ 7:1 contra el panel.
 *  - Artista: algo más apagado, contraste ≥ 4.5:1.
 *  - Barra: saturada, contraste ≥ 3:1 contra su carril.
 *  - Carril: mismo tono, más oscuro (L 30%). */
export function buildPalette(h: number, sat: number): Record<string, string> {
  const panelS = clamp(sat * 0.6, 0.28, 0.45);
  const panel = hslToRgb(h, panelS, 0.2);

  const titleL = lighten(h, 0.8, 0.8, panel, 7);
  const softL = lighten(h, 0.5, 0.72, panel, 4.5);

  const trackS = clamp(sat, 0.45, 0.7);
  const track = hslToRgb(h, trackS, 0.3);
  const barS = clamp(sat + 0.1, 0.65, 0.9);
  let barL = 0.58;
  while (barL < 0.8 && contrast(hslToRgb(h, barS, barL), track) < 3) barL += 0.02;

  return {
    "--panel": css(h, panelS, 0.2, 0.92),
    "--title": css(h, 0.8, titleL),
    "--soft": css(h, 0.5, softL),
    "--bar": css(h, barS, barL),
    "--track": css(h, trackS, 0.3),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const cache = new Map<string, Promise<Record<string, string> | null>>();

export function extractPalette(src: string) {
  if (!cache.has(src)) cache.set(src, compute(src));
  return cache.get(src)!;
}

async function compute(src: string): Promise<Record<string, string> | null> {
  try {
    const img = await loadImage(src);
    const N = 40;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, N, N);
    const { data } = ctx.getImageData(0, 0, N, N);

    const px: { h: number; s: number; w: number }[] = [];
    const bins = new Array(36).fill(0);
    let total = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      total++;
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (l < 0.12 || l > 0.9 || s < 0.18) continue; // negros, blancos y grises no cuentan
      const w = s * (1 - Math.abs(l - 0.5) * 1.2);
      px.push({ h, s, w });
      bins[Math.floor(h / 10) % 36] += w;
    }

    const coverage = px.reduce((a, p) => a + p.w, 0) / Math.max(total, 1);
    if (coverage < 0.03) return null; // portada casi en grises -> paleta por defecto

    let peak = 0, best = -1;
    for (let i = 0; i < 36; i++) {
      const v = bins[i] + 0.5 * (bins[(i + 35) % 36] + bins[(i + 1) % 36]);
      if (v > best) { best = v; peak = i; }
    }
    const center = peak * 10 + 5;

    let sx = 0, sy = 0, sw = 0, ss = 0;
    for (const p of px) {
      const d = Math.abs(((p.h - center + 540) % 360) - 180);
      if (d <= 20) {
        sx += Math.cos((p.h * Math.PI) / 180) * p.w;
        sy += Math.sin((p.h * Math.PI) / 180) * p.w;
        ss += p.s * p.w;
        sw += p.w;
      }
    }
    if (!sw) return null;

    const hue = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
    return buildPalette(hue, ss / sw);
  } catch {
    return null;
  }
}
