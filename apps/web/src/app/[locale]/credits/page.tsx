import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeaderBar } from '@/components/layout/SiteHeader';
import { Photo } from '@/components/ui/Photo';
import { isLocale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { allClips, allPhotos } from '@/lib/media';

type CreditsPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: CreditsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).credits.title } : {};
}

type Credited = { credit: string; source: string; page: string };

/** The author's name, linked to the original when it came from a stock library. */
function Credit({ entry, template }: { entry: Credited; template: string }) {
  const text = entry.source
    ? fill(template, { name: entry.credit, source: entry.source })
    : entry.credit;

  return entry.page ? (
    <a href={entry.page} className="text-base font-semibold underline underline-offset-4">
      {text}
    </a>
  ) : (
    <span className="text-base font-semibold">{text}</span>
  );
}

/**
 * Every photograph and clip on the site, with who made it. The page is also the quick
 * way to check that each photograph suits the dish it stands for.
 */
export default async function CreditsPage({ params }: CreditsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.credits;

  return (
    <>
      <SiteHeaderBar locale={locale} copy={dictionary.nav} />

      <main id="main" className="bg-ash">
        <div className="page-column pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(3.5rem,9vw,6.5rem)]">
          <h1 className="display text-section">{copy.title}</h1>
          <p className="mt-5 max-w-[56ch] text-xl">{copy.body}</p>
          <p className="mt-4 max-w-[56ch] text-lg text-soot/75">{copy.standIns}</p>

          {allClips.length > 0 ? (
            <section aria-labelledby="credits-film" className="mt-14">
              <h2 id="credits-film" className="display text-[clamp(1.6rem,3vw,2.2rem)]">
                {copy.film}
              </h2>
              <ul className="mt-5 border-t border-soot/25">
                {allClips.map((clip) => (
                  <li key={clip.key} className="border-b border-soot/25 py-4 text-lg">
                    <span lang="en">{clip.shows}</span>
                    <br />
                    <Credit entry={clip} template={copy.by} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {allPhotos.length > 0 ? (
            <section aria-labelledby="credits-photos" className="mt-14">
              <h2 id="credits-photos" className="display text-[clamp(1.6rem,3vw,2.2rem)]">
                {copy.photos}
              </h2>
              <ul className="mt-7 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {allPhotos.map((photo) => (
                  <li key={photo.key}>
                    <span className="relative block aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-ash-deep">
                      <Photo
                        src={photo.src}
                        alt={photo.shows}
                        sizes="(min-width: 1024px) 280px, (min-width: 640px) 46vw, 92vw"
                      />
                    </span>
                    <p className="mt-3 text-base">
                      {fill(copy.usedFor, { use: photo.standsFor })}
                    </p>
                    <Credit entry={photo} template={copy.by} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>

      <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
    </>
  );
}
