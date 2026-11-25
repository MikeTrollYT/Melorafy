"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { extractPalette } from "./palette";
import {
  getPlaybackProgress,
  nowPlayingStore,
  type Track,
} from "./now-playing";

type WebpackAsset = string | { src?: string; default?: WebpackAsset };

type WebpackAssetContext = {
  (path: string): WebpackAsset;
  keys(): string[];
};

type WebpackRequire = NodeRequire & {
  context(directory: string, recursive: boolean, pattern: RegExp): WebpackAssetContext;
};

export type Variant =
  | "paper"
  | "paper-compact"
  | "classic"
  | "classic-compact"
  | "terminal"
  | "terminal-compact";

const BAR_COUNT = 21;
const TERMINAL_WAVE_FRAMES = [
  "|/\\ |/\\ |/\\ |/\\ |/\\ |/\\",
  "/\\| /\\| /\\| /\\| /\\| /\\|",
  "\\|/ \\|/ \\|/ \\|/ \\|/ \\|/",
];
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

const proxy = (u: string) => `/api/cover?u=${encodeURIComponent(u)}`;

function TerminalPlayer({
  track,
  compact,
  elapsed,
  duration,
  reliable,
  pct,
}: {
  track: Track | "idle";
  compact: boolean;
  elapsed: number;
  duration: number;
  reliable: boolean;
  pct: number;
}) {
  const isPlaying = track !== "idle";
  const title = isPlaying ? track.title : "Nothing playing";
  const artist = isPlaying ? track.artist : "--";
  const filled = Math.round((pct / 100) * 24);
  const progress = reliable
    ? `[${"#".repeat(filled)}${"-".repeat(24 - filled)}]`
    : `[${"-".repeat(24)}]`;

  return (
    <section
      className={`np terminal-player${compact ? " terminal-compact" : ""}`}
      aria-label="Melorafy terminal player"
    >
      <div className="terminal-frame">
        <header className="terminal-header">
          <span>melorafy@now-playing:~$</span>
          <span className="terminal-status">[{isPlaying ? "PLAYING" : "IDLE"}]</span>
        </header>
        {!compact && (
          <>
            <div className="terminal-rule" aria-hidden="true" />
            <p className="terminal-section">&gt; NOW PLAYING</p>
            <p className="terminal-track">
              <span>track:</span> {title}
            </p>
            <p className="terminal-track">
              <span>artist:</span> {artist}
            </p>
            <div className="terminal-playback">
              <code>{progress}</code>
              <span>
                {reliable ? fmt(elapsed) : "--:--"} / {reliable ? fmt(duration) : "--:--"}
              </span>
            </div>
            <p className="terminal-output">
              <span>output:</span>{" "}
              <span
                className={`terminal-wave${isPlaying ? " is-playing" : ""}`}
                aria-hidden="true"
              >
                {TERMINAL_WAVE_FRAMES.map((frame, frameIndex) => (
                  <span
                    className="terminal-wave-frame"
                    key={frame}
                    style={{ "--frame-delay": `${-frameIndex * 160}ms` } as React.CSSProperties}
                  >
                    {frame}
                  </span>
                ))}
              </span>
            </p>
            <div className="terminal-rule" aria-hidden="true" />
            <p className="terminal-prompt">$ {isPlaying ? "listening..." : "waiting for playback..."}</p>
          </>
        )}
        {compact && (
          <div className="terminal-compact-line">
            <span className="terminal-status">[{isPlaying ? "PLAYING" : "IDLE"}]</span>
            <span className="terminal-compact-track">
              {title} <span>/</span> {artist}
            </span>
            <code>{reliable ? fmt(elapsed) : "--:--"}</code>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Melorafy({ variant = "paper" }: { variant?: Variant }) {
  const snapshot = useSyncExternalStore(
    nowPlayingStore.subscribe,
    nowPlayingStore.getSnapshot,
    nowPlayingStore.getServerSnapshot,
  );
  const { track, now, error } = snapshot;
  const [palette, setPalette] = useState<React.CSSProperties | undefined>(undefined);
  const [bars, setBars] = useState(makeBars);
  const [placeholderImage, setPlaceholderImage] = useState<string | null>(null);

  useEffect(() => {
    setBars(makeRandomBars());
  }, []);

  useEffect(() => {
    if (placeholderImages.length === 0) return;
    setPlaceholderImage(
      placeholderImages[Math.floor(Math.random() * placeholderImages.length)],
    );
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

  if (error) {
    return (
      <div className="np np-error" role="alert" aria-live="polite">
        <strong>Error de conexión</strong>
        <span>{error}</span>
      </div>
    );
  }

  const isCompact = variant === "paper-compact" || variant === "classic-compact";
  const theme = variant.startsWith("classic") ? "classic" : "paper";
  const progress = getPlaybackProgress(track, snapshot.seen, now);
  const { durationMs: dur, elapsedMs: elapsed, percent: pct, reliable } = progress;

  if (variant.startsWith("terminal")) {
    return (
      <TerminalPlayer
        track={track}
        compact={variant === "terminal-compact"}
        elapsed={elapsed}
        duration={dur}
        reliable={reliable}
        pct={pct}
      />
    );
  }

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
