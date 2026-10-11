'use client';

import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';

// three.js is only downloaded in the browser, and only when the ember scene is shown.
const EmberCanvas = dynamic(
  () => import('./EmberCanvas').then((mod) => mod.EmberCanvas),
  { ssr: false },
);

/** How long each clip is on screen. */
const SCENE_MS = 5600;

export type FilmScene = {
  key: string;
  /** Address of the clip, or null when the library has none for this scene. */
  src: string | null;
  title: string;
  /** The step number, already written in the page's digits. */
  number: string;
};

type Film = {
  scenes: FilmScene[];
  active: number;
  hasFilm: boolean;
  /** True once the film has played at all, by itself or because the visitor asked. */
  started: boolean;
  playing: boolean;
  running: boolean;
  /**
   * What is drawn behind the hero. Nothing until the page has hydrated; then the film,
   * or the ember scene when there is no film or the visitor is saving data.
   */
  backdrop: 'none' | 'film' | 'embers';
  /** Whether a scene has a clip that can be shown. */
  canShow: (index: number) => boolean;
  select: (index: number) => void;
  toggle: () => void;
  reportVisible: (visible: boolean) => void;
  reportFailed: (index: number) => void;
};

const FilmContext = createContext<Film | null>(null);

function useFilm(): Film {
  const film = useContext(FilmContext);
  if (!film) throw new Error('Film components must be used inside HeroFilm');
  return film;
}

const noSubscription = () => () => {};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * True when the visitor asked for less motion. The server cannot know, so it assumes
 * they did; the film then starts only in the browser, and hydration always matches.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}

/** True when the visitor's browser asks sites to use less data. */
function useSaveData(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () =>
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
        ?.saveData === true,
    () => false,
  );
}

/** False on the server and while the page hydrates, true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

function usePageVisible(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange);
      return () => document.removeEventListener('visibilitychange', onChange);
    },
    () => document.visibilityState === 'visible',
    () => true,
  );
}

/**
 * Runs the hero film: three short clips shown one after another. It plays by itself
 * unless the visitor asked for less motion or less data, and it stops while the hero
 * is off screen or the tab is in the background. With less motion the first clip is
 * shown as a still until the visitor presses play. A clip that cannot be loaded is
 * left out, and if none can be loaded the ember scene takes the film's place.
 */
export function HeroFilm({
  scenes,
  children,
}: {
  scenes: FilmScene[];
  children: ReactNode;
}) {
  const [failed, setFailed] = useState<readonly number[]>([]);
  const playable = useMemo(
    () =>
      scenes.flatMap((scene, index) =>
        scene.src && !failed.includes(index) ? [index] : [],
      ),
    [scenes, failed],
  );
  const hasFilm = playable.length > 0;

  const reducedMotion = usePrefersReducedMotion();
  const saveData = useSaveData();
  const pageVisible = usePageVisible();
  const hydrated = useHydrated();

  const [chosen, setChosen] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [inView, setInView] = useState(true);

  // The scene on screen: the chosen one, or the first that can be shown if it cannot.
  const active = playable.includes(chosen) ? chosen : (playable[0] ?? 0);
  const playing = hasFilm && (choice ?? (!reducedMotion && !saveData));
  const started = playing || choice !== null;
  const running = playing && inView && pageVisible;
  const backdrop = !hydrated
    ? 'none'
    : hasFilm && (started || !saveData)
      ? 'film'
      : 'embers';

  const elapsed = useRef(0);
  const timedScene = useRef(active);

  useEffect(() => {
    if (timedScene.current !== active) {
      timedScene.current = active;
      elapsed.current = 0;
    }
    if (!running) return;

    const startedAt = performance.now();
    const timer = window.setTimeout(
      () => {
        const position = playable.indexOf(active);
        setChosen(playable[(position + 1) % playable.length] ?? active);
      },
      Math.max(SCENE_MS - elapsed.current, 0),
    );

    return () => {
      window.clearTimeout(timer);
      // Remember how far this scene got, so a pause resumes instead of starting over.
      elapsed.current += performance.now() - startedAt;
    };
  }, [running, active, playable]);

  const select = useCallback((index: number) => {
    setChosen(index);
    setChoice(true);
  }, []);

  const canShow = useCallback((index: number) => playable.includes(index), [playable]);

  const reportFailed = useCallback((index: number) => {
    setFailed((before) => (before.includes(index) ? before : [...before, index]));
  }, []);

  const toggle = useCallback(() => setChoice(!playing), [playing]);

  const film = useMemo<Film>(
    () => ({
      scenes,
      active,
      hasFilm,
      started,
      playing,
      running,
      backdrop,
      canShow,
      select,
      toggle,
      reportVisible: setInView,
      reportFailed,
    }),
    [
      scenes,
      active,
      hasFilm,
      started,
      playing,
      running,
      backdrop,
      canShow,
      select,
      toggle,
      reportFailed,
    ],
  );

  return <FilmContext.Provider value={film}>{children}</FilmContext.Provider>;
}

/** The moving picture behind the hero: the film when there is one, embers otherwise. */
export function FilmBackdrop() {
  const { scenes, active, running, backdrop, canShow, reportVisible, reportFailed } =
    useFilm();
  const frame = useRef<HTMLDivElement>(null);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);
  const shownScene = useRef(active);

  // While the film runs, the clip after the one on screen is loaded ahead of time.
  const showable = scenes.flatMap((_, index) => (canShow(index) ? [index] : []));
  const upNext = running
    ? showable[(showable.indexOf(active) + 1) % showable.length]
    : undefined;

  useEffect(() => {
    const node = frame.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => reportVisible(entry?.isIntersecting ?? true),
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reportVisible]);

  useEffect(() => {
    const changed = shownScene.current !== active;
    shownScene.current = active;

    videos.current.forEach((video, index) => {
      if (!video) return;
      if (index !== active || !running) {
        video.pause();
        return;
      }
      if (changed) video.currentTime = 0;
      // Autoplay can be refused. The still frame stays, which is an acceptable result.
      video.play().catch(() => {});
    });
  }, [active, running, backdrop]);

  return (
    <div
      ref={frame}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="hero-glow absolute inset-0" />

      {backdrop === 'film' ? (
        <>
          {scenes.map((scene, index) =>
            scene.src && canShow(index) ? (
              <video
                key={scene.key}
                ref={(node) => {
                  videos.current[index] = node;
                }}
                // The fragment makes browsers draw a first frame before the clip plays.
                src={`${scene.src}#t=0.1`}
                className="film-clip"
                data-active={index === active}
                muted
                loop
                playsInline
                disablePictureInPicture
                preload={index === active || index === upNext ? 'auto' : 'metadata'}
                tabIndex={-1}
                onError={() => reportFailed(index)}
              />
            ) : null,
          )}
          {/* Keeps the headline readable over bright frames. */}
          <div className="absolute inset-0 bg-soot/65" />
        </>
      ) : backdrop === 'embers' ? (
        <EmberCanvas />
      ) : null}
    </div>
  );
}

type FilmStepsProps = {
  label: string;
  pauseLabel: string;
  playLabel: string;
};

/**
 * The three steps of an order. With the film they double as its index: the line under
 * a step fills while its clip plays, and choosing a step jumps to that clip.
 */
export function FilmSteps({ label, pauseLabel, playLabel }: FilmStepsProps) {
  const { scenes, active, hasFilm, started, playing, running, canShow, select, toggle } =
    useFilm();

  return (
    <div className="mt-10 max-w-[46rem]">
      <ol
        aria-label={label}
        className="grid gap-x-6 gap-y-5 sm:grid-cols-3"
        style={{ '--film-scene': `${SCENE_MS}ms` } as CSSProperties}
      >
        {scenes.map((scene, index) => {
          const state = !started
            ? 'idle'
            : index === active
              ? 'active'
              : index < active
                ? 'done'
                : 'idle';
          const body = (
            <>
              <span className="film-track" data-state={state} data-paused={!running}>
                <span />
              </span>
              <span className="mt-3 flex items-baseline gap-3 text-left">
                <span className="display text-xl text-turmeric tabular-nums">
                  {scene.number}
                </span>
                <span className="text-base text-ash sm:text-lg">{scene.title}</span>
              </span>
            </>
          );

          return (
            <li key={scene.key}>
              {canShow(index) ? (
                <button
                  type="button"
                  onClick={() => select(index)}
                  aria-current={state === 'active' ? 'step' : undefined}
                  className="block w-full"
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>

      {hasFilm ? (
        <button
          type="button"
          onClick={toggle}
          className="mt-5 text-sm text-ash/80 underline underline-offset-4 hover:text-turmeric"
        >
          {playing ? pauseLabel : playLabel}
        </button>
      ) : null}
    </div>
  );
}
