export const dynamic = "force-dynamic";

const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

// iTunes (gratis, sin clave): portada en buena calidad y duración de la canción.
async function itunes(artist: string, title: string) {
  try {
    const term = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`,
      { next: { revalidate: 86400 } }
    );
    const r = (await res.json()).results?.[0];
    return {
      cover: (r?.artworkUrl100 as string | undefined)?.replace("100x100", "600x600") ?? null,
      durationMs: (r?.trackTimeMillis as number | undefined) ?? null,
    };
  } catch {
    return { cover: null, durationMs: null };
  }
}

export async function GET() {
  const { LASTFM_API_KEY, LASTFM_USER } = process.env;

  if (!LASTFM_API_KEY || !LASTFM_USER) {
    return Response.json({ error: "Faltan variables de entorno" }, { status: 500 });
  }

  const url =
    `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks` +
    `&user=${encodeURIComponent(LASTFM_USER)}&api_key=${LASTFM_API_KEY}&format=json&limit=2`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json().catch(() => null);

    if (!data) return Response.json({ empty: true, reason: `Last.fm respondió ${res.status}` });
    if (data.error) return Response.json({ empty: true, reason: data.message });

    const t = data.recenttracks?.track?.[0];
    if (!t) return Response.json({ empty: true, reason: "Tu perfil de Last.fm no tiene canciones todavía" });

    const artist: string = t.artist?.["#text"] ?? "";
    const title: string = t.name ?? "";
    const isPlaying = t["@attr"]?.nowplaying === "true";

    const info = await itunes(artist, title);

    let cover: string | null =
      t.image?.find((i: any) => i.size === "extralarge")?.["#text"] || null;
    if (!cover || cover.includes(LASTFM_PLACEHOLDER)) cover = info.cover;

    // Last.fm no indica en qué segundo va la canción. Lo estimamos con la hora
    // en que empezó la canción anterior + su duración. Es aproximado.
    let startedAt: number | null = null;
    const prev = data.recenttracks?.track?.[1];
    if (isPlaying && info.durationMs && prev?.date?.uts) {
      const prevInfo = await itunes(prev.artist?.["#text"] ?? "", prev.name ?? "");
      if (prevInfo.durationMs) {
        const est = Number(prev.date.uts) * 1000 + prevInfo.durationMs;
        const elapsed = Date.now() - est;
        if (elapsed >= 0 && elapsed <= info.durationMs) startedAt = est;
      }
    }

    return Response.json(
      { isPlaying, title, artist, album: t.album?.["#text"] ?? "", cover, durationMs: info.durationMs, startedAt },
      { headers: { "Cache-Control": "public, s-maxage=3, max-age=0, must-revalidate" } }
    );
  } catch {
    return Response.json({ empty: true, reason: "No se pudo conectar con Last.fm" });
  }
}
