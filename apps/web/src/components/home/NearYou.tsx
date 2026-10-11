import type { KitchenList, KitchenSummary } from '@unun/core/contracts';
import Link from 'next/link';
import { KitchenCard } from '@/components/kitchen/KitchenCard';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { formatNumber, plural } from '@/lib/format';

type NearYouProps = {
  locale: Locale;
  copy: Dictionary['nearYou'];
  card: Dictionary['card'];
  rating: Dictionary['rating'];
  list: KitchenList;
};

const SHOWN = 6;

/**
 * The list arrives fastest first. Taking the first kitchen of each cuisine keeps the
 * home page from showing six tea stalls, which are always the quickest.
 */
function fastestOfEachKind(kitchens: KitchenSummary[]): KitchenSummary[] {
  const seen = new Set<string>();
  const picked: KitchenSummary[] = [];

  for (const kitchen of kitchens) {
    const cuisine = kitchen.cuisines[0]?.id ?? kitchen.slug;
    if (seen.has(cuisine)) continue;
    seen.add(cuisine);
    picked.push(kitchen);
    if (picked.length === SHOWN) break;
  }
  return picked;
}

/** One fast kitchen for each kind of food, with a link to the rest. */
export function NearYou({ locale, copy, card, rating, list }: NearYouProps) {
  if (list.total === 0) return null;

  return (
    <section
      id="near-you"
      aria-labelledby="near-you-heading"
      className="scroll-mt-6 bg-ash"
    >
      <div className="page-column py-[clamp(3.5rem,9vw,6.5rem)]">
        <h2 id="near-you-heading" className="display text-section">
          {list.area
            ? fill(copy.headingIn, { area: list.area.name[locale] })
            : copy.heading}
        </h2>

        <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {fastestOfEachKind(list.kitchens).map((kitchen) => (
            <KitchenCard
              key={kitchen.slug}
              kitchen={kitchen}
              locale={locale}
              copy={card}
              ratingCopy={rating}
            />
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href={`/${locale}/kitchens`} className="btn btn-dark">
            {fill(plural(list.total, copy.seeAll), {
              count: formatNumber(list.total, locale),
            })}
          </Link>
          <p className="text-base text-soot/70">{copy.demoNote}</p>
        </div>
      </div>
    </section>
  );
}
