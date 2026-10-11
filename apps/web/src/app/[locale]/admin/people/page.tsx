import { USER_ROLES, type UserRole } from '@unun/core';
import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RoleSelect } from '@/components/admin/RoleSelect';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { isLocale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { openAdminPage } from '@/lib/admin.server';
import { formatDay, formatNumber, plural } from '@/lib/format';

type AdminPeoplePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export async function generateMetadata({
  params,
}: AdminPeoplePageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).admin.people.title, robots: { index: false } }
    : {};
}

export default async function AdminPeoplePage({
  params,
  searchParams,
}: AdminPeoplePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.people;

  const opened = await openAdminPage({ locale, dictionary, page: 'people' });
  if (!opened.ready) return opened.view;

  const search = await searchParams;
  const query = first(search.q).trim().slice(0, 60);
  const role: UserRole | null =
    USER_ROLES.find((value) => value === first(search.role)) ?? null;

  const people = await opened.api.adminUsers({
    role: role ?? undefined,
    q: query || undefined,
  });

  const roleHref = (value: UserRole | null) => {
    const next = new URLSearchParams();
    if (value) next.set('role', value);
    if (query) next.set('q', query);
    const text = next.toString();
    return `/${locale}/admin/people${text ? `?${text}` : ''}`;
  };

  const chip = (selected: boolean) =>
    `block rounded-full border-2 border-soot px-4 py-1.5 text-base font-semibold whitespace-nowrap transition-colors ${
      selected ? 'bg-soot text-ash' : 'hover:bg-soot hover:text-ash'
    }`;

  return (
    <WorkspaceShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.admin.title}
      subtitle={opened.user.name}
      tabs={opened.tabs}
    >
      <Form action={`/${locale}/admin/people`} className="max-w-[36rem]">
        {role ? <input type="hidden" name="role" value={role} /> : null}
        <label htmlFor="people-search" className="field-label">
          {copy.search}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="people-search"
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

      <nav aria-label={copy.roleLabel} className="mt-6">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href={roleHref(null)}
              aria-current={role === null ? 'page' : undefined}
              className={chip(role === null)}
            >
              {copy.everyone}
            </Link>
          </li>
          {USER_ROLES.map((value) => (
            <li key={value}>
              <Link
                href={roleHref(value)}
                aria-current={value === role ? 'page' : undefined}
                className={chip(value === role)}
              >
                {dictionary.roles[value]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p aria-live="polite" className="mt-8 text-lg font-semibold tabular-nums">
        {fill(plural(people.length, copy.count), {
          count: formatNumber(people.length, locale),
        })}
      </p>

      {people.length === 0 ? (
        <p className="mt-4 text-lg">{copy.empty}</p>
      ) : (
        <ul className="mt-4 max-w-[56rem] border-t border-soot/25">
          {people.map((person) => {
            const isSelf = person.id === opened.user.id;
            return (
              <li
                key={person.id}
                className="grid items-center gap-x-8 gap-y-3 border-b border-soot/25 py-4 sm:grid-cols-[minmax(0,1fr)_14rem]"
              >
                <div>
                  <p className="text-[1.2rem] font-semibold">
                    {person.name || <span className="text-soot/60">{copy.unnamed}</span>}
                  </p>
                  <p className="font-mono text-base">{person.phone}</p>
                  <p className="mt-0.5 text-base text-soot/75 tabular-nums">
                    {fill(copy.joined, { date: formatDay(person.joinedAt, locale) })},{' '}
                    {fill(plural(person.orders, copy.orders), {
                      count: formatNumber(person.orders, locale),
                    })}
                    {person.kitchens.length > 0 ? (
                      <>
                        <br />
                        {fill(copy.runs, { kitchens: person.kitchens.join(', ') })}
                      </>
                    ) : null}
                  </p>
                </div>

                {isSelf ? (
                  <p className="text-base text-soot/75">
                    {dictionary.roles[person.role]}
                    <br />
                    {copy.you}
                  </p>
                ) : (
                  <RoleSelect
                    // After a change the list is read again; the key resets the menu to it.
                    key={person.role}
                    userId={person.id}
                    role={person.role}
                    label={fill(copy.role, { name: person.name || person.phone })}
                    roles={dictionary.roles}
                    failedLabel={dictionary.work.failed}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WorkspaceShell>
  );
}
