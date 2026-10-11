import type { CuisineDto } from '@unun/core/contracts';
import Link from 'next/link';
import { Photo } from '@/components/ui/Photo';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { formatNumber, plural } from '@/lib/format';
import { photo } from '@/lib/media';
import { toneClasses } from '@/lib/tones';

type CuisinesProps = {
  locale: Locale;
  copy: Dictionary['cuisines'];
  cuisines: CuisineDto[];
};

/*
 * The tiles are flat colour blocks, like the bowls of a spice tin. A tile with a
 * photograph shows it above its label; a tile without one is all colour.
 */
export function Cuisines({ locale, copy, cuisines }: CuisinesProps) {
  if (cuisines.length === 0) return null;
  const otherLocale: Locale = locale === 'en' ? 'bn' : 'en';

  return (
    <section id="cuisines" aria-labelledby="cuisines-heading" className="bg-ash">
      <div className="page-column pt-[clamp(3.5rem,9vw,6.5rem)]">
        <h2 id="cuisines-heading" className="display text-section">
          {copy.heading}
        </h2>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {cuisines.map((cuisine) => {
            const image = photo(cuisine.photo);
            return (
              <li key={cuisine.id}>
                <Link
                  href={`/${locale}/kitchens?cuisine=${cuisine.id}`}
                  className={`flex h-full flex-col overflow-hidden rounded-[1.75rem] transition-transform duration-200 ease-out hover:-translate-y-1 ${toneClasses(cuisine.tone)}`}
                >
                  <span className="relative block aspect-[4/3]">
                    {image ? (
                      <Photo src={image.src} sizes="(min-width: 1024px) 230px, 46vw" />
                    ) : null}
                  </span>
                  <span className="flex flex-1 flex-col p-4 sm:p-5">
                    <span className="display text-[clamp(1.2rem,1.9vw,1.6rem)]">
                      {cuisine.name[locale]}
                    </span>
                    <span lang={otherLocale} className="mt-1.5 text-base opacity-80">
                      {cuisine.name[otherLocale]}
                    </span>
                    <span className="mt-auto pt-4 text-sm opacity-80 tabular-nums">
                      {fill(plural(cuisine.kitchens, copy.kitchens), {
                        count: formatNumber(cuisine.kitchens, locale),
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
