import { notFound } from 'next/navigation';
import { Cuisines } from '@/components/home/Cuisines';
import { Hero } from '@/components/home/Hero';
import { ForYou } from '@/components/home/ForYou';
import { NearYou } from '@/components/home/NearYou';
import { Offers } from '@/components/home/Offers';
import { Pricing } from '@/components/home/Pricing';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Notice } from '@/components/ui/Notice';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { api, isUnknownArea } from '@/lib/api';
import { readArea } from '@/lib/area.server';
import { currentUser, serverApi } from '@/lib/session.server';

type HomePageProps = { params: Promise<{ locale: string }> };

/** The kitchen whose most-ordered dishes make up the example receipt. */
const EXAMPLE_KITCHEN = 'dum-ghor';

async function loadHome(area: string | undefined) {
  try {
    const [areas, offers, cuisines, list, example] = await Promise.all([
      api.areas(),
      api.offers(),
      api.cuisines(),
      // A remembered area that no longer exists is ignored instead of breaking the page.
      api.kitchens({ area }).catch((error: unknown) => {
        if (isUnknownArea(error)) return api.kitchens();
        throw error;
      }),
      api.kitchen(EXAMPLE_KITCHEN).catch(() => null),
    ]);
    return { areas, offers, cuisines, list, example };
  } catch {
    return null;
  }
}

/** Kitchens picked for the signed-in visitor. An extra: any failure shows nothing. */
async function loadPicks(area: string | undefined) {
  if (!(await currentUser())) return null;
  try {
    return await (await serverApi()).recommendations(area);
  } catch {
    return null;
  }
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const area = await readArea();
  const [home, picks] = await Promise.all([loadHome(area), loadPicks(area)]);

  return (
    <>
      <main id="main">
        <Hero locale={locale} dictionary={dictionary} areas={home?.areas ?? []} />

        {home ? (
          <>
            <Offers locale={locale} copy={dictionary.offers} offers={home.offers} />
            {picks ? (
              <ForYou
                locale={locale}
                picks={picks}
                copy={dictionary.forYou}
                card={dictionary.card}
                rating={dictionary.rating}
              />
            ) : null}
            <Cuisines
              locale={locale}
              copy={dictionary.cuisines}
              cuisines={home.cuisines}
            />
            <NearYou
              locale={locale}
              copy={dictionary.nearYou}
              card={dictionary.card}
              rating={dictionary.rating}
              list={home.list}
            />
            <Pricing locale={locale} copy={dictionary.pricing} kitchen={home.example} />
          </>
        ) : (
          <Notice title={dictionary.errors.apiDownTitle}>
            {dictionary.errors.apiDownBody}
          </Notice>
        )}
      </main>
      <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
    </>
  );
}
