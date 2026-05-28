// Pre-deploy gallery builder.
// Scans content/<album>/<image>, derives orientation + dimensions, copies each
// original to /public at full resolution (no compression), generates a tiny
// blur-up loading placeholder, merges any per-photo overrides, and writes
// data/manifest.json for the site to consume.
//
// Run manually:  npm run gallery
// Runs automatically before `next dev` (predev) and `next build` (prebuild).

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUTPUT_DIR = path.join(ROOT, "public", "gallery");
const MANIFEST_PATH = path.join(ROOT, "data", "manifest.json");
const OVERRIDES_PATH = path.join(CONTENT_DIR, "overrides.json");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

// Nice display names for album folders. Anything not listed falls back to the
// humanizer below. Edit freely — purely cosmetic.
const ALBUM_NAMES = {
  "audi-s1": "Audi S1",
  "bmw-e36-m3": "BMW E36 M3",
  "gr-gt": "Toyota GR GT",
  "nature": "Scenery",
  "porsche-911-turbo-s": "Porsche 911 Turbo S",
  "rx7-fd": "Mazda RX-7 FD",
  "rx7-sa": "Mazda RX-7 SA",
  "supra-mk3": "Toyota Supra MK3",
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeToken(tok) {
  if (!tok) return "";
  // Codes like s1, m3, fd, sa, gt, mk3, rx7 -> uppercase
  if (/\d/.test(tok) || tok.length <= 2) return tok.toUpperCase();
  return tok.charAt(0).toUpperCase() + tok.slice(1);
}

function humanize(str) {
  return str
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(humanizeToken)
    .join(" ");
}

function albumDisplayName(slug) {
  return ALBUM_NAMES[slug] ?? humanize(slug);
}

// Derive a default photo title from its filename. Generic screenshots / bare
// timestamps get no descriptor (the album name carries them instead).
function defaultTitle(rawName, albumSlug, albumName) {
  let base = rawName;
  if (base.toLowerCase().startsWith(albumSlug.replace(/-/g, ""))) {
    // no-op; handled by token strip below
  }
  // strip a leading copy of the album slug from the filename
  const albumTokens = albumSlug.split("-");
  let tokens = base.split(/[-_\s]+/).filter(Boolean);
  while (tokens.length && albumTokens.includes(tokens[0].toLowerCase())) {
    tokens.shift();
  }
  const cleaned = tokens.join(" ");
  const isGeneric =
    /^screenshot/i.test(rawName) || /^\d[\d\s\-:.]*$/.test(cleaned) || cleaned.trim() === "";
  if (isGeneric) return albumName;
  return humanize(cleaned);
}

async function loadOverrides() {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function listImages() {
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  const albums = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const images = [];
  for (const album of albums) {
    const dir = path.join(CONTENT_DIR, album);
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const f of files) {
      if (!f.isFile()) continue;
      if (!IMAGE_EXT.has(path.extname(f.name).toLowerCase())) continue;
      images.push({ album, file: f.name, fullPath: path.join(dir, f.name) });
    }
  }
  return images;
}

async function processImage(img, overrides) {
  const { album, file, fullPath } = img;
  const albumName = overrides.albums?.[album]?.name ?? albumDisplayName(album);
  const base = slugify(path.parse(file).name);
  const outDir = path.join(OUTPUT_DIR, album);
  await fs.mkdir(outDir, { recursive: true });

  const stat = await fs.stat(fullPath);
  const meta = await sharp(fullPath, { failOn: "none" }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const orientation = width >= height ? "landscape" : "portrait";
  const aspectRatio = height ? +(width / height).toFixed(4) : 1;

  // Serve the ORIGINAL file at full resolution, copied as-is (no compression,
  // no resizing). Just give it a URL-safe filename.
  const ext = path.extname(file).toLowerCase();
  const outName = `${base}${ext}`;
  await fs.copyFile(fullPath, path.join(outDir, outName));
  const src = `/gallery/${album}/${outName}`;

  // Tiny blur-up placeholder (only used as a loading shim, never the final image).
  const blurBuf = await sharp(fullPath, { failOn: "none" })
    .resize({ width: 24 })
    .webp({ quality: 40 })
    .toBuffer();
  const blurDataURL = `data:image/webp;base64,${blurBuf.toString("base64")}`;

  const id = `${album}/${file}`;
  const ov = overrides[id] ?? overrides[`${album}/${path.parse(file).name}`] ?? {};

  return {
    id: `${album}/${base}`,
    album,
    albumName,
    title: ov.title ?? defaultTitle(path.parse(file).name, album, albumName),
    caption: ov.caption ?? null,
    tags: ov.tags ?? [],
    width,
    height,
    orientation,
    aspectRatio,
    blurDataURL,
    sources: [{ w: width, src }],
    full: src,
    mtime: stat.mtimeMs,
  };
}

async function main() {
  // Start clean so removed photos don't leave orphaned derivatives.
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const overrides = await loadOverrides();
  const images = await listImages();

  const photos = [];
  for (const img of images) {
    try {
      photos.push(await processImage(img, overrides));
    } catch (err) {
      console.warn(`  ! skipped ${img.album}/${img.file}: ${err.message}`);
    }
  }

  // Newest first by file modified time.
  photos.sort((a, b) => b.mtime - a.mtime);

  const albumCounts = new Map();
  for (const p of photos) {
    const entry = albumCounts.get(p.album) ?? { slug: p.album, name: p.albumName, count: 0 };
    entry.count += 1;
    albumCounts.set(p.album, entry);
  }
  const albums = [...albumCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: photos.length,
    albums,
    photos,
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`gallery: ${photos.length} photos across ${albums.length} albums -> data/manifest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
