import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';

export type WorkTab = { href: string; label: string; current: boolean };

type WorkspaceShellProps = {
  locale: Locale;
  dictionary: Dictionary;
  title: string;
  /** A line under the title: whose workspace this is. */
  subtitle?: string;
  tabs?: { label: string; items: WorkTab[] };
  children: ReactNode;
};

/**
 * The frame of the kitchen, rider and admin workspaces: the site header, the
 * workspace's name and its pages on a soot band, and the work itself below.
 */
export function WorkspaceShell({
  locale,
  dictionary,
  title,
  subtitle,
  tabs,
  children,
}: WorkspaceShellProps) {
  return (
    <>
      <div className="bg-soot text-ash">
        <SiteHeader locale={locale} copy={dictionary.nav} />

        <div className="page-column pt-[clamp(2rem,5vw,3.25rem)]">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pb-6">
            <div>
              <h1 className="display text-[clamp(2.25rem,5vw,3.75rem)]">{title}</h1>
              {subtitle ? <p className="mt-2 text-lg text-ash/80">{subtitle}</p> : null}
            </div>
            <Link
              href={`/${locale}/account`}
              className="text-base underline underline-offset-8 hover:text-turmeric"
            >
              {dictionary.nav.account}
            </Link>
          </div>

          {tabs ? (
            <nav aria-label={tabs.label}>
              <ul className="flex gap-7 overflow-x-auto">
                {tabs.items.map((tab) => (
                  <li key={tab.href} className="shrink-0">
                    <Link
                      href={tab.href}
                      aria-current={tab.current ? 'page' : undefined}
                      className="work-tab"
                    >
                      {tab.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>

      <main id="main" className="min-h-[60vh] bg-ash">
        <div className="page-column pt-[clamp(2rem,5vw,3.25rem)] pb-[clamp(3.5rem,9vw,6.5rem)]">
          {children}
        </div>
      </main>

      <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
    </>
  );
}
