import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KitchenCard } from '@/components/kitchen/KitchenCard';
import { ListControls } from '@/components/kitchen/ListControls';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeaderBar } from '@/components/layout/SiteHeader';
import { isLocale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { api, isUnknownArea } from '@/lib/api';
import { readArea } from '@/lib/area.server';
import { formatNumber, plural } from '@/lib/format';

type KitchensPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export async function generateMetadata({ params }: KitchensPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).list.titleAll } : {};
}

export default async function KitchensPage({ params, searchParams }: KitchensPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.list;

  const search = await searchParams;
  const query = first(search.q).trim().slice(0, 60);
  const cuisineId = first(search.cuisine) || null;
  // With no order chosen the API decides: closest match for a search, fastest otherwise.
  const chosenSort = first(search.sort);
  const filters = {
    cuisine: cuisineId ?? undefined,
    q: query || undefined,
    sort: chosenSort || undefined,
  };

  const [areas, cuisines, list] = await Promise.all([
    api.areas(),
    api.cuisines(),
    api.kitchens({ ...filters, area: await readArea() }).catch((error: unknown) => {
      if (isUnknownArea(error)) return api.kitchens(filters);
      throw error;
    }),
  ]);

  /** A link to this page with one cuisine chosen and the search and sort order kept. */
  const cuisineHref = (id: string | null) => {
    const next = new URLSearchParams();
    if (id) next.set('cuisine', id);
    if (query) next.set('q', query);
    if (chosenSort) next.set('sort', chosenSort);
    const text = next.toString();
    return `/${locale}/kitchens${text ? `?${text}` : ''}`;
  };

  const chip = (selected: boolean) =>
    `block rounded-full border-2 border-soot px-4 py-1.5 text-base font-semibold whitespace-nowrap transition-colors ${
      selected ? 'bg-soot text-ash' : 'hover:bg-soot hover:text-ash'
    }`;

  const filtered = query !== '' || cuisineId !== null;

  return (
    <>
      <SiteHeaderBar locale={locale} copy={dictionary.nav} />

      <main id="main" className="bg-ash">
        <div className="page-column pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(3.5rem,9vw,6.5rem)]">
          <h1 className="display text-section max-w-[20ch]">
            {list.area
              ? fill(copy.titleIn, { area: list.area.name[locale] })
              : copy.titleAll}
          </h1>

          <div className="mt-9">
            <ListControls
              locale={locale}
              copy={copy}
              areas={areas}
              areaId={list.area?.id ?? null}
              cuisineId={cuisineId}
              query={query}
              sort={chosenSort || (list.search === 'model' ? 'relevance' : 'fastest')}
              byRelevance={list.search === 'model'}
            />
          </div>

          <nav aria-label={copy.cuisinesLabel} className="mt-7">
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
              <li className="shrink-0">
                <Link
                  href={cuisineHref(null)}
                  aria-current={cuisineId === null ? 'true' : undefined}
                  className={chip(cuisineId === null)}
                >
                  {copy.cuisineAll}
                </Link>
              </li>
              {cuisines.map((cuisine) => (
                <li key={cuisine.id} className="shrink-0">
                  <Link
                    href={cuisineHref(cuisine.id)}
                    aria-current={cuisineId === cuisine.id ? 'true' : undefined}
                    className={chip(cuisineId === cuisine.id)}
                  >
                    {cuisine.name[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div
            aria-live="polite"
            className="mt-8 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-lg"
          >
            <p className="font-semibold">
              {fill(plural(list.total, copy.count), {
                count: formatNumber(list.total, locale),
              })}
            </p>
            {query ? <p>{fill(copy.resultsFor, { query })}</p> : null}
            {filtered ? (
              <Link
                href={`/${locale}/kitchens`}
                className="font-semibold underline underline-offset-4"
              >
                {copy.clear}
              </Link>
            ) : null}
          </div>

          {list.total > 0 ? (
            <ul className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {list.kitchens.map((kitchen, index) => (
                <KitchenCard
                  key={kitchen.slug}
                  kitchen={kitchen}
                  locale={locale}
                  copy={dictionary.card}
                  ratingCopy={dictionary.rating}
                  priority={index < 3}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-8 max-w-[44ch] border-t border-soot/25 pt-7 text-xl">
              {copy.empty}
            </p>
          )}
        </div>
      </main>

      <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
    </>
  );
}
