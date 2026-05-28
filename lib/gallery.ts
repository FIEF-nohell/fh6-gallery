import manifestJson from "@/data/manifest.json";

export type Orientation = "landscape" | "portrait";

export interface PhotoSource {
  w: number;
  src: string;
}

export interface Photo {
  id: string;
  album: string;
  albumName: string;
  title: string;
  caption: string | null;
  tags: string[];
  width: number;
  height: number;
  orientation: Orientation;
  aspectRatio: number;
  blurDataURL: string;
  sources: PhotoSource[];
  full: string;
  mtime: number;
}

export interface Album {
  slug: string;
  name: string;
  count: number;
}

export interface Manifest {
  generatedAt: string;
  count: number;
  albums: Album[];
  photos: Photo[];
}

export const manifest = manifestJson as Manifest;
