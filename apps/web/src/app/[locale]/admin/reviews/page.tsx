import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReviewVisibility } from '@/components/admin/ReviewVisibility';
import { Stars } from '@/components/ui/Stars';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { isLocale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { openAdminPage } from '@/lib/admin.server';
import { formatDay, formatNumber, plural } from '@/lib/format';

type AdminReviewsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SCOPES = ['all', 'hidden'] as const;
type Scope = (typeof SCOPES)[number];

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export async function generateMetadata({
  params,
}: AdminReviewsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).admin.reviews.title, robots: { index: false } }
    : {};
}

export default async function AdminReviewsPage({
  params,
  searchParams,
}: AdminReviewsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.reviews;

  const opened = await openAdminPage({ locale, dictionary, page: 'reviews' });
  if (!opened.ready) return opened.view;

  const search = await searchParams;
  const scope: Scope = SCOPES.find((value) => value === first(search.scope)) ?? 'all';
  const { total, reviews } = await opened.api.adminReviews(
    scope === 'hidden' ? 'hidden' : undefined,
  );

  return (
    <WorkspaceShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.admin.title}
      subtitle={opened.user.name}
      tabs={opened.tabs}
    >
      <nav aria-label={copy.scopeLabel}>
        <ul className="flex flex-wrap gap-2">
          {SCOPES.map((value) => (
            <li key={value}>
              <Link
                href={`/${locale}/admin/reviews${value === 'all' ? '' : `?scope=${value}`}`}
                aria-current={value === scope ? 'page' : undefined}
                className={`block rounded-full border-2 border-soot px-4 py-1.5 text-base font-semibold whitespace-nowrap transition-colors ${
                  value === scope ? 'bg-soot text-ash' : 'hover:bg-soot hover:text-ash'
                }`}
              >
                {copy.scope[value]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p aria-live="polite" className="mt-8 text-lg font-semibold tabular-nums">
        {fill(plural(total, copy.count), { count: formatNumber(total, locale) })}
        {total > reviews.length ? (
          <span className="ml-2 font-normal text-soot/75">
            {fill(copy.newest, { count: formatNumber(reviews.length, locale) })}
          </span>
        ) : null}
      </p>

      {reviews.length === 0 ? (
        <p className="mt-4 text-lg">
          {scope === 'hidden' ? copy.emptyHidden : copy.empty}
        </p>
      ) : (
        <ul className="mt-4 max-w-[60rem] border-t border-soot/25">
          {reviews.map((review) => {
            const names = { author: review.author, kitchen: review.kitchen.name[locale] };
            return (
              <li
                key={review.id}
                className="grid items-start gap-x-8 gap-y-3 border-b border-soot/25 py-5 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className={review.hidden ? 'text-soot/60' : ''}>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars
                      stars={review.stars}
                      label={fill(plural(review.stars, dictionary.rating.stars), {
                        count: formatNumber(review.stars, locale),
                      })}
                    />
                    {review.hidden ? (
                      <span className="chip bg-clay text-ash">{copy.hidden}</span>
                    ) : null}
                  </p>
                  <p className="mt-2 max-w-[60ch] text-lg">
                    {review.comment ?? copy.noComment}
                  </p>
                  <p className="mt-1 text-base text-soot/75">
                    {review.author}, {formatDay(review.at, locale)}
                    <br />
                    <Link
                      href={`/${locale}/orders/${review.order.token}`}
                      className="underline underline-offset-4"
                    >
                      {fill(copy.about, {
                        kitchen: review.kitchen.name[locale],
                        id: review.order.publicId,
                      })}
                    </Link>
                  </p>
                </div>

                <div>
                  <ReviewVisibility
                    reviewId={review.id}
                    hidden={review.hidden}
                    label={review.hidden ? copy.show : copy.hide}
                    describedAs={fill(
                      review.hidden ? copy.showLabel : copy.hideLabel,
                      names,
                    )}
                    failedText={dictionary.work.failed}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WorkspaceShell>
  );
}
