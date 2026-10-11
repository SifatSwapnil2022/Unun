import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PartnerBoardView } from '@/components/partner/PartnerBoardView';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { openPartnerPage } from '@/lib/partner.server';

type PartnerPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PartnerPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).partner.title, robots: { index: false } }
    : {};
}

export default async function PartnerPage({ params, searchParams }: PartnerPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const { kitchen: requested } = await searchParams;

  const opened = await openPartnerPage({
    locale,
    dictionary,
    page: 'orders',
    requested: Array.isArray(requested) ? requested[0] : requested,
  });
  if (!opened.ready) return opened.view;

  const board = await opened.api.partnerBoard(opened.kitchen.slug);

  return (
    <WorkspaceShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.partner.title}
      subtitle={opened.user.name}
      tabs={opened.tabs}
    >
      <PartnerBoardView
        // A different kitchen is a different board, with its own state.
        key={opened.kitchen.slug}
        locale={locale}
        initial={board}
        kitchens={opened.kitchens}
        copy={dictionary.partner}
        work={dictionary.work}
        status={dictionary.status}
        payment={dictionary.payment}
        ratingCopy={dictionary.rating}
      />
    </WorkspaceShell>
  );
}
