import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminKitchensView } from '@/components/admin/AdminKitchensView';
import { WorkspaceShell } from '@/components/work/WorkspaceShell';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { openAdminPage } from '@/lib/admin.server';

type AdminKitchensPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: AdminKitchensPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? { title: getDictionary(locale).admin.kitchens.title, robots: { index: false } }
    : {};
}

export default async function AdminKitchensPage({ params }: AdminKitchensPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);

  const opened = await openAdminPage({ locale, dictionary, page: 'kitchens' });
  if (!opened.ready) return opened.view;

  const [kitchens, owners] = await Promise.all([
    opened.api.adminKitchens(),
    opened.api.adminUsers({ role: 'owner' }),
  ]);

  return (
    <WorkspaceShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.admin.title}
      subtitle={opened.user.name}
      tabs={opened.tabs}
    >
      <AdminKitchensView
        locale={locale}
        initial={kitchens}
        owners={owners.map(({ id, name, phone }) => ({ id, name, phone }))}
        copy={dictionary.admin.kitchens}
        work={dictionary.work}
      />
    </WorkspaceShell>
  );
}
