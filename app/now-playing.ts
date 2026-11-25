export type Track = {
  isPlaying?: boolean;
  empty?: boolean;
  title?: string;
  artist?: string;
  cover?: string | null;
  durationMs?: number | null;
  startedAt?: number | null;
};

export type SeenTrack = {
  key: string;
  at: number;
  observed: boolean;
};

export type PlaybackState = {
  track: Track | "idle";
  shown: Track | null;
  seen: SeenTrack | null;
  left: Map<string, number>;
  notPlayingSince: number | null;
};

export type PlaybackProgress = {
  durationMs: number;
  elapsedMs: number;
  percent: number;
  reliable: boolean;
};

export type NowPlayingSnapshot = {
  track: Track | "idle";
  seen: SeenTrack | null;
  error: string | null;
  now: number;
};

const POLL_MS = 5000;
const GRACE_MS = 30000;
const STALE_MS = 20000;
const CONNECTION_ERROR =
  "No se pudo actualizar la reproducción. Comprueba la conexión o la configuración.";

const keyOf = (track: Track) => `${track.artist}|${track.title}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTrackResponse(response: Response, value: unknown): Track {
  if (!response.ok || !isRecord(value) || "error" in value) {
    throw new Error(CONNECTION_ERROR);
  }
  if (value.empty === true) return { empty: true };

  if (
    typeof value.isPlaying !== "boolean" ||
    typeof value.title !== "string" ||
    typeof value.artist !== "string" ||
    (value.cover !== undefined &&
      value.cover !== null &&
      typeof value.cover !== "string") ||
    (value.durationMs !== undefined &&
      value.durationMs !== null &&
      typeof value.durationMs !== "number") ||
    (value.startedAt !== undefined &&
      value.startedAt !== null &&
      typeof value.startedAt !== "number")
  ) {
    throw new Error(CONNECTION_ERROR);
  }

  return {
    isPlaying: value.isPlaying,
    title: value.title,
    artist: value.artist,
    cover: value.cover,
    durationMs: value.durationMs,
    startedAt: value.startedAt,
  };
}

export function createPlaybackState(): PlaybackState {
  return {
    track: "idle",
    shown: null,
    seen: null,
    left: new Map(),
    notPlayingSince: null,
  };
}

export function updatePlayback(
  state: PlaybackState,
  incoming: Track,
  now: number,
): PlaybackState {
  const left = new Map(
    [...state.left].filter(([, leftAt]) => now - leftAt < STALE_MS),
  );
  const playing = !!incoming.isPlaying && !incoming.empty && !!incoming.title;

  if (playing) {
    const key = keyOf(incoming);
    const currentKey = state.shown ? keyOf(state.shown) : null;
    const leftAt = left.get(key);
    if (currentKey && key !== currentKey && leftAt !== undefined && now - leftAt < STALE_MS) {
      return { ...state, left };
    }

    return {
      track: incoming,
      shown: incoming,
      seen:
        key !== currentKey
          ? { key, at: now, observed: currentKey !== null }
          : state.seen,
      left: currentKey && key !== currentKey ? left.set(currentKey, now) : left,
      notPlayingSince: null,
    };
  }

  if (!state.shown) {
    return { ...state, track: "idle", left };
  }

  const notPlayingSince = state.notPlayingSince ?? now;
  if (now - notPlayingSince > GRACE_MS) {
    return {
      track: "idle",
      shown: null,
      seen: null,
      left,
      notPlayingSince,
    };
  }

  return { ...state, left, notPlayingSince };
}

export function getPlaybackProgress(
  track: Track | "idle",
  seen: SeenTrack | null,
  now: number,
): PlaybackProgress {
  if (track === "idle") {
    return { durationMs: 0, elapsedMs: 0, percent: 0, reliable: false };
  }

  const durationMs = track.durationMs ?? 0;
  const seenStart =
    seen?.observed && seen.key === keyOf(track) ? seen.at : undefined;
  const start = track.startedAt ?? seenStart;
  if (
    durationMs <= 0 ||
    !Number.isFinite(durationMs) ||
    start === undefined ||
    !Number.isFinite(start)
  ) {
    return { durationMs, elapsedMs: 0, percent: 0, reliable: false };
  }

  const elapsedMs = Math.min(Math.max(now - start, 0), durationMs);
  return {
    durationMs,
    elapsedMs,
    percent: (elapsedMs / durationMs) * 100,
    reliable: true,
  };
}

export type NowPlayingStoreOptions = {
  fetcher?: typeof fetch;
  clock?: () => number;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
};

export function createNowPlayingStore({
  fetcher = fetch,
  clock = Date.now,
  setInterval: schedule = globalThis.setInterval,
  clearInterval: cancel = globalThis.clearInterval,
}: NowPlayingStoreOptions = {}) {
  const serverSnapshot: NowPlayingSnapshot = {
    track: "idle",
    seen: null,
    error: null,
    now: 0,
  };
  let snapshot = serverSnapshot;
  let playback = createPlaybackState();
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let lastRequestedAt: number | null = null;
  const listeners = new Set<() => void>();

  const publish = (next: NowPlayingSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const load = async () => {
    if (inFlight) return;
    const requestedAt = clock();
    if (lastRequestedAt !== null && requestedAt - lastRequestedAt < POLL_MS) return;
    inFlight = true;
    lastRequestedAt = requestedAt;

    try {
      const response = await fetcher(`/api/now-playing?t=${requestedAt}`, {
        cache: "no-store",
      });
      const incoming = parseTrackResponse(response, await response.json());

      playback = updatePlayback(playback, incoming, clock());
      publish({
        track: playback.track,
        seen: playback.seen,
        error: null,
        now: clock(),
      });
    } catch {
      publish({ ...snapshot, error: CONNECTION_ERROR, now: clock() });
    } finally {
      inFlight = false;
    }
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        void load();
        pollTimer = schedule(() => void load(), POLL_MS);
        clockTimer = schedule(
          () => publish({ ...snapshot, now: clock() }),
          1000,
        );
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          if (pollTimer !== null) cancel(pollTimer);
          if (clockTimer !== null) cancel(clockTimer);
          pollTimer = null;
          clockTimer = null;
        }
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
  };
}

export const nowPlayingStore = createNowPlayingStore();
