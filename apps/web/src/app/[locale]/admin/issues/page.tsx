import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ResolveIssue } from '@/components/admin/ResolveIssue';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { isLocale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { openAdminPage } from '@/lib/admin.server';
import { formatClock, formatDay, formatNumber, formatTaka, plural } from '@/lib/format';

type AdminIssuesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SCOPES = ['open', 'answered'] as const;
type Scope = (typeof SCOPES)[number];

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export async function generateMetadata({
  params,
}: AdminIssuesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).admin.issues.title, robots: { index: false } }
    : {};
}

export default async function AdminIssuesPage({
  params,
  searchParams,
}: AdminIssuesPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.issues;
  const kinds = dictionary.order.problem.kinds;

  const opened = await openAdminPage({ locale, dictionary, page: 'issues' });
  if (!opened.ready) return opened.view;

  const search = await searchParams;
  const scope: Scope = SCOPES.find((value) => value === first(search.scope)) ?? 'open';
  const { open, issues } = await opened.api.adminIssues(scope);

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
                href={`/${locale}/admin/issues${value === 'open' ? '' : `?scope=${value}`}`}
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
        {fill(plural(open, copy.waiting), { count: formatNumber(open, locale) })}
      </p>

      {issues.length === 0 ? (
        <p className="mt-4 text-lg">
          {scope === 'open' ? copy.empty : copy.emptyAnswered}
        </p>
      ) : (
        <ul className="mt-4 max-w-[60rem] border-t border-soot/25">
          {issues.map((issue) => {
            const { order } = issue;
            return (
              <li
                key={issue.id}
                className="grid gap-x-10 gap-y-4 border-b border-soot/25 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]"
              >
                <div>
                  <h2 className="display text-2xl">{kinds[issue.kind]}</h2>
                  <p className="mt-2 max-w-[56ch] text-lg">{issue.detail}</p>
                  <p className="mt-2 text-base text-soot/75">
                    {order.customer.name}, {order.customer.phone}
                    <br />
                    {fill(copy.reportedAt, {
                      date: formatDay(issue.createdAt, locale),
                      time: formatClock(issue.createdAt, locale),
                    })}
                  </p>

                  {issue.status === 'open' ? null : (
                    <p className="mt-4 text-lg">
                      <span className="font-semibold">
                        {issue.status === 'refunded'
                          ? fill(copy.answered.refunded, {
                              amount: formatTaka(issue.refund, locale),
                            })
                          : copy.answered.closed}
                      </span>
                      {issue.note ? (
                        <>
                          <br />
                          <span className="text-base text-soot/80">
                            {fill(copy.reply, { note: issue.note })}
                          </span>
                        </>
                      ) : null}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-lg">
                    <span className="font-mono font-medium">{order.publicId}</span>,{' '}
                    {order.kitchen[locale]}
                  </p>
                  <ul className="mt-1 text-base text-soot/80">
                    {order.lines.map((line, index) => (
                      <li key={index} className="tabular-nums">
                        {formatNumber(line.quantity, locale)} × {line.name[locale]}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-base tabular-nums">
                    {fill(copy.total, { amount: formatTaka(order.total, locale) })},{' '}
                    {dictionary.payment.methods[order.payment.method].toLocaleLowerCase(
                      locale,
                    )}
                    ,{' '}
                    {dictionary.payment.state[order.payment.state].toLocaleLowerCase(
                      locale,
                    )}
                    {order.arrival ? (
                      <>
                        <br />
                        <span
                          className={
                            order.arrival === 'late' ? 'font-semibold text-clay' : ''
                          }
                        >
                          {copy.arrival[order.arrival]}
                        </span>
                      </>
                    ) : null}
                  </p>

                  {issue.status === 'open' ? (
                    <div className="mt-4">
                      <p className="mb-3 text-base text-soot/75 tabular-nums">
                        {order.refundable > 0
                          ? fill(copy.canRefund, {
                              amount: formatTaka(order.refundable, locale),
                            })
                          : copy.cannotRefund}
                      </p>
                      <ResolveIssue
                        locale={locale}
                        issueId={issue.id}
                        publicId={order.publicId}
                        refundable={order.refundable}
                        copy={copy}
                        work={dictionary.work}
                      />
                    </div>
                  ) : null}

                  <p className="mt-4">
                    <Link
                      href={`/${locale}/orders/${order.token}`}
                      className="text-base font-semibold underline underline-offset-4"
                    >
                      {fill(copy.track, { id: order.publicId })}
                    </Link>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WorkspaceShell>
  );
}
