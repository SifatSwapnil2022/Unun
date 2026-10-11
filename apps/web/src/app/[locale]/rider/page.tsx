import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RiderBoardView } from '@/components/rider/RiderBoardView';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { WrongRole } from '@/components/work/WrongRole';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { requireRole, serverApi } from '@/lib/session.server';

type RiderPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: RiderPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).rider.title, robots: { index: false } }
    : {};
}

export default async function RiderPage({ params }: RiderPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const path = `/${locale}/rider`;

  const access = await requireRole(locale, 'rider', path);
  if (!access.allowed) {
    return (
      <WrongRole
        locale={locale}
        dictionary={dictionary}
        role="rider"
        user={access.user}
        path={path}
      />
    );
  }

  const board = await (await serverApi()).riderBoard();

  return (
    <WorkspaceShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.rider.title}
      subtitle={access.user.name}
    >
      <RiderBoardView
        locale={locale}
        initial={board}
        copy={dictionary.rider}
        work={dictionary.work}
        status={dictionary.status}
        mapCopy={dictionary.order.map}
      />
    </WorkspaceShell>
  );
}
