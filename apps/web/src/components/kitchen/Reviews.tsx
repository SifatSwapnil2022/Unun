import type { KitchenDetail, RatingSummary } from '@unun/core/contracts';
import { Stars } from '@/components/ui/Stars';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { formatDay, formatNumber, formatRating, plural } from '@/lib/format';

type ReviewsProps = {
  locale: Locale;
  rating: RatingSummary;
  reviews: KitchenDetail['reviews'];
  copy: Dictionary['kitchen']['reviews'];
  ratingCopy: Dictionary['rating'];
};

const FIVE_TO_ONE = [5, 4, 3, 2, 1];

/**
 * What customers thought of a kitchen: the average, how the ratings are spread, and the
 * latest things people wrote. Every rating here came from an order that was delivered.
 */
export function Reviews({ locale, rating, reviews, copy, ratingCopy }: ReviewsProps) {
  const most = Math.max(...reviews.byStars, 1);
  const starsLabel = (stars: number) =>
    fill(plural(stars, ratingCopy.stars), { count: formatNumber(stars, locale) });

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="mt-16 scroll-mt-20"
    >
      <h2 id="reviews-heading" className="display text-[clamp(1.6rem,3vw,2.2rem)]">
        {copy.heading}
      </h2>

      {rating.average === null ? (
        <p className="mt-4 max-w-[52ch] text-lg">
          {copy.none} {copy.basis}
        </p>
      ) : (
        <>
          <div className="mt-6 grid max-w-[40rem] items-center gap-x-10 gap-y-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <p>
              <span className="display block text-[clamp(3.5rem,8vw,5rem)] leading-none tabular-nums">
                <span className="sr-only">
                  {fill(ratingCopy.outOfFive, {
                    average: formatRating(rating.average, locale),
                  })}
                </span>
                <span aria-hidden="true">{formatRating(rating.average, locale)}</span>
              </span>
              <span className="mt-2 block text-base text-soot/75 tabular-nums">
                {fill(plural(rating.count, ratingCopy.count), {
                  count: formatNumber(rating.count, locale),
                })}
              </span>
            </p>

            <table className="w-full border-collapse text-base tabular-nums">
              <caption className="sr-only">{copy.spread}</caption>
              <tbody>
                {FIVE_TO_ONE.map((stars) => {
                  const count = reviews.byStars[stars - 1] ?? 0;
                  return (
                    <tr key={stars}>
                      <th scope="row" className="w-16 py-1 pr-3 text-left font-normal">
                        {starsLabel(stars)}
                      </th>
                      {/* The bar repeats the count beside it. */}
                      <td aria-hidden="true" className="py-1">
                        <span className="block h-3 bg-ash-deep">
                          <span
                            className="block h-full bg-soot"
                            style={{ width: `${(count / most) * 100}%` }}
                          />
                        </span>
                      </td>
                      <td className="w-10 py-1 pl-3 text-right">
                        {formatNumber(count, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-base text-soot/75">{copy.basis}</p>

          {reviews.latest.length === 0 ? (
            <p className="mt-6 text-lg">{copy.noComments}</p>
          ) : (
            <ul className="mt-6 max-w-[44rem] border-t border-soot/25">
              {reviews.latest.map((review) => (
                <li key={review.id} className="border-b border-soot/25 py-5">
                  <Stars stars={review.stars} label={starsLabel(review.stars)} />
                  <p className="mt-2 text-lg">{review.comment}</p>
                  <p className="mt-1.5 text-base text-soot/75">
                    {review.author}, {formatDay(review.at, locale)}
                    {review.dishes.length > 0 ? (
                      <>
                        <br />
                        {fill(copy.ordered, {
                          dishes: review.dishes.map((dish) => dish[locale]).join(', '),
                        })}
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
