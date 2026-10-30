"use client";

import { useEffect, useRef, useState } from "react";
import Melorafy, { type Variant } from "./Melorafy";

const styleOptions: Array<{ value: Variant; label: string }> = [
  { value: "paper", label: "Cuaderno completo" },
  { value: "paper-compact", label: "Cuaderno compacto" },
  { value: "classic", label: "Clásico completo" },
  { value: "classic-compact", label: "Clásico compacto" },
];

export default function HomeControls({ initialVariant }: { initialVariant: Variant }) {
  const [variant, setVariant] = useState(initialVariant);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const url = new URL("/embed", window.location.origin);
    url.searchParams.set("style", variant);
    setEmbedUrl(url.toString());
    setCopyState("idle");
  }, [variant]);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  const copyEmbedUrl = async () => {
    try {
      await navigator.clipboard.writeText(embedUrl);
      setCopyState("copied");
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
    }
  };

  return (
    <>
      <div className={`home-actions${stylesOpen ? " is-open" : ""}`}>
        <button
          type="button"
          className="style-toggle"
          aria-expanded={stylesOpen}
          aria-controls="player-styles"
          aria-label="Cambiar estilo del reproductor"
          onClick={() => setStylesOpen((open) => !open)}
        >
          <span className="style-grid-icon" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>Estilos</span>
        </button>
      </div>
      {stylesOpen ? (
        <section id="player-styles" className="style-gallery" aria-label="Previsualizaciones de estilos">
          <div className="style-gallery-heading">
            <span>Elige una vista</span>
            <small>Selecciona un estilo para verlo en grande</small>
          </div>
          <div className="style-gallery-grid">
            {styleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`style-preview${variant === option.value ? " is-selected" : ""}`}
                aria-pressed={variant === option.value}
                onClick={() => {
                  setVariant(option.value);
                  setStylesOpen(false);
                }}
              >
                <span className="style-preview-label">{option.label}</span>
                <Melorafy variant={option.value} />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <Melorafy variant={variant} />
      )}
      {!stylesOpen && (
        <section className="embed-share" aria-label="Enlace del embed">
          <label htmlFor="embed-url">Enlace del embed</label>
          <div className="embed-url-row">
            <input id="embed-url" type="text" value={embedUrl} readOnly />
            <button
              type="button"
              className={`copy-button${copyState === "copied" ? " is-copied" : ""}`}
              onClick={copyEmbedUrl}
              disabled={!embedUrl}
              aria-live="polite"
            >
              <span className="copy-label copy-label-default">Copiar</span>
              <span className="copy-label copy-label-copied">Copiado</span>
            </button>
          </div>
          {copyState === "error" && (
            <p className="copy-error">No se pudo copiar. Selecciona y copia el enlace manualmente.</p>
          )}
        </section>
      )}
    </>
  );
}
