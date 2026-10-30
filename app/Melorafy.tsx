"use client";

import { useEffect, useRef, useState } from "react";
import { extractPalette } from "./palette";

type Track = {
  isPlaying?: boolean;
  empty?: boolean;
  title?: string;
  artist?: string;
  cover?: string | null;
  durationMs?: number | null;
  startedAt?: number | null;
};

type WebpackAsset = string | { src?: string; default?: WebpackAsset };

type WebpackAssetContext = {
  (path: string): WebpackAsset;
  keys(): string[];
};

type WebpackRequire = NodeRequire & {
  context(directory: string, recursive: boolean, pattern: RegExp): WebpackAssetContext;
};

export type Variant = "paper" | "paper-compact" | "classic" | "classic-compact";

const POLL_MS = 5000;
const GRACE_MS = 30000; // espera antes de decir "no escucho nada"
const STALE_MS = 20000; // ignora la canción anterior si Last.fm la repite

const BAR_COUNT = 21;
const placeholderContext = (require as WebpackRequire).context(
  "./img/cats",
  false,
  /\.(png|jpe?g|webp|gif|avif)$/i,
);
const placeholderImages = placeholderContext
  .keys()
  .map((key) => getAssetSource(placeholderContext(key)))
  .filter((src): src is string => !!src);

function getAssetSource(asset: WebpackAsset): string | undefined {
  if (typeof asset === "string") return asset;
  if (typeof asset.src === "string") return asset.src;
  return asset.default ? getAssetSource(asset.default) : undefined;
}
const seededRand = (seed: number, a: number, b: number) => {
  const value = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return a + (value / 4294967296) * (b - a);
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const makeBars = () =>
  Array.from({ length: BAR_COUNT }, (_, index) => ({
    h: seededRand(index * 5 + 1, 14, 40), // altura base en px
    dur: seededRand(index * 5 + 2, 1.6, 3.2), // segundos por ciclo: más alto = más lento
    delay: -seededRand(index * 5 + 3, 0, 3), // negativo: arranca ya a mitad de ciclo
    lo: seededRand(index * 5 + 4, 0.25, 0.5), // escala mínima
    hi: seededRand(index * 5 + 5, 0.8, 1.1), // escala máxima
  }));
const makeRandomBars = () =>
  Array.from({ length: BAR_COUNT }, () => ({
    h: rand(14, 40),
    dur: rand(1.6, 3.2),
    delay: -rand(0, 3),
    lo: rand(0.25, 0.5),
    hi: rand(0.8, 1.1),
  }));

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const keyOf = (t: Track) => `${t.artist}|${t.title}`;
const proxy = (u: string) => `/api/cover?u=${encodeURIComponent(u)}`;

export default function Melorafy({ variant = "paper" }: { variant?: Variant }) {
  // null = cargando · "idle" = no suena nada · Track = canción actual
  const [track, setTrack] = useState<Track | "idle" | null>("idle");
  const [now, setNow] = useState(Date.now());
  const [palette, setPalette] = useState<React.CSSProperties | undefined>(undefined);
  const [bars, setBars] = useState(makeBars);
  const [placeholderImage, setPlaceholderImage] = useState<string | null>(null);

  const shown = useRef<Track | null>(null);
  const seen = useRef<{ key: string; at: number; observed: boolean } | null>(null);
  const left = useRef<Map<string, number>>(new Map());
  const notPlayingSince = useRef<number | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    setBars(makeRandomBars());
  }, []);

  useEffect(() => {
    if (placeholderImages.length === 0) return;
    setPlaceholderImage(
      placeholderImages[Math.floor(Math.random() * placeholderImages.length)],
    );
  }, []);

  useEffect(() => {
    const handle = (d: Track) => {
      const t = Date.now();
      const playing = !!d.isPlaying && !d.empty && !!d.title;

      if (playing) {
        const key = keyOf(d);
        const cur = shown.current ? keyOf(shown.current) : null;

        const leftAt = left.current.get(key);
        if (cur && key !== cur && leftAt && t - leftAt < STALE_MS) return;

        notPlayingSince.current = null;
        if (key !== cur) {
          if (cur) left.current.set(cur, t);
          // observed = hemos visto empezar la canción con la página abierta
          seen.current = { key, at: t, observed: !!cur };
        }
        shown.current = d;
        setTrack(d);
        return;
      }

      if (!shown.current) {
        setTrack("idle");
        return;
      }
      if (notPlayingSince.current === null) notPlayingSince.current = t;
      if (t - notPlayingSince.current > GRACE_MS) {
        shown.current = null;
        setTrack("idle");
      }
    };

    const load = () => {
      const id = ++reqId.current;
      fetch(`/api/now-playing?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d: Track) => {
          if (id !== reqId.current) return;
          handle(d);
        })
        .catch(() => {});
    };

    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  // Color del reproductor según la portada
  const coverUrl = track && track !== "idle" ? track.cover ?? null : null;
  useEffect(() => {
    if (!coverUrl) {
      setPalette(undefined);
      return;
    }
    let alive = true;
    extractPalette(proxy(coverUrl)).then((p) => {
      if (alive) setPalette((p as unknown as React.CSSProperties) ?? undefined);
    });
    return () => {
      alive = false;
    };
  }, [coverUrl]);

  if (track === null) return null;

  const isCompact = variant === "paper-compact" || variant === "classic-compact";
  const theme = variant.startsWith("classic") ? "classic" : "paper";

  if (track === "idle") {
    if (isCompact) {
      return (
        <div className={`np np-compact theme-${theme} np-empty`} aria-label="No hay música reproduciéndose">
          <div className="bar">
            {placeholderImage && (
              <div className="c-art-frame">
                <img className="c-art" src={placeholderImage} alt="" aria-hidden="true" />
                <span className="photo-overlay" aria-hidden="true" />
                <span className="photo-tape rise" aria-hidden="true" />
              </div>
            )}
            <div className="c-text">
              <strong>Sin reproducción</strong>
              <i className="sep" aria-hidden="true" />
              <span>No estoy escuchando nada</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`np theme-${theme} np-empty`} aria-label="No hay música reproduciéndose">
        <div className="top">
          <div className="cover" aria-hidden="true">
            {placeholderImage && (
              <>
                <img className="art" src={placeholderImage} alt="" />
                <span className="photo-overlay" />
                <span className="photo-tape rise" aria-hidden="true" />
              </>
            )}
          </div>
          <div className="side">
            <div className="panel meta">
              <strong>Sin reproducción</strong>
              <span>No estoy escuchando nada</span>
            </div>
            <div className="panel time" aria-hidden="true">
              <span>--:--</span>
              <div className="wave">
                {bars.map((b, i) => (
                  <i
                    key={i}
                    style={
                      {
                        "--h": `${b.h}px`,
                        "--dur": `${b.dur}s`,
                        "--d": `${b.delay}s`,
                        "--lo": "1",
                        "--hi": "1",
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
              <span>--:--</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const art = track.cover ? proxy(track.cover) : null;
  const dur = track.durationMs ?? 0;

  // El progreso solo se muestra si es fiable: o lo calculó el servidor,
  // o hemos visto empezar la canción con la página abierta.
  const reliable = dur > 0 && (track.startedAt != null || !!seen.current?.observed);
  const start = track.startedAt ?? seen.current?.at ?? now;
  const elapsed = reliable ? Math.min(Math.max(now - start, 0), dur) : 0;
  const pct = reliable ? (elapsed / dur) * 100 : 0;

  if (isCompact) {
    return (
      <div className={`np np-compact theme-${theme}`} style={palette}>
        <div className="bar">
          {art ? (
            <div className="c-art-frame">
              <img className="c-art" src={art} alt={`Portada de ${track.title}`} />
              <span className="photo-overlay" aria-hidden="true" />
              <span className="photo-tape rise" aria-hidden="true" />
            </div>
          ) : (
            <div className="c-art ph" />
          )}
          <div className="c-text">
            <strong>{track.title}</strong>
            <i className="sep" aria-hidden="true" />
            <span>{track.artist}</span>
          </div>
          {reliable && (
            <div className="c-prog" aria-hidden="true">
              <div className="c-line">
                <div className="c-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`np theme-${theme}`} style={palette}>
      <div className="top">
        <div className="cover">
          {art && <img className="glow" src={art} alt="" aria-hidden="true" />}
          {art ? (
            <>
              <img className="art" src={art} alt={`Portada de ${track.title}`} />
              <span className="photo-overlay" aria-hidden="true" />
              <span className="photo-tape rise" aria-hidden="true" />
            </>
          ) : (
            <div className="art ph" />
          )}
        </div>

        <div className="side">
          <div className="panel meta">
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
          <div className="panel time">
            {reliable && <span>{fmt(elapsed)}</span>}
            <div className="wave" aria-hidden="true">
              {bars.map((b, i) => (
                <i
                  key={i}
                  style={
                    {
                      "--h": `${b.h}px`,
                      "--dur": `${b.dur}s`,
                      "--d": `${b.delay}s`,
                      "--lo": `${b.lo}`,
                      "--hi": `${b.hi}`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            {reliable && <span>{fmt(dur)}</span>}
          </div>
        </div>
      </div>

      {reliable && (
        <div className="track">
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
