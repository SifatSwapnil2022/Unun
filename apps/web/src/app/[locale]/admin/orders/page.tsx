import { isFinal } from '@unun/core';
import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CancelOrderButton } from '@/components/admin/CancelOrderButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { isLocale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { openAdminPage } from '@/lib/admin.server';
import { formatClock, formatDay, formatNumber, formatTaka, plural } from '@/lib/format';

type AdminOrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SCOPES = ['all', 'in_progress', 'finished'] as const;
type Scope = (typeof SCOPES)[number];

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export async function generateMetadata({
  params,
}: AdminOrdersPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).admin.orders.title, robots: { index: false } }
    : {};
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: AdminOrdersPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.orders;

  const opened = await openAdminPage({ locale, dictionary, page: 'orders' });
  if (!opened.ready) return opened.view;

  const search = await searchParams;
  const query = first(search.q).trim().slice(0, 60);
  const scope: Scope = SCOPES.find((value) => value === first(search.scope)) ?? 'all';

  const { total, orders } = await opened.api.adminOrders({
    scope: scope === 'all' ? undefined : scope,
    q: query || undefined,
  });

  const scopeHref = (value: Scope) => {
    const next = new URLSearchParams();
    if (value !== 'all') next.set('scope', value);
    if (query) next.set('q', query);
    const text = next.toString();
    return `/${locale}/admin/orders${text ? `?${text}` : ''}`;
  };

  return (
    <WorkspaceShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.admin.title}
      subtitle={opened.user.name}
      tabs={opened.tabs}
    >
      <Form action={`/${locale}/admin/orders`} className="max-w-[36rem]">
        {scope === 'all' ? null : <input type="hidden" name="scope" value={scope} />}
        <label htmlFor="order-search" className="field-label">
          {copy.search}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="order-search"
            type="search"
            name="q"
            defaultValue={query}
            maxLength={60}
            className="field-input mt-0 min-w-0 flex-1"
          />
          <button type="submit" className="btn btn-dark shrink-0">
            {copy.submit}
          </button>
        </div>
      </Form>

      <nav aria-label={copy.scopeLabel} className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {SCOPES.map((value) => (
            <li key={value}>
              <Link
                href={scopeHref(value)}
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
        {total > orders.length ? (
          <span className="ml-2 font-normal text-soot/75">
            {fill(copy.newest, { count: formatNumber(orders.length, locale) })}
          </span>
        ) : null}
      </p>

      {orders.length === 0 ? (
        <p className="mt-4 text-lg">{copy.empty}</p>
      ) : (
        <ul className="mt-4 border-t border-soot/25">
          {orders.map((order) => (
            <li
              key={order.publicId}
              className="grid gap-x-8 gap-y-2 border-b border-soot/25 py-4 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-lg font-medium">{order.publicId}</span>
                  <StatusChip
                    status={order.status}
                    label={dictionary.status[order.status]}
                  />
                  <span className="text-base text-soot/75">
                    {order.handledBy === 'autopilot'
                      ? dictionary.work.autopilot
                      : copy.byStaff}
                    , {dictionary.payment.methods[order.payment.method]},{' '}
                    {dictionary.payment.state[order.payment.state].toLocaleLowerCase(
                      locale,
                    )}
                  </span>
                </p>
                <p className="mt-1 text-lg">
                  <span className="font-semibold">{order.kitchen.name[locale]}</span>,{' '}
                  {fill(dictionary.rider.route, {
                    from: order.kitchen.area[locale],
                    to: order.deliverTo.area[locale],
                  })}
                </p>
                <p className="mt-0.5 text-base text-soot/80">
                  {order.customer.name}, {order.customer.phone}
                  {order.rider ? (
                    <>
                      <br />
                      {fill(copy.rider, { name: order.rider.name })}
                    </>
                  ) : null}
                </p>
                {order.cancelReason ? (
                  <p className="mt-0.5 text-base text-clay">{order.cancelReason}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 lg:flex-col lg:items-end">
                <p className="text-lg font-semibold tabular-nums">
                  {formatTaka(order.total, locale)}
                </p>
                <p className="text-base text-soot/75 tabular-nums">
                  {formatDay(order.placedAt, locale)},{' '}
                  {formatClock(order.placedAt, locale)}
                </p>
                {/* A div, not a paragraph: the cancel button brings its dialog with it. */}
                <div className="flex flex-wrap items-baseline gap-x-5">
                  <Link
                    href={`/${locale}/orders/${order.token}`}
                    className="text-base font-semibold underline underline-offset-4"
                  >
                    {fill(copy.track, { id: order.publicId })}
                  </Link>
                  {isFinal(order.status) ? null : (
                    <CancelOrderButton
                      publicId={order.publicId}
                      copy={copy}
                      work={dictionary.work}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WorkspaceShell>
  );
}
