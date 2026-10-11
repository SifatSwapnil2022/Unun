import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PartnerMenuView } from '@/components/partner/PartnerMenuView';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { openPartnerPage } from '@/lib/partner.server';

type PartnerMenuPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: PartnerMenuPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).partner.menu.title, robots: { index: false } }
    : {};
}

export default async function PartnerMenuPage({
  params,
  searchParams,
}: PartnerMenuPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const { kitchen: requested } = await searchParams;

  const opened = await openPartnerPage({
    locale,
    dictionary,
    page: 'menu',
    requested: Array.isArray(requested) ? requested[0] : requested,
  });
  if (!opened.ready) return opened.view;

  const menu = await opened.api.partnerMenu(opened.kitchen.slug);

  return (
    <WorkspaceShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.partner.title}
      subtitle={opened.kitchen.name[locale]}
      tabs={opened.tabs}
    >
      <PartnerMenuView
        key={opened.kitchen.slug}
        locale={locale}
        initial={menu}
        copy={dictionary.partner.menu}
        work={dictionary.work}
        allergenCopy={dictionary.allergens}
      />
    </WorkspaceShell>
  );
}
