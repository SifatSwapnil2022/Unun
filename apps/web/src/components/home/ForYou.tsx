import type { RecommendationsDto } from '@unun/core/contracts';
import { KitchenCard } from '@/components/kitchen/KitchenCard';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';

type ForYouProps = {
  locale: Locale;
  picks: RecommendationsDto;
  copy: Dictionary['forYou'];
  card: Dictionary['card'];
  rating: Dictionary['rating'];
};

/**
 * Kitchens chosen for a signed-in customer from what they ordered before. The heading
 * says which dish the choice leans on, so the customer can see why they are shown.
 */
export function ForYou({ locale, picks, copy, card, rating }: ForYouProps) {
  if (picks.kitchens.length === 0) return null;

  return (
    <section aria-labelledby="for-you-heading" className="bg-paper">
      <div className="page-column py-[clamp(3.5rem,9vw,6.5rem)]">
        <h2 id="for-you-heading" className="display text-section max-w-[22ch]">
          {picks.because
            ? fill(copy.because, { dish: picks.because[locale] })
            : copy.heading}
        </h2>
        <p className="mt-4 max-w-[52ch] text-lg text-soot/80">{copy.body}</p>

        <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {picks.kitchens.map((kitchen) => (
            <KitchenCard
              key={kitchen.slug}
              kitchen={kitchen}
              locale={locale}
              copy={card}
              ratingCopy={rating}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
