import { firstName } from '@unun/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddressBook } from '@/components/account/AddressBook';
import { ProfileForm } from '@/components/account/ProfileForm';
import { SignOutButton } from '@/components/account/SignOutButton';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeaderBar } from '@/components/layout/SiteHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { isLocale, type Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { formatDay, formatNumber, formatTaka } from '@/lib/format';
import { HOME_BY_ROLE } from '@/lib/roles';
import { requireUser, serverApi } from '@/lib/session.server';

type AccountPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: AccountPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).account.title, robots: { index: false } }
    : {};
}

const heading = 'display text-[clamp(1.6rem,3vw,2.2rem)]';

/** Joins names the way a sentence lists them: "A", "A and B", "A, B and C". */
function listNames(names: string[], locale: Locale): string {
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names);
}

/** What a restaurant owner, rider or admin is told about the work their account does. */
async function workspaceLine(
  role: 'owner' | 'rider' | 'admin',
  copy: Dictionary['account']['workspace'],
  locale: Locale,
): Promise<string> {
  if (role !== 'owner') return copy[role];

  const kitchens = await (await serverApi()).partnerKitchens().catch(() => []);
  return kitchens.length > 0
    ? fill(copy.owner, {
        kitchens: listNames(
          kitchens.map((kitchen) => kitchen.name[locale]),
          locale,
        ),
      })
    : copy.ownerNoKitchen;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.account;
  const user = await requireUser(locale, `/${locale}/account`);
  const api = await serverApi();

  const [orders, addresses, areas, workspace] = await Promise.all([
    api.myOrders(),
    api.addresses(),
    api.areas(),
    user.role === 'customer' ? null : workspaceLine(user.role, copy.workspace, locale),
  ]);

  const name = firstName(user.name);

  return (
    <>
      <SiteHeaderBar locale={locale} copy={dictionary.nav} />

      <main id="main" className="bg-ash">
        <div className="page-column pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(3.5rem,9vw,6.5rem)]">
          <h1 className="display text-section">
            {name ? fill(copy.greeting, { name }) : copy.title}
          </h1>

          {workspace ? (
            <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xl">
              {workspace}
              <Link
                href={`/${locale}/${HOME_BY_ROLE[user.role]}`}
                className="btn btn-primary"
              >
                {dictionary.nav.workspace[user.role]}
              </Link>
            </p>
          ) : null}

          <section aria-labelledby="account-orders" className="mt-14">
            <h2 id="account-orders" className={heading}>
              {copy.orders}
            </h2>

            {orders.length === 0 ? (
              <>
                <p className="mt-4 text-lg">{copy.noOrders}</p>
                <Link href={`/${locale}/kitchens`} className="btn btn-dark mt-6">
                  {copy.browse}
                </Link>
              </>
            ) : (
              <ul className="mt-5 border-t border-soot/25">
                {orders.map((order) => (
                  <li key={order.publicId} className="border-b border-soot/25">
                    <Link
                      href={`/${locale}/orders/${order.token}`}
                      aria-label={fill(copy.viewOrder, {
                        id: order.publicId,
                        kitchen: order.kitchen.name[locale],
                      })}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 py-4"
                    >
                      <span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-[1.2rem] font-semibold group-hover:underline group-hover:underline-offset-4">
                            {fill(copy.orderFrom, {
                              kitchen: order.kitchen.name[locale],
                              date: formatDay(order.placedAt, locale),
                            })}
                          </span>
                          {order.paymentState === 'awaiting' ? (
                            <span className="chip bg-turmeric text-soot">
                              {dictionary.payment.state.awaiting}
                            </span>
                          ) : (
                            <StatusChip
                              status={order.status}
                              label={dictionary.status[order.status]}
                            />
                          )}
                        </span>
                        <span className="mt-1 block text-base text-soot/75">
                          {order.lines
                            .map(
                              (line) =>
                                `${formatNumber(line.quantity, locale)} × ${line.name[locale]}`,
                            )
                            .join(', ')}
                        </span>
                      </span>
                      <span className="text-lg font-semibold tabular-nums">
                        {formatTaka(order.total, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="account-addresses" className="mt-16">
            <h2 id="account-addresses" className={heading}>
              {copy.addresses}
            </h2>
            <div className="mt-5">
              <AddressBook
                locale={locale}
                initial={addresses}
                areas={areas}
                copy={copy}
              />
            </div>
          </section>

          <section aria-labelledby="account-profile" className="mt-16">
            <h2 id="account-profile" className={heading}>
              {copy.profile}
            </h2>
            <div className="mt-5">
              <ProfileForm user={user} copy={copy} />
            </div>
          </section>

          <div className="mt-16 border-t border-soot/25 pt-8">
            <SignOutButton label={copy.signOut} home={`/${locale}`} />
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
    </>
  );
}
