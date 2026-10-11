/**
 * The photographs and hero clips the site can show. `library.json` is generated from
 * media/manifest.json by `pnpm media:library`: each entry points at a copy under
 * /media when one has been downloaded, and at the picture's own address otherwise.
 *
 * Only server components import this file. A client component is handed the addresses
 * it needs, so the whole library is not sent to the browser.
 */
import library from '@/media/library.json';

export type Photo = {
  /** A path under /media, or a full address on the source's own servers. */
  src: string;
  credit: string;
  source: string;
  page: string;
  /** What the photograph shows, in English. */
  shows: string;
  /** What the site uses it for. */
  standsFor: string;
};

export type Clip = {
  src: string;
  credit: string;
  source: string;
  page: string;
  shows: string;
};

export const CLIP_KEYS = ['cook', 'ride', 'door'] as const;
export type ClipKey = (typeof CLIP_KEYS)[number];

type Library = {
  photos: Record<string, Photo>;
  videos: Record<string, Clip>;
};

const media = library as unknown as Library;

export function photo(key: string | null | undefined): Photo | null {
  return key ? (media.photos[key] ?? null) : null;
}

/** The addresses of the given photographs, by key. Keys with no photograph are left out. */
export function photoSources(keys: Iterable<string | null>): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const key of keys) {
    const entry = photo(key);
    if (key && entry) sources[key] = entry.src;
  }
  return sources;
}

export function clip(key: ClipKey): Clip | null {
  return media.videos[key] ?? null;
}

export const allPhotos: Array<Photo & { key: string }> = Object.entries(media.photos).map(
  ([key, entry]) => ({ key, ...entry }),
);

export const allClips: Array<Clip & { key: string }> = Object.entries(media.videos).map(
  ([key, entry]) => ({ key, ...entry }),
);
