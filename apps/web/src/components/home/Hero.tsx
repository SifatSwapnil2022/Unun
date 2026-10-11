import type { AreaDto } from '@unun/core/contracts';
import { SiteHeader } from '@/components/layout/SiteHeader';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { formatNumber } from '@/lib/format';
import { CLIP_KEYS, clip } from '@/lib/media';
import { AddressForm } from './AddressForm';
import { FilmBackdrop, FilmSteps, HeroFilm, type FilmScene } from './HeroFilm';

type HeroProps = {
  locale: Locale;
  dictionary: Dictionary;
  areas: AreaDto[];
};

export function Hero({ locale, dictionary, areas }: HeroProps) {
  const { hero, nav } = dictionary;

  const scenes: FilmScene[] = CLIP_KEYS.map((key, index) => ({
    key,
    src: clip(key)?.src ?? null,
    title: hero.scenes[key],
    number: formatNumber(index + 1, locale),
  }));

  return (
    <section className="relative isolate flex min-h-svh flex-col bg-soot text-ash">
      <HeroFilm scenes={scenes}>
        <FilmBackdrop />
        <SiteHeader locale={locale} copy={nav} drawLogo />

        <div className="page-column mt-auto pt-20 pb-[clamp(2rem,6vh,4.5rem)]">
          <h1 className="display text-hero max-w-[15ch]">
            {hero.title.map((line, index) => (
              <span key={line} className="hero-line">
                <span style={{ animationDelay: `${0.25 + index * 0.12}s` }}>{line}</span>
              </span>
            ))}
          </h1>

          <p className="hero-fade mt-6 max-w-[44ch] text-lg text-ash/85 sm:text-xl">
            {hero.body}
          </p>

          <div className="hero-fade">
            <AddressForm locale={locale} copy={hero} areas={areas} />
            <FilmSteps
              label={hero.scenesLabel}
              pauseLabel={hero.pauseFilm}
              playLabel={hero.playFilm}
            />
          </div>
        </div>
      </HeroFilm>
    </section>
  );
}
