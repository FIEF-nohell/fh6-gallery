"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Album, Photo } from "@/lib/gallery";

function orientationLabel(p: Photo) {
  return p.orientation === "portrait" ? "▯ Portrait" : "▭ Landscape";
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className="chip" data-active={active} onClick={onClick}>
      {label}
      <sup>{count}</sup>
    </button>
  );
}

function PhotoTile({
  photo,
  index,
  onOpen,
}: {
  photo: Photo;
  index: number;
  onOpen: (i: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fallback = photo.full;

  // If the image finished loading before React attached onLoad (e.g. from
  // cache), reveal it on mount so it never stays stuck behind the blur.
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  return (
    <div
      className="tile"
      style={{ "--i": index } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`Open ${photo.title}`}
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
        <img
          ref={imgRef}
          src={fallback}
          alt={photo.title}
          loading="lazy"
          decoding="async"
          className={loaded ? "loaded" : ""}
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div className="meta">
        <span>
          <span className="m-title">{photo.title}</span>
          <span className="m-album">{photo.albumName}</span>
        </span>
      </div>
    </div>
  );
}

export default function Gallery({
  photos,
  albums,
}: {
  photos: Photo[];
  albums: Album[];
}) {
  const [active, setActive] = useState<string>("all");
  const [index, setIndex] = useState<number | null>(null);

  const filtered = active === "all" ? photos : photos.filter((p) => p.album === active);

  const close = useCallback(() => setIndex(null), []);
  const go = useCallback(
    (dir: number) => {
      setIndex((prev) => {
        if (prev === null) return prev;
        const n = filtered.length;
        return (prev + dir + n) % n;
      });
    },
    [filtered.length]
  );

  // Reset lightbox when switching collections so the index stays valid.
  useEffect(() => {
    setIndex(null);
  }, [active]);

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

  const current = index === null ? null : filtered[index];

  return (
    <>
      <nav className="filters">
        <Chip
          label="All"
          count={photos.length}
          active={active === "all"}
          onClick={() => setActive("all")}
        />
        {albums.map((a) => (
          <Chip
            key={a.slug}
            label={a.name}
            count={a.count}
            active={active === a.slug}
            onClick={() => setActive(a.slug)}
          />
        ))}
      </nav>

      {filtered.length === 0 ? (
        <p className="empty">No captures in this collection yet.</p>
      ) : (
        <div className="grid">
          {filtered.map((p, i) => (
            <PhotoTile key={p.id} photo={p} index={i} onOpen={setIndex} />
          ))}
        </div>
      )}

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
          onClick={close}
        >
          <div className="lb-top" onClick={(e) => e.stopPropagation()}>
            <span className="lb-counter">
              <b>{String((index ?? 0) + 1).padStart(2, "0")}</b> /{" "}
              {String(filtered.length).padStart(2, "0")}
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
              disabled={filtered.length < 2}
            >
              ‹
            </button>
            <figure className="lb-figure">
              <img
                key={current.id}
                src={current.full}
                alt={current.title}
                style={{ backgroundImage: `url("${current.blurDataURL}")` }}
              />
            </figure>
            <button
              className="lb-nav"
              onClick={() => go(1)}
              aria-label="Next photo"
              disabled={filtered.length < 2}
            >
              ›
            </button>
          </div>

          <div className="lb-meta" onClick={(e) => e.stopPropagation()}>
            <h2>{current.title}</h2>
            <span className="lb-album">{current.albumName}</span>
            {current.tags.map((t) => (
              <span key={t} className="lb-tag">
                {t}
              </span>
            ))}
            <span className="lb-tech">
              <span>{orientationLabel(current)}</span>
              <span>
                {current.width}×{current.height}
              </span>
            </span>
            {current.caption && <span className="lb-caption">{current.caption}</span>}
          </div>
        </div>
      )}
    </>
  );
}
