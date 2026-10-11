import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SignInPanel } from '@/components/auth/SignInPanel';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeaderBar } from '@/components/layout/SiteHeader';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { safeNext } from '@/lib/roles';
import { currentUser } from '@/lib/session.server';

type SignInPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: SignInPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).auth.title } : {};
}

export default async function SignInPage({ params, searchParams }: SignInPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const { next } = await searchParams;

  const [user, demoAccounts] = await Promise.all([
    currentUser(),
    // Without the list the page still signs people in, so a failure here is not fatal.
    api.demoAccounts().catch(() => []),
  ]);

  return (
    <>
      <SiteHeaderBar locale={locale} copy={dictionary.nav} />

      <main id="main" className="bg-ash">
        <div className="page-column pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(3.5rem,9vw,6.5rem)]">
          <SignInPanel
            locale={locale}
            copy={dictionary.auth}
            roles={dictionary.roles}
            next={safeNext(Array.isArray(next) ? next[0] : next, locale)}
            user={user}
            demoAccounts={demoAccounts}
          />
        </div>
      </main>

      <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
    </>
  );
}
