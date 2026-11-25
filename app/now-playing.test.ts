import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNowPlayingStore,
  createPlaybackState,
  getPlaybackProgress,
  updatePlayback,
  type Track,
} from "./now-playing";

const firstTrack: Track = {
  isPlaying: true,
  title: "First song",
  artist: "Example Artist",
  durationMs: 200000,
};

describe("playback updates", () => {
  it("switches songs and ignores a stale repeat of the previous song", () => {
    const first = updatePlayback(createPlaybackState(), firstTrack, 1000);
    const second = updatePlayback(
      first,
      { ...firstTrack, title: "Second song" },
      2000,
    );
    const staleRepeat = updatePlayback(second, firstTrack, 3000);

    expect(second.track).toMatchObject({ title: "Second song" });
    expect(second.seen).toMatchObject({ observed: true, at: 2000 });
    expect(staleRepeat.track).toMatchObject({ title: "Second song" });
  });

  it("keeps the last song briefly, then switches to idle after playback stops", () => {
    const playing = updatePlayback(createPlaybackState(), firstTrack, 1000);
    const paused = updatePlayback(playing, { isPlaying: false }, 2000);
    const idle = updatePlayback(paused, { isPlaying: false }, 32001);

    expect(paused.track).toMatchObject({ title: "First song" });
    expect(idle.track).toBe("idle");
    expect(idle.shown).toBeNull();
  });

  it("does not claim progress until its start time is reliable and clamps the result", () => {
    const unknownStart = getPlaybackProgress(firstTrack, null, 5000);
    const knownStart = getPlaybackProgress(
      firstTrack,
      { key: "Example Artist|First song", at: 1000, observed: true },
      51000,
    );
    const serverStart = getPlaybackProgress(
      { ...firstTrack, startedAt: 0 },
      null,
      250000,
    );

    expect(unknownStart).toMatchObject({ reliable: false, percent: 0 });
    expect(knownStart).toMatchObject({
      reliable: true,
      elapsedMs: 50000,
      percent: 25,
    });
    expect(serverStart).toMatchObject({
      reliable: true,
      elapsedMs: 200000,
      percent: 100,
    });
  });
});

describe("shared now-playing store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shares one initial request across multiple subscribers", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(firstTrack), { status: 200 }),
    );
    const store = createNowPlayingStore({ fetcher, clock: () => 1000 });
    const unsubscribe = Array.from({ length: 6 }, () =>
      store.subscribe(() => {}),
    );

    try {
      await vi.waitFor(() =>
        expect(store.getSnapshot().track).toMatchObject({ title: "First song" }),
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe.forEach((remove) => remove());
    }
  });

  it("exposes a connection error separately from an idle response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "upstream unavailable" }), {
        status: 502,
      }),
    );
    const store = createNowPlayingStore({ fetcher, clock: () => 1000 });
    const unsubscribe = store.subscribe(() => {});

    try {
      await vi.waitFor(() =>
        expect(store.getSnapshot().error).toMatch(/No se pudo actualizar/),
      );
      expect(store.getSnapshot().track).toBe("idle");
    } finally {
      unsubscribe();
    }
  });

  it("treats a successful empty response as idle, not as a connection error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ empty: true }), { status: 200 }),
    );
    const store = createNowPlayingStore({ fetcher, clock: () => 1000 });
    const unsubscribe = store.subscribe(() => {});

    try {
      await vi.waitFor(() => expect(store.getSnapshot().now).toBe(1000));
      expect(store.getSnapshot()).toMatchObject({
        track: "idle",
        error: null,
      });
    } finally {
      unsubscribe();
    }
  });
});
