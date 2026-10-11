import { USER_ROLES } from '@unun/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { isLocale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { openAdminPage } from '@/lib/admin.server';
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatTaka,
  formatWeekday,
  plural,
} from '@/lib/format';

type AdminPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: AdminPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).admin.title, robots: { index: false } }
    : {};
}

const heading = 'display text-[clamp(1.6rem,3vw,2.2rem)]';

export default async function AdminOverviewPage({ params }: AdminPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.overview;

  const opened = await openAdminPage({ locale, dictionary, page: 'overview' });
  if (!opened.ready) return opened.view;

  const [overview, system] = await Promise.all([
    opened.api.adminOverview(),
    opened.api.adminSystem(),
  ]);
  const { ml } = system;
  const { today, week, kitchens, people } = overview;
  const count = (value: number) => formatNumber(value, locale);

  const figures = [
    {
      term: copy.ordersToday,
      value: count(today.orders),
      detail: fill(copy.todayDetail, {
        delivered: count(today.delivered),
        cancelled: count(today.cancelled),
      }),
    },
    { term: copy.salesToday, value: formatTaka(today.sales, locale), detail: null },
    { term: copy.inProgress, value: count(overview.inProgress), detail: null },
    {
      term: copy.onTime,
      value:
        week.onTimeShare === null
          ? copy.noDeliveries
          : formatPercent(week.onTimeShare, locale),
      detail: fill(copy.weekDetail, {
        orders: count(week.orders),
        sales: formatTaka(week.sales, locale),
      }),
    },
  ];

  const busiest = Math.max(...overview.days.map((day) => day.orders), 1);

  return (
    <WorkspaceShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.admin.title}
      subtitle={opened.user.name}
      tabs={opened.tabs}
    >
      {overview.openIssues > 0 ? (
        <p className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-turmeric px-5 py-4 text-lg">
          <span className="font-semibold tabular-nums">
            {fill(plural(overview.openIssues, copy.openIssues), {
              count: count(overview.openIssues),
            })}
          </span>
          <Link
            href={`/${locale}/admin/issues`}
            className="font-semibold underline underline-offset-4"
          >
            {copy.answerIssues}
          </Link>
        </p>
      ) : null}

      <dl className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.term} className="border-t-[3px] border-soot pt-3">
            <dt className="text-base text-soot/75">{figure.term}</dt>
            <dd className="display mt-1.5 text-[clamp(2rem,4vw,3rem)] tabular-nums">
              {figure.value}
            </dd>
            {figure.detail ? (
              <dd className="mt-1.5 text-base text-soot/75 tabular-nums">
                {figure.detail}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>

      <section aria-labelledby="admin-week" className="mt-16">
        <h2 id="admin-week" className={heading}>
          {copy.week}
        </h2>
        <ul className="mt-5 max-w-[56rem] border-t border-soot/25">
          {overview.days.map((day) => (
            <li
              key={day.date}
              className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-5 gap-y-1 border-b border-soot/25 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_7rem_6rem]"
            >
              <p className="text-base">
                <span className="font-semibold">{formatWeekday(day.date, locale)}</span>{' '}
                <span className="text-soot/75">{formatDate(day.date, locale)}</span>
              </p>
              {/* The bar repeats the order count beside it, so it is hidden from readers. */}
              <span aria-hidden="true" className="block h-4 bg-ash-deep">
                <span
                  className="block h-full bg-leaf"
                  style={{ width: `${(day.orders / busiest) * 100}%` }}
                />
              </span>
              <p className="text-base tabular-nums sm:text-right">
                {fill(plural(day.orders, copy.dayOrders), { count: count(day.orders) })}
              </p>
              <p className="text-right text-base font-semibold tabular-nums">
                {formatTaka(day.sales, locale)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-system" className="mt-16 max-w-[56rem]">
        <h2 id="admin-system" className={heading}>
          {copy.system.heading}
        </h2>
        {ml.running ? (
          <ul className="mt-3 space-y-1.5 text-lg">
            <li>
              {ml.delivery.ready
                ? fill(copy.system.delivery, {
                    version: ml.delivery.version ?? '',
                    source:
                      ml.delivery.trainedOn === 'api'
                        ? copy.system.trainedOn.api
                        : copy.system.trainedOn.synthetic,
                  })
                : copy.system.deliveryNotReady}
            </li>
            <li>
              {fill(copy.system.search, {
                kitchens: count(ml.search.kitchens),
                dishes: count(ml.search.dishes),
              })}
            </li>
            <li>{fill(copy.system.pairings, { baskets: count(ml.pairings.baskets) })}</li>
          </ul>
        ) : (
          <p className="mt-3 max-w-[60ch] text-lg">{copy.system.off}</p>
        )}
      </section>

      <div className="mt-16 grid max-w-[56rem] gap-x-14 gap-y-10 sm:grid-cols-2">
        <section aria-labelledby="admin-kitchens">
          <h2 id="admin-kitchens" className={heading}>
            {copy.kitchens}
          </h2>
          <p className="mt-3 text-lg">
            {fill(copy.kitchensLine, {
              total: count(kitchens.total),
              byHand: count(kitchens.byHand),
              paused: count(kitchens.paused),
              hidden: count(kitchens.hidden),
            })}
          </p>
        </section>
        <section aria-labelledby="admin-people">
          <h2 id="admin-people" className={heading}>
            {copy.people}
          </h2>
          <dl className="mt-3 grid max-w-[22rem] grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 text-lg">
            {USER_ROLES.map((role) => (
              <div key={role} className="contents">
                <dt>{dictionary.roles[role]}</dt>
                <dd className="text-right font-semibold tabular-nums">
                  {count(people[role])}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </WorkspaceShell>
  );
}
