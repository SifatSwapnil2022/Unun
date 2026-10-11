import type { KitchenSummary } from '@unun/core/contracts';
import Link from 'next/link';
import { Cover } from '@/components/ui/Cover';
import { KitchenProfile } from '@/components/ui/KitchenProfile';
import { OnTimeRecord } from '@/components/ui/OnTimeRecord';
import { RatingMark } from '@/components/ui/Stars';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { formatNumber, formatTaka } from '@/lib/format';

type KitchenCardProps = {
  kitchen: KitchenSummary;
  locale: Locale;
  copy: Dictionary['card'];
  ratingCopy: Dictionary['rating'];
  /** Load the photograph early. Set for the first row of a page. */
  priority?: boolean;
};

export function KitchenCard({
  kitchen,
  locale,
  copy,
  ratingCopy,
  priority = false,
}: KitchenCardProps) {
  const otherLocale: Locale = locale === 'en' ? 'bn' : 'en';
  const { window, fee } = kitchen.delivery;

  return (
    <li>
      <Link href={`/${locale}/kitchens/${kitchen.slug}`} className="group block">
        <Cover
          photoKey={kitchen.photo}
          tone={kitchen.tone}
          title={kitchen.name[otherLocale]}
          titleLang={otherLocale}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 46vw, 92vw"
          priority={priority}
          className="aspect-[4/3] transition-transform duration-200 ease-out group-hover:-translate-y-1"
        />

        <div className="mt-4 flex items-center gap-3.5">
          <KitchenProfile
            photoKey={kitchen.profilePhoto}
            tone={kitchen.tone}
            name={kitchen.name[locale]}
            locale={locale}
            size={60}
            className="w-[3.75rem] text-2xl ring-4 ring-soot/10"
          />
          <div className="min-w-0">
            <h3 className="display text-[1.7rem]">{kitchen.name[locale]}</h3>
            <p className="mt-1 text-base text-soot/75">
              {kitchen.cuisines.map((cuisine) => cuisine.name[locale]).join(', ')},{' '}
              {kitchen.area.name[locale]}
            </p>
          </div>
        </div>

        {kitchen.matched && kitchen.matched.length > 0 ? (
          <p className="mt-2 text-base font-semibold">
            {fill(copy.matched, {
              dishes: kitchen.matched.map((dish) => dish[locale]).join(', '),
            })}
          </p>
        ) : null}

        <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="display text-[1.4rem] tabular-nums">
            {fill(copy.window, {
              min: formatNumber(window.min, locale),
              max: formatNumber(window.max, locale),
            })}
          </span>
          <span className="text-base tabular-nums">
            {fill(copy.delivery, { fee: formatTaka(fee, locale) })}
          </span>
        </p>

        <p className="mt-1.5">
          <RatingMark rating={kitchen.rating} locale={locale} copy={ratingCopy} />
        </p>

        <div className="mt-1.5">
          <OnTimeRecord
            count={kitchen.onTimeOfTen}
            label={fill(copy.onTime, {
              count: formatNumber(kitchen.onTimeOfTen, locale),
            })}
          />
        </div>

        {kitchen.isOpen ? null : (
          <p className="mt-2 text-base font-semibold text-clay">{copy.closed}</p>
        )}
      </Link>
    </li>
  );
}
