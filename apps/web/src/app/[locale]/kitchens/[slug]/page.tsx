import type { KitchenDetail } from '@unun/core/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BagPanel } from '@/components/kitchen/BagPanel';
import { Menu } from '@/components/kitchen/Menu';
import { Reviews } from '@/components/kitchen/Reviews';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Cover } from '@/components/ui/Cover';
import { KitchenProfile } from '@/components/ui/KitchenProfile';
import { Notice } from '@/components/ui/Notice';
import { OnTimeRecord } from '@/components/ui/OnTimeRecord';
import { RatingMark } from '@/components/ui/Stars';
import { isLocale, type Locale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { ApiRequestError, api } from '@/lib/api';
import { readArea } from '@/lib/area.server';
import { formatMinuteOfDay, formatNumber, formatTaka } from '@/lib/format';
import { photoSources } from '@/lib/media';

type KitchenPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

type Loaded =
  | { state: 'ready'; kitchen: KitchenDetail; areaName: string }
  | { state: 'out-of-range'; kitchen: KitchenDetail; areaName: string };

const isCode = (error: unknown, code: string) =>
  error instanceof ApiRequestError && error.code === code;

async function loadKitchen(slug: string, locale: Locale): Promise<Loaded> {
  const areaId = await readArea();

  try {
    const [kitchen, areas] = await Promise.all([api.kitchen(slug, areaId), api.areas()]);
    const area = areas.find((candidate) => candidate.id === kitchen.delivery.areaId);
    return { state: 'ready', kitchen, areaName: area?.name[locale] ?? '' };
  } catch (error) {
    if (isCode(error, 'not_found')) notFound();

    // A remembered area that no longer exists: show the kitchen for its own area.
    if (isCode(error, 'unknown_area')) {
      const kitchen = await api.kitchen(slug);
      return { state: 'ready', kitchen, areaName: kitchen.area.name[locale] };
    }

    if (isCode(error, 'out_of_range')) {
      const [kitchen, areas] = await Promise.all([api.kitchen(slug), api.areas()]);
      const area = areas.find((candidate) => candidate.id === areaId);
      return { state: 'out-of-range', kitchen, areaName: area?.name[locale] ?? '' };
    }

    throw error;
  }
}

export async function generateMetadata({ params }: KitchenPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  try {
    const kitchen = await api.kitchen(slug);
    return { title: kitchen.name[locale], description: kitchen.tagline[locale] };
  } catch {
    return {};
  }
}

export default async function KitchenPage({ params }: KitchenPageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.kitchen;
  const otherLocale: Locale = locale === 'en' ? 'bn' : 'en';

  const loaded = await loadKitchen(slug, locale);
  const { kitchen, areaName } = loaded;
  const name = kitchen.name[locale];
  const { window, fee } = kitchen.delivery;

  const facts = [
    {
      term: copy.arrives,
      value: fill(dictionary.card.window, {
        min: formatNumber(window.min, locale),
        max: formatNumber(window.max, locale),
      }),
      note: fill(copy.to, { area: areaName }),
    },
    { term: copy.deliveryFee, value: formatTaka(fee, locale) },
    { term: copy.minOrder, value: formatTaka(kitchen.minOrder, locale) },
    {
      term: copy.hours,
      value: fill(copy.hoursValue, {
        opens: formatMinuteOfDay(kitchen.hours.opens, locale),
        closes: formatMinuteOfDay(kitchen.hours.closes, locale),
      }),
    },
  ];

  return (
    <>
      <div className="bg-soot text-ash">
        <SiteHeader locale={locale} copy={dictionary.nav} />

        <div className="page-column pt-[clamp(1.5rem,4vw,2.5rem)] pb-[clamp(2.5rem,6vw,4.5rem)]">
          <Link
            href={`/${locale}/kitchens`}
            className="text-base underline underline-offset-8 hover:text-turmeric"
          >
            {copy.back}
          </Link>

          {/* The cover runs the width of the page; the profile picture sits on its lower edge. */}
          <div className="relative mt-6">
            <Cover
              photoKey={kitchen.photo}
              tone={kitchen.tone}
              title={kitchen.name[otherLocale]}
              titleLang={otherLocale}
              titleAt="top"
              sizes="(min-width: 1280px) 1184px, 92vw"
              priority
              className="aspect-[16/10] w-full sm:aspect-[5/2] lg:aspect-[3/1]"
            />
            <div className="absolute bottom-0 left-5 translate-y-1/2 sm:left-8">
              <KitchenProfile
                photoKey={kitchen.profilePhoto}
                tone={kitchen.tone}
                name={name}
                locale={locale}
                size={136}
                className="w-24 text-5xl ring-[6px] ring-soot sm:w-[8.5rem] sm:text-6xl"
              />
            </div>
          </div>

          <div className="grid gap-x-14 gap-y-9 pt-[4.5rem] sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end">
            <div>
              <h1 className="display text-[clamp(2.75rem,7vw,5.5rem)]">{name}</h1>
              <p className="mt-4 max-w-[40ch] text-xl text-ash/85">
                {kitchen.tagline[locale]}
              </p>
              <p className="mt-4 text-base text-ash/70">
                {kitchen.cuisines.map((cuisine) => cuisine.name[locale]).join(', ')}
                <br />
                {kitchen.address[locale]}
                <br />
                {kitchen.tags
                  .map((tag, index) =>
                    index === 0
                      ? dictionary.dietary[tag]
                      : dictionary.dietary[tag].toLocaleLowerCase(locale),
                  )
                  .join(', ')}
              </p>
            </div>

            {loaded.state === 'ready' ? (
              <div>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-6">
                  {facts.map((fact) => (
                    <div key={fact.term}>
                      <dt className="text-base text-ash/70">{fact.term}</dt>
                      <dd className="display mt-1.5 text-[1.5rem] tabular-nums">
                        {fact.value}
                      </dd>
                      {fact.note ? (
                        <dd className="mt-1 text-sm text-ash/70">{fact.note}</dd>
                      ) : null}
                    </div>
                  ))}
                </dl>

                <p className="mt-7">
                  <a href="#reviews" className="hover:text-turmeric">
                    <RatingMark
                      rating={kitchen.rating}
                      locale={locale}
                      copy={dictionary.rating}
                      onDark
                      className="text-lg"
                    />
                  </a>
                </p>

                <div className="mt-3">
                  <OnTimeRecord
                    onDark
                    count={kitchen.onTimeOfTen}
                    label={`${copy.record}: ${fill(copy.recordValue, {
                      count: formatNumber(kitchen.onTimeOfTen, locale),
                    })}`}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loaded.state === 'out-of-range' ? (
        <main id="main">
          <Notice
            title={fill(copy.outOfRangeTitle, { kitchen: name, area: areaName })}
            action={
              <Link href={`/${locale}/kitchens`} className="btn btn-dark">
                {fill(copy.outOfRangeAction, { area: areaName })}
              </Link>
            }
          >
            {copy.outOfRangeBody}
          </Notice>
        </main>
      ) : (
        <main id="main" className="bg-ash">
          <div className="page-column grid gap-x-14 pb-32 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-[clamp(3.5rem,9vw,6.5rem)]">
            <div className="min-w-0">
              {kitchen.isOpen ? null : (
                <p className="mt-8 rounded-2xl bg-clay px-5 py-4 text-lg text-ash">
                  {fill(copy.closedNow, {
                    time: formatMinuteOfDay(kitchen.hours.opens, locale),
                  })}
                </p>
              )}
              <Menu
                locale={locale}
                kitchen={{ slug: kitchen.slug, name: kitchen.name }}
                sections={kitchen.sections}
                photos={photoSources(
                  kitchen.sections.flatMap((section) =>
                    section.items.map((item) => item.photo),
                  ),
                )}
                canOrder={kitchen.isOpen}
                copy={copy}
                bagCopy={dictionary.bag}
                allergenCopy={dictionary.allergens}
              />
              <Reviews
                locale={locale}
                rating={kitchen.rating}
                reviews={kitchen.reviews}
                copy={copy.reviews}
                ratingCopy={dictionary.rating}
              />
            </div>

            <div className="lg:pt-10">
              <BagPanel
                locale={locale}
                kitchen={{
                  slug: kitchen.slug,
                  name: kitchen.name,
                  minOrder: kitchen.minOrder,
                }}
                deliveryFee={fee}
                window={window}
                pricing={kitchen.pricing}
                copy={dictionary.bag}
                kitchenCopy={copy}
                pricingCopy={dictionary.pricing}
              />
            </div>
          </div>
        </main>
      )}

      {/* Room below the footer for the bag bar, which sits over the page on small screens. */}
      <div className="bg-soot pb-[4.5rem] lg:pb-0">
        <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
      </div>
    </>
  );
}
