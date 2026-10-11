import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLIP_KEYS, allPhotos, clip, photo, photoSources } from './media';

type Manifest = { photos: Array<{ key: string }> };

const manifest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../media/manifest.json', import.meta.url)),
    'utf8',
  ),
) as Manifest;

const isUsable = (src: string) => src.startsWith('/media/') || src.startsWith('https://');

describe('the media library', () => {
  it('has an entry for every photograph in the manifest', () => {
    const missing = manifest.photos.filter((entry) => photo(entry.key) === null);
    expect(missing.map((entry) => entry.key)).toEqual([]);
  });

  it('points every photograph at a local file or a secure address', () => {
    expect(allPhotos.length).toBeGreaterThan(0);
    for (const entry of allPhotos) {
      expect(isUsable(entry.src), `${entry.key}: ${entry.src}`).toBe(true);
      expect(entry.credit, entry.key).not.toBe('');
    }
  });

  it('has all three scenes of the home page film', () => {
    for (const key of CLIP_KEYS) {
      const entry = clip(key);
      expect(entry, key).not.toBeNull();
      expect(isUsable(entry?.src ?? ''), key).toBe(true);
    }
  });
});

describe('photoSources', () => {
  it('returns addresses by key and leaves out keys with no photograph', () => {
    const [first] = allPhotos;
    const sources = photoSources([first!.key, null, 'no-such-photograph']);
    expect(sources).toEqual({ [first!.key]: first!.src });
  });
});
