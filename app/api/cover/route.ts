export const runtime = "nodejs";

// Solo se permiten portadas de estos servidores (evita usar esto como proxy abierto).
const ALLOWED = [
  "lastfm-img.freetls.fastly.net",
  "lastfm-img2.freetls.fastly.net",
  "lastfm.freetls.fastly.net",
  "last.fm",
  "mzstatic.com",
];

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u");
  if (!u) return new Response("Falta u", { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new Response("URL no válida", { status: 400 });
  }

  const ok =
    target.protocol === "https:" &&
    ALLOWED.some((d) => target.hostname === d || target.hostname.endsWith("." + d));
  if (!ok) return new Response("Servidor no permitido", { status: 403 });

  const res = await fetch(target.toString());
  if (!res.ok || !res.body) return new Response("No disponible", { status: 502 });

  const type = res.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) return new Response("No es una imagen", { status: 415 });

  return new Response(res.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
