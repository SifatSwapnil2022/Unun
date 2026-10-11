/**
 * Keeps apps/web/src/media/library.json, the only media file the web app reads, in step
 * with media/manifest.json.
 *
 *   pnpm media:library          rebuild library.json
 *   pnpm media:fetch            download every photograph and clip, then rebuild
 *   pnpm media:fetch --force    download again, replacing files already on disk
 *   pnpm media:check            request every remote address and list the ones that fail
 *
 * A picture is served from its source's own address (Unsplash, Pexels or Mixkit) until
 * a copy exists under apps/web/public/media. A copy on disk always wins, whether this
 * script downloaded it or you put it there yourself.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestPath = path.join(root, 'media', 'manifest.json');
const publicDir = path.join(root, 'apps', 'web', 'public', 'media');
const libraryPath = path.join(root, 'apps', 'web', 'src', 'media', 'library.json');

const COMMANDS = ['library', 'fetch', 'check'];
const PHOTO_WIDTH = 1400;
const AT_ONCE = 6;

// Some hosts refuse requests that do not look like a browser.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/jpeg,video/mp4,*/*',
};

const SOURCE_NAMES = {
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  mixkit: 'Mixkit',
  own: '',
};

const photoFile = (photo) => path.join(publicDir, 'photos', `${photo.key}.jpg`);
const videoFile = (video) => path.join(publicDir, 'video', `${video.key}.mp4`);

/** The address a photograph is downloaded from, at a size fit for a full-width cover. */
const photoDownload = (photo) => `${photo.image}?fm=jpg&q=80&w=${PHOTO_WIDTH}&fit=max`;

async function hasFile(file) {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

/** Runs the tasks a few at a time. */
async function inBatches(items, worker) {
  const queue = [...items];
  const runners = Array.from({ length: AT_ONCE }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await worker(item);
  });
  await Promise.all(runners);
}

/** Requests an address and says what is wrong with the answer, or null if it is fine. */
async function problemWith(response, kind) {
  if (!response.ok) return `HTTP ${response.status}`;
  const type = response.headers.get('content-type') ?? '';
  return type.startsWith(`${kind}/`)
    ? null
    : `expected ${kind}, got "${type || 'unknown type'}"`;
}

async function download(url, file, kind) {
  const minimumBytes = kind === 'image' ? 15_000 : 150_000;

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(kind === 'image' ? 60_000 : 300_000),
    });
    const problem = await problemWith(response, kind);
    if (problem) return problem;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < minimumBytes) return `file too small (${bytes.length} bytes)`;

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Asks for the start of a file, which is enough to know that it is there. */
async function probe(url, kind) {
  try {
    const response = await fetch(url, {
      headers: { ...HEADERS, Range: 'bytes=0-2047' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    const problem = await problemWith(response, kind);
    await response.body?.cancel();
    return problem;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function fetchAll(manifest, force) {
  const missed = [];

  const fetchOne = async (entry, url, file, kind) => {
    if (!url) return;
    if (!force && (await hasFile(file))) return;

    const problem = await download(url, file, kind);
    if (problem) {
      missed.push({ entry, file, problem });
      console.log(`  missed  ${entry.key}  (${problem})`);
    } else {
      console.log(`  saved   ${entry.key}`);
    }
  };

  console.log(`Photographs (${manifest.photos.length})`);
  await inBatches(manifest.photos, (photo) =>
    fetchOne(photo, photo.image && photoDownload(photo), photoFile(photo), 'image'),
  );

  console.log(`Hero clips (${manifest.videos.length})`);
  for (const video of manifest.videos) {
    await fetchOne(video, video.url, videoFile(video), 'video');
  }

  if (missed.length > 0) {
    console.log('');
    console.log('These could not be downloaded, so the site keeps using their remote');
    console.log(
      'address. To keep a copy, open the page, save the file under the name shown',
    );
    console.log('and run "pnpm media:library":');
    for (const { entry, file } of missed) {
      console.log(`  ${path.relative(root, file)}`);
      console.log(`    ${entry.page}`);
    }
  }
}

async function checkAll(manifest) {
  const failed = [];
  let checked = 0;

  const checkOne = async (entry, url, kind) => {
    if (!url) return;
    checked += 1;
    const problem = await probe(url, kind);
    if (problem) {
      failed.push({ entry, problem });
      console.log(`  failed  ${entry.key}  (${problem})`);
    }
  };

  console.log('Requesting every remote address. This takes about a minute.');
  await inBatches(manifest.photos, (photo) =>
    checkOne(photo, photo.image && `${photo.image}?w=64&q=40`, 'image'),
  );
  for (const video of manifest.videos) await checkOne(video, video.url, 'video');

  console.log('');
  console.log(`${checked - failed.length} of ${checked} addresses answered.`);
  if (failed.length > 0) {
    console.log(
      'Replace the address of each failed entry in media/manifest.json, then run',
    );
    console.log('"pnpm media:library". Until then the site shows its fallback for them:');
    for (const { entry } of failed) console.log(`  ${entry.key}  ${entry.page}`);
    process.exitCode = 1;
  }
}

/** Writes library.json: the copy on disk where there is one, the remote address otherwise. */
async function writeLibrary(manifest) {
  const library = { photos: {}, videos: {} };
  const counts = { local: 0, remote: 0, missing: 0 };

  const srcOf = (file, publicPath, remote) => {
    if (existsSync(file)) {
      counts.local += 1;
      return publicPath;
    }
    if (remote) {
      counts.remote += 1;
      return remote;
    }
    counts.missing += 1;
    return null;
  };

  for (const photo of manifest.photos) {
    const src = srcOf(photoFile(photo), `/media/photos/${photo.key}.jpg`, photo.image);
    if (!src) continue;
    library.photos[photo.key] = {
      src,
      credit: photo.credit,
      source: SOURCE_NAMES[photo.source] ?? photo.source,
      page: photo.page ?? '',
      shows: photo.shows,
      standsFor: photo.standsFor,
    };
  }

  for (const video of manifest.videos) {
    const src = srcOf(videoFile(video), `/media/video/${video.key}.mp4`, video.url);
    if (!src) continue;
    library.videos[video.key] = {
      src,
      credit: video.credit,
      source: SOURCE_NAMES[video.source] ?? video.source,
      page: video.page ?? '',
      shows: video.shows,
    };
  }

  await mkdir(path.dirname(libraryPath), { recursive: true });
  await writeFile(libraryPath, `${JSON.stringify(library, null, 2)}\n`);

  console.log('');
  console.log(
    `library.json: ${counts.local} from this computer, ${counts.remote} remote.`,
  );
  if (counts.missing > 0) {
    const entries =
      counts.missing === 1 ? '1 entry has' : `${counts.missing} entries have`;
    console.log(`${entries} neither a file nor an address.`);
  }
}

async function main() {
  const [command = 'library', ...flags] = process.argv.slice(2);
  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command "${command}". Use one of: ${COMMANDS.join(', ')}.`);
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (command === 'check') {
    await checkAll(manifest);
    return;
  }

  if (command === 'fetch') await fetchAll(manifest, flags.includes('--force'));
  await writeLibrary(manifest);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
