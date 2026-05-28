// Pre-deploy gallery builder.
// Scans content/ (any depth) for images, measures each one's width/height,
// optimizes it to WebP, generates a tiny blur-up placeholder, and writes
// data/manifest.json for the site. No albums, no tags — just the photos.
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

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

// Tune these two if you want bigger/smaller files.
const WEBP_QUALITY = 90; // visual quality (0-100)
const SCALE = 0.9; // 0.9 = output at 90% of original dimensions

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Recursively collect every image under content/, regardless of folders.
async function walk(dir, base) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else if (e.isFile() && IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push({ full, rel: path.relative(base, full) });
    }
  }
  return out;
}

async function processImage(img) {
  const { full, rel } = img;

  // Build a URL-safe output path that mirrors any subfolders (avoids name clashes).
  const parts = rel.split(path.sep);
  const fileBase = slugify(path.parse(parts.pop()).name);
  const dirSlug = parts.map(slugify).filter(Boolean);
  const relSlug = [...dirSlug, fileBase].join("/");

  const outFile = path.join(OUTPUT_DIR, ...dirSlug, `${fileBase}.webp`);
  await fs.mkdir(path.dirname(outFile), { recursive: true });

  const stat = await fs.stat(full);
  const meta = await sharp(full, { failOn: "none" }).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  const width = Math.max(1, Math.round(srcW * SCALE));
  const height = Math.max(1, Math.round(srcH * SCALE));

  // Optimized WebP (slightly scaled down, high quality).
  await sharp(full, { failOn: "none" })
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outFile);

  // Tiny blur-up placeholder, inlined as a data URL.
  const blurBuf = await sharp(full, { failOn: "none" })
    .resize({ width: 24 })
    .webp({ quality: 40 })
    .toBuffer();
  const blurDataURL = `data:image/webp;base64,${blurBuf.toString("base64")}`;

  return {
    id: relSlug,
    src: `/gallery/${relSlug}.webp`,
    width,
    height,
    blurDataURL,
    mtime: stat.mtimeMs,
  };
}

async function main() {
  // Start clean so removed photos don't leave orphaned files.
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const images = await walk(CONTENT_DIR, CONTENT_DIR);

  const photos = [];
  for (const img of images) {
    try {
      photos.push(await processImage(img));
    } catch (err) {
      console.warn(`  ! skipped ${img.rel}: ${err.message}`);
    }
  }

  // Newest first by file modified time, then drop the sort key from output.
  photos.sort((a, b) => b.mtime - a.mtime);
  for (const p of photos) delete p.mtime;

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: photos.length,
    photos,
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`gallery: optimized ${photos.length} photos -> data/manifest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
