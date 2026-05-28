import manifestJson from "@/data/manifest.json";

export interface Photo {
  id: string;
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
}

export interface Manifest {
  generatedAt: string;
  count: number;
  photos: Photo[];
}

export const manifest = manifestJson as Manifest;
