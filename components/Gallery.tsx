"use client";

import { useCallback, useEffect, useState } from "react";
import type { Photo } from "@/lib/gallery";

function PhotoTile({
  photo,
  index,
  onOpen,
}: {
  photo: Photo;
  index: number;
  onOpen: (i: number) => void;
}) {
  return (
    <div
      className="tile"
      style={{ "--i": index } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-label="Open photo"
      onClick={() => onOpen(index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(index);
        }
      }}
    >
      <span className="tile-bar" aria-hidden />
      <div
        className="frame"
        style={{
          aspectRatio: `${photo.width} / ${photo.height}`,
          backgroundImage: `url("${photo.blurDataURL}")`,
        }}
      >
        <img src={photo.src} alt="" loading="lazy" decoding="async" />
      </div>
    </div>
  );
}

export default function Gallery({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const go = useCallback(
    (dir: number) => {
      setIndex((prev) => {
        if (prev === null) return prev;
        const n = photos.length;
        return (prev + dir + n) % n;
      });
    },
    [photos.length]
  );

  useEffect(() => {
    if (index === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, close, go]);

  const current = index === null ? null : photos[index];

  return (
    <>
      {photos.length === 0 ? (
        <p className="empty">No photos yet — drop images into the content folder.</p>
      ) : (
        <div className="grid">
          {photos.map((p, i) => (
            <PhotoTile key={p.id} photo={p} index={i} onOpen={setIndex} />
          ))}
        </div>
      )}

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={close}
        >
          <div className="lb-top" onClick={(e) => e.stopPropagation()}>
            <span className="lb-counter">
              <b>{String((index ?? 0) + 1).padStart(2, "0")}</b> /{" "}
              {String(photos.length).padStart(2, "0")}
            </span>
            <button className="lb-close" onClick={close} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
            <button
              className="lb-nav"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              disabled={photos.length < 2}
            >
              ‹
            </button>
            <figure className="lb-figure">
              <img
                key={current.id}
                src={current.src}
                alt=""
                style={{ backgroundImage: `url("${current.blurDataURL}")` }}
              />
            </figure>
            <button
              className="lb-nav"
              onClick={() => go(1)}
              aria-label="Next photo"
              disabled={photos.length < 2}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </>
  );
}
