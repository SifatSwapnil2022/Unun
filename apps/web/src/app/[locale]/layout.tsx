import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { MobileTabs } from '@/components/layout/MobileTabs';
import { OfflineReady } from '@/components/layout/OfflineReady';
import { isLocale, locales } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import '../globals.css';

type LocaleParams = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const { meta } = getDictionary(locale);
  return {
    title: { default: meta.title, template: '%s | Unun' },
    description: meta.description,
    alternates: {
      languages: { en: '/en', bn: '/bn' },
    },
    // Kept on an iPhone's home screen, the site opens without Safari's bars around it.
    appleWebApp: { capable: true, title: 'Unun', statusBarStyle: 'black-translucent' },
    // A rider's phone number is a link where the page makes it one, and nowhere else.
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#16120e',
  // Lets the page draw under the status bar and the home indicator. The header and the
  // tab bar then pad themselves by the room the phone says it needs.
  viewportFit: 'cover',
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { nav } = getDictionary(locale);

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-turmeric focus:px-5 focus:py-3 focus:text-soot"
        >
          {nav.skipToContent}
        </a>
        {/* Room for the tab bar, so it never covers the end of a page. */}
        <div className="pb-[var(--tabbar)]">{children}</div>
        <MobileTabs locale={locale} copy={nav} />
        <OfflineReady />
      </body>
    </html>
  );
}
